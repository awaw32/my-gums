import { describe, it, expect, vi } from 'vitest';
import { createWorldHandler } from '../server/network/worldHandler.js';

// 🛡️ قبل هذا الإصلاح: أي استثناء غير متوقع داخل معالجة رسالة WS (خطأ برمجي
// حقيقي في أي مسار) كان إما يُبتلع بصمت تام، أو يتسبب بانهيار العملية بالكامل
// (uncaughtException يوقف الخادم لكل اللاعبين المتصلين بسبب رسالة واحدة فاسدة
// من عميل واحد). الآن يُلتقط الخطأ داخل try/catch حول كامل معالج الرسالة —
// الاتصال المسبِّب للخطأ فقط يتأثر، وبقية الخادم يستمر بلا انقطاع.

function makeFakeWs() {
  const received = [];
  return { received, readyState: 1, send: (msg) => received.push(JSON.parse(msg)) };
}

function createTestEnv({ applyBuildingUpgrade } = {}) {
  const worldClients = new Map();
  const worldMonsters = [];
  const worldDrops = [];
  const memStore = new Map();
  const combatSystem = { initWorldMonsters: () => {} };
  const getDefaultPlayer = (username) => ({ username, army_power: 5000 });
  const markDirty = () => {};
  const noopCost = () => ({ cash: 0, gold: 0, hammers: 0 });
  const noopStats = () => ({ maxTroops: 8, hpBonus: 0 });

  const handleWorldConnection = createWorldHandler({
    worldMonsters, worldDrops, worldClients, combatSystem, memStore, getDefaultPlayer, markDirty,
    computeArmyYardUpgradeCost: noopCost, computeArmyYardStats: noopStats,
    computeKnowledgeUpgradeCost: noopCost, computeKnowledgeBonuses: () => ({}),
    claimReward: () => ({ ok: false }), applyWeaponUpgrade: () => ({ ok: false }),
    computeWeaponDamageWithUpgrades: () => ({ weaponDamage: 0, critChance: 0, critMultiplier: 1 }),
    applyBuildingUpgrade: applyBuildingUpgrade || (() => ({ ok: false })),
    BUILDING_DEFS: [],
    applyResearchUpgrade: () => ({ ok: false }), warManager: { handleMessage: () => null }, broadcastBus: null,
  });

  return { worldClients, handleWorldConnection };
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

describe('🛡️ صمود worldHandler.js أمام استثناء غير متوقع داخل معالجة رسالة', () => {
  it('استثناء في معالج رسالة واحد لا يُسقط الاتصال ولا يمنع رسائل لاحقة صحيحة', () => {
    // نحاكي خطأ برمجي حقيقي عبر applyBuildingUpgrade التي ترمي استثناءً
    const throwingUpgrade = () => { throw new Error('bug: unexpected null reference'); };
    const { handleWorldConnection } = createTestEnv({ applyBuildingUpgrade: throwingUpgrade });
    const client = makeConnectedClient(handleWorldConnection, 'p1');

    // لا يجب أن يرمي استثناءً للخارج — يجب أن يُلتقط داخلياً
    expect(() => {
      client.send({ type: 'upgrade_building', buildingId: 'b1' });
    }).not.toThrow();

    // الاتصال يبقى حياً ويستطيع معالجة رسائل صحيحة لاحقة بلا مشكلة
    expect(() => {
      client.send({ type: 'ping' });
    }).not.toThrow();
  });

  it('استثناء في اتصال لاعب واحد لا يمنع لاعباً آخر من العمل بشكل طبيعي', () => {
    const throwingUpgrade = () => { throw new Error('bug: unexpected null reference'); };
    const { handleWorldConnection, worldClients } = createTestEnv({ applyBuildingUpgrade: throwingUpgrade });
    const buggyClient = makeConnectedClient(handleWorldConnection, 'buggy_player');
    const healthyClient = makeConnectedClient(handleWorldConnection, 'healthy_player');

    buggyClient.send({ type: 'upgrade_building', buildingId: 'b1' });

    // اللاعب السليم ما زال موجوداً في worldClients ويستطيع إرسال رسائل عادية
    expect(worldClients.has('healthy_player')).toBe(true);
    expect(() => {
      healthyClient.send({ type: 'ping' });
    }).not.toThrow();
  });
});
