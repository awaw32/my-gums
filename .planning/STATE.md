# State — My Gums

## Current Phase
إصلاحات وتحسينات متعددة (2026-07-02)

## Completed Fixes
- `economy.power` كان دائماً 0 → أضيفت 5 powerSources في main.js (village, army, level, alliance, prestige)
- `army.totalArmyPower is not a function` → getter وليس دالة، أصلح الوصول
- Monsters: الآن server-authoritative مع حركة دورية خفيفة، broadcast كل 1 ثانية
- Online Players Panel: يظهر اللاعب نفسه + القوة + القتلى + الأرباح
- Wipe Screen: أوفرلاي يُظهر المبلغ المفقود + خصم XP
- Achievements: زر استلام (claim) لكل إنجاز مكتمل، متوافق مع اللمس
- Chat Button: يمين 60px (لا يتداخل مع زر الخروج)
- ارتباط achievements.updateProgress بالأحداث (kills, pvp_wins, cash_earned, player_level)

## Open Issues
- Buildings/oases resource cost not fully wired to achievements (builds, upgrades, oases)
- Daily streak achievements need login_day tracking
- Prestige achievements need prestige._onPrestige wiring

## Architecture
- عالم 2400×2400
- WebSocket (100ms update) + HTTP save (5s) + autosave (15s)
- MongoDB عبر mongoose (collection: players_data)
- Server-authoritative monsters (positions broadcast every 1s)
- PvP عبر WS مع combat cooldown 3s
- Battle Royace كطبقة فوقية (campaign mode أساسي)

## Key Files
- `js/world.js` — WebSocket, monsters, PvP, HUD, BR, player sync
- `js/main.js` — init, powerSources, callbacks, save
- `js/ui.js` — screens, player panel, achievements, crafting
- `server.js` — WS server, monster AI, broadcast, MongoDB
- `js/economy.js` — power getter, resources, level
- `js/achievements.js` — 50 achievements with claim system
- `js/oasis-manager.js` — 5 oases, gold payout every 15s
- `css/style.css` — mobile-first RTL
