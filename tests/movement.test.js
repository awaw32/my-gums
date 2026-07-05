import { describe, it, expect, beforeEach } from 'vitest';
const { stepRoom } = require('../server/systems/movement');

function makePlayer(vx, vy) {
  return { id: 'p1', x: 100, y: 100, vx, vy, anim: 'idle', dir: 0 };
}

function makeRoom(players) {
  const m = new Map();
  players.forEach((p, i) => m.set(`p${i}`, p));
  return { players: m, tick: 0 };
}

describe('stepRoom', () => {
  it('should move player in positive x direction', () => {
    const p = makePlayer(1, 0);
    const room = makeRoom([p]);
    stepRoom(room);
    expect(p.x).toBe(104);
    expect(p.y).toBe(100);
  });

  it('should move player in positive y direction', () => {
    const p = makePlayer(0, 1);
    const room = makeRoom([p]);
    stepRoom(room);
    expect(p.x).toBe(100);
    expect(p.y).toBe(104);
  });

  it('should clamp player to world bounds (0-3200)', () => {
    const p = makePlayer(-1, -1);
    p.x = 0; p.y = 0;
    const room = makeRoom([p]);
    stepRoom(room);
    expect(p.x).toBe(0);
    expect(p.y).toBe(0);
  });

  it('should not move stationary player', () => {
    const p = makePlayer(0, 0);
    const room = makeRoom([p]);
    stepRoom(room);
    expect(p.x).toBe(100);
    expect(p.y).toBe(100);
  });

  it('should normalize diagonal movement', () => {
    const p = makePlayer(1, 1);
    const room = makeRoom([p]);
    stepRoom(room);
    const dist = Math.hypot(p.x - 100, p.y - 100);
    expect(dist).toBeCloseTo(4, 1);
  });
});
