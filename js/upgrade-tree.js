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
    // ========== 1. الجيش (بدلاً من السفن) ==========
    id: "army",
    name: "الجيش",
    icon: "⚔️",
    // 🖼️ image: 'assets/images/upgrades/army.png', // 120×120 — ارفع صورتك هنا
    desc: "تطوير قوة الجيش الصحراوي",
    levels: [
      { cost: 50, desc: "قوة الجيش +10", effect: 10, icon: "⚔️" },
      { cost: 120, desc: "قوة الجيش +25", effect: 25, icon: "🗡️" },
      { cost: 250, desc: "قوة الجيش +50", effect: 50, icon: "🛡️" },
      { cost: 500, desc: "قوة الجيش +100", effect: 100, icon: "🏹" },
      { cost: 1000, desc: "قوة الجيش +200", effect: 200, icon: "⚒️" },
    ]
  },
  {
    // ========== 2. المعرفة (بدلاً من الابتكار) ==========
    id: "knowledge",
    name: "المعرفة",
    icon: "📜",
    // 🖼️ image: 'assets/images/upgrades/knowledge.png', // 120×120 — ارفع صورتك هنا
    desc: "تطوير المعرفة والعلوم الصحراوية",
    levels: [
      { cost: 40, desc: "إنتاج الذهب +15%", effect: 15, icon: "📖" },
      { cost: 100, desc: "إنتاج الذهب +30%", effect: 30, icon: "📚" },
      { cost: 200, desc: "إنتاج الذهب +50%", effect: 50, icon: "🔮" },
      { cost: 400, desc: "إنتاج الذهب +80%", effect: 80, icon: "💎" },
      { cost: 800, desc: "إنتاج الذهب +120%", effect: 120, icon: "👑" },
    ]
  },
  {
    // ========== 3. الدفاع ==========
    id: "defense",
    name: "الدفاع",
    icon: "🛡️",
    // 🖼️ image: 'assets/images/upgrades/defense.png', // 120×120 — ارفع صورتك هنا
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
    // 🖼️ image: 'assets/images/upgrades/trade.png', // 120×120 — ارفع صورتك هنا
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

  getEffect(pathId) {
    const p = UPGRADE_PATHS.find(x => x.id === pathId);
    if (!p) return 0;
    const lvl = this.levels[pathId] || 0;
    if (lvl >= p.levels.length) return p.levels[p.levels.length - 1].effect;
    let total = 0;
    for (let i = 0; i < lvl; i++) total += p.levels[i].effect;
    return total;
  }

  canUpgrade(pathId) {
    const p = UPGRADE_PATHS.find(x => x.id === pathId);
    if (!p) return false;
    const lvl = this.levels[pathId] || 0;
    if (lvl >= p.levels.length) return false;
    return this.economy.canAfford("gold", p.levels[lvl].cost);
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
      effect: this.getEffect(p.id),
      desc: this.getDesc(p.id),
    }));
  }

  loadState(saved) {
    if (!saved) return;
    for (const key of Object.keys(this.levels)) {
      if (saved[key] !== undefined) this.levels[key] = saved[key];
    }
  }
}
