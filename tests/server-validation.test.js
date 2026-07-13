import { describe, it, expect } from 'vitest';
import { sanitizePlayerData } from '../server/validation/player.js';

describe('Player Data Validation', () => {
  it('should accept valid player data', () => {
    const data = {
      cash: 1000,
      gold: 500,
      level: 10,
      unitLevel: 3,
      weapons: [{ id: 'w1', level: 1, starLevel: 1, gemLevel: 1 }]
    };
    const result = sanitizePlayerData(data);
    expect(result.cash).toBe(1000);
    expect(result.level).toBe(10);
  });

  it('should reject negative resources', () => {
    expect(() => sanitizePlayerData({ cash: -100 })).toThrow();
  });

  it('should reject level above maximum', () => {
    expect(() => sanitizePlayerData({ level: 999 })).toThrow();
  });

  it('should reject unknown fields (strict mode)', () => {
    expect(() => sanitizePlayerData({ hackedField: true })).toThrow();
  });

  it('should allow last_active only', () => {
    const result = sanitizePlayerData({ last_active: Date.now() });
    expect(result.last_active).toBeGreaterThan(0);
  });

  it('should reject invalid knowledgeType', () => {
    expect(() => sanitizePlayerData({ knowledgeType: 'hacker' })).toThrow();
  });
});
