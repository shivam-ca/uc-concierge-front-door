import { describe, it, expect } from 'vitest';
import { resolveAgentUrl, buildAgentUrl, findPortClashes } from '../src/lib/agentUrl.js';

describe('resolveAgentUrl', () => {
  it('falls back to the registry default', () => {
    expect(resolveAgentUrl('onboarding')).toBe('http://127.0.0.1:8784/');
  });
  it('prefers env over default and settings over env', () => {
    const env = { VITE_AGENT_URL_ONBOARDING: 'https://onb.example.com/' };
    expect(resolveAgentUrl('onboarding', { env })).toBe('https://onb.example.com/');
    expect(resolveAgentUrl('onboarding', { env, settings: { urls: { onboarding: 'http://localhost:9000/' } } })).toBe('http://localhost:9000/');
  });
  it('ignores blank overrides', () => {
    expect(resolveAgentUrl('onboarding', { settings: { urls: { onboarding: '   ' } } })).toBe('http://127.0.0.1:8784/');
  });
  it('returns null for coming-soon agents with no override and for unknown ids', () => {
    expect(resolveAgentUrl('access')).toBeNull();
    expect(resolveAgentUrl('nope')).toBeNull();
  });
  it('lets a URL be set for a coming-soon agent', () => {
    expect(resolveAgentUrl('access', { env: { VITE_AGENT_URL_ACCESS: 'https://acc.example.com' } })).toBe('https://acc.example.com');
  });
});

describe('buildAgentUrl', () => {
  it('adds q and from=concierge', () => {
    expect(buildAgentUrl('http://127.0.0.1:8784/', 'I want to create a new catalog'))
      .toBe('http://127.0.0.1:8784/?q=I+want+to+create+a+new+catalog&from=concierge');
  });
  it('keeps an existing query and hash', () => {
    expect(buildAgentUrl('http://127.0.0.1:8765/v7?x=1#log', 'a&b')).toBe('http://127.0.0.1:8765/v7?x=1&q=a%26b&from=concierge#log');
  });
  it('replaces a stale q', () => {
    expect(buildAgentUrl('http://h/?q=old', 'new')).toBe('http://h/?q=new&from=concierge');
  });
  it('returns null for null, malformed, or non-http URLs', () => {
    expect(buildAgentUrl(null, 'x')).toBeNull();
    expect(buildAgentUrl('not a url', 'x')).toBeNull();
    expect(buildAgentUrl('javascript:alert(1)', 'x')).toBeNull();
  });
});

describe('findPortClashes', () => {
  it('reports agents sharing host:port', () => {
    expect(findPortClashes({ tracker: 'http://127.0.0.1:8765/v7', knowledge: 'http://127.0.0.1:8765/chat', onboarding: 'http://127.0.0.1:8784/' }))
      .toEqual([{ hostPort: '127.0.0.1:8765', ids: ['tracker', 'knowledge'] }]);
  });
  it('treats localhost and 127.0.0.1 as different hosts and ignores nulls/bad URLs', () => {
    expect(findPortClashes({ a: 'http://localhost:1/', b: 'http://127.0.0.1:1/', c: null, d: 'bad' })).toEqual([]);
  });
});
