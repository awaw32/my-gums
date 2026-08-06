"use strict";

/**
 * server/logic/achievementRewards.js
 * ============================================================================
 * 🛡️ مكافآت الإنجازات (59 إنجازاً) — سيرفر-موثوقة جزئياً
 * كانت مكافأة أي إنجاز (js/achievements.js: claim()) تُمنح مباشرة عبر
 * economy.addRaw على العميل بمجرد أن يدّعي العميل completed=true محلياً —
 * بلا أي تحقق سيرفري أن الشرط (kills/builds/pvp_wins/story_scenes/...) تحقق
 * فعلاً. إعادة بناء تتبع كل شرط من الأساس على الخادم (يتطلب أن يحسم الخادم
 * كل قتلة/بناء/مشهد قصصي بشكل مستقل) عمل ضخم خارج نطاق هذا الإصلاح الفوري.
 *
 * الحل العملي المتناسب: كل إنجاز له مكافأة ثابتة معروفة سلفاً (الجدول أدناه
 * مطابق حرفياً لجدول js/achievements.js) ولا يمكن استلامه أكثر من مرة واحدة
 * لكل لاعب (claimedAchievements يُخزَّن في memStore) — يمنع إعادة استلام
 * نفس الإنجاز بلا حدود، وهو الاستغلال الأخطر عملياً. بالإضافة لسقف مجموع
 * كلي مطابق تماماً لأقصى ما يمكن لأي لاعب كسبه فعلياً لو أنجز كل الإنجازات
 * الحقيقية (59 إنجازاً) — أي طلب يتجاوزه لعدد استلامات معقول يُرفض تلقائياً،
 * وهذا يكتشف محاولة استلام إنجازات لم تُصمَّم أصلاً (id مزيَّف) أو تكراراً
 * غير طبيعي بمعدل يتجاوز ما هو ممكن فعلياً.
 * ============================================================================
 */

// 🛡️ مطابق حرفياً لمصفوفة ACHIEVEMENTS في js/achievements.js — التطابق محمي
// باختبار حقيقي في tests/achievement-rewards.test.js
const ACHIEVEMENT_REWARDS = {
  first_kill: { gold: 50 }, kill_10: { gold: 100, gems: 5 }, kill_50: { gold: 300, gems: 15 },
  kill_100: { gold: 600, gems: 30 }, kill_500: { gold: 2000, gems: 100 }, kill_1000: { gold: 5000, gems: 250 },
  build_1: { cash: 200 }, build_10: { cash: 1000, gold: 200 }, build_50: { cash: 5000, gold: 800 },
  upgrade_10: { gold: 150 }, upgrade_50: { gold: 500, gems: 25 }, upgrade_200: { gold: 2000, gems: 100 },
  weapon_1: { gold: 100 }, weapon_3: { gold: 400, gems: 20 }, weapon_5: { gold: 1500, gems: 75 },
  army_10: { gold: 200 }, army_25: { gold: 600, gems: 30 }, army_50: { gold: 2000, gems: 100 }, army_100: { gold: 5000, gems: 250 },
  pvp_1: { gold: 100, gems: 5 }, pvp_10: { gold: 500, gems: 25 }, pvp_50: { gold: 2000, gems: 100 },
  coins_1k: { gold: 50 }, coins_100k: { gold: 200, gems: 10 }, coins_1m: { gold: 1000, gems: 50 }, coins_1b: { gold: 5000, gems: 250 },
  gold_1k: { gems: 10 }, gold_100k: { gems: 50 },
  oasis_2: { gold: 200 }, oasis_4: { gold: 600, gems: 30 }, oasis_5: { gold: 2000, gems: 100 },
  alliance_1: { gold: 100 }, alliance_4: { gold: 1000, gems: 50 },
  dmg_upgrade: { gold: 300, gems: 15 }, def_upgrade: { gold: 300, gems: 15 },
  cap_upgrade: { gold: 300, gems: 15 }, spd_upgrade: { gold: 300, gems: 15 },
  prestige_1: { gems: 200 }, prestige_3: { gems: 500 },
  level_10: { gold: 200, gems: 10 }, level_25: { gold: 500, gems: 25 }, level_50: { gold: 1500, gems: 75 },
  level_75: { gold: 3000, gems: 150 }, level_110: { gold: 10000, gems: 500 },
  login_3: { gold: 100 }, login_7: { gold: 500, gems: 25 }, login_30: { gold: 2000, gems: 100 },
  power_1k: { gold: 100 }, power_10k: { gold: 300, gems: 15 }, power_100k: { gold: 1000, gems: 50 }, power_1m: { gold: 5000, gems: 250 },
  craft_1: { gold: 100 }, craft_10: { gold: 300, gems: 15 },
  chat_1: { gold: 50 },
  story_3: { gold: 100, gems: 5 }, story_9: { gold: 500, gems: 25 }, story_15: { gold: 1000, gems: 50 },
  story_20: { gold: 2000, gems: 100 }, story_25: { gold: 5000, gems: 250 },
};

// 🛡️ سقف كلي (مدى-الحياة) مطابق تماماً لمجموع كل المكافآت الحقيقية — لا لاعب
// حقيقي يمكن أن يتجاوزه حتى لو أنجز كل الإنجازات الـ59 فعلاً
const LIFETIME_CAPS = { gold: 68700, gems: 4085, cash: 6200 };

function createAchievementRewards(deps) {
  const { memStore, getDefaultPlayer, markDirty } = deps;

  function getClaimedSet(pData) {
    if (!Array.isArray(pData.claimedAchievements)) pData.claimedAchievements = [];
    return pData.claimedAchievements;
  }

  function getLifetimeTotals(pData) {
    if (!pData.achievementRewardTotals || typeof pData.achievementRewardTotals !== "object") {
      pData.achievementRewardTotals = { gold: 0, gems: 0, cash: 0 };
    }
    return pData.achievementRewardTotals;
  }

  /** استلام مكافأة إنجاز — يرفض إعادة استلام نفس id، ويرفض تجاوز السقف الكلي
   *  المطابق لأقصى ما هو ممكن فعلياً لو أُنجزت كل الإنجازات الحقيقية */
  function claimAchievement(username, achievementId) {
    const reward = ACHIEVEMENT_REWARDS[achievementId];
    if (!reward) return { ok: false, reason: "unknown_achievement" };

    const pData = memStore.get(username) || getDefaultPlayer(username);
    const claimed = getClaimedSet(pData);
    if (claimed.includes(achievementId)) {
      return { ok: false, reason: "already_claimed" };
    }

    const totals = getLifetimeTotals(pData);
    for (const [res, amt] of Object.entries(reward)) {
      if ((totals[res] || 0) + amt > (LIFETIME_CAPS[res] ?? Infinity)) {
        return { ok: false, reason: "lifetime_cap_reached" };
      }
    }

    for (const [res, amt] of Object.entries(reward)) {
      pData[res] = (pData[res] || 0) + amt;
      totals[res] = (totals[res] || 0) + amt;
    }
    claimed.push(achievementId);
    pData.claimedAchievements = claimed;
    pData.achievementRewardTotals = totals;
    memStore.set(username, pData);
    markDirty(username);

    return { ok: true, achievementId, granted: reward };
  }

  return { claimAchievement };
}

module.exports = { createAchievementRewards, ACHIEVEMENT_REWARDS, LIFETIME_CAPS };
