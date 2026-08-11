import { describe, it, expect } from 'vitest';
import { validateHeroChange, HERO_MAX_LEVEL } from '../server/validation/player.js';

// 🛡️ قبل هذا الإصلاح: js/hero.js لا مسار WS له إطلاقاً — hero.addXp() تُحسب
// بالكامل محلياً (قتلات/بناء/ترقيات/فصول قصة/انتصارات PvP) ثم تُحفَظ عبر
// /api/players مباشرة بحقل hero: z.record(z.any()) بلا أي تحقق سيرفري.
// hero.level يُستهلَك فعلياً في damage/defense/powerContribution — قوة
// قتالية حقيقية يحسمها الخادم. عميل خبيث يرسل hero:{level:50} يحصل على
// ضرر/دفاع إضافيين فوراً بلا أي خبرة مكتسبة فعلياً.

function existingPlayer(overrides = {}) {
  return { hero: { level: 1 }, ...overrides };
}

describe('🛡️ حماية مستوى البطل من التزييف (server/validation/player.js)', () => {
  it('يقبل حفظة لا تغيّر hero إطلاقاً', () => {
    const existing = existingPlayer();
    const result = validateHeroChange(existing, { cash: 100 });
    expect(result.ok).toBe(true);
  });

  it('يرفض شكل hero غير صالح (ليس كائناً)', () => {
    const existing = existingPlayer();
    const result = validateHeroChange(existing, { hero: 'not-an-object' });
    expect(result.ok).toBe(false);
  });

  it('يرفض hero.level غير عدد صحيح', () => {
    const existing = existingPlayer();
    const result = validateHeroChange(existing, { hero: { level: 5.5 } });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/hero\.level invalid/);
  });

  it('يرفض hero.level أقل من 1', () => {
    const existing = existingPlayer();
    const result = validateHeroChange(existing, { hero: { level: 0 } });
    expect(result.ok).toBe(false);
  });

  it(`يرفض hero.level أعلى من الحد الأقصى (${HERO_MAX_LEVEL})`, () => {
    const existing = existingPlayer();
    const result = validateHeroChange(existing, { hero: { level: HERO_MAX_LEVEL + 1 } });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/exceeds max/);
  });

  it('يرفض قفزة فورية من مستوى 1 إلى الحد الأقصى (الاستغلال الأساسي)', () => {
    const existing = existingPlayer({ hero: { level: 1 } });
    const result = validateHeroChange(existing, { hero: { level: HERO_MAX_LEVEL } });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/jump rejected/);
  });

  it('يقبل تقدماً طبيعياً بخطوة واحدة (مستوى واحد لكل حفظة)', () => {
    const existing = existingPlayer({ hero: { level: 10 } });
    const result = validateHeroChange(existing, { hero: { level: 11 } });
    expect(result.ok).toBe(true);
  });

  it('يقبل قفزة كبيرة شرعية (إكمال فصل قصة بمكافأة heroXp ضخمة دفعة واحدة)', () => {
    const existing = existingPlayer({ hero: { level: 1 } });
    // أقصى قفزة شرعية محسوبة فعلياً: لاعب مستوى بطل 1 يكمل الفصل 6 (5000 heroXp) = 12 مستوى
    const result = validateHeroChange(existing, { hero: { level: 13 } });
    expect(result.ok).toBe(true);
  });

  it('يرفض قفزة تتجاوز الهامش المسموح حتى لو لم تصل للحد الأقصى', () => {
    const existing = existingPlayer({ hero: { level: 1 } });
    const result = validateHeroChange(existing, { hero: { level: 25 } });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/jump rejected/);
  });

  it('لا يعيد رفض حفظة لا تغيّر مستوى البطل (نفس القيمة)', () => {
    const existing = existingPlayer({ hero: { level: 20 } });
    const result = validateHeroChange(existing, { hero: { level: 20 } });
    expect(result.ok).toBe(true);
  });

  it('يعامل لاعباً بلا سجل hero سابق كأنه مستوى 1 (لاعب جديد شرعي)', () => {
    const existing = { cash: 100 }; // لا حقل hero إطلاقاً
    const result = validateHeroChange(existing, { hero: { level: 5 } });
    expect(result.ok).toBe(true);
  });

  it('يتجاهل بصمت حفظة hero بلا حقل level (تحديثات hp/abilities فقط)', () => {
    const existing = existingPlayer({ hero: { level: 15 } });
    const result = validateHeroChange(existing, { hero: { hp: 200, abilities: {} } });
    expect(result.ok).toBe(true);
  });
});
