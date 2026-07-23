"use strict";

const mongoose = require("mongoose");
const { nanoid } = require("nanoid");
const logger = require("../logger");
const { mongoConnected: isMongoConnected } = require("./databaseHelper");

// ═══════════════════════════════════════════════════════════════════
//  🏜️ التحالفات (Alliances) — كيان مستقل عن اللاعبين، بنفس نمط
//  databaseHelper.js تماماً (memStore + Mongo + SQLite)، في ملف شقيق
//  بدل إقحامه داخل databaseHelper.js (نفس فلسفة buildings.js/research.js).
// ═══════════════════════════════════════════════════════════════════

const TRIBAL_RANKS = [
  { id: "shaykh",  name: "شيخ القبيلة", icon: "⚜️", authority: 3 },
  { id: "warrior", name: "محارب",       icon: "🗡️", authority: 2 },
  { id: "member",  name: "عضو",         icon: "🤝", authority: 1 },
  { id: "novice",  name: "مستجِدّ",     icon: "🏜️", authority: 0 },
];

function getRank(rankId) {
  return TRIBAL_RANKS.find(r => r.id === rankId) || TRIBAL_RANKS[3];
}

const allianceSchema = new mongoose.Schema({
  id:        { type: String, required: true, unique: true, index: true },
  name:      { type: String, required: true },
  banner:    { type: String, default: "🏕️" },
  level:     { type: Number, default: 0 },
  treasury:  { type: Number, default: 0 },
  createdAt: { type: Number, default: 0 },
  createdBy: { type: String, default: "" },
  members:   { type: Array, default: [] },        // [{username, rank, contribution, joinedAt}]
  pendingRequests: { type: Array, default: [] },   // [{username, requestedAt}]
}, { collection: "alliances_data", timestamps: false });

const Alliance = mongoose.model("Alliance", allianceSchema);

const allianceMemStore = new Map();       // id -> alliance record
const allianceNameIndex = new Map();      // اسم مُطبَّع (lowercase/trim) -> id، لمنع تكرار الأسماء

function normalizeName(name) {
  return String(name || "").trim().toLowerCase();
}

function makeAllianceId() {
  return "alliance_" + nanoid(10);
}

function createAllianceRecord(name, banner, createdBy) {
  return {
    id: makeAllianceId(),
    name: String(name).trim().slice(0, 30),
    banner: typeof banner === "string" && banner.length <= 4 ? banner : "🏕️",
    level: 0,
    treasury: 0,
    createdAt: Date.now(),
    createdBy,
    members: [{ username: createdBy, rank: "shaykh", contribution: 0, joinedAt: Date.now() }],
    pendingRequests: [],
  };
}

// ═══════════════════════════════════════════════════════════════════
//  SQLite — نفس نمط databaseHelper.js تماماً (جدول شقيق مستقل)
// ═══════════════════════════════════════════════════════════════════
let sqliteDb = null;
let sqliteAvailable = false;
const DATA_DIR = process.env.DATA_DIR || "./data";

let _dirtyAllianceIds = null;
let markAllianceDirty = (_id) => {};
let flushAllianceToSQLite = (_id) => {};

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
    CREATE TABLE IF NOT EXISTS alliances (
      id TEXT PRIMARY KEY NOT NULL,
      data TEXT NOT NULL,
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    )
  `);

  sqliteAvailable = true;

  const rows = sqliteDb.prepare("SELECT id, data FROM alliances").all();
  for (const row of rows) {
    try {
      const record = JSON.parse(row.data);
      allianceMemStore.set(row.id, record);
      allianceNameIndex.set(normalizeName(record.name), row.id);
    } catch (e) {
      logger.warn({ err: e.message, id: row.id }, "Failed to read alliance from SQLite");
    }
  }
  logger.info({ count: rows.length }, "Loaded alliances from SQLite");

  _dirtyAllianceIds = new Set();

  const _flushDirtyInterval = setInterval(() => {
    if (!_dirtyAllianceIds || _dirtyAllianceIds.size === 0) return;
    const ids = Array.from(_dirtyAllianceIds);
    _dirtyAllianceIds.clear();
    const stmt = sqliteDb.prepare(
      "INSERT OR REPLACE INTO alliances (id, data, updated_at) VALUES (?, ?, strftime('%s','now'))"
    );
    const saveMany = sqliteDb.transaction((entries) => {
      for (const [id, data] of entries) stmt.run(id, data);
    });
    try {
      const entries = [];
      for (const id of ids) {
        const record = allianceMemStore.get(id);
        if (record) entries.push([id, JSON.stringify(record)]);
      }
      if (entries.length > 0) saveMany(entries);
    } catch (e) {
      logger.warn({ err: e.message }, "SQLite alliance periodic save error");
    }
  }, 30000);

  const flushOnShutdown = () => {
    if (!_dirtyAllianceIds || _dirtyAllianceIds.size === 0) return;
    const stmt = sqliteDb.prepare(
      "INSERT OR REPLACE INTO alliances (id, data, updated_at) VALUES (?, ?, strftime('%s','now'))"
    );
    for (const id of _dirtyAllianceIds) {
      const record = allianceMemStore.get(id);
      if (record) {
        try { stmt.run(id, JSON.stringify(record)); } catch {}
      }
    }
    _dirtyAllianceIds.clear();
  };
  process.on("SIGTERM", flushOnShutdown);
  process.on("SIGINT", flushOnShutdown);

  markAllianceDirty = (id) => {
    if (id && _dirtyAllianceIds) _dirtyAllianceIds.add(id);
  };

  flushAllianceToSQLite = (id) => {
    if (!sqliteAvailable || !id) return;
    const record = allianceMemStore.get(id);
    if (!record) return;
    try {
      sqliteDb.prepare(
        "INSERT OR REPLACE INTO alliances (id, data, updated_at) VALUES (?, ?, strftime('%s','now'))"
      ).run(id, JSON.stringify(record));
      if (_dirtyAllianceIds) _dirtyAllianceIds.delete(id);
    } catch (e) {
      logger.warn({ err: e.message, id }, "SQLite immediate alliance save failed");
    }
  };
} catch (e) {
  logger.warn({ err: e.message }, "SQLite unavailable for alliances — running without persistent storage");
}

// ═══════════════════════════════════════════════════════════════════
//  دوال الحفظ والتحميل والبحث
// ═══════════════════════════════════════════════════════════════════

async function saveAlliance(record) {
  allianceMemStore.set(record.id, record);
  allianceNameIndex.set(normalizeName(record.name), record.id);
  markAllianceDirty(record.id);
  if (isMongoConnected) {
    await Alliance.updateOne({ id: record.id }, { $set: record }, { upsert: true });
  }
}

function getAlliance(id) {
  return allianceMemStore.get(id) || null;
}

function getAllianceIdByName(name) {
  return allianceNameIndex.get(normalizeName(name)) || null;
}

function nameTaken(name) {
  return allianceNameIndex.has(normalizeName(name));
}

function searchAlliancesByName(query, limit = 20) {
  const q = normalizeName(query);
  if (!q) return [];
  const results = [];
  for (const record of allianceMemStore.values()) {
    if (normalizeName(record.name).includes(q)) {
      results.push(record);
      if (results.length >= limit) break;
    }
  }
  return results;
}

async function deleteAlliance(id) {
  const record = allianceMemStore.get(id);
  if (record) allianceNameIndex.delete(normalizeName(record.name));
  allianceMemStore.delete(id);
  if (sqliteAvailable) {
    try { sqliteDb.prepare("DELETE FROM alliances WHERE id = ?").run(id); } catch {}
  }
  if (isMongoConnected) {
    await Alliance.deleteOne({ id });
  }
}

module.exports = {
  TRIBAL_RANKS,
  getRank,
  allianceMemStore,
  Alliance,
  createAllianceRecord,
  saveAlliance,
  getAlliance,
  getAllianceIdByName,
  nameTaken,
  searchAlliancesByName,
  deleteAlliance,
  sqliteAvailable,
  markAllianceDirty,
  flushAllianceToSQLite,
};
