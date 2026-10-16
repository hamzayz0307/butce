// Quick entry: "250 market, 80 taksi, +42000 maaş, 12000 telefon 6 taksit"
import { KEYWORDS, INCOME_KEYS } from './constants.js';
import { norm, today, shiftDays, toNumber } from './utils.js';
import { capFirst } from './format.js';
import { catByKey } from './state.js';

// Returns the category key a text points to, or null. `type` is 'expense' or 'income'.
export function matchCategory(text, type) {
  const n = ' ' + norm(text).replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ') + ' ';
  const tokens = n.trim().split(' ').filter(Boolean);
  for (const [key, words] of Object.entries(KEYWORDS)) {
    const isInc = INCOME_KEYS.includes(key);
    if ((type === 'income') !== isInc) continue;
    for (const w of words) {
      if (w.includes(' ')) { if (n.includes(' ' + w)) return key; }
      else if (tokens.some(tk => (w.length <= 3 ? tk === w : tk.startsWith(w)))) return key;
    }
  }
  return null;
}

export function parseQuick(text) {
  return text.split(/[,;\n]+|\s+ve\s+|\s+and\s+/i).map(s => s.trim()).filter(Boolean).map(parseOne);
}

export function parseOne(raw) {
  let s = ' ' + raw + ' ';
  let type = null, date = today(), count = 1;

  if (/^\s*\+/.test(s)) { type = 'income'; s = s.replace('+', ' '); }

  const yRe = /\s(dün|dun|yesterday)(?=\s)/i;
  if (yRe.test(s)) { date = shiftDays(today(), -1); s = s.replace(yRe, ' '); }

  const im = s.match(/\s(\d{1,2})\s*(?:taksit|installments?)(?=\s)/i) || s.match(/\s(?:taksit|installments?)\s*(\d{1,2})(?=\s)/i);
  if (im) { count = parseInt(im[1], 10); s = s.replace(im[0], ' '); }

  const am = s.match(/\s[₺$€]?\s?(\d[\d.,]*)\s?(k|bin)?(?:\s?(?:tl|₺|try|lira))?(?=\s)/i);
  if (!am) return { error: true, raw };
  const amount = toNumber(am[1] + (am[2] || ''));
  if (!(amount > 0)) return { error: true, raw };
  s = s.replace(am[0], ' ');

  const note = s.replace(/\s+/g, ' ').trim();
  if (!type) type = matchCategory(note, 'income') ? 'income' : 'expense';
  const key = matchCategory(note, type) || (type === 'income' ? 'other_income' : 'other');
  const cat = catByKey(key);
  return {
    raw, type, amount, date,
    note: capFirst(note),
    count: type === 'expense' && count >= 2 && count <= 36 ? count : 1,
    category_id: cat ? cat.id : null
  };
}
