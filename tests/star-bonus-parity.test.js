import { describe, it, expect } from 'vitest';
import { STAR_DAMAGE_BONUS_PER_LEVEL as CLIENT_BONUS } from '../js/combat-engine.js';
const { STAR_DAMAGE_BONUS_PER_LEVEL: SERVER_BONUS } = require('../server/logic/weaponUpgrade.js');

// 🛡️ بونص +30% لكل نجمة كان مكرَّراً كرقم حرفي (0.3) في js/combat-engine.js
// وserver/logic/weaponUpgrade.js بلا أي رابط بينهما — القيمتان متطابقتان
// حالياً لكن بلا حماية، عرضة لانحراف صامت مستقبلي كما حدث فعلاً سابقاً مع
// جدول تكاليف ترقية الأسلحة (وصل الانحراف هناك إلى 567%). هذا الاختبار يفشل
// فوراً إن عُدِّلت إحدى النسختين دون الأخرى.
describe('⭐ تطابق بونص ضرر النجمة بين الخادم والعميل', () => {
  it('STAR_DAMAGE_BONUS_PER_LEVEL متطابق تماماً بين js/combat-engine.js وserver/logic/weaponUpgrade.js', () => {
    expect(SERVER_BONUS).toBe(CLIENT_BONUS);
    expect(CLIENT_BONUS).toBe(0.3);
  });
});
