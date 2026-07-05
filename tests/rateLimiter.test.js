import { describe, it, expect } from 'vitest';
const { makeRateLimiter } = require('../server/network/rateLimiter');

describe('makeRateLimiter', () => {
  it('should allow requests within limit', () => {
    const check = makeRateLimiter({ maxPerSec: 10 });
    for (let i = 0; i < 10; i++) {
      expect(check()).toBe(true);
    }
  });

  it('should reject requests exceeding limit', () => {
    const check = makeRateLimiter({ maxPerSec: 5 });
    for (let i = 0; i < 5; i++) check();
    expect(check()).toBe(false);
  });

  it('should reset after 1 second', async () => {
    const check = makeRateLimiter({ maxPerSec: 2 });
    check(); check();
    expect(check()).toBe(false);
    await new Promise(r => setTimeout(r, 1100));
    expect(check()).toBe(true);
  });

  it('should default to 30 per second', () => {
    const check = makeRateLimiter();
    let ok = true;
    for (let i = 0; i < 30; i++) { if (!check()) ok = false; }
    expect(ok).toBe(true);
    expect(check()).toBe(false);
  });
});
