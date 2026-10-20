import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { state } from '../src/state.js';
import { setLang } from '../src/i18n.js';
import { DEFAULT_CATS } from '../src/constants.js';
import { yearData, topPlaces } from '../src/views/reports.js';
import { exportRows, buildCsv } from '../src/export.js';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 9, 20, 12)); // 20 Oct 2026
  setLang('tr');
  state.settings = { ...state.settings, currency: 'TRY', period_start_day: 1, expected_income: 0 };
  state.data = {
    categories: DEFAULT_CATS.map((c, i) => ({ id: c.key, ...c, sort: i })),
    cards: [{ id: 'c1', name: 'Bonus', statement_day: 8, due_day: 18 }],
    accounts: [{ id: 'a1', name: 'Garanti', kind: 'bank', currency: 'TRY', opening_balance: 0 }],
    goals: [], bills: [], loans: [], debts: [],
    installments: [{ id: 'p1', name: 'Telefon', total: 1200, count: 12, card_id: 'c1', category_id: 'shopping', first_month: '2026-09' }],
    transactions: [
      { id: 't1', type: 'income', amount: 40000, category_id: 'salary', note: 'Maaş', date: '2026-09-01', account_id: 'a1' },
      { id: 't2', type: 'expense', amount: 1000, category_id: 'groceries', note: 'Migros', date: '2026-09-03', account_id: 'a1' },
      { id: 't3', type: 'expense', amount: 500.5, category_id: 'groceries', note: 'migros', date: '2026-10-03', card_id: 'c1' },
      { id: 't4', type: 'expense', amount: 300, category_id: 'food', note: '=HYPERLINK("x")', date: '2026-10-04' },
      { id: 't5', type: 'income', amount: 40000, category_id: 'salary', note: 'Maaş', date: '2026-10-01', account_id: 'a1' },
      { id: 't6', type: 'expense', amount: 99, category_id: 'food', note: 'Kahve', date: '2025-12-30' }
    ]
  };
});
afterEach(() => vi.useRealTimers());

describe('year report', () => {
  it('adds up the months of the year so far, including installments', () => {
    const d = yearData(2026);
    expect(d.months.map(m => m.k)).toEqual(['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10']);
    expect(d.income).toBe(80000);
    expect(d.spent).toBe(1000 + 100 + 500.5 + 300 + 100);  // two installments of 100
    expect(d.byCat.groceries).toBe(1500.5);
  });

  it('groups places regardless of letter case', () => {
    const top = topPlaces(2026);
    expect(top[0]).toMatchObject({ name: 'migros', total: 1500.5, n: 2 });
  });
});

describe('CSV export', () => {
  it('lists entries and billed installments in date order for a year', () => {
    const rows = exportRows(2026);
    expect(rows.map(r => r.type)).toEqual(['income', 'installment', 'expense', 'income', 'installment', 'expense', 'expense']);
    expect(rows.find(r => r.type === 'installment')).toMatchObject({ note: 'Telefon (1/12)', amount: -100, via: 'Bonus' });
    expect(exportRows().length).toBe(8);
  });

  it('uses ; and decimal commas in Turkish, and blocks formulas', () => {
    const csv = buildCsv(exportRows(2026), 'tr');
    const lines = csv.replace('﻿', '').trim().split('\r\n');
    expect(csv.startsWith('﻿')).toBe(true);
    expect(lines[0]).toBe('Tarih;Tür;Kategori;Açıklama;Tutar;Hesap / kart');
    expect(lines).toContain('2026-10-03;Gider;Market;migros;-500,50;Bonus');
    expect(lines.find(l => l.includes('HYPERLINK'))).toBe('2026-10-04;Gider;Yeme içme;"\'=HYPERLINK(""x"")";-300,00;');
  });

  it('uses , and decimal points in English', () => {
    setLang('en');
    const csv = buildCsv(exportRows(2026), 'en');
    expect(csv).toContain('2026-10-03,Expense,Groceries,migros,-500.50,Bonus');
  });
});
