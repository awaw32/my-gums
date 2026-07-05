"use strict";
const BASE_XP = 100;

const StarterQuests = [
  { id: "build_camp_1", title: "إحياء المخيم", req: { building: "town", toLevel: 1 }, reward: { cash: 200, gold: 50, food: 30 } },
  { id: "first_weapon", title: "سلاحك الأول", req: { weapon: true }, reward: { cash: 100, gold: 25 } },
  { id: "scorpion_den", title: "وكر العقارب", req: { killFamily: "scorpion", count: 5 }, reward: { gold: 100, gems: 5 } },
];

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

function initNewPlayer(player) {
  player.level = 1;
  player.xp = 0;
  player.resources = { cash: 0, gold: 0, gems: 0, hammers: 0, scrolls: 0, food: 0 };
  player.buildings = { town: 0, smith: 0, stable: 0, store: 0, tower: 0, sages: 0 };
  player.quests = [StarterQuests[0].id];
  const stats = computeStats(player);
  player.maxHp = stats.maxHp;
  player.hp = stats.maxHp;
  player.attackPower = stats.attackPower;
  player.defense = stats.defense;
}

function grantReward(player, reward) {
  if (!reward || !player.resources) return;
  const resourceKeys = ["cash", "gold", "gems", "hammers", "scrolls", "food"];
  for (const key of resourceKeys) {
    if (reward[key]) {
      player.resources[key] = (player.resources[key] || 0) + reward[key];
    }
  }
}

module.exports = { xpForLevel, gainXp, computeStats, StarterQuests, initNewPlayer, grantReward };
