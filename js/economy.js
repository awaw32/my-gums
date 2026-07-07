export const RESOURCE_TYPES = {
  cash: { name: 'المال', icon: '💵', color: '#2ecc71', format: 'big' },
  gold: { name: 'الذهب', icon: '🪙', color: '#FFD700', format: 'big' },
  gems: { name: 'الجواهر', icon: '💎', color: '#9b59b6', format: 'fixed' },
  hammers: { name: 'المطارق', icon: '🔨', color: '#e74c3c', format: 'big' },
  scrolls: { name: 'المخطوطات', icon: '📜', color: '#f39c12', format: 'big' },
  food: { name: 'الطعام', icon: '🌾', color: '#f1c40f', format: 'big' },
  artifacts: { name: 'قطع أثرية', icon: '🏺', color: '#8e44ad', format: 'fixed' },
  desertGem: { name: 'جوهرة الصحراء', icon: '💠', color: '#00ffff', format: 'fixed' },
  // ==================== 🏜️ موارد الصحراء الجديدة ====================
  water: { name: 'ماء', icon: '💧', color: '#3498db', format: 'big' },
  salt: { name: 'ملح', icon: '🧂', color: '#ecf0f1', format: 'big' },
  leather: { name: 'جلود', icon: '🟫', color: '#8B4513', format: 'big' },
  copper: { name: 'نحاس', icon: '🪙', color: '#b87333', format: 'big' },
  herbs: { name: 'أعشاب', icon: '🌿', color: '#27ae60', format: 'fixed' },
};

export function formatNumber(n) {
  if (n >= 1e15) return (n / 1e15).toFixed(2) + 'Q';
  if (n >= 1e12) return (n / 1e12).toFixed(2) + 'T';
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(2) + 'K';
  return Math.floor(n).toLocaleString();
}// ==================== 🧠 بونص المعرفة (مدمج من knowledge-system.js) ====================

export const KNOWLEDGE_BUFFS = {
  resourceSpeed: [1.0, 1.08, 1.16, 1.25, 1.35, 1.50],
  moveSpeedPercent: [0, 3, 5, 8, 10, 12],
  defensePercent: [0, 4, 7, 10, 14, 18],
};

export function computeKnowledgeBonuses(data) {
  const knowledgeLevel = data.knowledgeLevel || 1;
  const knowledgeType = data.knowledgeType || "economic";
  const idx = Math.min(knowledgeLevel, KNOWLEDGE_BUFFS.resourceSpeed.length - 1);
  if (knowledgeType === "economic") {
    return {
      resourceSpeed: KNOWLEDGE_BUFFS.resourceSpeed[idx],
      moveSpeedPercent: 0,
      defensePercent: 0,
    };
  }
  return {
    resourceSpeed: 1,
    moveSpeedPercent: KNOWLEDGE_BUFFS.moveSpeedPercent[idx],
    defensePercent: KNOWLEDGE_BUFFS.defensePercent[idx],
  };
}

export function getXpForLevel(level) {
  if (level <= 0) return 100;
  return Math.floor(100 * Math.pow(1.15, level - 1));
}

export class GameEconomy {
  constructor() {
    this.resources = {
      cash: 0,
      gold: 150,
      gems: 10,
      hammers: 0,
      scrolls: 0,
      food: 50,
      artifacts: 0,
      desertGem: 0,
      water: 100,
      salt: 20,
      leather: 10,
      copper: 5,
      herbs: 3,
    };
    this.multiplier = 1;
    this.level = 1;
    this.maxLevel = 110;
    this.xp = 0;
    this.xpToNext = getXpForLevel(1);
    this.incomeRate = 0;
    this.lastTick = Date.now();
    this.powerSources = [];
    this.kills = 0;
    this.totalEarned = 0;
    this.b3GoldBonus = 1;
    this._onLevelUp = null;
    this._onGoldEarned = null;
    this._onCashEarned = null;
    this.knowledgeLevel = 1;
    this.knowledgeType = 'economic';
    this._prestige = null; // مرجع لـ PrestigeManager للبونصات
    this._events = null; // مرجع لـ EventManager للمضاعفات
  }

  get power() {
    let p = 0;
    for (const fn of this.powerSources) p += fn();
    let total = Math.floor(p * this.multiplier);
    if (this._events) {
      const mult = this._events.getMult("mult_power");
      if (mult > 1) total = Math.floor(total * mult);
    }
    return total;
  }

  get powerFormatted() {
    return formatNumber(this.power);
  }

  get cash() { return this.resources.cash; }
  set cash(v) { this.resources.cash = Math.max(0, v); }
  get gold() { return this.resources.gold; }
  set gold(v) { this.resources.gold = Math.max(0, v); }
  get gems() { return this.resources.gems; }
  set gems(v) { this.resources.gems = Math.max(0, v); }
  get hammers() { return this.resources.hammers; }
  set hammers(v) { this.resources.hammers = Math.max(0, v); }
  get scrolls() { return this.resources.scrolls; }
  set scrolls(v) { this.resources.scrolls = Math.max(0, v); }
  get artifacts() { return this.resources.artifacts || 0; }
  get artifact() { return this.resources.artifacts || 0; } // alias للمطابقة مع UPGRADE_COSTS
  get desertGem() { return this.resources.desertGem || 0; }
  get water() { return this.resources.water || 0; }
  set water(v) { this.resources.water = Math.max(0, v); }
  get salt() { return this.resources.salt || 0; }
  set salt(v) { this.resources.salt = Math.max(0, v); }
  get leather() { return this.resources.leather || 0; }
  set leather(v) { this.resources.leather = Math.max(0, v); }
  get copper() { return this.resources.copper || 0; }
  set copper(v) { this.resources.copper = Math.max(0, v); }
  get herbs() { return this.resources.herbs || 0; }
  set herbs(v) { this.resources.herbs = Math.max(0, v); }

  get food() { return this.resources.food; }
  set food(v) { this.resources.food = Math.max(0, v); }
  get cashFormatted() { return formatNumber(this.cash); }
  get goldFormatted() { return formatNumber(this.gold); }
  get foodFormatted() { return formatNumber(this.food); }

  canAfford(type, cost) { return (this.resources[type] || 0) >= cost; }

  spend(type, amt) {
    if ((this.resources[type] || 0) >= amt) {
      this.resources[type] -= amt;
      return true;
    }
    return false;
  }

  add(type, amt) {
    if (this.resources[type] !== undefined) {
      this.resources[type] += amt * this.multiplier;
      if (type === "cash" && amt > 0 && this._onCashEarned) {
        this._onCashEarned(amt);
      }
    }
  }

  addRaw(type, amt) {
    if (this.resources[type] !== undefined) {
      let finalAmt = amt;
      // بونص مستودع البضائع على الذهب
      if (type === "gold" && amt > 0 && this.b3GoldBonus > 1) {
        finalAmt = Math.floor(amt * this.b3GoldBonus);
      }
      // بونص البحوث على الذهب
      if (type === "gold" && amt > 0 && this.researchGoldBonus > 1) {
        finalAmt = Math.floor(finalAmt * this.researchGoldBonus);
      }
      // بونص شجرة الترقيات (المعرفة) على الذهب
      if (type === "gold" && amt > 0 && this.knowledgeGoldBonus > 1) {
        finalAmt = Math.floor(finalAmt * this.knowledgeGoldBonus);
      }
      // بونص شجرة الترقيات (التجارة) على المال
      if (type === "cash" && amt > 0 && this.tradeIncomeBonus > 1) {
        finalAmt = Math.floor(amt * this.tradeIncomeBonus);
      }
      // مضاعفات الأحداث للذهب
      if (type === "gold" && amt > 0 && this._events) {
        const mult = this._events.getMult("mult_gold");
        if (mult > 1) finalAmt = Math.floor(finalAmt * mult);
      }
      this.resources[type] += finalAmt;
      if (type === "gold" && amt > 0 && this._onGoldEarned) {
        this._onGoldEarned(amt); // نبعت المبلغ الأصلي للإنجاز (بدون مضاعف)
      }
    }
  }

  addXp(amount) {
    if (this._prestige && this._prestige.xpMult > 1) {
      amount = Math.floor(amount * this._prestige.xpMult);
    }
    if (this._events) {
      const mult = this._events.getMult("mult_xp");
      if (mult > 1) amount = Math.floor(amount * mult);
    }
    this.xp += amount;
    let leveled = false;
    while (this.xp >= this.xpToNext && this.level < this.maxLevel) {
      this.xp -= this.xpToNext;
      this.level++;
      this.xpToNext = getXpForLevel(this.level);
      leveled = true;
    }
    if (leveled && this._onLevelUp) {
      this._onLevelUp(this.level);
    }
  }

  getVillageIncome(village) {
    if (!village) return 0;
    return village.getIncomeRate();
  }

  refreshIncome(village) {
    this.incomeRate = this.getVillageIncome(village);
  }

  tick() {
    this.lastTick = Date.now();
  }
}
