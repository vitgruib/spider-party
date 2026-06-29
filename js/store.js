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

/** All categories the games can use, each guaranteed an `id`. */
export function getCategories() {
  const builtin = [...headsUpCategories, ...extraCategories].map((c) => withId(c, 'b:' + c.name));
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

// ---------- Custom lists (create your own) ----------
// Each: { id, name, emoji, primary, secondary, words, votes, myVote, shared }
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
    votes: 0, myVote: 0, shared: false,
  };
  lists.push(list);
  save(KEY.custom, lists);
  return list;
}

export function deleteCustomList(id) {
  save(KEY.custom, getCustomLists().filter((l) => l.id !== id));
  delete usedRaw[id]; usedCache.delete(id); save(KEY.used, usedRaw);
}

// ---------- Voting (device-local) ----------
export function voteList(id, dir) {
  const lists = getCustomLists();
  const l = lists.find((x) => x.id === id);
  if (!l) return null;
  const prev = l.myVote || 0;
  const next = prev === dir ? 0 : dir;       // tapping the same arrow clears it
  l.votes = (l.votes || 0) - prev + next;
  l.myVote = next;
  save(KEY.custom, lists);
  return l;
}

// ---------- Sharing (encode/decode a list to a portable code) ----------
export function encodeList(list) {
  const payload = { n: list.name, e: list.emoji, p: list.primary, s: list.secondary, w: list.words };
  const json = JSON.stringify(payload);
  // UTF-8 safe base64.
  return btoa(unescape(encodeURIComponent(json)));
}

export function decodeList(code) {
  try {
    const json = decodeURIComponent(escape(atob(code.trim())));
    const p = JSON.parse(json);
    if (!p || !p.n || !Array.isArray(p.w)) return null;
    return { name: String(p.n), emoji: p.e || '✨', primary: p.p, secondary: p.s, words: p.w.map(String) };
  } catch { return null; }
}

/** Import a decoded list as a new local custom list (marked shared). */
export function importList(decoded) {
  const list = saveCustomList(decoded);
  const lists = getCustomLists();
  const i = lists.findIndex((l) => l.id === list.id);
  if (i >= 0) { lists[i].shared = true; save(KEY.custom, lists); }
  return list;
}

export function shareUrl(list) {
  const base = location.origin + location.pathname;
  return base + '#share=' + encodeList(list);
}
