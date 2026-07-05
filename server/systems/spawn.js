"use strict";

const MAP_MIN = -1000;
const MAP_MAX = 1000;

function randomSpawn() {
  return Math.floor(MAP_MIN + Math.random() * (MAP_MAX - MAP_MIN));
}

function spawnPlayer(player) {
  player.x = randomSpawn();
  player.y = randomSpawn();
  player.hp = player.maxHp || 100;
  player.alive = true;
}

function respawnPlayer(player) {
  spawnPlayer(player);
}

module.exports = { spawnPlayer, respawnPlayer, MAP_MIN, MAP_MAX };
