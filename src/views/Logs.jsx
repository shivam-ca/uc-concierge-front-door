import { useMemo, useState } from 'react';
import { Download, Search, Trash2 } from 'lucide-react';
import { Panel, Pill } from '../components/Glass.jsx';
import { filterEntries, exportJson } from '../lib/activityLog.js';
import { fmtTime } from './History.jsx';

const TONE = { info: 'info', warn: 'warn', error: 'bad' };
const LEVELS = ['all', 'info', 'warn', 'error'];
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** What the app itself did, as plain log lines: routing, fallbacks, errors, hand-offs, settings changes. */
export default function Logs({ entries, onClear }) {
  const [text, setText] = useState('');
  const [level, setLevel] = useState('all');
  const [confirm, setConfirm] = useState(false);
  const rows = useMemo(() => filterEntries(entries, { level, text }), [entries, level, text]);

  const download = () => {
    const url = URL.createObjectURL(new Blob([exportJson(entries)], { type: 'application/json' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `uc-concierge-log-${new Date().toISOString().slice(0, 10)}.json` });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <>
      <header className="page-head">
        <h1><span className="grad">Logs</span></h1>
        <p>What this app did in your browser, newest first. Server-side logs for the routing call live in the Vercel project, not here.</p>
      </header>
      <div className="log-tools">
        <label className="log-search">
          <Search size={15} aria-hidden="true" />
          <span className="visually-hidden">Search the logs</span>
          <input className="field" type="search" placeholder="Search the logs" value={text} onChange={(e) => setText(e.target.value)} />
        </label>
        <div className="chips-row" role="group" aria-label="Filter by level">
          {LEVELS.map(l => <button key={l} type="button" className="chip" aria-pressed={level === l} onClick={() => setLevel(l)}>{cap(l)}</button>)}
        </div>
        <div className="row">
          <button type="button" className="btn small" onClick={download} disabled={!entries.length}><Download size={14} aria-hidden="true" /> Download</button>
          {confirm
            ? <><button type="button" className="btn small" onClick={() => { onClear(); setConfirm(false); }}>Yes, clear everything</button><button type="button" className="btn small" onClick={() => setConfirm(false)}>Keep</button></>
            : <button type="button" className="btn small" onClick={() => setConfirm(true)} disabled={!entries.length}><Trash2 size={14} aria-hidden="true" /> Clear</button>}
        </div>
      </div>
      <p className="muted log-status" role="status" aria-live="polite">
        {!entries.length ? 'Nothing logged yet.' : !rows.length ? 'Nothing matches.' : `${rows.length} of ${entries.length} line${entries.length === 1 ? '' : 's'}. The newest 300 are kept; clearing also clears History.`}
      </p>
      {rows.length > 0 && (
        <Panel className="logs-panel" spot={false}>
          <ol className="log-lines">
            {rows.map(e => (
              <li key={e.id} className={`log-line lvl-${e.level}`}>
                <time className="mono" dateTime={e.at}>{fmtTime(e.at)}</time>
                <Pill tone={TONE[e.level]}>{e.level}</Pill>
                <span className="log-msg">{e.message || e.query}</span>
              </li>
            ))}
          </ol>
        </Panel>
      )}
    </>
  );
}
