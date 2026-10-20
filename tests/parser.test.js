import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { state } from '../src/state.js';
import { DEFAULT_CATS } from '../src/constants.js';
import { parseOne, parseQuick } from '../src/parser.js';
import { toNumber } from '../src/utils.js';

const keyOf = r => state.data.categories.find(c => c.id === r.category_id)?.key;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 9, 16, 12)); // 16 Oct 2026
  state.data.categories = DEFAULT_CATS.map((c, i) => ({ id: c.key, ...c, sort: i }));
});
afterEach(() => vi.useRealTimers());

describe('toNumber', () => {
  it.each([
    ['1.250,50', 1250.5], ['1250.5', 1250.5], ['1,5k', 1500], ['12 bin', 12000],
    ['1,250', 1250], ['12,5', 12.5], ['1.250', 1250], ['42000', 42000]
  ])('%s → %d', (input, out) => expect(toNumber(input)).toBe(out));

  it('returns NaN when there is no number', () => expect(toNumber('abc')).toBeNaN());
});

describe('quick entry', () => {
  it('reads an expense and guesses the category', () => {
    const r = parseOne('250 market');
    expect(r).toMatchObject({ type: 'expense', amount: 250, count: 1, date: '2026-10-16' });
    expect(keyOf(r)).toBe('groceries');
  });

  it('treats + and income words as income', () => {
    expect(parseOne('+42000 maaş')).toMatchObject({ type: 'income' });
    expect(keyOf(parseOne('5000 burs'))).toBe('scholarship');
  });

  it('reads installments with the total price', () => {
    const r = parseOne('12000 telefon 6 taksit');
    expect(r).toMatchObject({ amount: 12000, count: 6 });
    expect(keyOf(r)).toBe('shopping');
  });

  it('prefers the more specific phrase', () => {
    expect(keyOf(parseOne('telefon faturası 390'))).toBe('bills');
    expect(keyOf(parseOne('netflix 230'))).toBe('subscriptions');
  });

  it('folds Turkish letters', () => {
    expect(keyOf(parseOne('ŞOK 120'))).toBe('groceries');
    expect(keyOf(parseOne('İstanbulkart 500'))).toBe('transport');
  });

  it('backdates with "dün"', () => {
    expect(parseOne('yemeksepeti 420 dün').date).toBe('2026-10-15');
  });

  it('flags entries without an amount', () => {
    expect(parseOne('kahve')).toMatchObject({ error: true });
  });

  it('splits on commas, new lines and "ve"', () => {
    const items = parseQuick('250 market, 80 taksi\n30 kahve ve 100 sinema');
    expect(items).toHaveLength(4);
    expect(items.map(keyOf)).toEqual(['groceries', 'transport', 'food', 'fun']);
  });
});

describe('custom categories in quick entry', () => {
  const addCat = c => { state.data.categories.push({ type: 'expense', emoji: '🐾', color: '#7C8A85', sort: 99, ...c }); };

  it('uses the user’s own words first', () => {
    addCat({ id: 'pets', key: null, name: 'Evcil hayvan', keywords: ['kedi', 'mama', 'veteriner'] });
    expect(parseOne('120 kedi maması').category_id).toBe('pets');
    expect(parseOne('350 veteriner').category_id).toBe('pets');
  });

  it('matches a category by its name', () => {
    addCat({ id: 'pets', key: null, name: 'Kedi & Köpek' });
    expect(parseOne('kedi köpek 80').category_id).toBe('pets');
    expect(keyOf(parseOne('100 sağlık'))).toBe('health');
  });

  it('skips hidden categories and falls back to Other', () => {
    state.data.categories.find(c => c.key === 'transport').hidden = true;
    expect(keyOf(parseOne('80 taksi'))).toBe('other');
  });

  it('remembers a correction for the same description', async () => {
    const { rememberCats } = await import('../src/parser.js');
    state.settings = { ...state.settings, quick_memory: rememberCats([{ note: 'Kedi maması', category_id: 'shopping' }]) };
    expect(parseOne('120 kedi maması').category_id).toBe('shopping');
    state.settings = { ...state.settings, quick_memory: {} };
  });

  it('keeps the memory to a fixed size, dropping the oldest', async () => {
    const { rememberCats } = await import('../src/parser.js');
    state.settings = { ...state.settings, quick_memory: {} };
    const items = Array.from({ length: 310 }, (_, i) => ({ note: 'not ' + i, category_id: 'food' }));
    const mem = rememberCats(items);
    expect(Object.keys(mem)).toHaveLength(300);
    expect(mem['not 0']).toBeUndefined();
    expect(mem['not 309']).toBe('food');
  });
});
