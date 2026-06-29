export const WEAPON_DATA = [
  { id: "w1", name: "سيف بدوي", desc: "سيف قصير خفيف", basePower: 5, shardCost: 10 },
  { id: "w2", name: "قوس طويل", desc: "قوس للرماية", basePower: 12, shardCost: 30 },
  { id: "w3", name: "رمح حديدي", desc: "رمح ثقيل", basePower: 22, shardCost: 60 },
  { id: "w4", name: "سيف دمشقي", desc: "سيف فولاذي صلب", basePower: 35, shardCost: 120 },
  { id: "w5", name: "قوس ناري", desc: "قوس يطلق سهماً نارياً", basePower: 55, shardCost: 200 },
  { id: "w6", name: "فأس معركة", desc: "فأس ضخمة ثنائية", basePower: 80, shardCost: 350 },
  { id: "w7", name: "سيف الأساطير", desc: "سيف أسطوري", basePower: 120, shardCost: 600 },
];

export class Weapon {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.desc = data.desc;
    this.basePower = data.basePower;
    this.shardCost = data.shardCost;
    this.level = 0;
    this.maxLevel = 50;
  }

  get power() {
    return this.basePower * (1 + this.level * 0.2);
  }

  get upgradeCost() {
    return Math.floor(this.shardCost * (1 + this.level * 0.15));
  }

  upgrade(economy) {
    if (this.level >= this.maxLevel) return false;
    const cost = this.upgradeCost;
    if (!economy.spend('gems', cost)) return false;
    this.level++;
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
  }

  get unitPower() {
    return this.unitPowerBase * this.unitLevel * (1 + this.unitsCount * 0.1);
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
}
