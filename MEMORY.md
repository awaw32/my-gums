# MEMORY — مشروع ملك الصحراء (Desert Kingdom)

> ⚠️ **يجب قراءة هذا الملف في كل طلب** — يحتوي على حالة المشروع الكاملة
> READ THIS FILE ON EVERY REQUEST — full project state

---

## المشروع
- **اللعبة**: ملك الصحراء — RTS عربية (هاتف أولاً، iPhone + iPad + Desktop)
- **الرابط**: http://nhz048poav0wwcuuyu192uqs.72.62.59.227.sslip.io
- **الgit**: https://github.com/awaw32/my-gums.git
- **النظام الأساسي**: PWA — HTML/CSS/JS خالص، خادم Node.js (Express), MongoDB (اختياري)
- **الاتجاه**: RTL (من اليمين لليسار) — اللغة العربية

---

## آخر جلسة — السبت 4 يوليو 2026

### الحالة: تم إنجاز التالي

1. **ساحة الجيش → شاشة كاملة منبثقة** ✅
   - أزيلت `army-yard-page` من `buildPromotionScreen()` في `js/ui/ui-promotion.js`
   - أضيفت `_openArmyYard()` — تصنع overlay مثل مكتبة الأسلحة بالضبط
   - الـ X يرجع لصفحة التطوير الرئيسية
   - الزر في الـ hub grid: `c.id === 'army-yard'` → `this._openArmyYard()`

2. **أزرار X مربوطة بعد ما DOM يتضاف** ✅
   - `_bindCloseButtons()` تُنادى في `renderPromotion()` (بعدما تكون العناصر موجودة)
   - أزيل `bindPromoBackButtons()` من `init()` في `js/ui/ui-core.js`
   - الـ X يشتغل الآن ويختفي header "🏪 مركز التطوير" لما تكون sub-page مفتوحة

3. **القائمة المنسدلة في الأراضي (☰)** ✅
   - زر ☰ مضاف في HUD الأراضي (`lands.html`)
   - `#lands-quick-panel` خارج `game-shell` (عشان iOS ما يقطعه)
   - الأزرار: كتم صوت، تكبير شاشة، إنجازات، يوميات
   - القائمة `position: fixed; z-index: 9999` — ما تأثر على البيوت

4. **تثبيت البيوت في الأراضي** ✅
   - `game-shell` مضاف `contain: layout style`
   - `buildings-layer` مضاف `contain: layout style`
   - البيوت `position: absolute; inset: 0` داخل `game-shell` ثابت

5. **رقم الإصدار** ✅
   - في `renderRanking()` — يقرأ `version_num` من `localStorage` ويزيد مع كل build جديد
   - يعرض: `الإصدار رقم 1` بدل `🛠 v123456789`

6. **السحب للأسفل في ساحة الجيش** ✅
   - أضيف `-webkit-overflow-scrolling: touch; overscroll-behavior: contain; touch-action: pan-y`
   - `max-height: 88vh` + `overflow-y: auto`

7. **تدقيق كود شامل + 17 إصلاحاً** ✅ (جلسة 4 يوليو 2026 — الثانية)
   - راجعنا كل ملفات الـ JS + HTML + CSS ووجدنا 30+ مشكلة
   - صنّفناها: أخطاء حرجة، متوسطة، بسيطة، وميزات غير مكتملة
   - أصلحنا 17 مشكلة (انظر أدناه)

### الإصلاحات في هذه الجلسة:

| # | الملف | المشكلة | الإصلاح |
|---|-------|---------|---------|
| 1 | `index.html` | سكربت خلفية `#fullscreen-bg` يعمل قبل تحميل `config/images.js` | نُقل السكربت إلى بعد سطر تحميل `config/images.js` |
| 2 | `index.html` | `window.location.reload(true)` مهمل | `reload()` |
| 3 | `index.html` | `<link rel="icon">` داخل `<body>` | نُقل إلى `<head>` |
| 4 | `index.html` | `addEventListener('fullscreenchange webkitfullscreenchange', ...)` — مسافة بين حدثين | فُصل إلى حدثين: `fullscreenchange` و `webkitfullscreenchange` |
| 5 | `js/world.js:605` | `window.ImageResolver` غير معرّف (`const` لا ينشئ خاصية `window`) | `typeof ImageResolver !== 'undefined'` |
| 6 | `config/images.js:136` | `applyBg()` لا يستخدم المسار المحلي كبديل عند عدم وجود رابط سحابي | أُضيف `else` branch مع `this._local[key]` |
| 7 | `js/save.js:38-41` | فحص falsy (`if (data.level)`) يفشل مع القيم الصفرية | `!== undefined` |
| 8 | `js/save.js:64-67` | فحص falsy لمستويات المباني وأوقات البناء | `??` بدلاً من `||` |
| 9 | `js/hero.js:133-137` | فحص falsy لـ HP (`data.hp || this.maxHp`) — إذا HP=0 يعيد لأقصى حد | `data.hp !== undefined ? data.hp : this.maxHp` |
| 10 | `js/upgrade-tree.js:132` | `getEffect()` غير تراكمي في أقصى مستوى (يرجع آخر تأثير فقط) | حلقة `for` تراكمية لكل المستويات |
| 11 | `js/main.js` | ترتيب تحميل خاطئ: `loadFromDatabase` (API) ثم `loadGame` (localStorage) يلغي بيانات السيرفر | عكس الترتيب: localStorage أولاً للسرعة، ثم API رسمياً |
| 12 | `lands.html:633` | `document.getElementById('mapBg')` — العنصر ليس له ID | أُضيف `id="mapBg"` إلى `<div class="map-bg">` |
| 13 | `lands.html:658` | زر الإنجازات يفتح شاشة المهام اليومية | أُنشئت `showAchievements()` جديدة وربطها بالزر |
| 14 | `lands.html:345` | `<img src="">` فارغ يسبب طلب HTTP غير ضروري | أُزيل `src=""` |
| 15 | `js/inventory.js:63` | `craft()` لا يرجع المصروفات إذا فشل العنصر التالي | فحص `canAfford` للكل أولاً، ثم `spend` للكل |
| 16 | `js/quests.js:150` | مكافأة `armyPower` من المهام تضيع بعد إعادة التحميل | حفظ `unitPowerBonus` في `desert_quests` + `saveGame` |
| 17 | `js/ui/ui-core.js:1067` | تسرب الفواصل الزمنية (`setInterval`) إذا أُعيد استدعاء `startTopBarLoop` | تنظيف الفواصل القديمة قبل إنشاء جديدة |

### الميزات المُكملة:
- **صفحة الإنجازات في الأراضي**: أُنشئت `showAchievements()` بقائمة إنجازات محلية
- **ImageResolver**: سكربت الخلفية يعمل الآن بشكل صحيح بعد تحميل `config/images.js`
- **`applyBg()`**: صار يستخدم المسار المحلي كبديل عند عدم وجود رابط سحابي

### الملفات المعدلة في هذه الجلسة:
- `js/ui/ui-promotion.js` — إزالة army-yard-page, إضافة overlay, ربط الأزرار
- `js/ui/ui-core.js` — إزالة `bindPromoBackButtons()` من init، إضافة تنظيف الفواصل الزمنية
- `js/ui/ui-gameplay.js` — تغيير صيغة رقم الإصدار
- `lands.html` — إضافة ☰, قائمة منسدلة, contain للبيوت, CSS, showAchievements, إصلاح mapBg, إصلاح src فارغ
- `index.html` — إصلاحات متعددة (خلفية، fullscreen، favicon، reload)
- `config/images.js` — إصلاح `applyBg()` لاستخدام المسار البديل
- `js/world.js` — إصلاح `window.ImageResolver`
- `js/save.js` — إصلاح فحوصات falsy، إضافة unitPowerBase
- `js/hero.js` — إصلاح فحوصات falsy
- `js/upgrade-tree.js` — إصلاح `getEffect()` التراكمي
- `js/inventory.js` — إصلاح `craft()` مع `canAfford` أولاً
- `js/quests.js` — إضافة حفظ/تحميل `unitPowerBonus`
- `js/main.js` — عكس ترتيب تحميل API/localStorage

---

## هيكل اللعبة الأساسي

### الصفحات
| ملف | وظيفة |
|------|--------|
| `index.html` | اللعبة الرئيسية SPA |
| `lands.html` | صفحة الأراضي (قرى منفصلة) |

### JS الأساسي
| ملف | وظيفة |
|------|--------|
| `js/main.js` | نقطة الدخول — تهيئة GameUI |
| `js/ui/ui-core.js` | GameUI class — init, screens, topBar, nav |
| `js/ui/ui-promotion.js` | شاشة التطوير — hub, army-yard, weapons, knowledge, rewards |
| `js/ui/ui-gameplay.js` | شاشات القتال، التصنيف، الأراضي |
| `js/economy.js` | نظام الاقتصاد (ذهب 💵 نقد 🪙 جواهر 💎) |
| `js/army.js` | الجيش والأسلحة |
| `js/audio.js` | نظام الصوت (لا يوجد ملفات صوتية فعلية بعد) |
| `js/save.js` | حفظ وتحميل اللعبة |

### نظام العملات
| العملة | الرمز | الاستخدام |
|--------|-------|-----------|
| 💵 نقد | cash | ترقية الجنود |
| 🪙 ذهب | gold | ترقية التدريب |
| 💎 جواهر | gems | ترقية الأسلحة |
| 🌾 طعام | food | موارد الأراضي |
| 👊 قوة | power | موارد الأراضي |

---

## القرارات الهامة

1. **Auto-deploy**: push إلى GitHub → سحب تلقائي + إعادة تشغيل → `BUILD_ID` جديد
2. **Auto-update**: `/version` → `ETag` + `If-None-Match` → 304 → `buildId` يتغير
3. **الصور**: `ImageResolver` في `config/images.js` — كل URLs = null → مجلد `assets/images/`
4. **MongoDB**: غير متصل (السيرفر ما عنده MongoDB) — `MONGO_URL` = غير معرّف
5. **iOS Safari**: `overflow: hidden` + `position: fixed` داخل `position: relative` يسبب مشاكل — نحرك العناصر الثابتة برا `game-shell`

---

## المشاكل المعروفة (ما زالت موجودة)

1. **التحكم الذهبي** — الـ "جوي" بالخف ~ تدوير سريع للموارد (للتنمية فقط، مش كل اللاعبين)
2. **اللوبي / عالم مفتوح** — مطلوب خريطة أكبر
3. **إشعارات عامة** — لما لاعب يشتري سلاح، يظهر خبر
4. **شاشة الموت** — يظهر لما تخسر كل قوتك (~ تصميم سحابي)
5. **Alliances** — تحت 🔒
6. **الحرب** — تحت 🔒
7. **المتجر** — تحت 🔒
8. **صوت** — `audio.js` موجود بس ما فيه ملفات صوتية فعلية
9. **التحدي اليومي** — الـ qu والـ challenges قديمين (انشاؤوا بس قبل نظام ruby)
10. **حفظ اللعبة** — لا يزال هناك تناقض بين localStorage و API (الـ saveToDB() كل 15 ثانية يضغط على السيرفر)
11. **PvP pursuit** — المسار لا يُعاد حسابه أثناء مطاردة لاعب آخر (خطة لم تكتمل)
12. **`economy.refreshIncome()`** — دالة غير مستخدمة (قد تحتاج ربط في المستقبل)

---

## خطة التالي

> **التركيز الحالي**: تحسين الواجهات + إصلاح المشاكل الحالية

1. ✅ إصلاح ساحة الجيش (شاشة كاملة + سحب)
2. ✅ إصلاح الأراضي (قائمة منسدلة + تثبيت البيوت)
3. ✅ ملف MEMORY.md
4. ✅ تدقيق كود شامل + 17 إصلاحاً تقنياً
5. ⬜ اختبار Playwright على هاتف iPhone
6. ⬜ تحسين تصميم باقي الواجهات
7. ⬜ ملفات صوتية فعلية لـ `audio.js`
8. ⬜ تحسين `saveToDB()` — تقليل استدعاءات POST (حفظ كل 60 ثانية بدلاً من 15)

---

## طريقة إعادة التشغيل (Restart)

إذا انتهى التوكن أو حصل cut-off:
1. اقرأ `MEMORY.md` هذا
2. راجع `git log --oneline -5` لآخر التغييرات
3. شوف `npm test` للتأكد من كلشي تمام
4. تحقق من حالة التعديلات في `git diff --stat`
5. اقرأ الملفات المذكورة في "آخر جلسة"
6. أكمل من "خطة التالي"

## ملاحظات التصميم (Desert Theme)

- الألوان: بني غامق `#0d0a05`، ذهبي `#ffd700` / `#ffe8c2`، أحمر `#d43f3f` / `#ff6b6b`
- الخلفيات: تدرجات بنية `linear-gradient(to bottom, #1a0f08, #2c1a0a)`
- الأزرار: ذهبية `#f1b34a` أو حمراء `var(--accent-red)`
- الخط: Cairo, system-ui, Tahoma (عربي)
- الهيكل: `game-shell` بعرض 430px max — موسّط على ويب، كامل على جوال
- الـ `<meta viewport>` = `width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no`
- المسافة العلوية: `env(safe-area-inset-top)` للـ notch في iPhone
- الزر "رجوع": استخدام ✕ بدل "→ رجوع"
- التكبير: `requestFullscreen` مع try-catch لـ iOS
