import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Search } from 'lucide-react';
import { LG, Panel } from '../components/Glass.jsx';
import AgentMark, { AgentAvatar } from '../components/AgentMark.jsx';
import { AGENTS, ROUTABLE_IDS, getAgent } from '../config/agents.js';

const EXAMPLES = ROUTABLE_IDS.map(id => ({ id, text: getAgent(id).examples[0] }));
const MAX = 1000;
const rise = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 260, damping: 26 } } };
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };

export function RoutingCard() {
  return (
    <Panel className="routing" spot={false} role="status" aria-live="polite">
      <span className="orb" aria-hidden="true" />
      <div>
        <b>The Orchestrator is reading your request…</b>
        <p>Matching it to the agent that handles this kind of work.</p>
        <div className="lane" aria-hidden="true">
          {ROUTABLE_IDS.map(id => <AgentAvatar key={id} id={id} size={24} />)}
        </div>
      </div>
    </Panel>
  );
}

/**
 * The search box. onSubmit is called synchronously inside the user's click or keypress:
 * the parent opens the handoff tab there, so browsers allow it.
 */
export default function Home({ onSubmit, busy, initialText = '' }) {
  const [text, setText] = useState(initialText);
  const ref = useRef(null);
  const submit = (value) => {
    const q = value.trim();
    if (!q || busy) { ref.current?.focus(); return; }
    onSubmit(q);
  };
  const grow = (el) => { el.style.height = 'auto'; el.style.height = `${Math.min(el.scrollHeight, 200)}px`; };

  return (
    <motion.div variants={stagger} initial="hidden" animate="show">
      <motion.section variants={rise} className="hero">
        <span className="eyebrow-pill"><i aria-hidden="true" /> UC Concierge Suite · one front door</span>
        <h1><span className="grad">What do you need help with?</span></h1>
        <p className="lead">Describe it in your own words. The Orchestrator picks the right UC agent and opens it in a new tab with your request already asked.</p>

        <form className="search-form" onSubmit={(e) => { e.preventDefault(); submit(text); }}>
          <Panel className="search" spot={false}>
            <Search size={20} aria-hidden="true" />
            <label htmlFor="ask" className="sr-only">Your request</label>
            <textarea
              id="ask" ref={ref} rows={1} maxLength={MAX} value={text} autoFocus
              placeholder="e.g. I want to create a new catalog"
              onChange={(e) => { setText(e.target.value); grow(e.target); }}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit(text); } }}
            />
            <LG strong tone="primary" padding="13px 20px" className={!text.trim() || busy ? 'lg-off' : ''} onClick={() => submit(text)} ariaLabel="Find my agent">
              <span className="lg-primary">{busy ? 'Routing…' : 'Find my agent'}</span> <ArrowRight size={16} aria-hidden="true" />
            </LG>
          </Panel>
          <div className="search-meta">
            <span className="hint-keys"><kbd>Enter</kbd> to send · <kbd>Shift</kbd>+<kbd>Enter</kbd> for a new line</span>
            <span aria-live="polite">{text.length > MAX - 100 ? `${text.length} / ${MAX}` : ''}</span>
          </div>
        </form>

        <div className="chips" aria-label="Try an example">
          {EXAMPLES.map(({ id, text: t }) => (
            <button key={id} type="button" className="chip" style={{ '--c': getAgent(id).color }} disabled={busy} onClick={() => { setText(t); submit(t); }}>
              <i aria-hidden="true" />{t}
            </button>
          ))}
        </div>
      </motion.section>

      {busy && <motion.div variants={rise} className="result-wrap"><RoutingCard /></motion.div>}

      <motion.section variants={rise} className="steps" aria-label="How it works">
        {[
          ['Ask', 'Type what you need, the way you would say it to a colleague.'],
          ['The Orchestrator routes it', 'An LLM reads the request and picks the agent that owns that kind of work.'],
          ['The agent takes over', 'Its own app opens in a new tab with your request already asked.'],
        ].map(([title, body], i) => (
          <Panel key={title} className="step"><span className="step-n" aria-hidden="true">{i + 1}</span><b>{title}</b><p>{body}</p></Panel>
        ))}
      </motion.section>

      <div className="section-head"><h2>The agents behind the door</h2><a className="link" href="#agents">See all components</a></div>
      <motion.section variants={stagger} className="tiles tiles-5" aria-label="Agents">
        {AGENTS.filter(a => a.kind !== 'platform').map(a => (
          <motion.div variants={rise} key={a.id} style={{ display: 'grid' }}>
            <Panel className="tile" style={{ '--c': a.color }}>
              <AgentMark id={a.id} detail />
              <p>{a.tagline}</p>
              <span className="shine" aria-hidden="true" />
            </Panel>
          </motion.div>
        ))}
      </motion.section>
    </motion.div>
  );
}
