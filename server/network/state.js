"use strict";
const { customAlphabet } = require("nanoid");
const nanoid = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 10);

class WorldState {
  constructor() {
    this.rooms = new Map();
  }
}

class Player {
  constructor({ id, name, x = 0, y = 0, dir = 0, loadout }) {
    this.id = id;
    this.name = name || `p_${nanoid()}`;
    this.x = x;
    this.y = y;
    this.dir = dir;
    this.vx = 0;
    this.vy = 0;
    this.loadout = loadout;
    this.hp = 100;
    this.stamina = 100;
    this.seq = 0;
  }
}

function ensureRoom(world, roomId) {
  if (!world.rooms.has(roomId)) {
    world.rooms.set(roomId, {
      players: new Map(),
      tick: 0,
      lastBroadcast: 0,
    });
  }
  return world.rooms.get(roomId);
}

module.exports = { WorldState, Player, ensureRoom };
