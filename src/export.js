// CSV export that opens cleanly in Excel: Turkish Excel expects ";" between
// columns and a decimal comma, so the format follows the app language.
import { state, catById, catName, cardById, accountById, goalById } from './state.js';
import { t, LANG } from './i18n.js';
import { today, addMonths } from './utils.js';
import { portionFor } from './model.js';

const TYPE_KEY = {
  expense: 'type_exp', income: 'type_inc', saving: 'csv_saving', transfer: 'type_transfer',
  card_payment: 'card_pay_title', debt: 'csv_debt', installment: 'csv_inst'
};

// Every booked entry plus card installments, as plain rows. `year` limits to one calendar year.
export function exportRows(year = null) {
  const inRange = d => !year || d.slice(0, 4) === String(year);
  const rows = [];
  for (const x of state.data.transactions) {
    if (!inRange(x.date)) continue;
    let cat = catName(catById(x.category_id)), note = x.note || '', amount = x.amount, via = '';
    if (x.type === 'expense' || x.type === 'card_payment') amount = -x.amount;
    if (x.type === 'saving') { cat = goalById(x.goal_id)?.name || t('goal_cat'); amount = -x.amount; }
    if (x.type === 'transfer') { cat = ''; via = `${accountById(x.account_id)?.name || '?'} → ${accountById(x.to_account_id)?.name || '?'}`; }
    else via = cardById(x.card_id)?.name || accountById(x.account_id)?.name || '';
    if (x.type === 'card_payment') { cat = ''; note = cardById(x.card_id)?.name || note; via = accountById(x.account_id)?.name || ''; }
    if (x.type === 'debt') cat = '';
    rows.push({ date: x.date, type: x.type, cat, note, amount, via });
  }
  // Installments: one row per month already billed
  const lastMonth = today().slice(0, 7);
  for (const p of state.data.installments) {
    for (let i = 0; i < p.count; i++) {
      const k = addMonths(p.first_month, i);
      if (k > lastMonth || (year && k.slice(0, 4) !== String(year))) continue;
      const part = portionFor(p, k);
      rows.push({ date: `${k}-01`, type: 'installment', cat: catName(catById(p.category_id)), note: `${p.name} (${part.index}/${p.count})`, amount: -part.amount, via: cardById(p.card_id)?.name || '' });
    }
  }
  return rows.sort((a, b) => a.date.localeCompare(b.date));
}

// A text cell: quoted when needed, and never starting like a formula (=, +, -, @)
function cell(v, sep) {
  let s = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /["\n\r]/.test(s) || s.includes(sep) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function buildCsv(rows, lang = LANG) {
  const sep = lang === 'tr' ? ';' : ',';
  const num = n => { const s = (Math.round(n * 100) / 100).toFixed(2); return lang === 'tr' ? s.replace('.', ',') : s; };
  const head = ['csv_date', 'csv_type', 'csv_cat', 'csv_note', 'csv_amount', 'csv_via'].map(k => cell(t(k), sep)).join(sep);
  const lines = rows.map(r => [r.date, t(TYPE_KEY[r.type] || 'type_exp'), r.cat, r.note].map(v => cell(v, sep)).concat(num(r.amount), cell(r.via, sep)).join(sep));
  return '﻿' + [head, ...lines].join('\r\n') + '\r\n';   // BOM so Excel reads Turkish letters
}

export function downloadCsv(year = null) {
  const csv = buildCsv(exportRows(year));
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `butce-${year || 'tum-kayitlar'}-${today()}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
