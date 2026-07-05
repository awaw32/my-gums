"use strict";

const { WEAPON_DEFS } = require("../db/databaseHelper");

const MAX_STAR = 5;
const MAX_GEM = 8;

function getCombinedLevel(starLevel, gemLevel) {
  return ((starLevel - 1) * MAX_GEM) + gemLevel;
}

function computeWeaponUpgradeCost(starLevel, gemLevel, upgradeGem) {
  const combined = getCombinedLevel(starLevel, gemLevel);
  const base = {
    cash: 50 + combined * 15,
    gold: 2 + combined * 2,
  };
  if (upgradeGem) {
    base.gems = 1 + Math.floor(combined / 4);
  }
  const scale = 1 + (combined * 0.1);
  for (const k of Object.keys(base)) {
    base[k] = Math.floor(base[k] * scale);
  }
  return base;
}

function computeStarBreakthroughCost(starLevel) {
  return {
    cash: 500 + starLevel * 300,
    gold: 20 + starLevel * 10,
    scrolls: 2 + starLevel * 2,
    hammers: 3 + starLevel,
  };
}

function getWeaponData(weapons, weaponId) {
  const existing = (weapons || []).find(w => w.id === weaponId);
  if (existing) {
    return {
      starLevel: existing.starLevel || 1,
      gemLevel: existing.gemLevel || 1,
    };
  }
  return { starLevel: 1, gemLevel: 1 };
}

function computeWeaponBonus(starLevel, gemLevel) {
  const gemBonus = gemLevel * 0.05;
  const starBonus = (starLevel - 1) * 0.25;
  return gemBonus + starBonus;
}

function canUpgradeGem(playerData, weaponId) {
  const wData = getWeaponData(playerData.weapons, weaponId);
  const { starLevel, gemLevel } = wData;
  if (gemLevel >= MAX_GEM) {
    return { allowed: false, reason: "الجواهر ممتلئة — قم بترقية النجمة أولاً" };
  }
  const vaultLevel = (playerData.buildings || {}).armoryVault || 0;
  if (starLevel > vaultLevel) {
    return { allowed: false, reason: `مستوى مكتبة القطع (${vaultLevel}) لا يسمح بهذا المستوى من النجوم (${starLevel})` };
  }
  const nextGem = gemLevel + 1;
  const cost = computeWeaponUpgradeCost(starLevel, gemLevel, true);
  const def = WEAPON_DEFS.find(w => w.id === weaponId);
  if (!def) return { allowed: false, reason: "سلاح غير معروف" };
  for (const [res, val] of Object.entries(cost)) {
    const have = playerData[res] || 0;
    if (have < val) {
      return { allowed: false, reason: `غير كافٍ ${res}: تحتاج ${val}، لديك ${have}` };
    }
  }
  return { allowed: true, cost, starLevel, gemLevel, nextGem, nextStar: starLevel };
}

function canUpgradeStar(playerData, weaponId) {
  const wData = getWeaponData(playerData.weapons, weaponId);
  const { starLevel, gemLevel } = wData;
  if (gemLevel < MAX_GEM) {
    return { allowed: false, reason: `أكمل الجواهر الـ ${MAX_GEM} أولاً (حالياً ${gemLevel})` };
  }
  if (starLevel >= MAX_STAR) {
    return { allowed: false, reason: "السلاح في أقصى نجومه (5 نجوم)" };
  }
  const vaultLevel = (playerData.buildings || {}).armoryVault || 0;
  if (starLevel + 1 > vaultLevel) {
    return { allowed: false, reason: `مستوى مكتبة القطع (${vaultLevel}) لا يسمح بترقية النجمة` };
  }
  const cost = computeStarBreakthroughCost(starLevel);
  const def = WEAPON_DEFS.find(w => w.id === weaponId);
  if (!def) return { allowed: false, reason: "سلاح غير معروف" };
  for (const [res, val] of Object.entries(cost)) {
    const have = playerData[res] || 0;
    if (have < val) {
      return { allowed: false, reason: `غير كافٍ ${res}: تحتاج ${val}، لديك ${have}` };
    }
  }
  return { allowed: true, cost, starLevel, gemLevel, nextStar: starLevel + 1, nextGem: 1 };
}

function applyGemUpgrade(playerData, weaponId) {
  const check = canUpgradeGem(playerData, weaponId);
  if (!check.allowed) return { ok: false, reason: check.reason };
  const weapons = [...(playerData.weapons || [])];
  let w = weapons.find(x => x.id === weaponId);
  if (!w) {
    w = { id: weaponId, starLevel: 1, gemLevel: 1 };
    weapons.push(w);
    playerData.weapons = weapons;
    const bonus = computeWeaponBonus(w.starLevel, w.gemLevel);
    return {
      ok: true, weaponId,
      starLevel: 1, gemLevel: 1,
      combinedLevel: 1,
      damageMult: 1 + bonus,
      breakthrough: false,
    };
  }
  w.gemLevel = (w.gemLevel || 1) + 1;
  if (!w.starLevel) w.starLevel = 1;
  playerData.weapons = weapons;
  for (const [res, val] of Object.entries(check.cost)) {
    playerData[res] = (playerData[res] || 0) - val;
  }
  const bonus = computeWeaponBonus(w.starLevel, w.gemLevel);
  return {
    ok: true,
    weaponId,
    starLevel: w.starLevel,
    gemLevel: w.gemLevel,
    combinedLevel: getCombinedLevel(w.starLevel, w.gemLevel),
    damageMult: 1 + bonus,
    breakthrough: false,
  };
}

function applyStarUpgrade(playerData, weaponId) {
  const check = canUpgradeStar(playerData, weaponId);
  if (!check.allowed) return { ok: false, reason: check.reason };
  const weapons = [...(playerData.weapons || [])];
  let w = weapons.find(x => x.id === weaponId);
  if (!w) {
    w = { id: weaponId, starLevel: 1, gemLevel: 1 };
    weapons.push(w);
  }
  w.starLevel = (w.starLevel || 1) + 1;
  w.gemLevel = 1;
  playerData.weapons = weapons;
  for (const [res, val] of Object.entries(check.cost)) {
    playerData[res] = (playerData[res] || 0) - val;
  }
  const bonus = computeWeaponBonus(w.starLevel, w.gemLevel);
  return {
    ok: true,
    weaponId,
    starLevel: w.starLevel,
    gemLevel: w.gemLevel,
    combinedLevel: getCombinedLevel(w.starLevel, w.gemLevel),
    damageMult: 1 + bonus,
    breakthrough: true,
  };
}

function computeWeaponDamageWithUpgrades(data) {
  const weaponId = data.equippedWeapon || "";
  const weapons = data.weapons || [];
  if (!weaponId) return { weaponDamage: 0, critChance: 0, critMultiplier: 1, range: "melee", damageMult: 1 };
  const def = WEAPON_DEFS.find(w => w.id === weaponId);
  if (!def) return { weaponDamage: 0, critChance: 0, critMultiplier: 1, range: "melee", damageMult: 1 };
  const wp = weapons.find(w => w.id === weaponId);
  const baseStar = (wp && wp.starLevel) || 1;
  const baseGem = (wp && wp.gemLevel) || 1;
  const combined = getCombinedLevel(baseStar, baseGem);
  const flatDamage = def.baseDamage + Math.floor(def.damagePerLevel * (combined - 1) / 4);
  const bonus = computeWeaponBonus(baseStar, baseGem);
  const weaponDamage = Math.floor(flatDamage * (1 + bonus));
  return {
    weaponDamage,
    critChance: def.critChance + (baseStar - 1) * 0.02,
    critMultiplier: def.critMultiplier + (baseGem - 1) * 0.05,
    range: def.range,
    starLevel: baseStar,
    gemLevel: baseGem,
    combinedLevel: combined,
    damageMult: 1 + bonus,
  };
}

module.exports = {
  MAX_STAR,
  MAX_GEM,
  getCombinedLevel,
  computeWeaponUpgradeCost,
  computeStarBreakthroughCost,
  getWeaponData,
  computeWeaponBonus,
  canUpgradeGem,
  canUpgradeStar,
  applyGemUpgrade,
  applyStarUpgrade,
  computeWeaponDamageWithUpgrades,
};
