"use strict";

export const CINEMATIC_SCENES = [
  {
    id: "intro",
    icon: "🌪️",
    title: "بداية الرحلة",
    text: "في عالم مُ涵洞 بسبب الكوارث الطبيعية، تُعتبر الصحراء أرضًا مُهددة. أنت مُستوطن جديد وصلت إلى هذه الأراضي القاحلة بحثًا عن أمل.",
    bg: "linear-gradient(135deg, #1a0a00 0%, #3d1f00 50%, #5a2d00 100%)"
  },
  {
    id: "water",
    icon: "💧",
    title: "البحث عن المياه",
    text: "جمع 100 وحدة ماء عبر النقر على النقطة المائية في الصحراء. الماء ضروري للزراعة والشرب في المباني المستقبلية.",
    bg: "linear-gradient(135deg, #0a1628 0%, #1a3a5c 50%, #2d5a87 100%)",
    objective: { type: "collect", resource: "water", target: 100 }
  },
  {
    id: "fence",
    icon: "🏗️",
    title: "بناء السياج",
    text: "اجمع 50 معادن لتفكيك جزء من السياج وفتح مساحة جديدة. السياج يحمي المستعمرة من الكائنات الغريبة.",
    bg: "linear-gradient(135deg, #1a1a0a 0%, #3d3d1f 50%, #5a5a2d 100%)",
    objective: { type: "collect", resource: "minerals", target: 50 }
  },
  {
    id: "creatures",
    icon: "⚔️",
    title: "القتال مع الكائنات",
    text: "اجمع 20 وحدة النار السحرية لمواجهة الكائنات الغريبة التي تخرج من الرمال. النيران السحرية تُستخدم في الأسلحة والدفاع.",
    bg: "linear-gradient(135deg, #1a0505 0%, #3d0a0a 50%, #5a1515 100%)",
    objective: { type: "collect", resource: "fire", target: 20 }
  },
  {
    id: "map",
    icon: "🗺️",
    title: "التنقل في الخريطة",
    text: "تعلم استخدام خريطة الصحراء لتجنب الكوارث الطبيعية. الخريطة تُظهر مواقع الموارد والكائنات.",
    bg: "linear-gradient(135deg, #0a1a0a 0%, #1a3d1a 50%, #2d5a2d 100%)"
  },
  {
    id: "heritage",
    icon: "🏛️",
    title: "التراث الصحراوي",
    text: "اجمع 100 وحدة التراث لبناء متحف يُظهر تاريخ الصحراء. التراث يُعزز سمعة المستعمرة ويجذب اللاعبين الجدد.",
    bg: "linear-gradient(135deg, #1a0a1a 0%, #3d1f3d 50%, #5a2d5a 100%)",
    objective: { type: "collect", resource: "heritage", target: 100 }
  },
  {
    id: "capital",
    icon: "👑",
    title: "العاصمة الصحرائية",
    text: "لقد أكملت رحلتك! الآن يمكنك بناء مدينة مستقلة تُسمى العاصمة الصحرائية. مرحباً بك في عالم ملك الصحراء!",
    bg: "linear-gradient(135deg, #1a0a00 0%, #5a2d00 50%, #8B6914 100%)"
  }
];

const STORAGE_KEY = "cinematic_completed";

export class CinematicManager {
  constructor() {
    this.completed = this._loadState();
    this.currentScene = 0;
    this.overlay = null;
    this._onComplete = null;
  }

  get needsCinematic() {
    return !this.completed;
  }

  start(onComplete) {
    if (!this.needsCinematic) {
      if (onComplete) onComplete();
      return;
    }
    this._onComplete = onComplete;
    this.currentScene = 0;
    this._showScene(this.currentScene);
  }

  skip() {
    this.completed = true;
    this._saveState();
    this._hideOverlay();
    if (this._onComplete) this._onComplete();
  }

  next() {
    this.currentScene++;
    if (this.currentScene >= CINEMATIC_SCENES.length) {
      this.completed = true;
      this._saveState();
      this._hideOverlay();
      if (this._onComplete) this._onComplete();
    } else {
      this._showScene(this.currentScene);
    }
  }

  _showScene(index) {
    const scene = CINEMATIC_SCENES[index];
    if (!scene) return;

    if (!this.overlay) {
      this.overlay = document.createElement("div");
      this.overlay.id = "cinematic-overlay";
      this.overlay.className = "cinematic-overlay";
      document.body.appendChild(this.overlay);
    }

    const progress = ((index + 1) / CINEMATIC_SCENES.length) * 100;
    const isLast = index === CINEMATIC_SCENES.length - 1;
    const actionText = isLast ? "ابدأ المغامرة" : "التالي →";

    this.overlay.innerHTML = `
      <div class="cinematic-bg" style="background: ${scene.bg}"></div>
      <div class="cinematic-content">
        <div class="cinematic-icon">${scene.icon}</div>
        <h2 class="cinematic-title">${scene.title}</h2>
        <p class="cinematic-text">${scene.text}</p>
        ${scene.objective ? `
          <div class="cinematic-objective">
            <span class="cinematic-objective-icon">🎯</span>
            <span class="cinematic-objective-text">هدف: جمع ${scene.objective.target} ${this._getResourceName(scene.objective.resource)}</span>
          </div>
        ` : ''}
        <div class="cinematic-progress">
          <div class="cinematic-progress-bar" style="width: ${progress}%"></div>
        </div>
        <div class="cinematic-buttons">
          <button class="cinematic-btn-skip" onclick="window._cinematicManager.skip()">تخطي</button>
          <button class="cinematic-btn-next" onclick="window._cinematicManager.next()">${actionText}</button>
        </div>
        <div class="cinematic-counter" dir="ltr">${index + 1} / ${CINEMATIC_SCENES.length}</div>
      </div>
    `;

    this.overlay.style.display = "flex";
  }

  _hideOverlay() {
    if (this.overlay) {
      this.overlay.style.display = "none";
    }
  }

  _getResourceName(type) {
    const names = {
      water: "ماء",
      minerals: "معادن",
      fire: "نار سحرية",
      heritage: "تراث"
    };
    return names[type] || type;
  }

  _loadState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved === "true";
    } catch {
      return false;
    }
  }

  _saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, this.completed ? "true" : "false");
    } catch {}
  }

  getSaveData() {
    return { completed: this.completed };
  }

  loadState(data) {
    if (data && typeof data.completed === "boolean") {
      this.completed = data.completed;
      this._saveState();
    }
  }
}

if (typeof window !== "undefined") {
  window.CinematicManager = CinematicManager;
  window.CINEMATIC_SCENES = CINEMATIC_SCENES;
}

// eslint-disable-next-line no-undef
if (typeof module !== "undefined") {
  // eslint-disable-next-line no-undef
  module.exports = { CinematicManager, CINEMATIC_SCENES };
}
