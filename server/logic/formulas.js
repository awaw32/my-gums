"use strict";

const { WEAPON_DEFS } = require("../db/databaseHelper");
const { getBuildingEffects, getAllBuildingEffects } = require("../db/buildings");
const { getResearchEffects } = require("../db/research");
const { computeWeaponDamageWithUpgrades } = require("./weaponUpgrade");

const KNOWLEDGE_ECONOMIC_BUFFS = {
  resourceSpeed: [1.0, 1.08, 1.16, 1.25, 1.35, 1.50],
};
const KNOWLEDGE_MILITARY_BUFFS = {
  moveSpeedPercent:   [0, 3, 5, 8, 10, 12],
  defensePercent:     [0, 4, 7, 10, 14, 18],
};

function getWeaponDef(weaponId) {
  return WEAPON_DEFS.find(w => w.id === weaponId) || null;
}

function computeWeaponDamage(data) {
  return computeWeaponDamageWithUpgrades(data);
}

function computePlayerStats(data) {
  const baseHP = 120;
  const baseDMG = 12;
  const playerLevel = data.level || 1;
  const unitLevel = data.unitLevel || 1;
  const trainingLevel = data.trainingLevel || 1;
  const prestigeLevel = data.prestigeLevel || 0;
  const armyPower = data.army_power || 0;
  const armyYardLevel = data.armyYardLevel || 1;
  const knowledgeLevel = data.knowledgeLevel || 1;
  const knowledgeType = data.knowledgeType || "economic";

  const armyYardHpBonus = armyYardLevel * 6;
  const buildingEffects = getAllBuildingEffects(data.buildings);
  const barracksHp = buildingEffects.hpBonus || 0;
  const researchEff = getResearchEffects(data);

  const maxHp = baseHP
    + playerLevel * 2
    + unitLevel * 3
    + trainingLevel * 2
    + prestigeLevel * 5
    + armyYardHpBonus
    + barracksHp;

  const weaponStats = computeWeaponDamageWithUpgrades(data);
  let totalDamage = baseDMG
    + Math.floor(armyPower / 10)
    + playerLevel
    + unitLevel * 2
    + prestigeLevel * 3
    + weaponStats.weaponDamage;

  let critChance = weaponStats.critChance;
  let critMultiplier = weaponStats.critMultiplier;

  const researchDefense = (researchEff.defensePercent || 0);
  const researchMoveSpeed = (researchEff.moveSpeedPercent || 0);
  const researchEndurance = (researchEff.endurancePercent || 0);

  const moveSpeedBuff = (knowledgeType === "military"
    ? (KNOWLEDGE_MILITARY_BUFFS.moveSpeedPercent[Math.min(knowledgeLevel, KNOWLEDGE_MILITARY_BUFFS.moveSpeedPercent.length - 1)] || 0)
    : 0) + researchMoveSpeed;

  const defenseBuff = (knowledgeType === "military"
    ? (KNOWLEDGE_MILITARY_BUFFS.defensePercent[Math.min(knowledgeLevel, KNOWLEDGE_MILITARY_BUFFS.defensePercent.length - 1)] || 0)
    : 0) + researchDefense;

  const resourceSpeed = (knowledgeType === "economic"
    ? (KNOWLEDGE_ECONOMIC_BUFFS.resourceSpeed[Math.min(knowledgeLevel, KNOWLEDGE_ECONOMIC_BUFFS.resourceSpeed.length - 1)] || 1)
    : 1) + (researchEff.goldProduction || 0) / 100;

  const depotProtectPercent = buildingEffects.protectPercent || 0;

  return {
    maxHp,
    totalDamage,
    critChance,
    critMultiplier,
    moveSpeedBuff,
    defenseBuff,
    resourceSpeed,
    researchEndurance,
    depotProtectPercent,
    weaponStarLevel: weaponStats.starLevel || 1,
    weaponGemLevel: weaponStats.gemLevel || 1,
    weaponCombinedLevel: weaponStats.combinedLevel || 1,
    weaponDamageMult: weaponStats.damageMult || 1,
  };
}

function computeArmyYardUpgradeCost(currentLevel) {
  const next = currentLevel + 1;
  return {
    cash: 200 + next * 50,
    gold: 5 + next * 3,
    hammers: 1 + Math.floor(next / 5),
  };
}

function computeArmyYardStats(armyYardLevel) {
  const level = armyYardLevel || 1;
  const maxTroops = Math.min(8 + level, 20);
  const hpBonus = level * 6;
  return { maxTroops, hpBonus };
}

function computeKnowledgeUpgradeCost(currentLevel) {
  const next = currentLevel + 1;
  return {
    cash: 300 + next * 60,
    gold: 10 + next * 5,
    scrolls: 1 + Math.floor(next / 3),
  };
}

function computeKnowledgeBonuses(data) {
  const knowledgeLevel = data.knowledgeLevel || 1;
  const knowledgeType = data.knowledgeType || "economic";
  const idx = Math.min(knowledgeLevel, KNOWLEDGE_ECONOMIC_BUFFS.resourceSpeed.length - 1);
  if (knowledgeType === "economic") {
    return {
      resourceSpeed: KNOWLEDGE_ECONOMIC_BUFFS.resourceSpeed[idx],
      moveSpeedPercent: 0,
      defensePercent: 0,
    };
  }
  return {
    resourceSpeed: 1,
    moveSpeedPercent: KNOWLEDGE_MILITARY_BUFFS.moveSpeedPercent[idx],
    defensePercent: KNOWLEDGE_MILITARY_BUFFS.defensePercent[idx],
  };
}

function computeEffectivePower(totalPower, currentHp, maxHp) {
  if (!maxHp || maxHp <= 0) return totalPower;
  const ratio = Math.max(0, Math.min(1, (currentHp || 0) / maxHp));
  return Math.max(500, Math.floor(totalPower * ratio));
}

function applyDefeatPenalty(armyPower) {
  return Math.max(500, Math.floor(armyPower * 0.9));
}

const INITIAL_ARMY_POWER = 5000;

module.exports = {
  computePlayerStats,
  computeWeaponDamage,
  computeArmyYardUpgradeCost,
  computeArmyYardStats,
  computeKnowledgeUpgradeCost,
  computeKnowledgeBonuses,
  getWeaponDef,
  computeEffectivePower,
  applyDefeatPenalty,
  INITIAL_ARMY_POWER,
  WEAPON_DEFS,
  KNOWLEDGE_ECONOMIC_BUFFS,
  KNOWLEDGE_MILITARY_BUFFS,
  getAllBuildingEffects,
  getResearchEffects,
};
