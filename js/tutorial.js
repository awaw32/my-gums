const TUTORIAL_STEPS = [
  { id: "welcome", target: "#top-bar", text: "👋 مرحباً بك في ملك الصحراء! هذا شريط الموارد — راقب أموالك 💵 وذهبك 🪙 وجواهرك 💎.", side: "bottom" },
  { id: "promotion", target: "[data-screen='promotion']", text: "⭐ شاشة الترقية — ارفع مستوى جنودك، دربهم، وطور مباني الواحة لزيادة دخلك.", side: "top" },
  { id: "building", target: ".map-building", text: "🏗️ اضغط على المبنى لترقيته. كل مبنى يزيد من إنتاجك وقوتك.", side: "top" },
  { id: "shop", target: ".tab-btn[data-tab='shop']", text: "🛒 المتجر — اشترِ مخطوطات ومطارق وجرعات. يمكنك صرف 1 💎 ← 200 💵 هنا.", side: "top" },
  { id: "weapons", target: ".tab-btn[data-tab='weapons']", text: "🗡️ مكتبة الأسلحة — اشترِ أسلحة جديدة ورفع مستوى أسلحتك الموجودة.", side: "top" },
  { id: "army", target: ".tab-btn[data-tab='army']", text: "⚔️ ساحة الجيش — طور مستوى جنودك ومستوى تدريبهم لزيادة قوتك.", side: "top" },
  { id: "inventory", target: "#sub-btn-inventory", text: "📦 المخزون والتصنيع — استخدم الجرعات في المعركة، اصنع أسلحة وادوات جديدة.", side: "top" },
  { id: "quests", target: "#sub-btn-quests", text: "📜 المهام — أنجز المهام اليومية واكمل فصول القصة لتحصل على مكافآت ضخمة.", side: "top" },
  { id: "war", target: "[data-screen='war']", text: "⚔️ ساحة الحرب — هناك 3 ألعاب: مغامرة الصحراء (PvE)، واحة الغنائم (PvP)، وباتل رويال!", side: "top" },
  { id: "events", target: "#sub-btn-events", text: "🎊 الأحداث — أحداث محدودة تمنح مضاعفات: ذهب ×2، XP ×2، قوة +50%!", side: "top" },
  { id: "territories", target: "[data-screen='territories']", text: "🗺️ شاشة الأراضي — تحكم بقراك وواحاتك. كلما وسعت مملكتك زاد دخلك.", side: "top" },
  { id: "alliance", target: "[data-screen='alliance']", text: "👑 التحالف — حسّن تحالفك لبونصات ضرر ودفاع ودخل. شارك في غارات التحالف!", side: "top" },
  { id: "village", target: "#sub-btn-village", text: "🏘️ القرى — انتقل بين القرى كلما تقدمت في القصة. كل قرية أقوى من سابقتها.", side: "top" },
  { id: "prestige", target: "#sub-btn-prestige", text: "🔄 إعادة الميلاد (Prestige) — عند المستوى 110، ابدأ من جديد ببونصات دائمة وقوة مضاعفة!", side: "top" },
];

export class TutorialManager {
  constructor() {
    this.completed = false;
    this.currentStep = 0;
    this.dismissed = false;
    this._onComplete = null;
  }

  get needsTutorial() {
    return !this.completed && !this.dismissed;
  }

  get current() {
    if (this.currentStep >= TUTORIAL_STEPS.length) return null;
    return TUTORIAL_STEPS[this.currentStep];
  }

  next() {
    this.currentStep++;
    if (this.currentStep >= TUTORIAL_STEPS.length) {
      this.completed = true;
      if (this._onComplete) this._onComplete();
    }
  }

  skip() {
    this.dismissed = true;
    this.completed = true;
    if (this._onComplete) this._onComplete();
  }

  getState() {
    return { completed: this.completed, currentStep: this.currentStep, dismissed: this.dismissed };
  }

  loadState(saved) {
    if (!saved) return;
    this.completed = saved.completed || false;
    this.currentStep = saved.currentStep || 0;
    this.dismissed = saved.dismissed || false;
  }

  getSaveData() {
    return { completed: this.completed, currentStep: this.currentStep, dismissed: this.dismissed };
  }
}
