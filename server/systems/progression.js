"use strict";
const BASE_XP = 100;

function xpForLevel(level) {
  return Math.floor(BASE_XP * Math.pow(1.15, level - 1));
}

function gainXp(player, amount) {
  player.xp = (player.xp || 0) + amount;
  let leveled = false;
  while (player.xp >= xpForLevel(player.level || 1)) {
    player.xp -= xpForLevel(player.level || 1);
    player.level = (player.level || 1) + 1;
    leveled = true;
  }
  return leveled;
}

function computeStats(player) {
  const lvl = player.level || 1;
  return {
    maxHp: 80 + lvl * 10,
    attackPower: 8 + lvl * 2,
    defense: lvl,
    speed: 160 + lvl * 2,
  };
}

module.exports = { xpForLevel, gainXp, computeStats };
