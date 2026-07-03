import { describe, it, expect } from 'vitest';
import { computeWeaponDamage, getWeaponDef, WEAPON_DEFS } from '../js/combat/weapon-system.js';

describe('getWeaponDef', () => {
  it('should return weapon def for known weapon', () => {
    const def = getWeaponDef('bedouin_sword');
    expect(def).toBeTruthy();
    expect(def.name).toBe('سيف بدوي');
    expect(def.baseDamage).toBe(4);
  });

  it('should return null for unknown weapon', () => {
    expect(getWeaponDef('nonexistent')).toBeNull();
  });
});

describe('computeWeaponDamage', () => {
  it('should return zero damage when no weapon equipped', () => {
    const result = computeWeaponDamage({ equippedWeapon: '', weapons: [] });
    expect(result.weaponDamage).toBe(0);
    expect(result.critChance).toBe(0);
  });

  it('should compute damage when equipped weapon not in weapons list (falls back to def with star=1 gem=1)', () => {
    const result = computeWeaponDamage({ equippedWeapon: 'bedouin_sword', weapons: [] });
    expect(result.weaponDamage).toBe(4);
    expect(result.starLevel).toBe(1);
    expect(result.gemLevel).toBe(1);
  });

  it('should compute damage for equipped weapon at star=1 gem=1', () => {
    const result = computeWeaponDamage({
      equippedWeapon: 'bedouin_sword',
      weapons: [{ id: 'bedouin_sword', starLevel: 1, gemLevel: 1 }],
    });
    // base=4, combined=(1-1)*8+1=1, flat=4+floor(3*0/4)=4, bonus=0.05+0=0.05, damage=floor(4*1.05)=4
    expect(result.weaponDamage).toBe(4);
    expect(result.starLevel).toBe(1);
    expect(result.gemLevel).toBe(1);
    expect(result.combinedLevel).toBe(1);
    expect(result.range).toBe('melee');
  });

  it('should increase damage with higher starLevel', () => {
    const base = computeWeaponDamage({
      equippedWeapon: 'bedouin_sword',
      weapons: [{ id: 'bedouin_sword', starLevel: 1, gemLevel: 1 }],
    });
    const upgraded = computeWeaponDamage({
      equippedWeapon: 'bedouin_sword',
      weapons: [{ id: 'bedouin_sword', starLevel: 3, gemLevel: 1 }],
    });
    expect(upgraded.weaponDamage).toBeGreaterThan(base.weaponDamage);
    expect(upgraded.starLevel).toBe(3);
    expect(upgraded.gemLevel).toBe(1);
  });

  it('should increase crit chance with higher starLevel', () => {
    const base = computeWeaponDamage({
      equippedWeapon: 'damascus_sword',
      weapons: [{ id: 'damascus_sword', starLevel: 1, gemLevel: 1 }],
    });
    const upgraded = computeWeaponDamage({
      equippedWeapon: 'damascus_sword',
      weapons: [{ id: 'damascus_sword', starLevel: 5, gemLevel: 1 }],
    });
    // base crit=0.15, starBonus=(5-1)*0.02=0.08 => 0.23
    expect(upgraded.critChance).toBeCloseTo(0.23, 5);
    expect(upgraded.critChance).toBeGreaterThan(base.critChance);
  });

  it('should increase crit multiplier with higher gemLevel', () => {
    const base = computeWeaponDamage({
      equippedWeapon: 'damascus_sword',
      weapons: [{ id: 'damascus_sword', starLevel: 1, gemLevel: 1 }],
    });
    const upgraded = computeWeaponDamage({
      equippedWeapon: 'damascus_sword',
      weapons: [{ id: 'damascus_sword', starLevel: 1, gemLevel: 5 }],
    });
    // base critMult=2.5, gemBonus=(5-1)*0.05=0.2 => 2.7
    expect(upgraded.critMultiplier).toBe(2.7);
    expect(upgraded.critMultiplier).toBeGreaterThan(base.critMultiplier);
  });

  it('should compute max-level weapon correctly', () => {
    // Star 5, Gem 8 => combined=(5-1)*8+8=40, flat=7+floor(5*39/4)=7+48=55, bonus=8*0.05+(5-1)*0.25=0.4+1.0=1.4, damage=floor(55*2.4)=132
    const result = computeWeaponDamage({
      equippedWeapon: 'damascus_sword',
      weapons: [{ id: 'damascus_sword', starLevel: 5, gemLevel: 8 }],
    });
    expect(result.weaponDamage).toBe(132);
    expect(result.damageMult).toBeCloseTo(2.4, 5);
  });

  it('should fall back to star=1 gem=1 when weapon missing starLevel/gemLevel', () => {
    const result = computeWeaponDamage({
      equippedWeapon: 'bedouin_sword',
      weapons: [{ id: 'bedouin_sword' }],
    });
    expect(result.starLevel).toBe(1);
    expect(result.gemLevel).toBe(1);
    expect(result.weaponDamage).toBeGreaterThan(0);
  });
});

describe('WEAPON_DEFS', () => {
  it('should define 4 weapons', () => {
    expect(WEAPON_DEFS).toHaveLength(4);
  });

  it('each weapon should have required fields', () => {
    for (const w of WEAPON_DEFS) {
      expect(w.id).toBeTruthy();
      expect(w.name).toBeTruthy();
      expect(typeof w.baseDamage).toBe('number');
      expect(typeof w.damagePerLevel).toBe('number');
      expect(['melee', 'ranged']).toContain(w.range);
    }
  });
});
