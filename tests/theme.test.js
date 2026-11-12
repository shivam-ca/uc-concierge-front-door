import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { loadTheme, saveTheme, applyTheme } from '../src/lib/theme.js';

const mem = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };
const boom = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); } };

describe('theme', () => {
  it('defaults to light, remembers dark, ignores junk', () => {
    const s = mem();
    expect(loadTheme(s)).toBe('light');
    saveTheme('dark', s);
    expect(loadTheme(s)).toBe('dark');
    s.setItem('uc-concierge-theme', 'neon');
    expect(loadTheme(s)).toBe('light');
  });
  it('survives broken storage', () => {
    expect(loadTheme(boom)).toBe('light');
    expect(() => saveTheme('dark', boom)).not.toThrow();
  });
  it('applies to the root element', () => {
    const attrs = {};
    applyTheme('light', { setAttribute: (k, v) => { attrs[k] = v; } });
    expect(attrs['data-theme']).toBe('light');
  });
  it('both pages start in light before the script runs', () => {
    for (const f of ['index.html', 'handoff.html']) {
      expect(readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')).toContain('<html lang="en" data-theme="light">');
    }
  });
  it('both pages set the saved theme before first paint, with the same key', () => {
    for (const f of ['index.html', 'handoff.html']) {
      const html = readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
      expect(html).toContain('uc-concierge-theme');
      expect(html.indexOf('uc-concierge-theme')).toBeLessThan(html.indexOf('<body'));
    }
  });
});
