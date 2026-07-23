"use strict";

const { ENEMY_TYPES } = require("../data/enemies");
const { sendPush, enabled: pushEnabled } = require("../push");

/**
 * server/logic/caravan-manager.js
 * ============================================================================
 * 🐫 القوافل العشوائية — Caravan Manager
 * كل 120 ثانية (إن لم تكن هناك قافلة نشطة) تظهر قافلة ذهب تتحرك من نقطة A إلى
 * نقطة B عبر الصحراء، يحرسها لصّان صحراويان (desert_thief، عدو موجود مسبقاً —
 * لا تعريف عدو جديد). قتل الحارسين يمنح 200 ذهب إجمالاً عبر نفس مسار
 * monster_killed/computeMonsterReward الموثوق سيرفرياً (لا economy.add على
 * العميل مباشرة — يمنع أي انتحال لمكافأة قافلة لم تُقتل فعلاً).
 * ============================================================================
 */

const CARAVAN_SPAWN_INTERVAL_MS = 120000; // 120 ثانية
const CARAVAN_GOLD_TOTAL = 200;
const GUARD_ENEMY_ID = "desert_thief"; // عدو موجود بالفعل — لا تعريف جديد
const CARAVAN_SPEED = 40; // px/ثانية تقريباً، أبطأ من الوحوش العادية (قافلة تمشي لا تركض)

function createCaravanManager(deps) {
  const { worldMonsters, worldClients, WORLD_W2, WORLD_H2, memStore } = deps;

  let activeCaravan = null; // { id, guardIds: [id1, id2], from: {x,y}, to: {x,y} }
  let spawnTimer = null;

  function randomEdgePoint() {
    // نقطة عشوائية على حدود الخريطة (بعيدة عن المنطقة الآمنة وسط الخريطة)
    const margin = 100;
    const side = Math.floor(Math.random() * 4);
    if (side === 0) return { x: margin, y: 100 + Math.random() * (WORLD_H2 - 200) };
    if (side === 1) return { x: WORLD_W2 - margin, y: 100 + Math.random() * (WORLD_H2 - 200) };
    if (side === 2) return { x: 100 + Math.random() * (WORLD_W2 - 200), y: margin };
    return { x: 100 + Math.random() * (WORLD_W2 - 200), y: WORLD_H2 - margin };
  }

  function broadcastToAll(message) {
    const msg = JSON.stringify(message);
    worldClients.forEach((c) => { if (c.ws.readyState === 1) c.ws.send(msg); });
  }

  function spawnCaravan() {
    if (activeCaravan) return; // قافلة نشطة بالفعل — لا نُنشئ ثانية

    const from = randomEdgePoint();
    let to = randomEdgePoint();
    // تفادي أن تكون A وB قريبتين جداً من بعضهما
    while (Math.hypot(to.x - from.x, to.y - from.y) < WORLD_W2 * 0.4) {
      to = randomEdgePoint();
    }

    const guardDef = ENEMY_TYPES[GUARD_ENEMY_ID];
    const caravanId = `caravan_${Date.now()}`;
    const goldPerGuard = Math.floor(CARAVAN_GOLD_TOTAL / 2);
    const guardIds = [];

    for (let i = 0; i < 2; i++) {
      const guardId = `${caravanId}_guard${i}`;
      guardIds.push(guardId);
      worldMonsters.push({
        id: guardId,
        enemyId: guardDef.id,
        name: `حارس القافلة (${guardDef.name})`,
        color: guardDef.color,
        radius: guardDef.radius,
        hp: guardDef.hp,
        maxHp: guardDef.hp,
        damage: guardDef.damage,
        rewardMoney: 0,
        rewardGold: goldPerGuard,
        ability: guardDef.ability || null,
        x: from.x + (Math.random() - 0.5) * 40,
        y: from.y + (Math.random() - 0.5) * 40,
        spawnX: from.x,
        spawnY: from.y,
        alive: true,
        respawnTimer: 0,
        _spawnTime: Date.now(),
        isCaravanGuard: true,
        caravanId,
      });
    }

    activeCaravan = { id: caravanId, guardIds, from, to };

    broadcastToAll({
      type: "caravan_spawn",
      id: caravanId,
      x: Math.round(from.x),
      y: Math.round(from.y),
      toX: Math.round(to.x),
      toY: Math.round(to.y),
      gold: CARAVAN_GOLD_TOTAL,
    });

    // 🔔 تنبيه اللاعبين غير المتصلين بقافلة ذهب جديدة — يشجّع العودة للعبة
    if (pushEnabled && memStore) {
      for (const [username, player] of memStore) {
        if (worldClients.has(username)) continue; // متصل بالفعل
        if (player.pushSubscription) {
          sendPush(player.pushSubscription, {
            title: "🐫 قافلة ذهب!",
            body: `قافلة تحمل ${CARAVAN_GOLD_TOTAL} 🪙 ظهرت في الصحراء — اذهب وانهبها قبل أن يسبقك أحد!`,
            url: "/",
          });
        }
      }
    }
  }

  function despawnCaravan(reason) {
    if (!activeCaravan) return;
    const { id, guardIds } = activeCaravan;
    // إزالة أي حراس ما زالوا في worldMonsters (لو انتهت الرحلة قبل قتلهم جميعاً)
    for (let i = worldMonsters.length - 1; i >= 0; i--) {
      if (guardIds.includes(worldMonsters[i].id)) worldMonsters.splice(i, 1);
    }
    activeCaravan = null;
    broadcastToAll({ type: "caravan_despawn", id, reason });
  }

  // 🐫 تحديث موقع القافلة (يُستدعى من نفس مؤقّت الوحوش الموجود في combatLoop.js
  // عبر stepCaravanGuards، وليس مؤقّتاً منفصلاً يتسابق على worldMonsters نفسها)
  function stepCaravanGuards(dtSec) {
    if (!activeCaravan) return;

    const guards = worldMonsters.filter(m => activeCaravan.guardIds.includes(m.id));
    const aliveGuards = guards.filter(g => g.alive);

    if (guards.length === 0 || aliveGuards.length === 0) {
      // كل الحراس ماتوا (أو أُزيلوا) — القافلة انتهت
      despawnCaravan(aliveGuards.length === 0 && guards.length > 0 ? "killed" : "error");
      return;
    }

    const { to } = activeCaravan;
    const lead = aliveGuards[0];
    const dx = to.x - lead.x;
    const dy = to.y - lead.y;
    const dist = Math.hypot(dx, dy);

    if (dist < 20) {
      // وصلت القافلة إلى وجهتها بأمان — لا مكافأة لأحد، تختفي فقط
      despawnCaravan("arrived");
      return;
    }

    const step = CARAVAN_SPEED * dtSec;
    const moveX = (dx / dist) * step;
    const moveY = (dy / dist) * step;
    for (const g of aliveGuards) {
      g.x += moveX;
      g.y += moveY;
    }
  }

  function initCaravans() {
    if (spawnTimer) return;
    spawnTimer = setInterval(spawnCaravan, CARAVAN_SPAWN_INTERVAL_MS);
    // محاولة أولى بعد وقت قصير من إقلاع الخادم (وليس فوراً، لإتاحة وقت لاتصال اللاعبين)
    setTimeout(spawnCaravan, 15000);
  }

  function getActiveCaravan() {
    return activeCaravan;
  }

  return {
    initCaravans,
    stepCaravanGuards,
    getActiveCaravan,
    spawnCaravan,
    despawnCaravan,
  };
}

module.exports = { createCaravanManager, CARAVAN_SPAWN_INTERVAL_MS };
