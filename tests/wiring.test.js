import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const src = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');

describe('page wiring', () => {
  it('the handoff page detaches its opener before rendering anything', () => {
    const main = src('handoff/main.jsx');
    expect(main.indexOf('severOpener()')).toBeGreaterThan(-1);
    expect(main.indexOf('severOpener()')).toBeLessThan(main.indexOf('createRoot('));
  });
  it('the handoff effect cancels its wait on cleanup (StrictMode-safe)', () => {
    const h = src('handoff/Handoff.jsx');
    expect(h).toMatch(/waitForDecision\(nonce, \{ signal: ctrl\.signal \}\)/);
    expect(h).toMatch(/ctrl\.abort\(\)/);
  });
  it('the front door sweeps leftover hand-off entries on load', () => {
    expect(src('main.jsx')).toContain('sweepHandoffs()');
  });
});

describe('accessibility wiring', () => {
  it('the liquid-glass button exposes aria-disabled and Home uses it for the empty/busy search', () => {
    expect(src('components/Glass.jsx')).toMatch(/aria-disabled=\{disabled \|\| undefined\}/);
    expect(src('views/Home.jsx')).toMatch(/disabled=\{!text\.trim\(\) \|\| busy\}/);
  });
});

describe('default zoom and activity pages', () => {
  it('opens at 75% zoom and sizes the app to fill the viewport at that zoom', () => {
    const css = src('styles.css');
    expect(css).toMatch(/html \{ zoom: 0\.75; \}/);
    expect(css).toMatch(/\.app \{ min-height: calc\(100vh \/ 0\.75\); \}/);
  });
  it('History and Logs are routed and in the nav', () => {
    const app = src('App.jsx');
    expect(app).toMatch(/hash === 'history'/);
    expect(app).toMatch(/hash === 'logs'/);
    expect(app).toContain('href="#history"');
    expect(app).toContain('href="#logs"');
  });
});

describe('light theme and doorway signature', () => {
  it('has a top-bar toggle, a light block on data-theme, and the arch + threshold signature', () => {
    expect(src('App.jsx')).toContain('className="theme-toggle"');
    const css = src('styles.css');
    expect(css).toMatch(/html\[data-theme="light"\] \{[^}]*--accent: #1f4fa3/);
    expect(css).toContain('.hero::before');
    expect(css).toContain('.search-form::after');
  });
});
