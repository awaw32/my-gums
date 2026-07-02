export const RESOURCE_TYPES = {
  cash: { name: 'المال', icon: '💵', color: '#2ecc71', format: 'big' },
  gold: { name: 'العملة الذهبية', icon: '🪙', color: '#FFD700', format: 'big' },
  gems: { name: 'الجواهر', icon: '💎', color: '#9b59b6', format: 'fixed' },
  kingCoins: { name: 'KING Coins', icon: '👑', color: '#e67e22', format: 'fixed' },
  hammers: { name: 'المطارق', icon: '🔨', color: '#e74c3c', format: 'big' },
  scrolls: { name: 'المخطوطات', icon: '📜', color: '#f39c12', format: 'big' },
  horns: { name: 'الأبواق', icon: '📯', color: '#1abc9c', format: 'big' },
  food: { name: 'الطعام', icon: '🌾', color: '#f1c40f', format: 'big' },
};

export function formatNumber(n) {
  if (n >= 1e15) return (n / 1e15).toFixed(2) + 'Q';
  if (n >= 1e12) return (n / 1e12).toFixed(2) + 'T';
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(2) + 'K';
  return Math.floor(n).toLocaleString();
}

export function   getXpForLevel(level) {
  if (level <= 0) return 100;
  return Math.floor(100 * Math.pow(1.15, level - 1));
}

export class GameEconomy {
  constructor() {
    this.resources = {
      cash: 0,
      gold: 150,
      gems: 10,
      kingCoins: 0,
      hammers: 0,
      scrolls: 0,
      horns: 0,
      food: 50,
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
    this._onLevelUp = null;
    this._onGoldEarned = null;
  }

  get power() {
    let p = 0;
    for (const fn of this.powerSources) p += fn();
    return Math.floor(p * this.multiplier);
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
  get kingCoins() { return this.resources.kingCoins; }
  set kingCoins(v) { this.resources.kingCoins = Math.max(0, v); }
  get hammers() { return this.resources.hammers; }
  set hammers(v) { this.resources.hammers = Math.max(0, v); }
  get scrolls() { return this.resources.scrolls; }
  set scrolls(v) { this.resources.scrolls = Math.max(0, v); }
  get horns() { return this.resources.horns; }
  set horns(v) { this.resources.horns = Math.max(0, v); }

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
    }
  }

  addRaw(type, amt) {
    if (this.resources[type] !== undefined) {
      this.resources[type] += amt;
      if (type === "gold" && amt > 0 && this._onGoldEarned) {
        this._onGoldEarned(amt);
      }
    }
  }

  addXp(amount) {
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
