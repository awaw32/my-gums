import { describe, it, expect, beforeEach } from 'vitest';
import { WorldMap } from '../js/world.js';
import { GameEconomy } from '../js/economy.js';
import { GameArmy } from '../js/army.js';

if (typeof Image === 'undefined') {
  globalThis.Image = class {
    constructor() { setTimeout(() => this.onload?.(), 0); }
    set src(_) {}
  };
}
if (typeof ImageResolver === 'undefined') {
  globalThis.ImageResolver = { src: (key) => `assets/images/${key}.png` };
}

describe('Campaign Mode', () => {
  let economy, world;

  beforeEach(() => {
    economy = new GameEconomy();
    const army = new GameArmy(economy);
    world = new WorldMap(economy, 'test', '', army);
  });

  it('should spawn campaign monsters for wadi village', () => {
    world.spawnCampaignMonsters('wadi', false);
    expect(world.monsters.length).toBeGreaterThanOrEqual(6);
    expect(world.monsters.every(m => m.alive)).toBe(true);
  });

  it('should include boss when requested', () => {
    world.spawnCampaignMonsters('wadi', true);
    const boss = world.monsters.find(m => m.enemyId === 'wadi_boss');
    expect(boss).toBeTruthy();
  });

  it('should scale monster power by player level', () => {
    economy.level = 10;
    world.spawnCampaignMonsters('wadi', false);
    const monster = world.monsters[0];
    expect(monster.hp).toBeGreaterThan(35); // base desert_wolf hp
  });

  it('should not respawn normal monsters in campaign mode', () => {
    world._campaignMode = true;
    world.spawnCampaignMonsters('wadi', false);
    const count = world.monsters.length;
    world.spawnMonsters();
    expect(world.monsters.length).toBe(count);
  });
});
