"use strict";

const { computePlayerStats } = require("./formulas");
const { getEnemyForLevel, calculateEnemyPower } = require("../data/enemies");
const metrics = require("../metrics");

function createCombatLoop(deps) {
  const { rooms, broadcast, TICK_MS, worldMonsters, worldClients, SAFE_ZONE, WORLD_W2, WORLD_H2 } = deps;

  const PVP_ENGAGEMENT_RADIUS = 80;
  const PVP_TICK_MS = 300;

  let lastTickTime = performance.now();

  function getAveragePlayerLevel() {
    const clients = Array.from(worldClients.values());
    if (clients.length === 0) return 1;
    const total = clients.reduce((sum, c) => sum + (c.level || 1), 0);
    return Math.floor(total / clients.length);
  }

  function spawnMonster(id) {
    let x, y;
    do {
      x = 150 + Math.random() * (WORLD_W2 - 300);
      y = 150 + Math.random() * (WORLD_H2 - 300);
    } while (x >= SAFE_ZONE.x && x <= SAFE_ZONE.x + SAFE_ZONE.w && y >= SAFE_ZONE.y && y <= SAFE_ZONE.y + SAFE_ZONE.h);
    const playerLevel = getAveragePlayerLevel();
    const enemy = getEnemyForLevel(playerLevel);
    const scaled = calculateEnemyPower(enemy, playerLevel);
    return {
      id,
      enemyId: enemy.id,
      name: enemy.name,
      color: enemy.color,
      radius: enemy.radius,
      hp: scaled.hp,
      maxHp: scaled.hp,
      damage: scaled.damage,
      rewardMoney: scaled.reward.cash || 5,
      rewardGold: scaled.reward.gold || 1,
      x, y, spawnX: x, spawnY: y,
      alive: true, respawnTimer: 0
    };
  }

  function gameTick() {
    const now = performance.now();
    const drift = now - lastTickTime - TICK_MS;
    if (metrics.enabled) {
      metrics.setTickDrift(drift);
    }
    lastTickTime = now;

    // Dynamic tick: إذا مافي غرف نشطة ولا عملاء عالم، نوفر CPU
    const hasActiveRooms = Array.from(rooms.values()).some(r => r.matchStarted && r.players.size > 0);
    const hasWorldClients = worldClients.size > 0;
    if (!hasActiveRooms && !hasWorldClients) return;

    rooms.forEach((room, roomCode) => {
      if (!room.matchStarted) return;
      for (const [, player] of room.players) {
        if (!player.alive) continue;
        if (player.moveTarget && player.moveTarget.length > 0) {
          const target = player.moveTarget[0];
          const dx = target.x - player.x;
          const dy = target.y - player.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 5) {
            player.moveTarget.shift();
            player.moving = false;
          } else {
            player.x += (dx / dist) * player.speed * (TICK_MS / 1000);
            player.y += (dy / dist) * player.speed * (TICK_MS / 1000);
            player.moving = true;
          }
        } else {
          player.moving = false;
        }
      }
      broadcast(roomCode, {
        type: "state_update",
        tick: room.tick,
        players: Array.from(room.players.entries()).map(([id, p]) => ({
          id, name: p.name, x: Math.round(p.x), y: Math.round(p.y),
          hp: p.hp, alive: p.alive, kills: p.kills, moving: p.moving,
        })),
      });
      room.tick++;
    });
  }

  function pvpTick() {
    const clients = Array.from(worldClients.entries());
    const dead = [];
    for (let i = 0; i < clients.length; i++) {
      const [nameA, a] = clients[i];
      if (!a || a.hp <= 0) continue;
      for (let j = i + 1; j < clients.length; j++) {
        const [nameB, b] = clients[j];
        if (!b || b.hp <= 0) continue;
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist = Math.hypot(dx, dy);
        if (dist > PVP_ENGAGEMENT_RADIUS) continue;
        const aStats = computePlayerStats(a);
        const bStats = computePlayerStats(b);
        const aDmg = Math.max(1, Math.floor(aStats.totalDamage * 0.6));
        const bDmg = Math.max(1, Math.floor(bStats.totalDamage * 0.6));
        a.hp -= bDmg;
        b.hp -= aDmg;
        if (a.hp <= 0) { a.hp = 0; dead.push(nameA); }
        if (b.hp <= 0) { b.hp = 0; dead.push(nameB); }
      }
    }
    for (const name of dead) {
      const msg = JSON.stringify({ type: "player_despawn", username: name });
      worldClients.forEach((c) => { if (c.ws.readyState === 1) c.ws.send(msg); });
    }
  }

  function initWorldMonsters() {
    if (worldMonsters.length > 0) return;
    for (let i = 0; i < 12; i++) {
      worldMonsters.push(spawnMonster(i));
    }
  }

  // Self-correcting tick loop — يعوّض الـ drift تلقائياً
  let tickTimer = null;
  let expectedTickTime = performance.now();

  function scheduleNextTick() {
    const now = performance.now();
    const drift = now - expectedTickTime;
    const nextDelay = Math.max(0, TICK_MS - drift);
    expectedTickTime += TICK_MS;
    tickTimer = setTimeout(() => {
      gameTick();
      scheduleNextTick();
    }, nextDelay);
  }

  scheduleNextTick();

  const pvpCombatInterval = setInterval(pvpTick, PVP_TICK_MS);

  const monsterInterval = setInterval(() => {
    for (const m of worldMonsters) {
      if (!m.alive) {
        m.respawnTimer -= 0.3; // 300ms ticks
        if (m.respawnTimer <= 0) {
          m.alive = true; m.hp = m.maxHp;
          m.x = m.spawnX; m.y = m.spawnY;
        }
      } else {
        // حركة دورية سلسة
        if (!m._patrolTarget || Math.hypot(m.x - m._patrolTarget.x, m.y - m._patrolTarget.y) < 12) {
          m._patrolTarget = {
            x: m.spawnX + (Math.random() - 0.5) * 150,
            y: m.spawnY + (Math.random() - 0.5) * 150,
          };
          // سرعة متغيرة قليلاً
          m._patrolSpeed = 12 + Math.random() * 8;
        }
        const dx = m._patrolTarget.x - m.x;
        const dy = m._patrolTarget.y - m.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 2) {
          const step = (m._patrolSpeed || 16) * 0.3;
          m.x += (dx / dist) * step;
          m.y += (dy / dist) * step;
        }
      }
    }
    const msg = JSON.stringify({ type: "world_monsters", list: worldMonsters });
    worldClients.forEach((c) => { if (c.ws.readyState === 1) c.ws.send(msg); });
  }, 300); // 300ms ← أسرع 3× من 1000ms (حركة وحوش أكثر سلاسة)

  return {
    tickTimer,
    monsterInterval,
    pvpCombatInterval,
    initWorldMonsters,
    gameTick,
  };
}

module.exports = { createCombatLoop };
