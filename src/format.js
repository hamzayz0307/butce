// Money, percentages and dates in the user's language.
import { state } from './state.js';
import { LANG, LOC } from './i18n.js';
import { r2, parseYmd } from './utils.js';

export const capFirst = s => (s ? s.charAt(0).toLocaleUpperCase(LOC()) + s.slice(1) : s);

export function fmt(n, o = {}) {
  const cur = o.cur || state.settings.currency || 'TRY';
  const v = Number(n) || 0;
  const dec = o.dec ?? (Number.isInteger(r2(v)) ? 0 : 2);
  return new Intl.NumberFormat(LOC(), {
    style: 'currency', currency: cur, currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: dec, maximumFractionDigits: dec
  }).format(v);
}

// Turkish writes the percent sign first: %52
export const pct = n => { const r = Math.round(n); return LANG === 'tr' ? `%${r}` : `${r}%`; };

export const monthName = (key, opt = { month: 'long', year: 'numeric' }) =>
  capFirst(new Intl.DateTimeFormat(LOC(), opt).format(parseYmd(key + '-01')));
export const monthShort = key =>
  capFirst(new Intl.DateTimeFormat(LOC(), { month: 'short' }).format(parseYmd(key + '-01'))).replace('.', '');
export const dateShort = s => new Intl.DateTimeFormat(LOC(), { day: 'numeric', month: 'short' }).format(parseYmd(s));
export const dateLong = s => capFirst(new Intl.DateTimeFormat(LOC(), { day: 'numeric', month: 'long', weekday: 'long' }).format(parseYmd(s)));

// Number shown inside an input, with the decimal comma in Turkish
export const numIn = n => (n == null || n === '' ? '' : (LANG === 'tr' ? String(n).replace('.', ',') : String(n)));
