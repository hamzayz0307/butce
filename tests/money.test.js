import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { state } from '../src/state.js';
import { toBase, fromBase, fmtUnits, altValues } from '../src/money.js';
import { accountValue, netWorth, cardDebt, savedFlow, monthStats } from '../src/model.js';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 9, 20, 12)); // 20 Oct 2026
  state.settings = { ...state.settings, currency: 'TRY', period_start_day: 1, expected_income: 0, rates: { USD: 40, EUR: 46, XAU: 4000 } };
  state.data = { transactions: [], categories: [], bills: [], installments: [], cards: [], goals: [], accounts: [] };
});
afterEach(() => vi.useRealTimers());

describe('conversion', () => {
  it('converts currencies and gold units to TRY', () => {
    expect(toBase(100, 'USD')).toBe(4000);
    expect(toBase(2, 'XAU', 'g24')).toBe(8000);
    expect(toBase(1, 'XAU', 'quarter')).toBe(6431.2);   // 1,6078 g pure gold
    expect(toBase(10, 'GBP')).toBeNull();               // no rate saved
  });
  it('goes back from TRY', () => {
    expect(fromBase(8000, 'USD')).toBe(200);
    expect(fromBase(8000, 'XAU')).toBe(2);
    expect(altValues(8000)).toEqual(['$200', '2 gram altın']);
  });
  it('shows an account in its own unit', () => {
    expect(fmtUnits({ currency: 'XAU', unit: 'quarter' }, 5)).toBe('5 çeyrek');
    expect(fmtUnits({ currency: 'USD' }, 1200)).toBe('$1.200');
  });
});

describe('net worth', () => {
  const bank = { id: 'a1', kind: 'bank', currency: 'TRY', opening_balance: 10000 };
  const usd = { id: 'a2', kind: 'fx', currency: 'USD', opening_balance: 100 };
  const gold = { id: 'a3', kind: 'gold', currency: 'XAU', unit: 'g24', opening_balance: 3 };
  const card = { id: 'c1', name: 'Bonus', statement_day: 8, due_day: 18 };

  it('adds accounts in TRY and subtracts what is owed on cards', () => {
    state.data.accounts = [bank, usd, gold];
    state.data.cards = [card];
    state.data.transactions = [
      { type: 'transfer', amount: 4000, to_amount: 100, account_id: 'a1', to_account_id: 'a2', date: '2026-10-10' },
      { type: 'expense', amount: 1500, card_id: 'c1', date: '2026-10-12' }   // open cycle (closes 8 Nov)
    ];
    state.data.installments = [{ id: 'p1', total: 1200, count: 12, card_id: 'c1', first_month: '2026-06' }];
    expect(accountValue(usd)).toBe(8000);
    // card: 1500 this cycle + the November installment + 6 later ones (Dec 2026 – May 2027)
    expect(cardDebt(card)).toBe(1500 + 100 + 600);
    const nw = netWorth();
    expect(nw.assets).toBe(6000 + 8000 + 12000);
    expect(nw.net).toBe(26000 - 2200);
    expect(nw.missing).toBe(false);
  });

  it('counts an unpaid closed statement until it is paid', () => {
    state.data.cards = [card];
    vi.setSystemTime(new Date(2026, 9, 12, 12)); // between statement (8 Oct) and due date (18 Oct)
    state.data.transactions = [{ type: 'expense', amount: 700, card_id: 'c1', date: '2026-10-01' }];
    expect(cardDebt(card)).toBe(700);
    state.data.transactions.push({ type: 'card_payment', amount: 700, card_id: 'c1', stmt: '2026-10-08', date: '2026-10-12' });
    expect(cardDebt(card)).toBe(0);
  });

  it('flags missing rates instead of guessing', () => {
    state.data.accounts = [{ id: 'a4', kind: 'fx', currency: 'GBP', opening_balance: 50 }];
    expect(netWorth()).toMatchObject({ missing: true, assets: 0 });
  });

  it('counts buying currency as saving and selling as un-saving', () => {
    state.data.accounts = [bank, usd];
    const buy = { type: 'transfer', amount: 4000, to_amount: 100, account_id: 'a1', to_account_id: 'a2', date: '2026-10-10' };
    const sell = { type: 'transfer', amount: 50, to_amount: 2100, account_id: 'a2', to_account_id: 'a1', date: '2026-10-11' };
    expect(savedFlow(buy)).toBe(4000);
    expect(savedFlow(sell)).toBe(-2100);
    state.data.transactions = [buy, sell];
    expect(monthStats('2026-10').saved).toBe(1900);
  });
});
