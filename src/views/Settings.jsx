import { useState } from 'react';
import { TriangleAlert } from 'lucide-react';
import { Panel } from '../components/Glass.jsx';
import { AgentAvatar } from '../components/AgentMark.jsx';
import { AGENTS, getAgent } from '../config/agents.js';
import { resolveAgentUrl, findPortClashes, urlProblem } from '../lib/agentUrl.js';

const IDS = AGENTS.filter(a => a.kind !== 'platform').map(a => a.id);

export default function Settings({ settings, setSettings }) {
  const [draft, setDraft] = useState({ urls: { ...settings.urls }, passcode: settings.passcode });
  const [saved, setSaved] = useState(false);
  const [tried, setTried] = useState(false);
  const problems = Object.fromEntries(IDS.map(id => [id, urlProblem(draft.urls[id])]));
  const hasProblems = Object.values(problems).some(Boolean);
  const effective = Object.fromEntries(IDS.map(id => [id, problems[id] ? null : resolveAgentUrl(id, { settings: draft, env: import.meta.env })]));
  const clashes = findPortClashes(effective);
  const edit = (patch) => { setSaved(false); setDraft(d => ({ ...d, ...patch })); };

  const save = (e) => {
    e.preventDefault();
    setTried(true);
    if (hasProblems) return;
    const urls = Object.fromEntries(Object.entries(draft.urls).map(([k, v]) => [k, v.trim()]).filter(([, v]) => v));
    setSettings({ urls, passcode: draft.passcode });
    setSaved(true);
  };

  return (
    <>
      <header className="page-head">
        <h1><span className="grad">Settings</span></h1>
        <p>Where each agent runs for you. Saved in this browser only. Leave a field blank to use the default.</p>
      </header>
      <div className="result-wrap" style={{ marginTop: 0, maxWidth: 760, marginInline: 0 }}>
        <Panel className="result" as="form" onSubmit={save} noValidate>
          <div className="form">
            {IDS.map(id => {
              const a = getAgent(id);
              const err = (tried || draft.urls[id]) && problems[id];
              return (
                <div key={id} className="field-label">
                  <label htmlFor={`url-${id}`} className="row" style={{ gap: 10, flexWrap: 'nowrap' }}>
                    <AgentAvatar id={id} size={26} />
                    <span>{a.name} <small>default: {a.defaultUrl || 'none (coming soon)'}</small></span>
                  </label>
                  <input id={`url-${id}`} className="field" type="url" inputMode="url" autoComplete="off" spellCheck={false}
                    placeholder={a.defaultUrl || 'https://…'} value={draft.urls[id] || ''}
                    aria-invalid={err ? 'true' : undefined} aria-describedby={err ? `err-${id}` : undefined}
                    onChange={(e) => edit({ urls: { ...draft.urls, [id]: e.target.value } })} />
                  {err && <span id={`err-${id}`} className="field-error">{problems[id]}</span>}
                </div>
              );
            })}

            {clashes.length > 0 && (
              <p className="note" role="status">
                <TriangleAlert size={14} aria-hidden="true" style={{ verticalAlign: '-2px' }} />{' '}
                {clashes.map(c => `${c.ids.map(i => getAgent(i).short).join(' and ')} both point at ${c.hostPort}`).join('; ')}.
                {' '}Only one app can run on a port at a time. If you run both, start one on another port and enter its address here.
              </p>
            )}

            <div className="field-label">
              <label htmlFor="passcode">Passcode <small>only if your administrator set one</small></label>
              <input id="passcode" className="field" type="password" autoComplete="off" value={draft.passcode} onChange={(e) => edit({ passcode: e.target.value })} />
            </div>

            <div className="row">
              <button className="btn primary" type="submit">Save settings</button>
              <button className="btn" type="button" onClick={() => edit({ urls: {} })}>Reset addresses to defaults</button>
              <span className="muted" role="status" aria-live="polite">{saved ? 'Saved.' : tried && hasProblems ? 'Fix the highlighted address first.' : ''}</span>
            </div>
          </div>
        </Panel>
      </div>
    </>
  );
}
