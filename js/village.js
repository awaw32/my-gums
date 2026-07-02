export const VILLAGE_DATA = [
  {
    id: 1, name: "القرية الأولى",
    buildings: [
      { id: "v1b1", name: "خيمة المؤن", desc: "تنتج الطعام والمال", monsterPower: 10, baseProduction: 1, buildTime: 5, monsterName: "ذئب صحراوي" },
      { id: "v1b2", name: "مستودع السلاح", desc: "مستودع الأسلحة الخفيفة", monsterPower: 25, baseProduction: 2, buildTime: 10, monsterName: "ثعبان رملي" },
      { id: "v1b3", name: "ساحة التدريب", desc: "تدريب الجنود", monsterPower: 50, baseProduction: 4, buildTime: 20, monsterName: "عقرب عملاق" },
      { id: "v1b4", name: "برج المراقبة", desc: "حراسة القرية", monsterPower: 80, baseProduction: 7, buildTime: 30, monsterName: "محارب متوحش" },
    ],
  },
  {
    id: 2, name: "القرية الثانية",
    buildings: [
      { id: "v2b1", name: "سوق التجارة", desc: "تجارة البضائع النادرة", monsterPower: 150, baseProduction: 10, buildTime: 45, monsterName: "فارس ظل" },
      { id: "v2b2", name: "مسبك الحديد", desc: "تصنيع الأسلحة الثقيلة", monsterPower: 250, baseProduction: 15, buildTime: 60, monsterName: "غول صحراوي" },
      { id: "v2b3", name: "قاعة الأبطال", desc: "تجنيد الأبطال", monsterPower: 400, baseProduction: 22, buildTime: 90, monsterName: "ساحر الرمال" },
      { id: "v2b4", name: "حصون الدفاع", desc: "تحصينات متقدمة", monsterPower: 600, baseProduction: 30, buildTime: 120, monsterName: "تنين صغير" },
    ],
  },
];

class VillageBuilding {
  constructor(template) {
    this.id = template.id;
    this.name = template.name;
    this.desc = template.desc;
    this.monsterPower = template.monsterPower;
    this.baseProduction = template.baseProduction;
    this.buildTime = template.buildTime;
    this.monsterName = template.monsterName;
    this.level = 0;
    this.maxLevel = 100;
    this.state = "locked";
    this.constructTimer = 0;
    this.constructDuration = template.buildTime;
    this.fightAnimTimer = 0;
    this.fightResult = null;
    this.productionAccum = 0;
    this.productionInterval = 5;
    this._onBuilt = null;
    this._onUpgraded = null;
  }

  get productionRate() {
    return this.baseProduction * (1 + this.level * 0.1);
  }

  get currentMonsterPower() {
    return this.monsterPower * (1 + this.level * 0.15);
  }

  get upgradeCost() {
    return Math.floor(20 + this.level * 5 * (1 + this.level * 0.05));
  }

  get powerContribution() {
    if (this.state !== "ready") return 0;
    return this.baseProduction * 2 * (1 + this.level * 0.1);
  }

  fight(playerPower) {
    if (this.state !== "locked") return false;
    this.fightAnimTimer = 0.8;
    if (playerPower >= this.currentMonsterPower) {
      this.fightResult = "win";
      this.state = "building";
      this.constructTimer = this.constructDuration;
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
      const interval = this.productionInterval;
      if (this.productionAccum >= interval) {
        this.productionAccum -= interval;
        return this.productionRate;
      }
    }
    return 0;
  }

  upgrade(economy) {
    if (this.state !== "ready" || this.level >= this.maxLevel) return false;
    const cost = this.upgradeCost;
    if (!economy.spend('cash', cost)) return false;
    this.level++;
    if (this._onUpgraded) this._onUpgraded(this);
    return true;
  }
}

export class GameVillage {
  constructor(economy) {
    this.economy = economy;
    this.currentVillageId = 1;
    this.villageData = VILLAGE_DATA;
    this.buildings = [];
    this._savedOnBuilt = null;
    this._savedOnUpgraded = null;
    this.initVillage(1);
  }

  initVillage(villageId) {
    this.buildings = [];
    this.currentVillageId = villageId;
    const data = this.villageData.find(v => v.id === villageId);
    if (!data) return;
    for (const b of data.buildings) {
      this.buildings.push(new VillageBuilding(b));
    }
    // إعادة ربط callbacks بعد init (مهم لـ Prestige)
    if (this._savedOnBuilt || this._savedOnUpgraded) {
      this.setBuildingCallbacks(this._savedOnBuilt, this._savedOnUpgraded);
    }
  }

  get currentVillage() {
    return this.villageData.find(v => v.id === this.currentVillageId);
  }

  getPower() {
    return this.buildings.reduce((sum, b) => sum + b.powerContribution, 0);
  }

  getIncomeRate() {
    return this.buildings.reduce((sum, b) => {
      if (b.state === "ready") return sum + b.productionRate;
      return sum;
    }, 0);
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
    let produced = 0;
    for (const b of this.buildings) {
      produced += b.update(dt);
    }
    if (produced > 0) {
      this.economy.add('cash', produced);
    }
  }

  getMonsterDifficulty(power) {
    if (power < 30) return "ضعيف";
    if (power < 80) return "متوسط";
    if (power < 200) return "قوي";
    if (power < 500) return "خطير";
    return "مخيف";
  }
}
