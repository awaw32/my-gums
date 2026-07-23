"use strict";

const { sendPush, enabled: pushEnabled } = require("../push");

/**
 * server/logic/death-manager.js
 * ============================================================================
 * 💀 عقوبة الموت خارج الواحة — Death Manager
 * عند موت اللاعب (hp<=0) خارج المنطقة الآمنة، يُنقص الخادم -15% من ذهبه
 * المحفوظ فعلياً (memStore، لا رقم يرسله العميل) و-50% من مائه، وينشئ صندوقاً
 * (death_crate) في مكان الموت يظهر للجميع لمدة 3 دقائق. أول من يصله يأخذ الذهب
 * المفقود. كل هذا سيرفر-موثوق بالكامل (لا economy.add على العميل مباشرة)
 * لمنع أي انتحال لعقوبة موت لم تحدث فعلاً أو مبلغ غير صحيح.
 * ============================================================================
 */

const GOLD_LOSS_PERCENT = 0.15;
const WATER_LOSS_PERCENT = 0.5;
const CRATE_DURATION_MS = 3 * 60 * 1000; // 3 دقائق
const CRATE_WARNING_BEFORE_MS = 30 * 1000; // تحذير قبل 30 ثانية من انتهاء الصلاحية
const CLAIM_RADIUS = 60;

function createDeathManager(deps) {
  const { worldClients, memStore, getDefaultPlayer, markDirty, SAFE_ZONE } = deps;

  const activeCrates = new Map(); // id -> { id, x, y, goldLost, ownerId, expiresAt, timer }

  function broadcastToAll(message) {
    const msg = JSON.stringify(message);
    worldClients.forEach((c) => { if (c.ws.readyState === 1) c.ws.send(msg); });
  }

  function isInSafeZone(x, y) {
    return x >= SAFE_ZONE.x && x <= SAFE_ZONE.x + SAFE_ZONE.w &&
      y >= SAFE_ZONE.y && y <= SAFE_ZONE.y + SAFE_ZONE.h;
  }

  function despawnCrate(id, reason) {
    const crate = activeCrates.get(id);
    if (!crate) return;
    if (crate.timer) clearTimeout(crate.timer);
    activeCrates.delete(id);
    broadcastToAll({ type: "death_crate_despawn", id, reason });
  }

  /** يُستدعى عند موت لاعب (hp<=0) — يتحقق من الموقع، يخصم العقوبة، ينشئ الصندوق */
  function handlePlayerDeath(username, x, y) {
    if (isInSafeZone(x, y)) return { ok: true, penalized: false };

    const pData = memStore.get(username) || getDefaultPlayer(username);
    const goldLost = Math.floor((pData.gold || 0) * GOLD_LOSS_PERCENT);
    if (goldLost > 0) pData.gold -= goldLost;
    if (pData.water !== undefined) {
      pData.water = Math.floor((pData.water || 0) * (1 - WATER_LOSS_PERCENT));
    }
    memStore.set(username, pData);
    markDirty(username);

    if (goldLost <= 0) return { ok: true, penalized: false };

    const id = `crate_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const expiresAt = Date.now() + CRATE_DURATION_MS;
    const timer = setTimeout(() => despawnCrate(id, "expired"), CRATE_DURATION_MS);
    activeCrates.set(id, { id, x, y, goldLost, ownerId: username, expiresAt, timer });

    // 🔔 تحذير صاحب الصندوق (إن كان غير متصل) قبل انتهاء صلاحيته بـ30 ثانية
    if (pushEnabled) {
      setTimeout(() => {
        if (!activeCrates.has(id)) return; // استُلم أو انتهى بالفعل
        if (worldClients.has(username)) return; // متصل بالفعل، لا داعٍ للإزعاج
        const pData = memStore.get(username);
        if (pData?.pushSubscription) {
          sendPush(pData.pushSubscription, {
            title: "⏳ صندوقك سيُسرق!",
            body: `صندوق ذهبك (${goldLost} 🪙) في الصحراء سينتهي قريباً — عد بسرعة قبل أن يسبقك أحد!`,
            url: "/",
          });
        }
      }, CRATE_DURATION_MS - CRATE_WARNING_BEFORE_MS);
    }

    broadcastToAll({ type: "death_crate_spawn", id, x, y, goldLost, ownerId: username, expiresAt });
    return { ok: true, penalized: true, goldLost };
  }

  /** يُستدعى عند محاولة لاعب استلام صندوق — يتحقق من القرب فعلياً على الخادم */
  function claimCrate(username, crateId) {
    const crate = activeCrates.get(crateId);
    if (!crate) return { ok: false, reason: "crate_not_found" };
    const client = worldClients.get(username);
    if (!client) return { ok: false, reason: "not_connected" };
    const dist = Math.hypot(client.x - crate.x, client.y - crate.y);
    if (dist > CLAIM_RADIUS) return { ok: false, reason: "too_far" };

    const pData = memStore.get(username) || getDefaultPlayer(username);
    pData.gold = (pData.gold || 0) + crate.goldLost;
    memStore.set(username, pData);
    markDirty(username);

    despawnCrate(crateId, "claimed");
    return { ok: true, goldGained: crate.goldLost };
  }

  function getActiveCrates() {
    return Array.from(activeCrates.values());
  }

  return {
    handlePlayerDeath,
    claimCrate,
    getActiveCrates,
    isInSafeZone,
  };
}

module.exports = { createDeathManager, GOLD_LOSS_PERCENT, WATER_LOSS_PERCENT, CRATE_DURATION_MS };
