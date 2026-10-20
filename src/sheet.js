// Bottom sheet (modal panel) and toast messages.
import { t } from './i18n.js';
import { $ } from './utils.js';
import { svg, IC } from './views/components.js';

const sheet = $('#sheet');
sheet.addEventListener('click', e => { if (e.target === sheet) closeSheet(); }); // tap on the backdrop

// `back` names a data-act to show a back arrow (e.g. 'settings' to return there)
export function openSheet(title, body, back) {
  const backBtn = back ? `<button class="icon-btn back" data-act="${back}" aria-label="${t('back')}">${svg(IC.left, 20)}</button>` : '';
  $('#sheet-inner').innerHTML = `<div class="sheet-head">${backBtn}<h3 id="sheet-title">${title}</h3>
    <button class="icon-btn" data-act="close" aria-label="${t('close')}">${svg(IC.x, 20)}</button></div>
    <div class="sheet-body">${body}</div>`;
  if (!sheet.open) sheet.showModal();
  const first = $('#sheet-inner [autofocus]');
  if (first) setTimeout(() => first.focus(), 30);
}

export const closeSheet = () => { if (sheet.open) sheet.close(); };
export const sheetForm = () => $('#sheet form');

let toastTimer;
export function toast(msg) {
  const el = $('#toast');
  (sheet.open ? sheet : document.body).appendChild(el); // stay visible above an open sheet
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}
