// =============================================================================
// شجرة الترقيات — مستوحاة من ألعاب الاستراتيجية
// =============================================================================
// يمكنك تغيير الأسماء والرموز والصور كما تريد
// =============================================================================
//
// 📌 كل مسار ترقية يحتوي على:
//   - id: معرف فريد (لاتغيره)
//   - name: اسم الترقية (غيّره كما تشاء)
//   - icon: رمز تعبيري (إيموجي)
//   - image: رابط صورة اختياري (null = يستخدم الرمز)
//   - levels: قائمة المستويات (cost, desc, effect)
//
// =============================================================================

// =============================================================================
// 🖼️ إعدادات الصور — غيّر الروابط هنا فقط
// =============================================================================
// المقاسات الموصى بها للصور:
//   - صورة المسار (كبيرة): 120×120 بكسل — PNG مع خلفية شفافة
//   - رمز المستوى (صغير): 48×48 بكسل — PNG مع خلفية شفافة
//
// مثال:
//   image: 'assets/images/upgrades/army-chief.png'
//   levelImage: 'assets/images/upgrades/army-level1.png'
//
// اترك null لاستخدام الرمز التعبيري (إيموجي) بدلاً من الصورة
// =============================================================================

const UPGRADE_PATHS = [
  {
    // ========== 1. الجيش (مربوط بـ GameArmy.unitLevel) ==========
    id: "army",
    name: "الجيش",
    icon: "⚔️",
    image: 'assets/images/upgrades/army.png',
    desc: "تطوير تكتيكات الجيش الصحراوي (يتطلب مستوى جنود)",
    levels: [
      { cost: 50, desc: "تكتيكات الجيش +10", effect: 10, icon: "⚔️", requireUnitLevel: 1 },
      { cost: 120, desc: "تكتيكات الجيش +25", effect: 25, icon: "🗡️", requireUnitLevel: 5 },
      { cost: 250, desc: "تكتيكات الجيش +50", effect: 50, icon: "🛡️", requireUnitLevel: 10 },
      { cost: 500, desc: "تكتيكات الجيش +100", effect: 100, icon: "🏹", requireUnitLevel: 20 },
      { cost: 1000, desc: "تكتيكات الجيش +200", effect: 200, icon: "⚒️", requireUnitLevel: 35 },
    ]
  },
  {
    // ========== 2. المعرفة (مربوط بـ القصة knowledgeLevel) ==========
    id: "knowledge",
    name: "المعرفة",
    icon: "📜",
    image: 'assets/images/upgrades/knowledge.png',
    desc: "تطوير المعرفة والعلوم الصحراوية (يتطلب التقدم في القصة)",
    levels: [
      { cost: 40, desc: "إنتاج الذهب +15%", effect: 15, icon: "📖", requireKnowledgeLevel: 1 },
      { cost: 100, desc: "إنتاج الذهب +30%", effect: 30, icon: "📚", requireKnowledgeLevel: 2 },
      { cost: 200, desc: "إنتاج الذهب +50%", effect: 50, icon: "🔮", requireKnowledgeLevel: 3 },
      { cost: 400, desc: "إنتاج الذهب +80%", effect: 80, icon: "💎", requireKnowledgeLevel: 4 },
      { cost: 800, desc: "إنتاج الذهب +120%", effect: 120, icon: "👑", requireKnowledgeLevel: 5 },
    ]
  },
  {
    // ========== 3. الدفاع ==========
    id: "defense",
    name: "الدفاع",
    icon: "🛡️",
    image: 'assets/images/upgrades/defense.png',
    desc: "تحصينات القلعة والدفاع",
    levels: [
      { cost: 35, desc: "دفاع +5", effect: 5, icon: "🪵" },
      { cost: 90, desc: "دفاع +12", effect: 12, icon: "🏗️" },
      { cost: 180, desc: "دفاع +25", effect: 25, icon: "🏰" },
      { cost: 350, desc: "دفاع +50", effect: 50, icon: "🧱" },
      { cost: 700, desc: "دفاع +100", effect: 100, icon: "🔱" },
    ]
  },
  {
    // ========== 4. التجارة ==========
    id: "trade",
    name: "التجارة",
    icon: "🐪",
    image: 'assets/images/upgrades/trade.png',
    desc: "قوافل التجارة الصحراوية",
    levels: [
      { cost: 45, desc: "دخل القوافل +20%", effect: 20, icon: "📦" },
      { cost: 110, desc: "دخل القوافل +40%", effect: 40, icon: "🐫" },
      { cost: 220, desc: "دخل القوافل +70%", effect: 70, icon: "🏪" },
      { cost: 450, desc: "دخل القوافل +110%", effect: 110, icon: "⚖️" },
      { cost: 900, desc: "دخل القوافل +160%", effect: 160, icon: "🏦" },
    ]
  },
];

export class UpgradeTree {
  constructor(economy) {
    this.economy = economy;
    this.levels = {};
    for (const p of UPGRADE_PATHS) {
      this.levels[p.id] = 0;
    }
    this._onChanged = null;
  }

  getMaxLevel(pathId) {
    const p = UPGRADE_PATHS.find(x => x.id === pathId);
    return p ? p.levels.length : 0;
  }

  getLevel(pathId) {
    return this.levels[pathId] || 0;
  }

  getCurrentCost(pathId) {
    const p = UPGRADE_PATHS.find(x => x.id === pathId);
    if (!p) return Infinity;
    const lvl = this.levels[pathId] || 0;
    if (lvl >= p.levels.length) return Infinity;
    return p.levels[lvl].cost;
  }

  getDesc(pathId) {
    const p = UPGRADE_PATHS.find(x => x.id === pathId);
    if (!p) return "";
    const lvl = this.levels[pathId] || 0;
    if (lvl >= p.levels.length) return "⭐⭐⭐ الأقصى";
    return p.levels[lvl].desc;
  }

  getLockReason(pathId) {
    const p = UPGRADE_PATHS.find(x => x.id === pathId);
    if (!p) return null;
    const lvl = this.levels[pathId] || 0;
    if (lvl >= p.levels.length) return null;
    const levelData = p.levels[lvl];
    if (levelData.requireKnowledgeLevel) {
      const eco = this.economy;
      const has = eco.knowledgeLevel || 1;
      if (has < levelData.requireKnowledgeLevel) {
        return { reason: 'knowledge', required: levelData.requireKnowledgeLevel, current: has };
      }
    }
    if (levelData.requireUnitLevel) {
      // نحتاج الوصول إلى army.unitLevel — نخزن مرجع من خارج
      const unitLevel = this._armyRef?.unitLevel || 1;
      if (unitLevel < levelData.requireUnitLevel) {
        return { reason: 'unit', required: levelData.requireUnitLevel, current: unitLevel };
      }
    }
    return null;
  }

  getEffect(pathId) {
    const p = UPGRADE_PATHS.find(x => x.id === pathId);
    if (!p) return 0;
    const lvl = this.levels[pathId] || 0;
    let total = 0;
    const max = Math.min(lvl, p.levels.length);
    for (let i = 0; i < max; i++) total += p.levels[i].effect;
    return total;
  }

  canUpgrade(pathId) {
    const p = UPGRADE_PATHS.find(x => x.id === pathId);
    if (!p) return false;
    const lvl = this.levels[pathId] || 0;
    if (lvl >= p.levels.length) return false;
    const levelData = p.levels[lvl];
    // تحقق من متطلبات المعرفة (القصة)
    if (levelData.requireKnowledgeLevel) {
      const eco = this.economy;
      const has = eco.knowledgeLevel || 1;
      if (has < levelData.requireKnowledgeLevel) return false;
    }
    // تحقق من متطلبات مستوى الجنود
    if (levelData.requireUnitLevel) {
      const unitLevel = this._armyRef?.unitLevel || 1;
      if (unitLevel < levelData.requireUnitLevel) return false;
    }
    return this.economy.canAfford("gold", levelData.cost);
  }

  upgrade(pathId) {
    const p = UPGRADE_PATHS.find(x => x.id === pathId);
    if (!p) return false;
    const lvl = this.levels[pathId] || 0;
    if (lvl >= p.levels.length) return false;
    const cost = p.levels[lvl].cost;
    if (!this.economy.spend("gold", cost)) return false;
    this.levels[pathId] = lvl + 1;
    if (this._onChanged) this._onChanged(pathId, this.levels[pathId]);
    return true;
  }

  getPaths() {
    return UPGRADE_PATHS.map(p => ({
      ...p,
      currentLevel: this.levels[p.id] || 0,
      maxLevel: p.levels.length,
      cost: this.getCurrentCost(p.id),
      canAfford: this.canUpgrade(p.id),
      lockReason: this.getLockReason(p.id),
      effect: this.getEffect(p.id),
      desc: this.getDesc(p.id),
    }));
  }

  // ربط مرجع الجيش للتحقق من متطلبات unitLevel
  setArmyRef(army) {
    this._armyRef = army;
  }

  loadState(saved) {
    if (!saved) return;
    for (const key of Object.keys(this.levels)) {
      if (saved[key] !== undefined) this.levels[key] = saved[key];
    }
  }
}
