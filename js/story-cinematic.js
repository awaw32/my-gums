"use strict";

/**
 * نظام السينماتيك والحوارات الدرامية - ملك الصحراء
 * تأثيرات بصرية وصوتية للقصة
 */

export const CINEMATIC_INTRO = {
  scenes: [
    {
      duration: 4000,
      text: "في زمنٍ بعيد... كانت الصحراء تحكمها ممالك عظيمة",
      icon: "🏜️",
      bg: "linear-gradient(135deg, #0a0a2a 0%, #1a1a4a 50%, #2a2a6a 100%)",
      effect: "stars"
    },
    {
      duration: 4000,
      text: "لكن الزمن جرف كل شيء تحت الرمال... ونسي الناس أسماء الملوك",
      icon: "💨",
      bg: "linear-gradient(135deg, #2a1a0a 0%, #4a2a0a 50%, #6a3a0a 100%)",
      effect: "sand"
    },
    {
      duration: 4000,
      text: "حتى جاء أنت... فلاح بسيط لا يملك شيئاً",
      icon: "‍🌾",
      bg: "linear-gradient(135deg, #1a0a00 0%, #3a1a00 50%, #5a2a00 100%)",
      effect: "dust"
    },
    {
      duration: 4000,
      text: "لكن في عينيك... كانت نار الملوك القدماء ",
      icon: "👑",
      bg: "linear-gradient(135deg, #4a0000 0%, #8a0000 50%, #cc0000 100%)",
      effect: "fire"
    },
    {
      duration: 5000,
      text: "هذه قصتك... قصة ملك الصحراء",
      icon: "⚔️",
      bg: "linear-gradient(135deg, #1a002a 0%, #3a004a 50%, #6a008a 100%)",
      effect: "crown",
      isTitle: true
    }
  ]
};

export const STORY_DIALOGUES = {
  wadi: {
    intro: [
      { speaker: "راوي", text: "سافرت لأيام عبر الصحراء القاسية...", icon: "🏜️", effect: "sand" },
      { speaker: "راوي", text: "ماءك ينفد... وقوتك على وشك الانتهاء", icon: "💧", effect: "shake" },
      { speaker: "راوي", text: "وفجأة... رأيت خضرة في الأفق!", icon: "🌴", effect: "glow" },
      { speaker: "راوي", text: "واحة! واحة صغيرة وسط بحر الرمال!", icon: "🌴", effect: "zoom" },
      { speaker: "أنت", text: "هنا... سأبني بيتي هنا!", icon: "💪", effect: "fire" },
    ],
    danger: [
      { speaker: "راوي", text: "لكن ليلة الأولى... سمعت عواءً مرعباً", icon: "🌙", effect: "dark" },
      { speaker: "راوي", text: "ذئاب! عشرات الذئاب تحيط بالواحة!", icon: "🐺", effect: "shake" },
      { speaker: "راوي", text: "عيناها حمراء... وأسنانها تلمع في الظلام", icon: "👁️", effect: "glow" },
      { speaker: "أنت", text: "لن أخسر كل شيء بعد أن وصلت!", icon: "⚔️", effect: "fire" },
    ],
    boss: [
      { speaker: "راوي", text: "الأرض ترتجف تحت قدميك...", icon: "🌍", effect: "shake" },
      { speaker: "راوي", text: "من خلف الكثبان... يظهر وحش لم ترَ مثله!", icon: "🐾", effect: "zoom" },
      { speaker: "راوي", text: "ذئب الواحة! حامي الصحراء منذ آلاف السنين!", icon: "⚡", effect: "fire" },
      { speaker: "ذئب الواحة", text: "غرررر... من أنت يا بشري لتدخل أرضي؟!", icon: "🐺", effect: "dark" },
      { speaker: "أنت", text: "أنا من سيأخذ هذه الواحة! قاتل أو انسحب!", icon: "⚔️", effect: "fire" },
    ]
  },
  palace_ruins: {
    intro: [
      { speaker: "راوي", text: "بعد سنوات من البناء... أصبحت قوياً", icon: "💪", effect: "glow" },
      { speaker: "راوي", text: "لكنك سمعت همسات... عن قصر مدفون تحت الرمال", icon: "👻", effect: "dark" },
      { speaker: "راوي", text: "قصر ملك قديم... مليء بالكنوز والأرواح!", icon: "🏛️", effect: "zoom" },
      { speaker: "أنت", text: "الكنوز القديمة تنتظر من يستحقها!", icon: "⛏️", effect: "fire" },
    ],
    boss: [
      { speaker: "راوي", text: "في أعماق القصر... الهواء يصبح بارداً", icon: "❄️", effect: "dark" },
      { speaker: "راوي", text: "أبواب قاعة العرش تنفتح بصرير مرعب...", icon: "🚪", effect: "shake" },
      { speaker: "راوي", text: "ساحر الرمال! لم يمت! بل ينتظر منذ قرون!", icon: "🧙", effect: "fire" },
      { speaker: "ساحر الرمال", text: "أحمق! هذا القصر ملعون! كل من دخله... لم يخرج!", icon: "💀", effect: "dark" },
      { speaker: "أنت", text: "أنا لست كغيري! سأخرج ومعّي كنوزك!", icon: "⚔️", effect: "fire" },
    ]
  },
  mountain: {
    intro: [
      { speaker: "راوي", text: "أصبحت قوياً بما يكفي لتحدي الجبل نفسه", icon: "⛰️", effect: "zoom" },
      { speaker: "راوي", text: "قلعة على القمة... تطل على كل الصحراء", icon: "🏰", effect: "glow" },
      { speaker: "راوي", text: "لكن الجبل ليس فارغاً... الغزاة قادمون!", icon: "⚔️", effect: "shake" },
      { speaker: "أنت", text: "قلعتي لن تسقط! أبداً!", icon: "🛡️", effect: "fire" },
    ],
    boss: [
      { speaker: "راوي", text: "السماء تظلم... رياح عاتية تضرب القلعة!", icon: "🌪️", effect: "shake" },
      { speaker: "راوي", text: "من بين الغيوم... ينقض تنين أسطوري!", icon: "🐉", effect: "zoom" },
      { speaker: "راوي", text: "تنين الجبل! آخر التنانين في الصحراء!", icon: "🐉", effect: "fire" },
      { speaker: "تنين الجبل", text: "هاهاها! بشري حقير! سأحرق قلعتك إلى رماد!", icon: "🐉", effect: "dark" },
      { speaker: "أنت", text: "جرب! قلعتي صُنعت من إرادة لا تنكسر!", icon: "⚔️", effect: "fire" },
    ]
  },
  plains: {
    intro: [
      { speaker: "راوي", text: "الصحراء كلها تعرف اسمك الآن", icon: "📜", effect: "glow" },
      { speaker: "راوي", text: "السهول الخصبة تنتظرك... لكن الغزاة أيضاً", icon: "⚔️", effect: "dark" },
      { speaker: "راوي", text: "جيش ضخم يتحرك نحو أراضيك!", icon: "🏇", effect: "shake" },
      { speaker: "أنت", text: "أراضيّ... قواعدي... لن يأخذها أحد!", icon: "🛡️", effect: "fire" },
    ],
    boss: [
      { speaker: "راوي", text: "الأفق يشتعل... آلاف الجنود يملأون السهول!", icon: "🔥", effect: "shake" },
      { speaker: "راوي", text: "جيش الغزاة العظيم... أكبر جيش رأت الصحراء!", icon: "⚔️", effect: "zoom" },
      { speaker: "قائد الغزاة", text: "استسلم يا ملك الرمال! لا أمل لك أمام جيشي!", icon: "🗡️", effect: "dark" },
      { speaker: "أنت", text: "جيشك كبير... لكن إرادتي أكبر! هجواااام!", icon: "⚔️", effect: "fire" },
    ]
  },
  throne: {
    intro: [
      { speaker: "راوي", text: "وصلت إلى القصر الملكي... نهاية الرحلة", icon: "👑", effect: "glow" },
      { speaker: "راوي", text: "العرش ينتظر... لكن الطريق إليه ملوثة بالدماء", icon: "🩸", effect: "dark" },
      { speaker: "راوي", text: "حراس العرش لا يرحمون...", icon: "🛡️", effect: "shake" },
      { speaker: "أنت", text: "بعد كل ما مررت به... لن يتوقف شيء الآن!", icon: "👑", effect: "fire" },
    ],
    boss: [
      { speaker: "راوي", text: "السماء تنشق! نور أعمى يغمر القصر!", icon: "⚡", effect: "zoom" },
      { speaker: "راوي", text: "صقر الصحراء! حارس الخلود! الأسطورة الحية!", icon: "🦅", effect: "fire" },
      { speaker: "راوي", text: "هذا هو التحدي الأخير... مصيرك بين يديك!", icon: "👑", effect: "shake" },
      { speaker: "صقر الصحراء", text: "أيها البشري... جرأتك مذهلة. لكن العرش ليس لك!", icon: "🦅", effect: "dark" },
      { speaker: "أنت", text: "العرش لي! بالدم والعرق والرمال... سأكون ملك الصحراء!", icon: "👑", effect: "fire" },
    ]
  }
};

export const STORY_DIALOGUES_EPILOGUE = {
  intro: [
    { speaker: "راوي", text: "انتهت الرحلة... وبدأ العهد الجديد", icon: "👑", effect: "glow" },
    { speaker: "راوي", text: "من فلاح فقير إلى ملك الصحراء...", icon: "🏜️", effect: "sand" },
    { speaker: "راوي", text: "الآن... كيف ستُخلّد ذكراك؟", icon: "📜", effect: "zoom" },
    { speaker: "الملك", text: "مملكتي... ستكون أعظم مملكة عرفتها الصحراء!", icon: "👑", effect: "fire" },
  ],
  coronation: [
    { speaker: "راوي", text: "في اليوم التاريخي... تُتوّج سلطاناً على الصحراء", icon: "🌟", effect: "glow" },
    { speaker: "راوي", text: "كل القبائل تبايعك... السماء تمطر نجوماً", icon: "✨", effect: "confetti" },
    { speaker: "كبير الكهنة", text: "أيها السلطان الأعظم... الصحراء كلها تحت قدميك", icon: "👑", effect: "fire" },
    { speaker: "الملك", text: "هذا ليس النهاية... هذه البداية فقط!", icon: "⚔️", effect: "fire" },
  ]
};

export const VICTORY_MESSAGES = {
  wadi: {
    title: "🎉 نجوت من الواحة!",
    text: "هزمت ذئب الواحة! الواحة الآن ملكك. لكن هذه مجرد البداية...",
    icon: "🎉",
    effect: "confetti"
  },
  palace_ruins: {
    title: "🏛️ اكتشفت أسرار القصر!",
    text: "ساحر الرمال سقط! كنوز الحضارة القديمة أصبحت ملكك!",
    icon: "🏆",
    effect: "confetti"
  },
  mountain: {
    title: "🏰 صمدت قلعة الجبل!",
    text: "التنين الأسطوري هُزم! اسمك يُكتب في تاريخ الجبال!",
    icon: "🏆",
    effect: "confetti"
  },
  plains: {
    title: "⚔️ سيطرت على السهول!",
    text: "جيش الغزاة انهار! أنت الآن أقوى قوة في الصحراء!",
    icon: "🏆",
    effect: "confetti"
  },
  throne: {
    title: "👑 ملك الصحراء!",
    text: "صقر الصحراء سقط! العرش ملكك! اسمك سيُخلد للأبد في تاريخ الصحراء!",
    icon: "👑",
    effect: "fireworks"
  },
  epilogue: {
    title: "👑 السلطان الأعظم!",
    text: "اكتملت قصتك! من فلاح فقير إلى سلطان أعظم للصحراء. اسمك خالد للأبد!",
    icon: "🌟",
    effect: "fireworks"
  }
};

export const STORY_EFFECTS = {
  shake: { type: "screen-shake", intensity: 5, duration: 500 },
  fire: { type: "particles", color: "#ff6600", count: 30, duration: 1000 },
  glow: { type: "glow", color: "#ffd700", duration: 800 },
  dark: { type: "darken", duration: 1500 },
  zoom: { type: "zoom", scale: 1.2, duration: 1000 },
  sand: { type: "particles", color: "#daa520", count: 20, duration: 1200 },
  confetti: { type: "confetti", count: 50, duration: 2000 },
  fireworks: { type: "fireworks", count: 10, duration: 3000 },
  stars: { type: "particles", color: "#ffffff", count: 40, duration: 2000 },
  dust: { type: "particles", color: "#8b7355", count: 15, duration: 1000 }
};

export function getStoryDialogue(villageId, sceneType) {
  const village = STORY_DIALOGUES[villageId];
  if (!village) return [];
  return village[sceneType] || village.intro || [];
}
