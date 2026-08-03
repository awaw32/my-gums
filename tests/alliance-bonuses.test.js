import { describe, it, expect } from 'vitest';
import { getAllianceBonuses, ALLIANCE_TIER_BONUSES } from '../server/logic/allianceManager.js';
import { computePlayerStats } from '../server/logic/formulas.js';

// 🛡️ مكافآت مستوى التحالف (ضرر/دفاع/دخل) كانت تُحسب وتُعرض على العميل فقط
// (js/alliance-manager.js) بلا أي تطبيق أو تحقق سيرفري إطلاقاً — عضوية تحالف
// قوي كانت وعداً بصرياً لا يؤثر على PvP الحقيقي أو مكافآت قتل الوحوش.
describe('🏜️ مكافآت مستوى التحالف (server/logic/allianceManager.js: getAllianceBonuses)', () => {
  function fakeGetAlliance(level) {
    return () => ({ level });
  }

  it('يُرجع صفراً بلا أي مكافأة للاعب بلا تحالف', () => {
    const bonuses = getAllianceBonuses(null, fakeGetAlliance(3));
    expect(bonuses).toEqual({ damageBonus: 0, defenseBonus: 0, incomeMult: 1 });
  });

  it('يُرجع صفراً لتحالف بمستوى 0 (لم يُرقَّ بعد)', () => {
    const bonuses = getAllianceBonuses('alliance1', fakeGetAlliance(0));
    expect(bonuses).toEqual({ damageBonus: 0, defenseBonus: 0, incomeMult: 1 });
  });

  it('damageBonus وdefenseBonus تراكميتان — مجموع كل الرُّتب حتى المستوى الحالي', () => {
    // نفس منطق js/alliance-manager.js damageBonus/defenseBonus getters تماماً
    const level1 = getAllianceBonuses('a', fakeGetAlliance(1));
    expect(level1.damageBonus).toBe(ALLIANCE_TIER_BONUSES[0].damageBonus);
    expect(level1.defenseBonus).toBe(ALLIANCE_TIER_BONUSES[0].defenseBonus);

    const level4 = getAllianceBonuses('a', fakeGetAlliance(4));
    const expectedDmg = ALLIANCE_TIER_BONUSES.reduce((sum, t) => sum + t.damageBonus, 0);
    const expectedDef = ALLIANCE_TIER_BONUSES.reduce((sum, t) => sum + t.defenseBonus, 0);
    expect(level4.damageBonus).toBe(expectedDmg);
    expect(level4.defenseBonus).toBe(expectedDef);
  });

  it('incomeMult قيمة الرتبة الحالية فقط — وليست تراكمية', () => {
    const level1 = getAllianceBonuses('a', fakeGetAlliance(1));
    expect(level1.incomeMult).toBe(ALLIANCE_TIER_BONUSES[0].incomeMult);

    const level4 = getAllianceBonuses('a', fakeGetAlliance(4));
    expect(level4.incomeMult).toBe(ALLIANCE_TIER_BONUSES[3].incomeMult);
  });

  it('يتعامل بأمان مع تحالف غير موجود', () => {
    const bonuses = getAllianceBonuses('missing', () => null);
    expect(bonuses).toEqual({ damageBonus: 0, defenseBonus: 0, incomeMult: 1 });
  });
});

describe('🗡️ تطبيق مكافأة ضرر التحالف على computePlayerStats الفعلي', () => {
  const basePlayer = () => ({
    level: 10, unitLevel: 5, trainingLevel: 3, prestigeLevel: 1,
    army_power: 8000, armyYardLevel: 4, equippedWeapon: 'w3',
    weapons: [{ id: 'w3', level: 2 }], buildings: {}, research: {},
  });

  it('لاعب بلا تحالف (allianceId فارغ) لا يحصل على أي إضافة ضرر', () => {
    const stats = computePlayerStats({ ...basePlayer(), allianceId: '' });
    expect(stats.allianceIncomeMult).toBe(1);
  });

  it('لاعب بمعرّف تحالف غير موجود في allianceMemStore لا يحصل على أي إضافة (آمن)', () => {
    const stats = computePlayerStats({ ...basePlayer(), allianceId: 'nonexistent_alliance_id_xyz' });
    expect(stats.allianceIncomeMult).toBe(1);
    expect(stats.totalDamage).toBeGreaterThanOrEqual(1);
  });

  it('تحالف حقيقي بمستوى 4 يزيد totalDamage فعلياً بمقدار damageBonus التراكمي ويرفع allianceIncomeMult', () => {
    // 🛡️ require عبر CJS (وليس import ESM) عمداً — تفادي تسجيل نموذج mongoose
    // "Player" مرتين عبر مسارين مختلفين للوحدات (OverwriteModelError)، لأن
    // allianceHelper.js وformulas.js كلاهما يستوردان databaseHelper.js داخلياً.
    const { allianceMemStore } = require('../server/db/allianceHelper.js');
    const allianceId = 'test_alliance_' + Math.random().toString(36).slice(2, 8);
    allianceMemStore.set(allianceId, { id: allianceId, level: 4, members: [] });

    const withoutAlliance = computePlayerStats({ ...basePlayer(), allianceId: '' });
    const withAlliance = computePlayerStats({ ...basePlayer(), allianceId });

    const expectedDmgBonus = ALLIANCE_TIER_BONUSES.reduce((sum, t) => sum + t.damageBonus, 0);
    expect(withAlliance.totalDamage).toBe(withoutAlliance.totalDamage + expectedDmgBonus);
    expect(withAlliance.allianceIncomeMult).toBe(ALLIANCE_TIER_BONUSES[3].incomeMult);

    allianceMemStore.delete(allianceId);
  });
});
