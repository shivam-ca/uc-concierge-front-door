import { useMemo, useState } from 'react';
import { ArrowUpRight, Search } from 'lucide-react';
import { Panel, Pill } from '../components/Glass.jsx';
import { AgentAvatar } from '../components/AgentMark.jsx';
import { AGENTS, getAgent } from '../config/agents.js';
import { filterEntries } from '../lib/activityLog.js';

export const fmtTime = (iso) => { try { return new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }); } catch { return iso; } };
const ROUTABLE = AGENTS.filter(a => a.kind !== 'platform');

/** Every request you sent through the front door: what you asked, where it went, and what you opened. */
export default function History({ entries, onAskAgain }) {
  const [text, setText] = useState('');
  const [agent, setAgent] = useState('all');
  const rows = useMemo(() => filterEntries(entries, { type: 'request', agent, text }), [entries, agent, text]);
  const total = entries.filter(e => e.type === 'request').length;

  return (
    <>
      <header className="page-head">
        <h1><span className="grad">History</span></h1>
        <p>The requests you have made here, newest first. Saved in this browser only; nothing is sent anywhere.</p>
      </header>
      <div className="log-tools">
        <label className="log-search">
          <Search size={15} aria-hidden="true" />
          <span className="visually-hidden">Search your requests</span>
          <input className="field" type="search" placeholder="Search what you asked" value={text} onChange={(e) => setText(e.target.value)} />
        </label>
        <div className="chips-row" role="group" aria-label="Filter by agent">
          <button type="button" className="chip" aria-pressed={agent === 'all'} onClick={() => setAgent('all')}>All</button>
          {ROUTABLE.map(a => <button key={a.id} type="button" className="chip" aria-pressed={agent === a.id} onClick={() => setAgent(a.id)}>{a.short}</button>)}
        </div>
      </div>
      <p className="muted log-status" role="status" aria-live="polite">
        {!total ? 'No requests yet. Ask something on the Ask page and it will show up here.' : !rows.length ? 'Nothing matches that search.' : `${rows.length} of ${total} request${total === 1 ? '' : 's'}`}
      </p>
      <ol className="log-list">
        {rows.map(e => {
          const a = getAgent(e.agent);
          return (
            <li key={e.id}>
              <Panel className="hist" style={{ '--c': a.color }} spot={false}>
                <AgentAvatar id={a.id} size={34} />
                <div className="hist-main">
                  <p className="hist-q">“{e.query}”</p>
                  <div className="row hist-meta">
                    <span className="muted small">{fmtTime(e.at)}</span>
                    <Pill tone="info">{a.short}</Pill>
                    {typeof e.confidence === 'number' && <span className="muted small">{Math.round(e.confidence * 100)}% sure</span>}
                    {e.low && <Pill tone="warn">You chose</Pill>}
                    {e.fallback && <Pill tone="warn">Keyword fallback</Pill>}
                    {e.opened?.length > 0 && <span className="muted small">Opened: {e.opened.map(id => getAgent(id).short).join(', ')}</span>}
                  </div>
                  {e.reason && <p className="muted small hist-why">{e.reason}</p>}
                </div>
                <button type="button" className="btn small" onClick={() => onAskAgain(e.query)}>Ask again <ArrowUpRight size={14} aria-hidden="true" /></button>
              </Panel>
            </li>
          );
        })}
      </ol>
    </>
  );
}
