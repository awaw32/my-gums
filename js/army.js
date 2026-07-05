export const WEAPON_DATA = [
  { id: "w1", name: "سيف بدوي", desc: "سيف قصير خفيف", basePower: 5, gemCost: 10, requireLevel: 1 },
  { id: "w2", name: "قوس طويل", desc: "قوس للرماية من مسافة", basePower: 15, gemCost: 30, requireLevel: 2 },
  { id: "w3", name: "رمح حديدي", desc: "رمح ثقيل للهجوم", basePower: 30, gemCost: 60, requireLevel: 3 },
  { id: "w4", name: "سيف دمشقي", desc: "سيف فولاذي صلب", basePower: 50, gemCost: 120, requireLevel: 4 },
  { id: "w5", name: "قوس ناري", desc: "قوس يطلق سهماً نارياً", basePower: 80, gemCost: 200, requireLevel: 5 },
  { id: "w6", name: "فأس معركة", desc: "فأس ضخمة ثنائية اليد", basePower: 120, gemCost: 350, requireLevel: 6 },
];

export class Weapon {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.desc = data.desc;
    this.basePower = data.basePower;
    this.gemCost = data.gemCost;
    this.requireLevel = data.requireLevel;
    this.level = 0;
    this.maxLevel = 5;
    this.upgradeLevel = 0;
    this.maxUpgradeLevel = 40;
  }

  get power() {
    return this.basePower * (1 + this.level * 0.5);
  }

  get upgradeCost() {
    return Math.floor(this.gemCost * (1 + Math.floor(this.upgradeLevel / 3) * 0.5));
  }

  canUpgrade(economy, houseLevel) {
    if (this.upgradeLevel >= this.maxUpgradeLevel) return false;
    if (houseLevel < this.requireLevel) return false;
    return economy.canAfford('gems', this.upgradeCost);
  }

  upgrade(economy, houseLevel) {
    if (!this.canUpgrade(economy, houseLevel)) return false;
    const cost = this.upgradeCost;
    if (!economy.spend('gems', cost)) return false;
    this.upgradeLevel++;
    const newLevel = Math.min(5, Math.floor(this.upgradeLevel / 8));
    if (newLevel > this.level) {
      this.level = newLevel;
    }
    return true;
  }
}

export class GameArmy {
  constructor(economy) {
    this.economy = economy;
    this.unitLevel = 1;
    this.maxUnitLevel = 100;
    this.unitPowerBase = 5;
    this.unitsCount = 10;
    this.weapons = WEAPON_DATA.map(w => new Weapon(w));
    this.trainingLevel = 1;
    this.maxTrainingLevel = 20;
    this.barracksLevel = 1;
    this.b4TrainingBonus = 1;
  }

  getMaxUnits(barracksLevel) {
    return 5 + (barracksLevel || this.barracksLevel) * 3;
  }

  get unitPower() {
    let base = this.unitPowerBase * this.unitLevel * (1 + this.getMaxUnits(this.barracksLevel) * 0.1) * (1 + this.trainingLevel * 0.05);
    if (this.b4TrainingBonus > 1) base = Math.floor(base * this.b4TrainingBonus);
    return base;
  }

  get weaponPower() {
    return this.weapons.reduce((sum, w) => sum + w.power, 0);
  }

  get totalArmyPower() {
    return this.unitPower + this.weaponPower;
  }

  upgradeUnits() {
    if (this.unitLevel >= this.maxUnitLevel) return false;
    const cost = Math.floor(15 * this.unitLevel * (1 + this.unitLevel * 0.05));
    if (!this.economy.spend('cash', cost)) return false;
    this.unitLevel++;
    return true;
  }

  get unitUpgradeCost() {
    return Math.floor(15 * this.unitLevel * (1 + this.unitLevel * 0.05));
  }

  upgradeTraining() {
    if (this.trainingLevel >= this.maxTrainingLevel) return false;
    const cost = Math.floor(50 * this.trainingLevel * (1 + this.trainingLevel * 0.1));
    if (!this.economy.spend('gold', cost)) return false;
    this.trainingLevel++;
    return true;
  }

  get trainingUpgradeCost() {
    return Math.floor(50 * this.trainingLevel * (1 + this.trainingLevel * 0.1));
  }
}
