import { motion } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';
import { Panel, Pill } from '../components/Glass.jsx';
import { AgentAvatar } from '../components/AgentMark.jsx';
import { AGENTS } from '../config/agents.js';
import { resolveAgentUrl } from '../lib/agentUrl.js';

const KIND = { live: ['ok', 'Live'], soon: ['warn', 'Coming soon'], platform: ['info', 'Platform service'] };
const rise = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 260, damping: 26 } } };

export default function Agents({ settings }) {
  return (
    <>
      <header className="page-head">
        <h1><span className="grad">The UC Concierge Suite</span></h1>
        <p>Seven components. You only need the front door: describe what you need and the Orchestrator sends you to the right agent.</p>
      </header>
      <motion.div className="tiles" initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.05 } } }}>
        {AGENTS.map(a => {
          const url = resolveAgentUrl(a.id, { settings, env: import.meta.env });
          const [tone, label] = KIND[a.kind];
          return (
            <motion.div key={a.id} variants={rise} style={{ display: 'grid' }}>
              <Panel className="tile" style={{ '--c': a.color }}>
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                  <AgentAvatar id={a.id} size={36} />
                  <Pill tone={tone}>{label}</Pill>
                </div>
                <div className="tile-title"><h2>{a.name}</h2><small>{a.version}</small></div>
                <p>{a.tagline}</p>
                {a.examples.length > 0 && (
                  <ul aria-label={`Example requests for ${a.name}`}>{a.examples.slice(0, 2).map(e => <li key={e}>{e}</li>)}</ul>
                )}
                <div className="tile-foot">
                  {url
                    ? <a className="btn small" href={url} target="_blank" rel="noopener">Open {a.short} <ArrowUpRight size={14} aria-hidden="true" /></a>
                    : <span className="muted small" style={{ fontSize: 12.5 }}>{a.kind === 'platform' ? 'Works behind the scenes' : 'No app yet'}</span>}
                </div>
                <span className="shine" aria-hidden="true" />
              </Panel>
            </motion.div>
          );
        })}
      </motion.div>
    </>
  );
}
