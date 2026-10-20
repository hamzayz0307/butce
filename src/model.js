// Budget math: installments, bills, card statements, goals and period totals.
// Pure functions over `state.data` — no DOM, so they are covered by tests.
// "key" is a budget period key (see period.js); card statements use calendar months.
import { state, accountById, isSavingAcc } from './state.js';
import { r2, pad, today, shiftDays, addMonths, daysInMonth, monthDiff } from './utils.js';
import { curPeriod, inPeriod, dueInPeriod, dayInPeriod } from './period.js';
import { toBase, isBaseCurrency } from './money.js';

/* ---------- Installments (taksit) ---------- */
// Which installment of `plan` falls in month `key`, and how much it is.
// Amounts are rounded to kuruş; the last installment absorbs the rounding.
// A calendar month's installment is counted in the period that starts in that month.
export function portionFor(plan, key) {
  const i = monthDiff(plan.first_month, key);
  if (i < 0 || i >= plan.count) return null;
  const base = r2(plan.total / plan.count);
  const amount = i === plan.count - 1 ? r2(plan.total - base * (plan.count - 1)) : base;
  return { index: i + 1, amount };
}

export function portionsInMonth(key) {
  const out = [];
  for (const plan of state.data.installments) {
    const p = portionFor(plan, key);
    if (p) out.push({ plan, ...p });
  }
  return out;
}

export const planEnd = plan => addMonths(plan.first_month, plan.count - 1);
export const planPaidThrough = (plan, key) => Math.max(0, Math.min(plan.count, monthDiff(plan.first_month, key) + 1));
export function planRemaining(plan, key) {
  let s = 0;
  for (let i = planPaidThrough(plan, key); i < plan.count; i++) s += portionFor(plan, addMonths(plan.first_month, i)).amount;
  return r2(s);
}

/* ---------- Transactions & bills ---------- */
export const txInPeriod = key => state.data.transactions.filter(x => inPeriod(x.date, key));
export const billsForMonth = key => state.data.bills.filter(b => (b.start_month || '0000-00') <= key);
export const billDue = (b, key) => dueInPeriod(b.day, key);
// A payment is matched by the due date it paid, so changing the period start day
// doesn't mark a new due date as paid. Older entries only stored the month.
const paidDue = (x, b) => x.bill_due || `${x.bill_month}-${pad(Math.min(b.day, daysInMonth(x.bill_month)))}`;
export const billPaidTx = (b, key) => {
  const due = billDue(b, key);
  return state.data.transactions.find(x => x.bill_id === b.id && paidDue(x, b) === due);
};

/* ---------- Credit cards ---------- */
export const stmtDateIn = (card, key) => `${key}-${pad(Math.min(card.statement_day, daysInMonth(key)))}`;
export function nextStatement(card, d) { const k = d.slice(0, 7), s = stmtDateIn(card, k); return s >= d ? s : stmtDateIn(card, addMonths(k, 1)); }
export function prevStatement(card, d) { const k = d.slice(0, 7), s = stmtDateIn(card, k); return s < d ? s : stmtDateIn(card, addMonths(k, -1)); }
// Payment due date for a statement: same month if the due day comes after the statement day, else next month.
export function dueFor(card, stmt) {
  const k = stmt.slice(0, 7), k2 = card.due_day > card.statement_day ? k : addMonths(k, 1);
  return `${k2}-${pad(Math.min(card.due_day, daysInMonth(k2)))}`;
}
// Card spending since the previous statement + installments billed on this statement.
export function statementAmount(card, stmt) {
  const prev = stmtDateIn(card, addMonths(stmt.slice(0, 7), -1));
  let s = 0;
  for (const x of state.data.transactions) if (x.card_id === card.id && x.type === 'expense' && x.date > prev && x.date <= stmt) s += x.amount;
  for (const p of portionsInMonth(stmt.slice(0, 7))) if (p.plan.card_id === card.id) s += p.amount;
  return r2(s);
}
// A purchase after the statement day lands on next month's statement.
export function firstMonthFor(cardId, purchaseDate) {
  const k = purchaseDate.slice(0, 7), card = state.data.cards.find(c => c.id === cardId);
  if (!card) return k;
  return purchaseDate <= stmtDateIn(card, k) ? k : addMonths(k, 1);
}

/* ---------- Accounts ---------- */
// Opening balance plus everything booked to the account
export function accountBalance(acc) {
  let b = Number(acc.opening_balance) || 0;
  for (const x of state.data.transactions) {
    if (x.account_id === acc.id) {
      if (x.type === 'income') b += x.amount;
      else if (x.type === 'expense' || x.type === 'card_payment' || x.type === 'transfer') b -= x.amount;
    }
    if (x.type === 'transfer' && x.to_account_id === acc.id) b += x.to_amount ?? x.amount;
  }
  return r2(b);
}

// How much a transfer adds to (or takes from) savings in the budget:
// into a savings account counts as saved, back out counts as un-saved.
export function savedFlow(x) {
  if (x.type !== 'transfer') return 0;
  const fromSaving = isSavingAcc(accountById(x.account_id)), toSaving = isSavingAcc(accountById(x.to_account_id));
  if (!fromSaving && toSaving) return x.amount;
  if (fromSaving && !toSaving) return -(x.to_amount ?? x.amount);
  return 0;
}

// An account's worth in the app's currency (null if its exchange rate is missing)
export function accountValue(acc) {
  const bal = accountBalance(acc);
  return isBaseCurrency(acc) ? bal : toBase(bal, acc.currency, acc.unit);
}

// What is owed on a card today: the open cycle, the last statement if it's still unpaid
// and not yet past due, and installments billed after the open cycle.
export function cardDebt(card, now = today()) {
  const next = nextStatement(card, now), prev = prevStatement(card, now);
  let debt = statementAmount(card, next);
  if (!cardPaidTx(card, prev) && dueFor(card, prev) >= now) debt += statementAmount(card, prev);
  const nextMonth = next.slice(0, 7);
  for (const p of state.data.installments) if (p.card_id === card.id) debt += planRemaining(p, nextMonth);
  return r2(debt);
}

// Everything owned minus everything owed, in the app's currency
export function netWorth() {
  const parts = { accounts: 0, cards: 0 };
  let missing = false;
  for (const a of state.data.accounts) {
    const v = accountValue(a);
    if (v == null) missing = true; else parts.accounts += v;
  }
  for (const c of state.data.cards) parts.cards += cardDebt(c);
  const assets = r2(parts.accounts), liabilities = r2(parts.cards);
  return { assets, liabilities, net: r2(assets - liabilities), missing, parts };
}

// The payment made for a card statement, if it was marked as paid
export const cardPaidTx = (card, stmt) => state.data.transactions.find(x => x.type === 'card_payment' && x.card_id === card.id && x.stmt === stmt);

/* ---------- Goals ---------- */
export function goalSaved(g) {
  let s = Number(g.initial_saved) || 0;
  for (const x of state.data.transactions) if (x.type === 'saving' && x.goal_id === g.id) s += x.amount;
  return r2(s);
}

/* ---------- Month totals ---------- */
export function monthStats(key) {
  const now = curPeriod();
  const rel = key < now ? 'past' : key > now ? 'future' : 'current';
  const byCat = {};
  let actualIncome = 0, txSpent = 0, saved = 0, txCount = 0;
  for (const x of txInPeriod(key)) {
    txCount++;
    if (x.type === 'income') actualIncome += x.amount;
    else if (x.type === 'saving') saved += x.amount;
    else if (x.type === 'transfer') saved += savedFlow(x);
    else if (x.type === 'expense') { txSpent += x.amount; byCat[x.category_id] = (byCat[x.category_id] || 0) + x.amount; }
    // card_payment: paying the statement isn't new spending — the purchases were counted when made
  }
  const portions = portionsInMonth(key);
  let inst = 0;
  for (const p of portions) { inst += p.amount; byCat[p.plan.category_id] = (byCat[p.plan.category_id] || 0) + p.amount; }
  const bills = billsForMonth(key);
  const unpaid = bills.filter(b => !billPaidTx(b, key)).reduce((s, b) => s + b.amount, 0);
  const expected = Number(state.settings.expected_income) || 0;
  const income = Math.max(actualIncome, expected);
  const spent = r2(txSpent + inst);
  const pending = rel === 'past' ? 0 : r2(unpaid);
  const remaining = r2(income - spent - saved - pending);
  return {
    rel, income: r2(income), actualIncome: r2(actualIncome), usesExpected: income > actualIncome,
    spent, inst: r2(inst), saved: r2(saved), pending, remaining, byCat, bills, portions,
    hasData: txCount + portions.length + bills.length > 0
  };
}

// Spending per category up to the n-th day of a period (for "same point last month" comparisons)
export function spentByCatUpTo(key, upto) {
  const out = {};
  for (const x of txInPeriod(key)) if (x.type === 'expense' && dayInPeriod(x.date, key) <= upto) out[x.category_id] = (out[x.category_id] || 0) + x.amount;
  for (const p of portionsInMonth(key)) out[p.plan.category_id] = (out[p.plan.category_id] || 0) + p.amount;
  return out;
}

export const isEmptyApp = () =>
  !state.data.transactions.length && !state.data.bills.length && !state.data.installments.length &&
  !state.data.goals.length && !state.data.cards.length;

// Unpaid bills (incl. overdue) and card payments due in the next two weeks
export function upcomingItems() {
  const now = today(), horizon = shiftDays(now, 14), items = [];
  const k0 = curPeriod();
  for (const key of [k0, addMonths(k0, 1)]) {
    for (const b of billsForMonth(key)) {
      if (billPaidTx(b, key)) continue;
      const due = billDue(b, key);
      if ((due < now && key === k0) || (due >= now && due <= horizon)) items.push({ kind: 'bill', b, key, due });
    }
  }
  for (const c of state.data.cards) {
    for (const s of [prevStatement(c, now), nextStatement(c, now)]) {
      const due = dueFor(c, s), amount = statementAmount(c, s);
      if (due >= now && due <= horizon && amount > 0 && !cardPaidTx(c, s)) items.push({ kind: 'card', c, stmt: s, due, amount });
    }
  }
  return items.sort((a, b) => a.due.localeCompare(b.due));
}
