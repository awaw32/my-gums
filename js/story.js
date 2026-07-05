"use strict";

/**
 * نظام القصة والقرى - ملك الصحراء
 * كل قرية لها 4 مباني مرئية (b1-b4) + Boss نهائي
 */

// خلفيات القرى (يمكن استبدالها برابط سحابي)
export const VILLAGE_BACKGROUNDS = {
  wadi: 'assets/images/bg-village.jpg',
  palace_ruins: 'assets/images/bg-village.jpg',
  mountain: 'assets/images/bg-village.jpg',
  plains: 'assets/images/bg-village.jpg',
  throne: 'assets/images/bg-village.jpg'
};

// صور المباني الافتراضية حسب الحالة
export const BUILDING_IMAGES = {
  b1: { empty: 'assets/images/building-ruins.png', building: 'assets/images/building-construction.png', built: 'assets/images/building-complete.png' },
  b2: { empty: 'assets/images/building-ruins.png', building: 'assets/images/building-construction.png', built: 'assets/images/building-complete.png' },
  b3: { empty: 'assets/images/building-ruins.png', building: 'assets/images/building-construction.png', built: 'assets/images/building-complete.png' },
  b4: { empty: 'assets/images/building-ruins.png', building: 'assets/images/building-construction.png', built: 'assets/images/building-complete.png' }
};

export const STORY_CHAPTERS = [
  {
    id: 1,
    village: "wadi",
    title: "بداية الحياة في الواحة",
    description: "وصلت إلى واحة صغيرة في قلب الصحراء. بدأت ببناء حياة جديدة وحماية ما تملك من الوحوش الجائعة.",
    levelRequired: 1,
    reward: {
      cash: 500,
      gold: 50,
      xp: 200,
      title: "المستوطن الجديد"
    },
    bossId: "wadi_boss",
    scenes: [
      {
        id: "wadi_intro",
        title: "الوصول إلى الواحة",
        text: "سافرت لأيام عبر الصحراء حتى وصلت إلى واحة صغيرة. مياهها عذبة وأشجار النخيل توفر حماية من الشمس. قررت أن تبني هنا حياتك.",
        icon: "🏝️",
        bg: "linear-gradient(135deg, #1a5276 0%, #2e86c1 50%, #85c1e9 100%)"
      },
      {
        id: "wadi_danger",
        title: "الخطر يتقدم",
        text: "لكن الوحوش شمّت بوجودك. ذئاب صحراوية وعقارب تقترب من الواحة كل ليلة. عليك بناء دفاعات قبل أن يفقد كل شيء.",
        icon: "🐺",
        bg: "linear-gradient(135deg, #1a1a1a 0%, #4a0000 50%, #8b0000 100%)"
      },
      {
        id: "wadi_build",
        title: "بناء المستقبل",
        text: "ابدأ ببناء خيمة القائد، ثم مخيم الجنود، ثم مخزن الموارد، وأخيراً ساحة التدريب. هذه هي أساسات أي قرية صحراوية قوية.",
        icon: "🏗️",
        bg: "linear-gradient(135deg, #0d3b0d 0%, #1a6b1a 50%, #2ecc71 100%)"
      }
    ]
  },
  {
    id: 2,
    village: "palace_ruins",
    title: "اكتشاف أطلال القصر",
    description: "وجدت أنقاض قصر قديم مدفون تحت الرمال. في داخله كنوز ومخطوطات لكنها محمية من حراس الأموات.",
    levelRequired: 15,
    reward: {
      cash: 2000,
      gold: 200,
      gems: 50,
      xp: 1000,
      title: "باحث الآثار"
    },
    bossId: "palace_boss",
    scenes: [
      {
        id: "palace_discover",
        title: "الاكتشاف",
        text: "أثناء الحفر بحثاً عن المياه، وجدت مدخلاً لقصر قديم. جدرانه مزينة بزخارف ذهبية وأبوابه محفورة بخط قديم.",
        icon: "🏛️",
        bg: "linear-gradient(135deg, #4a3728 0%, #8b6914 50%, #daa520 100%)"
      },
      {
        id: "palace_ghosts",
        title: "حراس الأموات",
        text: "أثناء دخولك القصر، ظهرت أشباح من الجدران. فرسان الظل وساحر الرمال يحرسون الكنوز. عليك هزيمتهم قبل الحصول على الموارد.",
        icon: "👻",
        bg: "linear-gradient(135deg, #1a0a2e 0%, #3d1f6d 50%, #6c3fb5 100%)"
      },
      {
        id: "palace_treasure",
        title: "الكنوز المخفية",
        text: "بعد هزيمة الأشباح، وجدت مكتبة مخطوطات وورشة سلاح قديمة. هذه الموارد ستحولك من فلاح إلى محارب حقيقي.",
        icon: "📜",
        bg: "linear-gradient(135deg, #1a1a0a 0%, #5c5c1f 50%, #b8b800 100%)"
      }
    ]
  },
  {
    id: 3,
    village: "mountain",
    title: "بناء قلعة الجبل",
    description: "على قمة الجبل، بنيت قلعة محصنة. الآن يجب الدفاع عنها من الغزاة والمحتلين.",
    levelRequired: 30,
    reward: {
      cash: 10000,
      gold: 1000,
      gems: 150,
      xp: 5000,
      title: "حامي الجبل"
    },
    bossId: "mountain_boss",
    scenes: [
      {
        id: "mountain_climb",
        title: "الصعود",
        text: "صعدت إلى قمة الجبل مع جنودك. من هنا ترى الصحراء كلها. موقع استراتيجي لا يمكن الاستغناء عنه.",
        icon: "⛰️",
        bg: "linear-gradient(135deg, #2c3e50 0%, #34495e 50%, #7f8c8d 100%)"
      },
      {
        id: "mountain_siege",
        title: "الحصار",
        text: "جيش من الغزاة يحاصر القلعة. عليك بناء السور الخارجي وورشة الحصار قبل أن يخترقوها. القتال سيكون عنيفاً.",
        icon: "⚔️",
        bg: "linear-gradient(135deg, #4a0000 0%, #8b0000 50%, #cc0000 100%)"
      },
      {
        id: "mountain_victory",
        title: "النصر",
        text: "صمدت أمام الحصار وبناءت قلعة لا تتزعزع. الآن أصبحت قوة يجب حسابها في الصحراء.",
        icon: "🏰",
        bg: "linear-gradient(135deg, #1a4a1a 0%, #2d7a2d 50%, #3cb371 100%)"
      }
    ]
  },
  {
    id: 4,
    village: "plains",
    title: "توسيع النفوذ",
    description: "وسعت ممالكك لتشمل السهول الخصبة. الآن تتحكم في التجارة والزراعة والجيوش.",
    levelRequired: 50,
    reward: {
      cash: 50000,
      gold: 5000,
      gems: 500,
      xp: 25000,
      title: "سيد السهول"
    },
    bossId: "plains_boss",
    scenes: [
      {
        id: "plains_expansion",
        title: "التوسع",
        text: "في السهول الخصبة، أرض خصبة للمزارع والتجارة. بناء سوق وميناء وحصن حدودي سيجعلك تتحكم في اقتصاد المنطقة.",
        icon: "🌾",
        bg: "linear-gradient(135deg, #228b22 0%, #32cd32 50%, #90ee90 100%)"
      },
      {
        id: "plains_trade",
        title: "التجارة",
        text: "التجار من كل أنحاء الصحراء يريدون التجارة معك. لكن قطاع الطرق يهاجمون القوافل. عليك حماية طرق التجارة.",
        icon: "🐫",
        bg: "linear-gradient(135deg, #8b4513 0%, #cd853f 50%, #daa520 100%)"
      },
      {
        id: "plains_power",
        title: "القوة",
        text: "أصبحت من أقوى القوى في الصحراء. جيوشك مدربة وأسلحتك متطورة. الوقت قد حان للوصول للعرش.",
        icon: "👑",
        bg: "linear-gradient(135deg, #4a0080 0%, #7b00cc 50%, #9b30ff 100%)"
      }
    ]
  },
  {
    id: 5,
    village: "throne",
    title: "قمة العرش",
    description: "وصلت للقلعة الملكية. الآن يجب تأمين عرشك والسيطرة على المملكة كلها. أنت ملك الصحراء.",
    levelRequired: 75,
    reward: {
      cash: 500000,
      gold: 50000,
      gems: 5000,
      xp: 100000,
      title: "ملك الصحراء"
    },
    bossId: "final_boss",
    scenes: [
      {
        id: "throne_arrival",
        title: "الوصول إلى القصر",
        text: "وقفت أمام القصر الملكي العظيم. مئات الأبراج والجدران السميكة. هذا هو مصيرك.",
        icon: "🏰",
        bg: "linear-gradient(135deg, #b8860b 0%, #daa520 50%, #ffd700 100%)"
      },
      {
        id: "throne_battle",
        title: "المعركة الأخيرة",
        text: "حراس العرش لا يستسلمون بسهولة. فرسان مدرعون وساحرون أقوياء يحرسون العرش. عليك إثبات أنك تستحقه.",
        icon: "⚔️",
        bg: "linear-gradient(135deg, #8b0000 0%, #cc0000 50%, #ff0000 100%)"
      },
      {
        id: "throne_coronation",
        title: "التتويج",
        text: "جلست على العرش. الناس يهتفون باسمك. أنت الآن ملك الصحراء. حكمك عادل وقوي.",
        icon: "👑",
        bg: "linear-gradient(135deg, #ffd700 0%, #ffec8b 50%, #fffacd 100%)"
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
    icon: "🏰",
    levelRequired: 30,
    chapterId: 3,
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
      }
    ]
  },
  {
    id: "plains",
    name: "سهول الريف",
    description: "سهول خصبة للزراعة والتجارة",
    icon: "🌾",
    levelRequired: 50,
    chapterId: 4,
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
    description: "القلعة الملكية - الهدف النهائي",
    icon: "👑",
    levelRequired: 75,
    chapterId: 5,
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
    wadi: { cash: 1000, gold: 100, xp: 500 },
    palace_ruins: { cash: 5000, gold: 500, gems: 25, xp: 2000 },
    mountain: { cash: 25000, gold: 2500, gems: 100, xp: 10000 },
    plains: { cash: 100000, gold: 10000, gems: 300, xp: 50000 },
    throne: { cash: 1000000, gold: 100000, gems: 1000, xp: 200000 }
  }
};
