# STATE — ملك الصحراء (Desert Kingdom)

**Updated:** 2026-07-10
**Branch:** main · HEAD: `3735116`

---

## Project Identity
- **Name:** ملك الصحراء / Desert Kingdom
- **Type:** Multiplayer Strategy PWA (Isometric 2.5D)
- **Stack:** Vanilla HTML/CSS/JS + Canvas + WebSocket
- **Server:** Node.js custom HTTP + WebSocket (port 3000)
- **DB:** SQLite + MongoDB (optional) + localStorage (backup)
- **Character Controller:** Phaser 3 (isometric 8-dir)

---

## Session: نظام الحرب القبلي (War System) — COMPLETED ✅

### Architecture
- **الخادم:** `server/logic/warManager.js` — محرك الحرب القبلي
  - `createWarRecord()` — إنشاء سجل حرب جديد
  - `declareWar()` — إعلان الغزوة بين قبيلتين (مع تحقق التبريد والتكرار)
  - `deployArmy()` — إرسال الجيوش للحرب القبلية
  - `resolveBattle()` — حل المعارك الفردية مع ±15% تباين عشوائي ونظام غنائم
  - `endWar()` — إنهاء الحرب وتحديد الفائز بناءً على النقاط
  - `getRankings()` — الترتيب القبلي (بالانتصارات ثم الغنائم)
  - `handleMessage()` — معالجة رسائل WebSocket (war_declare/war_deploy/war_resolve_battle/war_end/war_get_*)
  - `warTickInterval` — إنهاء الحروب المنتهية الصلاحية تلقائياً
  - المتغيرات: WAR_DURATION_MS=30min, WAR_COOLDOWN_MS=10min, LOOT_CAP_RATIO=12%

- **الربط بالخادم:**
  - `server.js` — تم استيراد `createWarManager` وإنشاء `warManager` وتمريره لـ `createWorldHandler`
  - `server/network/worldHandler.js` — تمت إضافة معالج رسائل `war_*` يمررها لـ `warManager.handleMessage()`

- **العميل:** `js/war-manager.js` — `WarManager` class
  - `declareWar()` — إرسال إعلان الحرب عبر WebSocket
  - `deployArmy()` — إرسال الجيش لحرب نشطة
  - `resolveBattle()` — حل معركة فردية
  - `requestActiveWars/History/Rankings()` — استعلام الحالات
  - `attachToWorld(world)` — ربط الـ callbacks (`_onWarEvent`, `_onWarResponse`)
  - `tick(dt)` — تحديث دوري

- **الشبكة:** `js/network-sync.js` — تمت إضافة 4 حالات جديدة في `_handleMessage`:
  - `war_declared`, `war_battle_result`, `war_ended`, `war_response`

- **الربط بالعميل:** `js/main.js`
  - استيراد `WarManager` وإنشاء `warManager` بعد `allianceManager`
  - `warManager.attachToWorld(world)` — ربط بـ `worldMap`
  - `warManager` ممرر إلى `GameUI` constructor
  - `warManager.tick(dt)` في الـ game loop

- **الواجهة:** `js/ui/ui-gameplay.js`
  - `buildWarScreen()` — تمت إضافة قسم `<div id="war-tribal-content">`
  - `renderWar()` — تمت إضافة استدعاء `_renderTribalWarSection()`
  - `_renderTribalWarSection()` — عرض: حالة التحالف، الحروب الجارية، إعلان الحرب، الترتيب القبلي
  - `_showWarDeclareModal()` — modal لإعلان الغزوة (اسم القبيلة + تقدير القوة)
  - أزرار: إرسال الجيش للحروب الجارية، إعلان حرب جديدة

- **الـ CSS:** `css/style.css` — تمت إضافة 60+ سطر لأنماط:
  - `.war-tribal-section`, `.tribal-war-status`, `.tribal-war-card`, `.tribal-war-list`
  - `.war-attacker` (أحمر), `.war-defender` (أخضر), `.war-observer` (رمادي)
  - `.tribal-rankings`, `.tribal-ranking-row`, زر `tribal-war-declare-btn`

- **Service Worker:** `sw.js` — تمت إضافة `/js/war-manager.js` للـ cache

- **الاختبارات:** `tests/war-system.test.js` — 13 اختبار جديد
  - إعلان الحرب (نجاح/رفض نفس القبيلة/رفض تكرار/رفض أثناء التبريد)
  - حل المعارك (تحديد فائز/غنائم/رفض حرب غير موجودة)
  - إنهاء الحرب (فائز/تعادل)
  - الترتيب القبلي (تحديث/ترتيب حسب الغنائم)
  - الحروب النشطة + السجل

---

## Session: تحسين واجهة الحلف الجماعي (Alliance Tribal UI) — COMPLETED ✅

### التغييرات

- **`js/ui/ui-core.js`**
  - `renderAlliance()` — إضافة `<div id="alliance-tribal-content">` بعد بطاقة التحالف الأساسية
  - استدعاء `this._renderTribalAllianceSection()` بعد `const am = this.allianceManager;` وقبل سحب `getState()`

- **`js/ui/ui-gameplay.js`** — إضافة `GameUI.prototype._renderTribalAllianceSection`
  - تعرض: شعار القبيلة (الاسم + الرمز)، شريط معلومات (عدد الأعضاء، قوة القبيلة، الخزينة)
  - شريط تقدم الخزينة + حقل إدخال المساهمة + زر المساهمة
  - زر ترقية القبيلة من الخزينة (للشيخ فقط)
  - قائمة الأعضاء مع: أيقونة الرتبة، الاسم، الرتبة، المساهمة، القوة
  - أزرار ترقية/تنزيل الأعضاء (للشيخ فقط — تظهر لكل عضو غير نفسه)
  - ربط جميع الأزرار عبر `addEventListener` مع استدعاء `this.requestRender("alliance")` بعد كل عملية
  - إذا لم يكن للاعب قبيلة (`!am.tribeName`) يخفي الـ container

- **`css/style.css`** — إضافة 70+ سطر لأنماط القبيلة الجماعية:
  - `.tribal-alliance-header` — رأس القبيلة (خلفية متدرجة ذهبية)
  - `.tribal-alliance-info` — شريط المعلومات (3 أعمدة)
  - `.tribal-treasury-box` — صندوق الخزينة (شريط تقدم + إدخال المبلغ)
  - `.tribal-member-row` — صف العضو (أيقونة، اسم، رتبة، مساهمة، قوة)
  - `.tribal-promote-btn` / `.tribal-demote-btn` — أزرار الترقية والتنزيل (أخضر/أحمر عند التحويم)

### Tests: 227/227 passing

---

## Previous Session Fixes (موجود في الإصدار السابق)
- XSS in chat + player list (innerHTML→textContent)
- Global ESC key handler
- PvE death screen (CSS classes)
- Z-index fixes
- Boss name mismatches
- Achievement cap (15→25)
- Missing SVG built states (4)
- Death sound (sfxDeath)
- Epilogue (Chapter 6)

---

## GSD Memory System Files
- `.ai_context.json` — ملف السياق التلقائي (القواعد الثابتة + الأنظمة + قائمة المهام)
- `.planning/STATE.md` — هذا الملف
- `.planning/PROJECT.md` — نظرة عامة
- `.planning/graphs/graph.json` — الـ knowledge graph
- `.planning/config.json` — إعدادات

---

## الخطوة القادمة
1. **اختبار Playwright عبر iPhone** — التحقق من استجابة الواجهة الجديدة على الشاشات الصغيرة
2. نظام إشعارات عام
3. آليات زعماء متقدمة (Epic Bosses)
4. مراجعة الذاكرة والأداء