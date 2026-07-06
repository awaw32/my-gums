import { describe, it, expect } from 'vitest';
import { computeWeaponDamage, getWeaponDef, WEAPON_DEFS } from '../js/combat/weapon-system.js';

describe('getWeaponDef', () => {
  it('should return weapon def for known weapon w1', () => {
    const def = getWeaponDef('w1');
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

  it('should compute damage when weapon not in weapons list (falls back to level=0)', () => {
    const result = computeWeaponDamage({ equippedWeapon: 'w1', weapons: [] });
    // level=0: baseDamage=4+floor(3*0/2)=4, bonus=0, damage=floor(4*1)=4
    expect(result.weaponDamage).toBe(4);
    expect(result.starLevel).toBe(1); // Math.max(1, 0) = 1
  });

  it('should compute damage for equipped weapon at level=1', () => {
    // baseDamage=4+floor(3*1/2)=5, bonus=1*0.3=0.3, damage=floor(5*1.3)=6
    const result = computeWeaponDamage({
      equippedWeapon: 'w1',
      weapons: [{ id: 'w1', level: 1 }],
    });
    expect(result.weaponDamage).toBe(6);
    expect(result.starLevel).toBe(1);
    expect(result.range).toBe('melee');
  });

  it('should increase damage with higher level', () => {
    const base = computeWeaponDamage({
      equippedWeapon: 'w1',
      weapons: [{ id: 'w1', level: 1 }],
    });
    const upgraded = computeWeaponDamage({
      equippedWeapon: 'w1',
      weapons: [{ id: 'w1', level: 3 }],
    });
    // level=3: baseDamage=4+floor(3*3/2)=4+4=8, bonus=3*0.3=0.9, damage=floor(8*1.9)=15
    expect(upgraded.weaponDamage).toBe(15);
    expect(upgraded.weaponDamage).toBeGreaterThan(base.weaponDamage);
    expect(upgraded.starLevel).toBe(3);
  });

  it('should increase crit chance with higher level', () => {
    const base = computeWeaponDamage({
      equippedWeapon: 'w4', // سيف دمشقي, base crit=0.12
      weapons: [{ id: 'w4', level: 1 }],
    });
    const upgraded = computeWeaponDamage({
      equippedWeapon: 'w4',
      weapons: [{ id: 'w4', level: 5 }],
    });
    // base crit=0.12, levelBonus=5*0.02=0.10 => 0.22
    expect(upgraded.critChance).toBeCloseTo(0.22, 5);
    expect(upgraded.critChance).toBeGreaterThan(base.critChance);
  });

  it('should increase crit multiplier with higher level', () => {
    const base = computeWeaponDamage({
      equippedWeapon: 'w4', // سيف دمشقي, base critMult=2.2
      weapons: [{ id: 'w4', level: 1 }],
    });
    const upgraded = computeWeaponDamage({
      equippedWeapon: 'w4',
      weapons: [{ id: 'w4', level: 5 }],
    });
    // base critMult=2.2, levelBonus=5*0.1=0.5 => 2.7
    expect(upgraded.critMultiplier).toBe(2.7);
    expect(upgraded.critMultiplier).toBeGreaterThan(base.critMultiplier);
  });

  it('should compute max-level weapon correctly', () => {
    // w4 (سيف دمشقي) level=5: baseDamage=13+floor(8*5/2)=13+20=33, bonus=5*0.3=1.5
    // damage=floor(33*2.5)=82
    const result = computeWeaponDamage({
      equippedWeapon: 'w4',
      weapons: [{ id: 'w4', level: 5 }],
    });
    expect(result.weaponDamage).toBe(82);
    expect(result.damageMult).toBeCloseTo(2.5, 5);
  });

  it('should fall back to level=0 when weapon missing level', () => {
    const result = computeWeaponDamage({
      equippedWeapon: 'w1',
      weapons: [{ id: 'w1' }],
    });
    expect(result.starLevel).toBe(1); // Math.max(1, 0)
    expect(result.weaponDamage).toBeGreaterThan(0);
  });
});

describe('WEAPON_DEFS', () => {
  it('should define 6 weapons', () => {
    expect(WEAPON_DEFS).toHaveLength(6);
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

  it('weapons should be in order w1-w6', () => {
    const ids = WEAPON_DEFS.map(w => w.id);
    expect(ids).toEqual(['w1', 'w2', 'w3', 'w4', 'w5', 'w6']);
  });
});
