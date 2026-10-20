// Quick entry: "250 market, 80 taksi, +42000 maaş, 12000 telefon 6 taksit"
import { KEYWORDS } from './constants.js';
import { norm, today, shiftDays, toNumber } from './utils.js';
import { capFirst } from './format.js';
import { state, catById, catByKey, catName, visibleCatsOf, fallbackCat, spendAccounts } from './state.js';

// Lowercase, fold Turkish letters, keep only letters, digits and single spaces
const clean = s => norm(s).replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

const MEMORY_MAX = 300;

// The category the user picked for this exact description before, if any
export function learnedCat(note) {
  const id = state.settings.quick_memory?.[clean(note)];
  const c = id && catById(id);
  return c && !c.hidden ? c : null;
}

// Remember corrections from the quick-entry preview: { 'kedi mamasi': categoryId }
export function rememberCats(items) {
  const mem = { ...(state.settings.quick_memory || {}) };
  for (const x of items) {
    const k = clean(x.note);
    if (!k) continue;
    delete mem[k];           // re-insert so it counts as the newest
    mem[k] = x.category_id;
  }
  const keys = Object.keys(mem);
  for (const k of keys.slice(0, Math.max(0, keys.length - MEMORY_MAX))) delete mem[k];
  return mem;
}

// Returns the id of the category a text points to, or null. `type` is 'expense' or 'income'.
// Order: the user's own words and category names, then the built-in word list.
export function matchCategory(text, type) {
  const n = ' ' + clean(text) + ' ';
  const tokens = n.trim().split(' ').filter(Boolean);
  const hit = raw => {
    const w = clean(raw);
    if (!w) return false;
    if (w.includes(' ')) return n.includes(' ' + w);
    return tokens.some(tk => (w.length <= 3 ? tk === w : tk.startsWith(w)));
  };
  for (const c of visibleCatsOf(type)) {
    if ([...(c.keywords || []), catName(c)].some(hit)) return c.id;
  }
  for (const [key, words] of Object.entries(KEYWORDS)) {
    const c = catByKey(key);
    if (!c || c.type !== type || c.hidden) continue;
    if (words.some(hit)) return c.id;
  }
  return null;
}

// "250 migros bonus" → paid with the Bonus card; "80 taksi nakit" → from the Nakit account.
// Returns the card/account and the description without its name.
export function takePayName(note) {
  const words = note.split(' ').filter(Boolean), cleaned = words.map(clean);
  const cands = [
    ...state.data.cards.map(c => ({ card_id: c.id, name: c.name })),
    ...spendAccounts().map(a => ({ account_id: a.id, name: a.name }))
  ];
  for (const c of cands) {
    const w = clean(c.name).split(' ').filter(Boolean);
    if (!w.length) continue;
    for (let i = 0; i + w.length <= cleaned.length; i++) {
      if (w.every((v, j) => cleaned[i + j] === v)) {
        const { name, ...ids } = c;
        return { ...ids, note: [...words.slice(0, i), ...words.slice(i + w.length)].join(' ') };
      }
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

  let note = s.replace(/\s+/g, ' ').trim();
  const via = takePayName(note);
  if (via && !(via.card_id && type === 'income')) note = via.note;
  let catId = null;
  const learned = learnedCat(note);
  if (learned && (!type || learned.type === type)) { type = learned.type; catId = learned.id; }
  if (!type) { catId = matchCategory(note, 'income'); type = catId ? 'income' : 'expense'; }
  catId = catId || matchCategory(note, type) || fallbackCat(type)?.id || null;
  return {
    raw, type, amount, date,
    note: capFirst(note),
    count: type === 'expense' && count >= 2 && count <= 36 ? count : 1,
    category_id: catId,
    card_id: type === 'expense' && via?.card_id ? via.card_id : null,
    account_id: via?.account_id || null
  };
}
