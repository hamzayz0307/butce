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
