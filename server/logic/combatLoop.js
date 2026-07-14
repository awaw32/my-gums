"use strict";

const { getEnemyForLevel, calculateEnemyPower } = require("../data/enemies");
const metrics = require("../metrics");

function createCombatLoop(deps) {
  const { rooms, broadcast, TICK_MS, worldMonsters, worldClients, SAFE_ZONE, WORLD_W2, WORLD_H2 } = deps;

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
      alive: true, respawnTimer: 0,
      _spawnTime: Date.now(),
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

  const monsterInterval = setInterval(() => {
    for (const m of worldMonsters) {
      if (!m.alive) {
        m.respawnTimer -= 0.3;
        if (m.respawnTimer <= 0) {
          m.alive = true; m.hp = m.maxHp;
          m.x = m.spawnX; m.y = m.spawnY;
          m._spawnTime = Date.now();
        }
      } else {
        if (!m._patrolTarget || Math.hypot(m.x - m._patrolTarget.x, m.y - m._patrolTarget.y) < 12) {
          m._patrolTarget = {
            x: m.spawnX + (Math.random() - 0.5) * 150,
            y: m.spawnY + (Math.random() - 0.5) * 150,
          };
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
      if (m._shieldTimer !== undefined) m._shieldTimer = Math.max(0, m._shieldTimer - 0.3);
      if (m._phaseTimer !== undefined) m._phaseTimer = Math.max(0, m._phaseTimer - 0.3);
      if (m._sandstormTimer !== undefined) m._sandstormTimer = Math.max(0, m._sandstormTimer - 0.3);
    }
    const msg = JSON.stringify({ type: "world_monsters", list: worldMonsters });
    worldClients.forEach((c) => { if (c.ws.readyState === 1) c.ws.send(msg); });
  }, 300);

  const poisonInterval = setInterval(() => {
    worldClients.forEach((c, name) => {
      if (!c._poisonEffects || c._poisonEffects.length === 0) return;
      if (c.hp <= 0) { c._poisonEffects = []; return; }
      let totalDmg = 0;
      for (let i = c._poisonEffects.length - 1; i >= 0; i--) {
        const p = c._poisonEffects[i];
        p.timer -= 0.3;
        const dmg = Math.floor(p.dps * 0.3);
        if (dmg > 0) totalDmg += dmg;
        if (p.timer <= 0) c._poisonEffects.splice(i, 1);
      }
      if (totalDmg > 0) {
        c.hp = Math.max(0, c.hp - totalDmg);
        const poisonMsg = JSON.stringify({ type: "poison_tick", username: name, hp: Math.floor(c.hp), maxHp: c.maxHp || 120, damage: totalDmg });
        worldClients.forEach((cl) => { if (cl.ws.readyState === 1) cl.ws.send(poisonMsg); });
      }
    });
  }, 300);

  return {
    tickTimer,
    monsterInterval,
    poisonInterval,
    initWorldMonsters,
    gameTick,
  };
}

module.exports = { createCombatLoop };
