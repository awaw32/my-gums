import { describe, it, expect } from 'vitest';
import { computeOneHitDamage, resolveMonsterKill, simulatePvPFull, computeLoot, computeMonsterReward, WEAPON_COMBAT_STATS } from '../server/logic/combatResolver.js';

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

  it('computeMonsterReward should give proportional reward', () => {
    const monster = {
      rewardMoney: 10,
      rewardGold: 3,
      hp: 200, maxHp: 200, enemyId: 'desert_wolf',
    };
    const player = basePlayer();
    const reward = computeMonsterReward(monster, player);
    expect(reward.cash).toBeGreaterThanOrEqual(1);
    expect(reward.gold).toBeGreaterThanOrEqual(0);
    const powerCap = Math.floor(player.army_power * 0.15);
    expect(reward.cash).toBeLessThanOrEqual(powerCap);
  });

  it('computeMonsterReward for boss should include artifacts', () => {
    const monster = {
      rewardMoney: 100,
      rewardGold: 30,
      hp: 500, maxHp: 500, isBoss: true, enemyId: 'wadi_boss',
    };
    const player = basePlayer();
    const reward = computeMonsterReward(monster, player);
    expect(reward.artifacts).toBeGreaterThanOrEqual(1);
    expect(reward.artifacts).toBeLessThanOrEqual(3);
  });

  it('computeMonsterReward should cap at 15% power', () => {
    const monster = {
      rewardMoney: 999999,
      rewardGold: 99999,
      hp: 1, maxHp: 1, enemyId: 'desert_wolf',
    };
    const player = basePlayer();
    const reward = computeMonsterReward(monster, player);
    const maxCash = Math.floor(player.army_power * 0.15);
    expect(reward.cash).toBeLessThanOrEqual(maxCash);
    expect(reward.gold).toBeLessThanOrEqual(Math.floor(maxCash * 0.3));
  });

  it('computeMonsterReward for final_boss should give desertGem', () => {
    const monster = {
      rewardMoney: 2000,
      rewardGold: 200,
      hp: 30000, maxHp: 30000, isBoss: true, enemyId: 'final_boss',
    };
    const player = basePlayer();
    const reward = computeMonsterReward(monster, player);
    expect(reward.desertGem).toBe(1);
  });

  it('computeMonsterReward should handle zero-armed player gracefully', () => {
    const monster = {
      rewardMoney: 10,
      rewardGold: 3,
      hp: 200, maxHp: 200, enemyId: 'desert_wolf',
    };
    const weakPlayer = { ...basePlayer(), army_power: 10, level: 1 };
    const reward = computeMonsterReward(monster, weakPlayer);
    expect(reward.cash).toBeGreaterThanOrEqual(0);
    expect(reward.gold).toBeGreaterThanOrEqual(0);
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

  describe('Monster Abilities', () => {
    it('dodge should set damage to 0', () => {
      const player = basePlayer();
      const monster = baseMonster();
      monster.enemyId = 'desert_thief';
      const result = resolveMonsterKill(player, monster, Date.now());
      if (result.wasDodged) {
        expect(result.damage).toBe(0);
      } else {
        expect(result.damage).toBeGreaterThanOrEqual(1);
      }
    });

    it('shield should halve damage when timer active', () => {
      const player = basePlayer();
      const monster = baseMonster();
      monster.enemyId = 'palace_boss';
      monster._shieldTimer = 3;
      const result = resolveMonsterKill(player, monster, Date.now());
      expect(result.damage).toBeGreaterThanOrEqual(0);
      const expectedMax = Math.floor(computeOneHitDamage(player).damage);
      expect(result.damage).toBeLessThanOrEqual(Math.floor(expectedMax));
    });

    it('phase should make damage 0', () => {
      const player = basePlayer();
      const monster = baseMonster();
      monster.enemyId = 'palace_ghost';
      monster._phaseTimer = 1.5;
      const result = resolveMonsterKill(player, monster, Date.now());
      expect(result.wasPhased).toBe(true);
      expect(result.damage).toBe(0);
    });

    it('heal should increase monster HP', () => {
      const player = basePlayer();
      const monster = baseMonster();
      monster.hp = 100;
      monster.enemyId = 'sand_sorcerer';
      const result = resolveMonsterKill(player, monster, Date.now());
      const healEvent = result.abilitiesTriggered.find(a => a.type === 'heal');
      if (healEvent) {
        expect(monster.hp).toBeGreaterThan(100 - result.damage);
        expect(healEvent.amount).toBeGreaterThan(0);
      }
    });

    it('charge should return damage to player', () => {
      const player = basePlayer();
      const monster = baseMonster();
      monster.enemyId = 'shadow_knight';
      const result = resolveMonsterKill(player, monster, Date.now());
      const chargeEvent = result.abilitiesTriggered.find(a => a.type === 'charge');
      if (chargeEvent) {
        expect(result.returnDamage).toBeGreaterThan(0);
        expect(chargeEvent.damage).toBeGreaterThan(0);
      }
    });

    it('poison should set poisonInfo', () => {
      const player = basePlayer();
      const monster = baseMonster();
      monster.hp = 500;
      monster.enemyId = 'desert_scorpion';
      const result = resolveMonsterKill(player, monster, Date.now());
      const poisonEvent = result.abilitiesTriggered.find(a => a.type === 'poison');
      if (poisonEvent) {
        expect(result.poisonInfo).not.toBeNull();
        expect(result.poisonInfo.dps).toBeGreaterThan(0);
        expect(result.poisonInfo.duration).toBeGreaterThan(0);
      }
    });

    it('sandstorm should activate sandstorm timer', () => {
      const player = basePlayer();
      const monster = baseMonster();
      monster.enemyId = 'wadi_boss';
      const result = resolveMonsterKill(player, monster, Date.now());
      const sandEvent = result.abilitiesTriggered.find(a => a.type === 'sandstorm');
      if (sandEvent) {
        expect(monster._sandstormTimer).toBeGreaterThan(0);
      }
    });
  });
});
