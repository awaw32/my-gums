const ALLIANCE_TIERS = [
  { level: 1, name: "قبيلة", cost: 100, damageBonus: 2, defenseBonus: 1, incomeMult: 1.1 },
  { level: 2, name: "عشيرة", cost: 200, damageBonus: 5, defenseBonus: 2, incomeMult: 1.2 },
  { level: 3, name: "قبيلة عظمى", cost: 400, damageBonus: 10, defenseBonus: 4, incomeMult: 1.3 },
  { level: 4, name: "إمبراطورية", cost: 800, damageBonus: 20, defenseBonus: 8, incomeMult: 1.5 },
];

export class AllianceManager {
  constructor(economy) {
    this.economy = economy;
    this.level = 0;
    this._onChanged = null;
  }

  get currentTier() {
    return ALLIANCE_TIERS[this.level] || null;
  }

  get maxLevel() {
    return ALLIANCE_TIERS.length;
  }

  get nextTier() {
    return ALLIANCE_TIERS[this.level] || null;
  }

  get upgradeCost() {
    const t = ALLIANCE_TIERS[this.level];
    return t ? t.cost : 0;
  }

  get damageBonus() {
    let total = 0;
    for (let i = 0; i < this.level; i++) total += ALLIANCE_TIERS[i].damageBonus;
    return total;
  }

  get defenseBonus() {
    let total = 0;
    for (let i = 0; i < this.level; i++) total += ALLIANCE_TIERS[i].defenseBonus;
    return total;
  }

  get incomeMult() {
    if (this.level === 0) return 1;
    return ALLIANCE_TIERS[this.level - 1].incomeMult;
  }

  get tierName() {
    if (this.level === 0) return "—";
    return ALLIANCE_TIERS[this.level - 1].name;
  }

  canUpgrade() {
    if (this.level >= this.maxLevel) return false;
    const cost = this.upgradeCost;
    return this.economy.canAfford("gold", cost);
  }

  upgrade() {
    if (this.level >= this.maxLevel) return false;
    const cost = this.upgradeCost;
    if (!this.economy.spend("gold", cost)) return false;
    this.level++;
    if (this._onChanged) this._onChanged(this.level);
    return true;
  }

  getState() {
    return {
      level: this.level,
      tierName: this.tierName,
      damageBonus: this.damageBonus,
      defenseBonus: this.defenseBonus,
      incomeMult: this.incomeMult,
      upgradeCost: this.upgradeCost,
      maxLevel: this.maxLevel,
      canUpgrade: this.canUpgrade(),
    };
  }

  loadState(level) {
    if (typeof level === "number" && level >= 0 && level <= this.maxLevel) {
      this.level = level;
    }
  }
}
