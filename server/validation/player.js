"use strict";

const { z } = require("zod");

const WeaponSchema = z.object({
  id: z.string(),
  level: z.number().int().min(0).max(100).optional(),
  upgradeLevel: z.number().int().min(0).optional(),
  starLevel: z.number().int().min(1).max(10).optional(),
  gemLevel: z.number().int().min(1).max(10).optional(),
  name: z.string().max(100).optional(),
  icon: z.string().max(10).optional(),
  rarity: z.string().max(20).optional(),
  damage: z.number().min(0).optional(),
  speed: z.number().min(0).optional(),
  range: z.number().min(0).optional(),
});

const PlayerSaveSchema = z.object({
  cash: z.number().min(0).max(1e15).optional(),
  gems: z.number().min(0).max(1e15).optional(),
  gold: z.number().min(0).max(1e15).optional(),
  hammers: z.number().min(0).max(1e15).optional(),
  scrolls: z.number().min(0).max(1e15).optional(),
  food: z.number().min(0).max(1e15).optional(),
  water: z.number().min(0).max(1e15).optional(),
  salt: z.number().min(0).max(1e15).optional(),
  leather: z.number().min(0).max(1e15).optional(),
  copper: z.number().min(0).max(1e15).optional(),
  herbs: z.number().min(0).max(1e15).optional(),
  artifacts: z.number().min(0).max(1e15).optional(),
  desertGem: z.number().min(0).max(1e15).optional(),
  army_power: z.number().min(0).max(1e15).optional(),
  x_position: z.number().min(0).max(10000).optional(),
  y_position: z.number().min(0).max(10000).optional(),
  kills: z.number().int().min(0).max(1e9).optional(),
  last_active: z.number().int().positive().optional(),
  unitLevel: z.number().int().min(1).max(1000).optional(),
  trainingLevel: z.number().int().min(1).max(1000).optional(),
  weapons: z.array(WeaponSchema).max(50).optional(),
  equippedWeapon: z.string().max(100).optional(),
  armyYardLevel: z.number().int().min(1).max(100).optional(),
  knowledgeLevel: z.number().int().min(1).max(100).optional(),
  knowledgeType: z.enum(["economic", "military"]).optional(),
  buildings: z.record(z.any()).optional(),
  research: z.record(z.any()).optional(),
  xp: z.number().min(0).optional(),
  level: z.number().int().min(1).max(200).optional(),
  allianceLevel: z.number().int().min(0).max(100).optional(),
  upgrades: z.record(z.any()).optional(),
  oases: z.array(z.record(z.any())).max(100).optional(),
  prestigeLevel: z.number().int().min(0).max(100).optional(),
  achievements: z.any().optional(),
  dailyLogin: z.record(z.any()).optional(),
  inventory: z.record(z.any()).optional(),
  events: z.array(z.any()).max(50).optional(),
  tutorial: z.record(z.any()).optional(),
  story: z.record(z.any()).optional(),
  brWins: z.number().int().min(0).optional(),
  brKills: z.number().int().min(0).optional(),
  landsState: z.record(z.any()).optional(),
  hero: z.record(z.any()).optional(),
  loadout: z.record(z.any()).optional(),
  market: z.record(z.any()).optional(),
  reputation: z.object({ score: z.number().int().min(-10000).max(10000) }).optional(),
  multiplier: z.number().min(0).max(1000).optional(),
  researchTree: z.record(z.any()).optional(),
  completedVillages: z.array(z.string()).max(50).optional(),
  currentChapter: z.number().int().min(1).max(100).optional(),
}).strict();

function sanitizePlayerData(data) {
  const result = PlayerSaveSchema.safeParse(data);
  if (!result.success) {
    const issues = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(", ");
    throw new Error(`Validation failed: ${issues}`);
  }
  return result.data;
}

// التحقق من معدل تغير الموارد — يمنع الغش بزيادة مفاجئة
const RESOURCE_NAMES = ["cash", "gems", "gold", "hammers", "scrolls", "food", "water", "salt", "leather", "copper", "herbs", "artifacts", "desertGem"];
const MAX_RESOURCE_GAIN_PER_SEC = {
  cash: 5000, gems: 100, gold: 2000, hammers: 500, scrolls: 500, food: 5000,
  water: 1000, salt: 500, leather: 300, copper: 200, herbs: 200,
  artifacts: 50, desertGem: 10,
};

function validateResourceDelta(existing, incoming) {
  // تخطي التحقق لأول حفظ (لاعب جديد — لا توجد بيانات سابقة)
  if (!existing.last_active) return { ok: true };
  const now = Date.now();
  const lastTime = existing.last_active;
  const elapsedSec = Math.max(1, (now - lastTime) / 1000);
  for (const res of RESOURCE_NAMES) {
    if (incoming[res] === undefined) continue;
    const oldVal = existing[res] || 0;
    const newVal = incoming[res];
    const gain = newVal - oldVal;
    if (gain <= 0) continue;
    const maxGain = MAX_RESOURCE_GAIN_PER_SEC[res] * elapsedSec * (elapsedSec > 300 ? 5 : 1.5);
    if (gain > maxGain) {
      return { ok: false, reason: `${res} gain ${Math.floor(gain)} exceeds max ${Math.floor(maxGain)} in ${Math.floor(elapsedSec)}s` };
    }
  }
  return { ok: true };
}

// ═══════════════════════════════════════════════════════════════════
//  🛡️ مكافحة الغش — التحقق من تغييرات مصفوفة الأسلحة (weapons)
//  المسار الشرعي الوحيد لترقية سلاح مملوك هو رسالة WS "weapon_upgrade"
//  (applyWeaponUpgrade في weaponUpgrade.js، محقّقة بالفعل). هذا التحقق
//  يمنع أي محاولة لتعديل مستوى سلاح موجود أو إضافة سلاح دون دفع ثمنه
//  عبر مسارات الحفظ العامة (/api/players و /api/upgrades).
// ═══════════════════════════════════════════════════════════════════
function validateWeaponsChange(existing, incoming) {
  if (incoming.weapons === undefined) return { ok: true };
  const incomingWeapons = incoming.weapons;
  if (!Array.isArray(incomingWeapons)) return { ok: false, reason: "invalid weapons format" };

  const existingWeapons = existing.weapons || [];
  const existingById = new Map(existingWeapons.map(w => [w.id, w]));
  const incomingIds = new Set();

  let newWeapon = null;
  for (const w of incomingWeapons) {
    if (!w || typeof w.id !== "string") return { ok: false, reason: "invalid weapon entry" };
    if (incomingIds.has(w.id)) return { ok: false, reason: "duplicate weapon id" };
    incomingIds.add(w.id);
    const old = existingById.get(w.id);
    if (!old) {
      if (newWeapon) return { ok: false, reason: "multiple new weapons in one save" };
      newWeapon = w;
      continue;
    }
    // سلاح مملوك مسبقاً — يُمنع تغيير مستواه هنا؛ الترقية فقط عبر weapon_upgrade
    if ((w.level || 0) !== (old.level || 0) ||
        (w.starLevel || 1) !== (old.starLevel || 1) ||
        (w.gemLevel || 1) !== (old.gemLevel || 1) ||
        (w.upgradeLevel || 0) !== (old.upgradeLevel || 0)) {
      return { ok: false, reason: `weapon ${w.id} level change rejected — use weapon_upgrade` };
    }
  }

  // لا يجوز حذف سلاح مملوك من المصفوفة
  for (const id of existingById.keys()) {
    if (!incomingIds.has(id)) return { ok: false, reason: `weapon ${id} removed` };
  }

  if (newWeapon) {
    const { WEAPON_DEFS } = require("../db/databaseHelper");
    const def = WEAPON_DEFS.find(d => d.id === newWeapon.id);
    if (!def) return { ok: false, reason: "unknown weapon id" };
    if ((newWeapon.level || 0) > 1 || (newWeapon.starLevel || 1) > 1 ||
        (newWeapon.gemLevel || 1) > 1 || (newWeapon.upgradeLevel || 0) > 1) {
      return { ok: false, reason: "new weapon must start at level 1" };
    }
    const playerLevel = incoming.level ?? existing.level ?? 1;
    if (playerLevel < def.requireLevel) return { ok: false, reason: "player level too low for this weapon" };
    const oldCash = existing.cash || 0;
    const newCash = incoming.cash !== undefined ? incoming.cash : oldCash;
    const cashSpent = oldCash - newCash;
    if (cashSpent < def.cashPrice - 0.01) {
      return { ok: false, reason: "insufficient cash decrease for weapon purchase" };
    }
  }

  return { ok: true };
}

function validateEquippedWeapon(existing, incoming) {
  if (incoming.equippedWeapon === undefined) return { ok: true };
  if (incoming.equippedWeapon === "") return { ok: true };
  const weapons = incoming.weapons !== undefined ? incoming.weapons : (existing.weapons || []);
  const owned = (weapons || []).some(w => w.id === incoming.equippedWeapon);
  if (!owned) return { ok: false, reason: "cannot equip unowned weapon" };
  return { ok: true };
}

module.exports = { sanitizePlayerData, PlayerSaveSchema, validateResourceDelta, validateWeaponsChange, validateEquippedWeapon };
