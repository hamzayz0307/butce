// In-memory app state (a copy of what's in the store) plus simple lookups.
import { TABLES } from './store.js';
import { t } from './i18n.js';
import { curMonth } from './utils.js';

const browserLang = typeof navigator !== 'undefined' ? (navigator.language || 'tr') : 'tr';

export const DEFAULT_SETTINGS = {
  lang: browserLang.toLowerCase().startsWith('tr') ? 'tr' : 'en',
  currency: 'TRY',
  expected_income: null,
  usd_rate: null,
  default_card_id: null
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
export const catsOf = type => state.data.categories.filter(c => c.type === type).sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
export const cardById = id => state.data.cards.find(c => c.id === id);
export const goalById = id => state.data.goals.find(g => g.id === id);
export const defaultCard = () => state.data.cards.find(c => c.id === state.settings.default_card_id) || state.data.cards[0] || null;
