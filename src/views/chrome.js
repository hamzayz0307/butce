// Top bar (month switcher) and bottom tab bar.
import { state } from '../state.js';
import { t } from '../i18n.js';
import { $, curMonth } from '../utils.js';
import { monthName } from '../format.js';
import { svg, IC } from './components.js';

export function renderTop() {
  const el = $('#top');
  const settingsBtn = `<button class="icon-btn" data-act="settings" aria-label="${t('settings')}">${svg(IC.sliders)}</button>`;
  if (state.tab === 'goals') {
    el.innerHTML = `<h1>${t('tab_goals')}</h1><span class="spacer"></span>${settingsBtn}`;
    return;
  }
  const notNow = state.month !== curMonth();
  el.innerHTML = `
    <button class="icon-btn" data-act="month" data-d="-1" aria-label="${t('prev_month')}">${svg(IC.left)}</button>
    <h1><button class="month-btn" data-act="month-now">${monthName(state.month)}</button></h1>
    <button class="icon-btn" data-act="month" data-d="1" aria-label="${t('next_month')}">${svg(IC.right)}</button>
    ${notNow ? `<button class="today-link" data-act="month-now">${t('this_month')}</button>` : ''}
    <span class="spacer"></span>${settingsBtn}`;
}

export function renderTabs() {
  const tab = (id, icon, label) =>
    `<button class="tab" data-act="tab" data-v="${id}" ${state.tab === id ? 'aria-current="page"' : ''}>${svg(icon)}<span>${label}</span></button>`;
  const bar = $('#tabbar');
  bar.innerHTML = `<div class="tabbar-inner">
    ${tab('home', IC.home, t('tab_home'))}${tab('tx', IC.list, t('tab_tx'))}
    <button class="tab-add" data-act="add" aria-label="${t('add')}">${svg(IC.plus, 26)}</button>
    ${tab('pay', IC.cal, t('tab_pay'))}${tab('goals', IC.target, t('tab_goals'))}</div>`;
  bar.setAttribute('aria-label', t('app'));
}
