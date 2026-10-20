import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { state } from '../src/state.js';
import {
  loanDue, loanPaymentIn, loanLeft, monthStats, netWorth, upcomingItems, debtLeft, accountBalance
} from '../src/model.js';
import { loanPayment, LOAN_TAX } from '../src/model.js';

const loan = { id: 'l1', name: 'İhtiyaç', payment: 3450, count: 24, first_date: '2026-05-31', category_id: 'loan' };

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 9, 20, 12)); // 20 Oct 2026
  state.settings = { ...state.settings, currency: 'TRY', period_start_day: 1, expected_income: 50000, rates: {} };
  state.data = { transactions: [], categories: [], bills: [], installments: [], cards: [], goals: [], accounts: [], loans: [loan], debts: [] };
});
afterEach(() => vi.useRealTimers());

describe('bank loans', () => {
  it('schedules payments on the same day each month, clamped to short months', () => {
    expect(loanDue(loan, 0)).toBe('2026-05-31');
    expect(loanDue(loan, 1)).toBe('2026-06-30');
    expect(loanDue(loan, 9)).toBe('2027-02-28');
  });

  it('finds the payment that falls in a period', () => {
    expect(loanPaymentIn(loan, '2026-10')).toEqual({ index: 6, due: '2026-10-31', amount: 3450 });
    expect(loanPaymentIn(loan, '2026-04')).toBeNull();
    state.settings.period_start_day = 15;                       // 15 Oct – 14 Nov
    expect(loanPaymentIn(loan, '2026-10').due).toBe('2026-10-31');
  });

  it('treats earlier payments as made and counts what is left', () => {
    expect(loanLeft(loan)).toEqual({ count: 19, amount: 19 * 3450, paid: 5 });
    state.data.transactions = [{ type: 'expense', amount: 3450, loan_id: 'l1', loan_due: '2026-10-31', date: '2026-10-20' }];
    expect(loanLeft(loan).count).toBe(18);
  });

  it('sets the unpaid payment aside in the budget and shows it as coming up', () => {
    vi.setSystemTime(new Date(2026, 9, 25, 12));
    expect(monthStats('2026-10')).toMatchObject({ pending: 3450, remaining: 50000 - 3450 });
    expect(upcomingItems().map(i => i.kind)).toContain('loan');
  });

  it('calculates an annuity payment with Turkish loan taxes', () => {
    expect(loanPayment(12000, 0, 12)).toBe(1000);
    // 60.000 TL, 24 months, 3,29% monthly + KKDF/BSMV (×1,30) = 4,277% per month
    expect(loanPayment(60000, 0.0329 * (1 + LOAN_TAX.consumer), 24)).toBeCloseTo(4047.6, 1);
    expect(loanPayment(60000, 0.0329 * (1 + LOAN_TAX.housing), 24)).toBeCloseTo(3654.43, 1);
  });

  it('subtracts what is left on loans from net worth', () => {
    expect(netWorth()).toMatchObject({ assets: 0, liabilities: 19 * 3450 });
  });
});

describe('personal debts', () => {
  const ali = { id: 'd1', person: 'Ali', direction: 'lent', amount: 1500, date: '2026-09-20', due_date: '2026-10-30' };
  const ayse = { id: 'd2', person: 'Ayşe', direction: 'borrowed', amount: 800, date: '2026-10-02', due_date: '2026-10-25' };
  beforeEach(() => {
    state.data.loans = [];
    state.data.debts = [ali, ayse];
    state.data.accounts = [{ id: 'a1', kind: 'cash', currency: 'TRY', opening_balance: 2000 }];
    state.data.transactions = [
      { type: 'debt', debt_id: 'd1', repayment: false, amount: -1500, date: '2026-09-20', account_id: 'a1' },
      { type: 'debt', debt_id: 'd2', repayment: false, amount: 800, date: '2026-10-02', account_id: 'a1' },
      { type: 'debt', debt_id: 'd2', repayment: true, amount: -300, date: '2026-10-10', account_id: 'a1' },
      { type: 'debt', debt_id: 'd1', repayment: true, amount: 500, date: '2026-10-12', account_id: 'a1' }
    ];
  });

  it('tracks what is still owed', () => {
    expect(debtLeft(ali)).toBe(1000);
    expect(debtLeft(ayse)).toBe(500);
  });

  it('moves money in the budget and the account without counting as spending or income', () => {
    expect(monthStats('2026-10')).toMatchObject({ spent: 0, actualIncome: 0, debtNet: 1000 });
    expect(accountBalance(state.data.accounts[0])).toBe(2000 - 1500 + 800 - 300 + 500);
  });

  it('adds money owed to me and subtracts what I owe in net worth', () => {
    const nw = netWorth();
    expect(nw.parts).toMatchObject({ lent: 1000, borrowed: 500 });
    expect(nw.net).toBe(1500 + 1000 - 500);
  });

  it('lists debts I owe that are due soon', () => {
    expect(upcomingItems().filter(i => i.kind === 'debt').map(i => i.d.person)).toEqual(['Ayşe']);
  });
});
