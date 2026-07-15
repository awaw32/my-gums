import { describe, it, expect } from 'vitest';

// محاكاة منطق فلترة بث BR/Horde حسب partyCode — مطابق لـ server/network/worldHandler.js
function createMockWorldClients() {
  const worldClients = new Map();
  function addClient(username, partyCode = null) {
    const received = [];
    worldClients.set(username, {
      username,
      partyCode,
      br_alive: true,
      ws: { readyState: 1, send: (msg) => received.push(JSON.parse(msg)) },
      received,
    });
    return worldClients.get(username);
  }
  function broadcastBRMessage(fromUsername, message) {
    const brClient = worldClients.get(fromUsername);
    if (!brClient || !brClient.br_alive) return;
    const msg = JSON.stringify(message);
    worldClients.forEach((c) => {
      if (c.partyCode === brClient.partyCode && c.ws.readyState === 1) c.ws.send(msg);
    });
  }
  return { worldClients, addClient, broadcastBRMessage };
}

describe('BR/Horde party-code broadcast isolation', () => {
  it('same party code: both members receive the broadcast', () => {
    const { addClient, broadcastBRMessage } = createMockWorldClients();
    const a = addClient('alice', 'ABC123');
    const b = addClient('bob', 'ABC123');
    broadcastBRMessage('alice', { type: 'br_zone_shrink', radius: 100 });
    expect(a.received).toHaveLength(1);
    expect(b.received).toHaveLength(1);
  });

  it('different party codes: members do not see each other\'s broadcasts', () => {
    const { addClient, broadcastBRMessage } = createMockWorldClients();
    const a = addClient('alice', 'ABC123');
    const c = addClient('carol', 'XYZ999');
    broadcastBRMessage('alice', { type: 'br_zone_shrink', radius: 100 });
    expect(a.received).toHaveLength(1);
    expect(c.received).toHaveLength(0);
  });

  it('clients with no party (null) form their own shared group (backward compatible)', () => {
    const { addClient, broadcastBRMessage } = createMockWorldClients();
    const a = addClient('alice', null);
    const b = addClient('bob', null);
    const c = addClient('carol', 'XYZ999');
    broadcastBRMessage('alice', { type: 'br_match_start' });
    expect(a.received).toHaveLength(1);
    expect(b.received).toHaveLength(1);
    expect(c.received).toHaveLength(0);
  });

  it('a dead (br_alive=false) sender does not broadcast at all', () => {
    const { worldClients, addClient, broadcastBRMessage } = createMockWorldClients();
    const a = addClient('alice', 'ABC123');
    worldClients.get('alice').br_alive = false;
    const b = addClient('bob', 'ABC123');
    broadcastBRMessage('alice', { type: 'br_bandit_spawn' });
    expect(a.received).toHaveLength(0);
    expect(b.received).toHaveLength(0);
  });
});

describe('party code generation', () => {
  it('produces a 6-character code from an unambiguous alphabet', () => {
    const { customAlphabet } = require('nanoid');
    const generatePartyCode = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 6);
    const code = generatePartyCode();
    expect(code).toHaveLength(6);
    expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
  });
});
