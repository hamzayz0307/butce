// Activity tab: the period's entries grouped by day. Typing in search looks through all months.
import { state, catById, catName, cardById, goalById, accountById, accEmoji } from '../state.js';
import { t } from '../i18n.js';
import { esc, norm, today, shiftDays, toNumber, r2 } from '../utils.js';
import { fmt, dateLong, dateShort } from '../format.js';
import { txInPeriod, portionsInMonth } from '../model.js';
import { periodOf, periodTitle } from '../period.js';
import { ico } from './components.js';

const SEARCH_LIMIT = 300;

export function viewTx() {
  const f = state.txFilter, c = f.cat ? catById(f.cat) : null, acc = f.acc ? accountById(f.acc) : null;
  const chip = (v, label) => `<button class="chip" data-act="txtype" data-v="${v}" aria-pressed="${f.type === v}">${label}</button>`;
  return `<input class="search" type="search" id="txq" placeholder="${t('search_ph')}" value="${esc(f.q)}" aria-label="${t('search_ph')}" autocomplete="off">
    <div class="chips">${chip('all', t('f_all'))}${chip('expense', t('f_exp'))}${chip('income', t('f_inc'))}
    ${c ? `<button class="chip" aria-pressed="true" data-act="clearcat" aria-label="${t('clear_filter')}">${c.emoji} ${esc(catName(c))} ✕</button>` : ''}
    ${acc ? `<button class="chip" aria-pressed="true" data-act="clearacc" aria-label="${t('clear_filter')}">${accEmoji(acc)} ${esc(acc.name)} ✕</button>` : ''}</div>
    <div id="tx-list">${txListHtml()}</div>`;
}

// One entry. `withDate` adds the date to the second line (used in search results).
function txRow(x, withDate = false) {
  const date = withDate ? dateShort(x.date) : '';
  const line = (...parts) => esc([date, ...parts].filter(Boolean).join(', '));
  if (x.type === 'saving') {
    const g = goalById(x.goal_id);
    return `<button class="row" data-act="edittx" data-id="${x.id}">${ico({ emoji: g?.emoji || '🎯', color: '#2F7D68' })}
      <div class="row-main"><div class="row-title">${esc(g?.name || t('goal_cat'))}</div><div class="row-meta">${line(x.amount >= 0 ? t('saving_in') : t('saving_out'))}</div></div>
      <div class="row-amt amt-save">${fmt(Math.abs(x.amount))}</div></button>`;
  }
  if (x.type === 'transfer') {
    const from = accountById(x.account_id), to = accountById(x.to_account_id);
    const route = `${from?.name || '?'} → ${to?.name || '?'}`;
    return `<button class="row" data-act="edittx" data-id="${x.id}">${ico({ emoji: '🔄', color: '#7C8A85' })}
      <div class="row-main"><div class="row-title">${esc(x.note || route)}</div><div class="row-meta">${line(x.note ? route : t('type_transfer'))}</div></div>
      <div class="row-amt amt-save">${fmt(x.amount)}</div></button>`;
  }
  if (x.type === 'card_payment') {
    const card = cardById(x.card_id), acc = accountById(x.account_id);
    return `<button class="row" data-act="edittx" data-id="${x.id}">${ico({ emoji: '💳', color: '#4C7DBF' })}
      <div class="row-main"><div class="row-title">${esc(t('card_payment', { name: card?.name || '' }))}</div><div class="row-meta">${line(acc?.name || '')}</div></div>
      <div class="row-amt amt-save">${fmt(x.amount)}</div></button>`;
  }
  const c = catById(x.category_id), card = x.card_id ? cardById(x.card_id) : null, acc = x.account_id ? accountById(x.account_id) : null;
  return `<button class="row" data-act="edittx" data-id="${x.id}">${ico(c)}
    <div class="row-main"><div class="row-title">${esc(x.note || catName(c))}</div><div class="row-meta">${line(catName(c), x.bill_id ? t('bill_tag') : '', card?.name || acc?.name)}</div></div>
    <div class="row-amt ${x.type === 'income' ? 'amt-in' : ''}">${x.type === 'income' ? '+' : '−'}${fmt(x.amount)}</div></button>`;
}

const sumOf = (list, type) => r2(list.filter(x => x.type === type).reduce((s, x) => s + x.amount, 0));
const byNewest = (a, b) => b.date.localeCompare(a.date) || (b.created_at || '').localeCompare(a.created_at || '');

function emptyState(filtered) {
  return `<div class="empty" style="margin-top:12px"><p>${filtered ? t('no_match') : t('no_tx')}</p>${filtered ? `<button class="btn ghost small" data-act="clearall">${t('clear_filter')}</button>` : ''}</div>`;
}

export function txListHtml() {
  const f = state.txFilter, q = norm(f.q.trim());
  return q ? searchHtml(q) : periodHtml();
}

/* ---------- The selected period, by day ---------- */
function periodHtml() {
  const key = state.month, f = state.txFilter;
  let txs = txInPeriod(key);
  let portions = portionsInMonth(key);
  if (f.type !== 'all') { txs = txs.filter(x => x.type === f.type); if (f.type === 'income') portions = []; }
  if (f.cat) { txs = txs.filter(x => x.category_id === f.cat); portions = portions.filter(p => p.plan.category_id === f.cat); }
  if (f.acc) { txs = txs.filter(x => x.account_id === f.acc || x.to_account_id === f.acc); portions = []; }
  if (!txs.length && !portions.length) return emptyState(f.cat || f.acc || f.type !== 'all');

  let html = '';
  if (portions.length) {
    const sum = portions.reduce((s, p) => s + p.amount, 0);
    html += `<div class="day-head"><span>${t('month_inst')}</span><span>−${fmt(sum)}</span></div><div class="list">` +
      portions.map(p => {
        const c = catById(p.plan.category_id), card = cardById(p.plan.card_id);
        return `<button class="row" data-act="editinst" data-id="${p.plan.id}">${ico(c)}
          <div class="row-main"><div class="row-title">${esc(p.plan.name)}</div><div class="row-meta">${t('inst_n', { i: p.index, n: p.plan.count })}${card ? ', ' + esc(card.name) : ''}</div></div>
          <div class="row-amt">−${fmt(p.amount)}</div></button>`;
      }).join('') + '</div>';
  }
  const groups = {};
  for (const x of txs) (groups[x.date] ||= []).push(x);
  const now = today(), yest = shiftDays(now, -1);
  for (const d of Object.keys(groups).sort().reverse()) {
    const items = groups[d].sort(byNewest);
    const out = sumOf(items, 'expense');
    const label = d === now ? t('today') : d === yest ? t('yesterday') : dateLong(d);
    html += `<div class="day-head"><span>${label}</span><span>${out ? '−' + fmt(out) : ''}</span></div><div class="list">${items.map(x => txRow(x)).join('')}</div>`;
  }
  return html;
}

/* ---------- Search across all months ---------- */
// Matches the description, category, goal or card name; a number also matches that exact amount.
export function searchTx(q, { type = 'all', cat = null, acc = null } = {}) {
  const amount = /^[\d.,\s]+(k|bin)?$/i.test(q) ? toNumber(q) : NaN;
  const has = (...s) => s.some(v => v && norm(v).includes(q));
  const txs = state.data.transactions.filter(x =>
    (type === 'all' || x.type === type) && (!cat || x.category_id === cat) &&
    (!acc || x.account_id === acc || x.to_account_id === acc) &&
    (has(x.note, catName(catById(x.category_id)), goalById(x.goal_id)?.name, cardById(x.card_id)?.name,
      accountById(x.account_id)?.name, accountById(x.to_account_id)?.name) ||
      (amount > 0 && Math.abs(x.amount) === amount)));
  const plans = type === 'income' || acc ? [] : state.data.installments.filter(p =>
    (!cat || p.category_id === cat) &&
    (has(p.name, catName(catById(p.category_id)), cardById(p.card_id)?.name) || (amount > 0 && p.total === amount)));
  return { txs: txs.sort(byNewest), plans };
}

function searchHtml(q) {
  const f = state.txFilter;
  const { txs, plans } = searchTx(q, f);
  if (!txs.length && !plans.length) return emptyState(true);

  const out = sumOf(txs, 'expense') + r2(plans.reduce((s, p) => s + p.total, 0)), inc = sumOf(txs, 'income');
  const count = txs.length + plans.length;
  let html = `<div class="search-sum" role="status">
      <span>${t('search_found', { n: count })}</span>
      <span>${out ? `<b>−${fmt(out)}</b>` : ''}${out && inc ? ' ' : ''}${inc ? `<b class="amt-in">+${fmt(inc)}</b>` : ''}</span></div>`;

  if (plans.length) {
    html += `<div class="day-head"><span>${t('search_plans')}</span></div><div class="list">` + plans.map(p => {
      const c = catById(p.category_id), card = cardById(p.card_id);
      return `<button class="row" data-act="editinst" data-id="${p.id}">${ico(c)}
        <div class="row-main"><div class="row-title">${esc(p.name)}</div><div class="row-meta">${esc([dateShort(p.purchase_date || p.first_month + '-01'), t('inst_count_n', { n: p.count }), card?.name].filter(Boolean).join(', '))}</div></div>
        <div class="row-amt">−${fmt(p.total)}</div></button>`;
    }).join('') + '</div>';
  }

  const shown = txs.slice(0, SEARCH_LIMIT), groups = new Map();
  for (const x of shown) {
    const k = periodOf(x.date);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(x);
  }
  for (const [k, items] of groups) {
    const o = sumOf(items, 'expense');
    html += `<div class="day-head"><span>${periodTitle(k)}</span><span>${o ? '−' + fmt(o) : ''}</span></div><div class="list">${items.map(x => txRow(x, true)).join('')}</div>`;
  }
  if (txs.length > SEARCH_LIMIT) html += `<p class="hint" style="text-align:center">${t('search_more', { n: SEARCH_LIMIT })}</p>`;
  return html;
}
