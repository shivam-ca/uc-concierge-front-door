import { motion } from 'framer-motion';
import { ArrowUpRight, CircleCheck, Info, RotateCcw, Sparkles } from 'lucide-react';
import { LG, Panel, Pill } from '../components/Glass.jsx';
import AgentMark from '../components/AgentMark.jsx';
import { CONFIDENCE_THRESHOLD, getAgent } from '../config/agents.js';
import { choicesFor } from '../lib/choices.js';

export const PROVIDER_LABEL = {
  anthropic: 'Claude', 'azure-openai': 'Azure OpenAI', 'azure-foundry': 'Claude on Azure Foundry',
  keywords: 'Keyword fallback', 'keywords-local': 'Keyword fallback (offline)',
};

/** The Skyscanner-style result: the chosen agent, why, how sure, and the other options. */
export default function Results({ query, decision, blocked, copied = false, hasUrl, onOpen, onReset }) {
  const agent = getAgent(decision.agent);
  const low = decision.confidence < CONFIDENCE_THRESHOLD;
  const pct = Math.round(decision.confidence * 100);
  const soon = !hasUrl(agent.id);
  const opened = !blocked && !low && !soon;
  const options = choicesFor(decision);

  return (
    <motion.div className="result-wrap" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 26 }}>
      <Panel className="result" style={{ '--c': agent.color }} aria-labelledby="result-title">
        <div className="result-head">
          <div style={{ display: 'grid', gap: 10 }}>
            <span className="kicker"><Sparkles size={13} aria-hidden="true" /> {low ? 'Best guess, please confirm' : 'Best match'}</span>
            <h2 id="result-title"><AgentMark id={agent.id} size={44} detail /></h2>
          </div>
          <Pill tone={decision.fallback ? 'warn' : 'info'}>Routed by {PROVIDER_LABEL[decision.provider] || decision.provider}</Pill>
        </div>

        <p className="quote">“{query}”</p>
        {decision.reason && <p className="why"><CircleCheck size={17} aria-hidden="true" />{decision.reason}</p>}

        <div>
          <div className="meter-row"><span>Confidence</span><b>{pct}%</b></div>
          <div className="conf" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Routing confidence"><b style={{ width: `${pct}%` }} /></div>
        </div>

        {opened && <p className="note info" role="status"><Info size={14} aria-hidden="true" style={{ verticalAlign: '-2px' }} /> {agent.short} opened in a new tab with your request.{copied ? ' Your request is also on your clipboard.' : ''}</p>}
        {blocked && <p className="note" role="alert">The new tab didn’t open or was closed. Use the button below to open {agent.short}.</p>}
        {low && <p className="note">{decision.alternatives.length ? 'This request could fit more than one agent' : 'The Orchestrator isn’t sure which agent fits this'}, so you choose: pick one here or in the new tab, or rephrase your request.</p>}
        {decision.fallback && <p className="note">The AI router wasn’t available, so keyword rules picked this agent. Check the other options if it looks wrong.</p>}

        <div className="row">
          <LG strong tone="primary" padding="12px 20px" onClick={() => onOpen(agent.id)}>
            <span className="lg-primary">{soon ? `See ${agent.short}` : opened ? `Open ${agent.short} again` : `Open ${agent.short}`}</span> <ArrowUpRight size={16} aria-hidden="true" />
          </LG>
          <button type="button" className="btn" onClick={onReset}><RotateCcw size={15} aria-hidden="true" /> New request</button>
        </div>

        {options.length > 0 && (
          <div className="alts">
            <span className="kicker">Other options</span>
            {options.map(alt => (
              <div className="alt" key={alt.agent}>
                <div>
                  <AgentMark id={alt.agent} size={30} />
                  {alt.reason && <div className="alt-why">{alt.reason}</div>}
                </div>
                <button type="button" className="btn small" onClick={() => onOpen(alt.agent)}>
                  {hasUrl(alt.agent) ? 'Open' : 'See'} {getAgent(alt.agent).short} <ArrowUpRight size={14} aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </motion.div>
  );
}
