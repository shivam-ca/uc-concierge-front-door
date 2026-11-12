/* UC Concierge hand-off (canonical copy: uc-concierge-front-door/agent-patches/prefill).
   The front door opens an agent as  <agent url>?q=<request>&from=concierge.
   takeConciergeRequest reads it once and returns the address without q/from, so a reload never re-sends.
   Agents inline these two functions verbatim between the "--- UC Concierge hand-off" markers. */
(function (root) {
  // --- UC Concierge hand-off
  function takeConciergeRequest(href) {
    const url = new URL(href);
    if (url.searchParams.get("from") !== "concierge") return null;
    const q = (url.searchParams.get("q") || "").trim();
    if (!q) return null;
    url.searchParams.delete("q");
    url.searchParams.delete("from");
    return { q, cleanUrl: url.pathname + url.search + url.hash };
  }
  function fitRequest(q, maxLength) {
    if (!maxLength || q.length <= maxLength) return { text: q, cut: false };
    return { text: q.slice(0, maxLength), cut: true };
  }
  // --- end UC Concierge hand-off
  const api = { takeConciergeRequest, fitRequest };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ConciergePrefill = api;
})(typeof window !== "undefined" ? window : globalThis);
