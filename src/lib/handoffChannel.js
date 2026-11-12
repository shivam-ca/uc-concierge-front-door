// Front-door tab -> handoff tab. The handoff tab is opened inside the user's click (so popup blockers allow it),
// before the routing decision exists. The decision reaches it by whichever path works first:
// localStorage (already there on load, or a 'storage' event), a BroadcastChannel message, or an answer to its 'ask'.
const NAME = 'concierge-handoff';
const key = (nonce) => `concierge-handoff:${nonce}`;
const defaultChannel = () => new BroadcastChannel(NAME);
const NO_CHANNEL = { postMessage() {}, close() {}, set onmessage(_) {} };
const openChannel = (factory) => { try { return factory(); } catch { return NO_CHANNEL; } };

export const newNonce = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export function openHandoffTab(nonce, openFn = (...a) => window.open(...a)) {
  const win = openFn(`/handoff.html#${nonce}`, '_blank');
  return { win: win || null, blocked: !win };
}

/** Front-door tab: store it, broadcast it, and answer late asks for 30s. */
export function publishDecision(nonce, payload, { channelFactory = defaultChannel, storage = globalThis.localStorage } = {}) {
  try { storage?.setItem(key(nonce), JSON.stringify(payload)); } catch { /* channel still works */ }
  const ch = openChannel(channelFactory);
  ch.onmessage = (e) => { if (e.data?.type === 'ask' && e.data.nonce === nonce) ch.postMessage({ type: 'decision', nonce, payload }); };
  ch.postMessage({ type: 'decision', nonce, payload });
  const t = setTimeout(() => ch.close(), 30000);
  t?.unref?.();
}

/** Handoff tab: resolves once, from whichever path delivers first, and cleans up. */
export function waitForDecision(nonce, { channelFactory = defaultChannel, storage = globalThis.localStorage, eventTarget = globalThis } = {}) {
  return new Promise((resolve) => {
    let done = false;
    const ch = openChannel(channelFactory);
    const onStorage = (e) => {
      if (e.key !== key(nonce) || !e.newValue) return;
      try { finish(JSON.parse(e.newValue)); } catch { /* ignore a torn write */ }
    };
    function finish(payload) {
      if (done) return;
      done = true;
      ch.close();
      eventTarget?.removeEventListener?.('storage', onStorage);
      try { storage?.removeItem?.(key(nonce)); } catch { /* ignore */ }
      resolve(payload);
    }
    ch.onmessage = (e) => { if (e.data?.type === 'decision' && e.data.nonce === nonce) finish(e.data.payload); };
    eventTarget?.addEventListener?.('storage', onStorage);
    try { const raw = storage?.getItem(key(nonce)); if (raw) { finish(JSON.parse(raw)); return; } } catch { /* fall through to the channel */ }
    ch.postMessage({ type: 'ask', nonce });
  });
}
