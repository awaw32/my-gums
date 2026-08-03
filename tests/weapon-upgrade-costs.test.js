import { describe, it, expect } from 'vitest';
import { UPGRADE_COSTS as SERVER_UPGRADE_COSTS, MAX_LEVEL } from '../server/logic/weaponUpgrade.js';
import { UPGRADE_COSTS as CLIENT_UPGRADE_COSTS, WEAPON_DATA } from '../js/army.js';
// 🛡️ WEAPON_DEFS يُستورَد عبر require (وليس import ESM مباشر) عمداً — استيراده
// مباشرة هنا بجانب weaponUpgrade.js (الذي يستورده داخلياً عبر require أيضاً)
// كان يُسجِّل نموذج mongoose "Player" مرتين عبر مسارين مختلفين للوحدات
// (OverwriteModelError)، لأن databaseHelper.js نفسه لا حماية فيه من الاستيراد
// المزدوج. استخدام require هنا بدل import يبقيه على نفس مسار CJS المُخزَّن
// مسبقاً فيتجنّب إعادة تنفيذ الملف بالكامل.
const { WEAPON_DEFS } = require('../server/db/databaseHelper.js');

// 🛡️ الجدول الذي يخصم الموارد فعلياً عند ترقية سلاح (weaponUpgrade.js) كان قد
// انحرف عن نسخة العميل (js/army.js) بنسبة وصلت لـ567% على الذهب — الخادم كان
// يخصم أكثر بكثير مما يعرضه العميل ويتحقق منه قبل تفعيل زر الترقية، فيرفض
// الخادم صامتاً ترقيات كان العميل قد أذن بها. هذا الاختبار يقارن الجدولين
// الحقيقيين فعلياً بدل الاعتماد على تطابق مصادفة لا يكتشف الانحراف المستقبلي.
describe('🗡️ تطابق تكاليف ترقية السلاح بين الخادم والعميل', () => {
  it('UPGRADE_COSTS للخادم والعميل متطابقة تماماً في كل مستوى نجمي', () => {
    expect(SERVER_UPGRADE_COSTS.length).toBe(CLIENT_UPGRADE_COSTS.length);
    expect(SERVER_UPGRADE_COSTS.length).toBe(MAX_LEVEL);
    for (let i = 0; i < SERVER_UPGRADE_COSTS.length; i++) {
      const server = SERVER_UPGRADE_COSTS[i];
      const client = CLIENT_UPGRADE_COSTS[i];
      expect(server.cash, `المستوى ${i + 1}⭐: cash`).toBe(client.cash);
      expect(server.gems, `المستوى ${i + 1}⭐: gems`).toBe(client.gems);
      expect(server.artifact, `المستوى ${i + 1}⭐: artifact`).toBe(client.artifact);
      expect(server.desertGem, `المستوى ${i + 1}⭐: desertGem`).toBe(client.desertGem);
    }
  });

  it('WEAPON_DEFS (الخادم) وWEAPON_DATA (العميل) متطابقان في سعر الشراء ومستوى الفتح', () => {
    expect(WEAPON_DEFS.length).toBe(WEAPON_DATA.length);
    for (const serverDef of WEAPON_DEFS) {
      const clientDef = WEAPON_DATA.find(w => w.id === serverDef.id);
      expect(clientDef, `${serverDef.id} موجود في العميل`).toBeTruthy();
      expect(clientDef.cashPrice, `${serverDef.id}: cashPrice`).toBe(serverDef.cashPrice);
      expect(clientDef.requireLevel, `${serverDef.id}: requireLevel`).toBe(serverDef.requireLevel);
    }
  });
});
