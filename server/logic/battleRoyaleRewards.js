"use strict";

/**
 * server/logic/battleRoyaleRewards.js
 * ============================================================================
 * 🏆 مكافآت المعركة الملكية (Battle Royale) — حد يومي سيرفري-موثوق
 * وضع BR بالكامل (تحديد الفائز، عدّ القتلى، تصغير المنطقة) يعمل حالياً على
 * العميل بلا أي مزامنة سيرفرية حقيقية للمباراة نفسها — إعادة بناء ذلك بالكامل
 * (تتبع أعضاء كل مباراة/أحياء/فائز على الخادم) خارج نطاق هذا الإصلاح. الخطر
 * الفعلي المُصلَح هنا: كانت `economy.addRaw` تُستدعى مباشرة على العميل عند
 * "الفوز"/"الإخلاء" — أي عميل خبيث (console المتصفح) يقدر يستدعي منطق الفوز
 * محلياً ويحصل على جواهر/ذهب حقيقيين فوراً بلا أي قتال ولا حتى رسالة شبكة.
 * الحل: طلب المكافأة أصبح يمر عبر الخادم (br_claim_reward) الذي يفرض حداً
 * أقصى يومياً معقولاً على إجمالي مكاسب BR لكل لاعب — يحدّ الضرر (لا يمنع لاعب
 * خبيث فردي من فرقعة الاقتصاد بالكامل عبر استدعاءات متكررة غير محدودة) دون
 * حاجة لإعادة كتابة نظام المباراة بالكامل.
 * ============================================================================
 */

const DAILY_RESET_MS = 24 * 60 * 60 * 1000;
// أقصى ما يمكن لأي لاعب كسبه من مكافآت BR (فوز + إخلاء) خلال 24 ساعة — يحاكي
// نحو 15 مباراة فوز متتالية بأداء ممتاز (10 قتلات)، سقف سخي لكنه غير لا-نهائي
const MAX_GEMS_PER_DAY = 3000;
const MAX_GOLD_PER_DAY = 6000;
// حد أدنى بين مطالبتين — يمنع إغراق الخادم بمئات الطلبات في الثانية
const MIN_CLAIM_INTERVAL_MS = 5000;

function createBattleRoyaleRewards(deps) {
  const { memStore, getDefaultPlayer, markDirty } = deps;

  function getDailyState(pData) {
    const state = pData.brDailyRewards && typeof pData.brDailyRewards === "object"
      ? pData.brDailyRewards
      : { gemsToday: 0, goldToday: 0, resetAt: 0, lastClaimAt: 0 };
    if (Date.now() >= (state.resetAt || 0)) {
      state.gemsToday = 0;
      state.goldToday = 0;
      state.resetAt = Date.now() + DAILY_RESET_MS;
    }
    return state;
  }

  /** طلب مكافأة فوز/إخلاء BR — gems/gold المطلوبة تُقصّ (clamp) لسقف يومي معقول
   *  ولا تُمنح إطلاقاً إن تجاوز اللاعب السقف اليومي بالفعل */
  function claimReward(username, requestedGems, requestedGold) {
    const pData = memStore.get(username) || getDefaultPlayer(username);
    const state = getDailyState(pData);

    if (Date.now() - (state.lastClaimAt || 0) < MIN_CLAIM_INTERVAL_MS) {
      return { ok: false, reason: "too_frequent" };
    }

    const reqGems = Math.max(0, Math.floor(Number(requestedGems) || 0));
    const reqGold = Math.max(0, Math.floor(Number(requestedGold) || 0));

    const gemsRemaining = Math.max(0, MAX_GEMS_PER_DAY - state.gemsToday);
    const goldRemaining = Math.max(0, MAX_GOLD_PER_DAY - state.goldToday);
    if (gemsRemaining <= 0 && goldRemaining <= 0) {
      return { ok: false, reason: "daily_cap_reached" };
    }

    const grantedGems = Math.min(reqGems, gemsRemaining);
    const grantedGold = Math.min(reqGold, goldRemaining);

    pData.gems = (pData.gems || 0) + grantedGems;
    pData.gold = (pData.gold || 0) + grantedGold;
    state.gemsToday += grantedGems;
    state.goldToday += grantedGold;
    state.lastClaimAt = Date.now();
    pData.brDailyRewards = state;
    memStore.set(username, pData);
    markDirty(username);

    return {
      ok: true,
      grantedGems,
      grantedGold,
      capped: grantedGems < reqGems || grantedGold < reqGold,
    };
  }

  return { claimReward };
}

module.exports = { createBattleRoyaleRewards, MAX_GEMS_PER_DAY, MAX_GOLD_PER_DAY, MIN_CLAIM_INTERVAL_MS };
