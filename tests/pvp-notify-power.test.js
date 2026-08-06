import { describe, it, expect } from 'vitest';
import { createWorldHandler } from '../server/network/worldHandler.js';

// 🛡️ يستخدم createWorldHandler الحقيقي — قبل هذا الإصلاح كانت رسالة pvp_notify
// (تُرسَل للضحية عند pvp_attack) تبث msg.myPower كما أرسله المهاجم حرفياً، بلا
// أي تحقق أو ربط بحسابه الحقيقي — أي عميل خبيث يستطيع إرسال رقم قوة مزيّف
// لتضليل الضحية. الإصلاح: القوة المعروضة تُقرأ من حالة المهاجم الموثوقة
// سيرفرياً (worldClients.get(attacker).army_power) بدل ادّعاء العميل.

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
  // 🛡️ القوة الحقيقية المخزَّنة سيرفرياً للمهاجم — مختلفة عمداً عن أي رقم قد يدّعيه العميل
  const getDefaultPlayer = (username) => ({ username, army_power: 5000 });
  memStore.set('attacker1', { username: 'attacker1', army_power: 7777 });
  const markDirty = () => {};
  const noopCost = () => ({ cash: 0, gold: 0, hammers: 0 });
  const noopStats = () => ({ maxTroops: 8, hpBonus: 0 });

  const handleWorldConnection = createWorldHandler({
    worldMonsters, worldDrops, worldClients, combatSystem, memStore, getDefaultPlayer, markDirty,
    computeArmyYardUpgradeCost: noopCost, computeArmyYardStats: noopStats,
    computeKnowledgeUpgradeCost: noopCost, computeKnowledgeBonuses: () => ({}),
    claimReward: () => ({ ok: false }), applyWeaponUpgrade: () => ({ ok: false }),
    computeWeaponDamageWithUpgrades: () => ({ weaponDamage: 0, critChance: 0, critMultiplier: 1 }),
    applyBuildingUpgrade: () => ({ ok: false }), BUILDING_DEFS: [],
    applyResearchUpgrade: () => ({ ok: false }), warManager: { handleMessage: () => null }, broadcastBus: null,
  });

  return { worldClients, handleWorldConnection };
}

describe('⚔️ pvp_notify يبث القوة الموثوقة سيرفرياً وليس ادّعاء العميل', () => {
  function makeConnectedClient(worldClients, handleWorldConnection, username) {
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

  it('يتجاهل myPower المزيّف من العميل ويستخدم army_power الموثوق للمهاجم', () => {
    const { worldClients, handleWorldConnection } = createTestEnv();
    const attacker = makeConnectedClient(worldClients, handleWorldConnection, 'attacker1');
    const victim = makeConnectedClient(worldClients, handleWorldConnection, 'victim1');

    // المهاجم يدّعي قوة ضخمة مزيّفة (999999) بينما قوته الحقيقية المخزَّنة 7777
    attacker.send({ type: 'pvp_attack', target: 'victim1', myPower: 999999 });

    const notify = victim.ws.received.find(m => m.type === 'pvp_notify');
    expect(notify).toBeTruthy();
    expect(notify.power).toBe(7777);
    expect(notify.power).not.toBe(999999);
  });

  it('لا يبث شيئاً إن كان الهدف غير متصل', () => {
    const { worldClients, handleWorldConnection } = createTestEnv();
    const attacker = makeConnectedClient(worldClients, handleWorldConnection, 'attacker1');
    expect(() => attacker.send({ type: 'pvp_attack', target: 'ghost_user', myPower: 100 })).not.toThrow();
  });
});
