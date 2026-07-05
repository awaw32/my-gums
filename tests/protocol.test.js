import { describe, it, expect } from 'vitest';
const { ClientMessage, MsgJoin, MsgInput, MsgAttack, MsgLeave, ServerState, MsgHit, MsgLoot, MsgError } = require('../server/network/protocol');

describe('MsgJoin', () => {
  it('should accept valid join message', () => {
    const msg = { t: 'join', playerId: 'p1', roomId: 'arena', loadout: { weapon: 'sword', runes: ['fire'] } };
    expect(MsgJoin.safeParse(msg).success).toBe(true);
  });

  it('should reject join without playerId', () => {
    const msg = { t: 'join', roomId: 'arena', loadout: { weapon: 'sword', runes: [] } };
    expect(MsgJoin.safeParse(msg).success).toBe(false);
  });
});

describe('MsgInput', () => {
  it('should accept valid input message', () => {
    const msg = { t: 'input', seq: 1, axes: { x: 0.5, y: 0 }, actions: { dash: true }, ts: Date.now() };
    expect(MsgInput.safeParse(msg).success).toBe(true);
  });

  it('should clamp axis values to [-1, 1]', () => {
    const msg = { t: 'input', seq: 1, axes: { x: 5, y: -3 }, actions: {}, ts: Date.now() };
    const r = MsgInput.safeParse(msg);
    expect(r.success).toBe(false);
  });
});

describe('MsgAttack', () => {
  it('should accept valid attack message', () => {
    const msg = { t: 'attack', targetId: 'p2' };
    expect(MsgAttack.safeParse(msg).success).toBe(true);
  });

  it('should reject attack without targetId', () => {
    const msg = { t: 'attack' };
    expect(MsgAttack.safeParse(msg).success).toBe(false);
  });
});

describe('MsgLeave', () => {
  it('should accept leave message', () => {
    expect(MsgLeave.safeParse({ t: 'leave' }).success).toBe(true);
  });
});

describe('ClientMessage union', () => {
  it('should parse join', () => {
    const msg = { t: 'join', playerId: 'p1', roomId: 'r1', loadout: { weapon: 'spear', runes: [] } };
    expect(ClientMessage.safeParse(msg).success).toBe(true);
  });

  it('should parse attack', () => {
    const msg = { t: 'attack', targetId: 'p2' };
    expect(ClientMessage.safeParse(msg).success).toBe(true);
  });

  it('should reject unknown message type', () => {
    const msg = { t: 'unknown' };
    expect(ClientMessage.safeParse(msg).success).toBe(false);
  });
});

describe('ServerState', () => {
  it('should accept valid state', () => {
    const msg = { t: 'state', tick: 42, players: [{ id: 'p1', x: 100, y: 200, dir: 90 }] };
    expect(ServerState.safeParse(msg).success).toBe(true);
  });
});
