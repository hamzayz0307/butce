// Small, pure helpers: dates as 'YYYY-MM-DD' / 'YYYY-MM' strings, numbers, text.

export const $ = (sel, el = document) => el.querySelector(sel);

export const uid = () =>
  globalThis.crypto?.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);

export const esc = s =>
  String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const pad = n => String(n).padStart(2, '0');
export const r2 = n => Math.round(n * 100) / 100;

export const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const ymOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
export const today = () => ymd(new Date());
export const curMonth = () => ymOf(new Date());
export const parseYmd = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d || 1); };
export const shiftDays = (s, n) => { const d = parseYmd(s); d.setDate(d.getDate() + n); return ymd(d); };
export const addMonths = (key, n) => { const [y, m] = key.split('-').map(Number); return ymOf(new Date(y, m - 1 + n, 1)); };
export const daysInMonth = key => { const [y, m] = key.split('-').map(Number); return new Date(y, m, 0).getDate(); };
export const monthDiff = (a, b) => {
  const [ya, ma] = a.split('-').map(Number), [yb, mb] = b.split('-').map(Number);
  return (yb - ya) * 12 + (mb - ma);
};
export const daysBetween = (a, b) => Math.round((parseYmd(b) - parseYmd(a)) / 86400000);

// Lowercase and fold Turkish letters so "Şok", "sok" and "ŞOK" all match.
export const norm = s => String(s || '').toLocaleLowerCase('tr-TR')
  .replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ğ/g, 'g').replace(/ü/g, 'u')
  .replace(/ö/g, 'o').replace(/ç/g, 'c').replace(/i̇/g, 'i');

// Accepts "1.250,50", "1250.5", "1,5k", "12 bin". Returns NaN when there is no number.
export function toNumber(raw) {
  if (raw == null) return NaN;
  let s = String(raw).trim().toLowerCase();
  let mult = 1;
  if (/\s*(k|bin)$/.test(s)) { mult = 1000; s = s.replace(/\s*(k|bin)$/, ''); }
  s = s.replace(/[^\d.,-]/g, '');
  const hasDot = s.includes('.'), hasComma = s.includes(',');
  if (hasDot && hasComma) {
    s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (hasComma) {
    const p = s.split(',');
    s = (p.length === 2 && p[1].length !== 3) ? p.join('.') : p.join('');
  } else if (hasDot) {
    const p = s.split('.');
    if (!(p.length === 2 && p[1].length !== 3)) s = p.join('');
  }
  const v = parseFloat(s);
  return Number.isFinite(v) ? r2(v * mult) : NaN;
}
