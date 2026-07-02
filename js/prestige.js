const PRESTIGE_BONUSES = [
  { level: 1, title: "المولود الجديد", dmgMult: 1.5, icon: "🌱" },
  { level: 2, title: "المحارب", dmgMult: 2.0, icon: "⚔️" },
  { level: 3, title: "البطل", dmgMult: 2.5, icon: "🛡️" },
  { level: 4, title: "الأسطورة", dmgMult: 3.0, icon: "🔥" },
  { level: 5, title: "الإله", dmgMult: 4.0, icon: "👑" },
];

export class PrestigeManager {
  constructor(economy, village, army) {
    this.economy = economy;
    this.village = village;
    this.army = army;
    this.level = 0;
    this._onPrestige = null;
  }

  get maxLevel() { return PRESTIGE_BONUSES.length; }

  get currentBonus() {
    if (this.level === 0) return { dmgMult: 1, title: "—", icon: "—" };
    return PRESTIGE_BONUSES[this.level - 1];
  }

  get dmgMult() { return this.currentBonus.dmgMult; }
  get xpMult() { return 1 + this.level * 0.5; } // كل مستوى Prestige يعطي +50% XP

  get canPrestige() {
    return this.economy.level >= this.economy.maxLevel && this.level < this.maxLevel;
  }

  prestige() {
    if (!this.canPrestige) return false;
    this.level++;
    // إعادة تعيين كل شيء
    this.economy.level = 1;
    this.economy.xp = 0;
    this.economy.xpToNext = 100;
    this.economy.resources.cash = 0;
    this.economy.resources.gold = 100;
    this.economy.resources.gems = Math.max(50, this.economy.gems);
    this.army.unitLevel = 1;
    this.army.weapons.forEach(w => { w.level = 0; w.upgradeLevel = 0; });
    this.village.initVillage(1);
    if (this._onPrestige) this._onPrestige(this.level);
    return true;
  }

  getState() {
    return {
      level: this.level,
      maxLevel: this.maxLevel,
      canPrestige: this.canPrestige,
      dmgMult: this.dmgMult,
      title: this.currentBonus.title,
      icon: this.currentBonus.icon,
    };
  }

  loadState(level) {
    if (typeof level === "number" && level >= 0 && level <= this.maxLevel) {
      this.level = level;
    }
  }

  getSaveData() { return this.level; }
}
