import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { state } from '../src/state.js';
import {
  portionFor, planRemaining, firstMonthFor, nextStatement, dueFor, statementAmount, monthStats, goalSaved
} from '../src/model.js';

const bonus = { id: 'c1', name: 'Bonus', statement_day: 8, due_day: 18 };
const world = { id: 'c2', name: 'World', statement_day: 22, due_day: 2 };

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 9, 16, 12)); // 16 Oct 2026
  state.data = { transactions: [], categories: [], bills: [], installments: [], cards: [bonus, world], goals: [] };
  state.settings = { ...state.settings, expected_income: 10000 };
});
afterEach(() => vi.useRealTimers());

describe('installments', () => {
  it('splits the total and puts rounding on the last one', () => {
    const plan = { total: 1000, count: 3, first_month: '2026-10' };
    const parts = ['2026-10', '2026-11', '2026-12'].map(k => portionFor(plan, k).amount);
    expect(parts).toEqual([333.33, 333.33, 333.34]);
    expect(portionFor(plan, '2026-09')).toBeNull();
    expect(portionFor(plan, '2027-01')).toBeNull();
  });

  it('counts what is still to pay after a month', () => {
    const plan = { total: 6000, count: 6, first_month: '2026-09' };
    expect(planRemaining(plan, '2026-10')).toBe(4000);
  });

  it('moves the first installment after the statement day', () => {
    expect(firstMonthFor('c1', '2026-10-05')).toBe('2026-10');
    expect(firstMonthFor('c1', '2026-10-16')).toBe('2026-11');
    expect(firstMonthFor(null, '2026-10-16')).toBe('2026-10');
  });
});

describe('credit cards', () => {
  it('finds the next statement and its due date', () => {
    expect(nextStatement(bonus, '2026-10-16')).toBe('2026-11-08');
    expect(dueFor(bonus, '2026-11-08')).toBe('2026-11-18');
    expect(dueFor(world, '2026-10-22')).toBe('2026-11-02');
  });

  it('clamps day 31 to short months', () => {
    expect(nextStatement({ statement_day: 31, due_day: 10 }, '2026-11-01')).toBe('2026-11-30');
  });

  it('adds card spending in the cycle and that month\'s installments', () => {
    state.data.transactions = [
      { type: 'expense', amount: 500, card_id: 'c1', date: '2026-10-10' },
      { type: 'expense', amount: 300, card_id: 'c1', date: '2026-10-08' } // previous cycle
    ];
    state.data.installments = [{ total: 3000, count: 3, card_id: 'c1', first_month: '2026-11' }];
    expect(statementAmount(bonus, '2026-11-08')).toBe(1500);
  });
});

describe('month totals', () => {
  it('subtracts spending, installments, savings and unpaid bills from income', () => {
    state.data.transactions = [
      { type: 'expense', amount: 1000, category_id: 'food', date: '2026-10-03' },
      { type: 'saving', amount: 500, goal_id: 'g1', date: '2026-10-04' }
    ];
    state.data.installments = [{ total: 3000, count: 3, category_id: 'shopping', first_month: '2026-10' }];
    state.data.bills = [{ id: 'b1', amount: 700, day: 20, start_month: '2026-01' }];
    const st = monthStats('2026-10');
    expect(st).toMatchObject({ rel: 'current', income: 10000, spent: 2000, saved: 500, pending: 700, remaining: 6800 });
  });

  it('uses logged income when it is higher than expected', () => {
    state.data.transactions = [{ type: 'income', amount: 12000, date: '2026-10-01' }];
    expect(monthStats('2026-10')).toMatchObject({ income: 12000, usesExpected: false });
  });

  it('adds deposits to a goal and subtracts withdrawals', () => {
    state.data.transactions = [
      { type: 'saving', amount: 2000, goal_id: 'g1', date: '2026-09-02' },
      { type: 'saving', amount: -500, goal_id: 'g1', date: '2026-10-02' }
    ];
    expect(goalSaved({ id: 'g1', initial_saved: 1000 })).toBe(2500);
  });
});
