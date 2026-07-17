# 🤖 برومنت الذكاء الاصطناعي — لعبة ملك الصحراء

**الهدف:** إصلاح المشاكل الحرجة والمتوسطة + تحسينات أمنية عاجلة

---

## 🔴 **المشاكل الحرجة (CRITICAL) — يجب إصلاحها أولاً**

### 1. إصلاح كود Server Config — DATA_DIR استخدام قبل التصريح
**الملف:** `server/config.js`
**السطور:** 22, 37, 40

**المشكلة:**
```javascript
// CURRENT (WRONG):
const JWT_SECRET = getOrCreateJwtSecret(); // Line 37 — uses DATA_DIR
// ...
const DATA_DIR = process.env.DATA_DIR || "./data"; // Line 40 — defined AFTER
```

**الحل المطلوب:**
```javascript
// FIXED:
const DATA_DIR = process.env.DATA_DIR || "./data"; // ← Move to top
const BUILD_DIR = process.env.BUILD_DIR || (process.env.NODE_ENV === "production" ? "./dist" : "./");
const JWT_SECRET = getOrCreateJwtSecret(); // ← Now DATA_DIR is available
```

**الإجراء:** أعد ترتيب `const` في `server/config.js` بحيث تأتي `DATA_DIR` و `BUILD_DIR` قبل `JWT_SECRET`.

---

### 2. إصلاح حلقة Monster AI — return بدل continue
**الملف:** `js/world.js`
**السطور:** 2331-2334

**المشكلة:**
```javascript
// CURRENT (WRONG):
if (m._stunTimer > 0) {
  m._stunTimer -= dt;
  return; // ← STOPS ALL MONSTER UPDATES!
}
```

**الحل المطلوب:**
```javascript
// FIXED:
if (m._stunTimer > 0) {
  m._stunTimer -= dt;
  continue; // ← Move to next monster
}
```

**الإجراء:** غيّر `return` إلى `continue` في السطر 2334 بالضبط.

**الاختبار:** بدّل عدة وحوش قيد التشغيل — جميعهم يجب أن يتحركوا (ليس فقط الأول).

---

### 3. حذف كلمة المرور من localStorage (XSS + Plaintext Risk)
**الملف:** `js/main.js`
**السطور:** حوالي 63

**المشكلة:**
```javascript
// CURRENT (DANGEROUS):
localStorage.setItem(PASSWORD_STORAGE_KEY, password); // ← Plaintext password!
```

**الحل المطلوب:**
```javascript
// FIXED — Complete removal:
// ❌ DELETE: localStorage.setItem(PASSWORD_STORAGE_KEY, password);
// ❌ DELETE: const PASSWORD_STORAGE_KEY = ...;

// Instead, rely on JWT tokens stored in localStorage (already implemented)
// Session is maintained via localStorage.getItem("player_token")
```

**الإجراء:**
1. ابحث عن `PASSWORD_STORAGE_KEY` في الملف
2. احذف السطر الذي يكتب كلمة المرور إلى localStorage
3. احذف التعريف `const PASSWORD_STORAGE_KEY = ...`
4. احذف أي سطر يقرأ `localStorage.getItem(PASSWORD_STORAGE_KEY)`

**الاختبار:** تسجيل دخول — تحقق أن localStorage يحتوي على `player_token` فقط، ليس `player_password`.

---

### 4. إصلاح Offline Rewards NaN Bug
**الملف:** `js/main.js`
**السطور:** 497-499

**المشكلة:**
```javascript
// CURRENT (WRONG):
const incomeRate = village.getIncomeRate(); // returns { cash: ..., gold: ..., food: ... }
const reward = Math.floor(incomeRate * offlineSeconds * 0.5); // ← Can't multiply object!
```

**الحل المطلوب:**
```javascript
// FIXED:
const incomeRate = village.getIncomeRate(); // { cash, gold, food }
const villageCash = Math.floor((incomeRate.cash || 0) * offlineSeconds * 0.5);
const villageGold = Math.floor((incomeRate.gold || 0) * offlineSeconds * 0.5);
const villageFood = Math.floor((incomeRate.food || 0) * offlineSeconds * 0.5);

economy.addRaw('cash', villageCash);
economy.addRaw('gold', villageGold);
economy.addRaw('food', villageFood);
```

**الإجراء:** في `main.js`، في دالة حساب offline rewards، استخرج كل مورد من الـ object.

**الاختبار:** غلّق اللعبة 10 دقائق، افتح مرة أخرى — تحقق أن الموارد زادت (ليس NaN).

---

### 5. إضافة Global Error Handlers
**الملف:** `server.js`
**السطور:** نهاية الملف (بعد السطر 280+)

**المشكلة:**
```javascript
// CURRENT: لا يوجد معالج للأخطاء غير المتوقعة
process.on("uncaughtException", ...) // MISSING
process.on("unhandledRejection", ...) // MISSING
```

**الحل المطلوب:**
```javascript
// ADD to server.js (before closing):

const { captureException } = require("./server/sentry");

process.on("uncaughtException", (err) => {
  logger.error({ err }, "Uncaught Exception");
  captureException(err);
  try { wss.clients.forEach((ws) => ws.close()); } catch {}
  try { server.close(); } catch {}
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  logger.error({ promise, reason: reason?.message || reason }, "Unhandled Rejection");
  captureException(reason instanceof Error ? reason : new Error(String(reason)));
  try { wss.clients.forEach((ws) => ws.close()); } catch {}
  try { server.close(); } catch {}
  process.exit(1);
});

process.on("SIGTERM", () => {
  logger.info("Shutting down gracefully...");
  wss.clients.forEach((ws) => ws.close());
  server.close(() => process.exit(0));
});

process.on("SIGINT", () => {
  logger.info("Shutting down gracefully...");
  wss.clients.forEach((ws) => ws.close());
  server.close(() => process.exit(0));
});
```

**الإجراء:** أضف هذه الـ handlers في نهاية `server.js`.

---

### 6. إضافة JWT Authentication
**الملفات الجديدة:** `server/routes/auth.js`, `server/network/auth.js` (تحديث)

**المشكلة:** أي شخص يمكنه انتحال أي لاعب.

**الحل المطلوب:**

#### أ) `server/routes/auth.js` (جديد):
```javascript
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Player } = require("../db/databaseHelper");
const logger = require("../logger");

const { JWT_SECRET, JWT_EXPIRE } = require("../config");

exports.register = async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || username.length < 3 || username.length > 30) {
      return res.status(400).json({ error: "Username must be 3-30 characters" });
    }
    
    if (!password || password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }
    
    const existing = await Player.findOne({ username });
    if (existing) {
      return res.status(409).json({ error: "Username already taken" });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const player = await Player.create({
      username,
      password_hash: hashedPassword,
      // ... other defaults
    });
    
    const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: JWT_EXPIRE || "7d" });
    
    res.json({ 
      token,
      username,
      message: "Registration successful"
    });
  } catch (err) {
    logger.error({ err }, "Registration error");
    res.status(500).json({ error: "Registration failed" });
  }
};

exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: "Missing credentials" });
    }
    
    const player = await Player.findOne({ username });
    if (!player) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    
    const match = await bcrypt.compare(password, player.password_hash || "");
    if (!match) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    
    const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: JWT_EXPIRE || "7d" });
    
    res.json({ 
      token,
      username,
      message: "Login successful"
    });
  } catch (err) {
    logger.error({ err }, "Login error");
    res.status(500).json({ error: "Login failed" });
  }
};
```

#### ب) تحديث `server.js` — إضافة route:
```javascript
const { createApiRoutes } = require("./server/routes/api");
const authRoutes = require("./server/routes/auth");

// في createApiRoutes أو handleApiRequest:
if (req.url.startsWith("/api/auth/register") && req.method === "POST") {
  return await authRoutes.register(req, res);
}
if (req.url.startsWith("/api/auth/login") && req.method === "POST") {
  return await authRoutes.login(req, res);
}
```

#### ج) تحديث `js/main.js` — استخدام auth:
```javascript
// Registration:
const registerResponse = await fetch(`${API_BASE}/api/auth/register`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ username, password })
});
const { token, username } = await registerResponse.json();
localStorage.setItem("player_token", token);
localStorage.setItem("player_username", username);

// Login:
const loginResponse = await fetch(`${API_BASE}/api/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ username, password })
});
const { token } = await loginResponse.json();
localStorage.setItem("player_token", token);
```

---

## 🟡 **المشاكل المتوسطة (MEDIUM)**

### M1. إصلاح BR Match Save — إضافة Auth Header
**الملف:** `js/main.js`
**السطور:** 1227-1231

**المشكلة:**
```javascript
// CURRENT (WRONG):
fetch(`${API_BASE}/api/players/${PLAYER_USERNAME}`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ brWins, brKills: brKillsTotal })
}); // ← Missing Authorization header!
```

**الحل المطلوب:**
```javascript
// FIXED:
const token = localStorage.getItem("player_token");
const headers = { "Content-Type": "application/json" };
if (token) {
  headers.Authorization = `Bearer ${token}`;
}

fetch(`${API_BASE}/api/players/${encodeURIComponent(PLAYER_USERNAME)}`, {
  method: "POST",
  headers,
  body: JSON.stringify({ brWins, brKills: brKillsTotal, last_active: Date.now() })
}).catch(err => logger.error("BR save failed", err));
```

---

### M2. إضافة typeof Check للـ ImageResolver
**الملفات:** `js/world.js` (السطر ~181)، `js/ui/ui-gameplay.js` (السطر ~180)

**المشكلة:**
```javascript
// CURRENT (ReferenceError if undefined):
const base = ImageResolver ? ImageResolver.src(key) : fallback; // ← Throws if undefined
```

**الحل المطلوب:**
```javascript
// FIXED:
const base = typeof ImageResolver !== 'undefined' && ImageResolver
  ? ImageResolver.src(key)
  : ("assets/images/" + key + ".png");
```

---

### M3. إصلاح economy.totalEarned
**الملف:** `js/economy.js`
**السطور:** 82 (initialization)

**المشكلة:**
```javascript
// CURRENT (WRONG):
this.totalEarned = 0; // scalar

// But UI expects:
eco.totalEarned.cash // ← undefined!
eco.totalEarned.gold // ← undefined!
```

**الحل المطلوب:**
```javascript
// FIXED:
this.totalEarned = { cash: 0, gold: 0, gems: 0, hammers: 0, scrolls: 0 };

// في addRaw(), عند إضافة موارد موجبة:
if (amt > 0 && this.totalEarned[type] !== undefined) {
  this.totalEarned[type] += amt;
}
```

---

### M4. Zod Validation — Remove .passthrough()
**الملف:** `server/validation/player.js`
**السطور:** 12 (WeaponSchema)، 49 (PlayerSaveSchema)

**المشكلة:**
```javascript
// CURRENT (WRONG):
const PlayerSaveSchema = z.object({
  cash: z.number().min(0).max(1e15),
  gold: z.number().min(0).max(1e15),
  // ...
}).passthrough(); // ← Allows ANY extra fields!

// Client can send:
// { cash: 100, _isAdmin: true, password: "hacked" }
```

**الحل المطلوب:**
```javascript
// FIXED:
const PlayerSaveSchema = z.object({
  username: z.string().min(1),
  cash: z.number().min(0).max(1e15),
  gold: z.number().min(0).max(1e15),
  gems: z.number().min(0).max(1e15),
  hammers: z.number().min(0).max(1e15),
  scrolls: z.number().min(0).max(1e15),
  food: z.number().min(0).max(1e15),
  artifacts: z.number().min(0).max(1e15),
  desertGem: z.number().min(0).max(1e15),
  water: z.number().min(0).max(1e15),
  salt: z.number().min(0).max(1e15),
  copper: z.number().min(0).max(1e15),
  herbs: z.number().min(0).max(1e15),
  level: z.number().min(1).max(110),
  exp: z.number().min(0),
  health: z.number().min(0),
  // ... other valid fields
}).strict(); // ← Reject unknown keys!
```

---

### M5. إضافة CSP + Security Headers
**الملف:** `server.js`
**السطور:** 196-197

**المشكلة:**
```javascript
// CURRENT (Weak):
"Content-Security-Policy": "default-src 'self' data: blob:; connect-src 'self' ws: wss: ..."
```

**الحل المطلوب:**
```javascript
// FIXED — Stricter CSP:
const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
  "Content-Security-Policy": 
    "default-src 'self'; " +
    "script-src 'self'; " +
    "style-src 'self' 'unsafe-inline'; " + // Canvas requires inline styles
    "img-src 'self' data: https:; " +
    "font-src 'self'; " +
    "connect-src 'self' ws: wss: https://sentry.io; " +
    "media-src 'self'; " +
    "frame-ancestors 'none'; " +
    "base-uri 'self'; " +
    "form-action 'self'",
};
```

---

### M6. تحديث CORS Default
**الملف:** `server/routes/api.js`
**السطور:** 12-16

**المشكلة:**
```javascript
// CURRENT (WRONG in production):
const corsOrigin = process.env.CORS_ORIGIN || "*"; // ← Insecure default!
```

**الحل المطلوب:**
```javascript
// FIXED:
const isProd = process.env.NODE_ENV === "production";
const corsOrigin = process.env.CORS_ORIGIN || (isProd ? false : "*");

// في response:
if (corsOrigin) {
  res.setHeader("Access-Control-Allow-Origin", corsOrigin);
}
```

---

### M7. إضافة Rate Limiting على Login
**الملف:** `server/routes/auth.js` (جديد)

**المشكلة:**
```javascript
// CURRENT: لا يوجد rate limiting على /api/auth/login
// يمكن brute force بـ 1000 محاولة في الثانية
```

**الحل المطلوب:**
```javascript
// ADD to server.js:
const loginAttempts = new Map(); // { username: { count, lastTime } }

function checkLoginRateLimit(username) {
  const now = Date.now();
  const entry = loginAttempts.get(username);
  
  if (!entry || now - entry.lastTime > 60000) {
    // New window
    loginAttempts.set(username, { count: 1, lastTime: now });
    return true;
  }
  
  if (entry.count > 5) {
    // Locked out
    return false;
  }
  
  entry.count++;
  return true;
}

// في auth.js login:
if (!checkLoginRateLimit(username)) {
  return res.status(429).json({ error: "Too many login attempts. Try again in 1 minute." });
}
```

---

## 🟢 **التحسينات الأمنية (Security Enhancements)**

### S1. Sanitize Chat/PvP Messages
**الملف:** `server/network/worldHandler.js`
**السطور:** 224, 241-242

**الحل:**
```javascript
function sanitizeMessage(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .substring(0, 200); // Limit length
}

// عند broadcast:
const msg = JSON.stringify({
  type: "chat",
  message: sanitizeMessage(message),
  by: sanitizeMessage(by),
  username: sanitizeMessage(username),
  timestamp: Date.now()
});
```

---

### S2. إزالة console.log من Production
**الملفات:** `js/main.js`, `js/world.js`, `js/save.js`، إلخ

**الحل:**
```javascript
// على رأس كل ملف:
const isDev = process.env.NODE_ENV === 'development' || localStorage.getItem('DEBUG') === 'true';
const log = isDev ? console.log : () => {};
const warn = isDev ? console.warn : () => {};

// استخدم:
log("Debug info"); // ✅ يعمل في dev فقط
warn("Warning"); // ✅ يعمل في dev فقط
```

---

### S3. استبدال Inline onclick بـ Event Listeners
**الملف:** `index.html`
**السطور:** 72, 309, 547

**المشكلة:**
```html
<!-- CURRENT (BAD for CSP): -->
<button onclick="location.reload()">Reload</button>
<button onclick="world._doBRExtraction()">Extract</button>
```

**الحل:**
```html
<!-- FIXED: -->
<button id="reload-btn">Reload</button>
<button id="br-extract-btn">Extract</button>

<!-- في js/main.js: -->
document.getElementById('reload-btn')?.addEventListener('click', () => {
  location.reload();
});

document.getElementById('br-extract-btn')?.addEventListener('click', () => {
  if (world) world._doBRExtraction();
});
```

---

## 🔧 **تحسينات أخرى**

### T1. إصلاح Offline Rewards Anti-Cheat
**الملف:** `server/validation/player.js`
**السطور:** 61-84

**الحل:**
```javascript
// زيادة الـ ceiling للـ offline rewards:
const MAX_RESOURCE_GAIN_PER_SEC = process.env.NODE_ENV === 'production' ? 10000 : 100000;
const OFFLINE_MULTIPLIER = 2.0; // ضعف الـ multiplier

// في validateResourceDelta:
const elapsed = Math.min(now - lastSaveTime, 24 * 60 * 60); // max 24 hours
const maxGain = MAX_RESOURCE_GAIN_PER_SEC * elapsed * OFFLINE_MULTIPLIER;

if (gained > maxGain) {
  return false; // Rejected
}
```

---

### T2. إضافة Server-Side Offline Income Calculation
**الملف:** `server/routes/api.js` (جديد function)

**الحل:**
```javascript
function calculateOfflineIncome(player, elapsedSeconds) {
  // من القرى المعروفة:
  const buildings = player.buildings || [];
  let income = { cash: 0, gold: 0, food: 0 };
  
  buildings.forEach(b => {
    if (b.level > 0) {
      // Approximate income rate from building level
      const baseRate = 10 * b.level;
      income.cash += baseRate * elapsedSeconds;
      income.gold += (baseRate * 0.5) * elapsedSeconds;
    }
  });
  
  return income;
}

// في POST /api/players:
const elapsedSeconds = (Date.now() - player.last_save_time) / 1000;
const serverCalculatedIncome = calculateOfflineIncome(player, elapsedSeconds);

// Verify client's numbers don't exceed server's by 50%:
if (incoming.cash > serverCalculatedIncome.cash * 1.5) {
  // Flag as suspicious
  logger.warn({ username, incoming, calculated: serverCalculatedIncome }, "Suspicious income");
}
```

---

### T3. إضافة Rate Limiter on WebSocket (per-player)
**الملف:** `server/network/worldHandler.js`

**الحل:**
```javascript
const playerMessageCounts = new Map(); // { username: { count, windowStart } }
const WS_RATE_LIMIT = 100; // messages per minute
const RATE_LIMIT_WINDOW = 60000; // 1 minute

function checkWSRateLimit(username) {
  const now = Date.now();
  let entry = playerMessageCounts.get(username);
  
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW) {
    entry = { count: 0, windowStart: now };
    playerMessageCounts.set(username, entry);
  }
  
  entry.count++;
  return entry.count <= WS_RATE_LIMIT;
}

// في handleMessage:
if (!checkWSRateLimit(ws.authUsername)) {
  ws.send(JSON.stringify({ error: "Rate limit exceeded" }));
  return;
}
```

---

## 📋 **Checklist للتنفيذ**

### Phase 1 — Critical (اليوم)
- [ ] إصلاح DATA_DIR في server/config.js
- [ ] إصلاح return → continue في js/world.js:2331
- [ ] حذف PASSWORD_STORAGE_KEY من js/main.js
- [ ] إصلاح offline rewards NaN في js/main.js
- [ ] إضافة global error handlers في server.js

### Phase 2 — Authentication (غداً)
- [ ] إنشاء server/routes/auth.js
- [ ] تحديث server.js لـ auth routes
- [ ] تحديث js/main.js لـ token handling
- [ ] إضافة password_hash إلى Player schema

### Phase 3 — Validation & CSP (يوم بعد غد)
- [ ] تحديث Zod schemas — إزالة .passthrough()
- [ ] إضافة CSP headers في server.js
- [ ] تحديث CORS defaults
- [ ] إضافة rate limiting على /api/auth/login
- [ ] إصلاح BR match save headers

### Phase 4 — Security Hardening (الأسبوع)
- [ ] Sanitize chat messages
- [ ] حذف console.log من production
- [ ] استبدال inline onclick
- [ ] إضافة WebSocket rate limiting
- [ ] Server-side offline income validation

### Phase 5 — Bug Fixes (الأسبوع)
- [ ] إصلاح ImageResolver typeof check
- [ ] إصلاح economy.totalEarned
- [ ] إصلاح MongoDB/in-memory divergence
- [ ] إضافة server-side income calculation

---

## 🧪 **اختبارات التحقق**

بعد كل إصلاح:

```bash
# 1. Lint:
npm run lint

# 2. Tests:
npm test

# 3. Audit:
npm run audit

# 4. Build:
npm run build

# 5. Start server:
npm start

# 6. Manual testing:
# - Register & Login
# - Offline rewards (wait, then check cash)
# - PvP + monster AI (check all move)
# - BR extraction (check save works)
```

---

## 📝 **ملاحظات مهمة**

1. **لا تحذف أي بيانات موجودة** — استخدم migrations إذا لزم الأمر
2. **اختبر في التطوير أولاً** — استخدم `npm run dev`
3. **احفظ نسخة احتياطية** — `git backup` قبل التغييرات الكبيرة
4. **اتبع الـ checklist** — لا تتخطَّ Phase 1
5. **اطلب مساعدة عند الغموض** — هذا البرومنت يغطي 80% من الحالات

---

**آخر تحديث:** 2026-07-17  
**الحالة:** جاهز للتنفيذ  
**التقدير:** 2-3 أسابيع عمل  
