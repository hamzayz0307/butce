// Wallet tab: net worth, accounts (incl. foreign currency and gold), then savings goals.
import { state, accountsList, accEmoji, defaultAccount } from '../state.js';
import { t } from '../i18n.js';
import { esc, curMonth, monthDiff } from '../utils.js';
import { fmt, monthName } from '../format.js';
import { accountBalance, accountValue, goalSaved, netWorth } from '../model.js';
import { isBaseCurrency, fmtUnits, altValues, fromBase } from '../money.js';
import { sec, ico, GUILLOCHE } from './components.js';

export function viewWallet() {
  return (state.data.accounts.length ? worthHero() : '') + accountsSec() + goalsSec();
}

function worthHero() {
  const nw = netWorth();
  const alt = altValues(nw.net);
  return `<section class="note" aria-label="${esc(t('net_worth'))}">${GUILLOCHE}
    <div class="note-label">${t('net_worth')}</div>
    <p class="note-amount"><span>${fmt(nw.net, { dec: 0 })}</span></p>
    ${alt.length ? `<p class="note-sub">≈ ${alt.join(', ≈ ')}</p>` : ''}
    ${nw.missing ? `<p class="note-sub">${t('nw_missing')}</p><div class="note-actions"><button class="btn on-note" data-act="fetchrate">${t('s_fetch')}</button></div>` : ''}
  </section>
  <div class="figs">
    <div class="fig"><span>${t('nw_assets')}</span><b>${fmt(nw.assets, { dec: 0 })}</b></div>
    <div class="fig"><span>${t('nw_debts')}</span><b>${fmt(nw.liabilities, { dec: 0 })}</b>${nw.parts.cards > 0 ? `<small>${t('nw_cards_incl')}</small>` : ''}</div>
  </div>`;
}

function accountsSec() {
  const accs = accountsList();
  if (!accs.length) {
    return sec(t('sec_accounts'), `<div class="empty"><p>${t('no_accounts')}</p><button class="btn primary" data-act="newacc">${t('add_account')}</button></div>`);
  }
  const def = defaultAccount();
  const COLORS = { cash: '#4C7DBF', bank: '#4C7DBF', savings: '#2F7D68', fx: '#2F95A6', gold: '#B8962E' };
  const rows = accs.map(a => {
    const bal = accountBalance(a), base = isBaseCurrency(a), val = base ? bal : accountValue(a);
    const kindLabel = a.kind === 'fx' ? `${t('kind_fx')} (${a.currency})` : a.kind === 'gold' ? t('unit_' + (a.unit || 'g24')) : t('kind_' + a.kind);
    const meta = [kindLabel, def?.id === a.id ? t('acc_default_tag') : ''].filter(Boolean).join(', ');
    return `<button class="row" data-act="editacc" data-id="${a.id}">${ico({ emoji: accEmoji(a), color: COLORS[a.kind] })}
      <div class="row-main"><div class="row-title">${esc(a.name)}</div><div class="row-meta">${esc(meta)}</div></div>
      <div class="row-amt${bal < 0 ? ' amt-neg' : ''}">${fmtUnits(a, bal)}${base ? '' : `<small>${val == null ? t('rate_needed') : '≈ ' + fmt(val, { dec: 0 })}</small>`}</div></button>`;
  }).join('');
  return `${sec(t('sec_accounts'), `<div class="list">${rows}</div>
      <div class="grid2" style="gap:8px;margin-top:12px">
        <button class="btn ghost" data-act="transfer" ${accs.length < 2 ? 'disabled' : ''}>${t('new_transfer')}</button>
        <button class="btn ghost" data-act="newacc">${t('add_account')}</button></div>`)}`;
}

function goalsSec() {
  const goals = state.data.goals;
  const add = `<button class="link" data-act="newgoal">${t('add_goal')}</button>`;
  if (!goals.length) return sec(t('tab_goals'), `<div class="empty"><p>${t('no_goals')}</p><button class="btn primary" data-act="newgoal">${t('add_goal')}</button></div>`);
  const showUsd = (state.settings.currency || 'TRY') !== 'USD' && fromBase(1, 'USD') != null;
  const usd = n => fmt(fromBase(n, 'USD'), { cur: 'USD', dec: 0 });
  const total = goals.reduce((s, g) => s + goalSaved(g), 0), now = curMonth();
  const rows = goals.map(g => {
    const saved = goalSaved(g), target = Number(g.target) || 0, ratio = target > 0 ? saved / target : 0;
    let meta;
    if (saved >= target) meta = `<span style="color:var(--pos);font-weight:700">${t('goal_done')}</span>`;
    else if (g.deadline) {
      const m = monthDiff(now, g.deadline) + 1;
      meta = m <= 0 ? `<span class="warn">${t('goal_late')}</span>`
        : `${t('goal_need', { amt: fmt((target - saved) / m, { dec: 0 }) })}, ${t('goal_by', { month: monthName(g.deadline) })}`;
    } else meta = t('goal_left', { amt: fmt(target - saved) });
    return `<div class="row">${ico({ emoji: g.emoji || '🎯', color: '#2F7D68' })}
      <button class="row-main" data-act="editgoal" data-id="${g.id}">
        <div class="row-title">${esc(g.name)}</div><div class="row-meta">${meta}</div>
        <div class="bar"><i class="prog" style="width:${Math.min(ratio * 100, 100).toFixed(1)}%"></i></div>
        <div class="row-meta">${fmt(saved)} / ${fmt(target)}${showUsd ? ` (≈ ${usd(saved)})` : ''}</div></button>
      <button class="btn ghost small" data-act="goalmoney" data-id="${g.id}">${t('add_money')}</button></div>`;
  }).join('');
  return sec(t('tab_goals'), `<p class="sec-sub">${t('goals_total')}: <b>${fmt(total)}</b>${showUsd ? ` (≈ ${usd(total)})` : ''}</p>
    <div class="list">${rows}</div>`, add);
}
