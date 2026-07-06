export const WEAPON_DATA = [
  { id: "w1", name: "سيف بدوي", desc: "سيف قصير خفيف", basePower: 5, gemCost: 10, cashPrice: 100, requireLevel: 1 },
  { id: "w2", name: "قوس طويل", desc: "قوس للرماية من مسافة", basePower: 15, gemCost: 30, cashPrice: 400, requireLevel: 2 },
  { id: "w3", name: "رمح حديدي", desc: "رمح ثقيل للهجوم", basePower: 30, gemCost: 60, cashPrice: 1200, requireLevel: 3 },
  { id: "w4", name: "سيف دمشقي", desc: "سيف فولاذي صلب", basePower: 50, gemCost: 120, cashPrice: 4000, requireLevel: 4 },
  { id: "w5", name: "قوس ناري", desc: "قوس يطلق سهماً نارياً", basePower: 80, gemCost: 200, cashPrice: 12000, requireLevel: 5 },
  { id: "w6", name: "فأس معركة", desc: "فأس ضخمة ثنائية اليد", basePower: 120, gemCost: 350, cashPrice: 25000, requireLevel: 6 },
];

// تكاليف الترقية لكل مستوى نجمي (0→1, 1→2, 2→3, 3→4, 4→5)
const UPGRADE_COSTS = [
  { cash: 500,  gems: 10,  artifact: 0,  desertGem: 0, label: "1⭐" },
  { cash: 2000, gems: 30,  artifact: 1,  desertGem: 0, label: "2⭐" },
  { cash: 8000, gems: 80,  artifact: 2,  desertGem: 0, label: "3⭐" },
  { cash: 25000, gems: 200, artifact: 4, desertGem: 1, label: "4⭐" },
  { cash: 80000, gems: 500, artifact: 8, desertGem: 3, label: "5⭐" },
];

export class Weapon {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.desc = data.desc;
    this.basePower = data.basePower;
    this.gemCost = data.gemCost;
    this.cashPrice = data.cashPrice || 0;
    this.requireLevel = data.requireLevel;
    this.owned = false;
    this.level = 0;       // 0-5 عدد النجوم
    this.maxLevel = 5;
    this.upgradeLevel = 0; // عداد داخلي (محفوظ للتوافق)
    this.maxUpgradeLevel = 40;
  }

  buy(economy) {
    if (this.owned) return false;
    if (!economy.canAfford('cash', this.cashPrice)) return false;
    economy.spend('cash', this.cashPrice);
    this.owned = true;
    this.upgradeLevel = 1;
    return true;
  }

  get power() {
    return this.basePower * (1 + this.level * 0.5);
  }

  getUpgradeCosts() {
    // التكلفة للترقية من المستوى الحالي إلى التالي
    if (this.level >= this.maxLevel) return null;
    return UPGRADE_COSTS[this.level];
  }

  canUpgrade(economy, houseLevel) {
    if (this.level >= this.maxLevel) return false;
    if (!this.owned) return false;
    if (houseLevel < this.requireLevel) return false;
    const cost = this.getUpgradeCosts();
    if (!cost) return false;
    if (!economy.canAfford('cash', cost.cash)) return false;
    if (!economy.canAfford('gems', cost.gems)) return false;
    if (cost.artifact > 0 && !economy.canAfford('artifacts', cost.artifact)) return false;
    if (cost.desertGem > 0 && !economy.canAfford('desertGem', cost.desertGem)) return false;
    return true;
  }

  upgrade(economy, houseLevel) {
    if (!this.canUpgrade(economy, houseLevel)) return false;
    const cost = this.getUpgradeCosts();
    if (!cost) return false;
    economy.spend('cash', cost.cash);
    economy.spend('gems', cost.gems);
    if (cost.artifact > 0) economy.spend('artifacts', cost.artifact);
    if (cost.desertGem > 0) economy.spend('desertGem', cost.desertGem);
    this.level++;
    this.upgradeLevel = this.level * 8; // للتوافق مع الحفظ القديم
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
