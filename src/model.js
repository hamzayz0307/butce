// Budget math: installments, bills, card statements, goals and month totals.
// Pure functions over `state.data` — no DOM, so they are covered by tests.
import { state } from './state.js';
import { r2, pad, today, curMonth, shiftDays, addMonths, daysInMonth, monthDiff } from './utils.js';

/* ---------- Installments (taksit) ---------- */
// Which installment of `plan` falls in month `key`, and how much it is.
// Amounts are rounded to kuruş; the last installment absorbs the rounding.
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
export const txInMonth = key => state.data.transactions.filter(x => x.date.slice(0, 7) === key);
export const billsForMonth = key => state.data.bills.filter(b => (b.start_month || '0000-00') <= key);
export const billDue = (b, key) => `${key}-${pad(Math.min(b.day, daysInMonth(key)))}`;
export const billPaidTx = (b, key) => state.data.transactions.find(x => x.bill_id === b.id && x.bill_month === key);

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

/* ---------- Goals ---------- */
export function goalSaved(g) {
  let s = Number(g.initial_saved) || 0;
  for (const x of state.data.transactions) if (x.type === 'saving' && x.goal_id === g.id) s += x.amount;
  return r2(s);
}

/* ---------- Month totals ---------- */
export function monthStats(key) {
  const now = curMonth();
  const rel = key < now ? 'past' : key > now ? 'future' : 'current';
  const byCat = {};
  let actualIncome = 0, txSpent = 0, saved = 0, txCount = 0;
  for (const x of txInMonth(key)) {
    txCount++;
    if (x.type === 'income') actualIncome += x.amount;
    else if (x.type === 'saving') saved += x.amount;
    else { txSpent += x.amount; byCat[x.category_id] = (byCat[x.category_id] || 0) + x.amount; }
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

// Spending per category up to a day of the month (for "same point last month" comparisons)
export function spentByCatUpTo(key, upto) {
  const out = {};
  for (const x of txInMonth(key)) if (x.type === 'expense' && Number(x.date.slice(8)) <= upto) out[x.category_id] = (out[x.category_id] || 0) + x.amount;
  for (const p of portionsInMonth(key)) out[p.plan.category_id] = (out[p.plan.category_id] || 0) + p.amount;
  return out;
}

export const isEmptyApp = () =>
  !state.data.transactions.length && !state.data.bills.length && !state.data.installments.length &&
  !state.data.goals.length && !state.data.cards.length;

// Unpaid bills (incl. overdue) and card payments due in the next two weeks
export function upcomingItems() {
  const now = today(), horizon = shiftDays(now, 14), items = [];
  const k0 = curMonth();
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
      if (due >= now && due <= horizon && amount > 0) items.push({ kind: 'card', c, stmt: s, due, amount });
    }
  }
  return items.sort((a, b) => a.due.localeCompare(b.due));
}
