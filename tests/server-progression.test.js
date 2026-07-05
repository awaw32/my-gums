import { describe, it, expect } from 'vitest';
import {
  xpForLevel,
  gainXp,
  computeStats,
  initNewPlayer,
  grantReward,
  StarterQuests
} from '../server/systems/progression.js';

describe('Server Progression', () => {
  it('should initialize new player with client-aligned resources', () => {
    const player = {};
    initNewPlayer(player);
    expect(player.resources).toEqual({ cash: 0, gold: 0, gems: 0, hammers: 0, scrolls: 0, food: 0 });
    expect(player.level).toBe(1);
    expect(player.xp).toBe(0);
  });

  it('should grant only real resources', () => {
    const player = {};
    initNewPlayer(player);
    grantReward(player, { cash: 100, gold: 50, gems: 5, wood: 999, date: 999 });
    expect(player.resources.cash).toBe(100);
    expect(player.resources.gold).toBe(50);
    expect(player.resources.gems).toBe(5);
    expect(player.resources.wood).toBeUndefined();
    expect(player.resources.date).toBeUndefined();
  });

  it('should compute stats based on level', () => {
    const stats = computeStats({ level: 5 });
    expect(stats.maxHp).toBe(130);
    expect(stats.attackPower).toBe(18);
  });

  it('should level up when gaining enough xp', () => {
    const player = { level: 1, xp: 0 };
    const leveled = gainXp(player, xpForLevel(1) + 10);
    expect(leveled).toBe(true);
    expect(player.level).toBe(2);
  });

  it('should have starter quests with real resource rewards', () => {
    expect(StarterQuests.length).toBeGreaterThan(0);
    for (const q of StarterQuests) {
      const rewardKeys = Object.keys(q.reward);
      const validKeys = ["cash", "gold", "gems", "hammers", "scrolls", "food"];
      for (const key of rewardKeys) {
        expect(validKeys).toContain(key);
      }
    }
  });
});
