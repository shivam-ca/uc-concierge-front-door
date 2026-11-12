import { describe, it, expect } from 'vitest';
import pkg from '../package.json' with { type: 'json' };

describe('scaffold', () => {
  it('is an ES module project with a test script', () => {
    expect(pkg.type).toBe('module');
    expect(pkg.scripts.test).toBe('vitest run');
  });
});
