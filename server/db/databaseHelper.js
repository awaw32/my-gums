"use strict";

const mongoose = require("mongoose");
mongoose.set("bufferCommands", false);

const MONGO_URL = process.env.MONGO_URL;
let mongoConnected = false;

if (!MONGO_URL) {
  console.warn("[MongoDB] MONGO_URL غير مضبوط — اللعبة تشتغل بدون حفظ (in-memory only)");
} else {
  mongoose.connect(MONGO_URL, { serverSelectionTimeoutMS: 3000 })
    .then(() => { mongoConnected = true; console.log("[MongoDB] Connected ✅"); })
    .catch(err => { mongoConnected = false; console.warn("[MongoDB] غير متاح — اللعبة تشتغل بدون حفظ:", err.message); });
  mongoose.connection.on("disconnected", () => { mongoConnected = false; });
}

const WEAPON_DEFS = [
  { id: "bedouin_sword",  name: "سيف بدوي",       baseDamage: 4,  damagePerLevel: 3,  range: "melee",  critChance: 0.05, critMultiplier: 1.5 },
  { id: "long_bow",       name: "قوس طويل",       baseDamage: 3,  damagePerLevel: 2,  range: "ranged", critChance: 0.08, critMultiplier: 1.8 },
  { id: "iron_spear",     name: "رمح حديدي",      baseDamage: 5,  damagePerLevel: 4,  range: "melee",  critChance: 0.12, critMultiplier: 2.0 },
  { id: "damascus_sword", name: "سيف دمشقي",      baseDamage: 7,  damagePerLevel: 5,  range: "melee",  critChance: 0.15, critMultiplier: 2.5 },
];

const playerSchema = new mongoose.Schema({
  username:       { type: String, required: true, unique: true, index: true },
  cash:           { type: Number, default: 0 },
  gems:           { type: Number, default: 0 },
  gold:           { type: Number, default: 0 },
  kingCoins:      { type: Number, default: 0 },
  hammers:        { type: Number, default: 0 },
  scrolls:        { type: Number, default: 0 },
  horns:          { type: Number, default: 0 },
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
  upgrades:      { type: Object, default: {} },
  oases:         { type: Array, default: [] },
  prestigeLevel:  { type: Number, default: 0 },
  achievements:  { type: Array, default: [] },
  dailyLogin:    { type: Object, default: {} },
  inventory:     { type: Object, default: {} },
  events:        { type: Array, default: [] },
  tutorial:      { type: Object, default: {} },
  brWins:        { type: Number, default: 0 },
  brKills:       { type: Number, default: 0 },
  buildings:     { type: Object, default: {} },
  research:      { type: Object, default: {} },
}, { collection: "players_data", timestamps: false });

const Player = mongoose.model("Player", playerSchema);

const memStore = new Map();

function getDefaultPlayer(username) {
  return {
    username, cash: 0, gems: 0, gold: 0, kingCoins: 0,
    hammers: 0, scrolls: 0, horns: 0, army_power: 5000,
    x_position: 1200, y_position: 1200, last_active: 0,
    unitLevel: 1, weapons: [], equippedWeapon: "",
    armyYardLevel: 1, knowledgeLevel: 1, knowledgeType: "economic",
    lastGiftClaimedTimestamp: 0,
    buildings: {},
    research: {},
  };
}

function ensureMinPower(playerData) {
  if (!playerData.army_power || playerData.army_power < 5000) {
    playerData.army_power = 5000;
  }
  return playerData;
}

async function savePlayer(username, data) {
  const existing = memStore.get(username) || getDefaultPlayer(username);
  memStore.set(username, { ...existing, ...data, last_active: data.last_active || Date.now() });
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

module.exports = {
  mongoConnected,
  memStore,
  Player,
  getDefaultPlayer,
  savePlayer,
  loadPlayer,
  listPlayers,
  getLeaderboard,
  WEAPON_DEFS,
  ensureMinPower,
};
