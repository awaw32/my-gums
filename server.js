"use strict";

const PORT      = parseInt(process.env.PORT) || 3000;
const USE_HTTPS = process.env.HTTPS === "true" || process.env.HTTPS === "1";
const CERT_DIR  = process.env.CERT_DIR || "/etc/letsencrypt/live";
const ADMIN_KEY = process.env.ADMIN_KEY || "";

let server;

if (USE_HTTPS) {
  const fs = require("fs");
  const https = require("https");
  const domain = process.env.DOMAIN || "localhost";
  let certPath = `${CERT_DIR}/${domain}`;
  let key, cert;
  try {
    key  = fs.readFileSync(`${certPath}/privkey.pem`);
    cert = fs.readFileSync(`${certPath}/fullchain.pem`);
  } catch (e) {
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

const fs = require("fs");
const path = require("path");
const { WebSocketServer } = require("ws");
const wss = new WebSocketServer({ server });

const rooms = new Map();
const playerData = new Map();          // playerId → { save data }
const DATA_DIR = process.env.DATA_DIR || "./data";
try { require("fs").mkdirSync(DATA_DIR, { recursive: true }); } catch {}

const WORLD_W = 3200;
const WORLD_H = 3200;
const TICK_MS = 50;

const MSG_SCHEMAS = {
  join: {
    required: ["playerId"],
    fields: { playerId: "string", name: "string", roomCode: "string", adminKey: "string", level: "number" },
  },
  move: {
    required: ["targetX", "targetY"],
    fields: { targetX: "number", targetY: "number" },
  },
  attack: {
    required: ["targetId"],
    fields: { targetId: "string" },       // ← no client-sent damage
  },
};

function validate(msg, schema) {
  if (!msg || typeof msg !== "object") return false;
  for (const f of schema.required) {
    if (msg[f] === undefined || msg[f] === null) return false;
  }
  for (const [key, type] of Object.entries(schema.fields)) {
    if (msg[key] !== undefined && typeof msg[key] !== type) return false;
  }
  if (schema.fields.targetX !== undefined) {
    if (typeof msg.targetX !== "number" || typeof msg.targetY !== "number") return false;
    if (msg.targetX < 0 || msg.targetX > WORLD_W || msg.targetY < 0 || msg.targetY > WORLD_H) return false;
  }
  if (schema.fields.damage !== undefined) {
    if (msg.damage < 0 || msg.damage > 200) return false;
  }
  return true;
}

function broadcast(roomCode, message, excludeId = null) {
  const room = rooms.get(roomCode);
  if (!room) return;
  const data = JSON.stringify(message);
  room.players.forEach((player, id) => {
    if (id === excludeId) return;
    if (player.ws.readyState === 1) player.ws.send(data);
  });
}

function gameTick() {
  rooms.forEach((room, roomCode) => {
    if (!room.matchStarted) return;
    for (const [id, player] of room.players) {
      if (!player.alive) continue;
      if (player.moveTarget && player.moveTarget.length > 0) {
        const target = player.moveTarget[0];
        const dx = target.x - player.x;
        const dy = target.y - player.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 5) {
          player.moveTarget.shift();
          player.moving = false;
        } else {
          player.x += (dx / dist) * player.speed * (TICK_MS / 1000);
          player.y += (dy / dist) * player.speed * (TICK_MS / 1000);
          player.moving = true;
        }
      } else {
        player.moving = false;
      }
    }
    broadcast(roomCode, {
      type: "state_update",
      tick: room.tick,
      players: Array.from(room.players.entries()).map(([id, p]) => ({
        id, name: p.name, x: Math.round(p.x), y: Math.round(p.y),
        hp: p.hp, alive: p.alive, kills: p.kills, moving: p.moving,
      })),
    });
    room.tick++;
  });
}

setInterval(gameTick, TICK_MS);

wss.on("connection", (ws, req) => {
  const ip = req.socket.remoteAddress;
  let playerId = null;
  let roomCode = null;
  let isAdmin  = false;
  let msgCount = 0;
  let lastReset = Date.now(); // FIXED: rate limit 30 msg/sec

  console.log(`[Server] Connection from ${ip}`);

  ws.on("message", (raw) => {
    // FIXED: rate limit — 30 رسالة في الثانية
    const now = Date.now();
    if (now - lastReset > 1000) { msgCount = 0; lastReset = now; }
    if (++msgCount > 30) { ws.close(1008, "Rate limit"); return; }

    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    switch (msg.type) {

      case "join":
        if (!validate(msg, MSG_SCHEMAS.join)) return;
        playerId = msg.playerId;
        roomCode = (msg.roomCode || "LOBBY").toUpperCase();

        if (!rooms.has(roomCode)) {
          rooms.set(roomCode, {
            admin: null,
            players: new Map(),
            matchStarted: false,
            tick: 0,
          });
        }

        const room = rooms.get(roomCode);
        isAdmin = !!(ADMIN_KEY && msg.adminKey === ADMIN_KEY);
        if (isAdmin || !room.admin) {
          room.admin = playerId;
          isAdmin = true;
        }

        const saved = playerData.get(playerId) || {};
        room.players.set(playerId, {
          ws, name: msg.name || "مقاتل", level: msg.level || 1,
          x: 100 + Math.random() * (WORLD_W - 200),
          y: 100 + Math.random() * (WORLD_H - 200),
          hp: 100, maxHp: 100, speed: 160, alive: true, kills: 0,
          moving: false, moveTarget: [],
          attackPower: saved.attackPower || 15,
          defense: saved.defense || 0,
          joinTime: Date.now(),
        });

        broadcast(roomCode, {
          type: "player_list",
          players: Array.from(room.players.entries()).map(([id, p]) => ({
            id, name: p.name, level: p.level, alive: p.alive,
          })),
          admin: room.admin,
        });

        console.log(`[Server] ${msg.name || playerId} joined ${roomCode} (${room.players.size} players)`);
        break;

      case "move":
        if (!validate(msg, MSG_SCHEMAS.move)) return;
        if (!roomCode || !rooms.has(roomCode)) return;
        const moveRoom = rooms.get(roomCode);
        const movePlayer = moveRoom.players.get(playerId);
        if (!movePlayer || !movePlayer.alive) return;
        movePlayer.moveTarget = [{ x: msg.targetX, y: msg.targetY }];
        break;

      case "attack":
        if (!validate(msg, MSG_SCHEMAS.attack)) return;
        if (!roomCode || !rooms.has(roomCode)) return;
        const atkRoom = rooms.get(roomCode);
        const atkPlayer = atkRoom.players.get(playerId);
        const target = atkRoom.players.get(msg.targetId);
        if (!atkPlayer || !target || !target.alive) return;

        const dist = Math.hypot(atkPlayer.x - target.x, atkPlayer.y - target.y);
        if (dist > 60) return;

        // Server-calculated damage — client cannot inject
        const atkPower = atkPlayer.attackPower || 15;
        const defPower = target.defense || 0;
        const dmg = Math.max(1, Math.floor(atkPower * (1 + Math.random() * 0.2) - defPower * 0.3));
        target.hp -= dmg;
        broadcast(roomCode, {
          type: "attack_result",
          attackerId: playerId,
          targetId: msg.targetId,
          damage: dmg,
          targetHp: target.hp,
        });

        if (target.hp <= 0) {
          target.hp = 0;
          target.alive = false;
          atkPlayer.kills = (atkPlayer.kills || 0) + 1;
          broadcast(roomCode, {
            type: "player_eliminated",
            playerId: msg.targetId,
            killedBy: playerId,
          });
          console.log(`[Server] ${msg.targetId} killed by ${playerId}`);
        }
        break;

      case "match_start":
        if (!roomCode || !rooms.has(roomCode) || !isAdmin) return;
        const msRoom = rooms.get(roomCode);
        msRoom.matchStarted = true;
        broadcast(roomCode, {
          type: "match_start",
          mapSize: WORLD_W,
          matchTime: msg.matchTime || 600,
        });
        console.log(`[Server] Match started in ${roomCode}`);
        break;

      case "zone_shrink":
        if (!roomCode || !rooms.has(roomCode) || !isAdmin) return;
        broadcast(roomCode, {
          type: "zone_shrink",
          radius: msg.radius,
          centerX: msg.centerX,
          centerY: msg.centerY,
        });
        break;

      case "bandit_spawn":
        if (!roomCode || !rooms.has(roomCode) || !isAdmin) return;
        broadcast(roomCode, { type: "bandit_spawn", bandit: msg.bandit });
        break;

      case "signal":
        if (!roomCode || !rooms.has(roomCode)) return;
        broadcast(roomCode, { type: "signal", from: playerId, signal: msg.signal }, playerId);
        break;

      case "ping":
        ws.send(JSON.stringify({ type: "pong" }));
        break;
    }
  });

  ws.on("close", () => {
    if (roomCode && rooms.has(roomCode)) {
      const room = rooms.get(roomCode);
      room.players.delete(playerId);
      if (room.admin === playerId && room.players.size > 0) {
        room.admin = room.players.keys().next().value;
      }
      broadcast(roomCode, {
        type: "player_list",
        players: Array.from(room.players.entries()).map(([id, p]) => ({
          id, name: p.name, level: p.level, alive: p.alive,
        })),
        admin: room.admin,
      });
      if (room.players.size === 0) {
        rooms.delete(roomCode);
        console.log(`[Server] Room ${roomCode} deleted`);
      }
      console.log(`[Server] ${playerId} left ${roomCode}`);
    }
  });

  ws.on("error", (err) => {
    console.error(`[Server] WS error:`, err.message);
  });
});

const INTERVAL = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

wss.on("close", () => clearInterval(INTERVAL));

// ═══════════════════════════════════════════════════════════════════
//  Save / Load / Leaderboard API
// ═══════════════════════════════════════════════════════════════════


function loadPlayerData(playerId) {
  const filePath = path.join(DATA_DIR, `${playerId}.json`);
  try { return JSON.parse(fs.readFileSync(filePath, "utf8")); } catch { return null; }
}

function savePlayerData(playerId, data) {
  const filePath = path.join(DATA_DIR, `${playerId}.json`);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
  // Also keep in memory
  playerData.set(playerId, data);
}

const STATIC_EXTS = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "application/javascript; charset=utf-8", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".ico": "image/x-icon" };

function serveStatic(url, res) {
  const ext = path.extname(url).toLowerCase();
  if (!STATIC_EXTS[ext]) return false;
  // FIXED: منع Path Traversal عبر resolve مع startsWith
  const safePath = path.resolve(__dirname, url === "/" ? "index.html" : url.replace(/^\//, ""));
  if (!safePath.startsWith(__dirname)) {
    res.writeHead(403); res.end("Forbidden"); return true;
  }
  try {
    const content = fs.readFileSync(safePath);
    // FIXED: cache طويل للملفات الثابتة + nosniff
    res.writeHead(200, {
      "Content-Type": STATIC_EXTS[ext],
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff"
    });
    res.end(content);
    return true;
  } catch { return false; }
}

server.on("request", (req, res) => {
  if (req.headers.upgrade === "websocket") return;
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    res.writeHead(204); res.end(); return;
  }

  // ── API: GET /api/load/:playerId ────────────────────────────────
  const loadMatch = req.url.match(/^\/api\/load\/([a-zA-Z0-9_\-]+)$/);
  if (loadMatch && req.method === "GET") {
    const data = loadPlayerData(loadMatch[1]);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(data || { resources: { cash:0, gold:150, gems:10, kingCoins:0, hammers:5, scrolls:0, horns:0 }, level:1, xp:0, villageLevel:1, unitLevel:1, weapons:[] })); // FIXED: API mismatch — default format matches new economy.js
    return;
  }

  // ── API: POST /api/save/:playerId ────────────────────────────────
  const saveMatch = req.url.match(/^\/api\/save\/([a-zA-Z0-9_\-]+)$/);
  if (saveMatch && req.method === "POST") {
    let body = "";
    let size = 0;
    req.on("data", chunk => {
      size += chunk.length;
      if (size > 1_048_576) { req.destroy(); return; } // FIXED: حد 1MB
      body += chunk;
    });
    req.on("end", () => {
      try {
        const data = JSON.parse(body);
        savePlayerData(saveMatch[1], data);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "invalid json" }));
      }
    });
    return;
  }

  // ── API: GET /api/leaderboard ────────────────────────────────────
  if (req.url === "/api/leaderboard" && req.method === "GET") {
    const entries = [];
    try {
      const files = fs.readdirSync(DATA_DIR);
      for (const f of files) {
        if (!f.endsWith(".json")) continue;
        try {
          const data = JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), "utf8"));
          entries.push({ playerId: f.replace(".json", ""), power: data.power || 0, level: data.villageLevel || 1 });
        } catch {}
      }
    } catch {}
    entries.sort((a, b) => b.power - a.power);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(entries.slice(0, 50)));
    return;
  }

  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      status: "ok",
      rooms: rooms.size,
      players: Array.from(rooms.values()).reduce((acc, r) => acc + r.players.size, 0),
      uptime: process.uptime(),
      tickRate: 1000 / TICK_MS,
    }));
    return;
  }
  // ── Static file serving ───────────────────────────────────────────
  const urlPath = req.url === "/" ? "/index.html" : req.url;
  if (!serveStatic(urlPath, res)) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("404 Not Found");
  }
});

server.listen(PORT, () => {
  const mode = USE_HTTPS ? "HTTPS + WSS" : "HTTP + WS";
  console.log(`\nDesert Kingdom Server`);
  console.log(`  ${mode}`);
  console.log(`  Port: ${PORT}`);
  console.log(`  Tick: ${TICK_MS}ms (${1000/TICK_MS}Hz)`);
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
