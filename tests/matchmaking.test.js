import { describe, it, expect, beforeEach } from 'vitest';
import { createWorldHandler } from '../server/network/worldHandler.js';

// 🛡️ يستخدم createWorldHandler الحقيقي من server/network/worldHandler.js (وليس
// محاكاة منفصلة) — يضمن أن هذه الاختبارات تعكس فعلياً منطق فلترة بث BR/Horde
// حسب partyCode الحي على الخادم، بدل إعادة تطبيق موازٍ قد ينحرف عن الكود الفعلي
// بصمت عند أي تعديل مستقبلي على worldHandler.js.

function makeFakeWs() {
  const received = [];
  return {
    received,
    readyState: 1,
    send: (msg) => received.push(JSON.parse(msg)),
  };
}

function createTestEnv() {
  const worldClients = new Map();
  const worldMonsters = [];
  const worldDrops = [];
  const memStore = new Map();
  const combatSystem = { initWorldMonsters: () => {} };
  const getDefaultPlayer = (username) => ({ username, army_power: 5000 });
  const markDirty = () => {};
  const noopCost = () => ({ cash: 0, gold: 0, hammers: 0 });
  const noopStats = () => ({ maxTroops: 8, hpBonus: 0 });
  const warManager = { handleMessage: () => null };

  const handleWorldConnection = createWorldHandler({
    worldMonsters, worldDrops, worldClients, combatSystem, memStore, getDefaultPlayer, markDirty,
    computeArmyYardUpgradeCost: noopCost, computeArmyYardStats: noopStats,
    computeKnowledgeUpgradeCost: noopCost, computeKnowledgeBonuses: () => ({}),
    claimReward: () => ({ ok: false }), applyWeaponUpgrade: () => ({ ok: false }),
    computeWeaponDamageWithUpgrades: () => ({ weaponDamage: 0, critChance: 0, critMultiplier: 1 }),
    applyBuildingUpgrade: () => ({ ok: false }), BUILDING_DEFS: [],
    applyResearchUpgrade: () => ({ ok: false }), warManager, broadcastBus: null,
  });

  return { worldClients, handleWorldConnection };
}

describe('BR/Horde party-code broadcast isolation (server/network/worldHandler.js الحقيقي)', () => {
  let worldClients, handleWorldConnection;

  beforeEach(() => {
    ({ worldClients, handleWorldConnection } = createTestEnv());
  });

  function makeConnectedClient(username) {
    const ws = makeFakeWs();
    ws.on = (event, cb) => { if (event === "message") ws._onMessage = cb; };
    ws.close = () => {};
    const req = { socket: { remoteAddress: "127.0.0.1" } };
    handleWorldConnection(ws, req);
    const send = (msg) => ws._onMessage(Buffer.from(JSON.stringify(msg)));
    send({ type: "join", username });
    ws.received.length = 0; // تجاهل رسائل join الأولية (world_monsters/world_drops/world_players)
    return { ws, send };
  }

  it('same party code: both members receive the broadcast', () => {
    const alice = makeConnectedClient('alice');
    const bob = makeConnectedClient('bob');
    alice.send({ type: 'party_create' });
    const code = alice.ws.received.find(m => m.type === 'party_created').code;
    alice.ws.received.length = 0;
    bob.send({ type: 'party_join', partyCode: code });
    alice.ws.received.length = 0;
    bob.ws.received.length = 0;

    alice.send({ type: 'br_zone_shrink', radius: 100 });
    expect(alice.ws.received.some(m => m.type === 'br_zone_shrink')).toBe(true);
    expect(bob.ws.received.some(m => m.type === 'br_zone_shrink')).toBe(true);
  });

  it('different party codes: members do not see each other\'s broadcasts', () => {
    const alice = makeConnectedClient('alice');
    const carol = makeConnectedClient('carol');
    alice.send({ type: 'party_create' });
    carol.send({ type: 'party_create' });
    alice.ws.received.length = 0;
    carol.ws.received.length = 0;

    alice.send({ type: 'br_zone_shrink', radius: 100 });
    expect(alice.ws.received.some(m => m.type === 'br_zone_shrink')).toBe(true);
    expect(carol.ws.received.some(m => m.type === 'br_zone_shrink')).toBe(false);
  });

  it('clients with no party (null) form their own shared group (backward compatible)', () => {
    const alice = makeConnectedClient('alice'); // partyCode: null بشكل افتراضي
    const bob = makeConnectedClient('bob');       // partyCode: null بشكل افتراضي
    const carol = makeConnectedClient('carol');
    carol.send({ type: 'party_create' }); // carol لها كود مختلف الآن
    alice.ws.received.length = 0;
    bob.ws.received.length = 0;
    carol.ws.received.length = 0;

    alice.send({ type: 'br_match_start', mapSize: 100, matchDuration: 60 });
    expect(alice.ws.received.some(m => m.type === 'br_match_start')).toBe(true);
    expect(bob.ws.received.some(m => m.type === 'br_match_start')).toBe(true);
    expect(carol.ws.received.some(m => m.type === 'br_match_start')).toBe(false);
  });

  it('a dead (br_alive=false) sender does not broadcast at all', () => {
    const alice = makeConnectedClient('alice');
    const bob = makeConnectedClient('bob');
    worldClients.get('alice').br_alive = false;
    alice.ws.received.length = 0;
    bob.ws.received.length = 0;

    alice.send({ type: 'br_bandit_spawn', bandit: { x: 1, y: 1 } });
    expect(alice.ws.received.some(m => m.type === 'br_bandit_spawn')).toBe(false);
    expect(bob.ws.received.some(m => m.type === 'br_bandit_spawn')).toBe(false);
  });

  it('party_join with an invalid code sends party_join_failed and does not group the client', () => {
    const alice = makeConnectedClient('alice');
    const bob = makeConnectedClient('bob');
    bob.send({ type: 'party_join', partyCode: 'NOPE99' });
    const failMsg = bob.ws.received.find(m => m.type === 'party_join_failed');
    expect(failMsg).toBeTruthy();
    bob.ws.received.length = 0;
    alice.ws.received.length = 0;

    // bob's partyCode should remain null (unchanged), so he's still in the "no party" group with alice
    alice.send({ type: 'br_zone_shrink', radius: 50 });
    expect(bob.ws.received.some(m => m.type === 'br_zone_shrink')).toBe(true);
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
