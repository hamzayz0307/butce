// App lock: a 4-digit PIN asked when the app opens and after a minute in the background.
// The PIN belongs to this device (its own storage key, never synced). It hides the
// screen from prying eyes; it does not encrypt the data stored on the device.
import { t } from './i18n.js';
import { svg } from './views/components.js';

const KEY = 'butce.lock';
const LENGTH = 4;
const ITERATIONS = 150000;
export const LOCK_AFTER_MS = 60 * 1000;
const MAX_FAILS = 5, WAIT_MS = 30 * 1000;

const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch { return null; } };
const write = v => { try { if (v) localStorage.setItem(KEY, JSON.stringify(v)); else localStorage.removeItem(KEY); } catch { /* storage blocked */ } };
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');

export const lockSupported = () => !!globalThis.crypto?.subtle;
export const lockEnabled = () => !!read()?.hash;

async function derive(pin, salt) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations: ITERATIONS }, key, 256));
}

export async function setPin(pin) {
  const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
  write({ salt, hash: await derive(pin, salt), fails: 0, until: 0 });
}

export const removePin = () => write(null);

// { ok } or { ok: false, left: tries left } or { ok: false, wait: ms to wait }
export async function checkPin(pin) {
  const r = read();
  if (!r) return { ok: true };
  if (r.until > Date.now()) return { ok: false, wait: r.until - Date.now() };
  if ((await derive(pin, r.salt)) === r.hash) { write({ ...r, fails: 0, until: 0 }); return { ok: true }; }
  const fails = (r.fails || 0) + 1;
  if (fails >= MAX_FAILS) { write({ ...r, fails: 0, until: Date.now() + WAIT_MS }); return { ok: false, wait: WAIT_MS }; }
  write({ ...r, fails });
  return { ok: false, left: MAX_FAILS - fails };
}

/* ---------- PIN pad ---------- */
const BACK = '<path d="M9 6h10a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 19 18H9l-5.5-6z"/><path d="m11.5 9.5 5 5M16.5 9.5l-5 5"/>';
let activePad = null;

// Draws a keypad into `host`. `onDone(pin)` returns true when accepted, or an error text to show.
export function pinPad(host, { title, sub = '', onDone, extra = '', logo = false }) {
  host.innerHTML = `<div class="pin">
    ${logo ? '<img class="pin-logo" src="/icons/icon.svg" width="56" height="56" alt="">' : ''}
    <h2 class="pin-title">${title}</h2>
    <p class="pin-sub" aria-live="polite">${sub}</p>
    <div class="pin-dots" aria-hidden="true">${'<i></i>'.repeat(LENGTH)}</div>
    <div class="pin-keys">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button type="button" data-k="${n}">${n}</button>`).join('')}
      <span></span><button type="button" data-k="0">0</button>
      <button type="button" data-k="back" aria-label="${t('pin_delete')}">${svg(BACK, 26)}</button></div>
    ${extra}</div>`;
  const pad = host.querySelector('.pin'), dots = [...host.querySelectorAll('.pin-dots i')], subEl = host.querySelector('.pin-sub');
  let digits = '', busy = false;
  const paint = () => dots.forEach((d, i) => d.classList.toggle('on', i < digits.length));
  const press = async k => {
    if (busy) return;
    if (k === 'back') { digits = digits.slice(0, -1); return paint(); }
    if (digits.length >= LENGTH) return;
    digits += k; paint();
    if (digits.length < LENGTH) return;
    busy = true;
    const res = await onDone(digits);
    busy = false;
    if (res === true || !pad.isConnected) return;
    digits = ''; paint();
    subEl.textContent = res || '';
    subEl.classList.add('err');
    pad.classList.remove('shake'); void pad.offsetWidth; pad.classList.add('shake');
  };
  host.querySelector('.pin-keys').addEventListener('click', e => {
    const b = e.target.closest('[data-k]');
    if (b) press(b.dataset.k);
  });
  activePad = { pad, press };
  return { setSub: (text, isErr = false) => { subEl.textContent = text; subEl.classList.toggle('err', isErr); } };
}

// Physical keyboards: digits and Backspace go to the pad on screen
document.addEventListener('keydown', e => {
  if (!activePad?.pad.isConnected || e.target.closest?.('input, textarea, select')) return;
  if (/^[0-9]$/.test(e.key)) { e.preventDefault(); activePad.press(e.key); }
  else if (e.key === 'Backspace') { e.preventDefault(); activePad.press('back'); }
});

/* ---------- Lock screen ---------- */
let overlay = null;
export const isLocked = () => !!overlay;

// Shows the lock screen; resolves once the right PIN is entered.
// `onForgot` runs after the user confirms wiping everything.
export function showLock(onForgot) {
  if (overlay) return overlay.promise;
  const el = document.createElement('div');
  el.className = 'lock';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-label', t('pin_locked_title'));
  document.body.appendChild(el);
  document.body.classList.add('is-locked');
  let resolve;
  const promise = new Promise(r => { resolve = r; });
  overlay = { el, promise };

  const waitText = ms => t('pin_wait', { s: Math.ceil(ms / 1000) });
  const enter = () => {
    const pad = pinPad(el, {
      title: t('pin_locked_title'), sub: t('pin_enter'), logo: true,
      extra: `<button type="button" class="link pin-forgot" data-pin="forgot">${t('pin_forgot')}</button>`,
      onDone: async pin => {
        const r = await checkPin(pin);
        if (r.ok) { close(); return true; }
        return r.wait ? waitText(r.wait) : t('pin_wrong', { n: r.left });
      }
    });
    el.querySelector('[data-pin=forgot]').addEventListener('click', forgot);
    return pad;
  };
  const forgot = () => {
    el.innerHTML = `<div class="pin"><h2 class="pin-title">${t('pin_forgot')}</h2>
      <p class="pin-note">${t('pin_forgot_text')}</p>
      <button type="button" class="btn danger wide" data-pin="wipe">${t('pin_forgot_wipe')}</button>
      <button type="button" class="link pin-forgot" data-pin="back">${t('pin_back')}</button></div>`;
    const wipe = el.querySelector('[data-pin=wipe]');
    wipe.addEventListener('click', () => {
      if (!wipe.dataset.armed) { wipe.dataset.armed = '1'; wipe.textContent = t('tap_again'); return; }
      removePin(); onForgot?.();
    });
    el.querySelector('[data-pin=back]').addEventListener('click', enter);
  };
  const close = () => {
    el.remove(); overlay = null; activePad = null;
    document.body.classList.remove('is-locked', 'shielded');
    resolve();
  };
  enter();
  const r = read();
  if (r?.until > Date.now()) el.querySelector('.pin-sub').textContent = waitText(r.until - Date.now());
  return promise;
}
