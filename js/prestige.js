const PRESTIGE_BONUSES = [
  { level: 1, title: "المولود الجديد", dmgMult: 1.5, xpMult: 1.5, goldMult: 1.2, startCash: 500, startGold: 200, startGems: 25, unlockWeapon: 0, icon: "🌱",
    desc: "قوة +50% | خبرة +50% | ذهب +20% | يبدأ بـ 500 💵 + 200 🪙 + 25 💎" },
  { level: 2, title: "المحارب", dmgMult: 2.0, xpMult: 2.0, goldMult: 1.5, startCash: 1500, startGold: 600, startGems: 60, unlockWeapon: 2, icon: "⚔️",
    desc: "قوة ×2 | خبرة ×2 | ذهب +50% | يبدأ بـ 1500 💵 + unlocks قوس طويل" },
  { level: 3, title: "البطل", dmgMult: 2.8, xpMult: 2.5, goldMult: 2.0, startCash: 4000, startGold: 1500, startGems: 120, unlockWeapon: 3, icon: "🛡️",
    desc: "قوة ×2.8 | خبرة ×2.5 | ذهب ×2 | يبدأ بـ 4000 💵 + unlocks رمح حديدي" },
  { level: 4, title: "الأسطورة", dmgMult: 3.5, xpMult: 3.0, goldMult: 2.5, startCash: 10000, startGold: 4000, startGems: 250, unlockWeapon: 4, icon: "🔥",
    desc: "قوة ×3.5 | خبرة ×3 | ذهب +150% | يبدأ بـ 10000 💵 + unlocks سيف دمشقي" },
  { level: 5, title: "الإله", dmgMult: 5.0, xpMult: 4.0, goldMult: 3.0, startCash: 25000, startGold: 10000, startGems: 500, unlockWeapon: 5, icon: "👑",
    desc: "قوة ×5 | خبرة ×4 | ذهب ×3 | يبدأ بـ 25000 💵 + unlocks قوس ناري" },
];

export class PrestigeManager {
  constructor(economy, village, army, storyManager) {
    this.economy = economy;
    this.village = village;
    this.army = army;
    this.storyManager = storyManager;
    this.level = 0;
    this._onPrestige = null;
  }

  get maxLevel() { return PRESTIGE_BONUSES.length; }

  get currentBonus() {
    if (this.level === 0) return { dmgMult: 1, xpMult: 1, goldMult: 1, startCash: 0, startGold: 0, startGems: 0, unlockWeapon: 0, title: "—", icon: "—" };
    return PRESTIGE_BONUSES[this.level - 1];
  }

  getBonusForLevel(level) {
    if (level < 1 || level > this.maxLevel) return { dmgMult: 1, xpMult: 1, goldMult: 1, title: "—", icon: "—" };
    return PRESTIGE_BONUSES[level - 1];
  }

  get dmgMult() { return this.currentBonus.dmgMult; }
  get xpMult() { return this.currentBonus.xpMult; }
  get goldMult() { return this.currentBonus.goldMult; }
  get startCash() { return this.currentBonus.startCash; }
  get startGold() { return this.currentBonus.startGold; }
  get startGems() { return this.currentBonus.startGems; }
  get unlockWeaponLevel() { return this.currentBonus.unlockWeapon; }

  get canPrestige() {
    return this.economy.level >= this.economy.maxLevel && this.level < this.maxLevel;
  }

  prestige() {
    if (!this.canPrestige) return false;
    this.level++;
    const bonus = this.currentBonus;

    // إعادة تعيين مع الحفاظ على المكافآت الدائمة
    this.economy.level = 1;
    this.economy.xp = 0;
    this.economy.xpToNext = 100;

    // الموارد الابتدائية تعتمد على مستوى Prestige
    this.economy.resources.cash = bonus.startCash;
    this.economy.resources.gold = bonus.startGold;
    this.economy.resources.gems = Math.max(bonus.startGems, this.economy.gems);
    this.economy.resources.food = 100;
    this.economy.resources.hammers = 0;
    this.economy.resources.scrolls = 0;

    // إعادة تعيين الجيش مع فتح أسلحة حسب المستوى
    this.army.unitLevel = 1;
    this.army.weapons.forEach((w, idx) => {
      w.level = 0;
      w.upgradeLevel = 0;
      // فتح الأسلحة حتى مستوى unlockWeaponLevel
      w.owned = idx <= bonus.unlockWeapon;
      if (w.owned) w.level = 1;
    });

    // إعادة تعيين القرية
    this.village.initVillage("wadi");
    this.village.completedVillages = [];
    this.village.currentChapter = 1;

    // إعادة تعيين القصة
    if (this.storyManager) this.storyManager.reset();

    if (this._onPrestige) this._onPrestige(this.level);
    return true;
  }

  getState() {
    return {
      level: this.level,
      maxLevel: this.maxLevel,
      canPrestige: this.canPrestige,
      dmgMult: this.dmgMult,
      xpMult: this.xpMult,
      goldMult: this.goldMult,
      startCash: this.startCash,
      startGold: this.startGold,
      startGems: this.startGems,
      unlockWeaponLevel: this.unlockWeaponLevel,
      title: this.currentBonus.title,
      icon: this.currentBonus.icon,
      desc: this.currentBonus.desc,
    };
  }

  loadState(level) {
    if (typeof level === "number" && level >= 0 && level <= this.maxLevel) {
      this.level = level;
    }
  }

  getSaveData() { return this.level; }
}
