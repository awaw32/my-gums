import { describe, it, expect, beforeEach } from 'vitest';
import { QuestManager, ALLIANCE_MISSIONS } from '../js/quests.js';

function makeMockEconomy() {
  return {
    resources: { gold: 100, gems: 10, cash: 0, food: 0 },
    addRaw: function(type, amt) { if (this.resources[type] !== undefined) this.resources[type] += amt; },
    addXp: function(amt) { this.xp = (this.xp || 0) + amt; },
  };
}

function makeMockArmy() {
  return { unitPowerBase: 5 };
}

function makeMockVillage() {
  return {};
}

describe('QuestManager', () => {
  let eco, arm, vil, quests;

  beforeEach(() => {
    eco = makeMockEconomy();
    arm = makeMockArmy();
    vil = makeMockVillage();
    quests = new QuestManager(eco, arm, vil);
  });

  describe('getAllianceMissions', () => {
    it('should return the alliance missions array', () => {
      const result = quests.getAllianceMissions();
      expect(result).toHaveLength(1);
    });

    it('should deep-copy ALLIANCE_MISSIONS to avoid mutation', () => {
      quests.allianceMissions[0].progress = 999;
      expect(ALLIANCE_MISSIONS[0].progress).toBe(0);
    });
  });
});

describe('ALLIANCE_MISSIONS data', () => {
  it('each mission should have id, title, desc, target, progress, reward', () => {
    for (const m of ALLIANCE_MISSIONS) {
      expect(m.id).toBeTruthy();
      expect(m.title).toBeTruthy();
      expect(m.desc).toBeTruthy();
      expect(typeof m.target).toBe('number');
      expect(typeof m.progress).toBe('number');
      expect(m.reward).toBeTruthy();
    }
  });

  it('targets should be positive', () => {
    for (const m of ALLIANCE_MISSIONS) {
      expect(m.target).toBeGreaterThan(0);
    }
  });
});
