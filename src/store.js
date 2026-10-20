/* =====================================================================
   DATA LAYER
   Everything the app reads or writes goes through `store`.
   Right now it saves to localStorage on this device. When we move to
   Supabase, only this file changes; the rest of the app stays the same:
     list(table)              -> supabase.from(table).select('*')
     insert(table, row)       -> supabase.from(table).insert(row).select().single()
     update(table, id, patch) -> supabase.from(table).update(patch).eq('id', id)
     remove(table, id)        -> supabase.from(table).delete().eq('id', id)
     getSettings/saveSettings -> a `profiles` row for the signed-in user
   Field names are already snake_case so they map 1:1 to Postgres columns.
   ===================================================================== */
import { uid } from './utils.js';

export const TABLES = ['transactions', 'categories', 'bills', 'installments', 'cards', 'goals', 'accounts'];

const KEY = 'butce.v1';
const empty = () => ({ tables: Object.fromEntries(TABLES.map(t => [t, []])), settings: {} });
const clone = v => JSON.parse(JSON.stringify(v));

let db = null;

function load() {
  if (db) return db;
  let d = null;
  try { d = JSON.parse(localStorage.getItem(KEY)); } catch { d = null; }
  db = d && d.tables ? d : empty();
  for (const t of TABLES) if (!Array.isArray(db.tables[t])) db.tables[t] = [];
  if (!db.settings) db.settings = {};
  return db;
}

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(db)); }
  catch { /* storage blocked (private mode / sandbox): keep working in memory */ }
}

export const store = {
  async list(table) { return clone(load().tables[table]); },

  async insert(table, row) {
    const r = { id: uid(), created_at: new Date().toISOString(), ...row };
    load().tables[table].push(r); save();
    return clone(r);
  },

  async update(table, id, patch) {
    const rows = load().tables[table];
    const i = rows.findIndex(r => r.id === id);
    if (i < 0) return null;
    rows[i] = { ...rows[i], ...patch }; save();
    return clone(rows[i]);
  },

  async remove(table, id) {
    const tb = load().tables;
    tb[table] = tb[table].filter(r => r.id !== id); save();
  },

  async getSettings() { return { ...load().settings }; },

  async saveSettings(patch) {
    const d = load();
    d.settings = { ...d.settings, ...patch }; save();
    return { ...d.settings };
  },

  // Backup / restore (Settings → Data)
  async dump() { return clone(load()); },
  async restore(dump) {
    db = { ...empty(), ...clone(dump) };
    load(); save();
  },
  async wipe({ keepSettings = false } = {}) {
    const s = keepSettings ? load().settings : {};
    db = empty(); db.settings = s; save();
  }
};

/* Placeholder for the AI features that arrive with Supabase + Gemini.
   parseReceipt(file) will call a Supabase Edge Function (like gemini-proxy
   in Fridge-to-Table) and return [{ amount, note, category_key, date }]. */
export const ai = {
  async parseReceipt(/* file */) { throw new Error('not_connected'); }
};
