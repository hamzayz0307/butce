import { describe, it, expect, beforeEach } from 'vitest';
import { state } from '../src/state.js';
import { DEFAULT_CATS } from '../src/constants.js';
import { searchTx } from '../src/views/activity.js';

beforeEach(() => {
  state.data = {
    categories: DEFAULT_CATS.map((c, i) => ({ id: c.key, ...c, sort: i })),
    cards: [{ id: 'c1', name: 'Bonus', statement_day: 8, due_day: 18 }],
    goals: [], bills: [], accounts: [],
    installments: [{ id: 'p1', name: 'Telefon', total: 36000, count: 12, card_id: 'c1', category_id: 'shopping', first_month: '2026-06' }],
    transactions: [
      { id: 't1', type: 'expense', amount: 250, category_id: 'groceries', note: 'Migros', date: '2025-12-03' },
      { id: 't2', type: 'expense', amount: 1420, category_id: 'groceries', note: 'Migros', date: '2026-10-15', card_id: 'c1' },
      { id: 't3', type: 'income', amount: 42000, category_id: 'salary', note: 'Maaş', date: '2026-10-01' },
      { id: 't4', type: 'expense', amount: 250, category_id: 'food', note: 'Yemeksepeti', date: '2026-09-09' }
    ]
  };
});

describe('search across all months', () => {
  it('finds entries in every month, newest first', () => {
    const { txs } = searchTx('migros');
    expect(txs.map(x => x.id)).toEqual(['t2', 't1']);
  });

  it('matches category and card names', () => {
    expect(searchTx('market').txs).toHaveLength(2);       // "Market" category
    expect(searchTx('bonus').txs.map(x => x.id)).toEqual(['t2']);
    expect(searchTx('bonus').plans.map(p => p.id)).toEqual(['p1']);
  });

  it('matches an exact amount', () => {
    expect(searchTx('250').txs.map(x => x.id)).toEqual(['t4', 't1']);
    expect(searchTx('36.000').plans).toHaveLength(1);
  });

  it('respects the type and category filters', () => {
    expect(searchTx('a', { type: 'income' }).txs.map(x => x.id)).toEqual(['t3']);
    expect(searchTx('250', { cat: 'food' }).txs.map(x => x.id)).toEqual(['t4']);
  });
});
