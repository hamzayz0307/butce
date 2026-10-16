// Activity tab: this month's entries grouped by day, with search and filters.
import { state, catById, catName, cardById, goalById } from '../state.js';
import { t } from '../i18n.js';
import { esc, norm, today, shiftDays } from '../utils.js';
import { fmt, dateLong } from '../format.js';
import { txInMonth, portionsInMonth } from '../model.js';
import { ico } from './components.js';

export function viewTx() {
  const f = state.txFilter, c = f.cat ? catById(f.cat) : null;
  const chip = (v, label) => `<button class="chip" data-act="txtype" data-v="${v}" aria-pressed="${f.type === v}">${label}</button>`;
  return `<input class="search" type="search" id="txq" placeholder="${t('search_ph')}" value="${esc(f.q)}" aria-label="${t('search_ph')}">
    <div class="chips">${chip('all', t('f_all'))}${chip('expense', t('f_exp'))}${chip('income', t('f_inc'))}
    ${c ? `<button class="chip" aria-pressed="true" data-act="clearcat" aria-label="${t('clear_filter')}">${c.emoji} ${esc(catName(c))} ✕</button>` : ''}</div>
    <div id="tx-list">${txListHtml()}</div>`;
}

function txRow(x) {
  if (x.type === 'saving') {
    const g = goalById(x.goal_id);
    return `<button class="row" data-act="edittx" data-id="${x.id}">${ico({ emoji: g?.emoji || '🎯', color: '#2F7D68' })}
      <div class="row-main"><div class="row-title">${esc(g?.name || t('goal_cat'))}</div><div class="row-meta">${x.amount >= 0 ? t('saving_in') : t('saving_out')}</div></div>
      <div class="row-amt amt-save">${fmt(Math.abs(x.amount))}</div></button>`;
  }
  const c = catById(x.category_id), card = x.card_id ? cardById(x.card_id) : null;
  const meta = [catName(c), x.bill_id ? t('bill_tag') : '', card ? card.name : ''].filter(Boolean).join(', ');
  return `<button class="row" data-act="edittx" data-id="${x.id}">${ico(c)}
    <div class="row-main"><div class="row-title">${esc(x.note || catName(c))}</div><div class="row-meta">${esc(meta)}</div></div>
    <div class="row-amt ${x.type === 'income' ? 'amt-in' : ''}">${x.type === 'income' ? '+' : '−'}${fmt(x.amount)}</div></button>`;
}

export function txListHtml() {
  const key = state.month, f = state.txFilter, q = norm(f.q.trim());
  let txs = txInMonth(key);
  let portions = portionsInMonth(key);
  if (f.type !== 'all') { txs = txs.filter(x => x.type === f.type); if (f.type === 'income') portions = []; }
  if (f.cat) { txs = txs.filter(x => x.category_id === f.cat); portions = portions.filter(p => p.plan.category_id === f.cat); }
  if (q) {
    const hit = (...s) => s.some(v => norm(v).includes(q));
    txs = txs.filter(x => hit(x.note, catName(catById(x.category_id)), goalById(x.goal_id)?.name));
    portions = portions.filter(p => hit(p.plan.name, catName(catById(p.plan.category_id))));
  }
  if (!txs.length && !portions.length) {
    const filtered = q || f.cat || f.type !== 'all';
    return `<div class="empty" style="margin-top:12px"><p>${filtered ? t('no_match') : t('no_tx')}</p>${filtered ? `<button class="btn ghost small" data-act="clearall">${t('clear_filter')}</button>` : ''}</div>`;
  }
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
    const items = groups[d].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
    const out = items.filter(x => x.type === 'expense').reduce((s, x) => s + x.amount, 0);
    const label = d === now ? t('today') : d === yest ? t('yesterday') : dateLong(d);
    html += `<div class="day-head"><span>${label}</span><span>${out ? '−' + fmt(out) : ''}</span></div><div class="list">${items.map(txRow).join('')}</div>`;
  }
  return html;
}
