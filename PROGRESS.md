# ملك الصحراء — سجل التقدم

## الإنجازات

### ✅ شاشة الأراضي الجديدة — "ملك البحار"
- **دمجت** كشاشة "أراضي" في اللعبة (كانت سابقاً شاشة الواحات القديمة)
- خريطة قرية كاملة بخلفية صحراوية مع طبقة vignette
- شريط موارد علوي: كبسولات عائمة (طاقة ⚡, ذهب 🪙, قوة ✊) — كل نقرة تزيد المورد
- شريط تقدم المباني يحسب عدد المباني المبنية
- 6 مباني بثلاث حالات: فارغ → قيد الإنشاء → مبني
- عند الضغط على مبنى مبني → يفتح مودال ترقية بصورته ومستواه وتكلفة الترقية
- شريط سفلي: 5 أزرار (المرتبة 🔒, الترقية 🔒, أراضي 🗺️ نشط, حرب 🔒, التحالف 🔒)
- Toast إشعارات يظهر 1.6 ثانية
- RTL, موبايل أولاً, بدون مكتبات خارجية

### ✅ نظام الصور السحابية — ImageResolver
- ملف `config/images.js` — كل روابط الصور في مكان واحد
- `IMG` object: ضع رابط السحابة أو اتركه `null` للرجوع للملف المحلي
- `ImageResolver.src(key)`: يرجع رابط السحابة أو المسار المحلي
- `ImageResolver.applyBg(el, key)`: يضبط خلفية CSS من الرابط السحابي
- يدعم: خلفيات, مباني, جيش (قائد/جندي/عدو), وحوش, صور الأراضي

### ✅ صور الجيش والوحوش
- مجلدات: `assets/images/army/`, `assets/images/monsters/`, `assets/images/buildings/`
- army: leader-player, avatar-player, soldier-player, leader-enemy, soldier-enemy, bandit-br
- monsters: monster-1-wolf, monster-2-shadow, monster-3-chief
- أكواد الرسم محدثة في `world.js` — تستخدم `_drawSprite()`:
  - إذا الصورة محملة → ترسمها
  - إذا لا → ترسم الدائرة القديمة (fallback)

### ✅ إصلاحات سابقة
- صور المباني: أسماء مكررة (`building-ruins.png.png`) تم تصحيحها
- إخفاء الإيموجي خلف `background-image` باستخدام `color: transparent`
- بانل اللاعبين: يظهر فوراً عند دخول الخريطة (حتى بدون WebSocket)
- أزرار الخريطة: زر الشات نُقل للجهة اليسرى تحت زر الخروج
- حساب القوة: 5 مصادر (قرية, جيش, مستوى, تحالف, prestige) — يعمل

## الملفات المعدلة / المضافة

| الملف | التغيير |
|-------|---------|
| `config/images.js` | **جديد** — مركز روابط الصور + ImageResolver |
| `js/ui.js` | استبدال `buildTerritoriesScreen` + `renderTerritories` بصفحة الأراضي الجديدة |
| `css/style.css` | إضافة ~250 سطر CSS للأراضي (lands-*) |
| `js/world.js` | تحديث `_preloadImages` + تحميل الخريطة لاستخدام ImageResolver |
| `index.html` | إضافة `<script src="config/images.js">` قبل main.js |

## كيفية إضافة رابط سحابي لصورة

1. ارفع الصورة إلى استضافتك السحابية
2. افتح `config/images.js`
3. ابحث عن المفتاح المناسب (مثلاً `leaderPlayer`, `bgVillage`, `monster1`)
4. ضع الرابط: `leaderPlayer: 'https://example.com/leader.png'`
5. اللعبة تستخدم الرابط تلقائياً — لو حذفته ترجع للملف المحلي

مثال:
```js
const IMG = {
  bgVillage: 'https://myhost.com/bg-village.jpg',
  leaderPlayer: 'https://myhost.com/leader-player.png',
  // الباقي null → assets/images/army/leader-player.png
};
```

## صفحة الأراضي — أسماء المباني وإحداثياتها

| المبنى | id | x% | y% |
|--------|-----|---|---|
| الميناء | b1 | 72 | 38 |
| سوق السمك | b2 | 25 | 55 |
| مستودع البضائع | b3 | 78 | 70 |
| قلعة الحراسة | b4 | 20 | 28 |
| المنارة | b5 | 50 | 18 |
| ساحة التدريب | b6 | 45 | 82 |
