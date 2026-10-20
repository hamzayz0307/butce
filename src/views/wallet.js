// Wallet tab: accounts with balances, then savings goals.
import { state, accountsList, accEmoji, defaultAccount } from '../state.js';
import { t } from '../i18n.js';
import { esc, r2, curMonth, monthDiff } from '../utils.js';
import { fmt, monthName } from '../format.js';
import { accountBalance, goalSaved } from '../model.js';
import { sec, ico } from './components.js';

export function viewWallet() {
  return accountsSec() + goalsSec();
}

function accountsSec() {
  const accs = accountsList();
  if (!accs.length) {
    return sec(t('sec_accounts'), `<div class="empty"><p>${t('no_accounts')}</p><button class="btn primary" data-act="newacc">${t('add_account')}</button></div>`);
  }
  const def = defaultAccount();
  const rows = accs.map(a => {
    const bal = accountBalance(a);
    const meta = [t('kind_' + a.kind), def?.id === a.id ? t('acc_default_tag') : ''].filter(Boolean).join(', ');
    return `<button class="row" data-act="editacc" data-id="${a.id}">${ico({ emoji: accEmoji(a), color: a.kind === 'savings' ? '#2F7D68' : '#4C7DBF' })}
      <div class="row-main"><div class="row-title">${esc(a.name)}</div><div class="row-meta">${esc(meta)}</div></div>
      <div class="row-amt${bal < 0 ? ' amt-neg' : ''}">${fmt(bal)}</div></button>`;
  }).join('');
  const total = r2(accs.reduce((s, a) => s + accountBalance(a), 0));
  return `<div class="figs" style="margin-top:4px"><div class="fig" style="grid-column:1/-1"><span>${t('accounts_total')}</span>
      <b style="font-size:28px">${fmt(total)}</b></div></div>
    ${sec(t('sec_accounts'), `<div class="list">${rows}</div>
      <div class="grid2" style="gap:8px;margin-top:12px">
        <button class="btn ghost" data-act="transfer" ${accs.length < 2 ? 'disabled' : ''}>${t('new_transfer')}</button>
        <button class="btn ghost" data-act="newacc">${t('add_account')}</button></div>`)}`;
}

function goalsSec() {
  const goals = state.data.goals;
  const add = `<button class="link" data-act="newgoal">${t('add_goal')}</button>`;
  if (!goals.length) return sec(t('tab_goals'), `<div class="empty"><p>${t('no_goals')}</p><button class="btn primary" data-act="newgoal">${t('add_goal')}</button></div>`);
  const rate = Number(state.settings.usd_rate) || 0;
  const showUsd = rate > 0 && (state.settings.currency || 'TRY') === 'TRY';
  const usd = n => fmt(n / rate, { cur: 'USD', dec: 0 });
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
