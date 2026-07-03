"use strict";

const RESEARCH_DEFS = {
  military: {
    id: "military",
    name: "البحوث العسكرية",
    skills: {
      desertShield: {
        id: "desertShield",
        name: "درع الصحراء",
        maxLevel: 20,
        baseCost: { cash: 200, gold: 5 },
        costScale: 1.22,
        effectDesc: "دفاع +3% لكل مستوى",
        effectPerLevel: { defensePercent: 3 },
      },
      pursuitTactic: {
        id: "pursuitTactic",
        name: "تكتيك الملاحقة",
        maxLevel: 15,
        baseCost: { cash: 150, gold: 3 },
        costScale: 1.25,
        effectDesc: "سرعة حركة +2% + قوة تحمل +1% لكل مستوى",
        effectPerLevel: { moveSpeedPercent: 2, endurancePercent: 1 },
      },
    },
  },
  economic: {
    id: "economic",
    name: "البحوث الاقتصادية",
    skills: {
      insight: {
        id: "insight",
        name: "الفراسة",
        maxLevel: 25,
        baseCost: { cash: 100, gold: 2, gems: 1 },
        costScale: 1.18,
        effectDesc: "إنتاج الذهب +4% لكل مستوى",
        effectPerLevel: { goldProduction: 4 },
      },
      trade: {
        id: "trade",
        name: "التجارة",
        maxLevel: 20,
        baseCost: { cash: 150, gold: 4 },
        costScale: 1.20,
        effectDesc: "بلورات زرقاء +2% وسرعة بناء +2% لكل مستوى",
        effectPerLevel: { crystalProduction: 2, buildSpeed: 2 },
      },
    },
  },
};

function getResearchCategory(categoryId) {
  return RESEARCH_DEFS[categoryId] || null;
}

function getResearchSkill(categoryId, skillId) {
  const cat = RESEARCH_DEFS[categoryId];
  if (!cat) return null;
  return cat.skills[skillId] || null;
}

function computeResearchCost(categoryId, skillId, currentLevel) {
  const def = getResearchSkill(categoryId, skillId);
  if (!def) return null;
  const level = currentLevel || 0;
  const scale = Math.pow(def.costScale, level);
  const cost = {};
  for (const [res, val] of Object.entries(def.baseCost)) {
    cost[res] = Math.floor(val * scale);
  }
  return cost;
}

function canUpgradeResearch(playerData, categoryId, skillId) {
  const def = getResearchSkill(categoryId, skillId);
  if (!def) return { allowed: false, reason: "مهارة بحث غير معروفة" };
  const research = playerData.research || {};
  const skillKey = `${categoryId}.${skillId}`;
  const currentLevel = research[skillKey] || 0;
  if (currentLevel >= def.maxLevel) {
    return { allowed: false, reason: "هذا البحث في أقصى مستواه" };
  }
  const academyLevel = (playerData.buildings || {}).researchAcademy || 0;
  const maxFromAcademy = academyLevel * 2;
  if (currentLevel >= maxFromAcademy) {
    return { allowed: false, reason: `مستوى خيمة الحكيم (${academyLevel}) يحدد أقصى مستوى بحث بـ ${maxFromAcademy}` };
  }
  const palaceLevel = (playerData.buildings || {}).chiefPalace || 0;
  if (currentLevel >= palaceLevel) {
    return { allowed: false, reason: `مستوى بيت الزعيم (${palaceLevel}) يمنع ترقية البحث أكثر` };
  }
  const cost = computeResearchCost(categoryId, skillId, currentLevel);
  for (const [res, val] of Object.entries(cost)) {
    const have = playerData[res] || 0;
    if (have < val) {
      return { allowed: false, reason: `غير كافٍ ${res}: تحتاج ${val}، لديك ${have}` };
    }
  }
  return { allowed: true, cost };
}

function applyResearchUpgrade(playerData, categoryId, skillId) {
  const check = canUpgradeResearch(playerData, categoryId, skillId);
  if (!check.allowed) return { ok: false, reason: check.reason };
  const research = playerData.research || {};
  const skillKey = `${categoryId}.${skillId}`;
  research[skillKey] = (research[skillKey] || 0) + 1;
  playerData.research = research;
  for (const [res, val] of Object.entries(check.cost)) {
    playerData[res] = (playerData[res] || 0) - val;
  }
  return {
    ok: true,
    categoryId,
    skillId,
    newLevel: research[skillKey],
    totalEffects: getResearchEffects(playerData),
  };
}

function getResearchEffects(playerData) {
  const research = playerData.research || {};
  const effects = { defensePercent: 0, moveSpeedPercent: 0, endurancePercent: 0, goldProduction: 0, crystalProduction: 0, buildSpeed: 0 };
  for (const [catId, cat] of Object.entries(RESEARCH_DEFS)) {
    for (const [skillId, skill] of Object.entries(cat.skills)) {
      const skillKey = `${catId}.${skillId}`;
      const level = research[skillKey] || 0;
      for (const [effect, perLevel] of Object.entries(skill.effectPerLevel)) {
        effects[effect] = (effects[effect] || 0) + level * perLevel;
      }
    }
  }
  return effects;
}

module.exports = {
  RESEARCH_DEFS,
  getResearchCategory,
  getResearchSkill,
  computeResearchCost,
  canUpgradeResearch,
  applyResearchUpgrade,
  getResearchEffects,
};
