// Entry point: styles, fonts, event wiring and start-up.
import '@fontsource-variable/manrope';
import '@fontsource-variable/bricolage-grotesque';
import './styles.css';

import { state, cardById, goalById, catById } from './state.js';
import { t } from './i18n.js';
import { $, esc, addMonths } from './utils.js';
import { curPeriod } from './period.js';
import { parseQuick } from './parser.js';
import { render } from './render.js';
import { txListHtml } from './views/activity.js';
import { openSheet, closeSheet, sheetForm } from './sheet.js';
import {
  openAdd, renderQuickPreview, txForm, updateTxFormBits, billForm, instForm, updateInstFormBits,
  cardForm, goalForm, goalMoneyForm, limitsForm, openSettings, catOptions, openCats, catForm
} from './forms.js';
import {
  refresh, ensureCategories, FORMS, saveQuick, removeItem, payBill, unpayBill,
  saveSetting, setLanguage, fetchRate, exportData, importFile, wipeAll
} from './actions.js';
import { loadSample } from './sample.js';

const goTo = (tab, payTab) => {
  state.tab = tab;
  if (payTab) state.payTab = payTab;
  window.scrollTo(0, 0);
  render();
};

// Two-tap confirmation for destructive buttons
function arm(el) {
  if (el.dataset.armed) return true;
  const old = el.textContent;
  el.dataset.armed = '1';
  el.textContent = t('tap_again');
  setTimeout(() => { if (el.isConnected) { delete el.dataset.armed; el.textContent = old; } }, 3000);
  return false;
}

// Click handlers, keyed by the element's data-act attribute
const ACTS = {
  tab: el => goTo(el.dataset.v),
  month: el => { state.month = addMonths(state.month, Number(el.dataset.d)); state.barSel = null; render(); },
  'month-now': () => { state.month = curPeriod(); state.barSel = null; render(); },
  settings: openSettings,
  close: closeSheet,
  add: el => openAdd(el.dataset.mode || 'quick'),
  addmode: el => openAdd(el.dataset.v),
  quicksave: saveQuick,
  sample: loadSample,
  paybill: el => payBill(el.dataset.id, el.dataset.month),
  unpay: el => unpayBill(el.dataset.id, el.dataset.month),
  edittx: el => { const x = state.data.transactions.find(v => v.id === el.dataset.id); if (x) openSheet(t('edit_entry'), txForm(x)); },
  newbill: () => openSheet(t('add_bill'), billForm(null)),
  editbill: el => openSheet(t('edit_bill'), billForm(state.data.bills.find(v => v.id === el.dataset.id))),
  newinst: () => { openSheet(t('add_inst'), instForm(null)); updateInstFormBits(sheetForm(), 'init'); },
  editinst: el => { openSheet(t('edit_inst'), instForm(state.data.installments.find(v => v.id === el.dataset.id))); updateInstFormBits(sheetForm(), 'init'); },
  newcard: () => openSheet(t('add_card'), cardForm(null)),
  editcard: el => openSheet(t('edit_card'), cardForm(cardById(el.dataset.id))),
  newgoal: () => openSheet(t('add_goal'), goalForm(null)),
  editgoal: el => openSheet(t('edit_goal'), goalForm(goalById(el.dataset.id))),
  goalmoney: el => { const g = goalById(el.dataset.id); if (g) openSheet(`${g.emoji} ${esc(g.name)}`, goalMoneyForm(g)); },
  limits: el => openSheet(t('limits_title'), limitsForm(), el.closest('#sheet') ? 'settings' : null),
  cats: el => openCats(el.dataset.v),
  newcat: () => openSheet(t('add_cat'), catForm(null, state.catTab || 'expense'), 'cats'),
  editcat: el => openSheet(t('edit_cat'), catForm(catById(el.dataset.id)), 'cats'),
  paytab: el => { state.payTab = el.dataset.v; render(); },
  'goto-cards': () => goTo('pay', 'cards'),
  'goto-inst': () => goTo('pay', 'inst'),
  bar: el => { state.barSel = el.dataset.k; render(); },
  filtercat: el => { state.txFilter = { q: '', type: 'all', cat: el.dataset.id }; goTo('tx'); },
  clearcat: () => { state.txFilter.cat = null; render(); },
  clearall: () => { state.txFilter = { q: '', type: 'all', cat: null }; render(); },
  txtype: el => { state.txFilter.type = el.dataset.v; render(); },
  setlang: async el => { await setLanguage(el.dataset.v); openSettings(); },
  fetchrate: fetchRate,
  export: exportData,
  import: () => $('#import-file').click(),
  wipe: el => { if (arm(el)) wipeAll(); },
  del: el => { if (arm(el)) removeItem(el.dataset.kind, el.dataset.id); }
};

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const fn = ACTS[el.dataset.act];
  if (fn) { e.preventDefault(); fn(el, e); }
});

document.addEventListener('submit', e => {
  const f = e.target;
  if (f.dataset.form && FORMS[f.dataset.form]) { e.preventDefault(); FORMS[f.dataset.form](f); }
});

document.addEventListener('input', e => {
  const el = e.target;
  if (el.id === 'quick') {
    state.quickItems = parseQuick(el.value).map(x =>
      (x.error || !state.quickOverrides[x.raw] ? x : { ...x, category_id: state.quickOverrides[x.raw], overridden: true }));
    renderQuickPreview();
  } else if (el.id === 'txq') {
    state.txFilter.q = el.value;
    $('#tx-list').innerHTML = txListHtml();
  } else if (el.form?.dataset.form === 'tx') updateTxFormBits(el.form);
  else if (el.form?.dataset.form === 'inst') updateInstFormBits(el.form, el.name);
});

document.addEventListener('change', e => {
  const el = e.target;
  if (el.dataset.qi != null) {
    const x = state.quickItems[Number(el.dataset.qi)];
    if (x) { x.category_id = el.value; x.overridden = true; state.quickOverrides[x.raw] = el.value; renderQuickPreview(); }
    return;
  }
  if (el.dataset.setting) { saveSetting(el.dataset.setting, el.value); return; }
  const f = el.form;
  if (f?.dataset.form === 'tx') {
    if (el.name === 'type') f.category_id.innerHTML = catOptions(el.value, null);
    updateTxFormBits(f);
  } else if (f?.dataset.form === 'inst') updateInstFormBits(f, el.name);
});

$('#import-file').addEventListener('change', e => {
  const file = e.target.files[0];
  e.target.value = '';
  if (file) importFile(file);
});

// Installable app + offline support (production builds only, so dev never serves stale files)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}

(async function start() {
  await refresh();
  await ensureCategories();
  state.month = curPeriod();
  render();
})();
