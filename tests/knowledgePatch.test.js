import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const read = (p) => readFileSync(new URL(`../agent-patches/knowledge-agent/${p}`, import.meta.url), 'utf8');
const canonical = readFileSync(new URL('../agent-patches/prefill/concierge-prefill.js', import.meta.url), 'utf8');
const segment = (s) => s.slice(s.indexOf('// --- UC Concierge hand-off'), s.indexOf('// --- end UC Concierge hand-off'));
const norm = (s) => segment(s).split('\n').slice(1).join(' ').replace(/\s+/g, ' ').trim();
const inlineScript = (html) => html.slice(html.lastIndexOf('<script>') + '<script>'.length, html.lastIndexOf('</script>'));

describe('knowledge agent patch', () => {
  it('chat page reads the hand-off once and sends it as a new chat at the end of boot', () => {
    const html = read('web/chat/index.html');
    expect(html).toContain('function takeConciergeRequest(href)');
    expect(html).toMatch(/conciergeHandoff\(\);\s*\n\}\)\(\);/);
    expect(html).toContain('send(fit.text)');
  });
  it('stale-owners page shows the request in a banner and focuses the search, without filtering', () => {
    const html = read('web/stale-owners/index.html');
    expect(html).toContain('function takeConciergeRequest(href)');
    expect(html).toContain('concierge-note');
    expect(html).toMatch(/load\(false\);\s*\nconciergeHandoff\(\);/);
    expect(html).not.toMatch(/addTerms\([^)]*handoff/);
  });
  it('both pages carry the canonical helpers verbatim', () => {
    for (const p of ['web/chat/index.html', 'web/stale-owners/index.html']) expect(norm(read(p))).toBe(norm(canonical));
  });
  it('both inline scripts still parse', () => {
    for (const p of ['web/chat/index.html', 'web/stale-owners/index.html']) {
      expect(() => execFileSync(process.execPath, ['--check', '-'], { input: inlineScript(read(p)) })).not.toThrow();
    }
  });
  it('ships a patch and README', () => {
    expect(read('concierge-prefill.patch')).toContain('+function takeConciergeRequest(href)');
    expect(read('README.md')).toContain('git apply');
  });
});
