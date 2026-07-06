"use strict";

/**
 * 🗡️ نظام حساب ضرر الأسلحة في المعارك
 * بيانات الأسلحة الأساسية موجودة في js/army.js (WEAPON_DATA)
 * هنا نضيف تفاصيل القتال: المدى، الفرصة الحرجة، الضرر لكل مستوى
 */

export const WEAPON_COMBAT_STATS = {
  w1: { baseDamage: 4,  damagePerLevel: 3,  range: "melee",  critChance: 0.05, critMultiplier: 1.5 },
  w2: { baseDamage: 6,  damagePerLevel: 4,  range: "ranged", critChance: 0.08, critMultiplier: 1.8 },
  w3: { baseDamage: 9,  damagePerLevel: 6,  range: "melee",  critChance: 0.10, critMultiplier: 2.0 },
  w4: { baseDamage: 13, damagePerLevel: 8,  range: "melee",  critChance: 0.12, critMultiplier: 2.2 },
  w5: { baseDamage: 18, damagePerLevel: 10, range: "ranged", critChance: 0.15, critMultiplier: 2.5 },
  w6: { baseDamage: 24, damagePerLevel: 14, range: "melee",  critChance: 0.18, critMultiplier: 3.0 },
};

export function getWeaponCombatStats(weaponId) {
  return WEAPON_COMBAT_STATS[weaponId] || null;
}

function computeWeaponBonus(level) {
  return (level || 0) * 0.3; // كل نجمة +30% ضرر
}

export function computeWeaponDamage(data) {
  const weaponId = data.equippedWeapon || "";
  const weapons = data.weapons || [];
  if (!weaponId) return { weaponDamage: 0, critChance: 0, critMultiplier: 1, range: "melee" };
  const def = WEAPON_COMBAT_STATS[weaponId];
  if (!def) return { weaponDamage: 0, critChance: 0, critMultiplier: 1, range: "melee" };
  const wp = weapons.find(w => w.id === weaponId);
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
