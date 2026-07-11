// =============================================================================
// config/images.js  —  مركز روابط صور اللعبة
// =============================================================================
// ارفع صورك إلى استضافتك السحابية وضع الرابط في الحقل المناسب.
// إذا تركت الحقل فارغ (null)، اللعبة تجلب الصورة من الملف المحلي تلقائياً.
// =============================================================================

const IMG = {

  // ==================== الخلفيات ====================
  bgVillage: null, // خلفية القرية — assets/images/bg-village.jpg
  bgFullscreen: null, // خلفية الشاشة الكاملة — assets/images/bg-village.jpg (قابلة للتغيير)
  mapDesert: null, // خريطة الصحراء — img/map.jpg

  // ==================== المباني (building states) ====================
  buildingRuins:        null, // أرض فارغة / مهدوم — assets/images/building-ruins.png
  buildingConstruction: null, // تحت الإنشاء       — assets/images/building-construction.png
  buildingComplete:     null, // مكتمل             — assets/images/building-complete.png

  // ==================== الجيش ====================
  leaderPlayer:  null, // قائد جيش اللاعب  — assets/images/army/leader-player.png
  avatarPlayer:  null, // صورة اللاعب      — assets/images/army/avatar-player.png
  soldierPlayer: null, // جندي اللاعب      — assets/images/army/soldier-player.png
  leaderEnemy:   null, // قائد جيش العدو   — assets/images/army/leader-enemy.png
  soldierEnemy:  null, // جندي العدو       — assets/images/army/soldier-enemy.png
  banditBr:      null, // قطاع طرق BR      — assets/images/army/bandit-br.png

  // ==================== الوحوش ====================
  monster1: null, // ذئب صحراوي     — assets/images/monsters/monster-1-wolf.png
  monster2: null, // محارب ظل       — assets/images/monsters/monster-2-shadow.png
  monster3: null, // زعيم الرمال    — assets/images/monsters/monster-3-chief.png

  // ==================== صفحة الأراضي (Lands page) ====================
  // خلفية خريطة الأراضي (استبدل الرابط بصورة خلفية الواحة)
  landsBg: null,

  // === المباني في صفحة الأراضي — كل مبنى له 3 صور ===
  // المبنى 1: الميناء
  b1Empty:        null,
  b1Construction: null,
  b1Built:        null,
  // المبنى 2: سوق السمك
  b2Empty:        null,
  b2Construction: null,
  b2Built:        null,
  // المبنى 3: مستودع البضائع
  b3Empty:        null,
  b3Construction: null,
  b3Built:        null,
  // المبنى 4: قلعة الحراسة
  b4Empty:        null,
  b4Construction: null,
  b4Built:        null,
  // المبنى 5: منارة
  b5Empty:        null,
  b5Construction: null,
  b5Built:        null,
  // المبنى 6: ساحة التدريب
  b6Empty:        null,
  b6Construction: null,
  b6Built:        null,

  // ==================== موارد (Resources) ====================
  goldIcon:    null, // أيقونة الذهب     — assets/images/resources/gold_32.png
  moneyIcon:   null, // أيقونة المال    — assets/images/resources/money_32.png
  foodIcon:    null, // أيقونة الطعام   — assets/images/resources/food_32.png
  powerIcon:   null, // أيقونة القوة    — assets/images/resources/power_32.png
  gemsIcon:    null, // أيقونة الجواهر  — assets/images/resources/gems_32.png
  hammersIcon: null, // أيقونة المطارق  — assets/images/resources/hammers_32.png
  scrollsIcon: null, // أيقونة المخطوطات — assets/images/resources/scrolls_32.png

  // ==================== أدوات المخزون ====================
  itemBandage:        null, //assets/images/items/bandage.png
  itemHealPotion:     null, //assets/images/items/heal_potion.png
  itemFireSword:      null, //assets/images/items/fire_sword.png
  itemDesertShield:   null, //assets/images/items/desert_shield.png
  itemPowerHelmet:    null, //assets/images/items/power_helmet.png
  itemXpScroll:       null, //assets/images/items/xp_scroll.png
  itemPowerGem:       null, //assets/images/items/power_gem.png
  itemArenaTicket:    null, //assets/images/items/arena_ticket.png
  itemTowerBlueprint: null, //assets/images/items/tower_blueprint.png
  itemIronSword:      null, //assets/images/items/sword_iron_96.png
  itemDesertScimitar: null, //assets/images/items/desert_scimitar.jpg
};

// =============================================================================
// ImageResolver — يجلب رابط الصورة: priority → URL سحابي > ملف محلي
// =============================================================================
// eslint-disable-next-line no-unused-vars
const ImageResolver = {
  /** خريطة: مفتاح الصورة → المسار المحلي (إذا ما في رابط سحابي) */
  _local: {
    // خلفيات
    bgVillage: 'assets/images/bg-village.jpg',
    bgFullscreen: 'assets/images/bg-village.jpg',
    mapDesert: 'img/map.jpg',
    // صورة افتراضية للأفاتار (مرجع من CSS)
    'avatar-default': 'assets/images/avatar-default.png',
    // مباني
    buildingRuins:        'assets/images/building-ruins.png',
    buildingConstruction: 'assets/images/building-construction.png',
    buildingComplete:     'assets/images/building-complete.png',
    // جيش — المفاتيح kebab-case تطابق world.js
    'leader-player':  'assets/images/army/leader-player.png',
    'avatar-player':  'assets/images/army/avatar-player.png',
    'soldier-player': 'assets/images/army/soldier-player.png',
    'leader-enemy':   'assets/images/army/leader-enemy.png',
    'soldier-enemy':  'assets/images/army/soldier-enemy.png',
    'bandit-br':      'assets/images/army/bandit-br.png',
    // وحوش — المفاتيح تطابق world.js (_preloadImages)
    'monster-1': 'assets/images/monsters/monster-1-wolf.png',
    'monster-2': 'assets/images/monsters/monster-2-shadow.png',
    'monster-3': 'assets/images/monsters/monster-3-chief.png',
    // وحوش إضافية
    'scorpion-elite':  'assets/images/monsters/scorpion_elite_96.png',
    'sand-dragon':     'assets/images/monsters/sand_dragon_96.png',
    'giant-sand':      'assets/images/monsters/giant_sand_96.png',
    'mystic-mage':     'assets/images/monsters/mystic_mage_96.png',
    'thief-assassin':  'assets/images/monsters/thief_assassin_96.png',
    // جيش إضافي
    'warrior-scimitar': 'assets/images/army/warrior_scimitar_96.png',
    'healer-oasis':     'assets/images/army/healer_oasis_96.png',
    'archer-desert':    'assets/images/army/archer_desert_96.png',
    'camel-rider':      'assets/images/army/camel_rider_96.png',
    // الأراضي
    landsBg: 'assets/images/bg-village.jpg',
    b1Empty: 'assets/images/building-ruins.png',
    b1Construction: 'assets/images/building-construction.png',
    b1Built: 'assets/images/building-complete.png',
    b2Empty: 'assets/images/building-ruins.png',
    b2Construction: 'assets/images/building-construction.png',
    b2Built: 'assets/images/building-complete.png',
    b3Empty: 'assets/images/building-ruins.png',
    b3Construction: 'assets/images/building-construction.png',
    b3Built: 'assets/images/building-complete.png',
    b4Empty: 'assets/images/building-ruins.png',
    b4Construction: 'assets/images/building-construction.png',
    b4Built: 'assets/images/building-complete.png',
    b5Empty: 'assets/images/building-ruins.png',
    b5Construction: 'assets/images/building-construction.png',
    b5Built: 'assets/images/building-complete.png',
    b6Empty: 'assets/images/building-ruins.png',
    b6Construction: 'assets/images/building-construction.png',
    b6Built: 'assets/images/building-complete.png',
    // موارد
    goldIcon:    'assets/images/resources/gold_32.png',
    moneyIcon:   'assets/images/resources/money_32.png',
    foodIcon:    'assets/images/resources/food_32.png',
    powerIcon:   'assets/images/resources/power_32.png',
    gemsIcon:    'assets/images/resources/gems_32.png',
    hammersIcon: 'assets/images/resources/hammers_32.png',
    scrollsIcon: 'assets/images/resources/scrolls_32.png',
    // أدوات المخزون
    itemBandage:        'assets/images/items/bandage.svg',
    itemHealPotion:     'assets/images/items/heal_potion.png',
    itemFireSword:      'assets/images/items/fire_sword.png',
    itemDesertShield:   'assets/images/items/desert_shield.png',
    itemPowerHelmet:    'assets/images/items/power_helmet.png',
    itemXpScroll:       'assets/images/items/xp_scroll.png',
    itemPowerGem:       'assets/images/items/power_gem.png',
    itemArenaTicket:    'assets/images/items/arena_ticket.svg',
    itemTowerBlueprint: 'assets/images/items/tower_blueprint.svg',
    itemIronSword:      'assets/images/items/sword_iron_96.png',
    itemDesertScimitar: 'assets/images/items/desert_scimitar.jpg',
    // موارد الصحراء
    resourceWater:   'assets/images/resources/water_32.svg',
    resourceSalt:    'assets/images/resources/salt_32.svg',
    resourceLeather: 'assets/images/resources/leather_32.svg',
    resourceCopper:  'assets/images/resources/copper_32.svg',
    resourceHerbs:   'assets/images/resources/herbs_32.svg',
  },

  /** جلب رابط الصورة النهائي: الأولوية للرابط السحابي */
  src(key) {
    const url = IMG[key];
    if (url) return url;
    return this._local[key] || ('assets/images/' + key + '.png');
  },

  /** هل يوجد رابط سحابي لهذه الصورة؟ */
  hasCloud(key) {
    return !!IMG[key];
  },

  /** إنشاء Image وتحميله من الرابط المناسب */
  createImg(key) {
    const img = new Image();
    img.src = this.src(key);
    return img;
  },

  /**
   * ضبط خلفية CSS لعنصر: يستخدم الرابط السحابي إذا موجود
   * مثال: ImageResolver.applyBg(document.getElementById('hero'), 'bgVillage')
   */
  applyBg(el, key) {
    if (!el) return;
    const url = IMG[key];
    if (url) {
      el.style.backgroundImage = `url('${url}')`;
    } else {
      const local = this._local[key];
      if (local) {
        el.style.backgroundImage = `url('${local}')`;
      }
    }
  }
};
