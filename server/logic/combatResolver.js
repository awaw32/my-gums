"use strict";

const { computePlayerStats } = require("./formulas");
const { ENEMY_TYPES, calculateEnemyPower } = require("../data/enemies");

const WEAPON_COMBAT_STATS = {
  w1: { baseDamage: 4,  damagePerLevel: 3,  range: "melee",  critChance: 0.05, critMultiplier: 1.5 },
  w2: { baseDamage: 6,  damagePerLevel: 4,  range: "ranged", critChance: 0.08, critMultiplier: 1.8 },
  w3: { baseDamage: 9,  damagePerLevel: 6,  range: "melee",  critChance: 0.10, critMultiplier: 2.0 },
  w4: { baseDamage: 13, damagePerLevel: 8,  range: "melee",  critChance: 0.12, critMultiplier: 2.2 },
  w5: { baseDamage: 18, damagePerLevel: 10, range: "ranged", critChance: 0.15, critMultiplier: 2.5 },
  w6: { baseDamage: 24, damagePerLevel: 14, range: "melee",  critChance: 0.18, critMultiplier: 3.0 },
};

function computeOneHitDamage(playerData) {
  const stats = computePlayerStats(playerData);
  const isCrit = Math.random() < stats.critChance;
  const mult = isCrit ? stats.critMultiplier : 1;
  let total = Math.floor(stats.totalDamage * mult);
  if (isCrit) total += stats.weaponDamage;
  const hpRatio = Math.max(0.1, (playerData.hp || playerData.maxHp || 120) / (playerData.maxHp || 120));
  const rageMult = 1 + (1 - hpRatio) * 0.5;
  total = Math.floor(total * rageMult);
  return {
    damage: Math.max(1, total),
    isCrit,
    rageActive: hpRatio < 0.3,
    weaponId: playerData.equippedWeapon || "",
  };
}

function resolveMonsterKill(playerData, monster) {
  if (!monster || !monster.alive) return { valid: false, reason: "الوحش ميت أصلاً" };
  const hit = computeOneHitDamage(playerData);
  const remaining = monster.hp - hit.damage;
  monster.hp = Math.max(0, remaining);
  return { valid: true, damage: hit.damage, remainingHp: monster.hp, isCrit: hit.isCrit, killed: remaining <= 0 };
}

function simulatePvPFull(attacker, defender) {
  const aStats = computePlayerStats(attacker);
  const bStats = computePlayerStats(defender);

  const aHp = aStats.maxHp;
  const bHp = bStats.maxHp;

  const aDmg = Math.max(1, Math.floor(aStats.totalDamage * 0.6));
  const bDmg = Math.max(1, Math.floor(bStats.totalDamage * 0.6));

  let aCur = aHp, bCur = bHp;
  let rounds = 0;
  const maxRounds = 50;

  while (aCur > 0 && bCur > 0 && rounds < maxRounds) {
    const aCrit = Math.random() < aStats.critChance;
    const bCrit = Math.random() < bStats.critChance;
    const aHit = aCrit ? Math.floor(aDmg * aStats.critMultiplier) + 12 : aDmg;
    const bHit = bCrit ? Math.floor(bDmg * bStats.critMultiplier) + 12 : bDmg;
    bCur -= aHit;
    aCur -= bHit;
    rounds++;
  }

  const attackerWon = bCur <= 0 && aCur > 0;
  const defenderWon = aCur <= 0;

  return {
    attackerWon,
    attackerHpRemaining: Math.max(0, aCur),
    defenderHpRemaining: Math.max(0, bCur),
    rounds,
    attackerDmgPerHit: aDmg,
    defenderDmgPerHit: bDmg,
  };
}

function computeLoot(playerPower, won) {
  if (won) {
    const reward = Math.max(10, Math.floor(playerPower * 0.05));
    return { cash: Math.floor(reward), gold: Math.floor(reward * 0.2) };
  }
  const lost = Math.floor(playerPower * 0.03);
  return { cash: Math.min(lost, 50000), gold: 0 };
}

module.exports = {
  computeOneHitDamage,
  resolveMonsterKill,
  simulatePvPFull,
  computeLoot,
  WEAPON_COMBAT_STATS,
};
