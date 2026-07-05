"use strict";
const { WorldState, Player, ensureRoom } = require("./state");
const { addPlayer, removePlayer } = require("./rooms");
const { makeRateLimiter } = require("./rateLimiter");
const { ClientMessage, ServerState, MsgError } = require("./protocol");
const { stepRoom } = require("../systems/movement");
const { resolveAttack } = require("./combat");
const { gainXp, computeStats } = require("../systems/progression");

const TICK_RATE = 50;

class NetworkServer {
  constructor() {
    this.world = new WorldState();
  }

  handleConnection(ws, req) {
    const limiter = makeRateLimiter({ maxPerSec: 30 });
    let clientId = null;
    let currentRoom = null;
    let player = null;

    ws.on("message", (raw) => {
      if (!limiter()) {
        ws.send(JSON.stringify({ t: "error", code: "RATE_LIMIT", msg: "Too fast" }));
        return;
      }
      let msg;
      try { msg = JSON.parse(raw); } catch { return; }
      const parsed = ClientMessage.safeParse(msg);
      if (!parsed.success) return;

      const { t } = parsed.data;

      if (t === "join") {
        const { playerId, roomId, loadout } = parsed.data;
        clientId = playerId;
        const room = ensureRoom(this.world, roomId);
        currentRoom = room;
        player = new Player({ id: playerId, loadout });
        player._ws = ws;
        player.level = 1;
        const stats = computeStats(player);
        player.maxHp = stats.maxHp;
        player.attackPower = stats.attackPower;
        player.defense = stats.defense;
        addPlayer(room, clientId, player);

        // Send current state snapshot
        ws.send(JSON.stringify({
          t: "state",
          tick: room.tick,
          players: Array.from(room.players.values()).map(p => ({
            id: p.id, x: p.x, y: p.y, dir: p.dir,
          })),
        }));

        // Notify others
        this._broadcast(room, { t: "player_joined", id: playerId }, clientId);

        // Start tick loop if not started
        if (!room._tickTimer) {
          room._tickTimer = setInterval(() => {
            stepRoom(room);
            this._broadcast(room, {
              t: "state",
              tick: room.tick++,
              players: Array.from(room.players.values()).map(p => ({
                id: p.id, x: p.x, y: p.y, dir: p.dir, anim: p.anim,
              })),
            });
          }, TICK_RATE);
        }
      } else if (t === "input" && player) {
        const { seq, axes, actions } = parsed.data;
        if (seq <= player.seq) return;
        player.seq = seq;
        player.vx = axes.x;
        player.vy = axes.y;
        if (actions.attack) {
          player.anim = "attack";
        } else if (actions.dash) {
          player.anim = "dash";
        } else if (actions.mount) {
          player.anim = "mount";
        } else {
          player.anim = axes.x || axes.y ? "run" : "idle";
        }
        if (axes.x || axes.y) {
          player.dir = Math.atan2(axes.y, axes.x) * (180 / Math.PI);
          if (player.dir < 0) player.dir += 360;
        }
      } else if (t === "attack" && player && currentRoom) {
        const { targetId } = parsed.data;
        const target = currentRoom.players.get(targetId);
        if (!target || target.hp <= 0) return;
        const result = resolveAttack(player, target);
        if (!result) return;
        this._broadcast(currentRoom, { t: "hit", attackerId: player.id, targetId, damage: result.damage, crit: result.crit, targetHp: result.targetHp });
        if (!result.alive) {
          this._broadcast(currentRoom, { t: "eliminated", playerId: targetId, killedBy: player.id });
          gainXp(player, 25);
        }
      } else if (t === "leave" && currentRoom) {
        this._handleLeave(ws, currentRoom, clientId);
      }
    });

    ws.on("close", () => {
      if (currentRoom) this._handleLeave(ws, currentRoom, clientId);
    });

    ws.on("error", () => {});
  }

  _handleLeave(ws, room, clientId) {
    removePlayer(room, clientId);
    this._broadcast(room, { t: "player_left", id: clientId });
    if (room.players.size === 0 && room._tickTimer) {
      clearInterval(room._tickTimer);
      room._tickTimer = null;
    }
  }

  _broadcast(room, message, excludeId = null) {
    const data = JSON.stringify(message);
    room.players.forEach((p, id) => {
      if (id === excludeId) return;
      if (p._ws && p._ws.readyState === 1) p._ws.send(data);
    });
  }
}

module.exports = NetworkServer;
