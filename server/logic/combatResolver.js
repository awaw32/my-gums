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

function resolveMonsterKill(playerData, monster, now) {
  if (!monster || !monster.alive) return { valid: false, reason: "الوحش ميت أصلاً" };
  if (!now) now = Date.now();

  const hit = computeOneHitDamage(playerData);
  let finalDamage = hit.damage;
  let wasDodged = false;
  let wasPhased = false;
  let sandstormActive = false;
  const abilitiesTriggered = [];
  let returnDamage = 0;
  let poisonInfo = null;

  const enemyDef = ENEMY_TYPES[monster.enemyId];
  const ab = enemyDef ? enemyDef.ability : null;

  if (ab) {
    if (monster._abilityCooldowns === undefined) monster._abilityCooldowns = {};
    if (monster._shieldTimer === undefined) monster._shieldTimer = 0;
    if (monster._phaseTimer === undefined) monster._phaseTimer = 0;
    if (monster._sandstormTimer === undefined) monster._sandstormTimer = 0;

    if (monster._phaseTimer > 0) { wasPhased = true; finalDamage = 0; }
    if (!wasPhased && monster._sandstormTimer > 0) { sandstormActive = true; finalDamage = Math.floor(finalDamage * 0.5); }
    if (!wasPhased && monster._shieldTimer > 0) { finalDamage = Math.floor(finalDamage * 0.5); }
    if (!wasPhased && ab.type === "dodge" && Math.random() < (ab.chance || 0)) { wasDodged = true; finalDamage = 0; }
  }

  const remaining = monster.hp - finalDamage;
  monster.hp = Math.max(0, remaining);
  const killed = remaining <= 0;

  if (ab && !wasDodged && !killed) {
    const cd = monster._abilityCooldowns;

    if (ab.type === "heal" && (!cd.heal || now - cd.heal > 5000)) {
      if (Math.random() < (ab.chance || 0)) {
        const healAmt = Math.floor(monster.maxHp * (ab.healPercent || 0.3));
        monster.hp = Math.min(monster.maxHp, monster.hp + healAmt);
        cd.heal = now;
        abilitiesTriggered.push({ type: "heal", amount: healAmt });
      }
    }

    if (ab.type === "charge" && (!cd.charge || now - cd.charge > 8000)) {
      if (Math.random() < (ab.chance || 0)) {
        const dmg = Math.floor(monster.damage * (ab.chargeMultiplier || 2));
        returnDamage += dmg;
        cd.charge = now;
        abilitiesTriggered.push({ type: "charge", damage: dmg });
      }
    }

    if (ab.type === "swoop" && (!cd.swoop || now - cd.swoop > 9000)) {
      if (Math.random() < (ab.chance || 0)) {
        const dmg = Math.floor(monster.damage * (ab.chargeMultiplier || 3));
        returnDamage += dmg;
        cd.swoop = now;
        abilitiesTriggered.push({ type: "swoop", damage: dmg });
      }
    }

    if (ab.type === "fire_breath" && (!cd.fire_breath || now - cd.fire_breath > 10000)) {
      if (Math.random() < (ab.chance || 0)) {
        const dmg = Math.floor(monster.damage * (ab.chargeMultiplier || 3));
        returnDamage += dmg;
        cd.fire_breath = now;
        abilitiesTriggered.push({ type: "fire_breath", damage: dmg });
      }
    }

    if (ab.type === "stomp" && (!cd.stomp || now - cd.stomp > 7000)) {
      if (Math.random() < (ab.chance || 0)) {
        const dmg = Math.floor(monster.damage * 1.5);
        returnDamage += dmg;
        cd.stomp = now;
        abilitiesTriggered.push({ type: "stomp", damage: dmg });
      }
    }

    if (ab.type === "aoe" && (!cd.aoe || now - cd.aoe > 8000)) {
      if (Math.random() < (ab.chance || 0)) {
        const dmg = ab.aoeDamage || Math.floor(monster.damage * 1.5);
        returnDamage += dmg;
        cd.aoe = now;
        abilitiesTriggered.push({ type: "aoe", damage: dmg });
      }
    }

    if (ab.type === "poison" && (!cd.poison || now - cd.poison > 4000)) {
      if (Math.random() < (ab.chance || 0)) {
        poisonInfo = { dps: ab.poisonDps || 3, duration: ab.poisonDuration || 3, timer: ab.poisonDuration || 3, sourceId: monster.id };
        cd.poison = now;
        abilitiesTriggered.push({ type: "poison" });
      }
    }

    if (ab.type === "shield" && (!cd.shield || now - cd.shield > 6000)) {
      if (Math.random() < (ab.chance || 0)) {
        monster._shieldTimer = 3;
        cd.shield = now;
        abilitiesTriggered.push({ type: "shield" });
      }
    }

    if (ab.type === "sandstorm" && (!cd.sandstorm || now - cd.sandstorm > 8000)) {
      if (Math.random() < (ab.chance || 0)) {
        monster._sandstormTimer = 3;
        cd.sandstorm = now;
        abilitiesTriggered.push({ type: "sandstorm" });
      }
    }

    if (ab.type === "phase" && (!cd.phase || now - cd.phase > 6000)) {
      if (Math.random() < (ab.chance || 0)) {
        monster._phaseTimer = 1.5;
        cd.phase = now;
        abilitiesTriggered.push({ type: "phase" });
      }
    }
  }

  return {
    valid: true,
    damage: finalDamage,
    remainingHp: monster.hp,
    isCrit: hit.isCrit,
    killed,
    wasDodged,
    wasPhased,
    sandstormActive,
    returnDamage,
    poisonInfo,
    abilitiesTriggered,
  };
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

function computeMonsterReward(monster, playerData) {
  const power = playerData.army_power || 5000;
  const level = playerData.level || 1;
  const baseCash = monster.rewardMoney || 10;
  const baseGold = monster.rewardGold || Math.floor(baseCash * 0.3);
  const levelMult = 1 + level * 0.02;
  let cash = Math.floor(baseCash * levelMult);
  let gold = Math.floor(baseGold * levelMult);
  const powerCap = Math.floor(power * 0.15);
  cash = Math.min(cash, powerCap);
  gold = Math.min(gold, Math.floor(powerCap * 0.3));
  const artifacts = monster.isBoss ? 1 + Math.floor(Math.random() * 2) : 0;
  const desertGem = monster.enemyId === "final_boss" ? 1 : 0;
  const cashBonus = monster.isBoss ? Math.floor(cash * 0.5) : 0;
  return { cash, gold, artifacts, desertGem, cashBonus };
}

module.exports = {
  computeOneHitDamage,
  resolveMonsterKill,
  simulatePvPFull,
  computeLoot,
  computeMonsterReward,
  WEAPON_COMBAT_STATS,
};
