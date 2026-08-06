import { describe, it, expect } from 'vitest';
import { validateOasesChange, OASIS_CAPTURE_DATA } from '../server/validation/player.js';

// 🛡️ قبل هذا الإصلاح: js/oasis-manager.js لا مسار WS له — capture() تُحسب
// بالكامل محلياً (تحقق قوة + خصم ذهب) ثم تُحفَظ عبر /api/players مباشرة
// (captured:true). عميل خبيث يستطيع إرسال captured:true لكل الواحات المعادية
// بلا دفع الذهب فعلياً ولا امتلاك القوة الحقيقية — دخل إضافي حتى ~500/ثانية
// بلا أي تكلفة، لا يُكتشف بسقف معدل الموارد العام لأنه يبدو كدخل طبيعي مرتفع.

function existingPlayer(overrides = {}) {
  return {
    gold: 1000, army_power: 100,
    oases: [
      { id: 1, captured: true },
      { id: 2, captured: false },
      { id: 3, captured: false },
      { id: 4, captured: false },
      { id: 5, captured: false },
    ],
    ...overrides,
  };
}

describe('🛡️ حماية السيطرة على الواحات من التزييف (server/validation/player.js)', () => {
  it('يقبل حفظة لا تغيّر حالة الواحات إطلاقاً', () => {
    const existing = existingPlayer();
    const result = validateOasesChange(existing, { cash: 100 });
    expect(result.ok).toBe(true);
  });

  it('يرفض ادّعاء السيطرة على واحة معادية بلا قوة كافية', () => {
    const existing = existingPlayer({ army_power: 50 }); // أقل من capturePower=200 للواحة 2
    const result = validateOasesChange(existing, {
      oases: [{ id: 2, captured: true }],
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/insufficient power/);
  });

  it('يرفض ادّعاء السيطرة على واحة معادية بقوة كافية لكن بلا دفع الذهب', () => {
    const existing = existingPlayer({ army_power: 5000, gold: 1000 });
    const result = validateOasesChange(existing, {
      oases: [{ id: 2, captured: true }],
      gold: 1000, // لم يتغيّر — لم يُدفع شيء
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/insufficient gold/);
  });

  it('يقبل سيطرة شرعية على واحة معادية (قوة كافية + خصم الذهب الصحيح)', () => {
    const existing = existingPlayer({ army_power: 5000, gold: 1000 });
    const result = validateOasesChange(existing, {
      oases: [{ id: 2, captured: true }],
      gold: 1000 - OASIS_CAPTURE_DATA[2].cost,
    });
    expect(result.ok).toBe(true);
  });

  it('يقبل السيطرة على واحة "free" بلا أي شرط قوة/ذهب', () => {
    const existing = existingPlayer({ oases: [{ id: 1, captured: false }] });
    const result = validateOasesChange(existing, { oases: [{ id: 1, captured: true }] });
    expect(result.ok).toBe(true);
  });

  it('لا يعيد رفض واحة كانت مُسيطَراً عليها فعلاً من قبل (لا تغيير حقيقي)', () => {
    const existing = existingPlayer(); // oasis 1 already captured
    const result = validateOasesChange(existing, {
      oases: [{ id: 1, captured: true }, { id: 2, captured: false }],
    });
    expect(result.ok).toBe(true);
  });

  it('يرفض محاولة السيطرة على عدة واحات معادية دفعة واحدة بدفع جزئي فقط', () => {
    const existing = existingPlayer({ army_power: 10000, gold: 1000 });
    const totalCost = OASIS_CAPTURE_DATA[2].cost + OASIS_CAPTURE_DATA[3].cost;
    const result = validateOasesChange(existing, {
      oases: [{ id: 2, captured: true }, { id: 3, captured: true }],
      gold: 1000 - (totalCost - 50), // دفع أقل من المطلوب بـ50
    });
    expect(result.ok).toBe(false);
  });

  it('يقبل السيطرة على عدة واحات معادية دفعة واحدة بدفع كامل صحيح', () => {
    const existing = existingPlayer({ army_power: 10000, gold: 1000 });
    const totalCost = OASIS_CAPTURE_DATA[2].cost + OASIS_CAPTURE_DATA[3].cost;
    const result = validateOasesChange(existing, {
      oases: [{ id: 2, captured: true }, { id: 3, captured: true }],
      gold: 1000 - totalCost,
    });
    expect(result.ok).toBe(true);
  });

  it('يتجاهل بصمت معرّف واحة غير معروف بدل رفض الحفظة كاملة', () => {
    const existing = existingPlayer();
    const result = validateOasesChange(existing, { oases: [{ id: 999, captured: true }] });
    expect(result.ok).toBe(true);
  });

  it('يرفض شكل oases غير صالح (ليس مصفوفة)', () => {
    const existing = existingPlayer();
    const result = validateOasesChange(existing, { oases: "not-an-array" });
    expect(result.ok).toBe(false);
  });
});
