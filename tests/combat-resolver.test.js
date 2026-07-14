import { describe, it, expect } from 'vitest';
import { computeOneHitDamage, resolveMonsterKill, simulatePvPFull, computeLoot, WEAPON_COMBAT_STATS } from '../server/logic/combatResolver.js';

describe('Combat Resolver (Server-Authoritative)', () => {
  const basePlayer = () => ({
    level: 10,
    unitLevel: 5,
    trainingLevel: 3,
    prestigeLevel: 1,
    army_power: 8000,
    armyYardLevel: 4,
    hp: 120,
    maxHp: 120,
    equippedWeapon: 'w3',
    weapons: [{ id: 'w3', level: 2 }],
    buildings: { chiefPalace: 3 },
    research: {},
  });

  const baseMonster = () => ({
    id: 0,
    hp: 200,
    maxHp: 200,
    alive: true,
    _spawnTime: Date.now() - 10000,
  });

  it('should compute one-hit damage (level 10 with army_power 8000)', () => {
    const result = computeOneHitDamage(basePlayer());
    expect(result.damage).toBeGreaterThanOrEqual(1);
    expect(typeof result.isCrit).toBe('boolean');
  });

  it('should apply damage to monster HP on resolveMonsterKill', () => {
    const player = basePlayer();
    const monster = baseMonster();
    const result = resolveMonsterKill(player, monster);
    expect(result.valid).toBe(true);
    expect(result.damage).toBeGreaterThanOrEqual(1);
    expect(monster.hp).toBeLessThan(200);
    expect(monster.hp).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(monster.hp)).toBe(true);
  });

  it('should kill monster when damage exceeds HP', () => {
    const player = basePlayer();
    const monster = baseMonster();
    monster.hp = 1;
    const result = resolveMonsterKill(player, monster);
    expect(result.valid).toBe(true);
    expect(result.killed).toBe(true);
    expect(monster.hp).toBe(0);
  });

  it('should return valid false for dead monster', () => {
    const player = basePlayer();
    const monster = baseMonster();
    monster.alive = false;
    const result = resolveMonsterKill(player, monster);
    expect(result.valid).toBe(false);
  });

  it('should simulate PvP and return attackerWon boolean', () => {
    const attacker = basePlayer();
    const defender = basePlayer();
    const result = simulatePvPFull(attacker, defender);
    expect(typeof result.attackerWon).toBe('boolean');
    expect(result.rounds).toBeGreaterThanOrEqual(1);
    expect(result.rounds).toBeLessThanOrEqual(50);
    expect(result.attackerDmgPerHit).toBeGreaterThanOrEqual(1);
  });

  it('stronger player should usually win PvP', () => {
    const weakPlayer = basePlayer();
    weakPlayer.level = 1;
    weakPlayer.army_power = 1000;
    const strongPlayer = basePlayer();
    strongPlayer.level = 50;
    strongPlayer.army_power = 50000;
    let wins = 0;
    for (let i = 0; i < 10; i++) {
      const result = simulatePvPFull(strongPlayer, weakPlayer);
      if (result.attackerWon) wins++;
    }
    expect(wins).toBeGreaterThanOrEqual(8);
  });

  it('computeLoot should give reasonable cash for winner', () => {
    const loot = computeLoot(10000, true);
    expect(loot.cash).toBeGreaterThanOrEqual(10);
    expect(loot.cash).toBeLessThanOrEqual(1000);
    expect(loot.gold).toBeGreaterThanOrEqual(1);
  });

  it('computeLoot should give loss amount for loser', () => {
    const loot = computeLoot(10000, false);
    expect(loot.cash).toBeGreaterThanOrEqual(0);
    expect(loot.cash).toBeLessThanOrEqual(50000);
    expect(loot.gold).toBe(0);
  });

  it('should have weapon stats matching client definitions', () => {
    expect(WEAPON_COMBAT_STATS.w1.baseDamage).toBe(4);
    expect(WEAPON_COMBAT_STATS.w6.critMultiplier).toBe(3.0);
    expect(WEAPON_COMBAT_STATS.w5.range).toBe('ranged');
  });

  it('should reject invalid monster kill (not alive)', () => {
    const player = basePlayer();
    const monster = baseMonster();
    monster.alive = false;
    const result = resolveMonsterKill(player, monster);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('ميت');
  });
});
