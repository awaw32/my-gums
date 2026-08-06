import { describe, it, expect } from 'vitest';
const { computeUpgradeTreeEffects, ARMY_LEVEL_EFFECTS, DEFENSE_LEVEL_EFFECTS } = require('../server/db/upgradeTree.js');
const { computePlayerStats } = require('../server/logic/formulas.js');
const { simulatePvPFull } = require('../server/logic/combatResolver.js');

// 🛡️ قبل هذا الإصلاح: تأثيرات مساري "الجيش" و"الدفاع" من شجرة الترقيات
// (js/upgrade-tree.js) كانت تُحسب وتُستهلك حصراً على العميل (combat-engine.js/
// world.js) بلا أي استهلاك سيرفري — حقل الحفظ upgrades كان بلا أي تحقق بنيوي،
// فيستطيع أي عميل خبيث إرسال upgrades.army/defense بمستوى مزيّف (أو أعلى من
// الحد الأقصى الحقيقي 5) ليحصل على ضرر/دفاع إضافي غير محدود في أي معركة PvP
// يحسمها الخادم.

describe('🛡️ تأثيرات شجرة الترقيات (server/db/upgradeTree.js)', () => {
  it('يحسب مجموع تأثير army التراكمي بشكل صحيح', () => {
    const effects = computeUpgradeTreeEffects({ upgrades: { army: 3 } });
    expect(effects.armyDamageBonus).toBe(ARMY_LEVEL_EFFECTS[0] + ARMY_LEVEL_EFFECTS[1] + ARMY_LEVEL_EFFECTS[2]);
  });

  it('يحسب مجموع تأثير defense التراكمي بشكل صحيح', () => {
    const effects = computeUpgradeTreeEffects({ upgrades: { defense: 2 } });
    expect(effects.defensePercent).toBe(DEFENSE_LEVEL_EFFECTS[0] + DEFENSE_LEVEL_EFFECTS[1]);
  });

  it('يحصر المستوى عند الحد الأقصى الحقيقي حتى لو ادّعى الحفظ مستوى أعلى (9999)', () => {
    const effects = computeUpgradeTreeEffects({ upgrades: { army: 9999, defense: 9999 } });
    const maxArmy = ARMY_LEVEL_EFFECTS.reduce((a, b) => a + b, 0);
    const maxDefense = DEFENSE_LEVEL_EFFECTS.reduce((a, b) => a + b, 0);
    expect(effects.armyDamageBonus).toBe(maxArmy);
    expect(effects.defensePercent).toBe(maxDefense);
  });

  it('يتجاهل مستوى سالباً (لا يُنتج تأثيراً سالباً)', () => {
    const effects = computeUpgradeTreeEffects({ upgrades: { army: -5 } });
    expect(effects.armyDamageBonus).toBe(0);
  });

  it('لا ينهار عند غياب حقل upgrades إطلاقاً', () => {
    expect(() => computeUpgradeTreeEffects({})).not.toThrow();
    expect(computeUpgradeTreeEffects({}).armyDamageBonus).toBe(0);
  });

  it('لا يتأثر بادّعاء مسار غير موجود (knowledge/trade اقتصاديان، لا تأثير قتالي)', () => {
    const effects = computeUpgradeTreeEffects({ upgrades: { knowledge: 999, trade: 999 } });
    expect(effects.armyDamageBonus).toBe(0);
    expect(effects.defensePercent).toBe(0);
  });
});

describe('🛡️ تأثير شجرة الترقيات يصل فعلياً لحسابات القتال السيرفرية', () => {
  const basePlayer = (overrides = {}) => ({
    level: 10, unitLevel: 5, trainingLevel: 3, prestigeLevel: 1,
    army_power: 8000, armyYardLevel: 4, hp: 120, maxHp: 120,
    equippedWeapon: '', weapons: [], buildings: {}, research: {},
    upgrades: {},
    ...overrides,
  });

  it('computePlayerStats.totalDamage يزيد فعلياً مع مستوى army', () => {
    const noUpgrade = computePlayerStats(basePlayer());
    const withUpgrade = computePlayerStats(basePlayer({ upgrades: { army: 5 } }));
    expect(withUpgrade.totalDamage).toBe(noUpgrade.totalDamage + ARMY_LEVEL_EFFECTS.reduce((a, b) => a + b, 0));
  });

  it('computePlayerStats.defenseBuff يزيد فعلياً مع مستوى defense', () => {
    const noUpgrade = computePlayerStats(basePlayer());
    const withUpgrade = computePlayerStats(basePlayer({ upgrades: { defense: 5 } }));
    expect(withUpgrade.defenseBuff).toBeGreaterThan(noUpgrade.defenseBuff);
  });

  it('مدافع بمستوى دفاع أقصى من شجرة الترقيات يخسر معارك PvP أقل من نفس الخصم بلا ترقية', () => {
    const attacker = basePlayer({ level: 50, army_power: 50000 });
    const defenderNoUpgrade = basePlayer();
    const defenderMaxDefense = basePlayer({ upgrades: { defense: 5 } });

    let winsAgainstNoUpgrade = 0;
    let winsAgainstMaxDefense = 0;
    for (let i = 0; i < 30; i++) {
      if (simulatePvPFull(attacker, defenderNoUpgrade).attackerWon) winsAgainstNoUpgrade++;
      if (simulatePvPFull(attacker, defenderMaxDefense).attackerWon) winsAgainstMaxDefense++;
    }
    expect(winsAgainstMaxDefense).toBeLessThanOrEqual(winsAgainstNoUpgrade);
  });

  it('ادّعاء مستوى army خيالي (99999) في الحفظ لا يمنح أكثر من الحد الأقصى الحقيقي', () => {
    const legit = computePlayerStats(basePlayer({ upgrades: { army: 5 } }));
    const cheated = computePlayerStats(basePlayer({ upgrades: { army: 99999 } }));
    expect(cheated.totalDamage).toBe(legit.totalDamage);
  });
});
