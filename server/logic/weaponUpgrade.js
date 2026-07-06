"use strict";

/**
 * 🗡️ نظام ترقية الأسلحة الموحد (الخادم)
 * متوافق مع client-side army.js — level (0-5 نجوم) مع UPGRADE_COSTS
 */

const MAX_LEVEL = 5;

// تكاليف الترقية لكل مستوى نجمي (0→1, 1→2, 2→3, 3→4, 4→5) — مطابق لـ UPGRADE_COSTS في army.js
const UPGRADE_COSTS = [
  { cash: 500,  gems: 10,  artifact: 0,  desertGem: 0, label: "1⭐" },
  { cash: 2000, gems: 30,  artifact: 1,  desertGem: 0, label: "2⭐" },
  { cash: 8000, gems: 80,  artifact: 2,  desertGem: 0, label: "3⭐" },
  { cash: 25000, gems: 200, artifact: 4, desertGem: 1, label: "4⭐" },
  { cash: 80000, gems: 500, artifact: 8, desertGem: 3, label: "5⭐" },
];

/**
 * التحقق من إمكانية ترقية سلاح
 */
function canUpgradeWeapon(playerData, weaponId, houseLevel) {
  const weapons = playerData.weapons || [];
  const w = weapons.find(x => x.id === weaponId);
  if (!w) return { allowed: false, reason: "سلاح غير مملوك" };
  const currentLevel = w.level || 0;
  if (currentLevel >= MAX_LEVEL) return { allowed: false, reason: "السلاح في أقصى مستوياته (5⭐)" };
  
  // houseLevel يُحدد من بيت الزعيم في اللعبة — الخادم يأخذه من buildings.chiefPalace
  const effectiveHouseLevel = Math.max(1, (playerData.buildings?.chiefPalace) || 1);
  
  // نأخذ requireLevel من وزن السلاح (افتراضياً 1-6)
  const requireLevel = weaponId === 'w1' ? 1
    : weaponId === 'w2' ? 2
    : weaponId === 'w3' ? 3
    : weaponId === 'w4' ? 4
    : weaponId === 'w5' ? 5
    : weaponId === 'w6' ? 6
    : 1;
    
  if (effectiveHouseLevel < requireLevel) {
    return { allowed: false, reason: `يحتاج بيت الزعيم المستوى ${requireLevel}` };
  }
  
  const cost = UPGRADE_COSTS[currentLevel];
  if (!cost) return { allowed: false, reason: "خطأ في تكاليف الترقية" };
  
  // التحقق من الموارد
  const checks = [
    { res: 'cash', need: cost.cash },
    { res: 'gems', need: cost.gems },
  ];
  if (cost.artifact > 0) checks.push({ res: 'artifacts', need: cost.artifact });
  if (cost.desertGem > 0) checks.push({ res: 'desertGem', need: cost.desertGem });
  
  for (const { res, need } of checks) {
    const have = playerData[res] || 0;
    if (have < need) {
      const names = { cash: '💵', gems: '💎', artifacts: '🏺', desertGem: '💠' };
      return { allowed: false, reason: `غير كافٍ ${names[res] || res}: تحتاج ${need}، لديك ${have}` };
    }
  }
  
  return { allowed: true, cost, currentLevel, nextLevel: currentLevel + 1 };
}

/**
 * تطبيق ترقية السلاح على بيانات اللاعب
 */
function applyWeaponUpgrade(playerData, weaponId) {
  const check = canUpgradeWeapon(playerData, weaponId);
  if (!check.allowed) return { ok: false, reason: check.reason };
  
  const weapons = [...(playerData.weapons || [])];
  let w = weapons.find(x => x.id === weaponId);
  if (!w) {
    w = { id: weaponId, level: 0, starLevel: 1, gemLevel: 1 };
    weapons.push(w);
  }
  
  // صرف الموارد
  const cost = check.cost;
  playerData.cash = (playerData.cash || 0) - cost.cash;
  playerData.gems = (playerData.gems || 0) - cost.gems;
  if (cost.artifact > 0) playerData.artifacts = (playerData.artifacts || 0) - cost.artifact;
  if (cost.desertGem > 0) playerData.desertGem = (playerData.desertGem || 0) - cost.desertGem;
  
  // تطبيق الترقية
  w.level = check.nextLevel;
  w.starLevel = Math.max(1, w.level);
  w.gemLevel = 1;
  playerData.weapons = weapons;
  
  return {
    ok: true,
    weaponId,
    level: w.level,
    starLevel: w.starLevel,
    gemLevel: 1,
    cost,
  };
}

/**
 * حساب ضرر السلاح (للخادم — معارك PvP)
 */
function computeWeaponDamageWithUpgrades(data) {
  const weaponId = data.equippedWeapon || "";
  const weapons = data.weapons || [];
  if (!weaponId) return { weaponDamage: 0, critChance: 0, critMultiplier: 1, range: "melee", damageMult: 1 };
  
  // إحصائيات الأسلحة (متزامنة مع WEAPON_DATA في army.js)
  const WEAPON_STATS = {
    w1: { baseDamage: 4, damagePerLevel: 3, range: "melee", critChance: 0.05, critMultiplier: 1.5 },
    w2: { baseDamage: 6, damagePerLevel: 4, range: "ranged", critChance: 0.08, critMultiplier: 1.8 },
    w3: { baseDamage: 9, damagePerLevel: 6, range: "melee", critChance: 0.10, critMultiplier: 2.0 },
    w4: { baseDamage: 13, damagePerLevel: 8, range: "melee", critChance: 0.12, critMultiplier: 2.2 },
    w5: { baseDamage: 18, damagePerLevel: 10, range: "ranged", critChance: 0.15, critMultiplier: 2.5 },
    w6: { baseDamage: 24, damagePerLevel: 14, range: "melee", critChance: 0.18, critMultiplier: 3.0 },
  };
  
  const def = WEAPON_STATS[weaponId];
  if (!def) return { weaponDamage: 0, critChance: 0, critMultiplier: 1, range: "melee", damageMult: 1 };
  
  const wp = weapons.find(w => w.id === weaponId);
  const level = (wp && typeof wp.level === 'number') ? wp.level : 0;
  const baseDamage = def.baseDamage + Math.floor(def.damagePerLevel * level / 2);
  const bonus = level * 0.3; // كل نجمة +30%
  const weaponDamage = Math.floor(baseDamage * (1 + bonus));
  
  return {
    weaponDamage,
    critChance: def.critChance + level * 0.02,
    critMultiplier: def.critMultiplier + level * 0.1,
    range: def.range,
    level,
    damageMult: 1 + bonus,
  };
}

module.exports = {
  MAX_LEVEL,
  UPGRADE_COSTS,
  canUpgradeWeapon,
  applyWeaponUpgrade,
  computeWeaponDamageWithUpgrades,
};
