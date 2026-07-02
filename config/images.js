// =============================================================================
// config/images.js  —  مركز روابط صور اللعبة
// =============================================================================
// ارفع صورك إلى استضافتك السحابية وضع الرابط في الحقل المناسب.
// إذا تركت الحقل فارغ (null)، اللعبة تجلب الصورة من الملف المحلي تلقائياً.
// =============================================================================

const IMG = {

  // ==================== الخلفيات ====================
  bgVillage: null, // خلفية القرية — assets/images/bg-village.jpg
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
};

// =============================================================================
// ImageResolver — يجلب رابط الصورة: priority → URL سحابي > ملف محلي
// =============================================================================
const ImageResolver = {
  /** خريطة: مفتاح الصورة → المسار المحلي (إذا ما في رابط سحابي) */
  _local: {
    // خلفيات
    bgVillage: 'assets/images/bg-village.jpg',
    mapDesert: 'img/map.jpg',
    // مباني
    buildingRuins:        'assets/images/building-ruins.png',
    buildingConstruction: 'assets/images/building-construction.png',
    buildingComplete:     'assets/images/building-complete.png',
    // جيش
    leaderPlayer:  'assets/images/army/leader-player.png',
    avatarPlayer:  'assets/images/army/avatar-player.png',
    soldierPlayer: 'assets/images/army/soldier-player.png',
    leaderEnemy:   'assets/images/army/leader-enemy.png',
    soldierEnemy:  'assets/images/army/soldier-enemy.png',
    banditBr:      'assets/images/army/bandit-br.png',
    // وحوش
    monster1: 'assets/images/monsters/monster-1-wolf.png',
    monster2: 'assets/images/monsters/monster-2-shadow.png',
    monster3: 'assets/images/monsters/monster-3-chief.png',
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
    }
  }
};
