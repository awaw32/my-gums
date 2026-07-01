const TUTORIAL_STEPS = [
  { id: "welcome", target: "#top-bar", text: "👋 مرحباً بك في ملك الصحراء! هذا شريط الموارد — راقب أموالك وذهبك.", side: "bottom" },
  { id: "promotion", target: "[data-screen='promotion']", text: "🏠 هذه شاشة الترقية — ابنِ مباني الواحة لزيادة دخلك.", side: "top" },
  { id: "building", target: ".building-card", text: "🏗️ اضغط على ⚔️ مقاتلة لتحرير المبنى من الوحوش، ثم ابنِه.", side: "top" },
  { id: "war", target: "[data-screen='war']", text: "⚔️ اذهب إلى شاشة الحرب — هناك تقاتل الوحوش وتواجه لاعبين آخرين.", side: "top" },
  { id: "arena", target: "#arena-enter-btn", text: "🏟️ اضغط الدخول في الساحة — عالم مفتوح مليء بالوحوش والجوائز!", side: "top" },
  { id: "territories", target: "[data-screen='territories']", text: "🗺️ شاشة الأراضي — سيطر على الواحات لزيادة دخلك السلبي.", side: "top" },
  { id: "alliance", target: "[data-screen='alliance']", text: "👑 التحالف — حسّن تحالفك للحصول على بونصات قوية.", side: "top" },
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
