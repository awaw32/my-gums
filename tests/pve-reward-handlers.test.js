import { describe, it, expect } from 'vitest';
import { createWorldHandler } from '../server/network/worldHandler.js';
import { createPveModeRewards } from '../server/logic/pveModeRewards.js';
import { createAchievementRewards } from '../server/logic/achievementRewards.js';

// 🛡️ يستخدم createWorldHandler وcreatePveModeRewards وcreateAchievementRewards
// الحقيقيين — يتحقق أن رسائل pve_claim_reward وalliance_raid_claim_reward
// وachievement_claim_reward موصولة فعلياً بمنطق الحدود على الخادم، وليس فقط
// أن الوحدات المنطقية تعمل بمعزل.

function makeFakeWs() {
  const received = [];
  return { received, readyState: 1, send: (msg) => received.push(JSON.parse(msg)) };
}

function createTestEnv() {
  const worldClients = new Map();
  const worldMonsters = [];
  const worldDrops = [];
  const memStore = new Map();
  const combatSystem = { initWorldMonsters: () => {} };
  const getDefaultPlayer = (username) => ({ username, army_power: 5000, gold: 0, cash: 0, gems: 0 });
  const markDirty = () => {};
  const noopCost = () => ({ cash: 0, gold: 0, hammers: 0 });
  const noopStats = () => ({ maxTroops: 8, hpBonus: 0 });
  const pveModeRewards = createPveModeRewards({ memStore, getDefaultPlayer, markDirty });
  const achievementRewards = createAchievementRewards({ memStore, getDefaultPlayer, markDirty });

  const handleWorldConnection = createWorldHandler({
    worldMonsters, worldDrops, worldClients, combatSystem, memStore, getDefaultPlayer, markDirty,
    computeArmyYardUpgradeCost: noopCost, computeArmyYardStats: noopStats,
    computeKnowledgeUpgradeCost: noopCost, computeKnowledgeBonuses: () => ({}),
    claimReward: () => ({ ok: false }), applyWeaponUpgrade: () => ({ ok: false }),
    computeWeaponDamageWithUpgrades: () => ({ weaponDamage: 0, critChance: 0, critMultiplier: 1 }),
    applyBuildingUpgrade: () => ({ ok: false }), BUILDING_DEFS: [],
    applyResearchUpgrade: () => ({ ok: false }), warManager: { handleMessage: () => null }, broadcastBus: null,
    pveModeRewards, achievementRewards,
  });

  return { memStore, handleWorldConnection };
}

function makeConnectedClient(handleWorldConnection, username) {
  const ws = makeFakeWs();
  ws.on = (event, cb) => { if (event === 'message') ws._onMessage = cb; };
  ws.close = () => {};
  const req = { socket: { remoteAddress: '127.0.0.1' } };
  handleWorldConnection(ws, req);
  const send = (msg) => ws._onMessage(Buffer.from(JSON.stringify(msg)));
  send({ type: 'join', username });
  ws.received.length = 0;
  return { ws, send };
}

describe('🛡️ رسائل pve_claim_reward وalliance_raid_claim_reward (worldHandler.js الحقيقي)', () => {
  it('pve_claim_reward يمنح الذهب فعلياً في memStore ويرد بنجاح', () => {
    const { memStore, handleWorldConnection } = createTestEnv();
    const client = makeConnectedClient(handleWorldConnection, 'p1');
    client.send({ type: 'pve_claim_reward', mode: 'horde', payload: { gold: 300, xp: 100, wave: 5, kills: 20 } });
    const resp = client.ws.received.find(m => m.type === 'pve_claim_reward_response');
    expect(resp.ok).toBe(true);
    expect(resp.grantedGold).toBe(300);
    expect(memStore.get('p1').gold).toBe(300);
  });

  it('pve_claim_reward يرفض بيانات مستحيلة فيزيائياً (wave خيالية)', () => {
    const { handleWorldConnection } = createTestEnv();
    const client = makeConnectedClient(handleWorldConnection, 'p1');
    client.send({ type: 'pve_claim_reward', mode: 'horde', payload: { gold: 100, wave: 9999, kills: 1 } });
    const resp = client.ws.received.find(m => m.type === 'pve_claim_reward_response');
    expect(resp.ok).toBe(false);
    expect(resp.reason).toBe('implausible_data');
  });

  it('alliance_raid_claim_reward يمنح جدول المكافآت الثابت للمستوى المطلوب', () => {
    const { memStore, handleWorldConnection } = createTestEnv();
    const client = makeConnectedClient(handleWorldConnection, 'p1');
    client.send({ type: 'alliance_raid_claim_reward', raidLevel: 1 });
    const resp = client.ws.received.find(m => m.type === 'alliance_raid_claim_reward_response');
    expect(resp.ok).toBe(true);
    expect(resp.granted.cash).toBe(5000);
    expect(memStore.get('p1').cash).toBe(5000);
  });

  it('alliance_raid_claim_reward لا يقبل مستوى غارة يتجاوز الجدول الحقيقي', () => {
    const { handleWorldConnection } = createTestEnv();
    const client = makeConnectedClient(handleWorldConnection, 'p1');
    client.send({ type: 'alliance_raid_claim_reward', raidLevel: 50 });
    const resp = client.ws.received.find(m => m.type === 'alliance_raid_claim_reward_response');
    expect(resp.ok).toBe(false);
  });

  it('لا يخلط الحدود اليومية بين لاعبين مختلفين', () => {
    const { memStore, handleWorldConnection } = createTestEnv();
    const p1 = makeConnectedClient(handleWorldConnection, 'p1');
    const p2 = makeConnectedClient(handleWorldConnection, 'p2');
    p1.send({ type: 'pve_claim_reward', mode: 'cave', payload: { gold: 500, depth: 3 } });
    p2.send({ type: 'pve_claim_reward', mode: 'cave', payload: { gold: 700, depth: 4 } });
    expect(memStore.get('p1').gold).toBe(500);
    expect(memStore.get('p2').gold).toBe(700);
  });

  it('achievement_claim_reward يمنح مكافأة إنجاز حقيقي ويرفض إعادة الاستلام', () => {
    const { memStore, handleWorldConnection } = createTestEnv();
    const client = makeConnectedClient(handleWorldConnection, 'p1');
    client.send({ type: 'achievement_claim_reward', achievementId: 'first_kill' });
    const first = client.ws.received.find(m => m.type === 'achievement_claim_reward_response');
    expect(first.ok).toBe(true);
    expect(memStore.get('p1').gold).toBe(50);

    client.ws.received.length = 0;
    client.send({ type: 'achievement_claim_reward', achievementId: 'first_kill' });
    const second = client.ws.received.find(m => m.type === 'achievement_claim_reward_response');
    expect(second.ok).toBe(false);
    expect(second.reason).toBe('already_claimed');
    expect(memStore.get('p1').gold).toBe(50); // لم يتضاعف
  });

  it('achievement_claim_reward يرفض معرّف إنجاز مزيّف غير موجود', () => {
    const { handleWorldConnection } = createTestEnv();
    const client = makeConnectedClient(handleWorldConnection, 'p1');
    client.send({ type: 'achievement_claim_reward', achievementId: 'fake_id_xyz' });
    const resp = client.ws.received.find(m => m.type === 'achievement_claim_reward_response');
    expect(resp.ok).toBe(false);
    expect(resp.reason).toBe('unknown_achievement');
  });
});
