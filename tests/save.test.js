import { describe, it, expect, beforeEach } from 'vitest';
import { saveGame, loadGame, clearSave } from '../js/save.js';

// Mock localStorage
const storage = {};
global.localStorage = {
  getItem: (key) => storage[key] ?? null,
  setItem: (key, val) => { storage[key] = String(val); },
  removeItem: (key) => { delete storage[key]; },
  clear: () => { Object.keys(storage).forEach(k => delete storage[k]); },
};

function makeMockEconomy() {
  return {
    resources: { cash: 500, gold: 300, gems: 50, kingCoins: 5, hammers: 20, scrolls: 10, horns: 8, food: 200 },
    multiplier: 2,
    level: 5,
    xp: 240,
    xpToNext: 500,
  };
}

function makeMockVillage() {
  return {
    currentVillageId: 'v1',
    buildings: [
      { id: 'b1', level: 3, state: 'active', constructTimer: 0, productionAccum: 150 },
    ],
    initVillage: function(id) { this.currentVillageId = id; },
  };
}

function makeMockArmy() {
  return {
    unitLevel: 3,
    weapons: [
      { id: 'bedouin_sword', level: 2, upgradeLevel: 10, starLevel: 1, gemLevel: 3 },
      { id: 'long_bow', level: 1, upgradeLevel: 6, starLevel: 2, gemLevel: 1 },
    ],
  };
}

describe('saveGame', () => {
  beforeEach(() => { Object.keys(storage).forEach(k => delete storage[k]); });

  it('should serialize economy, village, and army to localStorage', () => {
    const eco = makeMockEconomy();
    const vil = makeMockVillage();
    const arm = makeMockArmy();
    saveGame(eco, vil, arm);
    const raw = localStorage.getItem('wick_save');
    expect(raw).toBeTruthy();
    const data = JSON.parse(raw);
    expect(data.resources.cash).toBe(500);
    expect(data.unitLevel).toBe(3);
    expect(data.currentVillageId).toBe('v1');
    expect(data.weapons).toHaveLength(2);
  });

  it('should include starLevel and gemLevel for each weapon', () => {
    const eco = makeMockEconomy();
    const vil = makeMockVillage();
    const arm = makeMockArmy();
    arm.weapons[1].starLevel = 3;
    arm.weapons[1].gemLevel = 5;
    saveGame(eco, vil, arm);
    const data = JSON.parse(localStorage.getItem('wick_save'));
    const bow = data.weapons.find(w => w.id === 'long_bow');
    expect(bow.starLevel).toBe(3);
    expect(bow.gemLevel).toBe(5);
  });

  it('should handle weapons without starLevel/gemLevel using fallback', () => {
    const eco = makeMockEconomy();
    const vil = makeMockVillage();
    const arm = makeMockArmy();
    delete arm.weapons[0].starLevel;
    delete arm.weapons[0].gemLevel;
    saveGame(eco, vil, arm);
    const data = JSON.parse(localStorage.getItem('wick_save'));
    const sword = data.weapons.find(w => w.id === 'bedouin_sword');
    expect(sword.starLevel).toBe(1);
    expect(sword.gemLevel).toBe(1);
  });

  it('should include timestamp', () => {
    saveGame(makeMockEconomy(), makeMockVillage(), makeMockArmy());
    const data = JSON.parse(localStorage.getItem('wick_save'));
    expect(data.timestamp).toBeGreaterThan(0);
  });

  it('should not throw if localStorage is full', () => {
    const origSetItem = localStorage.setItem.bind(localStorage);
    localStorage.setItem = () => { throw new Error('QuotaExceededError'); };
    expect(() => saveGame(makeMockEconomy(), makeMockVillage(), makeMockArmy())).not.toThrow();
    localStorage.setItem = origSetItem;
  });
});

describe('loadGame', () => {
  beforeEach(() => { Object.keys(storage).forEach(k => delete storage[k]); });

  it('should restore resources from saved data', () => {
    const eco = makeMockEconomy();
    const vil = makeMockVillage();
    const arm = makeMockArmy();
    eco.resources.cash = 999;
    saveGame(eco, vil, arm);
    eco.resources.cash = 0;
    loadGame(eco, vil, arm);
    expect(eco.resources.cash).toBe(999);
  });

  it('should restore weapon starLevel and gemLevel', () => {
    const eco = makeMockEconomy();
    const vil = makeMockVillage();
    const arm = makeMockArmy();
    arm.weapons[0].starLevel = 5;
    arm.weapons[0].gemLevel = 7;
    saveGame(eco, vil, arm);
    arm.weapons[0].starLevel = 1;
    arm.weapons[0].gemLevel = 1;
    loadGame(eco, vil, arm);
    expect(arm.weapons[0].starLevel).toBe(5);
    expect(arm.weapons[0].gemLevel).toBe(7);
  });

  it('should keep existing starLevel/gemLevel if not in save', () => {
    const eco = makeMockEconomy();
    const vil = makeMockVillage();
    const arm = makeMockArmy();
    arm.weapons[0].starLevel = 3;
    arm.weapons[0].gemLevel = 4;
    const raw = JSON.stringify({
      resources: { cash: 100 }, weapons: [{ id: 'bedouin_sword', level: 1, upgradeLevel: 2 }],
      unitLevel: 1, timestamp: Date.now(),
    });
    storage['wick_save'] = raw;
    loadGame(eco, vil, arm);
    expect(arm.weapons[0].starLevel).toBe(3);
    expect(arm.weapons[0].gemLevel).toBe(4);
  });

  it('should restore unitLevel with fallback to 1', () => {
    const eco = makeMockEconomy();
    const vil = makeMockVillage();
    const arm = makeMockArmy();
    arm.unitLevel = 7;
    saveGame(eco, vil, arm);
    arm.unitLevel = 1;
    loadGame(eco, vil, arm);
    expect(arm.unitLevel).toBe(7);
  });

  it('should return lastSave timestamp', () => {
    saveGame(makeMockEconomy(), makeMockVillage(), makeMockArmy());
    const result = loadGame(makeMockEconomy(), makeMockVillage(), makeMockArmy());
    expect(result.lastSave).toBeGreaterThan(0);
  });

  it('should return lastSave:0 when no save exists', () => {
    const result = loadGame(makeMockEconomy(), makeMockVillage(), makeMockArmy());
    expect(result.lastSave).toBe(0);
  });

  it('should not throw on corrupted save data', () => {
    storage['wick_save'] = 'not-json';
    expect(() => loadGame(makeMockEconomy(), makeMockVillage(), makeMockArmy())).not.toThrow();
  });

  it('should restore buildings', () => {
    const eco = makeMockEconomy();
    const vil = makeMockVillage();
    const arm = makeMockArmy();
    vil.buildings[0].level = 7;
    saveGame(eco, vil, arm);
    vil.buildings[0].level = 0;
    loadGame(eco, vil, arm);
    expect(vil.buildings[0].level).toBe(7);
  });
});

describe('clearSave', () => {
  it('should remove the save key from localStorage', () => {
    saveGame(makeMockEconomy(), makeMockVillage(), makeMockArmy());
    expect(localStorage.getItem('wick_save')).toBeTruthy();
    clearSave();
    expect(localStorage.getItem('wick_save')).toBeNull();
  });
});
