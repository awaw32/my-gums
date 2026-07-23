"use strict";

/**
 * server/logic/season-pass.js
 * ============================================================================
 * 🏛️ رحلة الشيخ — Season Pass (فتح المسار المميز فقط، لا بيع قوة)
 * الموسم = 30 يوماً (نفس فكرة weekKey الحتمية في events.js لكن بمقسوم 30 يوماً)
 * ويتكرر تلقائياً. فتح المسار المميز يكلف 100 جوهرة **لمرة واحدة فقط لكل
 * موسم** — يُخصم ويُتحقَّق منه على الخادم حصراً (لا economy.spend على العميل
 * مباشرة). المسار المميز نفسه (صندوق إضافي + حكمة نادرة + مضاعف زخرفي للقب
 * الوفي) يبقى منطقاً عميلياً بحتاً في daily-login.js لأنه لا يمس أي مورد
 * حسّاس — فقط "هل هذا الموسم مفتوح أم لا" هو ما يحتاج تحققاً سيرفرياً.
 * ============================================================================
 */

const SEASON_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 يوماً
const PREMIUM_UNLOCK_COST_GEMS = 100;

function getSeasonKey(fromMs = Date.now()) {
  return Math.floor(fromMs / SEASON_DURATION_MS);
}

function createSeasonPass(deps) {
  const { memStore, getDefaultPlayer, markDirty } = deps;

  /** فتح المسار المميز لموسم اللاعب الحالي — يتحقق من الجواهر ويخصمها سيرفرياً */
  function unlockPremium(username) {
    const seasonKey = getSeasonKey();
    const pData = memStore.get(username) || getDefaultPlayer(username);
    const seasonPass = pData.seasonPass || { seasonKey: 0, premiumUnlocked: false };

    // موسم جديد — إعادة تعيين حالة الفتح تلقائياً
    if (seasonPass.seasonKey !== seasonKey) {
      seasonPass.seasonKey = seasonKey;
      seasonPass.premiumUnlocked = false;
    }
    if (seasonPass.premiumUnlocked) return { ok: false, reason: "already_unlocked" };

    if ((pData.gems || 0) < PREMIUM_UNLOCK_COST_GEMS) return { ok: false, reason: "insufficient_gems" };

    pData.gems -= PREMIUM_UNLOCK_COST_GEMS;
    seasonPass.premiumUnlocked = true;
    pData.seasonPass = seasonPass;
    memStore.set(username, pData);
    markDirty(username);

    return { ok: true, seasonKey, gemsRemaining: pData.gems };
  }

  /** حالة الموسم الحالية للاعب — تُستدعى عند الانضمام لمزامنة العميل */
  function getSeasonState(username) {
    const seasonKey = getSeasonKey();
    const pData = memStore.get(username) || getDefaultPlayer(username);
    const seasonPass = pData.seasonPass || { seasonKey: 0, premiumUnlocked: false };
    const premiumUnlocked = seasonPass.seasonKey === seasonKey && !!seasonPass.premiumUnlocked;
    return { seasonKey, premiumUnlocked };
  }

  return { unlockPremium, getSeasonState, getSeasonKey };
}

module.exports = { createSeasonPass, SEASON_DURATION_MS, PREMIUM_UNLOCK_COST_GEMS, getSeasonKey };
