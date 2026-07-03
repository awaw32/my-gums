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

### الملفات المعدلة في هذه الجلسة:
- `js/ui/ui-promotion.js` — إزالة army-yard-page, إضافة overlay, ربط الأزرار
- `js/ui/ui-core.js` — إزالة `bindPromoBackButtons()` من init
- `js/ui/ui-gameplay.js` — تغيير صيغة رقم الإصدار
- `lands.html` — إضافة ☰, قائمة منسدلة, contain للبيوت, CSS

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

---

## خطة التالي

> **التركيز الحالي**: تحسين الواجهات + إصلاح المشاكل الحالية

1. ✅ إصلاح ساحة الجيش (شاشة كاملة + سحب)
2. ✅ إصلاح الأراضي (قائمة منسدلة + تثبيت البيوت)
3. ✅ ملف MEMORY.md
4. ⬜ اختبار Playwright على هاتف iPhone
5. ⬜ تحسين تصميم باقي الواجهات

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
