import { describe, it, expect, beforeEach } from "vitest";
import { CaveMode } from "../js/modes/cave-mode.js";

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
        alive: true, hp: 100, maxHp: 100, damage: 15,
        rewardMoney: 20, rewardGold: 8,
        color: override?.color || "#ff6b35",
        radius: override?.radius || 14,
        name: override?.name || "وحش كهف",
        facing: 1, attackCD: 0, respawnTimer: 0,
        ability: null, isBoss: false,
        _shieldTimer: 0, _phaseTimer: 0,
        imageKey: "monster-1", enemyId: override?.id || "cave_test",
        _caveMonster: true,
      };
    },
    isInSafeZone() { return false; },
    damageHero(dmg) { this.leader.hp = Math.max(0, this.leader.hp - dmg); },
  };
  return world;
}

describe("CaveMode", () => {
  let world;
  let mode;

  beforeEach(() => {
    world = createMockWorld();
    mode = new CaveMode(world);
  });

  it("should create with correct modeName", () => {
    expect(mode.modeName).toBe("cave");
  });

  it("should initialize correctly", () => {
    mode.init();
    expect(world.mode).toBe("cave");
    expect(world._pvpDisabled).toBe(true);
    expect(mode._caveActive).toBe(true);
    expect(mode._caveDepth).toBe(1);
    expect(mode._caveLevel).toBe(1);
    expect(world.leader.hp).toBe(world.leader.maxHp);
  });

  it("should generate lava pools on init", () => {
    mode.init();
    expect(mode._lavaPools.length).toBe(6);
    for (const p of mode._lavaPools) {
      expect(p.radius).toBeGreaterThanOrEqual(30);
      expect(p.radius).toBeLessThanOrEqual(90);
    }
  });

  it("should create tunnel links on init", () => {
    mode.init();
    expect(mode._tunnelLinks.length).toBe(3);
    for (const link of mode._tunnelLinks) {
      expect(link.entrance).toBeTruthy();
      expect(link.exit).toBeTruthy();
    }
  });

  it("should spawn monsters on init", () => {
    mode.init();
    expect(world.monsters.length).toBeGreaterThanOrEqual(10);
  });

  it("should spawn treasure chests", () => {
    mode.init();
    expect(world.treasureChests.length).toBeGreaterThanOrEqual(3);
  });

  it("should create cave exit", () => {
    mode.init();
    expect(mode._caveExit).toBeTruthy();
    expect(mode._caveExit.x).toBe(world.W / 2);
    expect(mode._caveExit.y).toBe(world.H - 100);
  });

  it("should detect near lava", () => {
    mode.init();
    const pool = mode._lavaPools[0];
    expect(mode._isNearLava(pool.x, pool.y)).toBe(true);
    expect(mode._isNearLava(pool.x + pool.radius + 100, pool.y)).toBe(false);
  });

  it("should track score and kills on monster killed", () => {
    mode.init();
    const monster = { _caveMonster: true, x: 100, y: 100 };
    mode.onMonsterKilled(monster);
    expect(mode._caveMonstersKilled).toBe(1);
    expect(mode._caveScore).toBeGreaterThan(0);
  });

  it("should not track kills for non-cave monsters", () => {
    mode.init();
    mode.onMonsterKilled({ _caveMonster: false });
    expect(mode._caveMonstersKilled).toBe(0);
  });

  it("should go deeper to next depth", () => {
    mode.init();
    mode._goDeeper();
    expect(mode._caveDepth).toBe(2);
    expect(world.leader.hp).toBe(world.leader.maxHp);
  });

  it("should handle tunnel warp cooldown", () => {
    mode.init();
    const link = mode._tunnelLinks[0];
    world.leader.x = link.entrance.x;
    world.leader.y = link.entrance.y;
    mode.update(0.1);
    expect(world.leader.x).toBe(link.exit.x);
    expect(world.leader.y).toBe(link.exit.y);
    expect(mode._tunnelCooldown).toBeGreaterThan(0);
  });

  it("should damage hero when near lava", () => {
    mode.init();
    const pool = mode._lavaPools[0];
    world.leader.x = pool.x;
    world.leader.y = pool.y;
    const hpBefore = world.leader.hp;
    mode.update(0.1);
    expect(world.leader.hp).toBeLessThan(hpBefore);
  });

  it("should exit cave and give rewards", () => {
    mode.init();
    mode._caveScore = 500;
    mode._rareItemsCollected = 3;
    mode._caveDepth = 5;
    mode._exitCave();
    expect(mode._caveActive).toBe(false);
  });

  it("should save and load state correctly", () => {
    mode.init();
    mode._caveDepth = 5;
    mode._caveLevel = 3;
    mode._rareItemsCollected = 7;
    mode._caveMonstersKilled = 42;
    mode._caveScore = 2500;

    const saved = mode.getSaveData();
    expect(saved.modeName).toBe("cave");
    expect(saved.caveDepth).toBe(5);
    expect(saved.caveLevel).toBe(3);
    expect(saved.rareItemsCollected).toBe(7);
    expect(saved.caveMonstersKilled).toBe(42);
    expect(saved.caveScore).toBe(2500);

    const newMode = new CaveMode(createMockWorld());
    newMode.loadState(saved);
    expect(newMode._caveDepth).toBe(5);
    expect(newMode._caveLevel).toBe(3);
    expect(newMode._rareItemsCollected).toBe(7);
    expect(newMode._caveScore).toBe(2500);
  });

  it("should exit cleanly", () => {
    mode.init();
    mode.exit();
    expect(world.mode).toBe("campaign");
    expect(world._pvpDisabled).toBe(false);
    expect(mode._caveActive).toBe(false);
  });
});
