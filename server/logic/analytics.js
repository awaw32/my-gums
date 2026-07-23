"use strict";

const logger = require("../logger");

/**
 * server/logic/analytics.js
 * ============================================================================
 * 📊 تحليلات مجهولة الهوية — Anonymous Analytics
 * تسجّل أحداثاً وصفية فقط (نوع الحدث + بيانات رقمية غير مُعرِّفة) لمعرفة أين
 * يترك اللاعبون اللعبة — بلا أي اسم مستخدم أو IP أو مُعرِّف شخصي إطلاقاً.
 * الأحداث تُكتب عبر pino (نفس logger المشترك) بوسم event: منفصل، ليسهل
 * تصفيتها لاحقاً في أي نظام تجميع سجلات دون الحاجة لقاعدة بيانات جديدة.
 * ============================================================================
 */

const KNOWN_EVENTS = new Set([
  "death_crate_created",
  "caravan_killed",
  "auction_won",
  "ftue_completed",
]);

function createAnalytics() {
  // عدّادات في الذاكرة فقط — تُصفَّر عند إعادة تشغيل السيرفر، لا حاجة لحفظها
  const counters = new Map(Array.from(KNOWN_EVENTS, (e) => [e, 0]));

  function track(eventName, data = {}) {
    if (!KNOWN_EVENTS.has(eventName)) return;
    counters.set(eventName, (counters.get(eventName) || 0) + 1);
    // 🛡️ لا نمرر أي حقل قد يحمل هوية (username/ip/id) — فقط أرقام/نصوص وصفية بسيطة
    const safeData = {};
    for (const [k, v] of Object.entries(data)) {
      if (typeof v === "number" || typeof v === "boolean") safeData[k] = v;
    }
    logger.info({ event: eventName, ...safeData }, "[Analytics]");
  }

  function getCounters() {
    return Object.fromEntries(counters);
  }

  return { track, getCounters };
}

module.exports = { createAnalytics, KNOWN_EVENTS };
