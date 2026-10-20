// In-memory app state (a copy of what's in the store) plus simple lookups.
import { TABLES } from './store.js';
import { t } from './i18n.js';
import { curMonth } from './utils.js';
import { FALLBACK_KEYS } from './constants.js';

const browserLang = typeof navigator !== 'undefined' ? (navigator.language || 'tr') : 'tr';

export const DEFAULT_SETTINGS = {
  lang: browserLang.toLowerCase().startsWith('tr') ? 'tr' : 'en',
  currency: 'TRY',
  expected_income: null,
  usd_rate: null,
  default_card_id: null,
  default_account_id: null
};

export const state = {
  data: Object.fromEntries(TABLES.map(tb => [tb, []])),
  settings: { ...DEFAULT_SETTINGS },
  // UI state
  tab: 'home',
  month: curMonth(),
  payTab: 'bills',
  txFilter: { q: '', type: 'all', cat: null },
  barSel: null,
  quickItems: [],
  quickOverrides: {}
};

export const catById = id => state.data.categories.find(c => c.id === id);
export const catByKey = key => state.data.categories.find(c => c.key === key);
export const catName = c => (c ? (c.name || t('cat_' + c.key)) : t('cat_other'));
const isFallback = c => c.key === FALLBACK_KEYS[c.type];
// Categories of a type in display order; "Other" always last
export const catsOf = type => state.data.categories.filter(c => c.type === type)
  .sort((a, b) => (isFallback(a) - isFallback(b)) || ((a.sort ?? 0) - (b.sort ?? 0)));
export const visibleCatsOf = type => catsOf(type).filter(c => !c.hidden);
export const fallbackCat = type => catByKey(FALLBACK_KEYS[type]);
export const cardById = id => state.data.cards.find(c => c.id === id);
export const goalById = id => state.data.goals.find(g => g.id === id);
export const accountById = id => state.data.accounts.find(a => a.id === id);
export const accountsList = () => [...state.data.accounts].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
export const ACC_EMOJI = { cash: '💵', bank: '🏦', savings: '🐖', fx: '💱', gold: '🪙' };
export const accEmoji = a => ACC_EMOJI[a?.kind] || '🏦';
// Money set aside: transfers into these count as savings in the budget
export const isSavingAcc = a => !!a && a.kind !== 'cash' && a.kind !== 'bank';
// Accounts that everyday income and spending can use
export const spendAccounts = () => accountsList().filter(a => !isSavingAcc(a));
// Used for quick entry and bills marked as paid: the chosen default, else the first cash/bank account
export const defaultAccount = () => {
  const a = accountById(state.settings.default_account_id);
  return a && !isSavingAcc(a) ? a : spendAccounts()[0] || null;
};
export const defaultCard = () => state.data.cards.find(c => c.id === state.settings.default_card_id) || state.data.cards[0] || null;
