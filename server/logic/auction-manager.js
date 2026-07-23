"use strict";

/**
 * server/logic/auction-manager.js
 * ============================================================================
 * 🏆 مزاد الجمعة — Friday Legendary Auction
 * كل يوم جمعة الساعة 8 مساءً بتوقيت السعودية (UTC+3 ثابت، بلا توقيت صيفي)
 * يبدأ مزاد لعنصر أسطوري واحد يستمر 10 دقائق. اللاعبون يزايدون بالذهب،
 * وعند الانتهاء يُخصم الذهب من الفائز فعلياً عبر memStore (مصدر موثوق سيرفرياً).
 * ============================================================================
 */

const KSA_OFFSET_MS = 3 * 60 * 60 * 1000; // UTC+3 ثابت
const AUCTION_DURATION_MS = 10 * 60 * 1000; // 10 دقائق
const MIN_BID_INCREMENT = 50;

const LEGENDARY_ITEMS = [
  { id: "legendary_sword", name: "سيف الصحراء الأسطوري", icon: "🗡️", startingBid: 500 },
  { id: "legendary_shield", name: "درع الشيخ الأسطوري", icon: "🛡️", startingBid: 500 },
  { id: "legendary_gem", name: "جوهرة الرمال الأسطورية", icon: "💠", startingBid: 800 },
];

function createAuctionManager(deps) {
  const { worldClients, memStore, getDefaultPlayer, markDirty } = deps;

  let activeAuction = null; // { itemId, name, icon, currentBid, currentBidder, endsAt, timer }
  let scheduleTimer = null;

  function broadcastToAll(message) {
    const msg = JSON.stringify(message);
    worldClients.forEach((c) => { if (c.ws.readyState === 1) c.ws.send(msg); });
  }

  /** الجمعة القادمة الساعة 20:00 بتوقيت السعودية (UTC+3)، كـ timestamp UTC */
  function nextFriday8pmKSA(fromMs = Date.now()) {
    const ksaNow = new Date(fromMs + KSA_OFFSET_MS);
    const target = new Date(Date.UTC(
      ksaNow.getUTCFullYear(), ksaNow.getUTCMonth(), ksaNow.getUTCDate(), 20, 0, 0, 0
    ));
    let dayDiff = (5 - target.getUTCDay() + 7) % 7; // 5 = الجمعة
    target.setUTCDate(target.getUTCDate() + dayDiff);
    let targetUtcMs = target.getTime() - KSA_OFFSET_MS;
    if (targetUtcMs <= fromMs) targetUtcMs += 7 * 24 * 60 * 60 * 1000;
    return targetUtcMs;
  }

  function scheduleNextAuction() {
    if (scheduleTimer) clearTimeout(scheduleTimer);
    const delay = nextFriday8pmKSA() - Date.now();
    // setTimeout يقبل حتى ~24.8 يوم قبل التجاوز؛ أسبوع كامل آمن هنا
    scheduleTimer = setTimeout(() => {
      startAuction();
      scheduleNextAuction();
    }, delay);
  }

  function startAuction() {
    if (activeAuction) return;
    const item = LEGENDARY_ITEMS[Math.floor(Math.random() * LEGENDARY_ITEMS.length)];
    const endsAt = Date.now() + AUCTION_DURATION_MS;
    activeAuction = {
      itemId: item.id,
      name: item.name,
      icon: item.icon,
      currentBid: item.startingBid,
      currentBidder: null,
      endsAt,
      timer: setTimeout(endAuction, AUCTION_DURATION_MS),
    };
    broadcastToAll({
      type: "auction_start",
      itemId: item.id,
      name: item.name,
      icon: item.icon,
      startingBid: item.startingBid,
      endsAt,
    });
  }

  function placeBid(username, amount) {
    if (!activeAuction) return { ok: false, reason: "no_active_auction" };
    const amt = Math.floor(Number(amount) || 0);
    if (amt < activeAuction.currentBid + MIN_BID_INCREMENT) {
      return { ok: false, reason: "bid_too_low", minBid: activeAuction.currentBid + MIN_BID_INCREMENT };
    }
    const pData = memStore.get(username) || getDefaultPlayer(username);
    if ((pData.gold || 0) < amt) return { ok: false, reason: "insufficient_gold" };

    activeAuction.currentBid = amt;
    activeAuction.currentBidder = username;
    broadcastToAll({
      type: "auction_bid",
      itemId: activeAuction.itemId,
      currentBid: amt,
      currentBidder: username,
      endsAt: activeAuction.endsAt,
    });
    return { ok: true };
  }

  function endAuction() {
    if (!activeAuction) return;
    const { itemId, name, icon, currentBid, currentBidder } = activeAuction;
    if (currentBidder) {
      const pData = memStore.get(currentBidder) || getDefaultPlayer(currentBidder);
      if ((pData.gold || 0) >= currentBid) {
        pData.gold -= currentBid;
        pData.legendaryItems = Array.isArray(pData.legendaryItems) ? pData.legendaryItems : [];
        pData.legendaryItems.push(itemId);
        memStore.set(currentBidder, pData);
        markDirty(currentBidder);
      }
    }
    broadcastToAll({
      type: "auction_end",
      itemId,
      name,
      icon,
      winner: currentBidder,
      finalBid: currentBid,
    });
    activeAuction = null;
  }

  function getActiveAuction() {
    return activeAuction;
  }

  return {
    scheduleNextAuction,
    startAuction,
    placeBid,
    getActiveAuction,
    nextFriday8pmKSA,
  };
}

module.exports = { createAuctionManager, LEGENDARY_ITEMS, AUCTION_DURATION_MS };
