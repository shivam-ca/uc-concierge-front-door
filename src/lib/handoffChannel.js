// Front-door tab -> handoff tab. The handoff tab is opened inside the user's click (so popup blockers allow it),
// before the routing decision exists. The decision reaches it by whichever path works first:
// localStorage (already there on load, or a 'storage' event), a BroadcastChannel message, or an answer to its 'ask'.
// Stored entries carry a timestamp: readers ignore stale ones, the publisher deletes its own after keepMs,
// and sweepHandoffs() clears leftovers (e.g. a tab closed mid-routing) when the front door loads.
const NAME = 'concierge-handoff';
const PREFIX = 'concierge-handoff:';
const MAX_AGE_MS = 2 * 60 * 1000;
const key = (nonce) => `${PREFIX}${nonce}`;
const defaultChannel = () => new BroadcastChannel(NAME);
const NO_CHANNEL = { postMessage() {}, close() {}, set onmessage(_) {} };
const openChannel = (factory) => { try { return factory(); } catch { return NO_CHANNEL; } };

export const newNonce = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export function openHandoffTab(nonce, openFn = (...a) => window.open(...a)) {
  const win = openFn(`/handoff.html#${nonce}`, '_blank');
  return { win: win || null, blocked: !win };
}

/** The handoff tab is opened without noopener (needed to detect a blocked popup); cut the link before redirecting. */
export function severOpener(win = globalThis.window) {
  try { if (win) win.opener = null; } catch { /* read-only in some browsers: nothing to do */ }
}

/** Front-door tab: store it, broadcast it, answer late asks, then delete it after keepMs. */
export function publishDecision(nonce, payload, { channelFactory = defaultChannel, storage = globalThis.localStorage, now = Date.now, keepMs = 30000 } = {}) {
  try { storage?.setItem(key(nonce), JSON.stringify({ at: now(), payload })); } catch { /* the channel still works */ }
  const ch = openChannel(channelFactory);
  ch.onmessage = (e) => { if (e.data?.type === 'ask' && e.data.nonce === nonce) ch.postMessage({ type: 'decision', nonce, payload }); };
  ch.postMessage({ type: 'decision', nonce, payload });
  const t = setTimeout(() => {
    ch.close();
    try { storage?.removeItem?.(key(nonce)); } catch { /* ignore */ }
  }, keepMs);
  t?.unref?.();
}

function readFresh(raw, now, maxAgeMs) {
  try {
    const v = JSON.parse(raw);
    return v && typeof v.at === 'number' && now() - v.at <= maxAgeMs ? v.payload : null;
  } catch { return null; }
}

/** Handoff tab: resolves once, from whichever path delivers first. Abort (e.g. effect cleanup) stops it silently. */
export function waitForDecision(nonce, { channelFactory = defaultChannel, storage = globalThis.localStorage, eventTarget = globalThis, signal, now = Date.now, maxAgeMs = MAX_AGE_MS } = {}) {
  return new Promise((resolve) => {
    if (signal?.aborted) return;
    let done = false;
    const ch = openChannel(channelFactory);
    const stop = () => {
      done = true;
      ch.close();
      eventTarget?.removeEventListener?.('storage', onStorage);
      signal?.removeEventListener?.('abort', stop);
    };
    function finish(payload) {
      if (done || payload == null) return;
      stop();
      resolve(payload);
    }
    function onStorage(e) { if (e.key === key(nonce) && e.newValue) finish(readFresh(e.newValue, now, maxAgeMs)); }
    signal?.addEventListener?.('abort', stop);
    ch.onmessage = (e) => { if (e.data?.type === 'decision' && e.data.nonce === nonce) finish(e.data.payload); };
    eventTarget?.addEventListener?.('storage', onStorage);
    try { const raw = storage?.getItem(key(nonce)); if (raw) finish(readFresh(raw, now, maxAgeMs)); } catch { /* fall through to the channel */ }
    if (!done) ch.postMessage({ type: 'ask', nonce });
  });
}

/** Front-door load: delete leftover hand-off entries (stale or unreadable) so request text does not linger. */
export function sweepHandoffs(storage = globalThis.localStorage, now = Date.now, maxAgeMs = MAX_AGE_MS) {
  try {
    const keys = [];
    for (let i = 0; i < storage.length; i++) { const k = storage.key(i); if (k?.startsWith(PREFIX)) keys.push(k); }
    for (const k of keys) if (readFresh(storage.getItem(k), now, maxAgeMs) == null) storage.removeItem(k);
  } catch { /* storage unavailable: nothing to sweep */ }
}
