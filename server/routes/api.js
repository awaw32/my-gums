"use strict";

const logger = require("../logger");
const { sanitizePlayerData } = require("../validation/player");
const metrics = require("../metrics");
const { makeRateLimiter } = require("../network/rateLimiter");
const loginLimiters = new Map();

function createApiRoutes({ mongoConnected, memStore, Player, getDefaultPlayer, markDirty, rooms, BUILDING_DEFS, TICK_MS, claimReward }) {

  return async function handleApiRequest(req, res) {
    if (req.headers.upgrade === "websocket") return false;

    const isProd = process.env.NODE_ENV === "production";
    const corsOrigin = process.env.CORS_ORIGIN || (isProd ? false : "*");
    if (corsOrigin) {
      res.setHeader("Access-Control-Allow-Origin", corsOrigin);
    } else if (!isProd) {
      res.setHeader("Access-Control-Allow-Origin", "*");
    }
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("X-XSS-Protection", "0");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    if (req.method === "OPTIONS") {
      res.writeHead(204); res.end(); return true;
    }

    // ═══════════════════════════════════════════════════════════════
    //  🛡️ تسجيل الدخول + إنشاء حساب (مع كلمة مرور حقيقية)
    //  ═══════════════════════════════════════════════════════════════
    //    - الحسابات القديمة (بدون كلمة مرور) تُرقى تلقائياً
    //    - الحسابات الجديدة تتطلب كلمة مرور (4 أحرف كحد أدنى)
    //    - السيرفر يُرجع passwordUpgraded: true عند ترقية حساب قديم
    // ═══════════════════════════════════════════════════════════════
    if (req.url === "/api/auth/login" && req.method === "POST") {
      const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket.remoteAddress;
      let limiter = loginLimiters.get(ip);
      if (!limiter) { limiter = makeRateLimiter({ maxPerSec: 999 }); loginLimiters.set(ip, limiter); }
      if (!loginLimiters.has(ip + "_count")) loginLimiters.set(ip + "_count", 0);
      if (!loginLimiters.has(ip + "_time")) loginLimiters.set(ip + "_time", Date.now());
      const loginCount = loginLimiters.get(ip + "_count") + 1;
      const loginTime = loginLimiters.get(ip + "_time");
      if (Date.now() - loginTime > 60000) {
        loginLimiters.set(ip + "_count", 1);
        loginLimiters.set(ip + "_time", Date.now());
      } else if (loginCount > 5) {
        res.writeHead(429, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "محاولات كثيرة جداً. انتظر دقيقة." }));
        return;
      } else {
        loginLimiters.set(ip + "_count", loginCount);
      }
      let body = "";
      let size = 0;
      req.on("data", chunk => {
        size += chunk.length;
        if (size > 4096) { req.destroy(); return; }
        body += chunk;
      });
      req.on("end", async () => {
        try {
          const { username, password } = JSON.parse(body);
          if (!username || typeof username !== "string" || username.length < 2 || username.length > 30 || /[\/:;<>"']/.test(username)) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "invalid username" }));
            return;
          }
          const { generateToken, hashPassword, comparePassword } = require("../network/auth");
          const sanitized = username.slice(0, 30);
          const existing = memStore.get(sanitized);

          if (existing && existing.password) {
            // ── حساب موجود — تحقق من كلمة المرور ──
            let pwOk = false;
            let isLegacyEmpty = false;

            if (existing.password.startsWith("$2")) {
              // كلمة المرور بصيغة bcrypt → تحقق عادي
              pwOk = await comparePassword(password, existing.password);

              // إذا لم تطابق كلمة المرور، تحقق إذا كان هذا حساباً قديماً (كلمة مرور فارغة)
              if (!pwOk && password && password.length > 0) {
                // هل كلمة المرور المخزنة هي bcrypt("")؟
                const emptyMatch = await comparePassword("", existing.password);
                if (emptyMatch) {
                  // حساب قديم بكلمة مرور فارغة → ترقية
                  isLegacyEmpty = true;
                  pwOk = true;
                }
              }
            } else {
              // هجرة من plaintext → bcrypt (للحسابات القديمة جداً)
              const isPlainMatch = password === existing.password;
              const isEmptyPlain = existing.password === "";
              if (isPlainMatch) {
                pwOk = true;
              } else if (isEmptyPlain && password && password.length > 0) {
                // حساب قديم بكلمة مرور فارغة (plaintext) → ترقية
                isLegacyEmpty = true;
                pwOk = true;
              }
            }

            if (!pwOk) {
              res.writeHead(401, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "كلمة المرور خاطئة" }));
              return;
            }

            // ترقية كلمة المرور للحسابات القديمة
            if (isLegacyEmpty && password && password.length > 0) {
              existing.password = await hashPassword(password);
              memStore.set(sanitized, existing);
              markDirty(sanitized);
            }

            const token = generateToken(sanitized);
            const response = { token, username: sanitized };
            if (isLegacyEmpty) {
              response.passwordUpgraded = true;
            }
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify(response));
            return;
          }

          // ── حساب جديد — يتطلب كلمة مرور ──
          if (!existing) {
            if (!password || password.length < 4) {
              res.writeHead(400, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "كلمة المرور يجب أن تكون 4 أحرف على الأقل" }));
              return;
            }
            const pData = getDefaultPlayer(sanitized);
            pData._legacyEmpty = false;
            pData.password = await hashPassword(password);
            memStore.set(sanitized, pData);
            markDirty(sanitized);
            const token = generateToken(sanitized);
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ token, username: sanitized, isNew: true }));
            return;
          }
        } catch {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "invalid json" }));
        }
      });
      return true;
    }

    if (req.url === "/api/players" || req.url.startsWith("/api/players?")) {
      if (req.method === "GET") {
        if (!mongoConnected) {
          const safe = Array.from(memStore.values()).map(p => ({
            username: p.username,
            army_power: p.army_power || 0,
            level: p.level || 1,
          }));
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(safe));
          return true;
        }
        try {
          const players = await Player.find({}, { _id: 0, username: 1, army_power: 1, level: 1 }).lean();
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(players));
        } catch (err) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: err.message }));
        }
        return true;
      }
    }

    const playerMatch = req.url.match(/^\/api\/players\/([a-zA-Z0-9_\-\.%\u0600-\u06FF]+)$/);
    if (playerMatch) {
      const raw = decodeURIComponent(playerMatch[1]);
      if (/[\/:;<>"']/.test(raw)) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "invalid username" }));
        return true;
      }
      const username = raw;

      if (req.method === "GET") {
        if (!mongoConnected) {
          let data = { ...(memStore.get(username) || getDefaultPlayer(username)) };
          delete data.password;
          delete data.token;
          if (data.weapons) {
            data.weapons = data.weapons.map(w => ({
              id: w.id,
              starLevel: w.starLevel || 1,
              gemLevel: w.gemLevel || 1,
              level: w.level || 0,
              upgradeLevel: w.upgradeLevel || 0,
            }));
          }
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(data));
          return true;
        }
        try {
          let data = await Player.findOne({ username }).lean();
          if (!data) data = getDefaultPlayer(username);
          delete data.password;
          delete data.token;
          if (data.weapons) {
            data.weapons = data.weapons.map(w => ({
              id: w.id,
              starLevel: w.starLevel || 1,
              gemLevel: w.gemLevel || 1,
              level: w.level || 0,
              upgradeLevel: w.upgradeLevel || 0,
            }));
          }
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(data));
        } catch (err) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: err.message }));
        }
        return true;
      }

      if (req.method === "POST") {
        // Verify auth
        const authHeader = req.headers["authorization"];
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
          res.writeHead(401, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "auth required" }));
          return true;
        }
        const { verifyToken } = require("../network/auth");
        const auth = verifyToken(authHeader.slice(7));
        if (!auth.valid || auth.username !== username) {
          res.writeHead(403, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "forbidden" }));
          return true;
        }
        let body = "";
        let size = 0;
        req.on("data", chunk => {
          size += chunk.length;
          if (size > 1_048_576) { req.destroy(); return; }
          body += chunk;
        });
        req.on("end", async () => {
          try {
            const rawData = JSON.parse(body);
            const data = sanitizePlayerData(rawData);
            const lastActive = data.last_active || Date.now();
            const existing = memStore.get(username) || getDefaultPlayer(username);
            // مكافحة الغش — تحقق من معدل تغير الموارد
            const deltaCheck = require("../validation/player").validateResourceDelta(existing, data);
            if (!deltaCheck.ok) {
              logger.warn({ username, reason: deltaCheck.reason }, "AntiCheat rejection");
              res.writeHead(409, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: deltaCheck.reason }));
              return;
            }
            const merged = { ...existing };
            for (const [k, v] of Object.entries(data)) {
              if (v !== undefined) merged[k] = v;
            }
            merged.last_active = lastActive;
            memStore.set(username, merged);
            markDirty(username);
            if (mongoConnected) {
              await Player.updateOne(
                { username },
                { $set: merged },
                { upsert: true }
              );
            }
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ ok: true }));
        } catch (err) {
            logger.warn({ err: err.message }, "API save validation error");
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: err.message || "invalid json" }));
          }
        });
        return true;
      }
    }

    if (req.url.startsWith("/api/leaderboard") && req.method === "GET") {
      const urlObj = new URL(req.url, `http://${req.headers.host}`);
      const sortBy = urlObj.searchParams.get("sort") || "power";
      const sortField = sortBy === "kills" ? "kills" : sortBy === "level" ? "level" : sortBy === "oases" ? "oases" : "army_power";
      if (!mongoConnected) {
        const sorted = Array.from(memStore.values())
          .sort((a, b) => (b[sortField] || 0) - (a[sortField] || 0))
          .slice(0, 50)
          .map(p => ({ username: p.username, [sortField === 'army_power' ? 'power' : sortField]: p[sortField] || 0 }));
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(sorted));
        return true;
      }
      try {
        const projection = { username: 1, _id: 0 };
        projection[sortField] = 1;
        const entries = await Player.find({}, projection)
          .sort({ [sortField]: -1 })
          .limit(50)
          .lean();
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(entries));
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message }));
      }
      return true;
    }

    const upgradeMatch = req.url.match(/^\/api\/upgrades\/([a-zA-Z0-9_\-\.%\u0600-\u06FF]+)$/);
    if (upgradeMatch && req.method === "POST") {
      const uname = decodeURIComponent(upgradeMatch[1]);
      const authHeader = req.headers["authorization"];
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Authentication required" }));
        return true;
      }
      const { verifyToken } = require("../network/auth");
      const tokenResult = verifyToken(authHeader.slice(7));
      if (!tokenResult.valid || tokenResult.username !== uname) {
        res.writeHead(403, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Forbidden" }));
        return true;
      }
      let body = "";
      let size = 0;
      req.on("data", chunk => {
        size += chunk.length;
        if (size > 65_536) { req.destroy(); return; }
        body += chunk;
      });
      req.on("end", async () => {
        try {
          const data = JSON.parse(body);
          const existing = memStore.get(uname) || getDefaultPlayer(uname);
          const updated = { ...existing };
          if (data.armyYardLevel !== undefined) updated.armyYardLevel = data.armyYardLevel;
          if (data.knowledgeLevel !== undefined) updated.knowledgeLevel = data.knowledgeLevel;
          if (data.knowledgeType !== undefined) updated.knowledgeType = data.knowledgeType;
          if (data.equippedWeapon !== undefined) updated.equippedWeapon = data.equippedWeapon;
          if (data.weapons !== undefined) updated.weapons = data.weapons;
          memStore.set(uname, updated);
          markDirty(uname);
          if (mongoConnected) {
            await Player.updateOne({ username: uname }, { $set: updated }, { upsert: true });
          }
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true }));
        } catch {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "invalid json" }));
        }
      });
      return true;
    }

    const rewardStatusMatch = req.url.match(/^\/api\/rewards\/status\/([a-zA-Z0-9_\-\.%\u0600-\u06FF]+)$/);
    if (rewardStatusMatch && req.method === "GET") {
      const uname = decodeURIComponent(rewardStatusMatch[1]);
      const pData = memStore.get(uname) || getDefaultPlayer(uname);
      const { canClaimReward } = require("../logic/rewards");
      const canClaim = canClaimReward(pData);
      const remainingMs = canClaim ? 0 : (4 * 60 * 60 * 1000) - (Date.now() - (pData.lastGiftClaimedTimestamp || 0));
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ canClaim, remainingMs }));
      return true;
    }

    const rewardClaimMatch = req.url.match(/^\/api\/rewards\/claim\/([a-zA-Z0-9_\-\.%\u0600-\u06FF]+)$/);
    if (rewardClaimMatch && req.method === "POST") {
      const uname = decodeURIComponent(rewardClaimMatch[1]);
      const authHeader = req.headers["authorization"];
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Authentication required" }));
        return true;
      }
      const { verifyToken } = require("../network/auth");
      const tokenResult = verifyToken(authHeader.slice(7));
      if (!tokenResult.valid || tokenResult.username !== uname) {
        res.writeHead(403, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Forbidden" }));
        return true;
      }
      const pData = memStore.get(uname) || getDefaultPlayer(uname);
      const result = claimReward(pData);
      memStore.set(uname, pData);
      markDirty(uname);
      if (result.claimed && mongoConnected) {
        await Player.updateOne({ username: uname }, { $set: pData }, { upsert: true });
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result));
      return true;
    }

    if (req.url === "/api/buildings" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(BUILDING_DEFS));
      return true;
    }

    if (req.url === "/api/research" && req.method === "GET") {
      const { RESEARCH_DEFS } = require("../db/research");
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(RESEARCH_DEFS));
      return true;
    }

    if (req.url === "/api/weapons/defs" && req.method === "GET") {
      const { WEAPON_DEFS } = require("../db/databaseHelper");
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(WEAPON_DEFS));
      return true;
    }

    if (req.url === "/health") {
      const healthData = {
        status: "ok",
        mongo: mongoConnected ? "connected" : "unavailable",
        rooms: rooms.size,
        players: Array.from(rooms.values()).reduce((acc, r) => acc + r.players.size, 0),
        uptime: process.uptime(),
        tickRate: 1000 / TICK_MS,
      };
      if (metrics.enabled) {
        healthData.p95_latency_ms = metrics.getP95Latency();
        healthData.tick_drift_ms = metrics.getTickDrift();
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(healthData));
      return true;
    }

    if (req.url === "/metrics" && req.method === "GET") {
      if (!metrics.enabled) {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Metrics disabled");
        return true;
      }
      const adminKey = process.env.ADMIN_KEY;
      if (adminKey) {
        const authHeader = req.headers["authorization"];
        if (!authHeader || authHeader !== `Bearer ${adminKey}`) {
          res.writeHead(401, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "admin key required" }));
          return true;
        }
      }
      res.writeHead(200, { "Content-Type": metrics.getContentType() });
      res.end(await metrics.getMetricsText());
      return true;
    }

    if (req.url === "/version") {
      const { BUILD_ID } = require("../config");
      res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-cache" });
      res.end(JSON.stringify({ buildId: BUILD_ID }));
      return true;
    }

    return false;
  };
}

module.exports = { createApiRoutes };
