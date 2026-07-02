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

// ═══════════════════════════════════════════════════════════════════
//  MongoDB — مباشر بدون n8n
// ═══════════════════════════════════════════════════════════════════
const mongoose = require("mongoose");
mongoose.set("bufferCommands", false); // fail fast إذا MongoDB مش متاح
const MONGO_URL = process.env.MONGO_URL || "mongodb://root:Qwer1%4034@grdjzjetwzevwrj3yy3o82wo:27017/?directConnection=true";
let mongoConnected = false;
mongoose.connect(MONGO_URL, { serverSelectionTimeoutMS: 3000 })
  .then(() => { mongoConnected = true; console.log("[MongoDB] Connected ✅"); })
  .catch(err => { mongoConnected = false; console.warn("[MongoDB] غير متاح — اللعبة تشتغل بدون حفظ:", err.message); });
mongoose.connection.on("disconnected", () => { mongoConnected = false; });

const playerSchema = new mongoose.Schema({
  username:      { type: String, required: true, unique: true, index: true },
  cash:          { type: Number, default: 0 },
  gems:          { type: Number, default: 0 },
  gold:          { type: Number, default: 0 },
  kingCoins:     { type: Number, default: 0 },
  hammers:       { type: Number, default: 0 },
  scrolls:       { type: Number, default: 0 },
  horns:         { type: Number, default: 0 },
  food:          { type: Number, default: 50 },
  army_power:    { type: Number, default: 0 },
  x_position:    { type: Number, default: 1200 },
  y_position:    { type: Number, default: 1200 },
  last_active:   { type: Number, default: 0 },
  unitLevel:     { type: Number, default: 1 },
  weapons:       { type: Array, default: [] },
  xp:           { type: Number, default: 0 },
  level:        { type: Number, default: 1 },
  allianceLevel: { type: Number, default: 0 },
  upgrades:     { type: Object, default: {} },
  oases:        { type: Array, default: [] },
  prestigeLevel: { type: Number, default: 0 },
  achievements: { type: Array, default: [] },
  dailyLogin:   { type: Object, default: {} },
  inventory:    { type: Object, default: {} },
  events:       { type: Array, default: [] },
  tutorial:     { type: Object, default: {} },
  brWins:       { type: Number, default: 0 },
  brKills:      { type: Number, default: 0 },
}, { collection: "players_data", timestamps: false });

const Player = mongoose.model("Player", playerSchema);

// ── In-memory fallback عندما MongoDB مش متاح ──
const memStore = new Map(); // username → data
function getDefaultPlayer(username) {
  return {
    username, cash: 0, gems: 0, gold: 0, kingCoins: 0,
    hammers: 0, scrolls: 0, horns: 0, army_power: 0,
    x_position: 1200, y_position: 1200, last_active: 0, unitLevel: 1, weapons: []
  };
}

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

// ═══════════════════════════════════════════════════════════════════
//  World Map WebSocket — ملتيكاملة العالم المفتوح (بدون Polling)
// ═══════════════════════════════════════════════════════════════════
const worldClients = new Map(); // username → { ws, x, y, army_power, kills, coinsEarned, unitLevel, armyAlive, color }

// ── ألوان مميزة لكل لاعب ──
const PLAYER_COLORS = ["#c0392b","#2980b9","#27ae60","#8e44ad","#d35400","#16a085","#2c3e50","#f39c12","#1abc9c","#e67e22","#9b59b6","#34495e"];
function playerColor(username) {
  let h = 0;
  for (let i = 0; i < username.length; i++) h = username.charCodeAt(i) + ((h << 5) - h);
  return PLAYER_COLORS[Math.abs(h) % PLAYER_COLORS.length];
}

// ── وحوش العالم (مشتركة لكل اللاعبين) ──
const WORLD_W2 = 2400, WORLD_H2 = 2400;
const SAFE_ZONE = { x: WORLD_W2/2 - 120, y: WORLD_H2/2 - 120, w: 240, h: 240 };
const MONSTER_TYPES = [
  { name: "ذئب صحراوي", color: "#8a5a3a", radius: 14, hp: 35, maxHp: 35, damage: 6, rewardMoney: 8 },
  { name: "محارب ظل", color: "#2a1a1a", radius: 18, hp: 65, maxHp: 65, damage: 13, rewardMoney: 18 },
  { name: "زعيم الرمال", color: "#c0392b", radius: 22, hp: 130, maxHp: 130, damage: 24, rewardMoney: 45 },
];
const worldMonsters = [];
function initWorldMonsters() {
  if (worldMonsters.length > 0) return;
  for (let i = 0; i < 12; i++) {
    let x, y;
    do {
      x = 150 + Math.random() * (WORLD_W2 - 300);
      y = 150 + Math.random() * (WORLD_H2 - 300);
    } while (x >= SAFE_ZONE.x && x <= SAFE_ZONE.x + SAFE_ZONE.w && y >= SAFE_ZONE.y && y <= SAFE_ZONE.y + SAFE_ZONE.h);
    const t = MONSTER_TYPES[Math.floor(Math.random() * MONSTER_TYPES.length)];
    worldMonsters.push({
      id: i, ...t,
      x, y, spawnX: x, spawnY: y,
      alive: true, hp: t.maxHp, respawnTimer: 0
    });
  }
}
// دورة respawn + تحريك الوحوش كل ثانية
setInterval(() => {
  let changed = false;
  for (const m of worldMonsters) {
    if (!m.alive) {
      m.respawnTimer -= 1;
      if (m.respawnTimer <= 0) {
        m.alive = true; m.hp = m.maxHp;
        m.x = m.spawnX; m.y = m.spawnY;
        changed = true;
      }
    } else {
      // تحريك الوحوش بدورية خفيفة (كل اللاعبين يشوفون نفس الحركة)
      if (!m._patrolTarget || Math.hypot(m.x - m._patrolTarget.x, m.y - m._patrolTarget.y) < 15) {
        m._patrolTarget = {
          x: m.spawnX + (Math.random() - 0.5) * 180,
          y: m.spawnY + (Math.random() - 0.5) * 180,
        };
      }
      const dx = m._patrolTarget.x - m.x;
      const dy = m._patrolTarget.y - m.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 3) {
        m.x += (dx / dist) * 18;
        m.y += (dy / dist) * 18;
        changed = true;
      }
    }
  }
  // بث الوحوش كل ثانية عشان الكل يشوف نفس الحركة
  const msg = JSON.stringify({ type: "world_monsters", list: worldMonsters });
  worldClients.forEach((c) => { if (c.ws.readyState === 1) c.ws.send(msg); });
}, 1000);

function broadcastWorld(excludeWs = null) {
  const list = [];
  worldClients.forEach((c) => {
    list.push({
      username: c.username, x_position: c.x, y_position: c.y,
      army_power: c.army_power,
      kills: c.kills || 0,
      coinsEarned: c.coinsEarned || 0,
      unitLevel: c.unitLevel || 1,
      armyAlive: c.armyAlive ?? 8,
      color: c.color,
      br_hp: c.br_hp ?? 120,
      br_alive: c.br_alive ?? true,
      last_active: Date.now()
    });
  });
  const msg = JSON.stringify({ type: "world_players", list });
  worldClients.forEach((c) => {
    if (c.ws !== excludeWs && c.ws.readyState === 1) c.ws.send(msg);
  });
}

wss.on("connection", (ws, req) => {
  const url = req.url || "/";
  const ip = req.socket.remoteAddress;

  // ── منع قطع WebSocket (Ping/Pong) ──────────────────────────────
  ws.isAlive = true;
  ws.on("pong", () => { ws.isAlive = true; });

  // ── World Map multiplayer ────────────────────────────────────────
  if (url === "/ws/world") {
    let username = null;
    console.log(`[WorldWS] Connection from ${ip}`);

    ws.on("message", (raw) => {
      let msg;
      try { msg = JSON.parse(raw); } catch { return; }

      if (msg.type === "join") {
        username = msg.username;
        if (!username) return;
        initWorldMonsters();
        const color = playerColor(username);
        worldClients.set(username, {
          ws, username, color,
          x: msg.x_position || 1200,
          y: msg.y_position || 1200,
          army_power: msg.army_power || 0,
          kills: msg.kills || 0,
          coinsEarned: msg.coinsEarned || 0,
          unitLevel: msg.unitLevel || 1,
          armyAlive: msg.armyAlive ?? 8,
          br_hp: msg.br_hp ?? 120,
          br_alive: msg.br_alive ?? true,
        });
        // أرسل قائمة الوحوش للاعب الجديد
        ws.send(JSON.stringify({ type: "world_monsters", list: worldMonsters }));
        broadcastWorld();
        // إشعار بدخول اللاعب
        const joinMsg = JSON.stringify({ type: "player_joined", username });
        worldClients.forEach((c) => {
          if (c.ws !== ws && c.ws.readyState === 1) c.ws.send(joinMsg);
        });
        console.log(`[WorldWS] ${username} joined (color: ${color})`);
      } else if (msg.type === "update" && username) {
        const c = worldClients.get(username);
        if (c) {
          c.x = msg.x_position ?? c.x;
          c.y = msg.y_position ?? c.y;
          c.army_power = msg.army_power ?? c.army_power;
          c.kills = msg.kills ?? c.kills;
          c.coinsEarned = msg.coinsEarned ?? c.coinsEarned;
          c.unitLevel = msg.unitLevel ?? c.unitLevel;
          c.armyAlive = msg.armyAlive ?? c.armyAlive;
          if (msg.br_hp !== undefined) c.br_hp = msg.br_hp;
          if (msg.br_alive !== undefined) c.br_alive = msg.br_alive;
          broadcastWorld(ws);
        }
      } else if (msg.type === "monster_killed" && username) {
        const mon = worldMonsters.find(m => m.id === msg.id);
        if (mon && mon.alive) {
          mon.alive = false;
          mon.hp = 0;
          mon.respawnTimer = 25;
          const killMsg = JSON.stringify({ type: "monster_killed", id: msg.id, killedBy: username });
          worldClients.forEach((c) => { if (c.ws.readyState === 1) c.ws.send(killMsg); });
        }
      } else if (msg.type === "pvp_attack" && username) {
        const target = msg.target;
        const attacker = username;
        const tc = worldClients.get(target);
        if (tc && tc.ws.readyState === 1) {
          tc.ws.send(JSON.stringify({ type: "pvp_notify", attacker, power: msg.myPower || 0 }));
        }
      } else if (msg.type === "chat" && username) {
        const chatMsg = JSON.stringify({ type: "broadcast_chat", username, message: String(msg.message).slice(0, 200) });
        worldClients.forEach((c) => { if (c.ws.readyState === 1) c.ws.send(chatMsg); });
      } else if (msg.type === "br_match_start" && username) {
        const brMsg = JSON.stringify({ type: "br_match_start", mapSize: msg.mapSize, matchDuration: msg.matchDuration });
        worldClients.forEach((c) => { if (c.ws.readyState === 1) c.ws.send(brMsg); });
      } else if (msg.type === "br_zone_shrink" && username) {
        const zMsg = JSON.stringify({ type: "br_zone_shrink", radius: msg.radius, centerX: msg.centerX, centerY: msg.centerY });
        worldClients.forEach((c) => { if (c.ws.readyState === 1) c.ws.send(zMsg); });
      } else if (msg.type === "br_bandit_spawn" && username) {
        const bMsg = JSON.stringify({ type: "br_bandit_spawn", bandit: msg.bandit });
        worldClients.forEach((c) => { if (c.ws.readyState === 1) c.ws.send(bMsg); });
      } else if (msg.type === "br_player_eliminated" && username) {
        const eMsg = JSON.stringify({ type: "br_player_eliminated", playerId: msg.playerId, by: msg.by });
        worldClients.forEach((c) => { if (c.ws.readyState === 1) c.ws.send(eMsg); });
      } else if (msg.type === "br_match_end" && username) {
        const endMsg = JSON.stringify({ type: "br_match_end", winner: msg.winner, kills: msg.kills });
        worldClients.forEach((c) => { if (c.ws.readyState === 1) c.ws.send(endMsg); });
      }
    });

    ws.on("close", () => {
      if (username) {
        const c = worldClients.get(username);
        worldClients.delete(username);
        broadcastWorld();
        // إشعار بخروج اللاعب لكل الباقين
        const leaveMsg = JSON.stringify({ type: "player_left", username });
        worldClients.forEach((cl) => {
          if (cl.ws.readyState === 1) cl.ws.send(leaveMsg);
        });
        console.log(`[WorldWS] ${username} left`);
      }
    });

    ws.on("error", () => {});

    // أرسل القائمة الكاملة فور الاتصال
    const list = [];
    worldClients.forEach((c) => {
      if (c.ws !== ws) list.push({
        username: c.username, x_position: c.x, y_position: c.y,
        army_power: c.army_power,
        kills: c.kills || 0,
        coinsEarned: c.coinsEarned || 0,
        unitLevel: c.unitLevel || 1,
        armyAlive: c.armyAlive ?? 8,
        color: c.color,
        last_active: Date.now()
      });
    });
    ws.send(JSON.stringify({ type: "world_players", list }));
    return;
  }

  // ── Arena (غرفة المعركة) — الكود القديم ──────────────────────────
  let playerId = null;
  let roomCode = null;
  let isAdmin  = false;
  let msgCount = 0;
  let lastReset = Date.now();

  console.log(`[ArenaWS] Connection from ${ip}`);

  ws.on("message", (raw) => {
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
//  Save / Load / Leaderboard API (MongoDB)
// ═══════════════════════════════════════════════════════════════════

const STATIC_EXTS = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "application/javascript; charset=utf-8", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".ico": "image/x-icon" };

function serveStatic(rawUrl, res) {
  const url = rawUrl.split("?")[0]; // strip cache-busting query strings
  const ext = path.extname(url).toLowerCase();
  if (!STATIC_EXTS[ext]) return false;
  // SECURITY: منع Path Traversal عبر resolve مع startsWith
  const safePath = path.resolve(__dirname, url === "/" ? "index.html" : url.replace(/^\//, ""));
  if (!safePath.startsWith(__dirname)) {
    res.writeHead(403); res.end("Forbidden"); return true;
  }
  try {
    const content = fs.readFileSync(safePath);
    // HTTP Security headers + Cache Control
    res.writeHead(200, {
      "Content-Type": STATIC_EXTS[ext],
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff"
    });
    res.end(content);
    return true;
  } catch { return false; }
}

server.on("request", async (req, res) => {
  if (req.headers.upgrade === "websocket") return;
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    res.writeHead(204); res.end(); return;
  }

  // ── API: GET /api/players?all=true ─────────────────────────────
  if (req.url === "/api/players" || req.url.startsWith("/api/players?")) {
    if (req.method === "GET") {
      if (!mongoConnected) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(Array.from(memStore.values())));
        return;
      }
      try {
        const players = await Player.find({}, { _id: 0, __v: 0 }).lean();
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(players));
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }
  }

  // ── API: GET/POST /api/players/:username ───────────────────────
  const playerMatch = req.url.match(/^\/api\/players\/([a-zA-Z0-9_\-\.%\u0600-\u06FF]+)$/);
  if (playerMatch) {
    const username = decodeURIComponent(playerMatch[1]);

    if (req.method === "GET") {
      if (!mongoConnected) {
        const data = memStore.get(username) || getDefaultPlayer(username);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(data));
        return;
      }
      try {
        const data = await Player.findOne({ username }).lean();
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(data || getDefaultPlayer(username)));
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    if (req.method === "POST") {
      let body = "";
      let size = 0;
      req.on("data", chunk => {
        size += chunk.length;
        if (size > 1_048_576) { req.destroy(); return; }
        body += chunk;
      });
      req.on("end", async () => {
        try {
          const data = JSON.parse(body);
          // حفظ في الذاكرة أولاً (دائماً)
          const existing = memStore.get(username) || getDefaultPlayer(username);
          memStore.set(username, { ...existing, ...data, last_active: data.last_active || Date.now() });
          // وحاول في MongoDB إذا متاح
          if (mongoConnected) {
            await Player.updateOne(
              { username },
              { $set: { ...data, last_active: data.last_active || Date.now() } },
              { upsert: true }
            );
          }
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true }));
        } catch (e) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "invalid json" }));
        }
      });
      return;
    }
  }

  // ── API: GET /api/leaderboard?sort=power|kills|level|oases ──────
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
      return;
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
    return;
  }

  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      status: "ok",
      mongo: mongoConnected ? "connected" : "unavailable",
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