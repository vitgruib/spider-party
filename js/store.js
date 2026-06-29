// ============================================================
//  Persistent store: settings, used-word tracking, custom lists,
//  sharing (link/code), and local upvote/downvote.
//  All state lives in localStorage — there is no backend, so
//  "sharing" is via copyable links/codes and votes are device-local.
//  (See PLANS.md for the planned real backend.)
// ============================================================
import { headsUpCategories } from './data.js';
import { extraCategories } from './extra-data.js';

const KEY = {
  settings: 'pg_settings',
  used: 'pg_used',
  custom: 'pg_custom',
};

function load(key, fallback) {
  try { const v = JSON.parse(localStorage.getItem(key)); return v == null ? fallback : v; }
  catch { return fallback; }
}
function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode / full */ }
}

// ---------- Settings (incl. the retire-used-words flag) ----------
const settings = Object.assign({ retire: true }, load(KEY.settings, {}));
export function getRetire() { return settings.retire; }
export function setRetire(on) { settings.retire = !!on; save(KEY.settings, settings); }

// ---------- Categories: built-in + manual extras + custom ----------
function withId(c, id) { return { ...c, id }; }

// Curated, mainstream category set (order shown in the UI). `src` is the source
// list name in the data; `name` is the (possibly shortened) display name.
// Niche categories (Music-by-song, Anime, School Subjects, Instruments,
// Landmarks, etc.) are intentionally left out to keep the list short.
const CURATED = [
  { src: 'Movies & TV', name: 'Movies & TV' },
  { src: 'Video Games', name: 'Video Games' },
  { src: 'Animals', name: 'Animals' },
  { src: 'Food & Drinks', name: 'Food' },
  { src: 'Sports', name: 'Sports' },
  { src: 'Countries', name: 'Countries' },
  { src: 'Brands', name: 'Brands' },
  { src: 'Disney', name: 'Disney' },
  { src: 'Superheroes', name: 'Superheroes' },
  { src: 'Vehicles', name: 'Vehicles' },
  { src: 'Objects', name: 'Objects' },
  { src: 'Actions', name: 'Actions' },
  { src: 'Colleges', name: 'Colleges' },
  { src: 'Japanese Foods', name: 'Japanese Foods' },
];

/** All categories the games can use, each guaranteed an `id`. */
export function getCategories() {
  const byName = {};
  for (const c of [...headsUpCategories, ...extraCategories]) byName[c.name] = c;
  const builtin = CURATED
    .map(({ src, name }) => (byName[src] ? withId({ ...byName[src], name }, 'b:' + name) : null))
    .filter(Boolean);
  const custom = getCustomLists().map((c) => withId(c, c.id));
  return [...builtin, ...custom];
}

export function getCategoryById(id) {
  return getCategories().find((c) => c.id === id) || null;
}

// ---------- Used-word tracking (retire until refresh) ----------
// Stored as { [categoryId]: [word, ...] }; surfaced as Sets.
const usedRaw = load(KEY.used, {});
const usedCache = new Map();
function usedSet(id) {
  if (!usedCache.has(id)) usedCache.set(id, new Set(usedRaw[id] || []));
  return usedCache.get(id);
}
function persistUsed(id) {
  usedRaw[id] = [...usedSet(id)];
  if (usedRaw[id].length === 0) delete usedRaw[id];
  save(KEY.used, usedRaw);
}

/** Words still in play for a category (honours the retire flag). */
export function availableWords(cat) {
  if (!settings.retire) return cat.words.slice();
  const used = usedSet(cat.id);
  return cat.words.filter((w) => !used.has(w));
}
export function usedCount(cat) { return usedSet(cat.id).size; }

/** Mark one or more words as used (no-op when the flag is off). */
export function markUsed(cat, words) {
  if (!settings.retire) return;
  const set = usedSet(cat.id);
  (Array.isArray(words) ? words : [words]).forEach((w) => set.add(w));
  persistUsed(cat.id);
}

/** Put every used word for a category back into play. */
export function refreshUsed(cat) {
  usedCache.set(cat.id, new Set());
  persistUsed(cat.id);
}

// ---------- Custom lists (create your own, stored on this device) ----------
// Each: { id, name, emoji, primary, secondary, words }
export function getCustomLists() { return load(KEY.custom, []); }

const PALETTE = [
  ['#E94560', '#89253E'], ['#6C3483', '#4A235A'], ['#2E86AB', '#1B4965'],
  ['#1DB954', '#0B5D1E'], ['#FF6F00', '#E65100'], ['#1976D2', '#0D47A1'],
];

export function saveCustomList({ id, name, emoji, words, primary, secondary }) {
  const lists = getCustomLists();
  const clean = [...new Set(words.map((w) => w.trim()).filter(Boolean))];
  const pal = PALETTE[(name.length + clean.length) % PALETTE.length];
  if (id) {
    const i = lists.findIndex((l) => l.id === id);
    if (i >= 0) {
      lists[i] = { ...lists[i], name, emoji: emoji || lists[i].emoji, words: clean,
        primary: primary || lists[i].primary, secondary: secondary || lists[i].secondary };
      save(KEY.custom, lists);
      return lists[i];
    }
  }
  const list = {
    id: 'c:' + Math.random().toString(36).slice(2, 10),
    name, emoji: emoji || '✨', words: clean,
    primary: primary || pal[0], secondary: secondary || pal[1],
  };
  lists.push(list);
  save(KEY.custom, lists);
  return list;
}

export function deleteCustomList(id) {
  save(KEY.custom, getCustomLists().filter((l) => l.id !== id));
  delete usedRaw[id]; usedCache.delete(id); save(KEY.used, usedRaw);
}
