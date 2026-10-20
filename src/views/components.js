// Shared building blocks for views and forms: icons, section wrapper, rows, fields.
import { t } from '../i18n.js';
import { esc, today, daysBetween } from '../utils.js';
import { dateShort, numIn } from '../format.js';

export const svg = (d, s = 22) =>
  `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;

export const IC = {
  home: '<path d="M3.5 10.5 12 4l8.5 6.5V19a1 1 0 0 1-1 1H15v-5.5H9V20H4.5a1 1 0 0 1-1-1z"/>',
  list: '<path d="M8 6h12M8 12h12M8 18h8"/><circle cx="4" cy="6" r=".6" fill="currentColor"/><circle cx="4" cy="12" r=".6" fill="currentColor"/><circle cx="4" cy="18" r=".6" fill="currentColor"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  cal: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r=".8" fill="currentColor"/>',
  wallet: '<path d="M17.5 7.5V6a1.5 1.5 0 0 0-1.5-1.5H6A2.5 2.5 0 0 0 3.5 7v10A2.5 2.5 0 0 0 6 19.5h12a2.5 2.5 0 0 0 2.5-2.5v-7A2.5 2.5 0 0 0 18 7.5H6"/><circle cx="16.5" cy="13.5" r="1" fill="currentColor"/>',
  sliders: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  left: '<path d="m14.5 6-6 6 6 6"/>',
  right: '<path d="m9.5 6 6 6-6 6"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>'
};

// Banknote-style guilloché drawn behind the hero number
export const GUILLOCHE = (() => {
  const W = 360, H = 210; let p = '';
  for (let k = 0; k < 11; k++) {
    let d = '';
    for (let x = -10; x <= W + 10; x += 5) {
      const y = H * 0.86 - k * 6.5 + Math.sin(x / 33 + k * 0.5) * 13 + Math.sin(x / 12 + k * 1.3) * 2.5;
      d += (d ? 'L' : 'M') + x + ' ' + y.toFixed(1);
    }
    p += `<path d="${d}"/>`;
  }
  const cx = W - 62, cy = 56;
  for (let j = 0; j < 8; j++) {
    let d = '';
    for (let a = 0; a <= 360; a += 2) {
      const th = a * Math.PI / 180, r = 34 + 10 * Math.sin(11 * th + j * 0.4);
      d += (d ? 'L' : 'M') + (cx + r * Math.cos(th)).toFixed(1) + ' ' + (cy + r * Math.sin(th)).toFixed(1);
    }
    p += `<path d="${d}Z"/>`;
  }
  return `<svg class="guil" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMaxYMid slice" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1">${p}</g></svg>`;
})();

export const sec = (title, body, action = '') =>
  `<section class="sec"><div class="sec-head"><h2>${title}</h2>${action}</div>${body}</section>`;

export const ico = c =>
  `<span class="ico" style="--c:${c?.color || '#7C8A85'}" aria-hidden="true">${c?.emoji || '🧾'}</span>`;

export function dueLabel(due) {
  const n = daysBetween(today(), due);
  if (n < 0) return `<span class="badge neg">${t('overdue')}</span> ${dateShort(due)}`;
  if (n === 0) return t('due_today');
  if (n === 1) return t('due_tomorrow');
  return `${t('due_in', { n })}, ${dateShort(due)}`;
}

/* Form pieces */
export const opt = (v, label, sel) => `<option value="${esc(v)}"${sel ? ' selected' : ''}>${esc(label)}</option>`;
export const field = (label, input, extra = '') => `<label class="field"><span>${label}</span>${input}${extra}</label>`;
// `v` may be a number, or the raw text typed so far (kept as is)
export const amountInput = (name, v, autofocus = true) =>
  `<input class="amount" name="${name}" inputmode="decimal" autocomplete="off" ${autofocus ? 'autofocus' : ''} value="${esc(typeof v === 'string' ? v : numIn(v))}" placeholder="0">`;
