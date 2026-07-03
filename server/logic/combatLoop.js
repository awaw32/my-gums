"use strict";

function createCombatLoop(deps) {
  const { rooms, broadcast, WORLD_W, TICK_MS, worldMonsters, worldClients, MONSTER_TYPES, SAFE_ZONE, WORLD_W2, WORLD_H2 } = deps;

  function gameTick() {
    rooms.forEach((room, roomCode) => {
      if (!room.matchStarted) return;
      for (const [id, player] of room.players) {
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
      let x, y;
      do {
        x = 150 + Math.random() * (WORLD_W2 - 300);
        y = 150 + Math.random() * (WORLD_H2 - 300);
      } while (x >= SAFE_ZONE.x && x <= SAFE_ZONE.x + SAFE_ZONE.w && y >= SAFE_ZONE.y && y <= SAFE_ZONE.y + SAFE_ZONE.h);
      const t = MONSTER_TYPES[Math.floor(Math.random() * MONSTER_TYPES.length)];
      worldMonsters.push({
        id: i, ...t,
        x, y, spawnX: x, spawnY: y,
        alive: true, hp: t.maxHp, respawnTimer: 0
      });
    }
  }

  const tickInterval = setInterval(gameTick, TICK_MS);

  const monsterInterval = setInterval(() => {
    let changed = false;
    for (const m of worldMonsters) {
      if (!m.alive) {
        m.respawnTimer -= 1;
        if (m.respawnTimer <= 0) {
          m.alive = true; m.hp = m.maxHp;
          m.x = m.spawnX; m.y = m.spawnY;
          changed = true;
        }
      } else {
        if (!m._patrolTarget || Math.hypot(m.x - m._patrolTarget.x, m.y - m._patrolTarget.y) < 15) {
          m._patrolTarget = {
            x: m.spawnX + (Math.random() - 0.5) * 180,
            y: m.spawnY + (Math.random() - 0.5) * 180,
          };
        }
        const dx = m._patrolTarget.x - m.x;
        const dy = m._patrolTarget.y - m.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 3) {
          m.x += (dx / dist) * 18;
          m.y += (dy / dist) * 18;
          changed = true;
        }
      }
    }
    const msg = JSON.stringify({ type: "world_monsters", list: worldMonsters });
    worldClients.forEach((c) => { if (c.ws.readyState === 1) c.ws.send(msg); });
  }, 1000);

  return {
    tickInterval,
    monsterInterval,
    initWorldMonsters,
    gameTick,
  };
}

module.exports = { createCombatLoop };
