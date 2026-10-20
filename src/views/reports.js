// Reports: a year at a glance — income vs spending by month, categories,
// where the money went, net worth over time — plus CSV export.
import { state, catById, catName } from '../state.js';
import { t, LOC } from '../i18n.js';
import { esc, r2, norm, pad } from '../utils.js';
import { fmt, pct, monthName, monthShort } from '../format.js';
import { monthStats } from '../model.js';
import { curPeriod, inPeriod } from '../period.js';
import { sec, ico, svg, IC } from './components.js';

const keysOf = year => Array.from({ length: 12 }, (_, i) => `${year}-${pad(i + 1)}`);

// Totals for each budget period of the year, up to the current one
export function yearData(year) {
  const now = curPeriod();
  const months = keysOf(year).filter(k => k <= now).map(k => {
    const st = monthStats(k);
    return { k, income: st.actualIncome, spent: st.spent, saved: st.saved, byCat: st.byCat };
  });
  const sum = f => r2(months.reduce((s, m) => s + m[f], 0));
  const byCat = {};
  for (const m of months) for (const [id, v] of Object.entries(m.byCat)) byCat[id] = r2((byCat[id] || 0) + v);
  return { months, income: sum('income'), spent: sum('spent'), saved: sum('saved'), byCat };
}

// Where the money went: expenses grouped by description
export function topPlaces(year, limit = 8) {
  const keys = keysOf(year), groups = new Map();
  for (const x of state.data.transactions) {
    if (x.type !== 'expense' || !x.note || !keys.some(k => inPeriod(x.date, k))) continue;
    const k = norm(x.note).trim();
    const g = groups.get(k) || { name: x.note, total: 0, n: 0, cat: x.category_id, last: '' };
    g.total = r2(g.total + x.amount); g.n++;
    if (x.date > g.last) { g.last = x.date; g.name = x.note; g.cat = x.category_id; }
    groups.set(k, g);
  }
  return [...groups.values()].sort((a, b) => b.total - a.total).slice(0, limit);
}

// Round a maximum up to 1, 2 or 5 × a power of ten so gridlines land on clean numbers
const niceMax = v => { if (v <= 0) return 1; const p = 10 ** Math.floor(Math.log10(v)); return [1, 2, 5, 10].map(m => m * p).find(m => m >= v); };
const compact = n => new Intl.NumberFormat(LOC(), { notation: 'compact', maximumFractionDigits: 1 }).format(n);

export function viewReports() {
  const year = state.repYear || Number(curPeriod().slice(0, 4));
  const d = yearData(year);
  const yearNav = `<div class="year-nav">
    <button class="icon-btn" data-act="repyear" data-d="-1" aria-label="${t('prev_year')}">${svg(IC.left)}</button>
    <b>${year}</b>
    <button class="icon-btn" data-act="repyear" data-d="1" aria-label="${t('next_year')}" ${year >= Number(curPeriod().slice(0, 4)) ? 'disabled' : ''}>${svg(IC.right)}</button></div>`;
  if (!d.months.some(m => m.income || m.spent || m.saved)) {
    return yearNav + `<div class="empty"><p>${t('rep_empty', { year })}</p></div>` + exportSec(year);
  }
  const rate = d.income > 0 ? d.saved / d.income * 100 : 0;
  return yearNav + `<div class="figs">
      <div class="fig"><span>${t('rep_income')}</span><b>${fmt(d.income, { dec: 0 })}</b></div>
      <div class="fig"><span>${t('rep_spent')}</span><b>${fmt(d.spent, { dec: 0 })}</b></div>
      <div class="fig"><span>${t('rep_saved')}</span><b>${fmt(d.saved, { dec: 0 })}</b></div>
      <div class="fig"><span>${t('rep_rate')}</span><b>${d.income > 0 ? pct(rate) : '—'}</b></div></div>`
    + monthsChart(d) + catsSec(d) + placesSec(year) + worthSec(year) + exportSec(year);
}

/* Spending as columns, income as a tick on each month. Tap a month for its numbers. */
function monthsChart(d) {
  const max = niceMax(Math.max(...d.months.map(m => Math.max(m.spent, m.income))));
  const sel = d.months.find(m => m.k === state.repSel) || d.months[d.months.length - 1];
  const all = keysOf(d.months[0].k.slice(0, 4)).map(k => d.months.find(m => m.k === k) || { k, income: 0, spent: 0, empty: true });
  const h = v => (v / max * 100).toFixed(1);
  const cols = all.map(m => m.empty ? '<span class="rcol"></span>' : `<button class="rcol" data-act="repsel" data-k="${m.k}" aria-pressed="${m.k === sel.k}"
      aria-label="${esc(`${monthName(m.k)}: ${t('rep_spent')} ${fmt(m.spent)}, ${t('rep_income')} ${fmt(m.income)}`)}">
      <i style="height:${h(m.spent)}%"></i>${m.income > 0 ? `<s style="bottom:${h(m.income)}%"></s>` : ''}</button>`).join('');
  const grid = [1, 0.5, 0].map(f => `<div class="rgrid" style="bottom:${f * 100}%"><span>${compact(max * f)}</span></div>`).join('');
  const diff = r2(sel.income - sel.spent);
  const table = `<details class="rtable"><summary>${t('rep_table')}</summary><table>
      <thead><tr><th>${t('rep_month')}</th><th>${t('rep_income')}</th><th>${t('rep_spent')}</th><th>${t('rep_saved')}</th></tr></thead>
      <tbody>${d.months.map(m => `<tr><td>${monthShort(m.k)}</td><td>${fmt(m.income, { dec: 0 })}</td><td>${fmt(m.spent, { dec: 0 })}</td><td>${fmt(m.saved, { dec: 0 })}</td></tr>`).join('')}</tbody></table></details>`;
  return sec(t('rep_chart'), `<div class="chart">
      <div class="rlegend" aria-hidden="true"><span><i class="sw-col"></i>${t('rep_spent')}</span><span><i class="sw-tick2"></i>${t('rep_income')}</span></div>
      <div class="rplot">${grid}<div class="rcols">${cols}</div></div>
      <div class="rcols rx" aria-hidden="true">${all.map(m => `<span>${monthShort(m.k).slice(0, 3)}</span>`).join('')}</div>
      <div class="chart-cap"><span>${monthName(sel.k)}</span><b>${fmt(sel.spent, { dec: 0 })}</b></div>
      <p class="hint" style="margin-top:2px">${t('rep_sel', { income: fmt(sel.income, { dec: 0 }) })}${sel.income > 0 ? `, ${diff >= 0 ? t('rep_under', { amt: fmt(diff, { dec: 0 }) }) : t('rep_over', { amt: fmt(-diff, { dec: 0 }) })}` : ''}.</p>
      ${table}</div>`);
}

function catsSec(d) {
  const rows = Object.entries(d.byCat).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  if (!rows.length) return '';
  const max = rows[0][1], months = d.months.length || 1;
  return sec(t('rep_cats'), `<div class="list">${rows.map(([id, v]) => {
    const c = catById(id);
    return `<div class="row">${ico(c)}<div class="row-main"><div class="row-title">${esc(catName(c))}</div>
        <div class="row-meta">${t('rep_cat_meta', { p: pct(v / d.spent * 100), avg: fmt(v / months, { dec: 0 }) })}</div>
        <div class="bar"><i class="prog" style="width:${(v / max * 100).toFixed(1)}%"></i></div></div>
      <div class="row-amt">${fmt(v, { dec: 0 })}</div></div>`;
  }).join('')}</div>`);
}

function placesSec(year) {
  const top = topPlaces(year);
  if (!top.length) return '';
  return sec(t('rep_places'), `<div class="list">${top.map(g => `<div class="row">${ico(catById(g.cat))}
      <div class="row-main"><div class="row-title">${esc(g.name)}</div><div class="row-meta">${t('rep_place_meta', { n: g.n })}</div></div>
      <div class="row-amt">${fmt(g.total, { dec: 0 })}</div></div>`).join('')}</div>`);
}

/* Net worth: one point per month, recorded as the app is used */
function worthSec(year) {
  if (!state.data.accounts.length) return '';
  const hist = state.settings.nw_history || {};
  const pts = keysOf(year).filter(k => hist[k]).map(k => ({ k, v: hist[k].net }));
  if (pts.length < 2) return sec(t('rep_nw'), `<p class="empty-line">${t('rep_nw_wait')}</p>`);
  const W = 320, H = 120, pad = 10, lo = Math.min(...pts.map(p => p.v)), hi = Math.max(...pts.map(p => p.v));
  const span = hi - lo || Math.abs(hi) || 1;
  const x = i => pad + i * (W - 2 * pad) / (pts.length - 1), y = v => H - pad - (v - lo) / span * (H - 2 * pad);
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.v).toFixed(1)}`).join(' ');
  const last = pts[pts.length - 1], first = pts[0], ch = r2(last.v - first.v);
  return sec(t('rep_nw'), `<div class="chart">
      <svg class="rline" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(pts.map(p => `${monthName(p.k)}: ${fmt(p.v, { dec: 0 })}`).join(', '))}">
        <path d="${path}" fill="none" stroke="var(--data)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
        ${pts.map((p, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="${i === pts.length - 1 ? 4.5 : 3}" fill="var(--data)" stroke="var(--surface)" stroke-width="2"/>`).join('')}
      </svg>
      <div class="rx rline-x" aria-hidden="true"><span>${monthShort(first.k)}</span><span>${monthShort(last.k)}</span></div>
      <div class="chart-cap"><span>${monthName(last.k)}</span><b>${fmt(last.v, { dec: 0 })}</b></div>
      <p class="hint" style="margin-top:2px">${t(ch >= 0 ? 'rep_nw_up' : 'rep_nw_down', { amt: fmt(Math.abs(ch), { dec: 0 }), month: monthName(first.k) })}</p></div>`);
}

function exportSec(year) {
  return sec(t('rep_export'), `<p class="sec-sub">${t('rep_export_hint')}</p>
    <div style="display:grid;gap:8px">
      <button class="btn ghost" data-act="csv" data-year="${year}">${t('rep_csv_year', { year })}</button>
      <button class="btn ghost" data-act="csv">${t('rep_csv_all')}</button></div>`);
}
