import { describe, it, expect } from 'vitest';
import { getXpForLevel } from '../js/economy.js';

// 🛡️ قبل هذا الإصلاح: getXpForLevel استخدمت 100 * 1.15^(level-1) لكل
// المستويات بلا استثناء. هذا يجعل الخبرة التراكمية المطلوبة للوصول للمستوى
// 110 (الشرط الوحيد لتفعيل Prestige) تتجاوز 2.75 مليار خبرة — أكثر من 500
// سنة حتى بأقصى سقف خبرة يومي ممكن من كل أوضاع اللعب مجتمعة (15,000/يوم
// سيرفرياً عبر horde/cave/extraction). نظام Prestige بأكمله وفصل القصة
// الأخير كانا بذلك غير قابلين للتحقيق شرعياً بأي شكل عملي.
//
// الإصلاح: إبقاء نفس المنحنى تماماً حتى المستوى 30 (بلا تغيير على بداية
// اللعبة)، ثم نمو أهدأ بكثير (1.025 بدل 1.15) بعدها — يجعل المستوى 110
// قابلاً للتحقيق في ~3 أشهر من اللعب اليومي الملتزم بأقصى سقف خبرة، بدل
// مستحيل رياضياً.

const DAILY_XP_CAP = 15000; // horde(6000) + cave(4000) + extraction(5000) — server/logic/pveModeRewards.js
const MAX_LEVEL = 110;

function cumulativeXpTo(level) {
  let total = 0;
  for (let l = 1; l < level; l++) total += getXpForLevel(l);
  return total;
}

describe('🛡️ منحنى الخبرة قابل للتحقيق فعلياً حتى المستوى الأقصى (js/economy.js)', () => {
  it('لا يغيّر أي شيء في منحنى المستويات 1-30 (بداية اللعبة بلا تغيير)', () => {
    for (const level of [1, 5, 10, 15, 20, 25, 30]) {
      expect(getXpForLevel(level)).toBe(Math.floor(100 * Math.pow(1.15, level - 1)));
    }
  });

  it('ينمو بمعدل أهدأ بكثير بعد المستوى 30 مقارنة بالمنحنى القديم', () => {
    const oldFormula = (level) => Math.floor(100 * Math.pow(1.15, level - 1));
    expect(getXpForLevel(75)).toBeLessThan(oldFormula(75));
    expect(getXpForLevel(100)).toBeLessThan(oldFormula(100));
    expect(getXpForLevel(109)).toBeLessThan(oldFormula(109));
  });

  it('يبقى المنحنى تصاعدياً دائماً (كل مستوى يتطلب خبرة أكبر من أو تساوي السابق)', () => {
    let prev = 0;
    for (let level = 1; level <= MAX_LEVEL; level++) {
      const cost = getXpForLevel(level);
      expect(cost).toBeGreaterThanOrEqual(prev);
      prev = cost;
    }
  });

  it('الوصول للمستوى الأقصى (110) قابل للتحقيق خلال مدة معقولة (أقل من سنة) بأقصى سقف خبرة يومي', () => {
    const totalXpNeeded = cumulativeXpTo(MAX_LEVEL);
    const daysNeeded = totalXpNeeded / DAILY_XP_CAP;
    expect(daysNeeded).toBeLessThan(365);
  });

  it('الوصول للمستوى 75 (شرط الفصل 5) قابل للتحقيق خلال أشهر معدودة', () => {
    const totalXpNeeded = cumulativeXpTo(75);
    const daysNeeded = totalXpNeeded / DAILY_XP_CAP;
    expect(daysNeeded).toBeLessThan(90);
  });

  it('لا يعيد قيمة صفرية أو سالبة لأي مستوى ضمن النطاق المسموح', () => {
    for (let level = 1; level <= MAX_LEVEL; level++) {
      expect(getXpForLevel(level)).toBeGreaterThan(0);
    }
  });
});
