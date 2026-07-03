"use strict";

export const WEAPON_DEFS = [
  { id: "bedouin_sword",  name: "سيف بدوي",       baseDamage: 4,  damagePerLevel: 3,  range: "melee",  critChance: 0.05, critMultiplier: 1.5 },
  { id: "long_bow",       name: "قوس طويل",       baseDamage: 3,  damagePerLevel: 2,  range: "ranged", critChance: 0.08, critMultiplier: 1.8 },
  { id: "iron_spear",     name: "رمح حديدي",      baseDamage: 5,  damagePerLevel: 4,  range: "melee",  critChance: 0.12, critMultiplier: 2.0 },
  { id: "damascus_sword", name: "سيف دمشقي",      baseDamage: 7,  damagePerLevel: 5,  range: "melee",  critChance: 0.15, critMultiplier: 2.5 },
];

const MAX_GEM = 8;

export function getWeaponDef(weaponId) {
  return WEAPON_DEFS.find(w => w.id === weaponId) || null;
}

function getCombinedLevel(starLevel, gemLevel) {
  return ((starLevel - 1) * MAX_GEM) + gemLevel;
}

function computeWeaponBonus(starLevel, gemLevel) {
  const gemBonus = gemLevel * 0.05;
  const starBonus = (starLevel - 1) * 0.25;
  return gemBonus + starBonus;
}

export function computeWeaponDamage(data) {
  const weaponId = data.equippedWeapon || "";
  const weapons = data.weapons || [];
  if (!weaponId) return { weaponDamage: 0, critChance: 0, critMultiplier: 1, range: "melee" };
  const def = getWeaponDef(weaponId);
  if (!def) return { weaponDamage: 0, critChance: 0, critMultiplier: 1, range: "melee" };
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
