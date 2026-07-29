"use strict";

/**
 * server/logic/market-manager.js
 * ============================================================================
 * 🏪 سوق الصحراء — Trade Market (سيرفر-موثوق للمال، عنصر-موثوق من العميل)
 * قبل هذا الملف كان trade-market.js (العميل) يدير كل شيء محلياً بلا أي
 * معالجة سيرفرية إطلاقاً — يعني السوق بين لاعبين حقيقيين لم يكن يعمل فعلياً
 * (لا مزامنة، والبائع لا يستلم ماله). هذا الملف يصلح ذلك:
 *   - المال (cash) سيرفر-موثوق بالكامل: يُخصم من المشتري ويُضاف للبائع فعلياً
 *     عبر memStore عند البيع — لا economy.add على العميل مباشرة لأي طرف.
 *   - العنصر نفسه (item) موثوق من العميل عند العرض فقط (مع تحقق خفيف: يجب أن
 *     يكون معرَّفاً في TRADEABLE_ITEMS والسعر ضمن حدود معقولة) لأن المخزون لا
 *     يُحفظ فورياً على السيرفر (فقط عند autosave الدوري) — قرار مقصود لتفادي
 *     رفض عرض عنصر جمعه اللاعب للتو ولم يُحفظ بعد. الخصم الفعلي من مخزون
 *     البائع والإضافة لمخزون المشتري تبقى client-side كما كانت.
 * ============================================================================
 */

// 🛡️ يطابق js/trade-market.js حرفياً — الاسم/الأيقونة/الفئة/الندرة تُشتق من هنا
// حصراً عند العرض، وليس من قيم itemName/itemIcon/... التي يرسلها العميل، لأن
// تلك كانت تُبث بلا تعقيم إلى innerHTML على كل عميل متصل (XSS مخزّن).
const TRADEABLE_ITEMS = {
  bandage: { name: "باندج", icon: "🩹", category: "healing", rarity: "common", basePrice: 15 },
  heal_potion: { name: "جرعة علاج", icon: "🧪", category: "healing", rarity: "common", basePrice: 30 },
  fire_sword: { name: "سيف ناري", icon: "🗡️", category: "weapon", rarity: "uncommon", basePrice: 150 },
  iron_sword: { name: "سيف حديدي", icon: "🗡️", category: "weapon", rarity: "rare", basePrice: 400 },
  desert_shield: { name: "درع صحراوي", icon: "🛡️", category: "defense", rarity: "uncommon", basePrice: 200 },
  power_helmet: { name: "خوذة القوة", icon: "⛑️", category: "buff", rarity: "rare", basePrice: 350 },
  xp_scroll: { name: "لفافة خبرة", icon: "📜", category: "resource", rarity: "common", basePrice: 80 },
  power_gem: { name: "جوهرة القوة", icon: "💎", category: "buff", rarity: "epic", basePrice: 800 },
  arena_ticket: { name: "تذكرة ساحة", icon: "🎫", category: "special", rarity: "uncommon", basePrice: 60 },
  tower_blueprint: { name: "مخطط برج", icon: "📐", category: "special", rarity: "rare", basePrice: 500 },
};

const MARKET_FEE_PERCENT = 0.05;
const MAX_LISTINGS_PER_PLAYER = 10;
const LISTING_DURATION_MS = 24 * 60 * 60 * 1000; // 24 ساعة
const MAX_QUANTITY = 999;

function createMarketManager(deps) {
  const { worldClients, memStore, getDefaultPlayer, markDirty } = deps;

  const listings = new Map(); // id -> listing

  function broadcastToAll(message) {
    const msg = JSON.stringify(message);
    worldClients.forEach((c) => { if (c.ws.readyState === 1) c.ws.send(msg); });
  }

  function sendToPlayer(username, message) {
    const client = worldClients.get(username);
    if (client && client.ws.readyState === 1) client.ws.send(JSON.stringify(message));
  }

  function getSuggestedPrice(itemId, level = 1) {
    const def = TRADEABLE_ITEMS[itemId];
    if (!def) return 0;
    return Math.floor(def.basePrice * (1 + (level - 1) * 0.5));
  }

  /** عرض عنصر — itemId فقط موثوق من العميل؛ الاسم/الأيقونة/الفئة/الندرة تُشتق
   *  من TRADEABLE_ITEMS الخادم حصراً (لا تُقبل نصوص عرض من العميل إطلاقاً) */
  function listItem(username, { itemId, quantity, pricePerUnit, level }) {
    const def = TRADEABLE_ITEMS[itemId];
    if (!def) return { ok: false, reason: "unknown_item" };

    const qty = Math.floor(Number(quantity) || 0);
    const price = Math.floor(Number(pricePerUnit) || 0);
    const lvl = Math.max(1, Math.floor(Number(level) || 1));
    if (qty <= 0 || qty > MAX_QUANTITY || price <= 0) return { ok: false, reason: "invalid_data" };

    const suggested = getSuggestedPrice(itemId, lvl);
    const minPrice = Math.floor(suggested * 0.5);
    const maxPrice = Math.floor(suggested * 3);
    if (price < minPrice || price > maxPrice) {
      return { ok: false, reason: "price_out_of_range", minPrice, maxPrice };
    }

    const myActiveListings = Array.from(listings.values()).filter(l => l.seller === username && !l.sold);
    if (myActiveListings.length >= MAX_LISTINGS_PER_PLAYER) {
      return { ok: false, reason: "too_many_listings" };
    }

    const id = `listing_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const listing = {
      id, itemId,
      itemName: def.name,
      itemIcon: def.icon,
      itemCategory: def.category,
      itemRarity: def.rarity,
      quantity: qty,
      pricePerUnit: price,
      totalPrice: qty * price,
      seller: username,
      level: lvl,
      sold: false,
      listedAt: Date.now(),
      expiresAt: Date.now() + LISTING_DURATION_MS,
    };
    listings.set(id, listing);

    broadcastToAll({ type: "market_listing_new", listing });
    return { ok: true, listing };
  }

  /** شراء — المال سيرفر-موثوق بالكامل: يُخصم من المشتري ويُضاف للبائع فعلياً */
  function buyListing(username, listingId, quantity) {
    const listing = listings.get(listingId);
    if (!listing || listing.sold) return { ok: false, reason: "listing_not_found" };
    if (listing.seller === username) return { ok: false, reason: "cannot_buy_own" };

    const qty = Math.floor(Number(quantity) || 0);
    if (qty <= 0 || qty > listing.quantity) return { ok: false, reason: "invalid_quantity" };

    const totalCost = listing.pricePerUnit * qty;
    const buyerData = memStore.get(username) || getDefaultPlayer(username);
    if ((buyerData.cash || 0) < totalCost) return { ok: false, reason: "insufficient_cash" };

    const fee = Math.floor(totalCost * MARKET_FEE_PERCENT);
    const sellerEarnings = totalCost - fee;

    buyerData.cash -= totalCost;
    memStore.set(username, buyerData);
    markDirty(username);

    const sellerData = memStore.get(listing.seller) || getDefaultPlayer(listing.seller);
    sellerData.cash = (sellerData.cash || 0) + sellerEarnings;
    memStore.set(listing.seller, sellerData);
    markDirty(listing.seller);

    listing.quantity -= qty;
    if (listing.quantity <= 0) listing.sold = true;

    broadcastToAll({
      type: "market_listing_sold",
      listingId, quantity: qty, buyer: username, seller: listing.seller,
      totalCost, fee, sellerEarnings, itemId: listing.itemId, itemName: listing.itemName,
      remainingQuantity: listing.quantity, fullySold: listing.sold,
    });
    // 🔔 إشعار البائع تحديداً بأن ماله وصل فعلياً (مهم لأنه قد لا يكون ينظر لهذه القائمة)
    sendToPlayer(listing.seller, {
      type: "market_sale_earned", listingId, itemName: listing.itemName,
      quantity: qty, sellerEarnings, buyer: username,
    });

    return { ok: true, totalCost, fee, item: { itemId: listing.itemId, itemName: listing.itemName }, quantity: qty };
  }

  /** إلغاء عرض — البائع فقط، لا يمس المال (العنصر يعود لمخزون العميل client-side) */
  function removeListing(username, listingId) {
    const listing = listings.get(listingId);
    if (!listing || listing.sold) return { ok: false, reason: "listing_not_found" };
    if (listing.seller !== username) return { ok: false, reason: "not_your_listing" };

    listing.sold = true;
    broadcastToAll({ type: "market_listing_removed", listingId, itemId: listing.itemId, quantity: listing.quantity, reason: "cancelled" });
    return { ok: true, itemId: listing.itemId, quantity: listing.quantity };
  }

  function getActiveListings() {
    return Array.from(listings.values()).filter(l => !l.sold && l.expiresAt > Date.now());
  }

  /** تنظيف دوري — القوائم المنتهية تُعاد للبائع (client-side عند استلام الحدث) */
  function cleanupExpired() {
    const now = Date.now();
    for (const listing of listings.values()) {
      if (!listing.sold && listing.expiresAt <= now) {
        listing.sold = true;
        broadcastToAll({ type: "market_listing_removed", listingId: listing.id, itemId: listing.itemId, quantity: listing.quantity, reason: "expired" });
      }
    }
    // تحرير الذاكرة من القوائم المباعة/المنتهية القديمة (أكثر من ساعة)
    for (const [id, listing] of listings) {
      if (listing.sold && now - listing.expiresAt > 60 * 60 * 1000) listings.delete(id);
    }
  }

  return { listItem, buyListing, removeListing, getActiveListings, cleanupExpired, getSuggestedPrice };
}

module.exports = { createMarketManager, TRADEABLE_ITEMS, MARKET_FEE_PERCENT, MAX_LISTINGS_PER_PLAYER };
