import { describe, it, expect } from 'vitest';
import { KNOWLEDGE_BUFFS as CLIENT_BUFFS } from '../js/economy.js';
const { KNOWLEDGE_ECONOMIC_BUFFS, KNOWLEDGE_MILITARY_BUFFS } = require('../server/logic/formulas.js');

// 🛡️ مصفوفات بونص المعرفة (resourceSpeed/moveSpeedPercent/defensePercent)
// كانت مكرَّرة بنسختين منفصلتين تماماً بين js/economy.js وserver/logic/
// formulas.js بلا أي رابط بينهما — متطابقة حالياً لكن عرضة لانحراف صامت
// مستقبلي (نفس النمط الذي سبّب فرق 567% سابقاً في تكاليف ترقية الأسلحة).
// هذا الاختبار يفشل فوراً إن عُدِّلت إحدى النسختين دون الأخرى.
describe('🧠 تطابق مصفوفات بونص المعرفة بين الخادم والعميل', () => {
  it('resourceSpeed (اقتصادي) متطابق تماماً', () => {
    expect(KNOWLEDGE_ECONOMIC_BUFFS.resourceSpeed).toEqual(CLIENT_BUFFS.resourceSpeed);
  });

  it('moveSpeedPercent (عسكري) متطابق تماماً', () => {
    expect(KNOWLEDGE_MILITARY_BUFFS.moveSpeedPercent).toEqual(CLIENT_BUFFS.moveSpeedPercent);
  });

  it('defensePercent (عسكري) متطابق تماماً', () => {
    expect(KNOWLEDGE_MILITARY_BUFFS.defensePercent).toEqual(CLIENT_BUFFS.defensePercent);
  });
});
