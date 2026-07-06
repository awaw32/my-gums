# UPDATES.md — سجل التحديثات البرمجية
# آخر تحديث: 2026-07-06

---

## ملخص الجلسة

تم إجراء فحص شامل للمشروع وإصلاحات جوهرية في الأنظمة المكررة والمعزولة والأخطاء، مع إضافة أنظمة جديدة وتحسينات كبيرة.

---

## 1. الأنظمة المحذوفة (مكررة/ميتة)

| الملف | السبب |
|-------|-------|
| `js/br-mode.js` | ملف ميت بالكامل — يعتمد على `window.__game`, `window.__hero`, `window.__world` غير موجودة، ويتصل بخادم `wss://desert-empire-br.up.railway.app` غير مرتبط بالمشروع. الـ BR موجود بالفعل في `js/world.js`. |
| `js/ui/world-upgrades.js` | معزول تماماً — `showBuildings()` و `showResearch()` لم يُستدعَيا من أي مكان. نظام ترقية الأسلحة نُقل إلى `ui-promotion.js`. |
| `js/ui/world-upgrades.js` من `sw.js` | تم إزالته من قائمة Service Worker. |
| `js/br-mode.js` من `sw.js` | تم إزالته من قائمة Service Worker. |

---

## 2. الأنظمة المضافة/المحسّنة

### أ. شجرة البحوث (جديد)
- **الملف الجديد:** `js/research-tree.js`
- **الوظيفة:** نظام بحوث كامل (عسكري + اقتصادي) متزامن مع `server/db/research.js`
- **المهارات:** درع الصحراء، تكتيك الملاحقة، الفراسة، التجارة
- **التكامل:** أضيف تبويب "شجرة البحوث" في صفحة المعرفة مع تبويبات للتبديل بين شجرة الترقيات وشجرة البحوث
- **الربط:** تأثيرات البحوث تُطبق على الاقتصاد (بونص الذهب، الدفاع، السرعة)

### ب. نظام قفل المباني (محسّن)
- **الملف:** `js/ui/ui-gameplay.js`
- **التغيير:** المباني تظهر كـ "مقفل" مع أيقونة 🔒 للاعب الجديد بدلاً من "فارغ"
- **السلوك:** عند الضغط على مبنى مقفل، تظهر نافذة المعركة (مقاتلة الوحش + تكلفة البناء)
- **CSS:** أضيف `.lands-badge-locked` و `.lands-building-locked` في `style.css`

### ج. إصلاح Modal (z-index)
- **الملف:** `index.html` + `css/style.css`
- **المشكلة:** `#bottom-bar` (z-index: 999999) كان يحجب `#modal-overlay` (z-index: 200)
- **الحل:** رفع z-index المودال إلى 9999999 + إضافة CSS مخصص لـ `#modal-overlay` و `#modal-card`

### د. إصلاح serveStatic في السيرفر
- **الملف:** `server.js`
- **المشكلة:** المسار `/` مع query string كان يُرجع 404
- **الحل:** معالجة خاصة لـ `url === "/"` قبل فحص الامتداد

### هـ. إصلاح `showUpgradeModal`
- **الملف:** `js/ui/ui-gameplay.js`
- **المشكلة:** يستخدم `b.upgradeCost` و `b.baseProduction` غير موجودين في `VillageBuilding`
- **الحل:** استخدام `b.currentUpgradeCost` و `b.productionRate` (getters صحيحة)

### و. إصلاح `sanitizePlayerData`
- **الملف:** `server/validation/player.js`
- **المشكلة:** لا ترمي خطأ عند فشل التحقق — تُرجع البيانات الأصلية
- **الحل:** ترمي خطأ عند فشل Zod validation (يتوافق مع الاختبارات)

### ز. إضافة `WEAPON_DEFS` و `getWeaponDef`
- **الملف:** `js/combat/weapon-system.js`
- **المشكلة:** الاختبارات تستورد دوال غير موجودة
- **الحل:** إضافة `WEAPON_DEFS` (6 أسلحة) و `getWeaponDef()`

### ح. إصلاح خطأ إملائي في العنوان
- **الملف:** `index.html`
- **التغيير:** "ملك السحراء" → "ملك الصحراء"

---

## 3. ربط الأنظمة

### أ. ResearchTree بالاقتصاد
- `economy.researchGoldBonus` — بونص الذهب من البحوث
- `economy.researchDefenseBonus` — بونص الدفاع من البحوث
- `economy.knowledgeGoldBonus` — بونص الذهب من شجرة الترقيات (المعرفة)
- `economy.tradeIncomeBonus` — بونص الدخل من شجرة الترقيات (التجارة)

### ب. ResearchTree بالمباني
- `researchTree.palaceLevel` = مستوى b1 (بيت الزعيم/العرش)
- `researchTree.academyLevel` = مستوى b4 (ساحة التدريب/الأكاديمية)

### ج. حفظ/تحميل ResearchTree
- أضيف `researchTree` في `saveToDB()` و `loadFromDatabase()` في `main.js`
- أضيف `getSaveData()` و `loadState()` في `ResearchTree`

---

## 4. هيكل الأنظمة الحالي (بعد التنظيف)

### Client-Side (js/)
| الملف | الدور | الحالة |
|-------|-------|--------|
| `main.js` | نقطة الدخول، تهيئة كل الأنظمة | نشط |
| `ui/ui-core.js` | الواجهة الرئيسية | نشط |
| `ui/ui-promotion.js` | شاشة الترقية (جيش، أسلحة، معرفة+بحوث، مكافآت، متجر) | نشط |
| `ui/ui-gameplay.js` | شاشات الأراضي، الحرب، الترتيب | نشط |
| `ui/context-menu.js` | قوائم PvP | نشط |
| `world.js` | عالم اللعبة (Canvas، وحوش، PvP، BR) | نشط |
| `network-sync.js` | WebSocket | نشط |
| `economy.js` | الموارد، XP، المعرفة | نشط |
| `village.js` | قرى القصة والمباني | نشط |
| `story.js` | بيانات الفصول والقرى | بيانات |
| `story-manager.js` | منطق القصة | نشط |
| `army.js` | الجيش والأسلحة | نشط |
| `upgrade-tree.js` | شجرة الترقيات (جيش/معرفة/دفاع/تجارة) | نشط |
| `research-tree.js` | **جديد** شجرة البحوث | نشط |
| `alliance-manager.js` | التحالف والغارات | نشط |
| `hero.js` | البطل والقدرات | نشط |
| `quests.js` | المهام اليومية | نشط |
| `events.js` | الأحداث العالمية | نشط |
| `prestige.js` | إعادة الميلاد | نشط |
| `inventory.js` | المخزون والتصنيع | نشط |
| `achievements.js` | الإنجازات | نشط |
| `daily-login.js` | المكافآت اليومية | نشط |
| `oasis-manager.js` | الواحات | نشط |
| `tutorial.js` | الدليل التعليمي | نشط |
| `combat/weapon-system.js` | حساب ضرر الأسلحة | نشط |
| `combat/weapon-visuals.js` | رسم الأسلحة | نشط |
| `combat/combat-effects.js` | جسيمات PvP | نشط |
| `combat/troop-visuals.js` | تشكيلات الجنود | نشط |

### Server-Side (server/)
| الملف | الدور |
|-------|-------|
| `server.js` | خادم Express + WebSocket |
| `db/databaseHelper.js` | MongoDB + SQLite |
| `db/buildings.js` | تعريفات المباني |
| `db/research.js` | شجرة البحوث (الخادم) |
| `logic/weaponUpgrade.js` | ترقية الأسلحة (الخادم) |
| `logic/formulas.js` | صيغ القتال |
| `logic/combatLoop.js` | تيك الوحوش وPvP |
| `logic/rewards.js` | صندوق المكافآت |
| `validation/player.js` | تحقق Zod |
| `network/networkServer.js` | غرف اللعب |

---

## 5. حالة الاختبارات

- **15 ملف اختبار** — جميعها تمر
- **214 اختبار** — جميعها ناجحة
- **الاختبارات المُصلحة:** `combat.test.js` (إضافة WEAPON_DEFS)، `server-validation.test.js` (إصلاح sanitizePlayerData)

---

## 6. ما تبقى (للمستقبل)

1. **توحيد بيانات الأسلحة** بين `army.js` (6 أسلحة) و `server/db/databaseHelper.js` (4 أسلحة)
2. **ربط التحالف الحقيقي** — حالياً نظام فردي فقط
3. **تحسين انتقال القصة** — الانتقال التلقائي للفصل التالي بعد إكمال القرية
4. **إضافة اختبارات** لـ `research-tree.js` و `upgrade-tree.js`
5. **تحسين أداء الشبكة** — تقليل معدل إرسال `network-sync.js` من 200ms
6. **إصلاح `showUpgradeModal`** — لا يُستدعى حالياً لأن المباني تُدار عبر `_openLandsUpgradeModal`
7. **ربط `server/db/research.js`** بـ `js/research-tree.js` عبر WebSocket للتحقق من البحوث في الخادم

---

## 7. آلية دخول اللاعب الجديد

1. يدخل اللاعب → شاشة إدخال الاسم
2. يُمنح بونص ترحيبي (1000 من كل عملة)
3. تظهر القصة (الفصل 1 — واحة البداية)
4. بعد القصة، يظهر tutorial (7 خطوات)
5. الشاشة الرئيسية: "الأراضي" — 4 مباني مقفلة
6. اللاعب يضغط على مبنى → نافذة معركة → يقاتل الوحش → يُبنى المبنى
7. بعد بناء كل المباني → يمكن الانتقال للقرية التالية
8. صفحة "الترقية": جيش، أسلحة، معرفة+بحوث، مكافآت، متجر
9. صفحة "الحرب": واحة الغنائم (PvP)، مغامرة (PvE)، حملة (قصة)

---

## 8. تحذيرات معروفة

- `server/db/databaseHelper.js` يحتوي على `WEAPON_DEFS` بـ 4 أسلحة فقط (غير متزامن مع `army.js` بـ 6)
- `server/network/networkServer.js` + `server/systems/*` لا يستخدمها أي عميل حالي
- `save.js` يحفظ فقط localStorage — الحفظ الرئيسي عبر API في `main.js`
- `WorldUpgradesUI` حُذفت لكن API `/api/buildings` و `/api/research` لا يزال في السيرفر (غير ضار)

---

**الحالة:** المشروع يعمل بشكل كامل مع 214 اختبار ناجح. الأنظمة المكررة حُذفت والأنظمة الناقصة أُضيفت.
