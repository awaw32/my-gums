"use strict";

// ✅ متزامن مع WEAPON_DATA في army.js
export const WEAPON_DEFS = [
  { id: "w1", name: "سيف بدوي",       baseDamage: 4,  damagePerLevel: 3,  range: "melee",  critChance: 0.05, critMultiplier: 1.5 },
  { id: "w2", name: "قوس طويل",       baseDamage: 6,  damagePerLevel: 4,  range: "ranged", critChance: 0.08, critMultiplier: 1.8 },
  { id: "w3", name: "رمح حديدي",      baseDamage: 9,  damagePerLevel: 6,  range: "melee",  critChance: 0.10, critMultiplier: 2.0 },
  { id: "w4", name: "سيف دمشقي",      baseDamage: 13, damagePerLevel: 8,  range: "melee",  critChance: 0.12, critMultiplier: 2.2 },
  { id: "w5", name: "قوس ناري",       baseDamage: 18, damagePerLevel: 10, range: "ranged", critChance: 0.15, critMultiplier: 2.5 },
  { id: "w6", name: "فأس معركة",      baseDamage: 24, damagePerLevel: 14, range: "melee",  critChance: 0.18, critMultiplier: 3.0 },
];

const MAX_GEM = 8;

export function getWeaponDef(weaponId) {
  return WEAPON_DEFS.find(w => w.id === weaponId) || null;
}

function getCombinedLevel(level) {
  // level من 0 إلى 5 (عدد النجوم)
  return Math.max(1, level || 1);
}

function computeWeaponBonus(level) {
  return (level || 0) * 0.3; // كل نجمة +30% ضرر
}

export function computeWeaponDamage(data) {
  const weaponId = data.equippedWeapon || "";
  const weapons = data.weapons || [];
  if (!weaponId) return { weaponDamage: 0, critChance: 0, critMultiplier: 1, range: "melee" };
  const def = getWeaponDef(weaponId);
  if (!def) return { weaponDamage: 0, critChance: 0, critMultiplier: 1, range: "melee" };
  const wp = weapons.find(w => w.id === weaponId);
  // نستخدم level (0-5) من Weapon class مباشرة بدلاً من starLevel المنفصل
  const level = (wp && typeof wp.level === 'number') ? wp.level : 0;
  const baseDamage = def.baseDamage + Math.floor(def.damagePerLevel * level / 2);
  const bonus = computeWeaponBonus(level);
  const weaponDamage = Math.floor(baseDamage * (1 + bonus));
  return {
    weaponDamage,
    critChance: def.critChance + level * 0.02,
    critMultiplier: def.critMultiplier + level * 0.1,
    range: def.range,
    starLevel: Math.max(1, level),
    gemLevel: 1,
    combinedLevel: Math.max(1, level),
    damageMult: 1 + bonus,
  };
}
