// LangSmith distributed-tracing headers, carried from /api/route to the agent the user is sent to, so the agent's own
// runs nest under the front door's trace. They travel in the agent URL as lstrace / lsbaggage (beside q and from).

// A dotted order: one or more "<UTC timestamp>Z<run uuid>" segments joined by dots.
const SEGMENT = '\\d{8}T\\d{6,12}Z[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const DOTTED_ORDER = new RegExp(`^${SEGMENT}(?:\\.${SEGMENT})*$`, 'i');
const BAGGAGE = /^[A-Za-z0-9_\-.,=%:+ ]{0,1000}$/;
export const TRACE_PARAM = 'lstrace';
export const BAGGAGE_PARAM = 'lsbaggage';

/** {'langsmith-trace', baggage} when well-formed, otherwise null (anything else is dropped, never forwarded). */
export function cleanTrace(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const trace = raw['langsmith-trace'];
  if (typeof trace !== 'string' || trace.length > 2000 || !DOTTED_ORDER.test(trace)) return null;
  const baggage = typeof raw.baggage === 'string' && BAGGAGE.test(raw.baggage) ? raw.baggage : '';
  return { 'langsmith-trace': trace, baggage };
}
