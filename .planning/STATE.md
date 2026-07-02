# State — My Gums

## Current Phase
إصلاحات وتحسينات متعددة (2026-07-02)

## Completed Fixes (Batch 1)
- `economy.power` كان دائماً 0 → أضيفت 5 powerSources في main.js
- `army.totalArmyPower is not a function` → getter وليس دالة
- Monsters: server-authoritative مع حركة دورية broadcast كل 1 ثانية
- Online Players Panel: يظهر اللاعب نفسه + القوة + القتلى + الأرباح
- Wipe Screen: أوفرلاي يُظهر المبلغ المفقود + خصم XP
- Achievements: زر استلام (claim) لكل إنجاز
- Chat Button: يمين 60px (لا يتداخل مع زر الخروج)
- `recenterCamera` الدالة المفقودة في world.js
- PvP التاب المزدوج
- مزامنة الوحوش مع السيرفر

## Completed Fixes (Batch 2 — اليوم)
### التوصيلات (Wiring)
- **login_days**: إصلاح مسار الإنجاز — `_onClaim` لم يكن يستدعي `updateProgress` بسبب override
- **upgrade_damage/defense/capacity/speed**: ربط إنجازات شجرة الترقيات (كانت غير مربوطة نهائياً)
- **power achievement**: إصلاح التتبع — `lastPowerCheck` يبدأ من `economy.power` الحالي لا 0
- **_onPvPWin/_onPvPLose**: ربط الاستدعاءات في `world.attackPlayer` (كانت غير مربوطة)
- **cash_earned**: إضافة `_onCashEarned` إلى `economy.add()` + ربط من دخل المباني السلبي
- **duplicate _onLevelUp**: دمج الاستدعائين المتكررين
- **double cash_earned**: إزالة `+10` من كل kill (يتم التتبع عبر `_onCashEarned(reward)` مسبقاً)
- **Building callbacks**: جعل `setBuildingCallbacks` يحفظ الـ callbacks ويعيد ربطها بعد `initVillage` (مهم لـ Prestige)

### آليات جديدة (Mechanics)
- **استهلاك الطعام**: كل 15 ثانية يستهلك الجيش 0.5 طعام لكل جندي حيّ — إذا نفد الطعام يخسر الجيش 2 HP والزعيم 1 HP
- **استخدام items**: زر "▶ استخدم" في شاشة المخزون — جرعات، سيوف، دروع، خوذ، جواهر، لفائف خبرة، تذاكر ساحة، مخططات أبراج
- **بونص XP من Prestige**: كل مستوى Prestige يعطي +50% XP (`xpMult = 1 + level * 0.5`)
- **مضاعفات الأحداث**: ربط `events.getMult()` بـ — `mult_xp` في addXp, `mult_gold` في addRaw, `mult_power` في power getter, `mult_pvp` في PvP, `mult_oasis` في oasisManager.tick
- **حفظ BR stats**: `brWins` و `brKills` محفوظان في saveToDB الآن
- **تجديد الجيش التلقائي**: 0.2 HP/ث للوحدات و 0.1 HP/ث للزعيم إذا لم يكونوا في قتال
- **جوهرة القوة (power_gem)**: ×2 كل العملات لمدة 5 دقائق عبر `economy.multiplier`

### إصلاحات أخرى
- **BR exit**: إعادة W/H من 2000 إلى 2400 عند الخروج من BR

## Open Issues
- Village 2 (buildings v2) غير متاح — لا توجد طريقة للتبديل بين القريتين
- Arena (غرفة المعركة القديمة server.js) كود قديم غير مستخدم
- Campaign/Adventure/Arena في شاشة الحرب كلها تؤدي لنفس الشيء
- Leaderboard يدعم sort=power فقط — ويحتاج فلترة إضافية

## Architecture
- عالم 2400×2400 (يصير 2000×2000 في BR)
- WebSocket (100ms update) + HTTP save (5s) + autosave (15s)
- MongoDB عبر mongoose (collection: players_data)
- Server-authoritative monsters (positions broadcast every 1s)
- PvP عبر WS مع combat cooldown 3s
- Battle Royale كطبقة فوقية (campaign mode أساسي)
- Power من 5 مصادر: village, army, level, alliance, prestige
- Prestige: 5 مستويات — كل مستوى ×1.5 ضرر + ×0.5 XP, يعيد تعيين الكل

## Key Files
- `js/world.js` — WebSocket, monsters, PvP, HUD, BR, player sync, items use
- `js/main.js` — init, powerSources, callbacks (كل التوصيلات), save (يشمل BR stats)
- `js/ui.js` — screens, player panel, achievements, crafting, items usage UI, events display
- `server.js` — WS server, monster AI, broadcast, MongoDB + Arena (legacy)
- `js/economy.js` — power getter (مع مضاعف الأحداث), resources, level, _events, _prestige
- `js/achievements.js` — 50 achievements with claim system
- `js/oasis-manager.js` — 5 oases, gold payout (مع مضاعف oasis event)
- `js/upgrade-tree.js` — 4 مسارات ترقية (damage, defense, capacity, speed)
- `js/prestige.js` — Prestige system مع xpMult
- `js/inventory.js` — 8 وصفات تصنيع + item effects system
- `js/events.js` — 6 أحداث (gold rush, xp boost, power week, PvP tourney, oasis bonus, camel race)
- `js/daily-login.js` — 7 أيام Streak
- `js/tutorial.js` — 7 خطوات تعليمية
- `js/village.js` — مبنيان (v1 + v2) — v2 غير متاح بعد
- `js/alliance-manager.js` — 4 تحالفات
- `css/style.css` — mobile-first RTL
