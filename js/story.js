"use strict";

/**
 * نظام القصة والقرى - ملك الصحراء
 * كل قرية لها 4 مباني مرئية (b1-b4) + Boss نهائي
 */

// خلفيات القرى
export const VILLAGE_BACKGROUNDS = {
  wadi: 'assets/images/bg/bg-wadi.svg',
  palace_ruins: 'assets/images/bg/bg-palace_ruins.svg',
  mountain: 'assets/images/bg/bg-mountain.svg',
  plains: 'assets/images/bg/bg-plains.svg',
  throne: 'assets/images/bg/bg-throne.svg'
};

// صور المباني حسب القرية والحالة
export function getBuildingImages(villageId, buildingId) {
  return {
    empty: `assets/images/buildings/${villageId}/${buildingId}-empty.svg`,
    building: `assets/images/buildings/${villageId}/${buildingId}-building.svg`,
    built: `assets/images/buildings/${villageId}/${buildingId}-built.svg`
  };
}

// صور المباني الافتراضية (للتوافق مع الأكواد القديمة)
export const BUILDING_IMAGES = {
  b1: getBuildingImages('wadi', 'b1'),
  b2: getBuildingImages('wadi', 'b2'),
  b3: getBuildingImages('wadi', 'b3'),
  b4: getBuildingImages('wadi', 'b4'),
  b5: getBuildingImages('wadi', 'b5'),
  b6: getBuildingImages('wadi', 'b6'),
};

export const STORY_CHAPTERS = [
  {
    id: 1,
    village: "wadi",
    title: "بداية الحياة في الواحة",
    description: "وصلت إلى واحة صغيرة في قلب الصحراء. بدأت ببناء حياة جديدة وحماية ما تملك من الوحوش الجائعة.",
    levelRequired: 1,
    bossFightScene: true,
    reward: {
      cash: 500,
      gold: 50,
      xp: 200,
      heroXp: 50,
      unitLevels: 2,
      trainingLevel: 1,
      knowledgeLevel: 1,
      title: "المستوطن الجديد"
    },
    bossId: "wadi_boss",
    scenes: [
      {
        id: "wadi_intro",
        title: "الوصول إلى الواحة",
        text: "سافرت لأيام عبر الصحراء حتى وصلت إلى واحة صغيرة. مياهها عذبة وأشجار النخيل توفر حماية من الشمس. قررت أن تبني هنا حياتك.",
        icon: "🏝️",
        bg: "linear-gradient(135deg, #1a5276 0%, #2e86c1 50%, #85c1e9 100%)",
        choices: [
          { text: "🔨 ابدأ فوراً في بناء الخيمة", reward: { cash: 50 }, nextText: "بدأت ببناء خيمتك الأولى. مع كل مسمار تدقه، تشعر بالأمان." },
          { text: "🔭 استكشف المنطقة أولاً", reward: { gold: 10 }, nextText: "تجولت في الواحة، وجدت ينبوعاً صافياً وعلامات لوجود وحوش قريبة." }
        ]
      },
      {
        id: "wadi_danger",
        title: "الخطر يتقدم",
        text: "لكن الوحوش شمّت بوجودك. ذئاب صحراوية وعقارب تقترب من الواحة كل ليلة. عليك بناء دفاعات قبل أن يفقد كل شيء.",
        icon: "🐺",
        bg: "linear-gradient(135deg, #1a1a1a 0%, #4a0000 50%, #8b0000 100%)",
        choices: [
          { text: "⚔️ درب الجنود فوراً", reward: { xp: 50 }, nextText: "جنودك يتدربون بجد. سيصبحون أقوى كل يوم." },
          { text: "🧱 عزز الدفاعات أولاً", reward: { gold: 15 }, nextText: "تبني حواجز وأسواراً حول المخيم. الوحوش ستصبح أبطأ في الاختراق." }
        ]
      },
      {
        id: "wadi_build",
        title: "بناء المستقبل",
        text: "ابدأ ببناء خيمة القائد، ثم مخيم الجنود، ثم مخزن الموارد، وأخيراً ساحة التدريب. هذه هي أساسات أي قرية صحراوية قوية.",
        icon: "🏗️",
        bg: "linear-gradient(135deg, #0d3b0d 0%, #1a6b1a 50%, #2ecc71 100%)",
        choices: [
          { text: "📈 استثمر في الاقتصاد", reward: { cash: 100 }, nextText: "مواردك تزداد. التجارة مع القوافل المارة تبدأ." },
          { text: "🎯 حسّن التدريب القتالي", reward: { xp: 100 }, nextText: "جنودك يصبحون أكثر مهارة. جاهزون للقتال!" }
        ]
      },
      {
        id: "wadi_merchant",
        title: "التاجر الغريب",
        text: "وصل تاجر غريب إلى الواحة. يحمل بضائع نادرة من أقاصي الصحراء. يعرض عليك صفقة.",
        icon: "🐪",
        bg: "linear-gradient(135deg, #8b4513 0%, #cd853f 50%, #daa520 100%)",
        choices: [
          { text: "💰 اشترِ سلاحاً نادراً", reward: { gems: 5 }, nextText: "اشتريت خنجراً قديماً منقوشاً برموز غامضة." },
          { text: "🗺️ اشترِ خريطة للمنطقة", reward: { gold: 20 }, nextText: "الخريطة تظهر طرقاً مختصرة ومواقع كنوز مخفية." }
        ]
      },
      {
        id: "wadi_boss",
        title: "⚔️ معركة الزعيم: ذئب الواحة",
        text: "فجأة، يظهر ذئب ضخم بعيون متوهجة. جسمه يغطيه ندوب معارك قديمة. هذا هو حامي الواحة، وعليك هزيمته لتثبت جدارتك!",
        icon: "🐺",
        bg: "linear-gradient(135deg, #1a0000 0%, #4a0000 50%, #ff0000 100%)",
        isBoss: true,
        bossId: "wadi_boss"
      }
    ]
  },
  {
    id: 2,
    village: "palace_ruins",
    title: "اكتشاف أطلال القصر",
    description: "وجدت أنقاض قصر قديم مدفون تحت الرمال. في داخله كنوز ومخطوطات لكنها محمية من حراس الأموات.",
    levelRequired: 15,
    bossFightScene: true,
    reward: {
      cash: 2000,
      gold: 200,
      gems: 50,
      xp: 1000,
      heroXp: 200,
      unitLevels: 3,
      trainingLevel: 1,
      knowledgeLevel: 2,
      title: "باحث الآثار"
    },
    bossId: "palace_boss",
    scenes: [
      {
        id: "palace_discover",
        title: "الاكتشاف",
        text: "أثناء الحفر بحثاً عن المياه، وجدت مدخلاً لقصر قديم. جدرانه مزينة بزخارف ذهبية وأبوابه محفورة بخط قديم.",
        icon: "🏛️",
        bg: "linear-gradient(135deg, #4a3728 0%, #8b6914 50%, #daa520 100%)",
        choices: [
          { text: "📜 ادرس النقوش أولاً", reward: { scrolls: 5 }, nextText: "النقوش تحكي قصة حضارة عظيمة. تتعلم أسراراً جديدة." },
          { text: "⛏️ ادخل مباشرة", reward: { cash: 200 }, nextText: "دخلت القصر بحذر. تجد قاعة كبيرة مليئة بالكنوز." }
        ]
      },
      {
        id: "palace_ghosts",
        title: "حراس الأموات",
        text: "أثناء دخولك القصر، ظهرت أشباح من الجدران. فرسان الظل وساحر الرمال يحرسون الكنوز. عليك هزيمتهم قبل الحصول على الموارد.",
        icon: "👻",
        bg: "linear-gradient(135deg, #1a0a2e 0%, #3d1f6d 50%, #6c3fb5 100%)",
        choices: [
          { text: "🛡️ استخدم الدروع الواقية", reward: { defense: 5 }, nextText: "الدروع تحميك من هجمات الأشباح. تقترب من الكنز!" },
          { text: "⚔️ هجوم شامل", reward: { xp: 200 }, nextText: "جنودك يهاجمون الأشباح. المعركة شرسة لكنكم تنتصرون." }
        ]
      },
      {
        id: "palace_treasure",
        title: "الكنوز المخفية",
        text: "بعد هزيمة الأشباح، وجدت مكتبة مخطوطات وورشة سلاح قديمة. هذه الموارد ستحولك من فلاح إلى محارب حقيقي.",
        icon: "📜",
        bg: "linear-gradient(135deg, #1a1a0a 0%, #5c5c1f 50%, #b8b800 100%)",
        choices: [
          { text: "🔬 ادرس المخطوطات", reward: { scrolls: 10, gems: 5 }, nextText: "المخطوطات تحتوي على وصفات لصنع أسلحة قوية." },
          { text: "⚒️ طوّر ورشة السلاح", reward: { hammers: 10, cash: 300 }, nextText: "الورشة جاهزة. يمكنك الآن صنع أسلحة متطورة!" }
        ]
      },
      {
        id: "palace_riddle",
        title: "لغز الغرفة المغلقة",
        text: "تجد غرفة مغلقة بأبواب حجرية ضخمة. عليها أحجية قديمة: 'ما هو الشيء الذي يموت إذا شرب؟'",
        icon: "🧩",
        bg: "linear-gradient(135deg, #2c1810 0%, #4a2c1a 50%, #6b4226 100%)",
        choices: [
          { text: "🔥 أجب: 'النار'", reward: { gems: 10 }, nextText: "الباب يفتح ببطء. داخلها كنوز لا تصدق!" },
          { text: "💥 استخدم القوة لفتح الباب", reward: { cash: 200, hammers: 5 }, nextText: "تكسر الباب بالقوة. لكن بعض الكنوز تتحطم." }
        ]
      },
      {
        id: "palace_boss",
        title: "⚔️ معركة الزعيم: ساحر الرمال",
        text: "تصل إلى قاعة العرش. هناك، ساحر الرمال العظيم ينتظرك. عصاه السحرية تلمع برمال متحركة. هذه أصعب معركة حتى الآن!",
        icon: "🧙",
        bg: "linear-gradient(135deg, #1a002a 0%, #3d0066 50%, #6c00b5 100%)",
        isBoss: true,
        bossId: "palace_boss"
      }
    ]
  },
  {
    id: 3,
    village: "mountain",
    title: "بناء قلعة الجبل",
    description: "على قمة الجبل، بنيت قلعة محصنة. الآن يجب الدفاع عنها من الغزاة والمحتلين.",
    levelRequired: 30,
    bossFightScene: true,
    reward: {
      cash: 10000,
      gold: 1000,
      gems: 150,
      xp: 5000,
      heroXp: 500,
      unitLevels: 4,
      trainingLevel: 2,
      knowledgeLevel: 3,
      title: "حامي الجبل"
    },
    bossId: "mountain_boss",
    scenes: [
      {
        id: "mountain_climb",
        title: "الصعود",
        text: "صعدت إلى قمة الجبل مع جنودك. من هنا ترى الصحراء كلها. موقع استراتيجي لا يمكن الاستغناء عنه.",
        icon: "⛰️",
        bg: "linear-gradient(135deg, #2c3e50 0%, #34495e 50%, #7f8c8d 100%)",
        choices: [
          { text: "🏗️ ابدأ ببناء القلعة فوراً", reward: { cash: 500 }, nextText: "القلعة تبدأ في الارتفاع. الجدران سميكة والأبراج عالية." },
          { text: "🔭 استكشف الجبل أولاً", reward: { gems: 10 }, nextText: "تجد كهفاً مليئاً بالبلورات النادرة. ثروة إضافية!" }
        ]
      },
      {
        id: "mountain_siege",
        title: "الحصار",
        text: "جيش من الغزاة يحاصر القلعة. عليك بناء السور الخارجي وورشة الحصار قبل أن يخترقوها. القتال سيكون عنيفاً.",
        icon: "⚔️",
        bg: "linear-gradient(135deg, #4a0000 0%, #8b0000 50%, #cc0000 100%)",
        choices: [
          { text: "🏹 استخدم الرماة على الأسوار", reward: { xp: 500 }, nextText: "الرماة يمنعون الغزاة من الاقتراب. خسائر قليلة." },
          { text: "💥 فتح البوابات وهجوم مفاجئ", reward: { cash: 1000, gems: 15 }, nextText: "هجومك المفاجئ يشتت الغزاة. تحقق نصراً ساحقاً!" }
        ]
      },
      {
        id: "mountain_victory",
        title: "النصر",
        text: "صمدت أمام الحصار وبناءت قلعة لا تتزعزع. الآن أصبحت قوة يجب حسابها في الصحراء.",
        icon: "🏰",
        bg: "linear-gradient(135deg, #1a4a1a 0%, #2d7a2d 50%, #3cb371 100%)",
        choices: [
          { text: "🎉 أقم احتفالاً للنصر", reward: { gold: 200 }, nextText: "الجنود يحتفلون. الروح المعنوية عالية!" },
          { text: "♻️ استعد للهجوم التالي", reward: { xp: 500, trainingLevel: 1 }, nextText: "الاستعداد الدائم هو مفتاح البقاء. جيشك يتدرب بجد." }
        ]
      },
      {
        id: "mountain_alliance",
        title: "عرض التحالف",
        text: "يصل رسول من قبيلة مجاورة. يعرضون التحالف معك ضد عدو مشترك. لكن هناك شروط.",
        icon: "🤝",
        bg: "linear-gradient(135deg, #1a3a1a 0%, #2d5a2d 50%, #3cb371 100%)",
        choices: [
          { text: "✅ اقبل التحالف", reward: { gold: 500, alliancePower: 10 }, nextText: "التحالف يعزز قوتك. الآن لديك حلفاء في المعركة." },
          { text: "❌ ارفض واثبت استقلالك", reward: { cash: 1500 }, nextText: "القبيلة تغادر لكنها تحترم قرارك." }
        ]
      },
      {
        id: "mountain_boss",
        title: "⚔️ معركة الزعيم: تنين الجبل",
        text: "من أعلى القلعة، ترى ظلاً هائلاً يحلق في السماء. تنين الجبل الأسطوري! لهيب ناره يحرق كل شيء. هذه معركة المصير!",
        icon: "🐉",
        bg: "linear-gradient(135deg, #2a0000 0%, #6a0000 50%, #cc0000 100%)",
        isBoss: true,
        bossId: "mountain_boss"
      }
    ]
  },
  {
    id: 4,
    village: "plains",
    title: "توسيع النفوذ",
    description: "وسعت ممالكك لتشمل السهول الخصبة. الآن تتحكم في التجارة والزراعة والجيوش.",
    levelRequired: 50,
    bossFightScene: true,
    reward: {
      cash: 50000,
      gold: 5000,
      gems: 500,
      xp: 25000,
      heroXp: 1000,
      unitLevels: 5,
      trainingLevel: 2,
      knowledgeLevel: 4,
      title: "سيد السهول"
    },
    bossId: "plains_boss",
    scenes: [
      {
        id: "plains_expansion",
        title: "التوسع",
        text: "في السهول الخصبة، أرض خصبة للمزارع والتجارة. بناء سوق وميناء وحصن حدودي سيجعلك تتحكم في اقتصاد المنطقة.",
        icon: "🌾",
        bg: "linear-gradient(135deg, #228b22 0%, #32cd32 50%, #90ee90 100%)",
        choices: [
          { text: "🌾 استثمر في الزراعة", reward: { food: 100, cash: 1000 }, nextText: "الحقول تنتج محاصيل وفيرة. التجارة تزدهر." },
          { text: "🏪 ابنِ سوقاً مركزياً", reward: { gold: 500, gems: 25 }, nextText: "التجار من كل مكان يأتون إلى سوقك. أرباح هائلة!" }
        ]
      },
      {
        id: "plains_trade",
        title: "التجارة",
        text: "التجار من كل أنحاء الصحراء يريدون التجارة معك. لكن قطاع الطرق يهاجمون القوافل. عليك حماية طرق التجارة.",
        icon: "🐫",
        bg: "linear-gradient(135deg, #8b4513 0%, #cd853f 50%, #daa520 100%)",
        choices: [
          { text: "🛡️ أرسل حراساً للقوافل", reward: { gold: 1000, cash: 2000 }, nextText: "القوافل تصل بأمان. التجارة تزداد ضعفين." },
          { text: "⚔️ طارد قطاع الطرق", reward: { xp: 2000, gems: 30 }, nextText: "تقضي على قطاع الطرق. طرق التجارة تصبح آمنة." }
        ]
      },
      {
        id: "plains_power",
        title: "القوة",
        text: "أصبحت من أقوى القوى في الصحراء. جيوشك مدربة وأسلحتك متطورة. الوقت قد حان للوصول للعرش.",
        icon: "👑",
        bg: "linear-gradient(135deg, #4a0080 0%, #7b00cc 50%, #9b30ff 100%)",
        choices: [
          { text: "🗡️ جهّز جيش الغزو", reward: { xp: 3000, unitLevels: 1 }, nextText: "الجيش جاهز. الرايات ترفرف في الريح." },
          { text: "📚 طوّر الأكاديمية الحربية", reward: { trainingLevel: 1, gems: 50 }, nextText: "الضباط يتدربون على أحدث تكتيكات الحرب." }
        ]
      },
      {
        id: "plains_diplomacy",
        title: "المؤتمر الدولي",
        text: "قادة القبائل يدعونك لمؤتمر في واحة النخبة. يريدون مناقشة مستقبل الصحراء ومشاركة النفوذ.",
        icon: "🗣️",
        bg: "linear-gradient(135deg, #1a1a4a 0%, #2d2d7a 50%, #3b3bb5 100%)",
        choices: [
          { text: "🤝 تعاون وبناء تحالفات", reward: { alliancePower: 25, gold: 2000 }, nextText: "القبائل توحد صفوفها. الآن أنت القائد الأعلى." },
          { text: "👑 افرض سيطرتك بالقوة", reward: { cash: 10000, gems: 75 }, nextText: "القبائل تخضع لحكمك. لكن بعضها يحمل الضغينة." }
        ]
      },
      {
        id: "plains_boss",
        title: "⚔️ معركة الزعيم: جيش الغزاة",
        text: "جيش الغزاة العظيم يظهر في الأفق. آلاف الجنود المدججين بالسلاح. هذه أكبر معركة في تاريخ الصحراء!",
        icon: "⚔️",
        bg: "linear-gradient(135deg, #3a0000 0%, #8b0000 50%, #ff0000 100%)",
        isBoss: true,
        bossId: "plains_boss"
      }
    ]
  },
  {
    id: 5,
    village: "throne",
    title: "قمة العرش",
    description: "وصلت للقلعة الملكية. الآن يجب تأمين عرشك والسيطرة على المملكة كلها. أنت ملك الصحراء.",
    levelRequired: 75,
    bossFightScene: true,
    reward: {
      cash: 500000,
      gold: 50000,
      gems: 5000,
      xp: 100000,
      heroXp: 2000,
      unitLevels: 5,
      trainingLevel: 3,
      knowledgeLevel: 5,
      title: "ملك الصحراء"
    },
    bossId: "final_boss",
    scenes: [
      {
        id: "throne_arrival",
        title: "الوصول إلى القصر",
        text: "وقفت أمام القصر الملكي العظيم. مئات الأبراج والجدران السميكة. هذا هو مصيرك.",
        icon: "🏰",
        bg: "linear-gradient(135deg, #b8860b 0%, #daa520 50%, #ffd700 100%)",
        choices: [
          { text: "🎺 ادخل بكرامة ملكية", reward: { gold: 5000, gems: 100 }, nextText: "الأبواب تفتح. الحرس الملكي ينحني احتراماً." },
          { text: "⚔️ اقتحم بقوة", reward: { cash: 25000, xp: 10000 }, nextText: "تقتحم القصر بقوة. المقاومة شرسة لكنك تتقدم." }
        ]
      },
      {
        id: "throne_battle",
        title: "المعركة الأخيرة",
        text: "حراس العرش لا يستسلمون بسهولة. فرسان مدرعون وساحرون أقوياء يحرسون العرش. عليك إثبات أنك تستحقه.",
        icon: "⚔️",
        bg: "linear-gradient(135deg, #8b0000 0%, #cc0000 50%, #ff0000 100%)",
        choices: [
          { text: "🎯 تحدّى قائد الحراس", reward: { xp: 15000, unitLevels: 2 }, nextText: "قائد الحراس يقبل التحدي. معركة الأبطال تبدأ!" },
          { text: "🌪️ هجوم شامل بكل القوات", reward: { cash: 50000, gems: 200 }, nextText: "كل قواتك تهاجم من كل اتجاه. الحراس يتراجعون!" }
        ]
      },
      {
        id: "throne_coronation",
        title: "التتويج",
        text: "جلست على العرش. الناس يهتفون باسمك. أنت الآن ملك الصحراء. حكمك عادل وقوي.",
        icon: "👑",
        bg: "linear-gradient(135deg, #ffd700 0%, #ffec8b 50%, #fffacd 100%)",
        choices: [
          { text: "👑 أعلن عهداً من العدل", reward: { gold: 10000, gems: 500 }, nextText: "الشعب يهتف. عصر ذهبي جديد يبدأ." },
          { text: "⚔️ أعلن التوسع في الأراضي", reward: { cash: 100000, xp: 25000, title: "الفاتح العظيم" }, nextText: "الجيوش تتجه لأراضٍ جديدة. امبراطوريتك تتسع!" }
        ]
      },
      {
        id: "throne_legacy",
        title: "الإرث",
        text: "المؤرخون يكتبون قصتك. جيل بعد جيل سيروي حكاية ملك الصحراء الذي بنى مملكة من لا شيء.",
        icon: "📜",
        bg: "linear-gradient(135deg, #1a0a00 0%, #3d1f00 50%, #6b3a00 100%)",
        choices: [
          { text: "🏛️ ابنِ نصباً تذكارياً", reward: { gems: 1000, gold: 25000 }, nextText: "النصب يخلد اسمك للأبد. المسافرون يقفون إجلالاً." },
          { text: "📚 اكتب كتاباً عن رحلتك", reward: { xp: 50000, scrolls: 500 }, nextText: "كتابك يصبح مرجعاً لكل قادة الصحراء." }
        ]
      },
      {
        id: "throne_boss",
        title: "⚔️ المعركة النهائية: صقر الصحراء",
        text: "فجأة، يظلم الجو. صقر الصحراء الأسطوري، حارس الخلود، يحط على القصر. عيناه تشعان بنور غامض. هذه معركة القدر! انتصارك يعني الخلود، هزيمتك تعني النهاية.",
        icon: "🦅",
        bg: "linear-gradient(135deg, #00001a 0%, #2a003a 50%, #6a00b5 100%)",
        isBoss: true,
        bossId: "final_boss"
      }
    ]
  },
  {
    id: 6,
    village: "throne",
    title: "عهد المملكة — الخاتمة",
    description: "أنت ملك الصحراء. الآن يبدأ عهدك الذهبي. كيف ستحكم مملكتك؟",
    levelRequired: 100,
    bossFightScene: false,
    isEpilogue: true,
    reward: {
      cash: 1000000,
      gold: 100000,
      gems: 10000,
      xp: 200000,
      heroXp: 5000,
      unitLevels: 10,
      trainingLevel: 5,
      knowledgeLevel: 5,
      title: "السلطان الأعظم"
    },
    scenes: [
      {
        id: "epilogue_peace",
        title: "عهد السلام",
        text: "تتوج ملكاً على الصحراء. القبائل تبايعك والطرقة آمنة. الأمراء من كل مكان يأتون لتهنئتك. تبدأ في بناء عاصمة جديدة تليق بمملكتك.",
        icon: "🕊️",
        bg: "linear-gradient(135deg, #1a5276 0%, #2e86c1 50%, #aed6f1 100%)",
        choices: [
          { text: "🕊️ ابنِ عاصمة السلام", reward: { cash: 100000, gold: 10000, gems: 500 }, nextText: "العاصمة الجديدة تزدهر. العلم والثقافة ينشران في كل مكان." },
          { text: "🏛️ ابنِ قلعة حربية عظمى", reward: { xp: 50000, unitLevels: 5, trainingLevel: 2 }, nextText: "القلعة الحربية تصبح درع الصحراء. لا عدو يجرؤ على الاقتراب." }
        ]
      },
      {
        id: "epilogue_legacy",
        title: "الإرث العظيم",
        text: "تمر السنين. مملكتك تزدهر. العلماء والمفكرون والفلاسفة يتوافدون من كل الأراضي. تفتتح أول جامعة في الصحراء وأول مكتبة عامة.",
        icon: "📚",
        bg: "linear-gradient(135deg, #4a235a 0%, #7d3c98 50%, #bb8fce 100%)",
        choices: [
          { text: "📚 افتح الجامعة الملكية", reward: { gems: 1000, scrolls: 1000, gold: 20000 }, nextText: "الجامعة تخرج أعظم العقول. الصحراء تصبح منارة للعلم." },
          { text: "⚒️ ابنِ أعجوبة الصحراء", reward: { cash: 500000, gems: 2000, hammers: 500 }, nextText: "الأعجوبة تجذب السياح والتجار من كل العالم." }
        ]
      },
      {
        id: "epilogue_coronation",
        title: "التتويج الأبدي",
        text: "في حفل مهيب، يتوجك كبار الكهنة كسلطان أعظم للصحراء. اسمك يسطر في ذاكرة التاريخ. ستبقى قصتك خالدة للأبد.",
        icon: "👑",
        bg: "linear-gradient(135deg, #7d6608 0%, #daa520 50%, #f9e79f 100%)",
        isEpilogue: true,
        choices: [
          { text: "👑 أحكم بالعدل والحكمة", reward: { gold: 50000, gems: 5000, alliancePower: 100 }, nextText: "الناس يدعون لك. مملكتك تصبح أقوى وأغنى." },
          { text: "⚔️ وسع المملكة للعالم", reward: { cash: 1000000, xp: 100000, title: "الفاتح الأعظم" }, nextText: "جيوشك تفتح أراضٍ جديدة. امبراطوريتك تمتد عبر القارات." }
        ]
      }
    ]
  }
];

export const STORY_VILLAGES = [
  {
    id: "wadi",
    name: "قرية الواحة",
    description: "واحة صغيرة في قلب الصحراء - نقطة البداية",
    icon: "🏝️",
    levelRequired: 1,
    chapterId: 1,
    moveCost: {},
    bg: VILLAGE_BACKGROUNDS.wadi,
    position: { x: 10, y: 50 },
    buildings: [
      {
        id: "b1",
        slot: "civic",
        name: "خيمة القائد",
        description: "مقر القائد ومركز القرية",
        icon: "🏕️",
        x: 72, y: 35,
        img: BUILDING_IMAGES.b1,
        cost: { cash: 200, gold: 50 },
        production: { cash: 5 },
        upgradeCost: { cash: 100, gold: 25 },
        maxLevel: 10,
        power: 10,
        monsterName: "ذئب صحراوي",
        monsterPower: 50
      },
      {
        id: "b2",
        slot: "military",
        name: "مخيم الجنود",
        description: "تجنيد وتدريب الجنود",
        icon: "⚔️",
        x: 20, y: 55,
        img: BUILDING_IMAGES.b2,
        cost: { cash: 400, gold: 100 },
        production: { food: 5, gold: 2 },
        upgradeCost: { cash: 200, gold: 50 },
        maxLevel: 10,
        power: 15,
        monsterName: "عقرب صحراوي",
        monsterPower: 80
      },
      {
        id: "b3",
        slot: "economic",
        name: "مخزن الموارد",
        description: "تخزين الماء والطعام",
        icon: "📦",
        x: 78, y: 70,
        img: BUILDING_IMAGES.b3,
        cost: { cash: 300, gold: 75 },
        production: { food: 8, cash: 5 },
        upgradeCost: { cash: 150, gold: 37 },
        maxLevel: 10,
        power: 12,
        monsterName: "لص صحراوي",
        monsterPower: 120
      },
      {
        id: "b4",
        slot: "training",
        name: "ساحة التدريب",
        description: "تدريب الجنود على القتال",
        icon: "🏋️",
        x: 45, y: 30,
        img: BUILDING_IMAGES.b4,
        cost: { cash: 800, gold: 200 },
        production: { cash: 10, gold: 5 },
        upgradeCost: { cash: 400, gold: 100 },
        maxLevel: 10,
        power: 25,
        monsterName: "زاوية الرمال",
        monsterPower: 200
      },
      {
        id: "b5",
        slot: "economic",
        name: "مضخة الماء",
        description: "استخراج المياه الجوفية",
        icon: "💧",
        x: 50, y: 60,
        img: { empty: 'assets/images/buildings/wadi/b5-empty.svg', building: 'assets/images/buildings/wadi/b5-building.svg', built: 'assets/images/buildings/wadi/b5-built-waterpump.jpg' },
        cost: { cash: 600, gold: 150 },
        production: { food: 10, cash: 8 },
        upgradeCost: { cash: 300, gold: 75 },
        maxLevel: 10,
        power: 15,
        monsterName: "عقرب سام",
        monsterPower: 350
      }
    ]
  },
  {
    id: "palace_ruins",
    name: "أطلال القصر",
    description: "أنقاض قصر قديم مدفون تحت الرمال",
    icon: "🏛️",
    levelRequired: 15,
    chapterId: 2,
    moveCost: { gold: 500, gems: 5 },
    bg: VILLAGE_BACKGROUNDS.palace_ruins,
    position: { x: 30, y: 30 },
    buildings: [
      {
        id: "b1",
        slot: "civic",
        name: "مكتبة المخطوطات",
        description: "دراسة الكتب القديمة",
        icon: "📜",
        x: 72, y: 35,
        img: BUILDING_IMAGES.b1,
        cost: { cash: 2000, gold: 500, scrolls: 10 },
        production: { scrolls: 3, gold: 10 },
        upgradeCost: { cash: 1000, gold: 250, scrolls: 5 },
        maxLevel: 15,
        power: 40,
        monsterName: "شبح القصر",
        monsterPower: 300
      },
      {
        id: "b2",
        slot: "military",
        name: "ورشة السلاح",
        description: "صنع أسلحة متطورة",
        icon: "🔨",
        x: 20, y: 55,
        img: BUILDING_IMAGES.b2,
        cost: { cash: 3000, gold: 800, hammers: 20 },
        production: { hammers: 5, cash: 20 },
        upgradeCost: { cash: 1500, gold: 400, hammers: 10 },
        maxLevel: 15,
        power: 50,
        monsterName: "فارس الظل",
        monsterPower: 450
      },
      {
        id: "b3",
        slot: "economic",
        name: "معبد الأجداد",
        description: "احترام الأجداد والأسلاف",
        icon: "🏛️",
        x: 78, y: 70,
        img: BUILDING_IMAGES.b3,
        cost: { cash: 2500, gold: 600, scrolls: 15 },
        production: { gold: 15, cash: 10 },
        upgradeCost: { cash: 1250, gold: 300, scrolls: 7 },
        maxLevel: 15,
        power: 45,
        monsterName: "ساحر الرمال",
        monsterPower: 600
      },
      {
        id: "b4",
        slot: "training",
        name: "خزنة الكنوز",
        description: "حفظ الكنوز والمصاغ",
        icon: "💰",
        x: 45, y: 30,
        img: BUILDING_IMAGES.b4,
        cost: { cash: 5000, gold: 1000 },
        production: { gold: 25, cash: 30 },
        upgradeCost: { cash: 2500, gold: 500 },
        maxLevel: 15,
        power: 35,
        monsterName: "حارس القصر",
        monsterPower: 800
      }
    ]
  },
  {
    id: "mountain",
    name: "قلعة الجبل",
    description: "قلعة محصنة على قمة الجبل",
    icon: "⛰️",
    levelRequired: 30,
    chapterId: 3,
    moveCost: { gold: 2000, gems: 15 },
    bg: VILLAGE_BACKGROUNDS.mountain,
    position: { x: 50, y: 20 },
    buildings: [
      {
        id: "b1",
        slot: "civic",
        name: "السور الخارجي",
        description: "دفاعات القلعة الخارجية",
        icon: "🧱",
        x: 72, y: 35,
        img: BUILDING_IMAGES.b1,
        cost: { cash: 15000, gold: 3000, hammers: 50 },
        production: { cash: 50, gold: 15 },
        upgradeCost: { cash: 7500, gold: 1500, hammers: 25 },
        maxLevel: 20,
        power: 80,
        monsterName: "محارب الغزو",
        monsterPower: 1000
      },
      {
        id: "b2",
        slot: "military",
        name: "ورشة الحصار",
        description: "آلات الحصار والمدافع",
        icon: "⚔️",
        x: 20, y: 55,
        img: BUILDING_IMAGES.b2,
        cost: { cash: 20000, gold: 4000, hammers: 80 },
        production: { hammers: 10, cash: 40 },
        upgradeCost: { cash: 10000, gold: 2000, hammers: 40 },
        maxLevel: 20,
        power: 90,
        monsterName: "فارس الحديد",
        monsterPower: 1500
      },
      {
        id: "b3",
        slot: "economic",
        name: "قاعة الجنود",
        description: "تدريب الجنود والمحاربين",
        icon: "⚔️",
        x: 78, y: 70,
        img: BUILDING_IMAGES.b3,
        cost: { cash: 25000, gold: 5000 },
        production: { gold: 20, cash: 30 },
        upgradeCost: { cash: 12500, gold: 2500 },
        maxLevel: 20,
        power: 70,
        monsterName: "عصفور الجبل",
        monsterPower: 2000
      },
      {
        id: "b4",
        slot: "training",
        name: "مستودع الذخيرة",
        description: "تخزين الأسلحة والذخيرة",
        icon: "📦",
        x: 45, y: 30,
        img: BUILDING_IMAGES.b4,
        cost: { cash: 18000, gold: 3500, scrolls: 30 },
        production: { hammers: 8, scrolls: 5 },
        upgradeCost: { cash: 9000, gold: 1750, scrolls: 15 },
        maxLevel: 20,
        power: 60,
        monsterName: "تنين الجبل",
        monsterPower: 3000
      },
      {
        id: "b5",
        slot: "economic",
        name: "منجم الذهب",
        description: "استخراج الذهب من باطن الجبل",
        icon: "⛏️",
        x: 55, y: 55,
        img: { empty: 'assets/images/buildings/mountain/b5-empty.svg', building: 'assets/images/buildings/mountain/b5-building.svg', built: 'assets/images/buildings/mountain/b5-built.png' },
        cost: { cash: 22000, gold: 4500, hammers: 60 },
        production: { gold: 40, cash: 25 },
        upgradeCost: { cash: 11000, gold: 2250, hammers: 30 },
        maxLevel: 20,
        power: 85,
        monsterName: "غول الجبل",
        monsterPower: 2500
      },
      {
        id: "b6",
        slot: "military",
        name: "الثكنة العسكرية",
        description: "تجنيد وتدريب الجنود بكفاءة",
        icon: "⚔️",
        x: 35, y: 45,
        img: { empty: 'assets/images/buildings/mountain/b6-empty.svg', building: 'assets/images/buildings/mountain/b6-building.svg', built: 'assets/images/buildings/mountain/b6-built.png' },
        cost: { cash: 28000, gold: 5500, hammers: 90 },
        production: { hammers: 12, cash: 35 },
        upgradeCost: { cash: 14000, gold: 2750, hammers: 45 },
        maxLevel: 20,
        power: 100,
        monsterName: "قائد الغزاة",
        monsterPower: 3500
      }
    ]
  },
  {
    id: "plains",
    name: "سهول الريف",
    description: "سهول خصبة تغذي الإمبراطورية",
    icon: "🌾",
    levelRequired: 50,
    chapterId: 4,
    moveCost: { gold: 5000, gems: 30 },
    bg: VILLAGE_BACKGROUNDS.plains,
    position: { x: 70, y: 60 },
    buildings: [
      {
        id: "b1",
        slot: "civic",
        name: "سوق المزارعين",
        description: "بيع المنتجات الزراعية",
        icon: "🏪",
        x: 72, y: 35,
        img: BUILDING_IMAGES.b1,
        cost: { cash: 50000, gold: 10000 },
        production: { gold: 100, cash: 80 },
        upgradeCost: { cash: 25000, gold: 5000 },
        maxLevel: 25,
        power: 120,
        monsterName: "قطاع طرق",
        monsterPower: 4000
      },
      {
        id: "b2",
        slot: "military",
        name: "ميناء التجارة",
        description: "استيراد وتصدير البضائع",
        icon: "⚓",
        x: 20, y: 55,
        img: BUILDING_IMAGES.b2,
        cost: { cash: 75000, gold: 15000, scrolls: 50 },
        production: { gold: 150, cash: 100 },
        upgradeCost: { cash: 37500, gold: 7500, scrolls: 25 },
        maxLevel: 25,
        power: 140,
        monsterName: "فارس مدرع",
        monsterPower: 6000
      },
      {
        id: "b3",
        slot: "economic",
        name: "حصن الحدود",
        description: "حماية الحدود من الغزاة",
        icon: "🏰",
        x: 78, y: 70,
        img: BUILDING_IMAGES.b3,
        cost: { cash: 100000, gold: 20000, hammers: 100 },
        production: { cash: 120, gold: 40 },
        upgradeCost: { cash: 50000, gold: 10000, hammers: 50 },
        maxLevel: 25,
        power: 160,
        monsterName: "ساحر حرب",
        monsterPower: 8000
      },
      {
        id: "b4",
        slot: "training",
        name: "أكاديمية الفرسان",
        description: "تدريب فرسان النخبة",
        icon: "🐎",
        x: 45, y: 30,
        img: BUILDING_IMAGES.b4,
        cost: { cash: 125000, gold: 25000 },
        production: { gold: 60, cash: 80 },
        upgradeCost: { cash: 62500, gold: 12500 },
        maxLevel: 25,
        power: 180,
        monsterName: "جيش الغزاة",
        monsterPower: 12000
      }
    ]
  },
  {
    id: "throne",
    name: "قصر الملك",
    description: "قصر العرش الملكي - الهدف النهائي",
    icon: "👑",
    levelRequired: 75,
    chapterId: 5,
    moveCost: { gold: 10000, gems: 50 },
    bg: VILLAGE_BACKGROUNDS.throne,
    position: { x: 90, y: 40 },
    buildings: [
      {
        id: "b1",
        slot: "civic",
        name: "العرش الملكي",
        description: "رمز السلطة والحكم",
        icon: "👑",
        x: 72, y: 35,
        img: BUILDING_IMAGES.b1,
        cost: { cash: 250000, gold: 50000, scrolls: 100 },
        production: { gold: 500, cash: 300 },
        upgradeCost: { cash: 125000, gold: 25000, scrolls: 50 },
        maxLevel: 30,
        power: 250,
        monsterName: "متمرد ملكي",
        monsterPower: 15000
      },
      {
        id: "b2",
        slot: "military",
        name: "مجلس الحكم",
        description: "إدارة شؤون المملكة",
        icon: "🏛️",
        x: 20, y: 55,
        img: BUILDING_IMAGES.b2,
        cost: { cash: 300000, gold: 60000 },
        production: { gold: 600, cash: 400 },
        upgradeCost: { cash: 150000, gold: 30000 },
        maxLevel: 30,
        power: 200,
        monsterName: "فارس الأسطول",
        monsterPower: 20000
      },
      {
        id: "b3",
        slot: "economic",
        name: "حرس الملك",
        description: "الحراسة الشخصية للملك",
        icon: "⚔️",
        x: 78, y: 70,
        img: BUILDING_IMAGES.b3,
        cost: { cash: 350000, gold: 70000, hammers: 200 },
        production: { hammers: 50, cash: 200 },
        upgradeCost: { cash: 175000, gold: 35000, hammers: 100 },
        maxLevel: 30,
        power: 300,
        monsterName: "ساحر الظلام",
        monsterPower: 25000
      },
      {
        id: "b4",
        slot: "training",
        name: "خزنة المملكة",
        description: "إدارة خزينة المملكة",
        icon: "💰",
        x: 45, y: 30,
        img: BUILDING_IMAGES.b4,
        cost: { cash: 400000, gold: 80000 },
        production: { gold: 800, cash: 500 },
        upgradeCost: { cash: 200000, gold: 40000 },
        maxLevel: 30,
        power: 220,
        monsterName: "صقر الصحراء",
        monsterPower: 35000
      }
    ]
  }
];

export const STORY_REWARDS = {
  chapter_complete: {
    1: { title: "مستوطن الواحة", badge: "wadi_hero" },
    2: { title: "باحث الآثار", badge: "ruins_explorer" },
    3: { title: "حامي الجبل", badge: "mountain_guardian" },
    4: { title: "سيد السهول", badge: "plains_lord" },
    5: { title: "ملك الصحراء", badge: "desert_king" }
  },
  village_complete: {
    wadi: { cash: 500, gold: 50, xp: 200 },
    palace_ruins: { cash: 1500, gold: 150, gems: 10, xp: 800 },
    mountain: { cash: 5000, gold: 500, gems: 25, xp: 2500 },
    plains: { cash: 15000, gold: 1500, gems: 75, xp: 8000 },
    throne: { cash: 50000, gold: 5000, gems: 200, xp: 25000 }
  }
};
