"use strict";

const fs = require("fs");
const { WebSocketServer } = require("ws");

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
    console.warn(`[Server] SSL certs not found at ${certPath}, falling back to HTTP`);
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

try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (e) { console.warn("[Server] Cannot create DATA_DIR:", e.message); }

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

const worldMonsters = [];
const WORLD_W2 = 2400, WORLD_H2 = 2400;
const SAFE_ZONE = { x: WORLD_W2 / 2 - 120, y: WORLD_H2 / 2 - 120, w: 240, h: 240 };
const worldClients = new Map();

const { createCombatLoop } = require("./server/logic/combatLoop");
const combatSystem = createCombatLoop({
  rooms, broadcast: (roomCode, message, excludeId) => {
    const room = rooms.get(roomCode);
    if (!room) return;
    const data = JSON.stringify(message);
    room.players.forEach((player, id) => {
      if (id === excludeId) return;
      if (player.ws.readyState === 1) player.ws.send(data);
    });
  },
  WORLD_W, TICK_MS, worldMonsters, worldClients, SAFE_ZONE, WORLD_W2, WORLD_H2,
});

const { createWorldHandler } = require("./server/network/worldHandler");
const handleWorldConnection = createWorldHandler({
  rooms, worldMonsters, worldClients,
  broadcast: (roomCode, message, excludeId) => {
    const room = rooms.get(roomCode);
    if (!room) return;
    const data = JSON.stringify(message);
    room.players.forEach((player, id) => {
      if (id === excludeId) return;
      if (player.ws.readyState === 1) player.ws.send(data);
    });
  },
  combatSystem, memStore, getDefaultPlayer, markDirty,
  computeArmyYardUpgradeCost, computeArmyYardStats,
  computeKnowledgeUpgradeCost, computeKnowledgeBonuses,
  claimReward, applyWeaponUpgrade, computeWeaponDamageWithUpgrades,
  applyBuildingUpgrade, BUILDING_DEFS, applyResearchUpgrade, sanitizePlayerData,
});

const { createArenaHandler } = require("./server/network/arenaHandler");
const handleArenaConnection = createArenaHandler({ rooms, playerData });

const onlineCore = new NetworkServer();

wss.on("connection", (ws, req) => {
  const url = req.url || "/";

  ws.isAlive = true;
  ws.on("pong", () => { ws.isAlive = true; });

  if (url === "/ws/world") {
    handleWorldConnection(ws, req);
    return;
  }

  if (url === "/ws/online") {
    onlineCore.handleConnection(ws, req);
    return;
  }

  handleArenaConnection(ws, req);
});

const HEARTBEAT_INTERVAL = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

wss.on("close", () => clearInterval(HEARTBEAT_INTERVAL));

const reqCounts = new Map();
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

  const urlPath = req.url === "/" ? "/index.html" : req.url;
  if (!serveStatic(urlPath, req, res)) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("404 Not Found");
  }
});

server.listen(PORT, () => {
  const mode = USE_HTTPS ? "HTTPS + WSS" : "HTTP + WS";
  console.log(`\nDesert Kingdom Server`);
  console.log(`  ${mode}`);
  console.log(`  Port: ${PORT}`);
  console.log(`  Tick: ${TICK_MS}ms (${1000 / TICK_MS}Hz)`);
  console.log(`  Health: http://localhost:${PORT}/health\n`);
});

process.on("SIGTERM", () => {
  console.log("\nShutting down...");
  wss.clients.forEach((ws) => ws.close());
  server.close(() => process.exit(0));
});

process.on("SIGINT", () => {
  console.log("\nShutting down...");
  wss.clients.forEach((ws) => ws.close());
  server.close(() => process.exit(0));
});
