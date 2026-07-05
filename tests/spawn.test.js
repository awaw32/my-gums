import { describe, it, expect } from 'vitest';
const { spawnPlayer, respawnPlayer, MAP_MIN, MAP_MAX } = require('../server/systems/spawn');

function makePlayer(hp) {
  return { id: 'p1', x: 0, y: 0, hp: hp || 100, maxHp: 150, alive: true };
}

describe('spawnPlayer', () => {
  it('should set position within map bounds', () => {
    const p = makePlayer();
    spawnPlayer(p);
    expect(p.x).toBeGreaterThanOrEqual(MAP_MIN);
    expect(p.x).toBeLessThanOrEqual(MAP_MAX);
    expect(p.y).toBeGreaterThanOrEqual(MAP_MIN);
    expect(p.y).toBeLessThanOrEqual(MAP_MAX);
  });

  it('should reset hp to maxHp', () => {
    const p = makePlayer(10);
    spawnPlayer(p);
    expect(p.hp).toBe(150);
  });

  it('should set alive to true', () => {
    const p = makePlayer();
    p.alive = false;
    spawnPlayer(p);
    expect(p.alive).toBe(true);
  });
});

describe('respawnPlayer', () => {
  it('should behave like spawnPlayer', () => {
    const p = makePlayer(5);
    p.alive = false;
    respawnPlayer(p);
    expect(p.alive).toBe(true);
    expect(p.hp).toBe(150);
    expect(p.x).toBeGreaterThanOrEqual(MAP_MIN);
  });
});
