import { describe, it, expect, beforeEach } from 'vitest';
import { NetworkSync } from '../js/network-sync.js';

function makeMockWorld() {
  const monsters = [];
  const otherPlayers = new Map();
  const bandits = [];
  const sessionStats = { kills: 0, coinsEarned: 0 };
  return {
    W: 2400, H: 2400,
    leader: { x: 1200, y: 1200, hp: 120, maxHp: 120 },
    economy: { level: 1, power: 5000, cash: 1000, gems: 50, gold: 200, kingCoins: 0, hammers: 0, scrolls: 0, horns: 0, armyYardLevel: 1, knowledgeLevel: 1, knowledgeType: 'economic', buildings: {}, research: {} },
    army: { unitLevel: 1, weapons: [] },
    mode: 'world',
    monsters,
    otherPlayers,
    bandits,
    sessionStats,
    armyUnits: [],
    _equippedWeapon: '',
    _weaponStarLevel: 1,
    _weaponGemLevel: 1,
    _monstersSynced: false,
    store: { set: () => {} },
    _onSelfStatsChanged: null,
  };
}

describe('NetworkSync', () => {
  let ns;
  let world;

  beforeEach(() => {
    ns = new NetworkSync('http://localhost:3000', 'testplayer');
    world = makeMockWorld();
    ns.world = world;
  });

  describe('constructor', () => {
    it('should store apiBase and username', () => {
      expect(ns.apiBase).toBe('http://localhost:3000');
      expect(ns.username).toBe('testplayer');
    });

    it('should start with null web socket', () => {
      expect(ns._ws).toBeNull();
    });
  });

  describe('isConnected', () => {
    it('should return false when no websocket', () => {
      expect(ns.isConnected).toBe(false);
    });

    it('should return false when websocket is not open', () => {
      ns._ws = { readyState: 0 };
      // WebSocket.CONNECTING = 0
      expect(ns.isConnected).toBe(false);
    });
  });

  describe('syncMonsters', () => {
    it('should add new monsters from server', () => {
      const serverMonsters = [
        { id: 'm1', x: 100, y: 200, hp: 50, maxHp: 50, alive: true },
      ];
      ns.syncMonsters(serverMonsters);
      expect(world.monsters).toHaveLength(1);
      expect(world.monsters[0].id).toBe('m1');
      expect(world.monsters[0]._targetX).toBe(100);
    });

    it('should update existing monsters', () => {
      world.monsters.push({ id: 'm1', x: 0, y: 0, hp: 30, maxHp: 50, alive: true, facing: 1, attackCD: 0 });
      const serverMonsters = [
        { id: 'm1', x: 200, y: 300, hp: 20, maxHp: 50, alive: true },
      ];
      ns.syncMonsters(serverMonsters);
      expect(world.monsters[0].hp).toBe(20);
      expect(world.monsters[0]._targetX).toBe(200);
    });

    it('should mark monsters as dead when server says not alive', () => {
      world.monsters.push({ id: 'm1', x: 0, y: 0, hp: 50, maxHp: 50, alive: true, facing: 1, attackCD: 0 });
      const serverMonsters = [
        { id: 'm1', x: 0, y: 0, hp: 0, maxHp: 50, alive: false, respawnTimer: 30 },
      ];
      ns.syncMonsters(serverMonsters);
      expect(world.monsters[0].alive).toBe(false);
      expect(world.monsters[0].respawnTimer).toBe(30);
    });

    it('should remove monsters no longer in server list', () => {
      world.monsters.push({ id: 'm1', x: 0, y: 0, hp: 50, maxHp: 50, alive: true, facing: 1, attackCD: 0 });
      world.monsters.push({ id: 'm2', x: 0, y: 0, hp: 50, maxHp: 50, alive: true, facing: 1, attackCD: 0 });
      const serverMonsters = [
        { id: 'm1', x: 0, y: 0, hp: 50, maxHp: 50, alive: true },
      ];
      ns.syncMonsters(serverMonsters);
      expect(world.monsters).toHaveLength(1);
      expect(world.monsters[0].id).toBe('m1');
    });

    it('should return early with empty server list (existing monsters preserved)', () => {
      world.monsters.push({ id: 'm1', x: 0, y: 0, hp: 50, maxHp: 50, alive: true, facing: 1, attackCD: 0 });
      ns.syncMonsters([]);
      // syncMonsters returns early if serverMonsters.length===0, preserving existing
      expect(world.monsters).toHaveLength(1);
    });

    it('should handle null/undefined input gracefully', () => {
      expect(() => ns.syncMonsters(null)).not.toThrow();
      expect(() => ns.syncMonsters(undefined)).not.toThrow();
    });
  });

  describe('syncOtherPlayers', () => {
    it('should add new players from server list', () => {
      const players = [
        { username: 'player1', x_position: 500, y_position: 600, army_power: 3000, last_active: new Date().toISOString() },
      ];
      ns.syncOtherPlayers(players);
      expect(world.otherPlayers.has('player1')).toBe(true);
      const p = world.otherPlayers.get('player1');
      expect(p.x).toBe(500);
      expect(p.army_power).toBe(3000);
    });

    it('should skip self player', () => {
      const players = [
        { username: 'testplayer', x_position: 500, y_position: 600, army_power: 3000, last_active: new Date().toISOString() },
      ];
      ns.syncOtherPlayers(players);
      expect(world.otherPlayers.size).toBe(0);
    });

    it('should skip players without username', () => {
      const players = [
        { x_position: 500, y_position: 600, army_power: 3000, last_active: new Date().toISOString() },
      ];
      ns.syncOtherPlayers(players);
      expect(world.otherPlayers.size).toBe(0);
    });

    it('should update existing players', () => {
      world.otherPlayers.set('player1', {
        username: 'player1', x: 0, y: 0, targetX: 0, targetY: 0, radius: 16,
        army_power: 1000, unitLevel: 1, armyAlive: 8, lastActive: Date.now(),
        hp: 120, maxHp: 120,
      });
      const players = [
        { username: 'player1', x_position: 800, y_position: 900, army_power: 5000, unitLevel: 3, last_active: new Date().toISOString() },
      ];
      ns.syncOtherPlayers(players);
      const p = world.otherPlayers.get('player1');
      expect(p.targetX).toBe(800);
      expect(p.army_power).toBe(5000);
    });

    it('should remove inactive players', () => {
      world.otherPlayers.set('player1', {
        username: 'player1', x: 0, y: 0, targetX: 0, targetY: 0, radius: 16,
        army_power: 1000, unitLevel: 1, armyAlive: 8, lastActive: Date.now() - 20000,
        hp: 120, maxHp: 120,
      });
      ns.syncOtherPlayers([]);
      expect(world.otherPlayers.size).toBe(0);
    });
  });

  describe('send', () => {
    it('should not throw when no websocket', () => {
      expect(() => ns.send({ type: 'test' })).not.toThrow();
    });
  });
});
