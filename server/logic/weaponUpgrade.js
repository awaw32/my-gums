"use strict";

/**
 * 🗡️ نظام ترقية الأسلحة الموحد (الخادم)
 * متوافق مع client-side army.js — level (0-5 نجوم) مع UPGRADE_COSTS
 */

const { WEAPON_DEFS } = require("../db/databaseHelper");

const MAX_LEVEL = 5;

// 🛡️ بونص الضرر لكل نجمة ترقية سلاح — مكرَّر عمداً في js/combat-engine.js
// (server/ من نوع CommonJS، js/ من نوع ESM؛ لا يمكن استيراد وحدة واحدة مشتركة
// بينهما دون خطوة بناء). التطابق بين النسختين محمي فعلياً باختبار حقيقي في
// tests/star-bonus-parity.test.js — أي انحراف مستقبلي سيفشل ذلك الاختبار فوراً.
const STAR_DAMAGE_BONUS_PER_LEVEL = 0.3;

// تكاليف الترقية لكل مستوى نجمي (0→1, 1→2, 2→3, 3→4, 4→5) — مطابق لـ UPGRADE_COSTS في army.js
// 🛡️ كانت هذه القيم أعلى بكثير من نسخة العميل (حتى +567% عند 5⭐) بعد أن خُفِّضت
// أسعار العميل في تعديل توازن لاحق لم يصل لهذا الملف — الخادم كان يخصم أكثر
// مما يعرضه العميل صامتاً، ويرفض شراء أزراراً تظهر مفعّلة (العميل يظن السعر أرخص).
// القيم أدناه الآن مطابقة لـ js/army.js حرفياً (مصدر التوازن الأحدث)، ومحمية
// باختبار مقارنة حقيقي في tests/weapon-upgrade-costs.test.js.
const UPGRADE_COSTS = [
  { cash: 300,   gems: 8,   artifact: 0,  desertGem: 0, label: "1⭐" },
  { cash: 800,   gems: 20,  artifact: 1,  desertGem: 0, label: "2⭐" },
  { cash: 2000,  gems: 50,  artifact: 2,  desertGem: 0, label: "3⭐" },
  { cash: 5000,  gems: 120, artifact: 4,  desertGem: 1, label: "4⭐" },
  { cash: 12000, gems: 300, artifact: 8,  desertGem: 3, label: "5⭐" },
];

/**
 * التحقق من إمكانية ترقية سلاح
 */
function canUpgradeWeapon(playerData, weaponId, _houseLevel) {
  const weapons = playerData.weapons || [];
  const w = weapons.find(x => x.id === weaponId);
  if (!w) return { allowed: false, reason: "سلاح غير مملوك" };
  const currentLevel = w.level || 0;
  if (currentLevel >= MAX_LEVEL) return { allowed: false, reason: "السلاح في أقصى مستوياته (5⭐)" };
  
  // 🛡️ houseLevel من مبنى "خيمة القائد" — landsState.b1.level، نفس الحقل بالضبط
  // الذي يتحقق منه العميل (js/ui/ui-promotion.js) ومسار الشراء
  // (server/validation/player.js). كان هذا الملف يقرأ buildings.chiefPalace
  // (حقل خادم منفصل لا يُملؤه أي كود عميل إطلاقاً — يبقى دائماً افتراضياً 1)،
  // فيرفض ترقية أي سلاح requireLevel>1 حتى لو استوفى اللاعب الشرط الحقيقي.
  const effectiveHouseLevel = Math.max(1, (playerData.landsState?.b1?.level) || 1);
  
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

  // 🛡️ إحصائيات الأسلحة تُشتق من WEAPON_DEFS (databaseHelper.js) حصراً — كانت
  // مكرَّرة هنا كنسخة سابعة منفصلة (نفس القيم لكن بلا أي رابط)، فقد تنحرف
  // بصمت لو عُدِّلت إحدى النسختين دون الأخرى دون أن يفشل أي اختبار.
  const def = WEAPON_DEFS.find(w => w.id === weaponId);
  if (!def) return { weaponDamage: 0, critChance: 0, critMultiplier: 1, range: "melee", damageMult: 1 };
  
  const wp = weapons.find(w => w.id === weaponId);
  const level = (wp && typeof wp.level === 'number') ? wp.level : 0;
  const baseDamage = def.baseDamage + Math.floor(def.damagePerLevel * level / 2);
  const bonus = level * STAR_DAMAGE_BONUS_PER_LEVEL;
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
  STAR_DAMAGE_BONUS_PER_LEVEL,
  canUpgradeWeapon,
  applyWeaponUpgrade,
  computeWeaponDamageWithUpgrades,
};
