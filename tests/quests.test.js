import { describe, it, expect, beforeEach } from 'vitest';
import { QuestManager, DAILY_QUESTS, ALLIANCE_MISSIONS } from '../js/quests.js';

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

// Minimal localStorage mock for quests
const store = {};
global.localStorage = {
  getItem: (key) => store[key] ?? null,
  setItem: (key, val) => { store[key] = String(val); },
  removeItem: (key) => { delete store[key]; },
};

describe('QuestManager', () => {
  let eco, arm, vil, quests;

  beforeEach(() => {
    Object.keys(store).forEach(k => delete store[k]);
    eco = makeMockEconomy();
    arm = makeMockArmy();
    vil = makeMockVillage();
    quests = new QuestManager(eco, arm, vil);
  });

  describe('initialization', () => {
    it('should create 3 daily quests', () => {
      expect(quests.dailyQuests).toHaveLength(3);
    });

    it('should deep-copy DAILY_QUESTS to avoid mutation', () => {
      quests.dailyQuests[0].progress = 999;
      expect(DAILY_QUESTS[0].progress).toBe(0);
    });
  });

  describe('updateProgress', () => {
    it('should increase progress for matching quests', () => {
      quests.updateProgress('kill', 1);
      const killQuest = quests.dailyQuests.find(q => q.type === 'kill');
      expect(killQuest.progress).toBe(1);
    });

    it('should not affect non-matching quests', () => {
      quests.updateProgress('kill', 1);
      const collectQuest = quests.dailyQuests.find(q => q.type === 'collect');
      expect(collectQuest.progress).toBe(0);
    });

    it('should accept custom amount', () => {
      quests.updateProgress('collect', 150);
      const collectQuest = quests.dailyQuests.find(q => q.type === 'collect');
      expect(collectQuest.progress).toBe(150);
    });

    it('should allow progress to exceed target (reward still claimed)', () => {
      const killQuest = quests.dailyQuests.find(q => q.type === 'kill');
      killQuest.progress = 9;
      quests.updateProgress('kill', 5);
      // updateProgress only checks < target before adding, doesn't cap
      expect(killQuest.progress).toBe(14);
    });

    it('should auto-reward when progress reaches target', () => {
      const collectQuest = quests.dailyQuests.find(q => q.type === 'collect');
      collectQuest.progress = 498;
      const goldBefore = eco.resources.gold;
      quests.updateProgress('collect', 2);
      expect(collectQuest.progress).toBe(500);
      expect(eco.resources.gold).toBe(goldBefore + 200);
    });

    it('should fire _onQuestCompleted callback on completion', () => {
      let completed = null;
      quests._onQuestCompleted = (q) => { completed = q; };
      const killQuest = quests.dailyQuests.find(q => q.type === 'kill');
      killQuest.progress = 9;
      quests.updateProgress('kill', 1);
      expect(completed).toBeTruthy();
      expect(completed.id).toBe('daily_3');
    });

    it('should save to localStorage after update', () => {
      quests.updateProgress('kill', 1);
      const saved = JSON.parse(store['desert_quests']);
      expect(saved.dailyQuests[2].progress).toBe(1);
    });
  });

  describe('claimReward', () => {
    it('should add gold reward to economy', () => {
      const goldBefore = eco.resources.gold;
      quests.claimReward(quests.dailyQuests[0]);
      expect(eco.resources.gold).toBe(goldBefore + 200);
    });

    it('should add gems reward to economy', () => {
      const gemsBefore = eco.resources.gems;
      quests.claimReward(quests.dailyQuests[2]);
      expect(eco.resources.gems).toBe(gemsBefore + 5);
    });

    it('should add armyPower reward', () => {
      const powerBefore = arm.unitPowerBase;
      quests.claimReward(quests.dailyQuests[1]);
      expect(arm.unitPowerBase).toBe(powerBefore + 30);
    });
  });

  describe('daily reset', () => {
    it('checkDailyReset should reset quests if >1 day elapsed', () => {
      quests.dailyQuests[0].progress = 300;
      quests.lastDailyReset = Date.now() - 25 * 60 * 60 * 1000;
      quests.checkDailyReset();
      expect(quests.dailyQuests[0].progress).toBe(0);
    });

    it('checkDailyReset should NOT reset if <1 day elapsed', () => {
      quests.dailyQuests[0].progress = 300;
      quests.lastDailyReset = Date.now() - 1 * 60 * 60 * 1000;
      quests.checkDailyReset();
      expect(quests.dailyQuests[0].progress).toBe(300);
    });

    it('resetDailyQuests should zero out all progress', () => {
      quests.dailyQuests.forEach(q => q.progress = 500);
      quests.resetDailyQuests();
      quests.dailyQuests.forEach(q => expect(q.progress).toBe(0));
    });
  });

  describe('save/load persistence', () => {
    it('save should persist to localStorage', () => {
      quests.dailyQuests[0].progress = 200;
      quests.save();
      const raw = store['desert_quests'];
      expect(raw).toBeTruthy();
      const data = JSON.parse(raw);
      expect(data.dailyQuests[0].progress).toBe(200);
    });

    it('loadFromSave should restore from localStorage', () => {
      store['desert_quests'] = JSON.stringify({
        dailyQuests: [{ id: 'daily_1', title: 'test', type: 'collect', target: 500, progress: 300, reward: { gold: 100 }, resetDaily: true }],
        lastDailyReset: Date.now(),
      });
      const q2 = new QuestManager(eco, arm, vil);
      expect(q2.dailyQuests[0].progress).toBe(300);
    });

    it('loadFromSave should use defaults when no saved data', () => {
      const q2 = new QuestManager(eco, arm, vil);
      expect(q2.dailyQuests.length).toBe(3);
    });
  });

  describe('getDailyQuests', () => {
    it('should call checkDailyReset', () => {
      let checkCalled = false;
      const orig = quests.checkDailyReset.bind(quests);
      quests.checkDailyReset = () => { checkCalled = true; };
      quests.getDailyQuests();
      expect(checkCalled).toBe(true);
    });

    it('should return the daily quests array', () => {
      const result = quests.getDailyQuests();
      expect(result).toHaveLength(3);
    });
  });

  describe('getAllianceMissions', () => {
    it('should return the alliance missions array', () => {
      const result = quests.getAllianceMissions();
      expect(result).toHaveLength(1);
    });
  });
});

describe('DAILY_QUESTS data', () => {
  it('should have collect, train, and kill types', () => {
    const types = DAILY_QUESTS.map(q => q.type);
    expect(types).toContain('collect');
    expect(types).toContain('train');
    expect(types).toContain('kill');
  });

  it('each quest should have id, title, desc, type, target, progress, reward', () => {
    for (const q of DAILY_QUESTS) {
      expect(q.id).toBeTruthy();
      expect(q.title).toBeTruthy();
      expect(q.desc).toBeTruthy();
      expect(typeof q.target).toBe('number');
      expect(typeof q.progress).toBe('number');
      expect(q.reward).toBeTruthy();
    }
  });

  it('targets should be positive', () => {
    for (const q of DAILY_QUESTS) {
      expect(q.target).toBeGreaterThan(0);
    }
  });
});


