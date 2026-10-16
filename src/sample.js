// Sample data so the app can be tried right away. Dates are relative to today.
import { state, catByKey } from './state.js';
import { store } from './store.js';
import { t } from './i18n.js';
import { pad, curMonth, addMonths, daysInMonth } from './utils.js';
import { refresh, done, ensureCategories } from './actions.js';

const BILLS = [
  ['Kira', 15000, 3, 'rent'], ['Spor salonu', 1200, 1, 'health'], ['Netflix', 230, 11, 'subscriptions'],
  ['Elektrik', 780, 14, 'bills'], ['Spotify', 100, 16, 'subscriptions'], ['Doğalgaz', 1100, 20, 'bills'],
  ['İnternet', 450, 24, 'bills'], ['Telefon faturası', 390, 27, 'bills']
];

// [day, category, note, amount] — one month of everyday spending
const MONTH = [
  [1, 'groceries', 'Migros', 1240], [2, 'food', 'Kahve', 145], [2, 'transport', 'İstanbulkart', 500], [4, 'food', 'Yemeksepeti', 420],
  [5, 'groceries', 'BİM', 380], [6, 'food', 'Öğle yemeği', 280], [7, 'fun', 'Sinema', 360], [8, 'transport', 'BiTaksi', 240],
  [9, 'food', 'Yemeksepeti', 510], [10, 'groceries', 'A101', 290], [11, 'education', 'Kitap', 310], [12, 'food', 'Kahve', 160],
  [13, 'shopping', 'Trendyol', 780], [14, 'food', 'Akşam yemeği', 950], [15, 'groceries', 'Migros', 1420], [15, 'transport', 'İstanbulkart', 500],
  [17, 'food', 'Yemeksepeti', 460], [18, 'health', 'Eczane', 240], [19, 'food', 'Kahve', 150], [20, 'groceries', 'Manav', 260],
  [21, 'fun', 'Konser', 900], [22, 'food', 'Öğle yemeği', 310], [23, 'transport', 'Uber', 330], [24, 'groceries', 'Şok', 340],
  [25, 'food', 'Yemeksepeti', 540], [26, 'shopping', 'Zara', 1290], [27, 'food', 'Kahve', 140], [28, 'groceries', 'Migros', 1180],
  [29, 'fun', 'Steam', 420], [30, 'food', 'Kahvaltı', 480]
];
// Last month was a bit different, so "compared to last month" has something to say
const PREV_FACTOR = { food: 0.72, transport: 1.25 };

export async function loadSample() {
  await store.wipe({ keepSettings: true });
  await refresh(); await ensureCategories();
  await store.saveSettings({ expected_income: 42000 });
  const K = key => catByKey(key).id;
  const now = new Date(), k0 = curMonth(), k1 = addMonths(k0, -1), k2 = addMonths(k0, -2), dToday = now.getDate();
  const day = (key, d) => `${key}-${pad(Math.min(d, daysInMonth(key)))}`;

  const bonus = await store.insert('cards', { name: 'Bonus', statement_day: 8, due_day: 18, limit: 60000 });
  const world = await store.insert('cards', { name: 'World', statement_day: 22, due_day: 2, limit: 40000 });

  const bills = [];
  for (const [name, amount, d, key] of BILLS) bills.push(await store.insert('bills', { name, amount, day: d, category_id: K(key), start_month: k2 }));

  for (const key of [k1, k0]) {
    const isCur = key === k0;
    await store.insert('transactions', { type: 'income', amount: 42000, category_id: K('salary'), note: 'Maaş', date: day(key, 1), card_id: null });
    for (const [d, ck, note, amt] of MONTH) {
      if ((isCur && d > dToday) || d > daysInMonth(key)) continue;
      const amount = isCur ? amt : Math.round(amt * (PREV_FACTOR[ck] || 1) / 5) * 5;
      const card = ['shopping', 'fun'].includes(ck) ? bonus.id : (ck === 'groceries' && d % 2 ? world.id : null);
      await store.insert('transactions', { type: 'expense', amount, category_id: K(ck), note, date: day(key, d), card_id: card });
    }
    for (const b of bills) {
      if (isCur && b.day >= dToday) continue;
      await store.insert('transactions', { type: 'expense', amount: b.amount, category_id: b.category_id, note: b.name, date: day(key, b.day), bill_id: b.id, bill_month: key, card_id: null });
    }
  }

  await store.insert('installments', { name: 'Telefon', total: 36000, count: 12, card_id: bonus.id, category_id: K('shopping'), purchase_date: day(addMonths(k0, -4), 6), first_month: addMonths(k0, -4) });
  await store.insert('installments', { name: 'Kulaklık', total: 6000, count: 6, card_id: world.id, category_id: K('shopping'), purchase_date: day(k1, 12), first_month: k1 });
  await store.insert('installments', { name: 'Mont', total: 4500, count: 3, card_id: bonus.id, category_id: K('shopping'), purchase_date: day(k0, Math.min(dToday, 5)), first_month: k0 });

  const laptop = await store.insert('goals', { name: 'Yeni laptop', emoji: '💻', target: 45000, initial_saved: 12000, deadline: addMonths(k0, 7) });
  const julyOffset = ((7 - (now.getMonth() + 1)) + 12) % 12 || 12;
  const trip = await store.insert('goals', { name: 'Yaz tatili', emoji: '🏖️', target: 20000, initial_saved: 4000, deadline: addMonths(k0, julyOffset) });
  await store.insert('transactions', { type: 'saving', amount: 2000, goal_id: laptop.id, note: laptop.name, category_id: null, date: day(k1, 2) });
  await store.insert('transactions', { type: 'saving', amount: 1000, goal_id: trip.id, note: trip.name, category_id: null, date: day(k1, 2) });
  await store.insert('transactions', { type: 'saving', amount: 2000, goal_id: laptop.id, note: laptop.name, category_id: null, date: day(k0, Math.min(2, dToday)) });

  await refresh();
  for (const [key, lim] of [['groceries', 6000], ['food', 3000], ['fun', 2000], ['shopping', 6000]]) {
    await store.update('categories', K(key), { monthly_limit: lim });
  }
  state.month = k0;
  state.tab = 'home';
  await done(t('sample_loaded'));
}
