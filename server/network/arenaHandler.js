"use strict";

const { WORLD_W, WORLD_H, ADMIN_KEY } = require("../config");
const logger = require("../logger");

const MSG_SCHEMAS = {
  join: {
    required: ["playerId"],
    fields: { playerId: "string", name: "string", roomCode: "string", adminKey: "string", level: "number" },
  },
  move: {
    required: ["targetX", "targetY"],
    fields: { targetX: "number", targetY: "number" },
  },
  attack: {
    required: ["targetId"],
    fields: { targetId: "string" },
  },
};

function validate(msg, schema) {
  if (!msg || typeof msg !== "object") return false;
  for (const f of schema.required) {
    if (msg[f] === undefined || msg[f] === null) return false;
  }
  for (const [key, type] of Object.entries(schema.fields)) {
    if (msg[key] !== undefined && typeof msg[key] !== type) return false;
  }
  if (schema.fields.targetX !== undefined) {
    if (typeof msg.targetX !== "number" || typeof msg.targetY !== "number") return false;
    if (msg.targetX < 0 || msg.targetX > WORLD_W || msg.targetY < 0 || msg.targetY > WORLD_H) return false;
  }
  if (schema.fields.damage !== undefined) {
    if (msg.damage < 0 || msg.damage > 200) return false;
  }
  return true;
}

function broadcast(roomCode, rooms, message, excludeId = null) {
  const room = rooms.get(roomCode);
  if (!room) return;
  const data = JSON.stringify(message);
  room.players.forEach((player, id) => {
    if (id === excludeId) return;
    if (player.ws.readyState === 1) player.ws.send(data);
  });
}

function createArenaHandler({ rooms, playerData }) {
  return function handleArenaConnection(ws, req) {
    const ip = req.socket.remoteAddress;
    let playerId = null;
    let roomCode = null;
    let isAdmin = false;
    let msgCount = 0;
    let lastReset = Date.now();

    logger.info({ ip }, "[ArenaWS] Connection");

    ws.on("message", (raw) => {
      const now = Date.now();
      if (now - lastReset > 1000) { msgCount = 0; lastReset = now; }
      if (++msgCount > 30) { ws.close(1008, "Rate limit"); return; }

      if (raw.length > 10240) { ws.close(1009, "Message too large"); return; }
      let msg;
      try { msg = JSON.parse(raw); } catch { return; }

      switch (msg.type) {
        case "join":
          if (!validate(msg, MSG_SCHEMAS.join)) return;
          playerId = msg.playerId;
          roomCode = (msg.roomCode || "LOBBY").toUpperCase();

          if (!rooms.has(roomCode)) {
            rooms.set(roomCode, {
              admin: null,
              players: new Map(),
              matchStarted: false,
              tick: 0,
            });
          }

          const room = rooms.get(roomCode);
          isAdmin = !!(ADMIN_KEY && msg.adminKey === ADMIN_KEY);
          if (isAdmin || !room.admin) {
            room.admin = playerId;
            isAdmin = true;
          }

          const saved = playerData.get(playerId) || {};
          room.players.set(playerId, {
            ws, name: msg.name || "مقاتل", level: msg.level || 1,
            x: 100 + Math.random() * (WORLD_W - 200),
            y: 100 + Math.random() * (WORLD_H - 200),
            hp: 100, maxHp: 100, speed: 160, alive: true, kills: 0,
            moving: false, moveTarget: [],
            attackPower: saved.attackPower || 15,
            defense: saved.defense || 0,
            joinTime: Date.now(),
          });

          broadcast(roomCode, rooms, {
            type: "player_list",
            players: Array.from(room.players.entries()).map(([id, p]) => ({
              id, name: p.name, level: p.level, alive: p.alive,
            })),
            admin: room.admin,
          });

          logger.info({ playerId, name: msg.name, roomCode, players: room.players.size }, "[ArenaWS] joined");
          break;

        case "move":
          if (!validate(msg, MSG_SCHEMAS.move)) return;
          if (!roomCode || !rooms.has(roomCode)) return;
          const moveRoom = rooms.get(roomCode);
          const movePlayer = moveRoom.players.get(playerId);
          if (!movePlayer || !movePlayer.alive) return;
          movePlayer.moveTarget = [{ x: msg.targetX, y: msg.targetY }];
          break;

        case "attack":
          if (!validate(msg, MSG_SCHEMAS.attack)) return;
          if (!roomCode || !rooms.has(roomCode)) return;
          const atkRoom = rooms.get(roomCode);
          const atkPlayer = atkRoom.players.get(playerId);
          const target = atkRoom.players.get(msg.targetId);
          if (!atkPlayer || !target || !target.alive) return;

          const dist = Math.hypot(atkPlayer.x - target.x, atkPlayer.y - target.y);
          if (dist > 60) return;

          const atkPower = atkPlayer.attackPower || 15;
          const defPower = target.defense || 0;
          const dmg = Math.max(1, Math.floor(atkPower * (1 + Math.random() * 0.2) - defPower * 0.3));
          target.hp -= dmg;
          broadcast(roomCode, rooms, {
            type: "attack_result",
            attackerId: playerId,
            targetId: msg.targetId,
            damage: dmg,
            targetHp: target.hp,
          });

          if (target.hp <= 0) {
            target.hp = 0;
            target.alive = false;
            atkPlayer.kills = (atkPlayer.kills || 0) + 1;
            broadcast(roomCode, rooms, {
              type: "player_eliminated",
              playerId: msg.targetId,
              killedBy: playerId,
            });
            logger.info({ targetId: msg.targetId, killer: playerId }, "[ArenaWS] player killed");
          }
          break;

        case "match_start":
          if (!roomCode || !rooms.has(roomCode) || !isAdmin) return;
          const msRoom = rooms.get(roomCode);
          msRoom.matchStarted = true;
          broadcast(roomCode, rooms, {
            type: "match_start",
            mapSize: WORLD_W,
            matchTime: msg.matchTime || 600,
          });
          logger.info({ roomCode }, "[ArenaWS] match started");
          break;

        case "zone_shrink":
          if (!roomCode || !rooms.has(roomCode) || !isAdmin) return;
          broadcast(roomCode, rooms, {
            type: "zone_shrink",
            radius: msg.radius,
            centerX: msg.centerX,
            centerY: msg.centerY,
          });
          break;

        case "bandit_spawn":
          if (!roomCode || !rooms.has(roomCode) || !isAdmin) return;
          broadcast(roomCode, rooms, { type: "bandit_spawn", bandit: msg.bandit });
          break;

        case "signal":
          if (!roomCode || !rooms.has(roomCode)) return;
          broadcast(roomCode, rooms, { type: "signal", from: playerId, signal: msg.signal }, playerId);
          break;

        case "ping":
          ws.send(JSON.stringify({ type: "pong" }));
          break;
      }
    });

    ws.on("close", () => {
      if (roomCode && rooms.has(roomCode)) {
        const room = rooms.get(roomCode);
        room.players.delete(playerId);
        playerData.delete(playerId);
        if (room.admin === playerId && room.players.size > 0) {
          room.admin = room.players.keys().next().value;
        }
        broadcast(roomCode, rooms, {
          type: "player_list",
          players: Array.from(room.players.entries()).map(([id, p]) => ({
            id, name: p.name, level: p.level, alive: p.alive,
          })),
          admin: room.admin,
        });
        if (room.players.size === 0) {
          rooms.delete(roomCode);
          logger.info({ roomCode }, "[ArenaWS] room deleted");
        }
        logger.info({ playerId, roomCode }, "[ArenaWS] left");
      }
    });

    ws.on("error", (err) => {
      logger.error({ err: err.message }, "[ArenaWS] error");
    });
  };
}

module.exports = { createArenaHandler };
