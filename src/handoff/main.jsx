import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import Handoff from './Handoff.jsx';
import '../styles.css';

document.fonts?.ready.then(() => window.dispatchEvent(new Event('resize')));
createRoot(document.getElementById('root')).render(<StrictMode><Handoff /></StrictMode>);
