// ═══════════════════════════════════════════════════════════════════
//  🎉 نظام الاحتفالات — لحظات النصر الكبرى
//  اهتزاز شاشة + قصاصات متساقطة + بانر ضخم + موسيقى نصر
//  يُستدعى من: فوز PvP، قتل بوس، فوز/إخلاء BR، فوز الأنماط الخاصة
// ═══════════════════════════════════════════════════════════════════

const CELEBRATION_PRESETS = {
  pvp_win:    { icon: "⚔️", title: "انتصار ساحق!",  confetti: 20, shake: true,  sound: "victory" },
  boss_kill:  { icon: "🐉", title: "سقط الزعيم!",   confetti: 28, shake: true,  sound: "fanfare" },
  br_win:     { icon: "👑", title: "أنت الملك!",    confetti: 40, shake: true,  sound: "fanfare" },
  extraction: { icon: "🚁", title: "إخلاء ناجح!",   confetti: 24, shake: false, sound: "victory" },
  mode_win:   { icon: "🏆", title: "مهمة مكتملة!",  confetti: 24, shake: false, sound: "fanfare" },
  level_up:   { icon: "⬆️", title: "مستوى جديد!",   confetti: 14, shake: false, sound: "levelup" },
};

const CONFETTI_EMOJI = ["🎉", "✨", "⭐", "🪙", "💎", "🔥"];

let _bannerTimer = null;

/**
 * تشغيل احتفال كامل
 * @param {string} kind - نوع الاحتفال (مفتاح من CELEBRATION_PRESETS)
 * @param {string} [subtitle] - سطر ثانٍ اختياري (مثل "+500 💎")
 */
export function celebrate(kind, subtitle = "") {
  const preset = CELEBRATION_PRESETS[kind] || CELEBRATION_PRESETS.mode_win;
  if (preset.shake) screenShake();
  confettiBurst(preset.confetti);
  showVictoryBanner(preset.icon, preset.title, subtitle);
  playCelebrationSound(preset.sound);
}

/** اهتزاز الشاشة القصير */
export function screenShake() {
  const target = document.body;
  target.classList.remove("screen-shake");
  // إعادة تشغيل الأنيميشن حتى لو كانت فعّالة
  void target.offsetWidth;
  target.classList.add("screen-shake");
  setTimeout(() => target.classList.remove("screen-shake"), 600);
}

/** قصاصات احتفالية تتساقط من أعلى الشاشة */
export function confettiBurst(count = 24) {
  const container = document.getElementById("particle-container") || document.body;
  for (let i = 0; i < count; i++) {
    setTimeout(() => {
      const el = document.createElement("div");
      el.className = "confetti-piece";
      el.textContent = CONFETTI_EMOJI[Math.floor(Math.random() * CONFETTI_EMOJI.length)];
      el.style.left = Math.random() * 100 + "vw";
      el.style.fontSize = (14 + Math.random() * 16) + "px";
      el.style.animationDuration = (1.6 + Math.random() * 1.4) + "s";
      el.style.animationDelay = "0s";
      container.appendChild(el);
      setTimeout(() => el.remove(), 3200);
    }, i * 40);
  }
}

/** بانر النصر الضخم وسط الشاشة */
export function showVictoryBanner(icon, title, subtitle = "") {
  document.getElementById("victory-banner")?.remove();
  if (_bannerTimer) clearTimeout(_bannerTimer);
  const el = document.createElement("div");
  el.id = "victory-banner";
  el.className = "victory-banner";
  el.innerHTML = `
    <div class="vb-icon">${icon}</div>
    <div class="vb-title">${title}</div>
    ${subtitle ? `<div class="vb-subtitle">${subtitle}</div>` : ""}
  `;
  document.body.appendChild(el);
  _bannerTimer = setTimeout(() => {
    el.classList.add("vb-out");
    setTimeout(() => el.remove(), 500);
  }, 2200);
}

/** صوت الاحتفال — يستخدم AudioManager الموجود عبر window._audio */
function playCelebrationSound(kind) {
  const audio = window._audio;
  if (!audio) return;
  try {
    if (kind === "fanfare" && audio.sfxFanfare) audio.sfxFanfare();
    else if (kind === "levelup") audio.sfxLevelup();
    else audio.sfxVictory();
  } catch { /* الصوت اختياري — لا يكسر الاحتفال */ }
}
