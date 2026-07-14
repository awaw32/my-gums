"use strict";

/**
 * نظام القرى والمباني - ملك الصحراء
 * 5 قرى متسلسلة، كل قرية 4-5 مباني
 */

import { STORY_VILLAGES, getBuildingImages } from './story.js';

export class VillageBuilding {
  constructor(template, villageId) {
    this.id = template.id;
    this.villageId = villageId;
    this.slot = template.slot;
    this.name = template.name;
    this.description = template.description;
    this.icon = template.icon;
    this.x = template.x ?? 50;
    this.y = template.y ?? 50;
    this.img = getBuildingImages(villageId, template.id) || template.img || {
      empty: 'assets/images/building-ruins.png',
      building: 'assets/images/building-construction.png',
      built: 'assets/images/building-complete.png'
    };
    this.cost = template.cost;
    this.production = template.production;
    this.upgradeCost = template.upgradeCost;
    this.maxLevel = template.maxLevel;
    this.power = template.power;
    this.monsterName = template.monsterName;
    this.monsterPower = template.monsterPower;

    this.level = 0;
    this.state = "locked";
    this.constructTimer = 0;
    this.constructDuration = 10;
    this.fightAnimTimer = 0;
    this.fightResult = null;
    this.productionAccum = 0;
    this.productionInterval = 5;
    this._onBuilt = null;
    this._onUpgraded = null;
  }

  get productionRate() {
    const rates = {};
    for (const [resource, base] of Object.entries(this.production)) {
      rates[resource] = Math.floor(base * (1 + this.level * 0.1));
    }
    return rates;
  }

  get currentMonsterPower() {
    return Math.floor(this.monsterPower * (1 + this.level * 0.15));
  }

  get currentUpgradeCost() {
    const costs = {};
    for (const [resource, base] of Object.entries(this.upgradeCost)) {
      costs[resource] = Math.floor(base * (1 + this.level * 0.1));
    }
    return costs;
  }

  get powerContribution() {
    if (this.state !== "ready") return 0;
    return Math.floor(this.power * (1 + this.level * 0.1));
  }

  canAfford(economy) {
    for (const [resource, amount] of Object.entries(this.cost)) {
      if (!economy.canAfford(resource, amount)) return false;
    }
    return true;
  }

  canUpgrade(economy) {
    if (this.state !== "ready" || this.level >= this.maxLevel) return false;
    for (const [resource, amount] of Object.entries(this.currentUpgradeCost)) {
      if (!economy.canAfford(resource, amount)) return false;
    }
    return true;
  }

  fight(playerPower, economy) {
    if (this.state !== "locked") return false;
    if (economy && !this.canAfford(economy)) return false;
    this.fightAnimTimer = 0.8;
    if (playerPower >= this.currentMonsterPower) {
      this.fightResult = "win";
      this.state = "building";
      this.constructTimer = this.constructDuration;
      if (economy) {
        for (const [resource, amount] of Object.entries(this.cost)) {
          economy.spend(resource, amount);
        }
      }
      return true;
    } else {
      this.fightResult = "lose";
      return false;
    }
  }

  update(dt) {
    if (this.fightAnimTimer > 0) {
      this.fightAnimTimer -= dt;
      if (this.fightAnimTimer <= 0) {
        this.fightAnimTimer = 0;
        this.fightResult = null;
      }
    }
    if (this.state === "building") {
      this.constructTimer -= dt;
      if (this.constructTimer <= 0) {
        this.constructTimer = 0;
        this.state = "ready";
        this.level = 1;
        if (this._onBuilt) this._onBuilt(this);
      }
    }
    if (this.state === "ready") {
      this.productionAccum += dt;
      if (this.productionAccum >= this.productionInterval) {
        this.productionAccum -= this.productionInterval;
        return this.productionRate;
      }
    }
    return null;
  }

  upgrade(economy) {
    if (!this.canUpgrade(economy)) return false;
    for (const [resource, amount] of Object.entries(this.currentUpgradeCost)) {
      economy.spend(resource, amount);
    }
    this.level++;
    if (this._onUpgraded) this._onUpgraded(this);
    return true;
  }
}

export class GameVillage {
  constructor(economy) {
    this.economy = economy;
    this.currentVillageId = "wadi";
    this.villages = STORY_VILLAGES;
    this.buildings = [];
    this.completedVillages = [];
    this.currentChapter = 1;
    this._savedOnBuilt = null;
    this._savedOnUpgraded = null;
    this.initVillage("wadi");
  }

  initVillage(villageId) {
    this.buildings = [];
    this.currentVillageId = villageId;
    const village = this.villages.find(v => v.id === villageId);
    if (!village) return;
    for (const b of village.buildings) {
      this.buildings.push(new VillageBuilding(b, villageId));
    }
    if (this._savedOnBuilt || this._savedOnUpgraded) {
      this.setBuildingCallbacks(this._savedOnBuilt, this._savedOnUpgraded);
    }
  }

  get currentVillage() {
    return this.villages.find(v => v.id === this.currentVillageId);
  }

  get nextVillage() {
    const idx = this.villages.findIndex(v => v.id === this.currentVillageId);
    if (idx < this.villages.length - 1) {
      return this.villages[idx + 1];
    }
    return null;
  }

  isVillageUnlocked(villageId) {
    const village = this.villages.find(v => v.id === villageId);
    if (!village) return false;
    if (villageId === "wadi") return true;
    return this.completedVillages.includes(village.id) ||
           (this.economy.level >= village.levelRequired);
  }

  isVillageComplete() {
    return this.buildings.every(b => b.state === "ready" && b.level >= 1);
  }

  completeVillage() {
    if (!this.isVillageComplete()) return false;
    if (!this.completedVillages.includes(this.currentVillageId)) {
      this.completedVillages.push(this.currentVillageId);
    }
    return true;
  }

  canMoveToNext() {
    const next = this.nextVillage;
    if (!next) return false;
    if (!this.isVillageComplete() || this.economy.level < next.levelRequired) return false;
    const cost = next.moveCost || {};
    for (const [resource, amount] of Object.entries(cost)) {
      if (!this.economy.canAfford(resource, amount)) return false;
    }
    return true;
  }

  moveToNext() {
    if (!this.canMoveToNext()) return false;
    const next = this.nextVillage;
    const cost = next.moveCost || {};
    for (const [resource, amount] of Object.entries(cost)) {
      this.economy.spend(resource, amount);
    }
    this.completeVillage();
    this.initVillage(next.id);
    return true;
  }

  getPower() {
    return this.buildings.reduce((sum, b) => sum + b.powerContribution, 0);
  }

  getIncomeRate() {
    const totalIncome = {};
    for (const b of this.buildings) {
      if (b.state === "ready") {
        for (const [resource, amount] of Object.entries(b.productionRate)) {
          totalIncome[resource] = (totalIncome[resource] || 0) + amount;
        }
      }
    }
    return totalIncome;
  }

  upgradeBuilding(building) {
    return building.upgrade(this.economy);
  }

  setBuildingCallbacks(onBuilt, onUpgraded) {
    this._savedOnBuilt = onBuilt;
    this._savedOnUpgraded = onUpgraded;
    for (const b of this.buildings) {
      b._onBuilt = onBuilt;
      b._onUpgraded = onUpgraded;
    }
  }

  update(dt) {
    const produced = {};
    for (const b of this.buildings) {
      const result = b.update(dt);
      if (result) {
        for (const [resource, amount] of Object.entries(result)) {
          produced[resource] = (produced[resource] || 0) + amount;
        }
      }
    }
    for (const [resource, amount] of Object.entries(produced)) {
      this.economy.add(resource, amount);
    }
    return produced;
  }

  getMonsterDifficulty(power) {
    if (power < 100) return "ضعيف";
    if (power < 500) return "متوسط";
    if (power < 2000) return "قوي";
    if (power < 10000) return "خطير";
    return "مخيف";
  }

  getProgress() {
    const total = this.buildings.length;
    const built = this.buildings.filter(b => b.state === "ready").length;
    return { total, built, percentage: Math.floor((built / total) * 100) };
  }

  getVillageIndex() {
    return this.villages.findIndex(v => v.id === this.currentVillageId);
  }
}
