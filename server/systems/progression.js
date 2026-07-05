"use strict";
const BASE_XP = 100;

const StarterQuests = [
  { id: "build_camp_1", title: "\u0625\u062d\u064a\u0627\u0621 \u0627\u0644\u0645\u062e\u064a\u0645", req: { building: "town", toLevel: 1 }, reward: { gold: 100, wood: 30, date: 50 } },
  { id: "first_weapon", title: "\u0633\u0644\u0627\u062d\u0643 \u0627\u0644\u0623\u0648\u0644", req: { weapon: true }, reward: { rune: "zokm" } },
  { id: "scorpion_den", title: "\u0648\u0643\u0631 \u0627\u0644\u0639\u0642\u0627\u0631\u0628", req: { killFamily: "scorpion", count: 5 }, reward: { plan: "town_lv2" } },
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
  player.resources = { gold: 0, date: 0, wood: 0, hide: 0, stone: 0 };
  player.buildings = { town: 0, smith: 0, stable: 0, store: 0, tower: 0, sages: 0 };
  player.quests = [StarterQuests[0].id];
  const stats = computeStats(player);
  player.maxHp = stats.maxHp;
  player.hp = stats.maxHp;
  player.attackPower = stats.attackPower;
  player.defense = stats.defense;
}

function grantReward(player, reward) {
  if (!reward) return;
  if (player.resources) {
    if (reward.gold) player.resources.gold = (player.resources.gold || 0) + reward.gold;
    if (reward.date) player.resources.date = (player.resources.date || 0) + reward.date;
    if (reward.wood) player.resources.wood = (player.resources.wood || 0) + reward.wood;
    if (reward.hide) player.resources.hide = (player.resources.hide || 0) + reward.hide;
    if (reward.stone) player.resources.stone = (player.resources.stone || 0) + reward.stone;
  }
}

module.exports = { xpForLevel, gainXp, computeStats, StarterQuests, initNewPlayer, grantReward };
