---
phase: code-review
reviewed: 2026-07-13T00:00:00Z
depth: deep
files_reviewed: 54
files_reviewed_list:
  - js/main.js
  - js/world.js
  - js/ui/ui-core.js
  - js/ui/ui-gameplay.js
  - js/ui/ui-market.js
  - js/ui/ui-promotion.js
  - js/ui/context-menu.js
  - js/economy.js
  - js/village.js
  - js/save.js
  - js/network-sync.js
  - js/modes/extraction-mode.js
  - js/hero.js
  - js/notification-manager.js
  - js/asset-manager.js
  - server/routes/api.js
  - server/validation/player.js
  - server/config.js
  - server/network/auth.js
  - server/network/worldHandler.js
  - server/network/networkServer.js
  - server/network/rateLimiter.js
  - server/db/databaseHelper.js
  - index.html
  - css/style.css
findings:
  critical: 5
  high: 6
  medium: 8
  low: 4
  total: 23
status: issues_found
---

# Phase Code Review: Browser-Based Desert Kingdom Game

**Reviewed:** 2026-07-13
**Depth:** Deep
**Files Reviewed:** 54 source files
**Status:** issues_found

## Summary

This review audited the full client/server source tree after the recent BR extraction-zone work. The codebase is large and feature-rich, but several severe defects were found in the exact files flagged for special attention (`js/main.js`, `js/world.js`, `js/ui/ui-core.js`, `server/validation/player.js`, `server/routes/api.js`). The most serious issues are: plaintext password storage in `localStorage`, a startup crash in the server config, NaN corruption of the cash economy from offline rewards, a monster-update logic error that freezes the whole AI loop, and wide-open server validation that lets clients cheat arbitrary resources. Multiple XSS vectors via `innerHTML` and missing auth on a BR save call were also found.

## Critical Issues

### CR-01: Plaintext password stored in localStorage

**File:** `js/main.js:63`
**Issue:** After a successful login/registration, the user's password is written verbatim to `localStorage` under `player_password`. Anyone with access to the browser (or a malicious browser extension / XSS payload) can read it. This also defeats the purpose of server-side bcrypt hashing because the raw credential is trivially recoverable client-side.
**Fix:** Remove `localStorage.setItem(PASSWORD_STORAGE_KEY, password)`. Rely on the HTTP-only JWT token for session continuity. If "remember me" is required, store only a long-lived refresh token and regenerate the access token securely.

```js
// Remove this line and the PASSWORD_STORAGE_KEY constant entirely
localStorage.setItem(PASSWORD_STORAGE_KEY, password);
```

### CR-02: Offline rewards corrupt cash with NaN

**File:** `js/main.js:497-499`, `js/village.js:228-238`, `js/economy.js:210-217`
**Issue:** `village.getIncomeRate()` returns an **object** (`{ cash: ..., gold: ..., food: ... }`), but `main.js` treats it as a scalar: `Math.floor(incomeRate * offlineSeconds * 0.5)`. Multiplying an object by a number yields `NaN`, which is then passed to `economy.addRaw("cash", NaN)`. The cash resource becomes `NaN`, JSON-stringifies to `null` in localStorage, and subsequent server saves fail schema validation. This can effectively wipe a player's liquid cash on every return visit.
**Fix:** Use the correct resource from the returned object, e.g. `incomeRate.cash || 0`, or add a `getCashIncome()` helper to `GameVillage`.

```js
const incomeRate = village.getIncomeRate();
const villageCash = Math.floor((incomeRate.cash || 0) * offlineSeconds * 0.5);
```

### CR-03: Server crashes on startup because `DATA_DIR` is used before declaration

**File:** `server/config.js:22,37,40`
**Issue:** `getOrCreateJwtSecret()` is called on line 37 and references `DATA_DIR`, but `DATA_DIR` is not declared until line 40. `const` bindings are hoisted but live in the Temporal Dead Zone until initialized, so reading `DATA_DIR` inside the function throws `ReferenceError: Cannot access 'DATA_DIR' before initialization`. The server cannot start unless `JWT_SECRET` is supplied via environment variable.
**Fix:** Move `const DATA_DIR = ...` (and `BUILD_DIR` if needed) above `const JWT_SECRET = getOrCreateJwtSecret();`.

```js
const DATA_DIR = process.env.DATA_DIR || "./data";
const BUILD_DIR = process.env.BUILD_DIR || (process.env.NODE_ENV === "production" ? "./dist" : "./");
const JWT_SECRET = getOrCreateJwtSecret();
```

### CR-04: Server accepts arbitrary/unvalidated resource values from clients

**File:** `server/validation/player.js:13-49`, `server/routes/api.js:61-84,235-245`
**Issue:** `PlayerSaveSchema` uses `.passthrough()` and only validates `cash`, `gems`, `gold`, `hammers`, `scrolls`, and `food`. Other resources sent by the client (`artifacts`, `desertGem`, `water`, `salt`, `leather`, `copper`, `herbs`, `loadout`, `market`, etc.) are accepted without validation. `validateResourceDelta` only checks the six known numeric resources. A malicious client can therefore set `desertGem`, `artifacts`, etc. to any value (including negatives or 1e15+) and the server will persist it.
**Fix:** Remove `.passthrough()` from `PlayerSaveSchema` and `WeaponSchema`; explicitly list every allowed field with proper `min(0).max(1e15)` constraints. Extend `RESOURCE_NAMES`/`MAX_RESOURCE_GAIN_PER_SEC` to cover all tracked resources, or reject unknown keys.

```js
// Example: drop passthrough and add missing resources
const PlayerSaveSchema = z.object({
  // ... existing fields ...
  artifacts: z.number().min(0).max(1e15).optional(),
  desertGem: z.number().min(0).max(1e15).optional(),
  water: z.number().min(0).max(1e15).optional(),
  // ... etc ...
}).strict(); // reject unknown keys
```

### CR-05: Stunned monster freezes the entire monster AI loop

**File:** `js/world.js:2331-2334`
**Issue:** Inside `updateMonstersAI`, the stunned-monster branch uses `return` instead of `continue`. As soon as any living monster has `_stunTimer > 0`, the function exits immediately and **no other monster is updated** for the rest of the frame. With multiple monsters this causes a permanent/freezing AI stutter and can break combat pacing.
**Fix:** Replace `return;` with `continue;`.

```js
if (m._stunTimer > 0) {
  m._stunTimer -= dt;
  continue; // was return
}
```

## High Issues

### HI-01: BR match end save sent without authentication header

**File:** `js/main.js:1227-1231`
**Issue:** The immediate post-BR `fetch` to `/api/players/${PLAYER_USERNAME}` sends only `Content-Type: application/json` and no `Authorization` header. The server requires a Bearer token for POST player updates, so this request always fails with 401 and BR stats are not persisted until the next regular tick save.
**Fix:** Add the auth header the same way `saveToDB` does.

```js
const headers = { "Content-Type": "application/json" };
const token = localStorage.getItem("player_token");
if (token) headers.Authorization = `Bearer ${token}`;
fetch(`${API_BASE}/api/players/${encodeURIComponent(PLAYER_USERNAME)}`, {
  method: "POST", headers,
  body: JSON.stringify({ brWins, brKills: brKillsTotal, last_active: Date.now() })
}).catch(...);
```

### HI-02: `ImageResolver` ternary check throws ReferenceError when undefined

**File:** `js/world.js:181`, `js/ui/ui-gameplay.js:180`
**Issue:** The expression `ImageResolver ? ...` references a global that may be undeclared. Accessing an undeclared variable throws `ReferenceError`; it does not evaluate to a falsy value. If `config/images.js` fails to load first, the whole module initialization crashes. `world.js:824` correctly uses `typeof ImageResolver !== 'undefined'`, but the other two sites do not.
**Fix:** Use the safe typeof pattern everywhere.

```js
const base = typeof ImageResolver !== 'undefined'
  ? ImageResolver.src(key)
  : ("assets/images/" + key + ".png");
```

### HI-03: XSS via `innerHTML` with attacker-controllable strings

**File:** `js/ui/ui-core.js:184,266,306,349,472,501,524,538,755,935,958,1101,1166,1280,1376,1436,1486,1511,1542,1558,1602,1636`; `js/ui/context-menu.js:80`; `js/main.js:96`
**Issue:** Dozens of `innerHTML` assignments are used for dynamic UI. Several receive strings built from multiplayer data such as usernames (PvP combat log, player list stats, story choices, chat overlay messages in some render paths). Because server chat/PvP messages are not HTML-escaped before broadcast, a username or chat message containing `<script>`, `onerror=`, or similar will execute in the victim's browser.
**Fix:** Prefer `textContent` / `createElement` / `appendChild` for dynamic text. If `innerHTML` is unavoidable, sanitize all external values through a strict HTML-escape helper before insertion. Never pass raw `msg.username` or `msg.message` into HTML.

### HI-04: Permissive CORS defaults allow any origin in production

**File:** `server/routes/api.js:12-16`
**Issue:** If `CORS_ORIGIN` is not set, the server responds with `Access-Control-Allow-Origin: *`. In production this allows malicious websites to call authenticated player APIs using a victim's token if they can obtain it.
**Fix:** Default to the application's own origin, or refuse requests when `NODE_ENV=production` and `CORS_ORIGIN` is missing. Never default to `*` in production.

```js
const corsOrigin = process.env.CORS_ORIGIN || (isProd ? false : "*");
```

### HI-05: Login endpoint lacks rate limiting or account lockout

**File:** `server/routes/api.js:35-133`
**Issue:** `/api/auth/login` accepts unlimited login attempts with no per-IP or per-account rate limiting. The legacy plaintext-fallback path and bcrypt comparison make this endpoint susceptible to online brute force and timing enumeration.
**Fix:** Add a per-IP rate limiter (e.g., 5 attempts per minute) and an exponential per-account lockout after repeated failures. Apply it before password verification.

### HI-06: MongoDB and in-memory stores diverge on partial saves

**File:** `server/routes/api.js:246-258`
**Issue:** The route merges incoming data with the existing in-memory record (`merged = { ...existing }; ... merged[k] = v`), but writes the **unmerged** client payload to MongoDB (`$set: { ...data, last_active }`). If the client ever sends a partial payload, MongoDB will only update those fields while memStore retains the merged snapshot, causing the two persistence layers to diverge.
**Fix:** Persist the merged record to both stores.

```js
await Player.updateOne(
  { username },
  { $set: merged },
  { upsert: true }
);
```

## Medium Issues

### ME-01: `economy.totalEarned` is a number but UI expects an object

**File:** `js/economy.js:82`, `js/ui/ui-core.js:923-925`
**Issue:** `GameEconomy` initializes `this.totalEarned = 0`, but `renderMyStats()` reads `eco.totalEarned.cash`, `.gold`, and `.gems`. Because `0` has no properties, the stats page always shows `0` for lifetime earnings regardless of actual progress.
**Fix:** Track earned resources as an object and update it whenever resources are gained.

```js
this.totalEarned = { cash: 0, gold: 0, gems: 0 };
// in addRaw when amt > 0:
if (this.totalEarned[type] !== undefined) this.totalEarned[type] += amt;
```

### ME-02: Anti-cheat can reject legitimate offline rewards

**File:** `server/validation/player.js:61-84`, `js/main.js:494-547`
**Issue:** `validateResourceDelta` caps gains at `MAX_RESOURCE_GAIN_PER_SEC * elapsed * 1.5`. Offline rewards are computed client-side and can exceed this cap for players with high building/oasis income who have been away for hours. The server then rejects the save with 409, silently discarding progress.
**Fix:** Compute offline income server-side from the last known building/oasis state, or whitelist offline-reward sources and apply the cap per-resource with a higher ceiling for offline accrual.

### ME-03: `.passthrough()` schemas allow record pollution and hidden fields

**File:** `server/validation/player.js:12,49`
**Issue:** Both `WeaponSchema` and `PlayerSaveSchema` use `.passthrough()`, so clients can inject arbitrary keys into player records (e.g., `_isAdmin`, `password`, `token`, internal Mongo fields). This widens the attack surface for privilege escalation and data corruption.
**Fix:** Remove `.passthrough()` / use `.strict()` and explicitly enumerate every accepted field.

### ME-04: BR extraction button relies on inline `onclick`

**File:** `index.html:309`, `js/main.js:1461`
**Issue:** The extraction button works only through the inline `onclick` handler in HTML. There is no JavaScript event listener registered in `main.js`, and the keyboard shortcut just calls `.click()` on the same inline handler. Inline handlers are brittle and will break under a Content Security Policy.
**Fix:** Register the click handler in `main.js` alongside the other BR buttons and remove the inline `onclick`.

```js
const evacBtn = document.getElementById('br-evacuate-btn');
if (evacBtn) evacBtn.addEventListener('click', () => world._doBRExtraction());
```

### ME-05: `getIncomeRate` return type contradicts `incomeRate` property

**File:** `js/economy.js:210-217`, `js/village.js:228-238`
**Issue:** `GameEconomy.refreshIncome(village)` stores an object in `this.incomeRate`, while the property name and initial value (`0`) imply a scalar. This is the same abstraction leak that caused CR-02 and will cause future bugs if `incomeRate` is used elsewhere.
**Fix:** Rename `getIncomeRate` to `getIncomeRates` and store the object under a clearly-named property, or provide scalar accessors like `getCashIncomeRate()`.

### ME-06: Chat/PvP server broadcasts raw usernames without sanitization

**File:** `server/network/worldHandler.js:224,241-242`, `server/network/worldHandler.js:165-167,314-316`
**Issue:** Server forwards `msg.message`, `msg.playerId`, and `msg.by` verbatim. Although current client renderers mostly use `textContent`, any future client code (or existing `innerHTML` paths such as combat log / notification parsing) will be vulnerable to stored/reflected XSS.
**Fix:** Sanitize broadcast strings on the server (e.g., escape HTML characters or strip tags) before broadcasting.

### ME-07: `updateBR` sends WebSocket messages without connection check

**File:** `js/world.js:2839,2856,2908`
**Issue:** `startBRMatch`, `_doBRExtraction`, and `_endBRMatch` call `this.netSync.send(...)` directly. If `netSync` is null or disconnected, `send` itself guards against a null `_ws`, but the code does not guard `this.netSync` being null, causing a runtime error in contexts where the world is used without multiplayer.
**Fix:** Use the existing `_sendWS` helper everywhere, which already null-checks `this.netSync`.

```js
this._sendWS({ type: "br_match_start", ... });
```

### ME-08: Challenge reward distribution is hardcoded and ignores declared rewards

**File:** `js/ui/ui-core.js:889-906`
**Issue:** `_giveChallengeReward` hardcodes rewards per `challenge.id` and ignores the `reward` text field shown to the player. Changing the displayed reward string will silently break payout logic.
**Fix:** Parse the reward string/object or define rewards as structured data (`{ gold: 500, gems: 50 }`) and apply them generically.

## Low Issues

### LO-01: Debug `console.log`/`warn` artifacts in production paths

**File:** `js/main.js:316,469,1469`, `js/world.js:778,358`, `js/save.js:59,150`, etc.
**Issue:** Many `console.log`/`warn` statements remain in production code. They can leak internal state and clutter the console.
**Fix:** Replace with a leveled logger that is disabled in production, or remove non-error logs.

### LO-02: Inline event handlers in HTML bypass CSP and mixing concerns

**File:** `index.html:72,309,547`
**Issue:** Multiple inline `onclick` handlers are used for reload, BR extraction, and fullscreen. These prevent deploying a strict Content Security Policy and scatter behavior away from the JS modules.
**Fix:** Move all handlers into the relevant module files.

### LO-03: Magic numbers duplicated across BR and extraction modes

**File:** `js/world.js:2769-2803,2950-2972`, `js/modes/extraction-mode.js:12-24`
**Issue:** BR map sizes, spawn margins, zone radii, bandit stats, and extraction upgrade costs are scattered as literal numbers with little documentation, making tuning and consistency hard.
**Fix:** Centralize constants in a `GAME_BALANCE` config object.

### LO-04: `ImageResolver` is an implicit global in ES modules

**File:** `js/world.js`, `js/ui/ui-gameplay.js`
**Issue:** Modules depend on a global `ImageResolver` without importing it. This hides the dependency and complicates unit testing.
**Fix:** Expose `ImageResolver` as an ES module export and import it where needed, or inject it through a config object.

---

## Top 10 Summary

1. **Plaintext password in `localStorage`** (`js/main.js:63`) — CRITICAL security vulnerability.
2. **Server config startup crash** (`server/config.js:22/37/40`) — `DATA_DIR` is read before it is declared.
3. **Offline rewards corrupt cash to `NaN`** (`js/main.js:497-499` + `js/village.js:228`) — effectively deletes player cash.
4. **Server accepts arbitrary resource cheating** (`server/validation/player.js`, `server/routes/api.js`) — missing validation for `artifacts`, `desertGem`, etc.
5. **`return` instead of `continue` freezes all monster AI** (`js/world.js:2331`) — gameplay-breaking logic error.
6. **BR match save has no auth header** (`js/main.js:1227-1231`) — always fails server-side.
7. **`ImageResolver` ReferenceError pattern** (`js/world.js:181`, `js/ui/ui-gameplay.js:180`) — module crashes if global is absent.
8. **XSS via `innerHTML`** (`js/ui/ui-core.js` and others) — dynamic HTML built from multiplayer usernames/messages.
9. **CORS defaults to `*`** (`server/routes/api.js:12-16`) — insecure production default.
10. **Login endpoint has no rate limiting** (`server/routes/api.js:35-133`) — brute-force risk.

_Reviewed: 2026-07-13_
_Reviewer: gsd-code-reviewer_
_Depth: deep_
