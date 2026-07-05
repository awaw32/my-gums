import { describe, it, expect } from 'vitest';
import {
  ENEMY_TYPES,
  getEnemyForLevel,
  getBossForVillage,
  getEnemiesForVillage,
  calculateEnemyPower
} from '../server/data/enemies.js';

describe('Server Enemy Data', () => {
  it('should have 20 enemy definitions', () => {
    expect(Object.keys(ENEMY_TYPES)).toHaveLength(20);
  });

  it('should return enemy scaled for level 1', () => {
    const enemy = getEnemyForLevel(1);
    expect(enemy).toBeTruthy();
    expect(enemy.isBoss).toBeFalsy();
  });

  it('should scale enemy power with player level', () => {
    const enemy = ENEMY_TYPES.desert_wolf;
    const scaled = calculateEnemyPower(enemy, 10);
    expect(scaled.hp).toBeGreaterThan(enemy.hp);
    expect(scaled.damage).toBeGreaterThan(enemy.damage);
  });

  it('should return a boss for each village', () => {
    expect(getBossForVillage('wadi')).toBeTruthy();
    expect(getBossForVillage('palace_ruins')).toBeTruthy();
    expect(getBossForVillage('mountain')).toBeTruthy();
    expect(getBossForVillage('plains')).toBeTruthy();
    expect(getBossForVillage('throne')).toBeTruthy();
  });

  it('should return 3 regular enemies per village', () => {
    expect(getEnemiesForVillage('wadi')).toHaveLength(3);
    expect(getEnemiesForVillage('palace_ruins')).toHaveLength(3);
    expect(getEnemiesForVillage('mountain')).toHaveLength(3);
    expect(getEnemiesForVillage('plains')).toHaveLength(3);
    expect(getEnemiesForVillage('throne')).toHaveLength(3);
  });
});
