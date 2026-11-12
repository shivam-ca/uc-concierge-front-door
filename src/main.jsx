import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

document.fonts?.ready.then(() => window.dispatchEvent(new Event('resize'))); // liquid-glass-react re-measures
createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>);
