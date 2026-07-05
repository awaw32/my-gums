"use strict";
const { z } = require("zod");

const MsgJoin = z.object({
  t: z.literal("join"),
  playerId: z.string().min(1),
  roomId: z.string().min(1),
  loadout: z.object({
    weapon: z.enum(["sword", "spear", "bow"]),
    runes: z.array(z.string()).max(4),
  }),
});

const MsgInput = z.object({
  t: z.literal("input"),
  seq: z.number().int().nonnegative(),
  axes: z.object({
    x: z.number().min(-1).max(1),
    y: z.number().min(-1).max(1),
  }),
  actions: z.object({
    dash: z.boolean().optional(),
    attack: z.boolean().optional(),
    mount: z.boolean().optional(),
  }).passthrough(),
  ts: z.number().int().positive(),
});

const MsgLeave = z.object({
  t: z.literal("leave"),
});

const MsgAttack = z.object({
  t: z.literal("attack"),
  targetId: z.string().min(1),
});

const ClientMessage = z.union([MsgJoin, MsgInput, MsgLeave, MsgAttack]);

const ServerState = z.object({
  t: z.literal("state"),
  tick: z.number().int().nonnegative(),
  players: z.array(z.object({
    id: z.string(),
    x: z.number(),
    y: z.number(),
    dir: z.number().min(0).max(360),
    anim: z.string().optional(),
  })),
  ents: z.array(z.any()).optional(),
});

const MsgHit = z.object({
  t: z.literal("hit"),
  targetId: z.string(),
  damage: z.number().positive(),
  crit: z.boolean().optional(),
});

const MsgLoot = z.object({
  t: z.literal("loot"),
  drops: z.array(z.object({
    id: z.string(),
    qty: z.number().positive(),
  })),
});

const MsgError = z.object({
  t: z.literal("error"),
  code: z.string(),
  msg: z.string(),
});

module.exports = {
  MsgJoin, MsgInput, MsgLeave, MsgAttack,
  ClientMessage, ServerState, MsgHit, MsgLoot, MsgError,
};
