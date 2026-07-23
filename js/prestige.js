// 🏜️ البرستيج — 5 ألقاب صحراوية، كل واحد بقدرة فريدة بدل مضاعف قوة مسطّح
const PRESTIGE_BONUSES = [
  { level: 1, title: "قاطع طريق", icon: "🏴", dmgMult: 1.5, xpMult: 1.5, goldMult: 1.2,
    startCash: 500, startGold: 200, startGems: 25, unlockWeapon: 0,
    caravanGoldBonus: 0.25,
    desc: "قاطع طريق! قوافل الذهب تمنحك +25% ذهب إضافي عند نهبها" },
  { level: 2, title: "تاجر", icon: "💰", dmgMult: 2.0, xpMult: 2.0, goldMult: 1.5,
    startCash: 1500, startGold: 600, startGems: 60, unlockWeapon: 2,
    marketDiscount: 0.15,
    desc: "تاجر ماهر! أسعار السوق أرخص لك بنسبة 15%" },
  { level: 3, title: "شيخ حكيم", icon: "🧙", dmgMult: 2.8, xpMult: 2.5, goldMult: 2.0,
    startCash: 4000, startGold: 1500, startGems: 120, unlockWeapon: 3,
    unlockSecretResearch: true,
    desc: "شيخ حكيم! فُتحت لك 3 بحوث سرية في شجرة المعرفة" },
  { level: 4, title: "ملك الظل", icon: "🌑", dmgMult: 3.5, xpMult: 3.0, goldMult: 2.5,
    startCash: 10000, startGold: 4000, startGems: 250, unlockWeapon: 4,
    goldenTitle: true,
    desc: "ملك الظل! لقب ذهبي يظهر بجانب اسمك أينما ذهبت" },
  { level: 5, title: "ملك الصحراء", icon: "👑", dmgMult: 5.0, xpMult: 4.0, goldMult: 3.0,
    startCash: 25000, startGold: 10000, startGems: 500, unlockWeapon: 5,
    goldenTitle: true, crownVisible: true,
    desc: "ملك الصحراء! تاج ولقب يراه كل اللاعبين بجانب اسمك" },
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

  /** نسبة خصم السوق (برستيج "تاجر" فأعلى) — 1 = بلا خصم */
  get marketPriceModifier() {
    let discount = 0;
    for (let i = 0; i < this.level; i++) discount = Math.max(discount, PRESTIGE_BONUSES[i].marketDiscount || 0);
    return 1 - discount;
  }

  /** مضاعف ذهب القوافل (برستيج "قاطع طريق" فأعلى) — 1 = بلا بونص */
  get caravanGoldMultiplier() {
    let bonus = 0;
    for (let i = 0; i < this.level; i++) bonus = Math.max(bonus, PRESTIGE_BONUSES[i].caravanGoldBonus || 0);
    return 1 + bonus;
  }

  get hasGoldenTitle() {
    return this.level > 0 && !!PRESTIGE_BONUSES[this.level - 1].goldenTitle;
  }

  get hasCrown() {
    return this.level > 0 && !!PRESTIGE_BONUSES[this.level - 1].crownVisible;
  }

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
      hasGoldenTitle: this.hasGoldenTitle,
      hasCrown: this.hasCrown,
    };
  }

  loadState(level) {
    if (typeof level === "number" && level >= 0 && level <= this.maxLevel) {
      this.level = level;
    }
  }

  getSaveData() { return this.level; }
}
