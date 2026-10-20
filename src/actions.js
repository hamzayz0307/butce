// Everything that changes data: form saves, deletes, bill payments, backup, rates.
import { state, DEFAULT_SETTINGS, catById, catName, catsOf, goalById, defaultCard } from './state.js';
import { store, TABLES } from './store.js';
import { t, setLang, LANG } from './i18n.js';
import { today, curMonth, r2, toNumber } from './utils.js';
import { curPeriod } from './period.js';
import { numIn } from './format.js';
import { DEFAULT_CATS } from './constants.js';
import { billDue, billPaidTx, firstMonthFor } from './model.js';
import { formErr } from './forms.js';
import { closeSheet, toast } from './sheet.js';
import { render } from './render.js';

export async function refresh() {
  for (const tb of TABLES) state.data[tb] = await store.list(tb);
  state.settings = { ...DEFAULT_SETTINGS, ...(await store.getSettings()) };
  setLang(state.settings.lang);
}

export async function done(msg) {
  closeSheet();
  await refresh();
  render();
  if (msg) toast(msg);
}

// Make sure the built-in categories exist (first run, after restore or wipe).
export async function ensureCategories() {
  const have = new Set(state.data.categories.map(c => c.key));
  let added = false;
  for (const [i, c] of DEFAULT_CATS.entries()) {
    if (have.has(c.key)) continue;
    await store.insert('categories', { key: c.key, name: null, emoji: c.emoji, color: c.color, type: c.type, monthly_limit: null, sort: i });
    added = true;
  }
  if (added) await refresh();
}

/* ---------- Form submit handlers (keyed by data-form) ---------- */
export const FORMS = {
  async tx(f) {
    const id = f.dataset.id, type = f.type.value, amount = toNumber(f.amount.value);
    if (!(amount > 0)) return formErr(f, t('err_amount'));
    const row = { type, amount, category_id: f.category_id.value, note: f.note.value.trim(), date: f.date.value || today() };
    if (id) { await store.update('transactions', id, row); return done(t('saved')); }
    const cardId = f.card_id ? (f.card_id.value || null) : null;
    const count = f.count && !f.count.disabled ? Number(f.count.value) : 1;
    if (type === 'expense' && cardId && count > 1) {
      await store.insert('installments', {
        name: row.note || catName(catById(row.category_id)), total: amount, count, card_id: cardId,
        category_id: row.category_id, purchase_date: row.date, first_month: firstMonthFor(cardId, row.date)
      });
    } else {
      await store.insert('transactions', { ...row, card_id: type === 'expense' ? cardId : null });
    }
    done(t('saved'));
  },

  async saving(f) {
    const amount = toNumber(f.amount.value);
    if (!(amount > 0)) return formErr(f, t('err_amount'));
    const x = state.data.transactions.find(v => v.id === f.dataset.id);
    await store.update('transactions', f.dataset.id, { amount: x && x.amount < 0 ? -amount : amount, date: f.date.value || today() });
    done(t('saved'));
  },

  async bill(f) {
    const name = f.name.value.trim(), amount = toNumber(f.amount.value), day = Number(f.day.value);
    if (!name) return formErr(f, t('err_name'));
    if (!(amount > 0)) return formErr(f, t('err_amount'));
    if (!(day >= 1 && day <= 31)) return formErr(f, t('err_day'));
    const row = { name, amount, day, category_id: f.category_id.value };
    if (f.dataset.id) await store.update('bills', f.dataset.id, row);
    else await store.insert('bills', { ...row, start_month: curPeriod() });
    done(t('saved'));
  },

  async inst(f) {
    const name = f.name.value.trim(), total = toNumber(f.total.value), count = Number(f.count.value);
    if (!name) return formErr(f, t('err_name'));
    if (!(total > 0)) return formErr(f, t('err_amount'));
    if (!(count >= 2 && count <= 36)) return formErr(f, t('err_count'));
    const row = {
      name, total, count, card_id: f.card_id.value || null, category_id: f.category_id.value,
      purchase_date: f.purchase_date.value || today(), first_month: f.first_month.value || curMonth()
    };
    if (f.dataset.id) await store.update('installments', f.dataset.id, row);
    else await store.insert('installments', row);
    done(t('saved'));
  },

  async card(f) {
    const name = f.name.value.trim(), sd = Number(f.statement_day.value), dd = Number(f.due_day.value);
    if (!name) return formErr(f, t('err_name'));
    if (!(sd >= 1 && sd <= 31 && dd >= 1 && dd <= 31)) return formErr(f, t('err_day'));
    const lim = toNumber(f.limit.value);
    const row = { name, statement_day: sd, due_day: dd, limit: lim > 0 ? lim : null };
    if (f.dataset.id) await store.update('cards', f.dataset.id, row);
    else await store.insert('cards', row);
    done(t('saved'));
  },

  async goal(f) {
    const name = f.name.value.trim(), target = toNumber(f.target.value), init = toNumber(f.initial_saved.value);
    if (!name) return formErr(f, t('err_name'));
    if (!(target > 0)) return formErr(f, t('err_amount'));
    const row = { name, target, initial_saved: init > 0 ? init : 0, deadline: f.deadline.value || null, emoji: f.emoji.value || '🎯' };
    if (f.dataset.id) await store.update('goals', f.dataset.id, row);
    else await store.insert('goals', row);
    done(t('saved'));
  },

  async goalmoney(f) {
    const amount = toNumber(f.amount.value);
    if (!(amount > 0)) return formErr(f, t('err_amount'));
    const g = goalById(f.dataset.id);
    await store.insert('transactions', {
      type: 'saving', amount: f.dir.value === 'out' ? -amount : amount, goal_id: g.id, note: g.name,
      category_id: null, date: f.date.value || today()
    });
    done(t('saved'));
  },

  async limits(f) {
    for (const c of catsOf('expense')) {
      const v = toNumber(f['lim_' + c.id].value);
      const val = v > 0 ? v : null;
      if ((c.monthly_limit || null) !== val) await store.update('categories', c.id, { monthly_limit: val });
    }
    done(t('saved'));
  }
};

/* ---------- Quick entry save ---------- */
export async function saveQuick() {
  const items = state.quickItems.filter(x => !x.error);
  if (!items.length) return;
  const card = defaultCard();
  for (const x of items) {
    if (x.count > 1) {
      await store.insert('installments', {
        name: x.note || catName(catById(x.category_id)), total: x.amount, count: x.count, card_id: card?.id || null,
        category_id: x.category_id, purchase_date: x.date, first_month: firstMonthFor(card?.id, x.date)
      });
    } else {
      await store.insert('transactions', { type: x.type, amount: x.amount, category_id: x.category_id, note: x.note, date: x.date, card_id: null });
    }
  }
  await done(t('added_n', { n: items.length }));
}

/* ---------- Deletes ---------- */
export async function removeItem(kind, id) {
  if (kind === 'tx') await store.remove('transactions', id);
  if (kind === 'bill') await store.remove('bills', id); // paid entries stay in history
  if (kind === 'inst') await store.remove('installments', id);
  if (kind === 'card') {
    for (const x of state.data.transactions.filter(v => v.card_id === id)) await store.update('transactions', x.id, { card_id: null });
    for (const p of state.data.installments.filter(v => v.card_id === id)) await store.update('installments', p.id, { card_id: null });
    await store.remove('cards', id);
  }
  if (kind === 'goal') {
    for (const x of state.data.transactions.filter(v => v.goal_id === id)) await store.remove('transactions', x.id);
    await store.remove('goals', id);
  }
  done(t('deleted'));
}

/* ---------- Bills: mark paid / undo ---------- */
export async function payBill(id, key) {
  const b = state.data.bills.find(v => v.id === id);
  if (!b || billPaidTx(b, key)) return;
  await store.insert('transactions', {
    type: 'expense', amount: b.amount, category_id: b.category_id, note: b.name,
    date: key === curPeriod() ? today() : billDue(b, key), bill_id: b.id, bill_month: key, bill_due: billDue(b, key), card_id: null
  });
  await refresh(); render();
}

export async function unpayBill(id, key) {
  const b = state.data.bills.find(v => v.id === id), x = b && billPaidTx(b, key);
  if (!x) return;
  await store.remove('transactions', x.id);
  await refresh(); render();
}

/* ---------- Settings ---------- */
export async function saveSetting(key, raw) {
  let v = raw;
  if (key === 'expected_income' || key === 'usd_rate') { v = toNumber(raw); v = v > 0 ? v : null; }
  if (key === 'period_start_day') v = Number(raw) || 1;
  await store.saveSettings({ [key]: v });
  await refresh();
  if (key === 'period_start_day') { state.month = curPeriod(); state.barSel = null; }
  render();
}

export async function setLanguage(lang) {
  await store.saveSettings({ lang });
  await refresh(); render();
}

export async function fetchRate() {
  try {
    const r = await fetch('https://open.er-api.com/v6/latest/USD');
    const j = await r.json();
    const v = j?.rates?.TRY;
    if (!v) throw new Error('no rate');
    await store.saveSettings({ usd_rate: r2(v) });
    await refresh(); render();
    const inp = document.querySelector('[data-setting="usd_rate"]');
    if (inp) inp.value = numIn(r2(v));
    toast(t('rate_ok'));
  } catch {
    toast(t('rate_fail'));
  }
}

/* ---------- Backup ---------- */
export async function exportData() {
  const dump = await store.dump();
  const blob = new Blob([JSON.stringify({ app: 'butce', version: 1, exported_at: new Date().toISOString(), ...dump }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `butce-yedek-${today()}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export async function importFile(file) {
  try {
    const j = JSON.parse(await file.text());
    if (!j || !j.tables) throw new Error('bad file');
    await store.restore({ tables: j.tables, settings: j.settings || {} });
    await refresh(); await ensureCategories();
    done(t('imported'));
  } catch {
    toast(t('import_fail'));
  }
}

export async function wipeAll() {
  const lang = LANG;
  await store.wipe();
  await store.saveSettings({ lang });
  await refresh(); await ensureCategories();
  state.month = curPeriod();
  done(t('wiped'));
}
