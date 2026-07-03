"use strict";

function computePlayerStats(data) {
  const baseHP = 120;
  const baseDMG = 12;
  const playerLevel = data.level || 1;
  const unitLevel = data.unitLevel || 1;
  const trainingLevel = data.trainingLevel || 1;
  const prestigeLevel = data.prestigeLevel || 0;
  const armyPower = data.army_power || 0;

  const maxHp = baseHP
    + playerLevel * 2
    + unitLevel * 3
    + trainingLevel * 2
    + prestigeLevel * 5;

  const totalDamage = baseDMG
    + Math.floor(armyPower / 10)
    + playerLevel
    + unitLevel * 2
    + prestigeLevel * 3;

  return { maxHp, totalDamage };
}

module.exports = { computePlayerStats };
