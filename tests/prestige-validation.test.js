import { describe, it, expect } from 'vitest';
import { validateProgressionChange, validateWeaponsChange, PLAYER_MAX_LEVEL } from '../server/validation/player.js';

// 🛡️ قبل هذا الإصلاح: js/prestige.js لا مسار WS له إطلاقاً — يُحسب بالكامل
// محلياً (level→1، dmgMult/xpMult/goldMult، موارد ابتدائية) ثم يُحفَظ مباشرة
// عبر /api/players بلا أي تحقق أن اللاعب بلغ فعلاً المستوى الأقصى (110).
// prestigeLevel يُستهلَك فعلياً في computePlayerStats (totalDamage +=
// prestigeLevel*3، maxHp += prestigeLevel*5) — أي عميل خبيث يرسل prestigeLevel
// مزيَّفاً يحصل على ضرر/صحة إضافيين حقيقيين في أي معركة PvP يحسمها الخادم.

describe('🛡️ حماية Prestige من التزييف (server/validation/player.js)', () => {
  function existingPlayer(overrides = {}) {
    return { level: 1, prestigeLevel: 0, weapons: [{ id: 'w1', level: 3, starLevel: 2, gemLevel: 1, upgradeLevel: 20 }], ...overrides };
  }

  it('يرفض prestigeLevel مزيَّفاً للاعب لم يبلغ المستوى الأقصى إطلاقاً', () => {
    const existing = existingPlayer({ level: 5 }); // بعيد جداً عن 110
    const result = validateProgressionChange(existing, { prestigeLevel: 1, level: 1 });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/prestigeLevel/);
  });

  it('يرفض قفزة أكثر من مستوى واحد في نفس الحفظة (حتى لو بلغ المستوى الأقصى)', () => {
    const existing = existingPlayer({ level: PLAYER_MAX_LEVEL, prestigeLevel: 0 });
    const result = validateProgressionChange(existing, { prestigeLevel: 3, level: 1 });
    expect(result.ok).toBe(false);
  });

  it('يرفض prestigeLevel صحيحاً إن لم يُصاحبه إعادة تعيين level إلى 1', () => {
    const existing = existingPlayer({ level: PLAYER_MAX_LEVEL, prestigeLevel: 0 });
    const result = validateProgressionChange(existing, { prestigeLevel: 1, level: 50 }); // لم يُصفَّر level
    expect(result.ok).toBe(false);
  });

  it('يقبل انتقال Prestige شرعي حقيقي (بلغ المستوى الأقصى فعلاً + خطوة واحدة + تصفير level)', () => {
    const existing = existingPlayer({ level: PLAYER_MAX_LEVEL, prestigeLevel: 0 });
    const result = validateProgressionChange(existing, { prestigeLevel: 1, level: 1 });
    expect(result.ok).toBe(true);
  });

  it('يقبل انتقال Prestige شرعي من مستوى برستيج أعلى من صفر (اللاعب برستج من قبل)', () => {
    const existing = existingPlayer({ level: PLAYER_MAX_LEVEL, prestigeLevel: 2 });
    const result = validateProgressionChange(existing, { prestigeLevel: 3, level: 1 });
    expect(result.ok).toBe(true);
  });

  it('لا يرفض حفظة عادية لا تغيّر prestigeLevel إطلاقاً', () => {
    const existing = existingPlayer({ level: 50, prestigeLevel: 1 });
    const result = validateProgressionChange(existing, { cash: 500 });
    expect(result.ok).toBe(true);
  });

  describe('تفاعل Prestige مع تصفير مستويات الأسلحة (validateWeaponsChange)', () => {
    it('يرفض تصفير مستوى سلاح خارج حفظة Prestige شرعية (نفس الحماية القديمة)', () => {
      const existing = existingPlayer({ level: 50 });
      const result = validateWeaponsChange(existing, {
        weapons: [{ id: 'w1', level: 0, starLevel: 1, gemLevel: 1, upgradeLevel: 0 }],
      });
      expect(result.ok).toBe(false);
      expect(result.reason).toMatch(/weapon_upgrade/);
    });

    it('يسمح بتصفير مستويات الأسلحة ضمن حفظة Prestige شرعية حقيقية', () => {
      const existing = existingPlayer({ level: PLAYER_MAX_LEVEL, prestigeLevel: 0 });
      const result = validateWeaponsChange(existing, {
        prestigeLevel: 1,
        level: 1,
        weapons: [{ id: 'w1', level: 0, starLevel: 1, gemLevel: 1, upgradeLevel: 0 }],
      });
      expect(result.ok).toBe(true);
    });

    it('لا يسمح بتصفير الأسلحة بادّعاء prestigeLevel لكن بلا استيفاء الشرط الحقيقي', () => {
      const existing = existingPlayer({ level: 5 }); // لم يبلغ المستوى الأقصى
      const result = validateWeaponsChange(existing, {
        prestigeLevel: 1,
        level: 1,
        weapons: [{ id: 'w1', level: 0, starLevel: 1, gemLevel: 1, upgradeLevel: 0 }],
      });
      expect(result.ok).toBe(false);
    });
  });
});
