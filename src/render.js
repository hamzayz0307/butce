// Draws the current tab. Called after every data or UI change.
import { state } from './state.js';
import { t, LANG } from './i18n.js';
import { $ } from './utils.js';
import { renderTop, renderTabs } from './views/chrome.js';
import { viewHome } from './views/home.js';
import { viewTx } from './views/activity.js';
import { viewPay } from './views/payments.js';
import { viewGoals } from './views/goals.js';

const VIEWS = { home: viewHome, tx: viewTx, pay: viewPay, goals: viewGoals };

export function render() {
  document.documentElement.lang = LANG;
  document.title = t('app');
  renderTop();
  renderTabs();
  $('#view').innerHTML = VIEWS[state.tab]();
}
