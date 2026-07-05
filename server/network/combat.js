"use strict";
const ATTACK_RANGE = 60;

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

function resolveAttack(attacker, target) {
  const dist = Math.hypot(attacker.x - target.x, attacker.y - target.y);
  if (dist > ATTACK_RANGE) return null;
  const atk = (attacker.attackPower || 15) * (1 + Math.random() * 0.2);
  const def = (target.defense || 0) * 0.3;
  const dmg = clamp(Math.floor(atk - def), 1, 200);
  const crit = Math.random() < 0.15;
  const finalDmg = crit ? Math.floor(dmg * 1.5) : dmg;
  target.hp = clamp(target.hp - finalDmg, 0, target.maxHp || 100);
  return { damage: finalDmg, crit, targetHp: target.hp, alive: target.hp > 0 };
}

module.exports = { resolveAttack };
