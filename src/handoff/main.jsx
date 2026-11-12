import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import Handoff from './Handoff.jsx';
import { severOpener } from '../lib/handoffChannel.js';
import '../styles.css';

severOpener(); // the agent page this tab turns into must not be able to navigate the front-door tab
document.fonts?.ready.then(() => window.dispatchEvent(new Event('resize')));
createRoot(document.getElementById('root')).render(<StrictMode><Handoff /></StrictMode>);
