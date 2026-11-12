import { useState } from 'react';
import { Check, Copy, Hourglass } from 'lucide-react';
import { Panel } from '../components/Glass.jsx';
import AgentMark from '../components/AgentMark.jsx';
import { getAgent } from '../config/agents.js';

/** Landing for an agent with no UI configured yet: what it will do, the user's request, and what to do meanwhile. */
export default function ComingSoon({ id, query }) {
  const agent = getAgent(id);
  const [copied, setCopied] = useState(false);
  if (!agent || agent.kind === 'platform') {
    return (
      <div className="result-wrap">
        <Panel className="result"><h1 style={{ fontSize: 22 }}>Unknown agent</h1><div className="row"><a className="btn" href="/#">Back to UC Concierge</a></div></Panel>
      </div>
    );
  }
  const copy = () => navigator.clipboard?.writeText(query).then(() => setCopied(true)).catch(() => {});
  const soon = agent.kind === 'soon';
  return (
    <div className="result-wrap">
      <Panel className="result" style={{ '--c': agent.color }}>
        <span className="kicker"><Hourglass size={13} aria-hidden="true" /> {soon ? 'Coming soon' : 'Not set up in this browser'}</span>
        <h1 style={{ fontSize: 'clamp(20px, 3vw, 26px)' }}><AgentMark id={agent.id} size={48} detail /></h1>
        <p>{agent.tagline}</p>
        {query && (
          <div className="alt">
            <span className="quote" style={{ flex: 1, padding: 0, background: 'none', boxShadow: 'none' }}>“{query}”</span>
            <button type="button" className="btn small" onClick={copy}>
              {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />} {copied ? 'Copied' : 'Copy request'}
            </button>
          </div>
        )}
        {soon && agent.interim && <p className="note info"><b>For now:</b> {agent.interim}</p>}
        {!soon && <p className="note">There is no address for this agent. Add one under <a className="link" href="/#settings">Settings</a>.</p>}
        <div className="row"><a className="btn" href="/#">Back to UC Concierge</a></div>
      </Panel>
    </div>
  );
}
