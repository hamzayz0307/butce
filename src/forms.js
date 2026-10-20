// Sheets with forms: add entry (quick / detailed), bills, installments, cards, goals, limits, settings.
import { state, catById, catName, catsOf, goalById, defaultCard } from './state.js';
import { t, LANG } from './i18n.js';
import { $, esc, today, addMonths, toNumber } from './utils.js';
import { fmt, monthName, numIn } from './format.js';
import { firstMonthFor } from './model.js';
import { startDay, MAX_START_DAY } from './period.js';
import { GOAL_EMOJIS } from './constants.js';
import { ico, opt, field, amountInput } from './views/components.js';
import { openSheet } from './sheet.js';

const catOptions = (type, sel) => catsOf(type).map(c => opt(c.id, `${c.emoji} ${catName(c)}`, c.id === sel)).join('');
const cardOptions = (sel, emptyLabel) => opt('', emptyLabel, !sel) + state.data.cards.map(c => opt(c.id, c.name, c.id === sel)).join('');
const delBtn = (kind, id) => `<button type="button" class="btn danger" data-act="del" data-kind="${kind}" data-id="${id}">${t('delete')}</button>`;
const formActions = (kind, id) =>
  `<p class="err" data-role="err" role="alert"></p><div class="form-actions">${id ? delBtn(kind, id) : ''}<button class="btn primary" type="submit">${t('save')}</button></div>`;

export const formErr = (f, msg) => { const e = f.querySelector('[data-role=err]'); if (e) e.textContent = msg; };
export { catOptions };

/* ---------- Add entry ---------- */
export function openAdd(mode = 'quick') {
  const seg = `<div class="seg" role="group" style="margin-top:8px">
    <button data-act="addmode" data-v="quick" aria-pressed="${mode === 'quick'}">${t('quick')}</button>
    <button data-act="addmode" data-v="detailed" aria-pressed="${mode === 'detailed'}">${t('detailed')}</button></div>`;
  const body = mode === 'quick'
    ? `${field(t('quick_label'), `<textarea id="quick" autofocus placeholder="${esc(t('quick_ph'))}" autocomplete="off" spellcheck="false"></textarea>`)}
       <p class="hint">${t('quick_help')}</p><div id="qp" class="qp"></div>
       <div class="form-actions"><button class="btn primary" data-act="quicksave" disabled id="qsave">${t('quick_none')}</button></div>`
    : txForm(null);
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
    const meta = x.count > 1
      ? `${t('quick_inst_meta', { n: x.count, amt: fmt(x.amount / x.count) })}${card ? ', ' + t('quick_card', { card: card.name }) : ''}`
      : (x.date !== today() ? t('yesterday') : '');
    return `<div class="row">${ico(c)}<div class="row-main"><div class="row-title">${esc(x.note || catName(c))}</div>${meta ? `<div class="row-meta">${esc(meta)}</div>` : ''}
        <select data-qi="${i}" aria-label="${t('category')}">${catOptions(x.type, x.category_id)}</select></div>
      <div class="row-amt ${x.type === 'income' ? 'amt-in' : ''}">${x.type === 'income' ? '+' : '−'}${fmt(x.amount)}</div></div>`;
  }).join('')}</div>` : '';
  const btn = $('#qsave');
  btn.disabled = !ok.length;
  btn.textContent = !ok.length ? t('quick_none') : (ok.length === 1 && LANG === 'en' ? t('quick_save_one') : t('quick_save', { n: ok.length }));
}

/* ---------- Transaction ---------- */
export function txForm(x) {
  const type = x?.type || 'expense';
  if (x && x.type === 'saving') {
    const g = goalById(x.goal_id);
    return `<form data-form="saving" data-id="${x.id}" class="form" novalidate>
      <p class="hint" style="margin-top:4px">${esc(t('money_to', { name: g?.name || t('goal_cat') }))}</p>
      ${field(t('amount'), amountInput('amount', Math.abs(x.amount)))}
      ${field(t('date'), `<input type="date" name="date" value="${x.date}" required>`)}
      ${formActions('tx', x.id)}</form>`;
  }
  const radio = (v, label) => `<label><input class="sr" type="radio" name="type" value="${v}" ${type === v ? 'checked' : ''}><span>${label}</span></label>`;
  const isNew = !x;
  const payment = isNew && state.data.cards.length ? `<div class="grid2" data-role="pay">
      ${field(t('payment'), `<select name="card_id">${cardOptions(null, t('cash'))}</select>`)}
      ${field(t('installments'), `<select name="count" disabled>${[1, 2, 3, 4, 5, 6, 9, 12, 18, 24].map(n => opt(n, n === 1 ? t('single') : String(n), n === 1)).join('')}</select>`)}
    </div><p class="hint" data-role="instprev"></p>` : '';
  return `<form data-form="tx" data-id="${x?.id || ''}" class="form" novalidate>
    <div class="seg" role="radiogroup" style="margin-top:14px">${radio('expense', t('type_exp'))}${radio('income', t('type_inc'))}</div>
    ${field(t('amount'), amountInput('amount', x?.amount))}
    ${field(t('category'), `<select name="category_id">${catOptions(type, x?.category_id)}</select>`)}
    ${field(t('note'), `<input name="note" value="${esc(x?.note || '')}" placeholder="${esc(t('note_ph'))}" autocomplete="off">`)}
    ${field(t('date'), `<input type="date" name="date" value="${x?.date || today()}" required>`)}
    ${payment}${formActions('tx', x?.id)}</form>`;
}

// Live updates while the user fills the detailed form
export function updateTxFormBits(f) {
  const type = f.type.value || 'expense';
  const pay = f.querySelector('[data-role=pay]');
  if (!pay) return;
  pay.style.display = type === 'expense' ? '' : 'none';
  const cardSel = f.card_id, countSel = f.count;
  countSel.disabled = !cardSel.value;
  if (!cardSel.value) countSel.value = '1';
  const n = Number(countSel.value), amt = toNumber(f.amount.value), prev = f.querySelector('[data-role=instprev]');
  prev.textContent = (type === 'expense' && n > 1 && amt > 0)
    ? t('inst_preview', { amt: fmt(amt / n), month: monthName(firstMonthFor(cardSel.value, f.date.value || today())) }) : '';
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
  const emojis = GOAL_EMOJIS.map(e => `<label class="chip" style="padding:0"><input class="sr" type="radio" name="emoji" value="${e}" ${(g?.emoji || '🎯') === e ? 'checked' : ''}><span style="display:block;padding:6px 10px;font-size:18px">${e}</span></label>`).join('');
  return `<form data-form="goal" data-id="${g?.id || ''}" class="form" novalidate>
    ${field(t('goal_name'), `<input name="name" value="${esc(g?.name || '')}" placeholder="${esc(t('goal_name_ph'))}" autofocus autocomplete="off">`)}
    <fieldset class="field" style="border:0;padding:0;margin-inline:0">
      <span style="display:block;font-size:13px;font-weight:700;color:var(--muted);margin-bottom:6px">${t('emoji')}</span>
      <div class="chips" style="flex-wrap:wrap">${emojis}</div></fieldset>
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

/* ---------- Category limits ---------- */
export function limitsForm() {
  const rows = catsOf('expense').map(c => `<label class="row">${ico(c)}
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
    ${field(t('s_rate'), `<input data-setting="usd_rate" inputmode="decimal" value="${esc(numIn(s.usd_rate))}" placeholder="—" autocomplete="off">`, `<p class="hint">${t('s_rate_hint')}</p>`)}
    <button class="btn ghost small" data-act="fetchrate" style="margin-top:8px">${t('s_fetch')}</button>
    <div class="set-group"><h4>${t('s_limits')}</h4><button class="btn ghost wide" data-act="limits">${t('edit_limits')}</button></div>
    <div class="set-group"><h4>${t('s_data')}</h4><p class="hint" style="margin:0 0 10px">${t('s_storage')}</p>
      <div style="display:grid;gap:8px">
        <button class="btn ghost" data-act="export">${t('s_export')}</button>
        <button class="btn ghost" data-act="import">${t('s_import')}</button>
        <button class="btn ghost" data-act="sample">${t('load_sample')}</button>
        <button class="btn danger" data-act="wipe">${t('s_wipe')}</button></div></div>`);
}
