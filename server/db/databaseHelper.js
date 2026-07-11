"use strict";

const mongoose = require("mongoose");
const logger = require("../logger");
mongoose.set("bufferCommands", false);

const MONGO_URL = process.env.MONGO_URL || process.env.MONGO_URI;
let mongoConnected = false;

if (!MONGO_URL) {
  logger.warn("MONGO_URL/MONGO_URI not set — running in-memory only");
} else {
  mongoose.connect(MONGO_URL, { serverSelectionTimeoutMS: 3000 })
    .then(() => { mongoConnected = true; logger.info("MongoDB connected"); })
    .catch(err => { mongoConnected = false; logger.warn({ err: err.message }, "MongoDB unavailable — running in-memory"); });
  mongoose.connection.on("disconnected", () => { mongoConnected = false; });
}

const WEAPON_DEFS = [
  { id: "w1", name: "سيف بدوي",       baseDamage: 4,  damagePerLevel: 3,  range: "melee",  critChance: 0.05, critMultiplier: 1.5, cashPrice: 100,  requireLevel: 1 },
  { id: "w2", name: "قوس طويل",       baseDamage: 6,  damagePerLevel: 4,  range: "ranged", critChance: 0.08, critMultiplier: 1.8, cashPrice: 400,  requireLevel: 2 },
  { id: "w3", name: "رمح حديدي",      baseDamage: 9,  damagePerLevel: 6,  range: "melee",  critChance: 0.10, critMultiplier: 2.0, cashPrice: 1200, requireLevel: 3 },
  { id: "w4", name: "سيف دمشقي",      baseDamage: 13, damagePerLevel: 8,  range: "melee",  critChance: 0.12, critMultiplier: 2.2, cashPrice: 4000, requireLevel: 4 },
  { id: "w5", name: "قوس ناري",       baseDamage: 18, damagePerLevel: 10, range: "ranged", critChance: 0.15, critMultiplier: 2.5, cashPrice: 12000, requireLevel: 5 },
  { id: "w6", name: "فأس معركة",      baseDamage: 24, damagePerLevel: 14, range: "melee",  critChance: 0.18, critMultiplier: 3.0, cashPrice: 25000, requireLevel: 6 },
];

const playerSchema = new mongoose.Schema({
  username:       { type: String, required: true, unique: true, index: true },
  cash:           { type: Number, default: 0 },
  gems:           { type: Number, default: 0 },
  gold:           { type: Number, default: 0 },
  hammers:        { type: Number, default: 0 },
  scrolls:        { type: Number, default: 0 },
  food:           { type: Number, default: 50 },
  army_power:     { type: Number, default: 5000 },
  x_position:     { type: Number, default: 1200 },
  y_position:     { type: Number, default: 1200 },
  last_active:    { type: Number, default: 0 },
  unitLevel:      { type: Number, default: 1 },
  trainingLevel:  { type: Number, default: 1 },
  weapons:        { type: Array, default: [] },
  equippedWeapon: { type: String, default: "" },
  armyYardLevel:  { type: Number, default: 1 },
  knowledgeLevel: { type: Number, default: 1 },
  knowledgeType:  { type: String, default: "economic" },
  lastGiftClaimedTimestamp: { type: Number, default: 0 },
  landsState:     { type: Object, default: {} },
  xp:            { type: Number, default: 0 },
  level:         { type: Number, default: 1 },
  allianceLevel:  { type: Number, default: 0 },
  upgrades:       { type: Object, default: {} },
  oases:          { type: Array, default: [] },
  prestigeLevel:  { type: Number, default: 0 },
  achievements:   { type: Array, default: [] },
  dailyLogin:     { type: Object, default: {} },
  inventory:      { type: Object, default: {} },
  events:         { type: Array, default: [] },
  tutorial:       { type: Object, default: {} },
  story:          { type: Object, default: {} },
  brWins:         { type: Number, default: 0 },
  brKills:        { type: Number, default: 0 },
  buildings:      { type: Object, default: {} },
  research:       { type: Object, default: {} },
  hero:           { type: Object, default: {} },
}, { collection: "players_data", timestamps: false });

const Player = mongoose.model("Player", playerSchema);

const memStore = new Map();

function getDefaultPlayer(username) {
  return {
    username, cash: 0, gems: 0, gold: 0,
    hammers: 0, scrolls: 0, food: 50,
    army_power: 5000,
    x_position: 1200, y_position: 1200, last_active: 0,
    unitLevel: 1, trainingLevel: 1,
    weapons: [], equippedWeapon: "",
    armyYardLevel: 1, knowledgeLevel: 1, knowledgeType: "economic",
    lastGiftClaimedTimestamp: 0,
    landsState: {},
    xp: 0, level: 1,
    allianceLevel: 0, upgrades: {},
    oases: [], prestigeLevel: 0,
    achievements: [], dailyLogin: {},
    inventory: {}, events: [], tutorial: {},
    story: {},
    brWins: 0, brKills: 0,
    buildings: {},
    research: {},
    hero: {},
  };
}

function ensureMinPower(playerData) {
  if (!playerData.army_power || playerData.army_power < 5000) {
    playerData.army_power = 5000;
  }
  return playerData;
}

// ═══════════════════════════════════════════════════════════════════
//  SQLite — تخزين دائم بدون MongoDB (essential للـ VPS)
// ═══════════════════════════════════════════════════════════════════
let sqliteDb = null;
let sqliteAvailable = false;
const DATA_DIR = process.env.DATA_DIR || "./data";

// متغيرات عامة للـ dirty tracking — معرفة خارج الـ try عشان savePlayer يقدر يناديها
let _dirtyUsernames = null;
let markDirty = (_username) => {};      // no-op افتراضي
let flushToSQLite = (_username) => {};  // no-op افتراضي

try {
  const path = require("path");
  const fs = require("fs");
  const dbPath = path.resolve(DATA_DIR, "desert-kingdom.db");

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const Database = require("better-sqlite3");
  sqliteDb = new Database(dbPath);

  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS players (
      username TEXT PRIMARY KEY NOT NULL,
      data TEXT NOT NULL,
      last_active INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    )
  `);

  sqliteDb.exec(`
    CREATE INDEX IF NOT EXISTS idx_players_active ON players(last_active)
  `);

  sqliteAvailable = true;

  // تحميل جميع اللاعبين من SQLite إلى الذاكرة عند بدء التشغيل
  const rows = sqliteDb.prepare("SELECT username, data, last_active FROM players").all();
  for (const row of rows) {
    try {
      const playerData = JSON.parse(row.data);
      playerData.last_active = row.last_active;
      memStore.set(row.username, playerData);
    } catch (e) {
      logger.warn({ err: e.message, username: row.username }, "Failed to read player from SQLite");
    }
  }
  logger.info({ count: rows.length }, "Loaded players from SQLite");

  // حفظ دوري للبيانات المتسخة كل 30 ثانية
  _dirtyUsernames = new Set();

  const _flushDirtyInterval = setInterval(() => {
    if (!_dirtyUsernames || _dirtyUsernames.size === 0) return;
    const usernames = Array.from(_dirtyUsernames);
    _dirtyUsernames.clear();
    const stmt = sqliteDb.prepare(
      "INSERT OR REPLACE INTO players (username, data, last_active, updated_at) VALUES (?, ?, ?, strftime('%s','now'))"
    );
    const saveMany = sqliteDb.transaction((entries) => {
      for (const [uname, data, lastActive] of entries) {
        stmt.run(uname, data, lastActive);
      }
    });
    try {
      const entries = [];
      for (const uname of usernames) {
        const player = memStore.get(uname);
        if (player) {
          entries.push([uname, JSON.stringify(player), player.last_active || Date.now()]);
        }
      }
      if (entries.length > 0) saveMany(entries);
    } catch (e) {
      logger.warn({ err: e.message }, "SQLite periodic save error");
    }
  }, 30000);

  // ── حفظ البيانات المتسخة عند إيقاف السيرفر ──
  const flushOnShutdown = () => {
    if (!_dirtyUsernames || _dirtyUsernames.size === 0) return;
    const stmt = sqliteDb.prepare(
      "INSERT OR REPLACE INTO players (username, data, last_active, updated_at) VALUES (?, ?, ?, strftime('%s','now'))"
    );
    for (const uname of _dirtyUsernames) {
      const player = memStore.get(uname);
      if (player) {
        try { stmt.run(uname, JSON.stringify(player), player.last_active || Date.now()); } catch {}
      }
    }
    _dirtyUsernames.clear();
  };

  process.on("SIGTERM", flushOnShutdown);
  process.on("SIGINT", flushOnShutdown);

  // تعيين دوال markDirty و flushToSQLite الفعلية
  markDirty = (username) => {
    if (username && _dirtyUsernames) _dirtyUsernames.add(username);
  };

  flushToSQLite = (username) => {
    if (!sqliteAvailable || !username) return;
    const player = memStore.get(username);
    if (!player) return;
    try {
      sqliteDb.prepare(
        "INSERT OR REPLACE INTO players (username, data, last_active, updated_at) VALUES (?, ?, ?, strftime('%s','now'))"
      ).run(username, JSON.stringify(player), player.last_active || Date.now());
      if (_dirtyUsernames) _dirtyUsernames.delete(username);
    } catch (e) {
      logger.warn({ err: e.message, username }, "SQLite immediate save failed");
    }
  };
} catch (e) {
  logger.warn({ err: e.message }, "SQLite unavailable — running without persistent storage");
  // markDirty و flushToSQLite تبقى no-op (معرفة في الأعلى)
}

// ═══════════════════════════════════════════════════════════════════
//  دوال الحفظ والتحميل الأساسية
// ═══════════════════════════════════════════════════════════════════

async function savePlayer(username, data) {
  const existing = memStore.get(username) || getDefaultPlayer(username);
  const merged = { ...existing, ...data, last_active: data.last_active || Date.now() };
  memStore.set(username, merged);
  markDirty(username); // الآن markDirty في أعلى النطاق (متاحة دائماً)
  if (mongoConnected) {
    await Player.updateOne(
      { username },
      { $set: { ...data, last_active: data.last_active || Date.now() } },
      { upsert: true }
    );
  }
}

async function loadPlayer(username) {
  if (!mongoConnected) {
    return ensureMinPower(memStore.get(username) || getDefaultPlayer(username));
  }
  try {
    const data = await Player.findOne({ username }).lean();
    return ensureMinPower(data || getDefaultPlayer(username));
  } catch {
    return ensureMinPower(memStore.get(username) || getDefaultPlayer(username));
  }
}

async function listPlayers() {
  if (!mongoConnected) {
    return Array.from(memStore.values());
  }
  const players = await Player.find({}, { _id: 0, __v: 0 }).lean();
  return players;
}

async function getLeaderboard(sortBy = "power") {
  const sortField = sortBy === "kills" ? "kills" : sortBy === "level" ? "level" : sortBy === "oases" ? "oases" : "army_power";
  if (!mongoConnected) {
    const sorted = Array.from(memStore.values())
      .sort((a, b) => (b[sortField] || 0) - (a[sortField] || 0))
      .slice(0, 50)
      .map(p => ({ username: p.username, [sortField === 'army_power' ? 'power' : sortField]: p[sortField] || 0 }));
    return sorted;
  }
  const projection = { username: 1, _id: 0 };
  projection[sortField] = 1;
  const entries = await Player.find({}, projection)
    .sort({ [sortField]: -1 })
    .limit(50)
    .lean();
  return entries;
}

// ═══════════════════════════════════════════════════════════════════
//  التصدير — دائماً في نهاية الملف
// ═══════════════════════════════════════════════════════════════════
module.exports = {
  get mongoConnected() { return mongoConnected; },
  memStore,
  Player,
  getDefaultPlayer,
  savePlayer,
  loadPlayer,
  listPlayers,
  getLeaderboard,
  WEAPON_DEFS,
  ensureMinPower,
  sqliteAvailable,
  markDirty,
  flushToSQLite,
};
