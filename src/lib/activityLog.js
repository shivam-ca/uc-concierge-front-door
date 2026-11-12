// A per-browser activity record: what was asked, where it was routed, and what the app did.
// Kept in localStorage only (nothing leaves this browser), capped, and safe when storage is missing or throws.
const KEY = 'uc-concierge-activity';
export const MAX_ENTRIES = 300;
const LEVELS = ['info', 'warn', 'error'];

const clean = (e) => (e && typeof e === 'object' && typeof e.id === 'string' && typeof e.at === 'string' && typeof e.type === 'string') ? e : null;

export function loadLog(storage = globalThis.localStorage) {
  try {
    const v = JSON.parse(storage?.getItem(KEY) || '[]');
    return Array.isArray(v) ? v.map(clean).filter(Boolean).slice(-MAX_ENTRIES) : [];
  } catch { return []; }
}

function save(list, storage) {
  try { storage?.setItem(KEY, JSON.stringify(list)); } catch { /* not persisted; still shown this session */ }
}

let seq = 0;
const newId = () => `${Date.now().toString(36)}-${(seq++).toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

/** Appends one entry (oldest dropped past the cap). Returns the new list; the entry's id is on `list.at(-1).id`. */
export function addEntry(list, entry, { now = () => new Date(), storage = globalThis.localStorage } = {}) {
  const level = LEVELS.includes(entry.level) ? entry.level : 'info';
  const next = [...list, { ...entry, level, id: newId(), at: now().toISOString() }].slice(-MAX_ENTRIES);
  save(next, storage);
  return next;
}

/** Records that the user opened an agent from a request (shown on the History card). */
export function markOpened(list, requestId, agent, { storage = globalThis.localStorage } = {}) {
  let hit = false;
  const next = list.map(e => {
    if (e.id !== requestId || e.type !== 'request') return e;
    hit = true;
    return { ...e, opened: [...new Set([...(e.opened || []), agent])] };
  });
  if (hit) save(next, storage);
  return next;
}

export function clearLog(storage = globalThis.localStorage) {
  try { storage?.removeItem(KEY); } catch { /* ignore */ }
  return [];
}

const hay = (e) => [e.query, e.agent, e.message, e.provider, e.type].filter(Boolean).join(' ').toLowerCase();

/** Newest first. level: 'all' | info | warn | error; agent: 'all' | agent id; text: case-insensitive substring. */
export function filterEntries(list, { level = 'all', agent = 'all', text = '', type = 'all' } = {}) {
  const t = text.trim().toLowerCase();
  return list
    .filter(e => (level === 'all' || e.level === level) && (agent === 'all' || e.agent === agent) && (type === 'all' || e.type === type) && (!t || hay(e).includes(t)))
    .reverse();
}

export const exportJson = (list) => JSON.stringify(list, null, 2);
