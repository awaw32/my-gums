"use strict";

const { z } = require("zod");

const WeaponSchema = z.object({
  id: z.string(),
  level: z.number().int().min(0).max(100).optional(),
  upgradeLevel: z.number().int().min(0).optional(),
  starLevel: z.number().int().min(1).max(10).optional(),
  gemLevel: z.number().int().min(1).max(10).optional(),
}).passthrough();

const PlayerSaveSchema = z.object({
  cash: z.number().min(0).max(1e15).optional(),
  gems: z.number().min(0).max(1e15).optional(),
  gold: z.number().min(0).max(1e15).optional(),
  hammers: z.number().min(0).max(1e15).optional(),
  scrolls: z.number().min(0).max(1e15).optional(),
  food: z.number().min(0).max(1e15).optional(),
  army_power: z.number().min(0).max(1e15).optional(),
  x_position: z.number().min(0).max(10000).optional(),
  y_position: z.number().min(0).max(10000).optional(),
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
}).strict();

function sanitizePlayerData(data) {
  const result = PlayerSaveSchema.safeParse(data);
  if (!result.success) {
    const issues = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(", ");
    throw new Error(`Validation failed: ${issues}`);
  }
  return result.data;
}

module.exports = { sanitizePlayerData, PlayerSaveSchema };
