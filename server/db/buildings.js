"use strict";

const BUILDING_DEFS = {
  chiefPalace: {
    id: "chiefPalace",
    name: "بيت الزعيم",
    maxLevel: 50,
    baseCost: { cash: 500, gold: 10 },
    costScale: 1.25,
    desc: "المستوى الأعلى لجميع المباني والبحوث لا يمكن أن يتجاوز مستواه",
  },
  troopBarracks: {
    id: "troopBarracks",
    name: "ثكنات الفرسان",
    maxLevel: 40,
    baseCost: { cash: 300, gold: 5, hammers: 2 },
    costScale: 1.20,
    hpPerLevel: 500,
    desc: "كل لفل يزيد Max HP للجيش بـ 500 نقطة، ويفتح سعة أكبر للجنود، ويعيد إنعاش 10% بعد الهزيمة",
  },
  armoryVault: {
    id: "armoryVault",
    name: "مكتبة القطع الأسطورية",
    maxLevel: 5,
    baseCost: { cash: 1000, gold: 25, scrolls: 3 },
    costScale: 2.0,
    desc: "يحدد مستواه الحد الأقصى لترقيات نجوم الأسلحة (starLevel max = vaultLevel)",
  },
  researchAcademy: {
    id: "researchAcademy",
    name: "خيمة الحكيم",
    maxLevel: 30,
    baseCost: { cash: 400, gold: 8, scrolls: 1 },
    costScale: 1.30,
    desc: "يفتح مستويات جديدة لشجرة البحوث",
  },
  resourceDepot: {
    id: "resourceDepot",
    name: "خزانة الموارد",
    maxLevel: 25,
    baseCost: { cash: 200, gold: 3 },
    costScale: 1.18,
    goldPerMinPerLevel: 5,
    protectPercentPerLevel: 2,
    desc: "يزيد إنتاج الذهب التلقائي وحماية الموارد من النهب",
  },
};

const BUILDING_IDS = Object.keys(BUILDING_DEFS);

function getBuildingDef(id) {
  return BUILDING_DEFS[id] || null;
}

function computeBuildingCost(buildingId, currentLevel) {
  const def = BUILDING_DEFS[buildingId];
  if (!def) return null;
  const level = currentLevel || 0;
  const scale = Math.pow(def.costScale, level);
  const cost = {};
  for (const [res, val] of Object.entries(def.baseCost)) {
    cost[res] = Math.floor(val * scale);
  }
  return cost;
}

function canUpgradeBuilding(playerData, buildingId) {
  const def = BUILDING_DEFS[buildingId];
  if (!def) return { allowed: false, reason: "مبنى غير معروف" };
  const buildings = playerData.buildings || {};
  const currentLevel = buildings[buildingId] || 0;
  if (currentLevel >= def.maxLevel) {
    return { allowed: false, reason: "المبنى في أقصى مستواه" };
  }
  const palaceLevel = buildings.chiefPalace || 0;
  if (buildingId !== "chiefPalace" && currentLevel >= palaceLevel) {
    return { allowed: false, reason: `مستوى بيت الزعيم (${palaceLevel}) يمنع الترقية أكثر` };
  }
  if (buildingId === "armoryVault") {
    const existing = buildings[buildingId] || 0;
    if (existing >= def.maxLevel) {
      return { allowed: false, reason: "مكتبة القطع في أقصى مستواها" };
    }
  }
  const cost = computeBuildingCost(buildingId, currentLevel);
  for (const [res, val] of Object.entries(cost)) {
    const have = playerData[res] || 0;
    if (have < val) {
      return { allowed: false, reason: `غير كافٍ ${res}: تحتاج ${val}، لديك ${have}` };
    }
  }
  return { allowed: true, cost };
}

function applyBuildingUpgrade(playerData, buildingId) {
  const check = canUpgradeBuilding(playerData, buildingId);
  if (!check.allowed) return { ok: false, reason: check.reason };
  const buildings = playerData.buildings || {};
  buildings[buildingId] = (buildings[buildingId] || 0) + 1;
  playerData.buildings = buildings;
  for (const [res, val] of Object.entries(check.cost)) {
    playerData[res] = (playerData[res] || 0) - val;
  }
  const newLevel = buildings[buildingId];
  const def = BUILDING_DEFS[buildingId];
  return {
    ok: true,
    buildingId,
    newLevel,
    effects: getBuildingEffects(buildingId, newLevel),
  };
}

function getBuildingEffects(buildingId, level) {
  const def = BUILDING_DEFS[buildingId];
  if (!def) return {};
  switch (buildingId) {
    case "troopBarracks":
      return { hpBonus: level * def.hpPerLevel };
    case "armoryVault":
      return { maxStarLevel: level };
    case "resourceDepot":
      return {
        goldPerMin: level * def.goldPerMinPerLevel,
        protectPercent: level * def.protectPercentPerLevel,
      };
    case "researchAcademy":
      return { maxResearchLevel: level * 2 };
    default:
      return {};
  }
}

function getAllBuildingEffects(buildings) {
  if (!buildings) return {};
  const result = {};
  for (const [id, level] of Object.entries(buildings)) {
    Object.assign(result, getBuildingEffects(id, level));
  }
  return result;
}

module.exports = {
  BUILDING_DEFS,
  BUILDING_IDS,
  getBuildingDef,
  computeBuildingCost,
  canUpgradeBuilding,
  applyBuildingUpgrade,
  getBuildingEffects,
  getAllBuildingEffects,
};
