// Foreign currency and gold: rates, units and conversion to the app's currency.
import { state } from './state.js';
import { t, LOC } from './i18n.js';
import { r2 } from './utils.js';
import { fmt } from './format.js';

export const FX = ['USD', 'EUR', 'GBP'];

// Gold is valued by its pure (24 ayar) gold content. Coins usually sell a little above this.
export const GOLD_UNITS = {
  g24: 1,          // gram altın, 24 ayar
  g22: 0.9167,     // 22 ayar gram / bilezik
  quarter: 1.6078, // çeyrek: 1,754 g × 22 ayar
  half: 3.2157,    // yarım
  full: 6.4313,    // tam
  ata: 6.6146      // Cumhuriyet / Ata: 7,216 g × 22 ayar
};

// Settings keep rates as "how many TRY for one unit"; XAU is one gram of 24 ayar gold.
export function rates() {
  const r = { ...(state.settings.rates || {}) };
  if (!r.USD && state.settings.usd_rate) r.USD = state.settings.usd_rate; // older setting
  return r;
}

export function rateTRY(code) {
  if (!code || code === 'TRY') return 1;
  const v = Number(rates()[code]);
  return v > 0 ? v : null;
}

// Value of `amount` units of `code` in the app's currency, or null when a rate is missing
export function toBase(amount, code, unit) {
  const from = rateTRY(code), to = rateTRY(state.settings.currency || 'TRY');
  if (!from || !to) return null;
  const grams = code === 'XAU' ? (GOLD_UNITS[unit] || 1) : 1;
  return r2(amount * grams * from / to);
}

// Base-currency amount expressed in another currency (for "≈ $1.200" lines)
export function fromBase(amount, code) {
  const to = rateTRY(code), from = rateTRY(state.settings.currency || 'TRY');
  if (!to || !from) return null;
  return amount * from / to;
}

export const isBaseCurrency = acc => !acc.currency || acc.currency === (state.settings.currency || 'TRY');

// Shows an account's own amount: "$1.200", "5 çeyrek", "12,5 gr"
export function fmtUnits(acc, n) {
  if (acc.currency === 'XAU') {
    const num = new Intl.NumberFormat(LOC(), { maximumFractionDigits: 2 }).format(n);
    return `${num} ${t('unit_short_' + (acc.unit || 'g24'))}`;
  }
  return fmt(n, { cur: acc.currency || state.settings.currency || 'TRY' });
}

// "≈ $1.950, ≈ 25 gr altın" for an amount in the app's currency
export function altValues(amount) {
  const out = [];
  const base = state.settings.currency || 'TRY';
  if (base !== 'USD') { const u = fromBase(amount, 'USD'); if (u != null) out.push(fmt(u, { cur: 'USD', dec: 0 })); }
  const g = fromBase(amount, 'XAU');
  if (g != null) out.push(`${new Intl.NumberFormat(LOC(), { maximumFractionDigits: g < 10 ? 1 : 0 }).format(g)} ${t('gram_gold')}`);
  return out;
}

export function ratesUpdatedText() {
  const at = rates().updated_at;
  return at ? t('rates_updated', { when: new Intl.DateTimeFormat(LOC(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(at)) }) : '';
}
