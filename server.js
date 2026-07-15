"use strict";

require("dotenv").config();
const fs = require("fs");
const { WebSocketServer } = require("ws");
const logger = require("./server/logger");

const {
  PORT, USE_HTTPS, CERT_DIR, DATA_DIR,
  WORLD_W, TICK_MS, RATE_LIMIT_WINDOW, RATE_LIMIT_MAX,
} = require("./server/config");

let server;
if (USE_HTTPS) {
  const https = require("https");
  const domain = process.env.DOMAIN || "localhost";
  let certPath = `${CERT_DIR}/${domain}`;
  let key, cert;
  try {
    key = fs.readFileSync(`${certPath}/privkey.pem`);
    cert = fs.readFileSync(`${certPath}/fullchain.pem`);
  } catch {
    logger.warn({ certPath }, "SSL certs not found, falling back to HTTP");
  }
  if (key && cert) {
    server = https.createServer({ key, cert });
  } else {
    server = require("http").createServer();
  }
} else {
  server = require("http").createServer();
}

const wss = new WebSocketServer({ server });
const rooms = new Map();
const playerData = new Map();

try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (e) { logger.warn({ err: e.message }, "Cannot create DATA_DIR"); }

const {
  mongoConnected, memStore, Player, getDefaultPlayer, markDirty,
} = require("./server/db/databaseHelper");

const {
  computeArmyYardUpgradeCost, computeArmyYardStats,
  computeKnowledgeUpgradeCost, computeKnowledgeBonuses,
} = require("./server/logic/formulas");

const { claimReward } = require("./server/logic/rewards");
const { applyWeaponUpgrade, computeWeaponDamageWithUpgrades } = require("./server/logic/weaponUpgrade");
const { applyBuildingUpgrade, BUILDING_DEFS } = require("./server/db/buildings");
const { applyResearchUpgrade } = require("./server/db/research");
const { sanitizePlayerData } = require("./server/validation/player");
const NetworkServer = require("./server/network/networkServer");
const metrics = require("./server/metrics");

const worldMonsters = [];
const worldDrops = [];
const WORLD_W2 = 2400, WORLD_H2 = 2400;
const SAFE_ZONE = { x: WORLD_W2 / 2 - 120, y: WORLD_H2 / 2 - 120, w: 240, h: 240 };
const worldClients = new Map();

const { createCombatLoop } = require("./server/logic/combatLoop");
const combatSystem = createCombatLoop({
  rooms, broadcast,
  WORLD_W, TICK_MS, worldMonsters, worldClients, SAFE_ZONE, WORLD_W2, WORLD_H2,
});

const { createWarManager } = require("./server/logic/warManager");
const warManager = createWarManager({
  worldClients,
  broadcastChat: (message) => {
    const msg = JSON.stringify(message);
    worldClients.forEach((c) => {
      if (c.ws.readyState === 1) c.ws.send(msg);
    });
  },
  memStore, getDefaultPlayer, markDirty,
});

const { createWorldHandler } = require("./server/network/worldHandler");
const handleWorldConnection = createWorldHandler({
  rooms, worldMonsters, worldDrops, worldClients,
  broadcast,
  combatSystem, memStore, getDefaultPlayer, markDirty,
  computeArmyYardUpgradeCost, computeArmyYardStats,
  computeKnowledgeUpgradeCost, computeKnowledgeBonuses,
  claimReward, applyWeaponUpgrade, computeWeaponDamageWithUpgrades,
  applyBuildingUpgrade, BUILDING_DEFS, applyResearchUpgrade, sanitizePlayerData,
  warManager,
});

const { createArenaHandler } = require("./server/network/arenaHandler");
const handleArenaConnection = createArenaHandler({ rooms, playerData });

const onlineCore = new NetworkServer();

wss.on("connection", (ws, req) => {
  const url = req.url || "/";

  // Require valid token for world and online connections
  const { wsAuth } = require("./server/network/auth");
  const targetPath = url.split("?")[0];

  if (targetPath === "/ws/world" || targetPath === "/ws/online" || targetPath === "/ws/arena") {
    const authResult = wsAuth(req);
    if (!authResult.authenticated) {
      ws.close(4001, "Authentication required");
      return;
    }
    ws.authUsername = authResult.username;
  }

  ws.isAlive = true;
  ws.lastPingTs = 0;
  ws.on("pong", () => {
    ws.isAlive = true;
    if (ws.lastPingTs > 0 && metrics.enabled) {
      const rtt = performance.now() - ws.lastPingTs;
      metrics.observeLatency(rtt);
    }
  });

  if (targetPath === "/ws/world") {
    handleWorldConnection(ws, req);
    return;
  }

  if (targetPath === "/ws/online") {
    onlineCore.handleConnection(ws, req);
    return;
  }

  handleArenaConnection(ws, req);
});

const HEARTBEAT_INTERVAL = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) return ws.terminate();
    ws.isAlive = false;
    ws.lastPingTs = performance.now();
    ws.ping();
  });
  if (metrics.enabled) {
    metrics.setRoomsActive(rooms.size);
  }
}, 30000);

wss.on("close", () => clearInterval(HEARTBEAT_INTERVAL));

const reqCounts = new Map();
const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Content-Security-Policy": "default-src 'self' data: blob:; connect-src 'self' ws: wss: https://d-king.online https://www.d-king.online wss://d-king.online wss://www.d-king.online https://fonts.googleapis.com https://fonts.gstatic.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com https://fonts.googleapis.com; img-src 'self' data: blob: https:; script-src 'self' 'unsafe-inline'; worker-src 'self' blob:; media-src 'self'",
};

function broadcast(roomCode, message, excludeId) {
  const room = rooms.get(roomCode);
  if (!room) return;
  const data = JSON.stringify(message);
  room.players.forEach((player, id) => {
    if (id === excludeId) return;
    if (player.ws.readyState === 1) player.ws.send(data);
  });
}

function rateLimiter(ip) {
  const now = Date.now();
  let entry = reqCounts.get(ip);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW) {
    entry = { windowStart: now, count: 0 };
    reqCounts.set(ip, entry);
  }
  entry.count++;
  return entry.count <= RATE_LIMIT_MAX;
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, e] of reqCounts) {
    if (now - e.windowStart > RATE_LIMIT_WINDOW * 2) reqCounts.delete(ip);
  }
}, 300_000);

const { serveStatic } = require("./server/network/staticServer");
const { createApiRoutes } = require("./server/routes/api");
const handleApiRequest = createApiRoutes({
  mongoConnected, memStore, Player, getDefaultPlayer, markDirty,
  rooms, BUILDING_DEFS, TICK_MS, claimReward,
});

server.on("request", async (req, res) => {
  const ip = req.socket.remoteAddress || "unknown";
  if (!rateLimiter(ip)) {
    res.writeHead(429, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Too many requests" }));
    return;
  }

  const handled = await handleApiRequest(req, res);
  if (handled) return;

  // أمن: إضافة ترويسات CSP و Security headers لكل الاستجابات
  const origWriteHead = res.writeHead.bind(res);
  res.writeHead = (statusCode, headers) => {
    const finalHeaders = { ...SECURITY_HEADERS, ...(headers || {}) };
    return origWriteHead(statusCode, finalHeaders);
  };

  const urlPath = req.url === "/" ? "/index.html" : req.url;
  if (!serveStatic(urlPath, req, res)) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("404 Not Found");
  }
});

server.listen(PORT, () => {
  const mode = USE_HTTPS ? "HTTPS + WSS" : "HTTP + WS";
  logger.info({ mode, port: PORT, tickMs: TICK_MS, tickHz: 1000 / TICK_MS }, "Server started");
});

// ==================== 🛡️ Global Error Handlers ====================
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
  logger.info("Shutting down...");
  wss.clients.forEach((ws) => ws.close());
  server.close(() => process.exit(0));
});

process.on("SIGINT", () => {
  logger.info("Shutting down...");
  wss.clients.forEach((ws) => ws.close());
  server.close(() => process.exit(0));
});
