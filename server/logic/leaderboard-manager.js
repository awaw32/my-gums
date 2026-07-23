"use strict";

/**
 * server/logic/leaderboard-manager.js
 * ============================================================================
 * 🏅 لوحة الشرف الحية — Live Leaderboard
 * تُعاد حسابها كل 60 ثانية في الذاكرة وتُبث للجميع عبر leaderboard_update:
 *   - أغنى تاجر: أعلى cash بين اللاعبين المتصلين حالياً (memStore)
 *   - سفّاح قطّاع الطرق: أعلى army_power حي بين المتصلين (worldClients) —
 *     لا يوجد حقل "kills" محفوظ فعلياً على السيرفر، فاستُبدل بالقوة القتالية
 *     الحية بقرار صريح من المستخدم بدل اختلاق بنية تحتية جديدة.
 *   - أكبر تحالف بقوة قتالية: عبر allianceManager.getTribePower الموجودة
 * ============================================================================
 */

const UPDATE_INTERVAL_MS = 60000;

function createLeaderboardManager(deps) {
  const { worldClients, memStore, allianceMemStore, allianceManager } = deps;

  let intervalTimer = null;
  let latest = { richestTrader: null, banditSlayer: null, topAlliance: null, updatedAt: 0 };

  function broadcastToAll(message) {
    const msg = JSON.stringify(message);
    worldClients.forEach((c) => { if (c.ws.readyState === 1) c.ws.send(msg); });
  }

  function computeLeaderboard() {
    // 💰 أغنى تاجر — بين اللاعبين المتصلين حالياً فقط
    let richestTrader = null;
    for (const username of worldClients.keys()) {
      const pData = memStore.get(username);
      const cash = pData?.cash || 0;
      if (!richestTrader || cash > richestTrader.value) {
        richestTrader = { username, value: cash };
      }
    }

    // ⚔️ سفّاح قطّاع الطرق — أعلى قوة قتالية حية بين المتصلين
    let banditSlayer = null;
    for (const [username, c] of worldClients) {
      const power = c.army_power || 0;
      if (!banditSlayer || power > banditSlayer.value) {
        banditSlayer = { username, value: power };
      }
    }

    // 🏕️ أكبر تحالف بقوة قتالية
    let topAlliance = null;
    for (const alliance of allianceMemStore.values()) {
      const power = allianceManager.getTribePower(alliance.id);
      if (!topAlliance || power > topAlliance.value) {
        topAlliance = { name: alliance.name, value: power };
      }
    }

    latest = { richestTrader, banditSlayer, topAlliance, updatedAt: Date.now() };
    broadcastToAll({ type: "leaderboard_update", ...latest });
    return latest;
  }

  function start() {
    if (intervalTimer) return;
    computeLeaderboard();
    intervalTimer = setInterval(computeLeaderboard, UPDATE_INTERVAL_MS);
  }

  function getLatest() {
    return latest;
  }

  return { start, computeLeaderboard, getLatest };
}

module.exports = { createLeaderboardManager, UPDATE_INTERVAL_MS };
