// Light/dark preference, per browser. Light is the default; storage can be missing or throw.
const KEY = 'uc-concierge-theme';
export const THEMES = ['dark', 'light'];

export function loadTheme(storage = globalThis.localStorage) {
  try { const v = storage?.getItem(KEY); return THEMES.includes(v) ? v : 'light'; } catch { return 'light'; }
}

export function saveTheme(theme, storage = globalThis.localStorage) {
  try { storage?.setItem(KEY, theme); } catch { /* applies for this session only */ }
}

/** Sets data-theme on <html> (what the stylesheet keys on) and the browser UI colour. */
export function applyTheme(theme, root = globalThis.document?.documentElement) {
  if (!root) return;
  root.setAttribute('data-theme', theme);
}
