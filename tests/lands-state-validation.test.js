import { describe, it, expect } from 'vitest';
import { validateLandsStateChange, LANDS_BUILDING_MAX_LEVEL } from '../server/validation/player.js';

// 🛡️ قبل هذا الإصلاح: js/village.js's VillageBuilding.upgrade() لا مسار WS له
// إطلاقاً — تُحسب الترقية بالكامل محلياً (خصم موارد + level++) ثم تُحفَظ مباشرة
// عبر حقل landsState (z.record(z.any())، بلا أي تحقق بنيوي). landsState.b1.level
// يُستخدم لاحقاً كبوابة سيرفر حقيقية في: شراء أسلحة جديدة، ترقية نجوم الأسلحة
// (weaponUpgrade.js)، وسقف ترقية البحث (research.js) — عميل خبيث يرسل
// landsState:{b1:{level:999}} بلا دفع أي شيء يفتح فوراً كل الأسلحة/النجوم/الأبحاث.

function existingPlayer(overrides = {}) {
  return {
    landsState: { b1: { level: 3, state: 'built' } },
    ...overrides,
  };
}

describe('🛡️ حماية landsState (مستويات مباني القرى) من التزييف (server/validation/player.js)', () => {
  it('يقبل حفظة لا تغيّر landsState إطلاقاً', () => {
    const existing = existingPlayer();
    const result = validateLandsStateChange(existing, { cash: 100 });
    expect(result.ok).toBe(true);
  });

  it('يرفض قفزة مستوى ضخمة مزيَّفة (المستوى 999 دفعة واحدة)', () => {
    const existing = existingPlayer();
    const result = validateLandsStateChange(existing, {
      landsState: { b1: { level: 999, state: 'built' } },
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/exceeds max/);
  });

  it('يرفض أي مستوى أعلى من السقف العام حتى لو بدا معقولاً نسبياً', () => {
    const existing = existingPlayer({ landsState: { b1: { level: LANDS_BUILDING_MAX_LEVEL - 1 } } });
    const result = validateLandsStateChange(existing, {
      landsState: { b1: { level: LANDS_BUILDING_MAX_LEVEL + 5 } },
    });
    expect(result.ok).toBe(false);
  });

  it('يقبل ترقية شرعية بمقدار مستوى واحد', () => {
    const existing = existingPlayer();
    const result = validateLandsStateChange(existing, {
      landsState: { b1: { level: 4, state: 'built' } },
    });
    expect(result.ok).toBe(true);
  });

  it('يقبل قفزة صغيرة معقولة (حفظات متتابعة سريعة) حتى +3', () => {
    const existing = existingPlayer();
    const result = validateLandsStateChange(existing, {
      landsState: { b1: { level: 6, state: 'built' } },
    });
    expect(result.ok).toBe(true);
  });

  it('يرفض قفزة أكبر من +3 دفعة واحدة', () => {
    const existing = existingPlayer();
    const result = validateLandsStateChange(existing, {
      landsState: { b1: { level: 7, state: 'built' } },
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/jump rejected/);
  });

  it('يقبل نفس المستوى (لا تغيير حقيقي)', () => {
    const existing = existingPlayer();
    const result = validateLandsStateChange(existing, {
      landsState: { b1: { level: 3, state: 'built' } },
    });
    expect(result.ok).toBe(true);
  });

  it('يرفض مستوى سالباً أو غير صحيح', () => {
    const existing = existingPlayer();
    const result = validateLandsStateChange(existing, {
      landsState: { b1: { level: -5 } },
    });
    expect(result.ok).toBe(false);
  });

  it('يرفض مستوى غير رقمي (سلسلة نصية)', () => {
    const existing = existingPlayer();
    const result = validateLandsStateChange(existing, {
      landsState: { b1: { level: '999' } },
    });
    expect(result.ok).toBe(false);
  });

  it('يتعامل مع مبنى جديد لم يكن موجوداً من قبل كأنه من المستوى 0', () => {
    const existing = existingPlayer({ landsState: {} });
    const result = validateLandsStateChange(existing, {
      landsState: { b2: { level: 1, state: 'built' } },
    });
    expect(result.ok).toBe(true);
  });

  it('يرفض مبنى جديد يبدأ فوق السقف المسموح للقفزة', () => {
    const existing = existingPlayer({ landsState: {} });
    const result = validateLandsStateChange(existing, {
      landsState: { b2: { level: 10, state: 'built' } },
    });
    expect(result.ok).toBe(false);
  });

  it('يرفض شكل landsState غير صالح (مصفوفة بدل كائن)', () => {
    const existing = existingPlayer();
    const result = validateLandsStateChange(existing, { landsState: [1, 2, 3] });
    expect(result.ok).toBe(false);
  });

  it('يرفض شكل landsState غير صالح (نص)', () => {
    const existing = existingPlayer();
    const result = validateLandsStateChange(existing, { landsState: "not-an-object" });
    expect(result.ok).toBe(false);
  });

  it('يتجاهل مبنى بدون حقل level بدل رفض الحفظة كاملة (مثل تحديث state فقط)', () => {
    const existing = existingPlayer();
    const result = validateLandsStateChange(existing, {
      landsState: { b1: { state: 'building' } },
    });
    expect(result.ok).toBe(true);
  });

  it('يتحقق من كل مبنى مستقل في نفس الحفظة (مبنى صالح + مبنى مزيَّف معاً)', () => {
    const existing = existingPlayer({ landsState: { b1: { level: 3 }, b2: { level: 2 } } });
    const result = validateLandsStateChange(existing, {
      landsState: { b1: { level: 4 }, b2: { level: 999 } },
    });
    expect(result.ok).toBe(false);
  });
});
