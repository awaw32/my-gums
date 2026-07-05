"use strict";

const PORT      = parseInt(process.env.PORT) || 3000;
const USE_HTTPS = process.env.HTTPS === "true" || process.env.HTTPS === "1";
const CERT_DIR  = process.env.CERT_DIR || "/etc/letsencrypt/live";
const ADMIN_KEY = process.env.ADMIN_KEY || "";
const BUILD_ID = Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 6);

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
try { require("fs").mkdirSync(DATA_DIR, { recursive: true }); } catch (e) { console.warn("[Server] Cannot create DATA_DIR:", e.message); }

// ═══════════════════════════════════════════════════════════════════
//  Database Helper — MongoDB + in-memory fallback
// ═══════════════════════════════════════════════════════════════════
const {
  mongoConnected,
  memStore,
  Player,
  getDefaultPlayer,
} = require("./server/db/databaseHelper");

// ═══════════════════════════════════════════════════════════════════
//  Combat Formulas
// ═══════════════════════════════════════════════════════════════════
const {
  computeArmyYardUpgradeCost,
  computeArmyYardStats,
  computeKnowledgeUpgradeCost,
  computeKnowledgeBonuses,
} = require("./server/logic/formulas");

// ═══════════════════════════════════════════════════════════════════
//  Rewards Box Engine
// ═══════════════════════════════════════════════════════════════════
const { claimReward } = require("./server/logic/rewards");

// ═══════════════════════════════════════════════════════════════════
//  Weapon Upgrade — 5 Stars × 8 Gems
// ═══════════════════════════════════════════════════════════════════
const {
  applyGemUpgrade, applyStarUpgrade,
  computeWeaponDamageWithUpgrades,
} = require("./server/logic/weaponUpgrade");

// ═══════════════════════════════════════════════════════════════════
//  Buildings — Interconnected Building System
// ═══════════════════════════════════════════════════════════════════
const {
  applyBuildingUpgrade,
  BUILDING_DEFS,
} = require("./server/db/buildings");

// ═══════════════════════════════════════════════════════════════════
//  Research — Research Tree
// ═══════════════════════════════════════════════════════════════════
const {
  applyResearchUpgrade,
} = require("./server/db/research");

const WORLD_W = 3200;
const WORLD_H = 3200;
const TICK_MS = 50;

// ═══════════════════════════════════════════════════════════════════
//  Combat Loop — arena ticks + world monster patrol
// ═══════════════════════════════════════════════════════════════════
const worldMonsters = [];
const WORLD_W2 = 2400, WORLD_H2 = 2400;
const SAFE_ZONE = { x: WORLD_W2/2 - 120, y: WORLD_H2/2 - 120, w: 240, h: 240 };

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
    fields: { targetId: "string" },
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

const worldClients = new Map();

const { createCombatLoop } = require("./server/logic/combatLoop");
const combatSystem = createCombatLoop({
  rooms, broadcast, WORLD_W, TICK_MS,
  worldMonsters, worldClients,
  SAFE_ZONE, WORLD_W2, WORLD_H2,
});

// ═══════════════════════════════════════════════════════════════════
//  World Map WebSocket — ملتيكاملة العالم المفتوح (بدون Polling)
// ═══════════════════════════════════════════════════════════════════

// ── ألوان مميزة لكل لاعب ──
const PLAYER_COLORS = ["#c0392b","#2980b9","#27ae60","#8e44ad","#d35400","#16a085","#2c3e50","#f39c12","#1abc9c","#e67e22","#9b59b6","#34495e"];
function playerColor(username) {
  let h = 0;
  for (let i = 0; i < username.length; i++) h = username.charCodeAt(i) + ((h << 5) - h);
  return PLAYER_COLORS[Math.abs(h) % PLAYER_COLORS.length];
}

// ── وحوش العالم يتم إدارتها في combatLoop ──

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
      hp: c.hp ?? c.br_hp ?? 120,
      maxHp: c.maxHp ?? 120,
      br_hp: c.br_hp ?? 120,
      br_alive: c.br_alive ?? true,
      armyYardLevel: c.armyYardLevel || 1,
      knowledgeLevel: c.knowledgeLevel || 1,
      knowledgeType: c.knowledgeType || "economic",
      equippedWeapon: c.equippedWeapon || "",
      weaponStarLevel: c.weaponStarLevel || 1,
      weaponGemLevel: c.weaponGemLevel || 1,
      last_active: Date.now()
    });
  });
  const msg = JSON.stringify({ type: "world_players", list });
  worldClients.forEach((c) => {
    if (c.ws !== excludeWs && c.ws.readyState === 1) c.ws.send(msg);
  });
}

const { sanitizePlayerData } = require("./server/validation/player");

const NetworkServer = require("./server/network/networkServer");
const onlineCore = new NetworkServer();

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
        combatSystem.initWorldMonsters();
        const color = playerColor(username);
        const initHP = msg.hp ?? 120;
        const initMaxHP = msg.maxHp ?? 120;
        worldClients.set(username, {
          ws, username, color,
          x: msg.x_position || 1200,
          y: msg.y_position || 1200,
          army_power: msg.army_power || 5000,
          kills: msg.kills || 0,
          coinsEarned: msg.coinsEarned || 0,
          unitLevel: msg.unitLevel || 1,
          armyAlive: msg.armyAlive ?? 8,
          hp: initHP,
          maxHp: initMaxHP,
          level: msg.level || 1,
          trainingLevel: msg.trainingLevel || 1,
          prestigeLevel: msg.prestigeLevel || 0,
          armyYardLevel: msg.armyYardLevel || 1,
          knowledgeLevel: msg.knowledgeLevel || 1,
          knowledgeType: msg.knowledgeType || "economic",
          equippedWeapon: msg.equippedWeapon || "",
          weapons: msg.weapons || [],
          weaponStarLevel: msg.weaponStarLevel || 1,
          weaponGemLevel: msg.weaponGemLevel || 1,
          br_hp: msg.br_hp ?? 120,
          br_alive: msg.br_alive ?? true,
          buildings: msg.buildings || {},
          research: msg.research || {},
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
          if (msg.hp !== undefined) c.hp = msg.hp;
          if (msg.maxHp !== undefined) c.maxHp = msg.maxHp;
          if (msg.level !== undefined) c.level = msg.level;
          if (msg.br_hp !== undefined) c.br_hp = msg.br_hp;
          if (msg.br_alive !== undefined) c.br_alive = msg.br_alive;
          if (msg.armyYardLevel !== undefined) c.armyYardLevel = msg.armyYardLevel;
          if (msg.knowledgeLevel !== undefined) c.knowledgeLevel = msg.knowledgeLevel;
          if (msg.knowledgeType !== undefined) c.knowledgeType = msg.knowledgeType;
          if (msg.equippedWeapon !== undefined) c.equippedWeapon = msg.equippedWeapon;
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
      } else if (msg.type === "pvp_result" && username) {
        const targetName = msg.target;
        const won = msg.won;
        const loot = msg.loot || 0;
        const reward = msg.winnerReward || 0;
        const tc = worldClients.get(targetName);
        // notify target about the result
        if (tc && tc.ws.readyState === 1) {
          tc.ws.send(JSON.stringify({
            type: "pvp_result",
            attacker: username,
            won: !won,
            loot: won ? 0 : loot,
            reward: won ? 0 : reward,
            myPower: msg.myPower || 0,
          }));
        }
        // if winner gets loot, the target's session coins are lost
        if (!won && loot > 0 && tc) {
          tc.sessionCoins = Math.max(0, (tc.sessionCoins || 0) - loot);
        }
        // if attacker won, broadcast player_despawn for the target
        if (won) {
          const despawnMsg = JSON.stringify({ type: "player_despawn", username: targetName });
          worldClients.forEach((c) => { if (c.ws.readyState === 1) c.ws.send(despawnMsg); });
        }
        // broadcast PvP notification
        const pvpMsg = JSON.stringify({
          type: "broadcast_chat",
          username: "⚔️ النظام",
          message: won
            ? `${username} انتصر على ${targetName}!`
            : `${targetName} هزم ${username}!`,
        });
        worldClients.forEach((c) => { if (c.ws.readyState === 1) c.ws.send(pvpMsg); });
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
      } else if (msg.type === "equip_weapon" && username) {
        const c = worldClients.get(username);
        if (c) {
          const weaponId = msg.weaponId || "";
          c.equippedWeapon = weaponId;
          const reply = JSON.stringify({ type: "equip_weapon_ack", weaponId });
          if (c.ws.readyState === 1) c.ws.send(reply);
          broadcastWorld(ws);
        }
      } else if (msg.type === "upgrade_army_yard" && username) {
        const c = worldClients.get(username);
        if (c) {
          const playerData = memStore.get(username) || getDefaultPlayer(username);
          const currentLevel = c.armyYardLevel || 1;
          const cost = computeArmyYardUpgradeCost(currentLevel);
          for (const [res, val] of Object.entries(cost)) {
            const have = (playerData[res] || 0);
            if (have < val) {
              if (c.ws.readyState === 1) c.ws.send(JSON.stringify({
                type: "upgrade_army_yard_ack", ok: false,
                reason: `غير كافٍ ${res}: تحتاج ${val}، لديك ${have}`
              }));
              return;
            }
          }
          for (const [res, val] of Object.entries(cost)) {
            playerData[res] = (playerData[res] || 0) - val;
          }
          memStore.set(username, playerData);
          c.armyYardLevel = currentLevel + 1;
          const stats = computeArmyYardStats(c.armyYardLevel);
          const reply = JSON.stringify({
            type: "upgrade_army_yard_ack", ok: true,
            armyYardLevel: c.armyYardLevel,
            maxTroops: stats.maxTroops,
            hpBonus: stats.hpBonus,
          });
          if (c.ws.readyState === 1) c.ws.send(reply);
          broadcastWorld(ws);
        }
      } else if (msg.type === "upgrade_knowledge" && username) {
        const c = worldClients.get(username);
        if (c) {
          const playerData = memStore.get(username) || getDefaultPlayer(username);
          const currentLevel = c.knowledgeLevel || 1;
          const cost = computeKnowledgeUpgradeCost(currentLevel);
          for (const [res, val] of Object.entries(cost)) {
            const have = (playerData[res] || 0);
            if (have < val) {
              if (c.ws.readyState === 1) c.ws.send(JSON.stringify({
                type: "upgrade_knowledge_ack", ok: false,
                reason: `غير كافٍ ${res}: تحتاج ${val}، لديك ${have}`
              }));
              return;
            }
          }
          for (const [res, val] of Object.entries(cost)) {
            playerData[res] = (playerData[res] || 0) - val;
          }
          memStore.set(username, playerData);
          c.knowledgeLevel = currentLevel + 1;
          if (msg.knowledgeType) c.knowledgeType = msg.knowledgeType;
          const bonuses = computeKnowledgeBonuses({ knowledgeLevel: c.knowledgeLevel, knowledgeType: c.knowledgeType });
          const reply = JSON.stringify({
            type: "upgrade_knowledge_ack", ok: true,
            knowledgeLevel: c.knowledgeLevel,
            knowledgeType: c.knowledgeType,
            ...bonuses,
          });
          if (c.ws.readyState === 1) c.ws.send(reply);
          broadcastWorld(ws);
        }
      } else if (msg.type === "claim_gift" && username) {
        const c = worldClients.get(username);
        if (c) {
          const playerData = memStore.get(username) || getDefaultPlayer(username);
          const result = claimReward(playerData);
          memStore.set(username, playerData);
          if (result.claimed) {
            c.gems = (c.gems || 0) + result.reward.gems;
            c.gold = (c.gold || 0) + result.reward.gold;
            c.hammers = (c.hammers || 0) + result.reward.hammers;
            c.scrolls = (c.scrolls || 0) + result.reward.scrolls;
          }
          const reply = JSON.stringify({ type: "claim_gift_ack", ...result });
          if (c.ws.readyState === 1) c.ws.send(reply);
        }
      } else if (msg.type === "upgrade_weapon_gem" && username) {
        const c = worldClients.get(username);
        if (c) {
          const playerData = memStore.get(username) || getDefaultPlayer(username);
          const weaponId = msg.weaponId || c.equippedWeapon || "";
          if (!weaponId) {
            if (c.ws.readyState === 1) c.ws.send(JSON.stringify({ type: "upgrade_weapon_ack", ok: false, reason: "اختر سلاحاً أولاً" }));
            return;
          }
          const result = applyGemUpgrade(playerData, weaponId);
          memStore.set(username, playerData);
          if (result.ok) {
            c.weaponStarLevel = result.starLevel;
            c.weaponGemLevel = result.gemLevel;
          }
          const stats = computeWeaponDamageWithUpgrades(playerData);
          const reply = JSON.stringify({ type: "upgrade_weapon_ack", ...result, ...stats });
          if (c.ws.readyState === 1) c.ws.send(reply);
        }
      } else if (msg.type === "upgrade_weapon_star" && username) {
        const c = worldClients.get(username);
        if (c) {
          const playerData = memStore.get(username) || getDefaultPlayer(username);
          const weaponId = msg.weaponId || c.equippedWeapon || "";
          if (!weaponId) {
            if (c.ws.readyState === 1) c.ws.send(JSON.stringify({ type: "upgrade_weapon_ack", ok: false, reason: "اختر سلاحاً أولاً" }));
            return;
          }
          const result = applyStarUpgrade(playerData, weaponId);
          memStore.set(username, playerData);
          if (result.ok) {
            c.weaponStarLevel = result.starLevel;
            c.weaponGemLevel = result.gemLevel;
            const glowMsg = JSON.stringify({
              type: "weapon_glow",
              username,
              weaponId,
              starLevel: result.starLevel,
              color: "#FFD700"
            });
            worldClients.forEach((cl) => { if (cl.ws.readyState === 1) cl.ws.send(glowMsg); });
          }
          const stats = computeWeaponDamageWithUpgrades(playerData);
          const reply = JSON.stringify({ type: "upgrade_weapon_ack", ...result, ...stats });
          if (c.ws.readyState === 1) c.ws.send(reply);
        }
      } else if (msg.type === "upgrade_building" && username) {
        const c = worldClients.get(username);
        if (c) {
          const buildingId = msg.buildingId;
          if (!buildingId || !BUILDING_DEFS[buildingId]) {
            if (c.ws.readyState === 1) c.ws.send(JSON.stringify({ type: "upgrade_building_ack", ok: false, reason: "مبنى غير معروف" }));
            return;
          }
          const playerData = memStore.get(username) || getDefaultPlayer(username);
          const result = applyBuildingUpgrade(playerData, buildingId);
          memStore.set(username, playerData);
          if (result.ok && c) {
            if (!c.buildings) c.buildings = {};
            c.buildings[buildingId] = result.newLevel;
          }
          const reply = JSON.stringify({ type: "upgrade_building_ack", ...result });
          if (c.ws.readyState === 1) c.ws.send(reply);
        }
      } else if (msg.type === "upgrade_research" && username) {
        const c = worldClients.get(username);
        if (c) {
          const categoryId = msg.categoryId;
          const skillId = msg.skillId;
          if (!categoryId || !skillId) {
            if (c.ws.readyState === 1) c.ws.send(JSON.stringify({ type: "upgrade_research_ack", ok: false, reason: "بيانات البحث ناقصة" }));
            return;
          }
          const playerData = memStore.get(username) || getDefaultPlayer(username);
          const result = applyResearchUpgrade(playerData, categoryId, skillId);
          memStore.set(username, playerData);
          if (result.ok && c) {
            if (!c.research) c.research = {};
            c.research[`${categoryId}.${skillId}`] = result.newLevel;
          }
          const reply = JSON.stringify({ type: "upgrade_research_ack", ...result });
          if (c.ws.readyState === 1) c.ws.send(reply);
        }
      }
    });

    ws.on("close", () => {
      if (username) {
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

    ws.on("error", (err) => { console.warn(`[WorldWS] Connection error:`, err.message); });

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
        hp: c.hp ?? c.br_hp ?? 120,
        maxHp: c.maxHp ?? 120,
        br_hp: c.br_hp ?? 120,
        br_alive: c.br_alive ?? true,
        armyYardLevel: c.armyYardLevel || 1,
        knowledgeLevel: c.knowledgeLevel || 1,
        knowledgeType: c.knowledgeType || "economic",
        equippedWeapon: c.equippedWeapon || "",
        weaponStarLevel: c.weaponStarLevel || 1,
        weaponGemLevel: c.weaponGemLevel || 1,
        last_active: Date.now()
      });
    });
    ws.send(JSON.stringify({ type: "world_players", list }));
    return;
  }

  // ── Online Core — WebSocket للعب الجماعي بالغرف ─────────────────
  if (url === "/ws/online") {
    onlineCore.handleConnection(ws, req);
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

/** ضبط سياسة التخزين المؤقت حسب نوع الملف */
function cachePolicy(ext) {
  if (ext === ".html") return "no-cache, must-revalidate";
  if (ext === ".js" || ext === ".css") return "public, max-age=0, must-revalidate";
  return "public, max-age=86400, must-revalidate"; // images
}

/** حساب ETag من تعديل الملف وحجمه */
function computeETag(filePath) {
  try {
    const stat = fs.statSync(filePath);
    const mtime = stat.mtimeMs;
    const size = stat.size;
    return `"${size.toString(16)}-${mtime.toString(16)}"`;
  } catch { return null; }
}

function serveStatic(rawUrl, req, res) {
  const url = rawUrl.split("?")[0];
  const ext = path.extname(url).toLowerCase();
  if (!STATIC_EXTS[ext]) return false;
  const cleanPath = url === "/" ? "index.html" : url.replace(/^\//, "");
  const safePath = path.resolve(__dirname, cleanPath);
  if (!safePath.startsWith(__dirname)) {
    res.writeHead(403); res.end("Forbidden"); return true;
  }
  // محاولة المسار الأساسي ثم public/ كاحتياطي
  let filePath = safePath;
  let content = null;
  try {
    content = fs.readFileSync(safePath);
  } catch {
    const pubPath = path.resolve(__dirname, "public", cleanPath);
    if (pubPath.startsWith(path.resolve(__dirname, "public"))) {
      try { content = fs.readFileSync(pubPath); filePath = pubPath; } catch { return false; }
    } else {
      return false;
    }
  }
  // ETag للمقارنة — يرجع 304 إذا الملف ما تغير
  const etag = computeETag(filePath);
  if (etag && req.headers["if-none-match"] === etag) {
    res.writeHead(304);
    res.end();
    return true;
  }
  const headers = {
    "Content-Type": STATIC_EXTS[ext],
    "Cache-Control": cachePolicy(ext),
    "X-Content-Type-Options": "nosniff"
  };
  if (etag) headers["ETag"] = etag;
  res.writeHead(200, headers);
  res.end(content);
  return true;
}

// ── Rate limiter (in-memory, per-IP) ───────────────────────────
const reqCounts = new Map();
const RATE_LIMIT_WINDOW = 60_000; // 1 minute
const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX) || 120;
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
// دوري — تنظيف الـ IPs القديمة كل 5 دقائق
setInterval(() => {
  const now = Date.now();
  for (const [ip, e] of reqCounts) {
    if (now - e.windowStart > RATE_LIMIT_WINDOW * 2) reqCounts.delete(ip);
  }
}, 300_000);

server.on("request", async (req, res) => {
  if (req.headers.upgrade === "websocket") return;

  // ── Rate limiting ────────────────────────────────────────────
  const ip = req.socket.remoteAddress || "unknown";
  if (!rateLimiter(ip)) {
    res.writeHead(429, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Too many requests" }));
    return;
  }

  // ── Security headers (helmet-like) ───────────────────────────
  const corsOrigin = process.env.CORS_ORIGIN || false;
  if (corsOrigin) {
    res.setHeader("Access-Control-Allow-Origin", corsOrigin);
  } else {
    res.setHeader("Access-Control-Allow-Origin", "*");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "0");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
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
        let data = memStore.get(username) || getDefaultPlayer(username);
        // ترحيل السلاح القديم: لو level موجود و starLevel/ gemLevel مش موجودين
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
        return;
      }
      try {
        let data = await Player.findOne({ username }).lean();
        if (!data) data = getDefaultPlayer(username);
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
          const rawData = JSON.parse(body);
          const data = sanitizePlayerData(rawData);
          const lastActive = data.last_active || Date.now();
          // حفظ في الذاكرة أولاً (دائماً)
          const existing = memStore.get(username) || getDefaultPlayer(username);
          memStore.set(username, { ...existing, ...data, last_active: lastActive });
          // وحاول في MongoDB إذا متاح
          if (mongoConnected) {
            await Player.updateOne(
              { username },
              { $set: { ...data, last_active: lastActive } },
              { upsert: true }
            );
          }
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true }));
        } catch (e) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: e.message || "invalid json" }));
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

  // ── API: POST /api/upgrades/:username ──────────────────────────
  const upgradeMatch = req.url.match(/^\/api\/upgrades\/([a-zA-Z0-9_\-\.%\u0600-\u06FF]+)$/);
  if (upgradeMatch && req.method === "POST") {
    const uname = decodeURIComponent(upgradeMatch[1]);
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
        if (mongoConnected) {
          await Player.updateOne({ username: uname }, { $set: updated }, { upsert: true });
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

  // ── API: GET /api/rewards/status/:username ──────────────────────
  const rewardStatusMatch = req.url.match(/^\/api\/rewards\/status\/([a-zA-Z0-9_\-\.%\u0600-\u06FF]+)$/);
  if (rewardStatusMatch && req.method === "GET") {
    const uname = decodeURIComponent(rewardStatusMatch[1]);
    const playerData = memStore.get(uname) || getDefaultPlayer(uname);
    const { canClaimReward } = require("./server/logic/rewards");
    const canClaim = canClaimReward(playerData);
    const remainingMs = canClaim ? 0 : (4 * 60 * 60 * 1000) - (Date.now() - (playerData.lastGiftClaimedTimestamp || 0));
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ canClaim, remainingMs }));
    return;
  }

  // ── API: POST /api/rewards/claim/:username ──────────────────────
  const rewardClaimMatch = req.url.match(/^\/api\/rewards\/claim\/([a-zA-Z0-9_\-\.%\u0600-\u06FF]+)$/);
  if (rewardClaimMatch && req.method === "POST") {
    const uname = decodeURIComponent(rewardClaimMatch[1]);
    const playerData = memStore.get(uname) || getDefaultPlayer(uname);
    const result = claimReward(playerData);
    memStore.set(uname, playerData);
    if (result.claimed && mongoConnected) {
      await Player.updateOne({ username: uname }, { $set: playerData }, { upsert: true });
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(result));
    return;
  }

  // ── API: GET /api/buildings — building definitions ──────────────
  if (req.url === "/api/buildings" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(BUILDING_DEFS));
    return;
  }

  // ── API: GET /api/research — research tree definitions ──────────
  if (req.url === "/api/research" && req.method === "GET") {
    const { RESEARCH_DEFS } = require("./server/db/research");
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(RESEARCH_DEFS));
    return;
  }

  // ── API: GET /api/weapons/defs — weapon definitions ─────────────
  if (req.url === "/api/weapons/defs" && req.method === "GET") {
    const { WEAPON_DEFS } = require("./server/db/databaseHelper");
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(WEAPON_DEFS));
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
  // ── API: GET /version ────────────────────────────────────────────
  if (req.url === "/version") {
    res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-cache" });
    res.end(JSON.stringify({ buildId: BUILD_ID }));
    return;
  }
  // ── Static file serving ───────────────────────────────────────────
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