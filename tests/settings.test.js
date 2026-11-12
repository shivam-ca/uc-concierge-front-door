import { describe, it, expect } from 'vitest';
import { loadSettings, saveSettings } from '../src/lib/settings.js';

const mem = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };

describe('settings', () => {
  it('round-trips urls and passcode', () => {
    const s = mem();
    saveSettings({ urls: { onboarding: 'http://x/' }, passcode: 'p' }, s);
    expect(loadSettings(s)).toEqual({ urls: { onboarding: 'http://x/' }, passcode: 'p' });
  });
  it('returns defaults for empty, corrupt or throwing storage', () => {
    expect(loadSettings(mem())).toEqual({ urls: {}, passcode: '' });
    const bad = mem(); bad.setItem('uc-concierge-settings', '{oops');
    expect(loadSettings(bad)).toEqual({ urls: {}, passcode: '' });
    const boom = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
    expect(loadSettings(boom)).toEqual({ urls: {}, passcode: '' });
    expect(() => saveSettings({ urls: {}, passcode: '' }, boom)).not.toThrow();
    expect(loadSettings(undefined)).toEqual({ urls: {}, passcode: '' });
  });
  it('drops non-string url values from storage', () => {
    const s = mem(); s.setItem('uc-concierge-settings', JSON.stringify({ urls: { onboarding: 5, tracker: 'http://t/' }, passcode: 1 }));
    expect(loadSettings(s)).toEqual({ urls: { tracker: 'http://t/' }, passcode: '' });
  });
});
