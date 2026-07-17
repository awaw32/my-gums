"use strict";

// ═══════════════════════════════════════════════════════════════════
//  🔔 تذكير دوري باستلام الهدية المجانية — لاعبون غير متصلين فقط
//  لا يعمل إطلاقاً إن غاب push.enabled (بلا مفاتيح VAPID) — no-op آمن.
// ═══════════════════════════════════════════════════════════════════

const { sendPush, enabled } = require("./push");
const { canClaimReward } = require("./logic/rewards");
const logger = require("./logger");

const CHECK_INTERVAL_MS = 30 * 60 * 1000; // فحص كل 30 دقيقة
const PUSH_COOLDOWN_MS = 6 * 60 * 60 * 1000; // لا نُزعج نفس اللاعب أكثر من مرة كل 6 ساعات

function startReminderPush({ memStore, worldClients }) {
  if (!enabled) return () => {};
  const lastPushSent = new Map(); // في الذاكرة فقط — مجرد حارس ضد الإزعاج المتكرر

  const timer = setInterval(() => {
    try {
      for (const [username, player] of memStore) {
        if (worldClients.has(username)) continue; // متصل بالفعل، لا داعٍ للإزعاج
        if (!player.pushSubscription) continue;
        if (!canClaimReward(player)) continue;
        const lastPush = lastPushSent.get(username) || 0;
        if (Date.now() - lastPush < PUSH_COOLDOWN_MS) continue;
        lastPushSent.set(username, Date.now());
        sendPush(player.pushSubscription, {
          title: "🎁 هديتك المجانية جاهزة!",
          body: "عد الآن واستلمها قبل أن تفوتك مغامرات اليوم في ملك الصحراء!",
          url: "/",
        });
      }
    } catch (e) {
      logger.warn({ err: e.message }, "[ReminderPush] scan failed");
    }
  }, CHECK_INTERVAL_MS);

  return () => clearInterval(timer);
}

module.exports = { startReminderPush };
