// Goals tab: savings goals with progress and the monthly amount needed.
import { state } from '../state.js';
import { t } from '../i18n.js';
import { esc, curMonth, monthDiff } from '../utils.js';
import { fmt, monthName } from '../format.js';
import { goalSaved } from '../model.js';
import { ico } from './components.js';

export function viewGoals() {
  const goals = state.data.goals;
  if (!goals.length) return `<div class="empty"><p>${t('no_goals')}</p><button class="btn primary" data-act="newgoal">${t('add_goal')}</button></div>`;
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
  return `<div class="figs" style="margin-top:4px"><div class="fig" style="grid-column:1/-1"><span>${t('goals_total')}</span>
      <b style="font-size:28px">${fmt(total)}</b>${showUsd ? `<small>≈ ${usd(total)}</small>` : ''}</div></div>
    <div class="list" style="margin-top:8px">${rows}</div>
    <button class="btn ghost wide" data-act="newgoal" style="margin-top:12px">${t('add_goal')}</button>`;
}
