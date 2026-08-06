"use strict";

/**
 * server/db/upgradeTree.js
 * ============================================================================
 * 🛡️ تأثيرات شجرة الترقيات (army/defense/knowledge/trade) — سيرفر-موثوقة
 * قبل هذا الملف كانت كل تأثيرات شجرة الترقيات (js/upgrade-tree.js) تُحسب
 * وتُستهلك حصراً على العميل:
 *   - army: js/combat-engine.js → totalDamage += upgradeTree.getEffect("army")
 *   - defense: js/world.js → defBonus += getEffect("defense")
 *   - knowledge/trade: js/main.js → economy.knowledgeGoldBonus/tradeIncomeBonus
 *     (مضروبة في economy.addRaw محلياً فقط عند كل مكسب ذهب/مال)
 * بلا أي استهلاك سيرفري — حقل الحفظ upgrades كان z.record(z.any()) بلا أي
 * تحقق بنيوي، فيستطيع أي عميل خبيث إرسال upgrades بمستوى مزيّف ليحصل على
 * ضرر/دفاع إضافي في PvP، أو مضاعف ذهب مرتفع بلا حد في مكافآت قتل الوحوش.
 * الجداول أدناه مطابقة حرفياً لـ UPGRADE_PATHS في js/upgrade-tree.js.
 * ============================================================================
 */

// effect لكل مستوى (وليس تراكمياً) — نفس القيم الحرفية في js/upgrade-tree.js
const ARMY_LEVEL_EFFECTS = [10, 25, 50, 100, 200];
const DEFENSE_LEVEL_EFFECTS = [5, 12, 25, 50, 100];
const KNOWLEDGE_LEVEL_EFFECTS = [15, 30, 50, 80, 120]; // % إنتاج ذهب — تراكمي
const TRADE_LEVEL_EFFECTS = [20, 40, 70, 110, 160]; // % دخل قوافل — تراكمي

function sumEffects(levelEffects, level) {
  const lvl = Math.max(0, Math.min(Math.floor(Number(level) || 0), levelEffects.length));
  let total = 0;
  for (let i = 0; i < lvl; i++) total += levelEffects[i];
  return total;
}

/** يعيد كل تأثيرات شجرة الترقيات من playerData.upgrades الموثوق — كل مستوى
 *  يُحصَر ضمن [0, الحد الأقصى الحقيقي] بغض النظر عمّا يدّعيه الحفظ.
 *  goldMult/tradeMult معاملا ضرب جاهزان (1 + النسبة/100) للاستخدام المباشر. */
function computeUpgradeTreeEffects(playerData) {
  const upgrades = playerData.upgrades && typeof playerData.upgrades === "object" ? playerData.upgrades : {};
  const knowledgePercent = sumEffects(KNOWLEDGE_LEVEL_EFFECTS, upgrades.knowledge);
  const tradePercent = sumEffects(TRADE_LEVEL_EFFECTS, upgrades.trade);
  return {
    armyDamageBonus: sumEffects(ARMY_LEVEL_EFFECTS, upgrades.army),
    defensePercent: sumEffects(DEFENSE_LEVEL_EFFECTS, upgrades.defense),
    knowledgeGoldMult: 1 + knowledgePercent / 100,
    tradeIncomeMult: 1 + tradePercent / 100,
  };
}

module.exports = {
  computeUpgradeTreeEffects,
  ARMY_LEVEL_EFFECTS,
  DEFENSE_LEVEL_EFFECTS,
  KNOWLEDGE_LEVEL_EFFECTS,
  TRADE_LEVEL_EFFECTS,
};
