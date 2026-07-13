import { describe, it, expect, beforeEach } from "vitest";
import { ExtractionMode } from "../js/modes/extraction-mode.js";

function createMockWorld() {
  const world = {
    W: 2400, H: 2400,
    mode: "campaign",
    _pvpDisabled: false,
    _campaignMode: false,
    leader: {
      x: 1200, y: 1200,
      speed: 140, hp: 120, maxHp: 120,
      path: null,
    },
    monsters: [],
    drops: [],
    treasureChests: [],
    armyUnits: [],
    worldFx: [],
    sessionStats: { kills: 0, coinsEarned: 0, pvpWins: 0, upgradesToday: 0 },
    economy: {
      gold: 1000,
      addRaw(type, amount) {
        if (type === "gold") this.gold = Math.max(0, this.gold + amount);
        if (type === "cash") this.cash = (this.cash || 0) + amount;
      },
      addXp() {},
    },
    initArmyUnits() {},
    createMonster(id, x, y, override) {
      return {
        id, x, y, spawnX: x, spawnY: y,
        alive: true, hp: 50, maxHp: 50,
        damage: 10, rewardMoney: 15, rewardGold: 8,
        color: "#8a5a3a", radius: 14, name: "وحش اختباري",
        facing: 1, attackCD: 0, respawnTimer: 0,
        _peaceful: true, ability: null,
        isBoss: false, _shieldTimer: 0, _phaseTimer: 0,
        imageKey: "monster-1", enemyId: "test_monster",
      };
    },
    isInSafeZone() { return false; },
    damageHero() {},
  };
  return world;
}

describe("ExtractionMode", () => {
  let world;
  let mode;

  beforeEach(() => {
    world = createMockWorld();
    mode = new ExtractionMode(world);
  });

  it("should create with correct modeName", () => {
    expect(mode.modeName).toBe("extraction");
  });

  it("should initialize correctly", () => {
    mode.init();
    expect(world.mode).toBe("extraction");
    expect(world._pvpDisabled).toBe(true);
    expect(mode._extractionActive).toBe(true);
    expect(mode._carryingGold).toBe(0);
    expect(mode._totalDeposited).toBe(0);
    expect(mode._extractionTimer).toBe(mode._extractionTimeLimit);
    expect(world.leader.hp).toBe(world.leader.maxHp);
  });

  it("should spawn monsters on init", () => {
    mode.init();
    expect(world.monsters.length).toBeGreaterThanOrEqual(15);
    expect(world.monsters.length).toBeLessThanOrEqual(25);
    for (const m of world.monsters) {
      expect(m._peaceful).toBe(true);
    }
  });

  it("should have a deposit zone after init", () => {
    mode.init();
    expect(mode._depositZone).toBeTruthy();
    expect(mode._depositZone.x).toBeGreaterThan(0);
    expect(mode._depositZone.y).toBeGreaterThan(0);
    expect(mode._depositZone.radius).toBe(60);
  });

  it("should get max bag capacity based on upgrades", () => {
    expect(mode._getMaxBag()).toBe(500);
    mode._currentUpgrades.bagSize = 2;
    expect(mode._getMaxBag()).toBe(600);
    mode._currentUpgrades.bagSize = 5;
    expect(mode._getMaxBag()).toBe(900);
  });

  it("should upgrade bag when enough gold", () => {
    expect(mode.performUpgrade("bagSize")).toBe(true);
    expect(mode._currentUpgrades.bagSize).toBe(2);
    expect(world.economy.gold).toBe(920);
  });

  it("should fail upgrade when not enough gold", () => {
    world.economy.gold = 10;
    expect(mode.performUpgrade("bagSize")).toBe(false);
    expect(mode._currentUpgrades.bagSize).toBe(1);
  });

  it("should calculate upgrade costs correctly", () => {
    expect(mode.getUpgradeCost("bagSize")).toBe(80);
    expect(mode.getUpgradeCost("speed")).toBe(120);
    expect(mode.getUpgradeCost("depositReward")).toBe(160);
    mode._currentUpgrades.bagSize = 3;
    expect(mode.getUpgradeCost("bagSize")).toBe(240);
  });

  it("should deposit gold and increase totalDeposited", () => {
    mode.init();
    mode._carryingGold = 200;
    mode._depositGold();
    expect(mode._carryingGold).toBe(0);
    expect(mode._totalDeposited).toBeGreaterThanOrEqual(200);
    expect(mode._depositZone).toBeTruthy();
  });

  it("should track kills on monster killed", () => {
    mode.init();
    const monster = { x: 100, y: 100, rewardGold: 5 };
    const initialKills = mode._extractionKills;
    mode.onMonsterKilled(monster);
    expect(mode._extractionKills).toBe(initialKills + 1);
  });

  it("should lose carrying gold on wipe", () => {
    mode.init();
    mode._carryingGold = 300;
    mode.onWipe();
    expect(mode._carryingGold).toBe(0);
  });

  it("should save and load state correctly", () => {
    mode.init();
    mode._totalDeposited = 5000;
    mode._extractionLevel = 3;
    mode._extractionXp = 75;
    mode._extractionKills = 42;
    mode._currentUpgrades.bagSize = 4;

    const saved = mode.getSaveData();
    expect(saved.modeName).toBe("extraction");
    expect(saved.totalDeposited).toBe(5000);
    expect(saved.extractionLevel).toBe(3);
    expect(saved.extractionKills).toBe(42);
    expect(saved.currentUpgrades.bagSize).toBe(4);

    const newMode = new ExtractionMode(createMockWorld());
    newMode.loadState(saved);
    expect(newMode._totalDeposited).toBe(5000);
    expect(newMode._extractionLevel).toBe(3);
    expect(newMode._extractionXp).toBe(75);
    expect(newMode._currentUpgrades.bagSize).toBe(4);
  });

  it("should decrease leader speed based on weight", () => {
    mode.init();
    const normalSpeed = world.leader.speed;
    mode._carryingGold = mode._getMaxBag();
    mode.update(0.1);
    expect(world.leader.speed).toBeLessThan(normalSpeed);
    expect(world.leader.speed).toBeGreaterThanOrEqual(140 * 0.4);
  });

  it("should end when timer runs out", () => {
    mode.init();
    mode._extractionTimer = 0.1;
    mode.update(0.2);
    expect(mode._extractionActive).toBe(false);
  });

  it("should exit cleanly and give bonus", () => {
    mode.init();
    mode._totalDeposited = 1000;
    const goldBefore = world.economy.gold;
    mode.exit();
    expect(world.mode).toBe("campaign");
    expect(world._pvpDisabled).toBe(false);
    expect(world.economy.gold).toBe(goldBefore + 100);
  });
});
