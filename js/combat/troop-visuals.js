"use strict";

export const TROOPS_PER_VISUAL = 1000;
export const MAX_VISUAL_TROOPS = 12;

export function getVisualTroopCount(power) {
  const count = Math.floor((power || 0) / TROOPS_PER_VISUAL);
  return Math.min(count, MAX_VISUAL_TROOPS);
}

const WEAPON_TINTS = {
  bedouin_sword:  { body: "#d4a574", weapon: "#aaa" },
  long_bow:       { body: "#8B4513", weapon: "#6B3A1F" },
  iron_spear:     { body: "#6B7B8D", weapon: "#9E9E9E" },
  damascus_sword: { body: "#2C3E50", weapon: "#FFD700" },
};

export function getWeaponVisuals(weaponId) {
  return WEAPON_TINTS[weaponId] || null;
}

export function getTroopFormation(index, total) {
  if (total <= 1) return { ox: 0, oy: 0 };
  if (total <= 4) {
    return { ox: -30 - (index % 2) * 20, oy: 20 + Math.floor(index / 2) * 22 };
  }
  if (total <= 8) {
    return { ox: -30 - (index % 4) * 18, oy: 20 + Math.floor(index / 4) * 22 };
  }
  const cols = Math.min(total, 4);
  return { ox: -30 - (index % cols) * 16, oy: 20 + Math.floor(index / cols) * 20 };
}
