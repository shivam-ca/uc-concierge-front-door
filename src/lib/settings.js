// Per-browser preferences (agent URLs, passcode). Storage can be missing or throw (private mode, blocked site data).
const KEY = 'uc-concierge-settings';
const DEFAULTS = () => ({ urls: {}, passcode: '' });

export function loadSettings(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem(KEY);
    if (!raw) return DEFAULTS();
    const v = JSON.parse(raw);
    const urls = {};
    if (v && typeof v.urls === 'object' && v.urls) for (const [k, u] of Object.entries(v.urls)) if (typeof u === 'string') urls[k] = u;
    return { urls, passcode: typeof v?.passcode === 'string' ? v.passcode : '' };
  } catch { return DEFAULTS(); }
}

export function saveSettings(settings, storage = globalThis.localStorage) {
  try { storage?.setItem(KEY, JSON.stringify({ urls: settings.urls || {}, passcode: settings.passcode || '' })); } catch { /* not persisted; still works this session */ }
}
