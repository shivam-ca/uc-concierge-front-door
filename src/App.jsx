import { useCallback, useEffect, useState } from 'react';
import { Aurora } from './components/Glass.jsx';
import Toast from './components/Toast.jsx';
import Home from './views/Home.jsx';
import Results from './views/Results.jsx';
import Agents from './views/Agents.jsx';
import Settings from './views/Settings.jsx';
import ComingSoon from './views/ComingSoon.jsx';
import { loadSettings, saveSettings } from './lib/settings.js';
import { routeRequest } from './lib/routeClient.js';
import { newNonce, openHandoffTab, publishDecision } from './lib/handoffChannel.js';
import { resolveAgentUrl, buildAgentUrl } from './lib/agentUrl.js';
import { agentUrls, runSubmit } from './lib/submitFlow.js';

const ENV = import.meta.env;
const IDLE = { busy: false, query: '', decision: null, blocked: false };

function useHash() {
  const [hash, setHash] = useState(() => location.hash.slice(1));
  useEffect(() => {
    const on = () => setHash(location.hash.slice(1));
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  }, []);
  return hash;
}

export default function App() {
  const hash = useHash();
  const [settings, setSettingsState] = useState(loadSettings);
  const setSettings = (s) => { setSettingsState(s); saveSettings(s); };
  const [state, setState] = useState(IDLE);
  const [draft, setDraft] = useState('');
  const [toast, setToast] = useState('');
  const clearToast = useCallback(() => setToast(''), []);
  const urlFor = (id) => resolveAgentUrl(id, { settings, env: ENV });

  useEffect(() => {
    document.title = hash === 'agents' ? 'Agents · UC Concierge' : hash === 'settings' ? 'Settings · UC Concierge' : 'UC Concierge';
    if (hash) window.scrollTo(0, 0);
  }, [hash]);

  // Runs inside the user's click or keypress: runSubmit opens the handoff tab before anything is awaited.
  const onSubmit = (query) => {
    setDraft(query);
    setState({ ...IDLE, busy: true, query });
    runSubmit(query, {
      newNonce,
      openTab: openHandoffTab,
      route: (q) => routeRequest(q, { passcode: settings.passcode }),
      publish: publishDecision,
      urls: () => agentUrls({ settings, env: ENV }),
    }).then((out) => {
      if (out.error) {
        setState({ ...IDLE, query });
        setToast(out.error === 'passcode' ? 'This front door needs a passcode. Add it under Settings, then try again.' : out.message);
        return;
      }
      setState({ busy: false, query, decision: out.decision, blocked: out.blocked });
      navigator.clipboard?.writeText(query).catch(() => {});
    });
  };

  const onOpen = (id) => {
    const url = buildAgentUrl(urlFor(id), state.query);
    if (url) window.open(url, '_blank', 'noopener');
    else location.hash = `soon/${id}`;
  };

  const reset = () => { setState(IDLE); setDraft(''); };

  let view;
  if (hash === 'agents') view = <Agents settings={settings} />;
  else if (hash === 'settings') view = <Settings settings={settings} setSettings={setSettings} />;
  else if (hash.startsWith('soon/')) view = <ComingSoon id={hash.slice(5)} query={state.query} />;
  else if (state.decision) view = <Results query={state.query} decision={state.decision} blocked={state.blocked} hasUrl={(id) => Boolean(buildAgentUrl(urlFor(id), 'x'))} onOpen={onOpen} onReset={reset} />;
  else view = <Home key={state.query ? 'q' : 'empty'} onSubmit={onSubmit} busy={state.busy} initialText={draft} />;

  const onAsk = !['agents', 'settings'].includes(hash) && !hash.startsWith('soon/');
  return (
    <div className="app">
      <a className="skip-link" href="#main" onClick={(e) => { e.preventDefault(); document.getElementById('main')?.focus(); }}>Skip to content</a>
      <Aurora />
      <header className="topbar">
        <a className="brand" href="#" onClick={reset} aria-label="UC Concierge home">
          <span className="brand-mark" aria-hidden="true"><i /></span>
          <span><b>UC Concierge</b><small>Front door to the UC agents</small></span>
        </a>
        <nav className="nav" aria-label="Main">
          <a href="#" onClick={reset} aria-current={onAsk ? 'page' : undefined}>Ask</a>
          <a href="#agents" aria-current={hash === 'agents' ? 'page' : undefined}>Agents</a>
          <a href="#settings" aria-current={hash === 'settings' ? 'page' : undefined}>Settings</a>
        </nav>
      </header>
      <main className="page" id="main" tabIndex={-1}>{view}</main>
      <footer className="foot">UC Concierge Suite · Requests go to the agent you pick; the Orchestrator only decides where.</footer>
      <Toast message={toast} onDone={clearToast} />
    </div>
  );
}
