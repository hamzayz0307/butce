// Overview tab: safe-to-spend hero, totals, upcoming payments, categories, insights.
import { state, catsOf, catName } from '../state.js';
import { t } from '../i18n.js';
import { esc, r2, curMonth, addMonths, daysInMonth } from '../utils.js';
import { fmt, pct, monthName } from '../format.js';
import { monthStats, spentByCatUpTo, upcomingItems, isEmptyApp } from '../model.js';
import { GUILLOCHE, sec, ico, dueLabel } from './components.js';
import { billRow, loadChart } from './payments.js';

export function viewHome() {
  if (isEmptyApp()) return emptyHome();
  const key = state.month, st = monthStats(key);
  return hero(st, key) + figures(st)
    + (st.rel === 'current' ? upcomingSec() : '')
    + categoriesSec(st) + insightsSec(key, st) + loadSec(key);
}

function emptyHome() {
  return `<section class="note">${GUILLOCHE}
    <div class="note-label">${monthName(curMonth())}</div>
    <p class="note-amount" style="font-size:30px;line-height:1.15;max-width:15ch">${t('empty_title')}</p>
    <p class="note-sub">${t('empty_body')}</p>
    <div class="note-actions">
      <button class="btn on-note" data-act="add" data-mode="detailed">${t('add_expense')}</button>
      <button class="btn on-note-ghost" data-act="sample">${t('load_sample')}</button>
    </div></section>`;
}

function hero(st, key) {
  if (st.income <= 0 && st.rel !== 'past') {
    return `<section class="note">${GUILLOCHE}
      <div class="note-label">${t('hero_noinc_label')}</div>
      <p class="note-amount"><span>${fmt(st.spent)}</span></p>
      <p class="note-sub">${t('hero_noinc_sub')}</p>
      <div class="note-actions"><button class="btn on-note" data-act="settings">${t('set_income')}</button></div></section>`;
  }
  let label, amount, unit = '', sub, runway = '';
  const dim = daysInMonth(key);
  const spentPct = st.income > 0 ? (st.spent + st.saved) / st.income * 100 : 0;
  if (st.rel === 'current') {
    const d = new Date().getDate(), left = dim - d + 1;
    label = t('safe_today');
    unit = t('per_day');
    if (st.remaining > 0) {
      amount = fmt(st.remaining / left, { dec: 0 });
      sub = left === 1 ? t('hero_last_day', { amt: fmt(st.remaining) }) : t('hero_sub', { n: left, amt: fmt(st.remaining) });
    } else {
      amount = fmt(0, { dec: 0 });
      sub = t('hero_over', { amt: fmt(-st.remaining) });
    }
    runway = runwayHtml(spentPct, d / dim * 100, true);
  } else if (st.rel === 'past') {
    if (!st.hasData) { label = t('hero_empty_label'); amount = '—'; sub = ''; }
    else {
      label = t('hero_past_label'); amount = fmt(st.remaining);
      sub = st.remaining >= 0 ? t('hero_past_pos', { amt: fmt(st.remaining) }) : t('hero_past_neg', { amt: fmt(-st.remaining) });
      runway = runwayHtml(spentPct, 100, false);
    }
  } else {
    label = t('hero_future_label'); amount = fmt(st.inst + st.pending);
    sub = t('hero_future_sub', { amt: fmt(st.remaining) });
  }
  return `<section class="note" aria-label="${esc(label)}">${GUILLOCHE}
    <div class="note-label">${label}</div>
    <p class="note-amount"><span>${amount}</span>${unit ? `<small>${unit}</small>` : ''}</p>
    ${sub ? `<p class="note-sub">${sub}</p>` : ''}${runway}</section>`;
}

// Bar = share of income spent; tick = share of the month that has passed.
function runwayHtml(spentPct, timePct, showTime) {
  const hot = spentPct > timePct + 5;
  return `<div class="runway" role="img" aria-label="${t('rw_aria', { a: pct(spentPct), b: pct(timePct) })}">
      <div class="runway-fill${hot ? ' hot' : ''}" style="width:${Math.min(spentPct, 100).toFixed(1)}%"></div>
      ${showTime ? `<div class="runway-mark" style="left:calc(${Math.min(timePct, 100).toFixed(1)}% - 1px)"></div>` : ''}
    </div>
    <div class="runway-legend" aria-hidden="true">
      <span><i class="sw-bar"></i>${t('rw_spent')} ${pct(spentPct)}</span>
      ${showTime ? `<span><i class="sw-tick"></i>${t('rw_time')} ${pct(timePct)}</span>` : ''}
    </div>`;
}

function figures(st) {
  const third = st.rel === 'past'
    ? `<div class="fig"><span>${t('fig_inst')}</span><b>${fmt(st.inst)}</b></div>`
    : `<div class="fig"><span>${t('fig_pending')}</span><b>${fmt(st.pending)}</b></div>`;
  return `<div class="figs">
    <div class="fig"><span>${t('fig_income')}${st.usesExpected ? `<em>${t('expected')}</em>` : ''}</span><b>${fmt(st.income)}</b></div>
    <div class="fig"><span>${t('fig_spent')}</span><b>${fmt(st.spent)}</b>${st.inst > 0 && st.rel !== 'past' ? `<small>${t('incl_inst', { amt: fmt(st.inst) })}</small>` : ''}</div>
    ${third}
    <div class="fig"><span>${t('fig_saved')}</span><b>${fmt(st.saved)}</b></div></div>`;
}

function upcomingSec() {
  const items = upcomingItems();
  const body = items.length ? `<div class="list">${items.map(it => it.kind === 'bill' ? billRow(it.b, it.key, true) : `
      <button class="row" data-act="goto-cards">${ico({ emoji: '💳', color: '#4C7DBF' })}
        <div class="row-main"><div class="row-title">${esc(t('card_due', { name: it.c.name }))}</div><div class="row-meta">${dueLabel(it.due)}</div></div>
        <div class="row-amt">${fmt(it.amount)}<small>${t('est_statement')}</small></div></button>`).join('')}</div>`
    : `<p class="empty-line">${t('no_upcoming')}</p>`;
  return sec(t('sec_upcoming'), body);
}

function categoriesSec(st) {
  const rows = catsOf('expense').map(c => ({ c, s: r2(st.byCat[c.id] || 0), lim: Number(c.monthly_limit) || 0 }))
    .filter(x => x.s > 0 || x.lim > 0).sort((a, b) => b.s - a.s || b.lim - a.lim);
  const action = `<button class="link" data-act="limits">${t('edit_limits')}</button>`;
  if (!rows.length) return sec(t('sec_categories'), `<p class="empty-line">${t('no_spend_month')}</p>`, action);
  const max = Math.max(...rows.map(r => r.s), 1);
  const html = rows.map(({ c, s, lim }) => {
    let cls = 'plain', w = s / max * 100, meta = t('no_limit');
    if (lim > 0) {
      const ratio = s / lim; w = Math.min(ratio, 1) * 100;
      if (ratio > 1) { cls = 'neg'; meta = `<span class="neg">${t('lim_over', { amt: fmt(s - lim) })}</span>`; }
      else if (ratio >= 0.8) { cls = 'warn'; meta = `<span class="warn">${t('lim_near', { p: pct(ratio * 100) })}</span>`; }
      else { cls = ''; meta = t('lim_left', { amt: fmt(lim - s) }); }
    }
    return `<button class="row" data-act="filtercat" data-id="${c.id}">${ico(c)}
      <div class="row-main"><div class="row-title">${esc(catName(c))}</div><div class="row-meta">${meta}</div>
        <div class="bar"><i class="${cls}" style="width:${w.toFixed(1)}%"></i></div></div>
      <div class="row-amt">${fmt(s)}${lim > 0 ? `<small>/ ${fmt(lim)}</small>` : ''}</div></button>`;
  }).join('');
  return sec(t('sec_categories'), `<div class="list">${html}</div>`, action);
}

// Rule-based for now; the monthly AI summary (Gemini) can replace this later.
function insightsSec(key, st) {
  if (st.rel === 'future') return '';
  const prevKey = addMonths(key, -1);
  const upto = st.rel === 'current' ? new Date().getDate() : 31;
  const cur = spentByCatUpTo(key, upto), prev = spentByCatUpTo(prevKey, upto);
  const out = [];
  for (const c of catsOf('expense')) {
    const lim = Number(c.monthly_limit) || 0, s = st.byCat[c.id] || 0;
    if (lim > 0 && s > lim) out.push({ mk: 'over', sym: '!', w: 3, text: t('ins_over', { cat: catName(c), amt: fmt(s - lim) }) });
    else if (lim > 0 && s >= 0.8 * lim) out.push({ mk: 'up', sym: '!', w: 2, text: t('ins_near', { cat: catName(c), p: pct(s / lim * 100) }) });
  }
  const floor = Math.max((Number(state.settings.expected_income) || st.income) * 0.01, 1);
  const changes = catsOf('expense').map(c => ({ c, a: cur[c.id] || 0, b: prev[c.id] || 0 }))
    .map(x => ({ ...x, d: x.a - x.b }))
    .filter(x => x.b > 0 && Math.abs(x.d) >= Math.max(floor, x.b * 0.2))
    .sort((x, y) => Math.abs(y.d) - Math.abs(x.d)).slice(0, 3);
  for (const x of changes) {
    out.push(x.d > 0
      ? { mk: 'up', sym: '↑', w: 1, text: t('ins_up', { cat: catName(x.c), p: pct(x.d / x.b * 100), amt: fmt(x.d) }) }
      : { mk: 'down', sym: '↓', w: 0, text: t('ins_down', { cat: catName(x.c), p: pct(-x.d / x.b * 100) }) });
  }
  if (!out.length && !Object.keys(prev).length) return '';
  const body = out.length
    ? `<ul class="insights">${out.sort((a, b) => b.w - a.w).slice(0, 4).map(o => `<li><span class="mk ${o.mk}" aria-hidden="true">${o.sym}</span><span>${esc(o.text)}</span></li>`).join('')}</ul>`
    : `<p class="empty-line">${t('ins_none')}</p>`;
  return sec(t('sec_insights'), body);
}

function loadSec(key) {
  if (!state.data.installments.length) return '';
  return sec(t('sec_load'), loadChart(addMonths(key, 1)), `<button class="link" data-act="goto-inst">${t('see_all')}</button>`);
}
