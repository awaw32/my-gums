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

module.exports = { sanitizePlayerData, PlayerSaveSchema, validateResourceDelta };
