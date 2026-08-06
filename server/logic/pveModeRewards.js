"use strict";

/**
 * server/logic/pveModeRewards.js
 * ============================================================================
 * 🛡️ حد أقصى يومي سيرفري لمكافآت أوضاع PvE الفردية (Horde/Cave/Extraction) +
 * غارات التحالف الفردية (Alliance Raids)
 * ============================================================================
 * كل هذه الأوضاع محاكاة عميلية بالكامل (موجات الوحوش، توليد الكهف، توقيت
 * الاستخراج) — إعادة بناء كل واحد منها ليصبح موثوقاً بالخادم بالكامل (تتبع كل
 * قتلة/كل صندوق/كل موجة سيرفرياً) عمل ضخم خارج نطاق هذا الإصلاح. الخطر الفعلي
 * المُصلَح هنا: كانت `economy.addRaw` تُستدعى مباشرة على العميل عند انتهاء
 * الجلسة (فوز/هزيمة/خروج) — أي عميل خبيث (console المتصفح) يقدر يستدعي منطق
 * الانتهاء مباشرة (`_endHorde(true)`, `_exitCave()`, إلخ) ويحصل على مكافآت
 * حقيقية فوراً بلا أي لعب فعلي، ويكرر ذلك بلا حدود.
 *
 * الحل: طلب المكافأة يمر عبر الخادم الذي يفرض:
 *  1. حداً أقصى يومياً معقولاً لكل وضع على حدة (لا يمنع الغش الفردي الكامل،
 *     لكن يحد الضرر الأقصى الممكن — لاعب خبيث لن يفرّغ الاقتصاد).
 *  2. فحص معقولية أساسي على المدخلات (wave/depth/kills لا تتجاوز الحد
 *     الفيزيائي الأقصى الممكن للوضع) لرفض القيم المستحيلة فوراً.
 *  3. تبريداً أدنى بين الطلبات (يمنع إغراق الخادم بمئات الطلبات في الثانية).
 * ============================================================================
 */

const DAILY_RESET_MS = 24 * 60 * 60 * 1000;
const MIN_CLAIM_INTERVAL_MS = 3000;

// حدود المعقولية الفيزيائية القصوى لكل وضع — أي قيمة تتجاوزها تعني بيانات
// مستحيلة (خطأ أو غش صريح) فتُرفض الطلبة بالكامل بدل قصّها فقط
const MODE_LIMITS = {
  horde: { maxWave: 20, maxKills: 400 }, // maxMonsters=60، 20 موجة، احتياط معقول
  cave: { maxDepth: 10, maxRareItems: 50 },
  extraction: { maxDeposited: 50000 }, // 500 حمل أقصى × ترقيات معقولة × عدة رحلات بـ6 دقائق
  alliance_raid: { maxRaidLevel: 4 },
};

// أقصى مكسب يومي لكل وضع — سخي لكنه غير لا-نهائي
const DAILY_CAPS = {
  horde: { gold: 8000, xp: 6000 },
  cave: { gold: 6000, xp: 4000 },
  extraction: { gold: 10000, xp: 5000 },
  alliance_raid: { cash: 300000, gold: 30000, gems: 1600, artifacts: 60, desertGem: 3 },
};

const ALLIANCE_RAID_REWARDS = [
  { cash: 5000, gold: 500, gems: 50 },
  { cash: 20000, gold: 2000, gems: 150 },
  { cash: 75000, gold: 7500, gems: 500, artifacts: 10 },
  { cash: 250000, gold: 25000, gems: 1500, artifacts: 50, desertGem: 3 },
];

function createPveModeRewards(deps) {
  const { memStore, getDefaultPlayer, markDirty } = deps;

  function getDailyState(pData) {
    const state = pData.pveDailyRewards && typeof pData.pveDailyRewards === "object"
      ? pData.pveDailyRewards
      : { resetAt: 0, lastClaimAt: 0, totals: {} };
    if (Date.now() >= (state.resetAt || 0)) {
      state.totals = {};
      state.resetAt = Date.now() + DAILY_RESET_MS;
    }
    if (!state.totals || typeof state.totals !== "object") state.totals = {};
    return state;
  }

  function clampToCap(state, mode, requested) {
    const cap = DAILY_CAPS[mode];
    const used = state.totals[mode] || {};
    const granted = {};
    let capped = false;
    for (const [res, reqAmt] of Object.entries(requested)) {
      const maxForRes = cap[res];
      if (maxForRes === undefined) continue;
      const usedAmt = used[res] || 0;
      const remaining = Math.max(0, maxForRes - usedAmt);
      const amt = Math.max(0, Math.floor(Number(reqAmt) || 0));
      const grantedAmt = Math.min(amt, remaining);
      if (grantedAmt < amt) capped = true;
      if (grantedAmt > 0) granted[res] = grantedAmt;
    }
    return { granted, capped };
  }

  function applyGrant(pData, state, mode, granted) {
    const used = state.totals[mode] || {};
    for (const [res, amt] of Object.entries(granted)) {
      if (res === "xp") continue; // xp تُطبَّق على العميل مباشرة (لا مورد مالي)
      pData[res] = (pData[res] || 0) + amt;
      used[res] = (used[res] || 0) + amt;
    }
    if (granted.xp) used.xp = (used.xp || 0) + granted.xp;
    state.totals[mode] = used;
  }

  /** استلام مكافأة Horde/Cave/Extraction — gold/xp المطلوبة تُقصّ لسقف يومي
   *  ولا تُمنح إطلاقاً إن كانت المدخلات (wave/kills/depth/deposited) مستحيلة فيزيائياً */
  function claimModeReward(username, mode, payload) {
    const limits = MODE_LIMITS[mode];
    if (!limits) return { ok: false, reason: "unknown_mode" };

    if (mode === "horde") {
      if ((payload.wave || 0) > limits.maxWave || (payload.kills || 0) > limits.maxKills) {
        return { ok: false, reason: "implausible_data" };
      }
    } else if (mode === "cave") {
      if ((payload.depth || 0) > limits.maxDepth || (payload.rareItems || 0) > limits.maxRareItems) {
        return { ok: false, reason: "implausible_data" };
      }
    } else if (mode === "extraction") {
      if ((payload.deposited || 0) > limits.maxDeposited) {
        return { ok: false, reason: "implausible_data" };
      }
    }

    const pData = memStore.get(username) || getDefaultPlayer(username);
    const state = getDailyState(pData);

    if (Date.now() - (state.lastClaimAt || 0) < MIN_CLAIM_INTERVAL_MS) {
      return { ok: false, reason: "too_frequent" };
    }

    const requested = {
      gold: Math.max(0, Math.floor(Number(payload.gold) || 0)),
      xp: Math.max(0, Math.floor(Number(payload.xp) || 0)),
    };
    const { granted, capped } = clampToCap(state, mode, requested);
    if (!granted.gold && !granted.xp) {
      return { ok: false, reason: "daily_cap_reached" };
    }

    applyGrant(pData, state, mode, granted);
    state.lastClaimAt = Date.now();
    pData.pveDailyRewards = state;
    memStore.set(username, pData);
    markDirty(username);

    return { ok: true, grantedGold: granted.gold || 0, grantedXp: granted.xp || 0, capped };
  }

  /** استلام مكافأة غارة تحالف فردية — raidLevel يحدد جدول المكافآت الثابت
   *  (لا تُقبل قيم مكافأة حرة من العميل إطلاقاً، فقط رقم مستوى الغارة) */
  function claimAllianceRaidReward(username, raidLevel) {
    const level = Math.floor(Number(raidLevel) || 0);
    if (level < 1 || level > MODE_LIMITS.alliance_raid.maxRaidLevel) {
      return { ok: false, reason: "invalid_raid_level" };
    }
    const rewardDef = ALLIANCE_RAID_REWARDS[level - 1];
    if (!rewardDef) return { ok: false, reason: "invalid_raid_level" };

    const pData = memStore.get(username) || getDefaultPlayer(username);
    const state = getDailyState(pData);

    if (Date.now() - (state.lastClaimAt || 0) < MIN_CLAIM_INTERVAL_MS) {
      return { ok: false, reason: "too_frequent" };
    }

    const { granted, capped } = clampToCap(state, "alliance_raid", rewardDef);
    if (Object.keys(granted).length === 0) {
      return { ok: false, reason: "daily_cap_reached" };
    }

    applyGrant(pData, state, "alliance_raid", granted);
    state.lastClaimAt = Date.now();
    pData.pveDailyRewards = state;
    memStore.set(username, pData);
    markDirty(username);

    return { ok: true, granted, capped };
  }

  return { claimModeReward, claimAllianceRaidReward };
}

module.exports = { createPveModeRewards, MODE_LIMITS, DAILY_CAPS, ALLIANCE_RAID_REWARDS };
