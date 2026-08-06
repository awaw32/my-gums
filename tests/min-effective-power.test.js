import { describe, it, expect } from 'vitest';
const {
  computeEffectivePower, applyDefeatPenalty, INITIAL_ARMY_POWER, MIN_EFFECTIVE_POWER,
} = require('../server/logic/formulas.js');

// 🛡️ قبل هذا الإصلاح: الحد الأدنى 500 للقوة القتالية الفعلية كان رقماً سحرياً
// مستقلاً تماماً عن INITIAL_ARMY_POWER (5000) — لو غُيِّر الأخير مستقبلاً
// (تعديل توازن)، لن يتحرك الحد الأدنى تلقائياً معه ويصبح غير متناسب.
describe('⚔️ الحد الأدنى للقوة القتالية الفعلية (server/logic/formulas.js)', () => {
  it('MIN_EFFECTIVE_POWER يساوي 10% من INITIAL_ARMY_POWER بالضبط', () => {
    expect(MIN_EFFECTIVE_POWER).toBe(Math.floor(INITIAL_ARMY_POWER * 0.1));
    expect(MIN_EFFECTIVE_POWER).toBe(500); // القيمة الحالية — يوثّق السلوك المعروف
  });

  it('computeEffectivePower لا يقل أبداً عن MIN_EFFECTIVE_POWER حتى مع hp منخفض جداً', () => {
    const result = computeEffectivePower(10000, 1, 1000);
    expect(result).toBe(MIN_EFFECTIVE_POWER);
  });

  it('applyDefeatPenalty لا يقل أبداً عن MIN_EFFECTIVE_POWER حتى مع قوة ضئيلة', () => {
    const result = applyDefeatPenalty(10);
    expect(result).toBe(MIN_EFFECTIVE_POWER);
  });

  it('computeEffectivePower يحسب النسبة الصحيحة فوق الحد الأدنى', () => {
    const result = computeEffectivePower(10000, 500, 1000); // 50% hp
    expect(result).toBe(5000);
  });
});
