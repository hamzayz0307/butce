// Sheets with forms: add entry (quick / detailed), bills, installments, cards, goals, limits, settings.
import {
  state, catById, catName, catsOf, goalById, cardById, defaultCard, accountById, accountsList, spendAccounts,
  defaultAccount, accEmoji, isSavingAcc
} from './state.js';
import { t, LANG } from './i18n.js';
import { $, esc, today, addMonths, toNumber } from './utils.js';
import { fmt, monthName, numIn, dateShort } from './format.js';
import { firstMonthFor, dueFor, accountBalance } from './model.js';
import { startDay, MAX_START_DAY } from './period.js';
import { FX, GOLD_UNITS, rates, rateTRY, isBaseCurrency, ratesUpdatedText } from './money.js';
import { GOAL_EMOJIS, CAT_EMOJIS, CAT_COLORS, FALLBACK_KEYS } from './constants.js';
import { ico, opt, field, amountInput } from './views/components.js';
import { openSheet } from './sheet.js';

// Hidden categories are left out, unless the entry already uses one
const catOptions = (type, sel) => catsOf(type).filter(c => !c.hidden || c.id === sel).map(c => opt(c.id, `${c.emoji} ${catName(c)}`, c.id === sel)).join('');
const cardOptions = (sel, emptyLabel) => opt('', emptyLabel, !sel) + state.data.cards.map(c => opt(c.id, c.name, c.id === sel)).join('');
const delBtn = (kind, id) => `<button type="button" class="btn danger" data-act="del" data-kind="${kind}" data-id="${id}">${t('delete')}</button>`;
const formActions = (kind, id) =>
  `<p class="err" data-role="err" role="alert"></p><div class="form-actions">${id ? delBtn(kind, id) : ''}<button class="btn primary" type="submit">${t('save')}</button></div>`;

export const formErr = (f, msg) => { const e = f.querySelector('[data-role=err]'); if (e) e.textContent = msg; };
export { catOptions };

/* ---------- Add entry ---------- */
export function openAdd(mode = 'quick', draft = {}) {
  const seg = `<div class="seg" role="group" style="margin-top:8px">
    <button data-act="addmode" data-v="quick" aria-pressed="${mode === 'quick'}">${t('quick')}</button>
    <button data-act="addmode" data-v="detailed" aria-pressed="${mode === 'detailed'}">${t('detailed')}</button></div>`;
  const body = mode === 'quick'
    ? `${field(t('quick_label'), `<textarea id="quick" autofocus placeholder="${esc(t('quick_ph'))}" autocomplete="off" spellcheck="false"></textarea>`)}
       <p class="hint">${t('quick_help')}</p><div id="qp" class="qp"></div>
       <div class="form-actions"><button class="btn primary" data-act="quicksave" disabled id="qsave">${t('quick_none')}</button></div>`
    : txForm(null, draft);
  state.quickItems = [];
  state.quickOverrides = {};
  openSheet(t('new_entry'), seg + body);
}

export function renderQuickPreview() {
  const items = state.quickItems, ok = items.filter(x => !x.error);
  const card = defaultCard();
  $('#qp').innerHTML = items.length ? `<div class="list">${items.map((x, i) => {
    if (x.error) return `<div class="row"><div class="row-main"><div class="row-meta"><span class="neg">${esc(t('no_amount', { raw: x.raw }))}</span></div></div></div>`;
    const c = catById(x.category_id);
    const via = x.card_id ? cardById(x.card_id) : x.account_id ? accountById(x.account_id) : null;
    const instCard = x.card_id ? via : card;
    const meta = [
      x.date !== today() ? t('yesterday') : '',
      x.count > 1 ? `${t('quick_inst_meta', { n: x.count, amt: fmt(x.amount / x.count) })}${instCard ? ', ' + t('quick_card', { card: instCard.name }) : ''}` : (via ? via.name : '')
    ].filter(Boolean).join(', ');
    return `<div class="row">${ico(c)}<div class="row-main"><div class="row-title">${esc(x.note || catName(c))}</div>${meta ? `<div class="row-meta">${esc(meta)}</div>` : ''}
        <select data-qi="${i}" aria-label="${t('category')}">${catOptions(x.type, x.category_id)}</select></div>
      <div class="row-amt ${x.type === 'income' ? 'amt-in' : ''}">${x.type === 'income' ? '+' : '−'}${fmt(x.amount)}</div></div>`;
  }).join('')}</div>` : '';
  const btn = $('#qsave');
  btn.disabled = !ok.length;
  btn.textContent = !ok.length ? t('quick_none') : (ok.length === 1 && LANG === 'en' ? t('quick_save_one') : t('quick_save', { n: ok.length }));
}

/* ---------- Transaction ---------- */
// Where money came from or went to. Values: 'a:<account id>', 'c:<card id>' or '' (not said).
export function payOptions(type, sel) {
  const accs = spendAccounts(), cards = type === 'expense' ? state.data.cards : [];
  const none = opt('', accs.length ? t('no_account') : t('cash'), !sel);
  const a = accs.map(x => opt('a:' + x.id, `${accEmoji(x)} ${x.name}`, sel === 'a:' + x.id)).join('');
  const c = cards.map(x => opt('c:' + x.id, `💳 ${x.name}`, sel === 'c:' + x.id)).join('');
  return accs.length ? a + c + none : none + c;
}
const paySel = x => (x?.card_id ? 'c:' + x.card_id : x?.account_id ? 'a:' + x.account_id : '');
const defaultPay = () => (defaultAccount() ? 'a:' + defaultAccount().id : '');
const accOptions = sel => accountsList().map(a => opt(a.id, `${accEmoji(a)} ${a.name}`, a.id === sel)).join('');
const dateInput = v => `<input type="date" name="date" value="${v || today()}" required>`;

// Expense / Income / Transfer switch. Changing it redraws the form, keeping what was typed.
function typeSeg(type, withTransfer) {
  const radio = (v, label) => `<label><input class="sr" type="radio" name="type" value="${v}" ${type === v ? 'checked' : ''}><span>${label}</span></label>`;
  return `<div class="seg" role="radiogroup" style="margin-top:14px">${radio('expense', t('type_exp'))}${radio('income', t('type_inc'))}${withTransfer ? radio('transfer', t('type_transfer')) : ''}</div>`;
}

// `x` is an existing entry to edit; `draft` carries typed values when switching type
export function txForm(x, draft = {}) {
  const type = x?.type || draft.type || 'expense';
  if (type === 'saving') return savingForm(x);
  if (type === 'transfer') return transferForm(x, draft);
  if (type === 'card_payment') return cardPayForm(x);
  const isNew = !x;
  const sel = isNew ? (draft.pay ?? defaultPay()) : paySel(x);
  const showPay = spendAccounts().length > 0 || (type === 'expense' && state.data.cards.length > 0);
  const payField = field(type === 'income' ? t('account') : t('payment'), `<select name="pay">${payOptions(type, sel)}</select>`);
  const withCount = showPay && isNew && type === 'expense' && state.data.cards.length > 0;
  const pay = !showPay ? '' : withCount
    ? `<div class="grid2" data-role="pay">${payField}
        ${field(t('installments'), `<select name="count" disabled>${[1, 2, 3, 4, 5, 6, 9, 12, 18, 24].map(n => opt(n, n === 1 ? t('single') : String(n), n === 1)).join('')}</select>`)}
      </div><p class="hint" data-role="instprev"></p>`
    : payField;
  return `<form data-form="tx" data-id="${x?.id || ''}" class="form" novalidate>
    ${isNew ? typeSeg(type, true) : (x.type === 'expense' || x.type === 'income' ? typeSeg(type, false) : '')}
    ${field(t('amount'), amountInput('amount', x?.amount ?? draft.amount))}
    ${field(t('category'), `<select name="category_id">${catOptions(type, x?.category_id ?? draft.category_id)}</select>`)}
    ${field(t('note'), `<input name="note" value="${esc(x?.note ?? draft.note ?? '')}" placeholder="${esc(t('note_ph'))}" autocomplete="off">`)}
    ${field(t('date'), dateInput(x?.date || draft.date))}
    ${pay}${formActions('tx', x?.id)}</form>`;
}

// What's typed so far, to carry over when the type changes
export function formDraft(f, type) {
  return {
    type, amount: f.amount?.value ?? '', note: f.note?.value ?? '', date: f.date?.value,
    pay: f.pay?.value, from: f.from?.value, to: f.to?.value
  };
}

function savingForm(x) {
  const g = goalById(x.goal_id);
  return `<form data-form="saving" data-id="${x.id}" class="form" novalidate>
    <p class="hint" style="margin-top:4px">${esc(t('money_to', { name: g?.name || t('goal_cat') }))}</p>
    ${field(t('amount'), amountInput('amount', Math.abs(x.amount)))}
    ${field(t('date'), dateInput(x.date))}
    ${formActions('tx', x.id)}</form>`;
}

function transferForm(x, draft) {
  const accs = accountsList(), isNew = !x;
  if (accs.length < 2) {
    return `<form data-form="transfer" class="form" novalidate>${isNew ? typeSeg('transfer', true) : ''}
      <div class="empty" style="margin-top:14px;background:var(--paper)"><p>${t('transfer_need_two')}</p>
      <button type="button" class="btn primary" data-act="newacc">${t('add_account')}</button></div></form>`;
  }
  const from = x?.account_id || draft.from || defaultAccount()?.id || accs[0].id;
  const to = x?.to_account_id || (draft.to && draft.to !== from ? draft.to : '') || accs.find(a => a.id !== from && isSavingAcc(a))?.id || accs.find(a => a.id !== from).id;
  return `<form data-form="transfer" data-id="${x?.id || ''}" class="form" novalidate>
    ${isNew ? typeSeg('transfer', true) : ''}
    ${field(`<span data-role="amtlabel">${t('amount')}</span>`, amountInput('amount', x?.amount ?? draft.amount))}
    <div class="grid2">${field(t('from_acc'), `<select name="from">${accOptions(from)}</select>`)}
      ${field(t('to_acc'), `<select name="to">${accOptions(to)}</select>`)}</div>
    <div data-role="torow" hidden>${field(`<span data-role="tolabel"></span>`, `<input class="amount" name="to_amount" inputmode="decimal" autocomplete="off" value="${esc(x && x.to_amount != null ? numIn(x.to_amount) : '')}" ${x?.to_amount != null ? 'data-typed="1"' : ''} placeholder="0">`, `<p class="hint" data-role="ratehint"></p>`)}</div>
    <p class="hint" data-role="saveprev"></p>
    ${field(t('note'), `<input name="note" value="${esc(x?.note ?? draft.note ?? '')}" placeholder="${esc(t('transfer_note_ph'))}" autocomplete="off">`)}
    ${field(t('date'), dateInput(x?.date || draft.date))}
    ${formActions('tx', x?.id)}</form>`;
}

// `ctx` for a new payment: { card_id, stmt, amount }
export function cardPayForm(x, ctx = {}) {
  const card = cardById(x?.card_id || ctx.card_id), stmt = x?.stmt || ctx.stmt;
  const sel = x ? (x.account_id ? 'a:' + x.account_id : '') : defaultPay();
  return `<form data-form="cardpay" data-id="${x?.id || ''}" data-card="${card?.id || ''}" data-stmt="${stmt}" class="form" novalidate>
    <p class="hint" style="margin-top:4px">${esc(t('stmt_line', { name: card?.name || '', stmt: dateShort(stmt), due: card ? dateShort(dueFor(card, stmt)) : '' }))}</p>
    ${field(t('amount'), amountInput('amount', x?.amount ?? ctx.amount))}
    ${spendAccounts().length ? field(t('account'), `<select name="pay">${payOptions('income', sel)}</select>`) : ''}
    ${field(t('date'), dateInput(x?.date))}
    <p class="hint">${t('card_pay_hint')}</p>
    ${formActions('tx', x?.id)}</form>`;
}

// Live updates while the user fills the detailed form
export function updateTxFormBits(f) {
  if (f.dataset.form === 'transfer') {
    const out = f.querySelector('[data-role=saveprev]');
    if (!out || !f.from) return;
    const from = accountById(f.from.value), to = accountById(f.to.value);
    const fromS = isSavingAcc(from), toS = isSavingAcc(to);
    out.textContent = f.from.value === f.to.value ? t('err_same_acc') : !fromS && toS ? t('transfer_in_hint') : fromS && !toS ? t('transfer_out_hint') : '';
    updateTransferAmounts(f, from, to);
    return;
  }
  const countSel = f.count;
  if (!countSel) return;
  const sel = f.pay?.value || '';
  countSel.disabled = !sel.startsWith('c:');
  if (countSel.disabled) countSel.value = '1';
  const n = Number(countSel.value), amt = toNumber(f.amount.value), prev = f.querySelector('[data-role=instprev]');
  prev.textContent = n > 1 && amt > 0
    ? t('inst_preview', { amt: fmt(amt / n), month: monthName(firstMonthFor(sel.slice(2), f.date.value || today())) }) : '';
}

// When the two accounts hold different currencies (or gold), ask for both amounts
// and suggest the received amount from the saved rates until the user types their own.
function updateTransferAmounts(f, from, to) {
  const curOf = a => a?.currency || state.settings.currency || 'TRY';
  const SYM = { TRY: '₺', USD: '$', EUR: '€', GBP: '£' };
  const unitName = a => (a?.currency === 'XAU' ? t('unit_' + (a.unit || 'g24')) : SYM[curOf(a)] || curOf(a));
  const differ = !!from && !!to && (curOf(from) !== curOf(to) || (curOf(to) === 'XAU' && from.unit !== to.unit));
  f.querySelector('[data-role=torow]').hidden = !differ;
  f.querySelector('[data-role=amtlabel]').textContent = differ ? t('amount_sent', { unit: unitName(from) }) : t('amount');
  if (!differ) return;
  f.querySelector('[data-role=tolabel]').textContent = t('amount_received', { unit: unitName(to) });
  const grams = a => (a.currency === 'XAU' ? (GOLD_UNITS[a.unit] || 1) : 1);
  const rf = rateTRY(curOf(from)), rt = rateTRY(curOf(to));
  const hint = f.querySelector('[data-role=ratehint]');
  if (!rf || !rt) { hint.textContent = t('rate_missing'); return; }
  hint.textContent = '';
  if (f.to_amount.dataset.typed) return;
  const amt = toNumber(f.amount.value);
  f.to_amount.value = amt > 0 ? numIn(Math.round(amt * rf * grams(from) / (rt * grams(to)) * 100) / 100) : '';
}

/* ---------- Accounts ---------- */
export function accountForm(a) {
  const kind = a?.kind || (spendAccounts().length ? 'bank' : 'cash');
  const radio = k => `<label><input class="sr" type="radio" name="kind" value="${k}" ${kind === k ? 'checked' : ''}><span>${t('kind_' + k)}</span></label>`;
  const isDef = a ? defaultAccount()?.id === a.id : !spendAccounts().length;
  // Kind can't change once foreign currency or gold has amounts in it (and vice versa)
  const locked = a && state.data.transactions.some(x => x.account_id === a.id || x.to_account_id === a.id);
  const kinds = !locked ? ['cash', 'bank', 'savings', 'fx', 'gold'] : a.kind === 'fx' || a.kind === 'gold' ? [a.kind] : ['cash', 'bank', 'savings'];
  const cur = a?.currency && a.currency !== 'XAU' && !isBaseCurrency(a) ? a.currency : 'USD';
  return `<form data-form="account" data-id="${a?.id || ''}" class="form" novalidate>
    ${field(t('acc_name'), `<input name="name" value="${esc(a?.name || '')}" placeholder="${esc(t('acc_name_ph'))}" ${a ? '' : 'autofocus'} autocomplete="off" maxlength="40">`)}
    <fieldset class="field pick-set"><legend>${t('acc_kind')}</legend><div class="seg seg-wrap" role="radiogroup">${kinds.map(radio).join('')}</div></fieldset>
    <div data-role="fxrow" ${kind === 'fx' ? '' : 'hidden'}>${field(t('acc_currency'), `<select name="currency" ${locked ? 'disabled' : ''}>${FX.map(c => opt(c, c, c === cur)).join('')}</select>`)}</div>
    <div data-role="goldrow" ${kind === 'gold' ? '' : 'hidden'}>${field(t('gold_unit'), `<select name="unit" ${locked ? 'disabled' : ''}>${Object.keys(GOLD_UNITS).map(u => opt(u, t('unit_' + u), (a?.unit || 'g24') === u)).join('')}</select>`, `<p class="hint">${t('gold_hint')}</p>`)}</div>
    ${field(`<span data-role="ballabel">${t(kind === 'fx' || kind === 'gold' ? 'acc_amount' : 'acc_balance')}</span>`, amountInput('balance', a ? accountBalance(a) : '', false), `<p class="hint">${t('acc_balance_hint')}</p>`)}
    <div data-role="defrow" ${kind === 'cash' || kind === 'bank' ? '' : 'hidden'}>
      <label class="check"><input type="checkbox" name="is_default" ${isDef ? 'checked' : ''}><span>${t('acc_default')}</span></label>
      <p class="hint">${t('acc_default_hint')}</p></div>
    <p class="hint" data-role="savhint" ${kind === 'cash' || kind === 'bank' ? 'hidden' : ''}>${t('acc_savings_hint')}</p>
    ${a ? `<button type="button" class="btn ghost small" data-act="acctx" data-id="${a.id}" style="margin-top:16px">${t('acc_see_tx')}</button>
      <p class="hint">${t('acc_del_hint')}</p>` : ''}
    ${formActions('account', a?.id)}</form>`;
}

export function updateAccFormBits(f) {
  const kind = f.kind.value, spend = kind === 'cash' || kind === 'bank';
  f.querySelector('[data-role=defrow]').hidden = !spend;
  f.querySelector('[data-role=savhint]').hidden = spend;
  f.querySelector('[data-role=fxrow]').hidden = kind !== 'fx';
  f.querySelector('[data-role=goldrow]').hidden = kind !== 'gold';
  f.querySelector('[data-role=ballabel]').textContent = t(kind === 'fx' || kind === 'gold' ? 'acc_amount' : 'acc_balance');
}

/* ---------- Bills ---------- */
export function billForm(b) {
  const def = state.data.categories.find(c => c.key === 'bills')?.id;
  return `<form data-form="bill" data-id="${b?.id || ''}" class="form" novalidate>
    ${field(t('name'), `<input name="name" value="${esc(b?.name || '')}" placeholder="${esc(t('bill_name_ph'))}" autofocus autocomplete="off">`)}
    <div class="grid2">${field(t('amount'), `<input name="amount" inputmode="decimal" value="${esc(numIn(b?.amount))}" placeholder="0" autocomplete="off">`)}
      ${field(t('bill_day'), `<input name="day" type="number" min="1" max="31" inputmode="numeric" value="${b?.day || ''}" placeholder="1">`)}</div>
    <p class="hint">${t('bill_amount_hint')}</p>
    ${field(t('category'), `<select name="category_id">${catOptions('expense', b?.category_id || def)}</select>`)}
    ${formActions('bill', b?.id)}</form>`;
}

/* ---------- Installments ---------- */
export function instForm(p) {
  const pd = p?.purchase_date || today();
  const shopping = state.data.categories.find(c => c.key === 'shopping')?.id;
  return `<form data-form="inst" data-id="${p?.id || ''}" class="form" novalidate>
    ${field(t('name'), `<input name="name" value="${esc(p?.name || '')}" placeholder="${esc(t('inst_name_ph'))}" autofocus autocomplete="off">`)}
    <div class="grid2">${field(t('inst_total'), `<input name="total" inputmode="decimal" value="${esc(numIn(p?.total))}" placeholder="0" autocomplete="off">`)}
      ${field(t('inst_count'), `<input name="count" type="number" min="2" max="36" inputmode="numeric" value="${p?.count || 6}">`)}</div>
    <div class="grid2">${field(t('card'), `<select name="card_id">${cardOptions(p?.card_id, t('no_card'))}</select>`)}
      ${field(t('category'), `<select name="category_id">${catOptions('expense', p?.category_id || shopping)}</select>`)}</div>
    <div class="grid2">${field(t('purchase_date'), `<input type="date" name="purchase_date" value="${pd}">`)}
      ${field(t('first_month'), `<input type="month" name="first_month" value="${p?.first_month || firstMonthFor(null, pd)}" data-touched="${p ? '1' : ''}">`)}</div>
    <p class="hint" data-role="instprev"></p>
    <p class="hint">${t('inst_auto_hint')}</p>
    ${formActions('inst', p?.id)}</form>`;
}

export function updateInstFormBits(f, changed) {
  if (changed === 'first_month') f.first_month.dataset.touched = '1';
  else if (!f.first_month.dataset.touched) f.first_month.value = firstMonthFor(f.card_id.value, f.purchase_date.value || today());
  const total = toNumber(f.total.value), n = Number(f.count.value);
  f.querySelector('[data-role=instprev]').textContent = total > 0 && n >= 2 && f.first_month.value
    ? `${t('inst_monthly', { amt: fmt(total / n) })}, ${t('inst_ends', { month: monthName(addMonths(f.first_month.value, n - 1)) })}` : '';
}

/* ---------- Cards ---------- */
export function cardForm(c) {
  return `<form data-form="card" data-id="${c?.id || ''}" class="form" novalidate>
    ${field(t('card_name'), `<input name="name" value="${esc(c?.name || '')}" placeholder="${esc(t('card_name_ph'))}" autofocus autocomplete="off">`)}
    <div class="grid2">${field(t('statement_day'), `<input name="statement_day" type="number" min="1" max="31" inputmode="numeric" value="${c?.statement_day || ''}" placeholder="5">`)}
      ${field(t('due_day'), `<input name="due_day" type="number" min="1" max="31" inputmode="numeric" value="${c?.due_day || ''}" placeholder="15">`)}</div>
    ${field(t('card_limit'), `<input name="limit" inputmode="decimal" value="${esc(numIn(c?.limit))}" placeholder="0" autocomplete="off">`)}
    ${formActions('card', c?.id)}</form>`;
}

/* ---------- Goals ---------- */
export function goalForm(g) {
  return `<form data-form="goal" data-id="${g?.id || ''}" class="form" novalidate>
    ${field(t('goal_name'), `<input name="name" value="${esc(g?.name || '')}" placeholder="${esc(t('goal_name_ph'))}" autofocus autocomplete="off">`)}
    ${emojiPicker(GOAL_EMOJIS, g?.emoji || '🎯')}
    <div class="grid2">${field(t('target'), `<input name="target" inputmode="decimal" value="${esc(numIn(g?.target))}" placeholder="0" autocomplete="off">`)}
      ${field(t('saved_start'), `<input name="initial_saved" inputmode="decimal" value="${esc(numIn(g?.initial_saved))}" placeholder="0" autocomplete="off">`)}</div>
    ${field(t('deadline'), `<input type="month" name="deadline" value="${g?.deadline || ''}">`)}
    ${formActions('goal', g?.id)}</form>`;
}

export function goalMoneyForm(g) {
  return `<form data-form="goalmoney" data-id="${g.id}" class="form" novalidate>
    <div class="seg" role="radiogroup" style="margin-top:8px">
      <label><input class="sr" type="radio" name="dir" value="in" checked><span>${t('deposit')}</span></label>
      <label><input class="sr" type="radio" name="dir" value="out"><span>${t('withdraw')}</span></label></div>
    ${field(t('amount'), amountInput('amount', ''))}
    ${field(t('date'), `<input type="date" name="date" value="${today()}">`)}
    ${formActions('none', null)}</form>`;
}

/* ---------- Pickers ---------- */
function emojiPicker(list, sel) {
  const all = list.includes(sel) ? list : [sel, ...list];
  return `<fieldset class="field pick-set"><legend>${t('emoji')}</legend><div class="pick">${all.map(e =>
    `<label><input class="sr" type="radio" name="emoji" value="${e}" ${e === sel ? 'checked' : ''}><span class="em">${e}</span></label>`).join('')}</div></fieldset>`;
}
function colorPicker(sel) {
  const all = CAT_COLORS.includes(sel) ? CAT_COLORS : [sel, ...CAT_COLORS];
  return `<fieldset class="field pick-set"><legend>${t('cat_color')}</legend><div class="pick">${all.map((c, i) =>
    `<label><input class="sr" type="radio" name="color" value="${c}" ${c === sel ? 'checked' : ''} aria-label="${t('cat_color')} ${i + 1}"><span class="sw" style="--c:${c}"></span></label>`).join('')}</div></fieldset>`;
}

/* ---------- Categories ---------- */
export function openCats(type = state.catTab || 'expense') {
  state.catTab = type;
  const b = (v, label) => `<button data-act="cats" data-v="${v}" aria-pressed="${type === v}">${label}</button>`;
  const rows = catsOf(type).map(c => {
    const meta = [c.hidden ? t('cat_hidden') : '', Number(c.monthly_limit) > 0 ? t('lim_of', { amt: fmt(c.monthly_limit) }) : '',
      c.keywords?.length ? t('cat_words_n', { n: c.keywords.length }) : ''].filter(Boolean).join(', ');
    return `<button class="row${c.hidden ? ' is-hidden' : ''}" data-act="editcat" data-id="${c.id}">${ico(c)}
      <span class="row-main"><span class="row-title">${esc(catName(c))}</span>${meta ? `<span class="row-meta">${esc(meta)}</span>` : ''}</span></button>`;
  }).join('');
  openSheet(t('cats_title'), `<div class="seg" role="group" style="margin-top:8px">${b('expense', t('f_exp'))}${b('income', t('f_inc'))}</div>
    <div class="list list-in-sheet" style="margin-top:12px">${rows}</div>
    <button class="btn ghost wide" data-act="newcat" style="margin-top:12px">${t('add_cat')}</button>`, 'settings');
}

export function catForm(c, type) {
  type = c?.type || type;
  const fixed = c && c.key === FALLBACK_KEYS[type];
  const hint = c?.key ? t(fixed ? 'cat_fallback_hint' : 'cat_builtin_hint') : (c ? t('cat_del_hint') : '');
  return `<form data-form="cat" data-id="${c?.id || ''}" data-type="${type}" class="form" novalidate>
    ${field(t('name'), `<input name="name" value="${esc(c ? catName(c) : '')}" autocomplete="off" ${c ? '' : 'autofocus'} maxlength="40">`)}
    ${emojiPicker(CAT_EMOJIS, c?.emoji || (type === 'income' ? '💰' : '🧾'))}
    ${colorPicker(c?.color || CAT_COLORS[0])}
    ${type === 'expense' ? field(t('cat_limit'), `<input name="limit" inputmode="decimal" value="${esc(numIn(c?.monthly_limit))}" placeholder="${t('limit_none_ph')}" autocomplete="off">`) : ''}
    ${field(t('cat_words'), `<input name="keywords" value="${esc((c?.keywords || []).join(', '))}" placeholder="${esc(t(c?.key ? 'cat_words_ph_own' : 'cat_words_ph'))}" autocomplete="off">`, `<p class="hint">${t('cat_words_hint')}</p>`)}
    <label class="check"><input type="checkbox" name="show" ${c?.hidden ? '' : 'checked'} ${fixed ? 'disabled' : ''}><span>${t('cat_show')}</span></label>
    <p class="hint">${t('cat_hide_hint')}</p>
    ${hint ? `<p class="hint">${hint}</p>` : ''}
    <p class="err" data-role="err" role="alert"></p>
    <div class="form-actions">${c && !c.key ? delBtn('cat', c.id) : ''}<button class="btn primary" type="submit">${t('save')}</button></div></form>`;
}

/* ---------- Category limits ---------- */
export function limitsForm() {
  const rows = catsOf('expense').filter(c => !c.hidden).map(c => `<label class="row">${ico(c)}
      <span class="row-main"><span class="row-title">${esc(catName(c))}</span></span>
      <input name="lim_${c.id}" inputmode="decimal" value="${esc(numIn(c.monthly_limit))}" placeholder="${t('limit_none_ph')}" autocomplete="off"
        style="width:130px;height:42px;border-radius:11px;border:1px solid var(--line);background:var(--surface);padding:0 10px;font-size:16px;text-align:right"></label>`).join('');
  return `<form data-form="limits" class="form" novalidate><p class="hint" style="margin-top:4px">${t('limits_help')}</p>
    <div class="list" style="margin-top:12px;background:var(--paper)">${rows}</div>
    ${formActions('none', null)}</form>`;
}

/* ---------- Settings ---------- */
export function openSettings() {
  const s = state.settings;
  const lb = (v, label) => `<button data-act="setlang" data-v="${v}" aria-pressed="${LANG === v}">${label}</button>`;
  openSheet(t('settings'), `
    <div class="set-group"><h4>${t('s_lang')}</h4><div class="seg">${lb('tr', 'Türkçe')}${lb('en', 'English')}</div></div>
    ${field(t('s_currency'), `<select data-setting="currency">${['TRY', 'USD', 'EUR'].map(c => opt(c, c, (s.currency || 'TRY') === c)).join('')}</select>`)}
    ${field(t('s_period'), `<select data-setting="period_start_day">${Array.from({ length: MAX_START_DAY }, (_, i) => opt(i + 1, i === 0 ? t('s_period_cal') : String(i + 1), startDay() === i + 1)).join('')}</select>`, `<p class="hint">${t('s_period_hint')}</p>`)}
    ${field(t('s_income'), `<input data-setting="expected_income" inputmode="decimal" value="${esc(numIn(s.expected_income))}" placeholder="0" autocomplete="off">`, `<p class="hint">${t('s_income_hint')}</p>`)}
    <div class="set-group"><h4>${t('s_rates')}</h4>
      <div class="grid2">${['USD', 'EUR', 'GBP', 'XAU'].map(c => field(t('rate_label_' + c), `<input data-setting="rate_${c}" inputmode="decimal" value="${esc(numIn(rates()[c]))}" placeholder="—" autocomplete="off">`)).join('')}</div>
      <p class="hint">${t('s_rates_hint')} <span data-role="rates-when">${ratesUpdatedText()}</span></p>
      <button class="btn ghost small" data-act="fetchrate" style="margin-top:8px">${t('s_fetch')}</button></div>
    <div class="set-group"><h4>${t('s_cats')}</h4><div style="display:grid;gap:8px">
      <button class="btn ghost" data-act="cats">${t('manage_cats')}</button>
      <button class="btn ghost" data-act="limits">${t('edit_limits')}</button></div></div>
    <div class="set-group"><h4>${t('s_data')}</h4><p class="hint" style="margin:0 0 10px">${t('s_storage')}</p>
      <div style="display:grid;gap:8px">
        <button class="btn ghost" data-act="export">${t('s_export')}</button>
        <button class="btn ghost" data-act="import">${t('s_import')}</button>
        <button class="btn ghost" data-act="sample">${t('load_sample')}</button>
        <button class="btn danger" data-act="wipe">${t('s_wipe')}</button></div></div>`);
}
