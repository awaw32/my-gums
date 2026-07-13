"use strict";

import { WEAPON_COMBAT_STATS as _WCS, computeWeaponDamage as _computeWD } from "../combat-engine.js";
export const WEAPON_COMBAT_STATS = _WCS;
export const computeWeaponDamage = _computeWD;

export const WEAPON_DEFS = [
  { id: "w1", name: "سيف بدوي", baseDamage: 4,  damagePerLevel: 3,  range: "melee" },
  { id: "w2", name: "قوس طويل", baseDamage: 6,  damagePerLevel: 4,  range: "ranged" },
  { id: "w3", name: "رمح حديدي", baseDamage: 9,  damagePerLevel: 6,  range: "melee" },
  { id: "w4", name: "سيف دمشقي", baseDamage: 13, damagePerLevel: 8,  range: "melee" },
  { id: "w5", name: "قوس ناري",  baseDamage: 18, damagePerLevel: 10, range: "ranged" },
  { id: "w6", name: "فأس معركة", baseDamage: 24, damagePerLevel: 14, range: "melee" },
];

export function getWeaponDef(weaponId) {
  return WEAPON_DEFS.find(w => w.id === weaponId) || null;
}

export function getWeaponCombatStats(weaponId) {
  return WEAPON_COMBAT_STATS[weaponId] || null;
}
