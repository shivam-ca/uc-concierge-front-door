/* UC Concierge hand-off (canonical copy: uc-concierge-front-door/agent-patches/prefill).
   The front door opens an agent as  <agent url>?q=<request>&from=concierge.
   takeConciergeRequest reads it once and returns the address without q/from, so a reload never re-sends.
   With LangSmith tracing on, the URL also carries lstrace (+ lsbaggage): the front door's trace headers. They come back
   as trace, for the agent to send with its request so its runs nest under the same trace (the server validates them).
   Agents inline these two functions verbatim between the "--- UC Concierge hand-off" markers. */
(function (root) {
  // --- UC Concierge hand-off
  function takeConciergeRequest(href) {
    const url = new URL(href);
    if (url.searchParams.get("from") !== "concierge") return null;
    const q = (url.searchParams.get("q") || "").trim();
    if (!q) return null;
    const lstrace = url.searchParams.get("lstrace") || "";
    const lsbaggage = url.searchParams.get("lsbaggage") || "";
    for (const name of ["q", "from", "lstrace", "lsbaggage"]) url.searchParams.delete(name);
    const out = { q, cleanUrl: url.pathname + url.search + url.hash };
    if (lstrace) out.trace = { "langsmith-trace": lstrace, baggage: lsbaggage };
    return out;
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
