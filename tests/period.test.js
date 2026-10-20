import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { state } from '../src/state.js';
import {
  periodStart, periodEnd, periodOf, curPeriod, dueInPeriod, dayInPeriod, periodLength, periodRange
} from '../src/period.js';
import { monthStats, billDue, spentByCatUpTo } from '../src/model.js';

const setStart = d => { state.settings = { ...state.settings, period_start_day: d, expected_income: 10000 }; };

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 9, 20, 12)); // 20 Oct 2026
  state.data = { transactions: [], categories: [], bills: [], installments: [], cards: [], goals: [], accounts: [] };
});
afterEach(() => vi.useRealTimers());

describe('calendar months (start day 1)', () => {
  beforeEach(() => setStart(1));
  it('matches calendar months', () => {
    expect(periodStart('2026-10')).toBe('2026-10-01');
    expect(periodEnd('2026-10')).toBe('2026-10-31');
    expect(periodEnd('2026-02')).toBe('2026-02-28');
    expect(periodOf('2026-10-31')).toBe('2026-10');
    expect(periodRange('2026-10')).toBe('');
  });
});

describe('payday periods (start day 15)', () => {
  beforeEach(() => setStart(15));

  it('runs from the 15th to the 14th', () => {
    expect(periodStart('2026-10')).toBe('2026-10-15');
    expect(periodEnd('2026-10')).toBe('2026-11-14');
    expect(periodEnd('2026-12')).toBe('2027-01-14');
    expect(periodLength('2026-10')).toBe(31);
  });

  it('puts dates in the right period', () => {
    expect(periodOf('2026-10-14')).toBe('2026-09');
    expect(periodOf('2026-10-15')).toBe('2026-10');
    expect(periodOf('2027-01-03')).toBe('2026-12');
    expect(curPeriod()).toBe('2026-10');
    expect(dayInPeriod('2026-10-20', '2026-10')).toBe(6);
  });

  it('places monthly due days inside the period', () => {
    expect(dueInPeriod(3, '2026-10')).toBe('2026-11-03');
    expect(dueInPeriod(20, '2026-10')).toBe('2026-10-20');
    expect(dueInPeriod(31, '2026-10')).toBe('2026-10-31');
    expect(dueInPeriod(30, '2027-01')).toBe('2027-01-30');
    expect(dueInPeriod(31, '2026-11')).toBe('2026-11-30');
  });

  it('adds the year to the range when it changes', () => {
    expect(periodRange('2026-12')).toMatch(/2027$/);
  });

  it('totals only what falls inside the period', () => {
    state.data.transactions = [
      { type: 'expense', amount: 100, category_id: 'food', date: '2026-10-14' }, // previous period
      { type: 'expense', amount: 200, category_id: 'food', date: '2026-10-15' },
      { type: 'expense', amount: 300, category_id: 'food', date: '2026-11-14' }
    ];
    state.data.bills = [{ id: 'b1', amount: 1000, day: 3, start_month: '2026-01' }];
    const st = monthStats('2026-10');
    expect(st).toMatchObject({ rel: 'current', spent: 500, pending: 1000, remaining: 8500 });
    expect(billDue(state.data.bills[0], '2026-10')).toBe('2026-11-03');
  });

  it('compares the same number of days into each period', () => {
    state.data.transactions = [
      { type: 'expense', amount: 50, category_id: 'food', date: '2026-09-17' },  // day 3 of Sep period
      { type: 'expense', amount: 70, category_id: 'food', date: '2026-09-25' }   // day 11
    ];
    expect(spentByCatUpTo('2026-09', 6)).toEqual({ food: 50 });
  });
});

describe('bill payments across a start-day change', () => {
  it('does not count an old payment for the new due date', async () => {
    const { billPaidTx } = await import('../src/model.js');
    const bill = { id: 'b1', amount: 1000, day: 3, start_month: '2026-01' };
    state.data.bills = [bill];
    state.data.transactions = [{ type: 'expense', amount: 1000, bill_id: 'b1', bill_month: '2026-10', date: '2026-10-03' }];
    setStart(1);
    expect(billPaidTx(bill, '2026-10')).toBeTruthy();
    setStart(15);
    expect(billPaidTx(bill, '2026-10')).toBeUndefined(); // now due 3 Nov
    state.data.transactions.push({ type: 'expense', amount: 1000, bill_id: 'b1', bill_month: '2026-10', bill_due: '2026-11-03', date: '2026-11-02' });
    expect(billPaidTx(bill, '2026-10')).toBeTruthy();
  });
});

describe('late start days (25) name the period after the next month', () => {
  beforeEach(() => setStart(25));
  it('calls 25 Sep – 24 Oct "October"', () => {
    expect(periodOf('2026-10-20')).toBe('2026-10');
    expect(periodOf('2026-10-25')).toBe('2026-11');
    expect(periodStart('2026-10')).toBe('2026-09-25');
    expect(periodEnd('2026-10')).toBe('2026-10-24');
    expect(curPeriod()).toBe('2026-10');
  });
  it('places due days inside the period', () => {
    expect(dueInPeriod(28, '2026-10')).toBe('2026-09-28');
    expect(dueInPeriod(3, '2026-10')).toBe('2026-10-03');
  });
});
