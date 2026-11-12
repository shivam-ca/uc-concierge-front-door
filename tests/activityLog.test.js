import { describe, it, expect } from 'vitest';
import { addEntry, loadLog, markOpened, clearLog, filterEntries, exportJson, MAX_ENTRIES } from '../src/lib/activityLog.js';

const mem = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: k => m.delete(k) }; };
const boom = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); }, removeItem() { throw new Error('x'); } };

describe('activity log', () => {
  it('persists entries and reloads them in order', () => {
    const s = mem();
    let l = addEntry([], { type: 'request', query: 'a', agent: 'tracker' }, { storage: s });
    l = addEntry(l, { type: 'error', level: 'error', message: 'bad' }, { storage: s });
    const back = loadLog(s);
    expect(back.map(e => e.type)).toEqual(['request', 'error']);
    expect(back[1].level).toBe('error');
    expect(back[0].level).toBe('info');
  });
  it('caps at MAX_ENTRIES, dropping the oldest', () => {
    const s = mem();
    let l = [];
    for (let i = 0; i < MAX_ENTRIES + 5; i++) l = addEntry(l, { type: 'app', message: `m${i}` }, { storage: s });
    expect(l).toHaveLength(MAX_ENTRIES);
    expect(l[0].message).toBe('m5');
  });
  it('survives broken storage and corrupt data', () => {
    expect(loadLog(boom)).toEqual([]);
    expect(addEntry([], { type: 'app' }, { storage: boom })).toHaveLength(1);
    const s = mem(); s.setItem('uc-concierge-activity', '{nope');
    expect(loadLog(s)).toEqual([]);
    s.setItem('uc-concierge-activity', JSON.stringify([{ id: 1 }, null, { id: 'a', at: 'x', type: 't' }]));
    expect(loadLog(s)).toHaveLength(1);
  });
  it('marks which agents were opened from a request, once each', () => {
    const s = mem();
    let l = addEntry([], { type: 'request', query: 'q' }, { storage: s });
    const id = l.at(-1).id;
    l = markOpened(l, id, 'tracker', { storage: s });
    l = markOpened(l, id, 'tracker', { storage: s });
    l = markOpened(l, id, 'knowledge', { storage: s });
    expect(loadLog(s)[0].opened).toEqual(['tracker', 'knowledge']);
  });
  it('filters newest first by level, agent and text', () => {
    let l = [];
    const o = { storage: mem() };
    l = addEntry(l, { type: 'request', query: 'Create a catalog', agent: 'onboarding' }, o);
    l = addEntry(l, { type: 'request', query: 'find email', agent: 'tracker', level: 'warn' }, o);
    expect(filterEntries(l).map(e => e.agent)).toEqual(['tracker', 'onboarding']);
    expect(filterEntries(l, { level: 'warn' })).toHaveLength(1);
    expect(filterEntries(l, { agent: 'onboarding' })).toHaveLength(1);
    expect(filterEntries(l, { text: ' CATALOG ' })).toHaveLength(1);
  });
  it('clears and exports', () => {
    const s = mem();
    const l = addEntry([], { type: 'app', message: 'hi' }, { storage: s });
    expect(JSON.parse(exportJson(l))[0].message).toBe('hi');
    expect(clearLog(s)).toEqual([]);
    expect(loadLog(s)).toEqual([]);
  });
});
