"use strict";

/**
 * server/logic/dailyLoginManager.js
 * ============================================================================
 * 🏛️ مجلس الشيوخ — مكافآت العودة اليومية (سيرفر-موثوقة بالكامل)
 * كان js/daily-login.js (العميل) يحسب المكافآت (حتى 1000 ذهب/يوم أو 50 جوهرة +
 * 500 ذهب في اليوم 7، بالإضافة لمعالم سلسلة حتى 1500 جوهرة) ويطبّقها مباشرة
 * على economy المحلي، ثم يُحفظ lastClaimDate/streak عبر /api/players بلا أي
 * تحقق كمية — أي تلاعب بحالة العميل (localStorage) يمنح موارد غير محدودة
 * يومياً دون أن يرصده الخادم. هذا الملف ينقل الحقيقة الوحيدة (source of truth)
 * إلى الخادم: lastClaimDate/streak/claimedMilestones تُقرأ وتُكتب حصراً في
 * memStore.dailyLogin، والموارد تُضاف فعلياً هناك — تماماً كما فعل season-pass.js
 * لفتح المسار المميز. الجداول (DAILY_REWARDS/STREAK_MILESTONES) مطابقة حرفياً
 * لما في js/daily-login.js عمداً (نفس الأرقام) — أي تعديل توازن مستقبلي على
 * أي منهما يجب أن يُطبَّق على الآخر أيضاً.
 * ============================================================================
 */

const DAILY_REWARDS = [
  { day: 1, reward: { gold: 100 } },
  { day: 2, reward: { cash: 500 } },
  { day: 3, reward: { gems: 10 } },
  { day: 4, reward: { gold: 250 } },
  { day: 5, reward: { food: 200 } },
  { day: 6, reward: { cash: 1000 } },
  { day: 7, reward: { gems: 50, gold: 500 }, isLegendaryChest: true },
];

const STREAK_MILESTONES = [
  { streak: 7, gems: 100 },
  { streak: 14, gems: 250 },
  { streak: 30, gems: 600 },
  { streak: 60, gems: 1500 },
];

function createDailyLoginManager(deps) {
  const { memStore, getDefaultPlayer, markDirty } = deps;

  function getDefaultState() {
    return { currentDay: 0, lastClaimDate: "", streak: 0, claimedMilestones: [], loyalTitleEarned: false };
  }

  /** يُستدعى عند claim فقط — لا يعدّل أي شيء، فقط يحسب توداي/الفرق بالأيام */
  function computeDayDiff(lastClaimDate) {
    if (!lastClaimDate) return null;
    const last = new Date(lastClaimDate);
    const today = new Date(new Date().toDateString());
    return Math.floor((today - last) / (1000 * 60 * 60 * 24));
  }

  /** استلام مكافأة اليوم — موثوق سيرفرياً بالكامل: التاريخ/السلسلة تُقرآن
   *  وتُكتبان من memStore حصراً، والموارد تُضاف فعلياً هناك مباشرة */
  function claim(username) {
    const pData = memStore.get(username) || getDefaultPlayer(username);
    const state = pData.dailyLogin && typeof pData.dailyLogin === "object"
      ? { ...getDefaultState(), ...pData.dailyLogin }
      : getDefaultState();

    const today = new Date().toDateString();
    if (state.lastClaimDate === today) return { ok: false, reason: "already_claimed" };

    const diffDays = computeDayDiff(state.lastClaimDate);
    let loyalTitleLost = false;
    if (diffDays !== null && diffDays > 1) {
      state.streak = 0;
      state.currentDay = 0;
      if (state.loyalTitleEarned) {
        state.loyalTitleEarned = false;
        loyalTitleLost = true;
      }
    }

    state.lastClaimDate = today;
    state.currentDay = (state.currentDay % 7) + 1;
    state.streak += 1;

    const dayReward = DAILY_REWARDS[state.currentDay - 1];
    const streakBonusPercent = Math.min(100, state.streak * 5);
    const mult = 1 + streakBonusPercent / 100;

    const granted = {};
    for (const [res, amount] of Object.entries(dayReward.reward)) {
      const value = Math.floor(amount * mult);
      pData[res] = (pData[res] || 0) + value;
      granted[res] = (granted[res] || 0) + value;
    }
    if (dayReward.isLegendaryChest) state.loyalTitleEarned = true;

    let milestone = null;
    const nextMilestone = STREAK_MILESTONES.find(
      m => state.streak >= m.streak && !state.claimedMilestones.includes(m.streak)
    );
    if (nextMilestone) {
      state.claimedMilestones = [...state.claimedMilestones, nextMilestone.streak];
      pData.gems = (pData.gems || 0) + nextMilestone.gems;
      granted.gems = (granted.gems || 0) + nextMilestone.gems;
      milestone = { streak: nextMilestone.streak, gems: nextMilestone.gems };
    }

    pData.dailyLogin = state;
    memStore.set(username, pData);
    markDirty(username);

    return {
      ok: true,
      currentDay: state.currentDay,
      streak: state.streak,
      streakBonusPercent,
      granted,
      milestone,
      loyalTitleEarned: state.loyalTitleEarned,
      loyalTitleLost,
    };
  }

  return { claim, DAILY_REWARDS, STREAK_MILESTONES };
}

module.exports = { createDailyLoginManager, DAILY_REWARDS, STREAK_MILESTONES };
