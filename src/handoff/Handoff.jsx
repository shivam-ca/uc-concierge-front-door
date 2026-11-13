import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowUpRight, CircleCheck, Hand } from 'lucide-react';
import { Aurora, LG, Panel } from '../components/Glass.jsx';
import AgentMark from '../components/AgentMark.jsx';
import ComingSoon from '../views/ComingSoon.jsx';
import { waitForDecision } from '../lib/handoffChannel.js';
import { buildAgentUrl } from '../lib/agentUrl.js';
import { getAgent } from '../config/agents.js';
import { choicesFor } from '../lib/choices.js';
import { planHandoff } from './plan.js';

const DWELL_MS = 1500;
const WAIT_LIMIT_MS = 20000;
const nonce = location.hash.slice(1);
const pop = { initial: { opacity: 0, y: 10, scale: 0.98 }, animate: { opacity: 1, y: 0, scale: 1 }, transition: { type: 'spring', stiffness: 260, damping: 26 } };

function localHint(url) {
  try {
    const u = new URL(url);
    return ['127.0.0.1', 'localhost'].includes(u.hostname) ? `${u.host}` : null;
  } catch { return null; }
}

export default function Handoff() {
  const [payload, setPayload] = useState(null);
  const [plan, setPlan] = useState(null);
  const [stay, setStay] = useState(false);

  useEffect(() => {
    if (!nonce) { setPlan(planHandoff(null)); return undefined; }
    const ctrl = new AbortController();
    const slow = setTimeout(() => setPlan(p => p || planHandoff(null)), WAIT_LIMIT_MS);
    waitForDecision(nonce, { signal: ctrl.signal }).then((p) => {
      clearTimeout(slow);
      setPayload(p);
      setPlan(planHandoff(p));
    });
    return () => { ctrl.abort(); clearTimeout(slow); };
  }, []);

  useEffect(() => {
    if (!plan) return undefined;
    if (plan.kind === 'redirect') document.title = `Opening ${getAgent(plan.agent).short}… · UC Concierge`;
    else if (plan.kind === 'choose') document.title = 'Choose an agent · UC Concierge';
    if (plan.kind !== 'redirect' || stay) return undefined;
    const t = setTimeout(() => location.replace(plan.url), DWELL_MS);
    return () => clearTimeout(t);
  }, [plan, stay]);

  const go = (agent) => {
    const url = buildAgentUrl(payload?.urls?.[agent] ?? null, payload?.query ?? '', payload?.decision?.trace);
    if (url) location.replace(url);
    else { setStay(true); setPlan({ kind: 'soon', agent }); }
  };

  const decision = payload?.decision;
  return (
    <div className="app">
      <Aurora />
      <header className="topbar">
        <a className="brand" href="/" aria-label="UC Concierge home">
          <span className="brand-mark" aria-hidden="true"><i /></span>
          <span><b>UC Concierge</b><small>Handing you over</small></span>
        </a>
      </header>
      <main className="handoff-main" id="main">
        {!plan && (
          <motion.div {...pop} className="handoff-hold" role="status" aria-live="polite">
            <span className="orb lg" aria-hidden="true" />
            <h1>Routing your request…</h1>
            <p>The Orchestrator is finding the right agent.</p>
          </motion.div>
        )}

        {plan?.kind === 'redirect' && (
          <motion.div {...pop} className="handoff-card">
            <Panel className="result" style={{ '--c': getAgent(plan.agent).color, '--dwell': `${DWELL_MS}ms` }} role="status" aria-live="polite">
              <span className="kicker">{stay ? 'Paused' : 'Opening'}</span>
              <h1 style={{ fontSize: 'clamp(20px, 3vw, 26px)' }}><AgentMark id={plan.agent} size={48} detail /></h1>
              <p className="quote">“{payload.query}”</p>
              {decision.reason && <p className="why"><CircleCheck size={17} aria-hidden="true" />{decision.reason}</p>}
              {!stay && <div className="countdown" aria-hidden="true"><b /></div>}
              {localHint(plan.url) && <p className="muted small" style={{ fontSize: 12.5 }}>This agent runs on your machine at {localHint(plan.url)}. If the page doesn’t load, start the agent first.</p>}
              <div className="row">
                <LG strong tone="primary" padding="12px 20px" onClick={() => location.replace(plan.url)}>
                  <span className="lg-primary">Open now</span> <ArrowUpRight size={16} aria-hidden="true" />
                </LG>
                {!stay && <button type="button" className="btn" onClick={() => setStay(true)}><Hand size={15} aria-hidden="true" /> Stay here</button>}
              </div>
              {stay && (
                <div className="alts">
                  <span className="kicker">Or choose another</span>
                  {choicesFor({ ...decision, confidence: 0 }).map(a => (
                    <div className="alt" key={a.agent}>
                      <div>
                        <AgentMark id={a.agent} size={30} />
                        {a.reason && <div className="alt-why">{a.reason}</div>}
                      </div>
                      <button type="button" className="btn small" onClick={() => go(a.agent)}>
                        {payload.urls?.[a.agent] ? 'Open' : 'See'} {getAgent(a.agent).short}
                      </button>
                    </div>
                  ))}
                  <a className="btn small" href="/" style={{ justifySelf: 'start' }}>Back to UC Concierge</a>
                </div>
              )}
            </Panel>
          </motion.div>
        )}

        {plan?.kind === 'choose' && (
          <motion.div {...pop} className="handoff-card">
            <Panel className="result">
              <span className="kicker">Which of these fits best?</span>
              <p className="quote">“{payload.query}”</p>
              <p className="muted">The Orchestrator wasn’t sure, so you choose. The first is its best guess.</p>
              <div className="alts">
                {plan.choices.map((c, i) => (
                  <div className="alt" key={c.agent}>
                    <div>
                      <AgentMark id={c.agent} size={30} />
                      {c.reason && <div className="alt-why">{c.reason}</div>}
                    </div>
                    <button type="button" className={`btn small ${i === 0 ? 'primary' : ''}`} onClick={() => go(c.agent)}>
                      {payload.urls?.[c.agent] ? 'Open' : 'See'} {getAgent(c.agent).short}
                    </button>
                  </div>
                ))}
              </div>
            </Panel>
          </motion.div>
        )}

        {plan?.kind === 'soon' && <motion.div {...pop} className="handoff-card"><ComingSoon id={plan.agent} query={payload?.query || ''} /></motion.div>}

        {plan?.kind === 'error' && (
          <motion.div {...pop} className="handoff-card">
            <Panel className="result" role="alert">
              <h1 style={{ fontSize: 22 }}>{payload?.error ? 'Your request couldn’t be routed' : 'This tab didn’t get a request'}</h1>
              <p className="muted">{plan.message}</p>
              <div className="row"><a className="btn primary" href="/">Back to UC Concierge</a></div>
            </Panel>
          </motion.div>
        )}
      </main>
    </div>
  );
}
