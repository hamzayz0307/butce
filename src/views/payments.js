// Payments tab: recurring bills, installment purchases, bank loans, credit cards.
import { state, catById, cardById } from '../state.js';
import { t } from '../i18n.js';
import { esc, r2, today, addMonths } from '../utils.js';
import { fmt, pct, monthName, monthShort, dateShort } from '../format.js';
import {
  portionFor, portionsInMonth, planEnd, planPaidThrough, planRemaining,
  billsForMonth, billDue, billPaidTx, nextStatement, prevStatement, dueFor, statementAmount, cardPaidTx,
  loanPaymentIn, loanPaymentsIn, loanPaidTx, loanLeft, loanEnd
} from '../model.js';
import { curPeriod, periodStart } from '../period.js';
import { ico, dueLabel } from './components.js';

export function viewPay() {
  const b = (v, label) => `<button data-act="paytab" data-v="${v}" aria-pressed="${state.payTab === v}">${label}</button>`;
  const body = { bills: payBills, inst: payInst, loans: payLoans, cards: payCards }[state.payTab]();
  return `<div class="seg seg-4" role="group">${b('bills', t('seg_bills'))}${b('inst', t('seg_inst'))}${b('loans', t('seg_loans'))}${b('cards', t('seg_cards'))}</div>${body}`;
}

// The last closed statement while it can still be paid (or was paid)
function stmtRow(c, now) {
  const stmt = prevStatement(c, now), due = dueFor(c, stmt), paid = cardPaidTx(c, stmt);
  const amount = paid ? paid.amount : statementAmount(c, stmt);
  if (due < now || amount <= 0) return '';
  return `<div class="row">${ico({ emoji: '🧾', color: '#4C7DBF' })}
    <div class="row-main"><div class="row-title">${esc(t('stmt_row', { name: c.name }))}</div>
      <div class="row-meta">${paid ? esc(t('paid_on', { date: dateShort(paid.date) })) : dueLabel(due)}</div></div>
    <div class="row-amt">${fmt(amount)}</div>${cardPayBtn(c, stmt, amount, paid)}</div>`;
}

export function cardPayBtn(c, stmt, amount, paid) {
  return paid
    ? `<button class="pill-paid" data-act="edittx" data-id="${paid.id}">${t('paid')}</button>`
    : `<button class="btn ghost small" data-act="paycard" data-id="${c.id}" data-stmt="${stmt}" data-amt="${amount}" aria-label="${esc(t('mark_paid_aria', { name: t('stmt_row', { name: c.name }) }))}">${t('paid_it')}</button>`;
}

export function billRow(b, key, withDue) {
  const paidTx = billPaidTx(b, key), c = catById(b.category_id);
  const meta = withDue ? dueLabel(billDue(b, key)) : (paidTx ? dateShort(paidTx.date) : t('bill_day_meta', { d: b.day }));
  const action = paidTx
    ? `<button class="pill-paid" data-act="unpay" data-id="${b.id}" data-month="${key}" aria-label="${esc(t('unmark_aria', { name: b.name }))}">${t('paid')}</button>`
    : `<button class="btn ghost small" data-act="paybill" data-id="${b.id}" data-month="${key}" aria-label="${esc(t('mark_paid_aria', { name: b.name }))}">${t('paid_it')}</button>`;
  return `<div class="row">${ico(c)}
    <button class="row-main" data-act="editbill" data-id="${b.id}">
      <div class="row-title">${esc(b.name)}</div><div class="row-meta">${meta}</div></button>
    <div class="row-amt">${fmt(paidTx ? paidTx.amount : b.amount)}</div>${action}</div>`;
}

// Installments plus loan payments per month, for 6 months starting at `startKey`
export function loadChart(startKey, months = 6) {
  const data = Array.from({ length: months }, (_, i) => {
    const k = addMonths(startKey, i);
    const inst = r2(portionsInMonth(k).reduce((s, p) => s + p.amount, 0));
    const loan = r2(loanPaymentsIn(k).reduce((s, { p }) => s + p.amount, 0));
    return { k, inst, loan, v: r2(inst + loan) };
  });
  const max = Math.max(...data.map(d => d.v));
  if (max <= 0) return `<p class="empty-line">${t('load_none')}</p>`;
  const sel = data.find(d => d.k === state.barSel) || data[0];
  const fixed = state.data.bills.reduce((s, b) => s + b.amount, 0);
  return `<div class="chart">
    <div class="cols">${data.map(d => `<button class="col" data-act="bar" data-k="${d.k}" aria-pressed="${d.k === sel.k}" aria-label="${monthName(d.k)}: ${fmt(d.v)}" title="${monthName(d.k)}: ${fmt(d.v)}">
      <i style="height:${(d.v / max * 100).toFixed(1)}%"></i></button>`).join('')}</div>
    <div class="col-x" aria-hidden="true">${data.map(d => `<span>${monthShort(d.k)}</span>`).join('')}</div>
    <div class="chart-cap"><span>${monthName(sel.k)}</span><b>${fmt(sel.v)}</b></div>
    ${sel.inst > 0 && sel.loan > 0 ? `<p class="hint" style="margin-top:2px">${t('load_split', { inst: fmt(sel.inst), loan: fmt(sel.loan) })}</p>` : ''}
    ${fixed > 0 ? `<p class="hint">${t('load_bills', { amt: fmt(fixed) })}</p>` : ''}</div>`;
}

export function loanRow(loan, key, withDue) {
  const p = loanPaymentIn(loan, key), paidTx = p && loanPaidTx(loan, p.due), left = loanLeft(loan);
  const c = catById(loan.category_id) || { emoji: '🏦', color: '#4C7DBF' };
  const meta = !p ? t('loan_none_this') : paidTx ? esc(t('paid_on', { date: dateShort(paidTx.date) })) : dueLabel(p.due);
  const action = !p ? '' : paidTx
    ? `<button class="pill-paid" data-act="unpayloan" data-id="${loan.id}" data-due="${p.due}" aria-label="${esc(t('unmark_aria', { name: loan.name }))}">${t('paid')}</button>`
    : `<button class="btn ghost small" data-act="payloan" data-id="${loan.id}" data-due="${p.due}" aria-label="${esc(t('mark_paid_aria', { name: loan.name }))}">${t('paid_it')}</button>`;
  const title = withDue ? t('loan_due_title', { name: loan.name }) : loan.name;
  const progress = withDue ? '' : `<div class="row-meta">${esc(t('loan_progress', { paid: left.paid, n: loan.count, amt: fmt(left.amount) }))}</div>
      <div class="bar"><i class="prog" style="width:${(left.paid / loan.count * 100).toFixed(1)}%"></i></div>`;
  return `<div class="row">${ico(c)}
    <button class="row-main" data-act="editloan" data-id="${loan.id}">
      <div class="row-title">${esc(title)}</div><div class="row-meta">${meta}</div>${progress}</button>
    <div class="row-amt">${fmt(p ? p.amount : loan.payment)}</div>${action}</div>`;
}

function payLoans() {
  const key = state.month, loans = state.data.loans;
  if (!loans.length) return `<div class="empty" style="margin-top:16px"><p>${t('no_loans')}</p><button class="btn primary" data-act="newloan">${t('add_loan')}</button></div>`;
  const start = periodStart(curPeriod());
  const done = loans.filter(l => loanLeft(l).count === 0 && loanEnd(l) < start);
  const active = loans.filter(l => !done.includes(l)).sort((a, b) => loanEnd(a).localeCompare(loanEnd(b)));
  const thisMonth = loanPaymentsIn(key).reduce((s, { p }) => s + p.amount, 0);
  const left = active.reduce((s, l) => s + loanLeft(l).amount, 0);
  return `<div class="figs"><div class="fig"><span>${t('loans_this')}</span><b>${fmt(thisMonth)}</b></div>
      <div class="fig"><span>${t('loans_left')}</span><b>${fmt(left)}</b></div></div>
    ${active.length ? `<div class="list" style="margin-top:8px">${active.map(l => loanRow(l, key, false)).join('')}</div>` : ''}
    ${done.length ? `<div class="day-head"><span>${t('loans_done', { n: done.length })}</span></div><div class="list">${done.map(l => loanRow(l, key, false)).join('')}</div>` : ''}
    <button class="btn ghost wide" data-act="newloan" style="margin-top:12px">${t('add_loan')}</button>`;
}

function payBills() {
  const key = state.month, bills = billsForMonth(key).sort((a, b) => a.day - b.day);
  if (!bills.length) return `<div class="empty" style="margin-top:16px"><p>${t('no_bills')}</p><button class="btn primary" data-act="newbill">${t('add_bill')}</button></div>`;
  const total = bills.reduce((s, b) => s + b.amount, 0), paid = bills.filter(b => billPaidTx(b, key)).length;
  return `<div class="figs"><div class="fig"><span>${t('bills_fixed')}</span><b>${fmt(total)}</b></div>
      <div class="fig"><span>${t('bills_paid')}</span><b>${t('bills_status', { p: paid, t: bills.length })}</b></div></div>
    <div class="list" style="margin-top:8px">${bills.map(b => billRow(b, key, false)).join('')}</div>
    <button class="btn ghost wide" data-act="newbill" style="margin-top:12px">${t('add_bill')}</button>`;
}

function payInst() {
  const key = state.month, plans = state.data.installments;
  if (!plans.length) return `<div class="empty" style="margin-top:16px"><p>${t('no_inst')}</p><button class="btn primary" data-act="newinst">${t('add_inst')}</button></div>`;
  const active = plans.filter(p => planEnd(p) >= key).sort((a, b) => planEnd(a).localeCompare(planEnd(b)));
  const done = plans.filter(p => planEnd(p) < key);
  const thisMonth = portionsInMonth(key).reduce((s, p) => s + p.amount, 0);
  const left = plans.reduce((s, p) => s + planRemaining(p, key), 0);
  const row = p => {
    const c = catById(p.category_id), card = cardById(p.card_id), paidN = planPaidThrough(p, key);
    const notStarted = p.first_month > key;
    const meta = notStarted ? t('inst_soon', { month: monthName(p.first_month) }) : t('inst_meta', { i: paidN, n: p.count, month: monthName(planEnd(p)) });
    const portion = portionFor(p, notStarted ? p.first_month : key) || portionFor(p, p.first_month);
    return `<button class="row" data-act="editinst" data-id="${p.id}">${ico(c)}
      <div class="row-main"><div class="row-title">${esc(p.name)}</div><div class="row-meta">${esc(meta)}${card ? ', ' + esc(card.name) : ''}</div>
        <div class="bar"><i class="prog" style="width:${(paidN / p.count * 100).toFixed(1)}%"></i></div></div>
      <div class="row-amt">${t('inst_monthly', { amt: fmt(portion.amount) })}<small>${t('inst_left')}: ${fmt(planRemaining(p, key))}</small></div></button>`;
  };
  return `<div class="figs"><div class="fig"><span>${t('inst_this_month')}</span><b>${fmt(thisMonth)}</b></div>
      <div class="fig"><span>${t('inst_left')}</span><b>${fmt(left)}</b></div></div>
    <section class="sec" style="margin-top:14px">${loadChart(key)}</section>
    ${active.length ? `<div class="list" style="margin-top:14px">${active.map(row).join('')}</div>` : ''}
    ${done.length ? `<div class="day-head"><span>${t('inst_done', { n: done.length })}</span></div><div class="list">${done.map(row).join('')}</div>` : ''}
    <button class="btn ghost wide" data-act="newinst" style="margin-top:12px">${t('add_inst')}</button>`;
}

function payCards() {
  const cards = state.data.cards;
  if (!cards.length) return `<div class="empty" style="margin-top:16px"><p>${t('no_cards')}</p><button class="btn primary" data-act="newcard">${t('add_card')}</button></div>`;
  const now = today();
  const rows = cards.map(c => {
    const next = nextStatement(c, now), amount = statementAmount(c, next);
    const lim = Number(c.limit) || 0;
    const owed = r2(amount + state.data.installments.filter(p => p.card_id === c.id).reduce((s, p) => s + planRemaining(p, next.slice(0, 7)), 0));
    const usage = lim > 0 ? owed / lim * 100 : 0;
    const ucls = usage > 100 ? 'neg' : usage >= 80 ? 'warn' : '';
    const usageText = t('limit_used', { p: pct(usage) });
    return `<button class="row" data-act="editcard" data-id="${c.id}">${ico({ emoji: '💳', color: '#4C7DBF' })}
      <div class="row-main"><div class="row-title">${esc(c.name)}</div>
        <div class="row-meta">${t('card_next', { date: dateShort(next) })}, ${t('card_due_on', { date: dateShort(dueFor(c, next)) })}</div>
        ${lim > 0 ? `<div class="row-meta">${ucls ? `<span class="${ucls}">${usageText}</span>` : usageText}</div><div class="bar"><i class="${ucls}" style="width:${Math.min(usage, 100).toFixed(1)}%"></i></div>` : ''}
      </div><div class="row-amt">${fmt(amount)}<small>${t('card_cycle')}</small></div></button>${stmtRow(c, now)}`;
  }).join('');
  return `<div class="list" style="margin-top:14px">${rows}</div><button class="btn ghost wide" data-act="newcard" style="margin-top:12px">${t('add_card')}</button>`;
}
