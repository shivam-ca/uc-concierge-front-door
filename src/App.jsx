import { useCallback, useEffect, useRef, useState } from 'react';
import { Aurora } from './components/Glass.jsx';
import Toast from './components/Toast.jsx';
import Home from './views/Home.jsx';
import Results from './views/Results.jsx';
import Agents from './views/Agents.jsx';
import Settings from './views/Settings.jsx';
import ComingSoon from './views/ComingSoon.jsx';
import History from './views/History.jsx';
import Logs from './views/Logs.jsx';
import { loadLog, addEntry, markOpened, clearLog } from './lib/activityLog.js';
import { getAgent } from './config/agents.js';
import { loadTheme, saveTheme, applyTheme } from './lib/theme.js';
import { Moon, Sun } from 'lucide-react';
import { loadSettings, saveSettings } from './lib/settings.js';
import { routeRequest } from './lib/routeClient.js';
import { newNonce, openHandoffTab, publishDecision } from './lib/handoffChannel.js';
import { resolveAgentUrl, buildAgentUrl } from './lib/agentUrl.js';
import { agentUrls, runSubmit } from './lib/submitFlow.js';
import { CONFIDENCE_THRESHOLD } from './config/agents.js';

const ENV = import.meta.env;
const IDLE = { busy: false, query: '', decision: null, blocked: false, reqId: null };

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
  const setSettings = (s) => { setSettingsState(s); saveSettings(s); log({ type: 'settings', message: 'Settings saved (agent addresses and passcode are stored in this browser).' }); };
  const [theme, setTheme] = useState(loadTheme);
  useEffect(() => { applyTheme(theme); }, [theme]);
  const toggleTheme = () => { const next = theme === 'light' ? 'dark' : 'light'; setTheme(next); saveTheme(next); };
  const [activity, setActivityState] = useState(loadLog);
  const activityRef = useRef(activity); // the latest list, readable synchronously (state updaters run later)
  const setActivity = (next) => { activityRef.current = next; setActivityState(next); };
  // Returns the new entry's id so a request can later be marked as opened.
  const log = (entry) => { const next = addEntry(activityRef.current, entry); setActivity(next); return next.at(-1).id; };
  const [state, setState] = useState(IDLE);
  const [draft, setDraft] = useState('');
  const [toast, setToast] = useState('');
  const clearToast = useCallback(() => setToast(''), []);
  const urlFor = (id) => resolveAgentUrl(id, { settings, env: ENV });

  useEffect(() => {
    document.title = hash === 'history' ? 'History · UC Concierge' : hash === 'logs' ? 'Logs · UC Concierge' : hash === 'agents' ? 'Agents · UC Concierge' : hash === 'settings' ? 'Settings · UC Concierge' : 'UC Concierge';
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
      copy: (text) => navigator.clipboard.writeText(text),
    }).then((out) => {
      if (out.error) {
        log({ type: 'error', level: 'error', query, message: `Request not routed (${out.error}): ${out.message}` });
        setState({ ...IDLE, query });
        setToast(out.error === 'passcode' ? 'This front door needs a passcode. Add it under Settings, then try again.' : out.message);
        return;
      }
      const d = out.decision;
      const low = d.confidence < CONFIDENCE_THRESHOLD;
      const reqId = log({ type: 'request', level: d.fallback || low ? 'warn' : 'info', query, agent: d.agent, confidence: d.confidence, reason: d.reason, provider: d.provider, fallback: Boolean(d.fallback), low, ms: d.ms,
        message: `Routed “${query.length > 80 ? query.slice(0, 80) + '…' : query}” to ${getAgent(d.agent).short} (${Math.round(d.confidence * 100)}%, ${d.provider}${d.ms ? `, ${d.ms}ms` : ''})${d.fallback ? ' via keyword fallback' : ''}${low ? ', low confidence: user chose' : ''}` });
      if (out.blocked) log({ type: 'app', level: 'warn', message: 'The hand-off tab was blocked or closed before it opened.' });
      setState({ busy: false, query, decision: d, blocked: out.blocked, copied: out.copied, reqId });
    });
  };

  const onOpen = (id) => {
    const url = buildAgentUrl(urlFor(id), state.query);
    if (url) window.open(url, '_blank', 'noopener');
    else location.hash = `soon/${id}`;
    log({ type: 'open', agent: id, query: state.query, message: url ? `Opened ${getAgent(id).short} with the request.` : `${getAgent(id).short} has no app yet; showed the coming-soon page.` });
    if (state.reqId) setActivity(markOpened(activityRef.current, state.reqId, id));
  };

  const reset = () => { setState(IDLE); setDraft(''); };
  const askAgain = (q) => { setState(IDLE); setDraft(q); location.hash = ''; };

  let view;
  if (hash === 'history') view = <History entries={activity} onAskAgain={askAgain} />;
  else if (hash === 'logs') view = <Logs entries={activity} onClear={() => setActivity(clearLog())} />;
  else if (hash === 'agents') view = <Agents settings={settings} />;
  else if (hash === 'settings') view = <Settings settings={settings} setSettings={setSettings} />;
  else if (hash.startsWith('soon/')) view = <ComingSoon id={hash.slice(5)} query={state.query} />;
  else if (state.decision) view = <Results query={state.query} decision={state.decision} blocked={state.blocked} copied={state.copied} hasUrl={(id) => Boolean(buildAgentUrl(urlFor(id), 'x'))} onOpen={onOpen} onReset={reset} />;
  else view = <Home key={state.query ? 'q' : 'empty'} onSubmit={onSubmit} busy={state.busy} initialText={draft} />;

  const onAsk = !['agents', 'settings', 'history', 'logs'].includes(hash) && !hash.startsWith('soon/');
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
          <a href="#history" aria-current={hash === 'history' ? 'page' : undefined}>History</a>
          <a href="#logs" aria-current={hash === 'logs' ? 'page' : undefined}>Logs</a>
          <a href="#agents" aria-current={hash === 'agents' ? 'page' : undefined}>Agents</a>
          <a href="#settings" aria-current={hash === 'settings' ? 'page' : undefined}>Settings</a>
        </nav>
        <button type="button" className="theme-toggle" onClick={toggleTheme} aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'} title={theme === 'light' ? 'Dark mode' : 'Light mode'}>
          {theme === 'light' ? <Moon size={16} aria-hidden="true" /> : <Sun size={16} aria-hidden="true" />}
        </button>
      </header>
      <main className="page" id="main" tabIndex={-1}>{view}</main>
      <footer className="foot">
        <span className="foot-logos"><img src="/brand/kroger.png" alt="Kroger" height="26" /><img src="/brand/8451.png" alt="84.51°" height="18" /></span>
        <span>UC Concierge Suite · Requests go to the agent you pick; the Orchestrator only decides where.</span>
      </footer>
      <Toast message={toast} onDone={clearToast} />
    </div>
  );
}
