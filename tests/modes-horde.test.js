import { describe, it, expect, beforeEach } from "vitest";
import { HordeMode } from "../js/modes/horde-mode.js";

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
    economy: { gold: 500, cash: 500, addRaw() {}, addXp() {} },
    initArmyUnits() {},
    createMonster(id, x, y, override) {
      return {
        id, x, y, spawnX: x, spawnY: y,
        alive: true, hp: 40, maxHp: 40, damage: 8,
        rewardMoney: 10, rewardGold: 3,
        color: "#ff6b6b", radius: 12, name: "وحش حشد",
        facing: 1, attackCD: 0, respawnTimer: 0,
        ability: null, isBoss: false,
        _shieldTimer: 0, _phaseTimer: 0,
        imageKey: "monster-1", enemyId: "test_horde",
      };
    },
    isInSafeZone() { return false; },
    damageHero() {},
  };
  return world;
}

describe("HordeMode", () => {
  let world;
  let mode;

  beforeEach(() => {
    world = createMockWorld();
    mode = new HordeMode(world);
  });

  it("should create with correct modeName", () => {
    expect(mode.modeName).toBe("horde");
  });

  it("should initialize correctly", () => {
    mode.init();
    expect(world.mode).toBe("horde");
    expect(mode._hordeActive).toBe(true);
    expect(mode._hordeOver).toBe(false);
    expect(mode._wave).toBe(1);
    expect(mode._monstersAlive).toBe(8);
    expect(world.leader.hp).toBe(world.leader.maxHp);
  });

  it("should spawn initial horde of monsters", () => {
    mode.init();
    expect(world.monsters.length).toBe(8);
    expect(world.monsters.every(m => m._hordeMode)).toBe(true);
    for (const m of world.monsters) {
      expect(m._aggressiveRange).toBe(500);
    }
  });

  it("should increase monster difficulty after wave 5", () => {
    mode.init();
    mode._wave = 6;
    const monster = mode._spawnHordeMonster(99);
    expect(monster.hp).toBeGreaterThan(40);
  });

  it("should track wave progression", () => {
    mode.init();
    expect(mode._wave).toBe(1);
    expect(mode._maxWave).toBe(20);
  });

  it("should end horde on wipe", () => {
    mode.init();
    world.leader.hp = 0;
    mode.update(0.1);
    expect(mode._hordeOver).toBe(true);
    expect(mode._hordeActive).toBe(false);
  });

  it("should count kills and add score on monster killed", () => {
    mode.init();
    const monster = world.monsters[0] || { x: 100, y: 100 };
    mode.onMonsterKilled(monster);
    expect(mode._hordeKills).toBe(1);
    expect(mode._hordeScore).toBeGreaterThan(0);
  });

  it("should provide bonuses on winning all waves", () => {
    mode.init();
    mode._hordeScore = 1000;
    mode._hordeKills = 50;
    mode._wave = mode._maxWave;
    mode._endHorde(true);
    expect(mode._hordeOver).toBe(true);
    expect(mode._hordeActive).toBe(false);
  });

  it("should save and load state correctly", () => {
    mode.init();
    mode._wave = 10;
    mode._hordeKills = 85;
    mode._survivalTime = 300;
    mode._hordeScore = 5500;

    const saved = mode.getSaveData();
    expect(saved.modeName).toBe("horde");
    expect(saved.wave).toBe(10);
    expect(saved.hordeKills).toBe(85);
    expect(saved.survivalTime).toBe(300);
    expect(saved.hordeScore).toBe(5500);

    const newMode = new HordeMode(createMockWorld());
    newMode.loadState(saved);
    expect(newMode._wave).toBe(10);
    expect(newMode._hordeKills).toBe(85);
    expect(newMode._hordeScore).toBe(5500);
  });

  it("should exit cleanly", () => {
    mode.init();
    mode.exit();
    expect(world.mode).toBe("campaign");
    expect(mode._hordeActive).toBe(false);
    expect(mode._hordeOver).toBe(false);
  });
});
