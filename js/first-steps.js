// ═══════════════════════════════════════════════════════════════════
//  🧭 خطواتك الأولى — توجيه اللاعب الجديد في دقائقه الخمس الأولى
//  سلسلة أهداف قصيرة بمكافآت فورية كبيرة: تدريب ← قتال ← تجهيز سلاح
//  تظهر كبانر هدف ثابت أسفل الشاشة وتختفي نهائياً بعد الإكمال
// ═══════════════════════════════════════════════════════════════════

const FIRST_STEPS = [
  { id: "train",  icon: "⚔️", goal: "درّب جيشك — اضغط زر ترقية الجيش",   hint: "من القائمة السريعة أسفل الشاشة", reward: { cash: 300 },  rewardLabel: "+300 💵" },
  { id: "kill",   icon: "🗡️", goal: "اقتل أول وحش في الخريطة!",          hint: "افتح حرب ← مغامرة الصحراء واضغط على وحش", reward: { gems: 20 },  rewardLabel: "+20 💎" },
  { id: "equip",  icon: "🛡️", goal: "جهّز سلاحك الأول",                  hint: "من الترقية ← الأسلحة — اشترِ وجهّز", reward: { cash: 500, gems: 10 }, rewardLabel: "+500 💵 +10 💎" },
];

const STORAGE_KEY = "first_steps_v1";

export class FirstStepsManager {
  constructor(economy) {
    this.economy = economy;
    this.stepIndex = 0;
    this._load();
  }

  get done() { return this.stepIndex >= FIRST_STEPS.length; }
  get current() { return this.done ? null : FIRST_STEPS[this.stepIndex]; }

  _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) this.stepIndex = JSON.parse(raw).stepIndex || 0;
    } catch { /* تجاهل */ }
  }

  _save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ stepIndex: this.stepIndex })); } catch { /* تجاهل */ }
  }

  /** يُستدعى من نقاط اللعب: notify('train') / notify('kill') / notify('equip') */
  async notify(actionId) {
    const step = this.current;
    if (!step || step.id !== actionId) return;
    // منح المكافأة
    if (step.reward.cash) this.economy?.addRaw("cash", step.reward.cash);
    if (step.reward.gems) this.economy?.addRaw("gems", step.reward.gems);
    this.stepIndex++;
    this._save();
    // احتفال
    try {
      const { celebrate, confettiBurst } = await import("./celebrations.js");
      if (this.done) {
        celebrate("mode_win", `🧭 أكملت خطواتك الأولى! ${step.rewardLabel}`);
      } else {
        confettiBurst(10);
        if (window._audio) window._audio.sfxCollect();
      }
    } catch { /* الاحتفال اختياري */ }
    this.render();
  }

  /** بانر الهدف الحالي أسفل الشاشة */
  render() {
    let banner = document.getElementById("first-steps-banner");
    if (this.done) { banner?.remove(); return; }
    const step = this.current;
    if (!banner) {
      banner = document.createElement("div");
      banner.id = "first-steps-banner";
      banner.className = "first-steps-banner";
      document.body.appendChild(banner);
    }
    banner.innerHTML = `
      <span class="fs-icon">${step.icon}</span>
      <span class="fs-text">
        <span class="fs-goal">${step.goal}</span>
        <span class="fs-hint">${step.hint} — المكافأة: <b>${step.rewardLabel}</b></span>
      </span>
      <span class="fs-progress">${this.stepIndex + 1}/${FIRST_STEPS.length}</span>
    `;
  }
}
