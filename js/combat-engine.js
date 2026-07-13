export const COMBAT_CONSTANTS = {
  LEADER_BASE_HP: 120,
  LEADER_BASE_DMG: 12,
  LEADER_BASE_SPEED: 140,
  ARMY_SIZE_BASE: 8,
  ENGAGEMENT_RADIUS: 80,
  MAX_OFFLINE_SECONDS: 14400,
  OFFLINE_EFFICIENCY: 0.5,
};

export const WEAPON_COMBAT_STATS = {
  w1: { baseDamage: 4,  damagePerLevel: 3,  range: "melee",  critChance: 0.05, critMultiplier: 1.5 },
  w2: { baseDamage: 6,  damagePerLevel: 4,  range: "ranged", critChance: 0.08, critMultiplier: 1.8 },
  w3: { baseDamage: 9,  damagePerLevel: 6,  range: "melee",  critChance: 0.10, critMultiplier: 2.0 },
  w4: { baseDamage: 13, damagePerLevel: 8,  range: "melee",  critChance: 0.12, critMultiplier: 2.2 },
  w5: { baseDamage: 18, damagePerLevel: 10, range: "ranged", critChance: 0.15, critMultiplier: 2.5 },
  w6: { baseDamage: 24, damagePerLevel: 14, range: "melee",  critChance: 0.18, critMultiplier: 3.0 },
};

export function computeWeaponDamage(equippedWeaponId, weapons) {
  if (typeof equippedWeaponId === 'object' && equippedWeaponId !== null) {
    const data = equippedWeaponId;
    return _computeWeaponDamageInternal(data.equippedWeapon || "", data.weapons || []);
  }
  return _computeWeaponDamageInternal(equippedWeaponId, weapons);
}

function _computeWeaponDamageInternal(equippedWeaponId, weapons) {
  if (!equippedWeaponId || !weapons) {
    return { weaponDamage: 0, critChance: 0, critMultiplier: 1, range: "melee" };
  }
  const def = WEAPON_COMBAT_STATS[equippedWeaponId];
  if (!def) {
    return { weaponDamage: 0, critChance: 0, critMultiplier: 1, range: "melee" };
  }
  const wp = weapons.find(w => w.id === equippedWeaponId);
  const level = (wp && typeof wp.level === 'number') ? wp.level : 0;
  const starBonus = level * 0.3;
  const baseDamage = def.baseDamage + Math.floor(def.damagePerLevel * level / 2);
  const weaponDamage = Math.floor(baseDamage * (1 + starBonus));
  return {
    weaponDamage,
    critChance: def.critChance + level * 0.02,
    critMultiplier: def.critMultiplier + level * 0.1,
    range: def.range,
    starLevel: Math.max(1, level || 1),
    gemLevel: 1,
    combinedLevel: Math.max(1, level || 1),
    damageMult: 1 + starBonus,
  };
}

export function computePlayerMaxHp(opts) {
  const { playerLevel, unitLevel, trainingLevel, prestigeLevel, armyYardLevel } = opts;
  return COMBAT_CONSTANTS.LEADER_BASE_HP
    + (playerLevel || 1) * 2
    + (unitLevel || 1) * 3
    + (trainingLevel || 1) * 2
    + (prestigeLevel || 0) * 5
    + (armyYardLevel || 1) * 6;
}

export function computePlayerDamage(opts) {
  const {
    equippedWeapon, weapons, playerLevel, unitLevel, prestigeLevel,
    armyPower, upgradeTree, allianceManager,
  } = opts;

  const weaponStats = computeWeaponDamage(equippedWeapon, weapons);
  let totalDamage = COMBAT_CONSTANTS.LEADER_BASE_DMG
    + Math.floor((armyPower || 5000) / 10)
    + (playerLevel || 1)
    + (unitLevel || 1) * 2
    + (prestigeLevel || 0) * 3
    + weaponStats.weaponDamage;

  if (upgradeTree) totalDamage += upgradeTree.getEffect?.("army") || 0;
  if (allianceManager) totalDamage += allianceManager.damageBonus || 0;

  return { totalDamage, weaponStats };
}

export function applyRageMultiplier(damage, currentHp, maxHp) {
  const hpRatio = Math.max(0.1, (currentHp || maxHp) / maxHp);
  const rageMult = 1 + (1 - hpRatio) * 0.5;
  return {
    damage: Math.floor(damage * rageMult),
    rageActive: hpRatio < 0.3,
    hpRatio,
  };
}

export function rollCrit(critChance, critMultiplier) {
  const isCrit = Math.random() < critChance;
  return { isCrit, multiplier: isCrit ? critMultiplier : 1 };
}

export function computePvPDamage(myDmg, crit, weaponDamage) {
  let total = Math.floor(myDmg * crit.multiplier);
  if (crit.isCrit) {
    total += weaponDamage;
  }
  return total;
}


