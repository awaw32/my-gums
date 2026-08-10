"use strict";

/**
 * server/logic/market-manager.js
 * ============================================================================
 * 🏪 سوق الصحراء — Trade Market (سيرفر-موثوق بالكامل: مال + عنصر)
 * قبل هذا الملف كان trade-market.js (العميل) يدير كل شيء محلياً بلا أي
 * معالجة سيرفرية إطلاقاً — يعني السوق بين لاعبين حقيقيين لم يكن يعمل فعلياً
 * (لا مزامنة، والبائع لا يستلم ماله). هذا الملف يصلح ذلك:
 *   - المال (cash) سيرفر-موثوق بالكامل: يُخصم من المشتري ويُضاف للبائع فعلياً
 *     عبر memStore عند البيع — لا economy.add على العميل مباشرة لأي طرف.
 *   - العنصر (item) سيرفر-موثوق بالكامل أيضاً: عند العرض يُخصم فوراً من
 *     memStore.inventory الخاص بالبائع (وليس بانتظار autosave أو تصريح
 *     العميل)، وعند الشراء يُضاف فعلياً لمخزون المشتري على الخادم، وعند
 *     الإلغاء/الانتهاء يعود للبائع. هذا يمنع عرض عنصر غير مملوك فعلياً وبيعه
 *     لعدة مشترين حقيقيين (توليد كاش من عدم) — كانت هذه ثغرة اقتصادية حرجة.
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

// 🛡️ يطابق CONVERSION_RATES في js/trade-market.js حرفياً — نفس مصدر الحقيقة
// للسعر المعروض للاعب. لا صلة له بمعدلات mismatch سابقة؛ هذا الجدول نفسه
// أصبح الآن الحَكَم الوحيد الموثوق (انظر convertResource أدناه).
const CONVERSION_RATES = {
  cash_to_gold: 0.2, gold_to_cash: 4,
  cash_to_gems: 0.01, gems_to_cash: 80,
  gold_to_gems: 0.05, gems_to_gold: 15,
};
const CONVERTIBLE_RESOURCES = new Set(["cash", "gold", "gems"]);
// حد أقصى معقول لمبلغ صرف واحد — يحدّ من تأثير أي خطأ تقريب/استغلال توقيت
// دون منع اللعب الطبيعي (يفوق بكثير أي رصيد واقعي في نطاق مبكر إلى متوسط)
const MAX_CONVERT_AMOUNT = 5_000_000;

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

  /** ينزع qty من inventory.items[itemId] الموثوق سيرفرياً؛ يعيد false إن لم
   *  تكن الكمية كافية فعلياً (لا يعدّل شيئاً في تلك الحالة) */
  function deductOwnedItem(username, itemId, qty) {
    const pData = memStore.get(username) || getDefaultPlayer(username);
    const items = pData.inventory && typeof pData.inventory === "object" ? pData.inventory.items : null;
    const owned = items && items[itemId];
    const ownedCount = Math.floor(Number(owned?.count) || 0);
    if (ownedCount < qty) return { ok: false, level: owned?.level || 1 };

    const level = owned.level || 1;
    owned.count = ownedCount - qty;
    if (owned.count <= 0) delete items[itemId];
    memStore.set(username, pData);
    markDirty(username);
    return { ok: true, level };
  }

  /** يعيد qty من itemId لمخزون username الموثوق سيرفرياً (إلغاء/انتهاء/شراء) */
  function creditOwnedItem(username, itemId, qty, level = 1) {
    const pData = memStore.get(username) || getDefaultPlayer(username);
    if (!pData.inventory || typeof pData.inventory !== "object") pData.inventory = {};
    if (!pData.inventory.items || typeof pData.inventory.items !== "object") pData.inventory.items = {};
    const items = pData.inventory.items;
    if (!items[itemId]) items[itemId] = { count: 0, level: level || 1 };
    items[itemId].count = Math.floor(Number(items[itemId].count) || 0) + qty;
    memStore.set(username, pData);
    markDirty(username);
  }

  /** عرض عنصر — itemId فقط موثوق من العميل؛ الاسم/الأيقونة/الفئة/الندرة تُشتق
   *  من TRADEABLE_ITEMS الخادم حصراً (لا تُقبل نصوص عرض من العميل إطلاقاً).
   *  الكمية تُخصم فعلياً من inventory الموثوق على الخادم فوراً — لا يمكن عرض
   *  عنصر غير مملوك فعلياً ولا عرضه أكثر من مرة. */
  function listItem(username, { itemId, quantity, pricePerUnit }) {
    const def = TRADEABLE_ITEMS[itemId];
    if (!def) return { ok: false, reason: "unknown_item" };

    const qty = Math.floor(Number(quantity) || 0);
    const price = Math.floor(Number(pricePerUnit) || 0);
    if (qty <= 0 || qty > MAX_QUANTITY || price <= 0) return { ok: false, reason: "invalid_data" };

    const myActiveListings = Array.from(listings.values()).filter(l => l.seller === username && !l.sold);
    if (myActiveListings.length >= MAX_LISTINGS_PER_PLAYER) {
      return { ok: false, reason: "too_many_listings" };
    }

    // 🛡️ خصم فعلي وفوري من المخزون الموثوق سيرفرياً — يمنع بيع عنصر لا يملكه
    const deduction = deductOwnedItem(username, itemId, qty);
    if (!deduction.ok) return { ok: false, reason: "insufficient_quantity" };
    const lvl = Math.max(1, Math.floor(Number(deduction.level) || 1));

    const suggested = getSuggestedPrice(itemId, lvl);
    const minPrice = Math.floor(suggested * 0.5);
    const maxPrice = Math.floor(suggested * 3);
    if (price < minPrice || price > maxPrice) {
      creditOwnedItem(username, itemId, qty, lvl); // 🔄 استرجاع فوري — العرض رُفض
      return { ok: false, reason: "price_out_of_range", minPrice, maxPrice };
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

  /** شراء — المال سيرفر-موثوق بالكامل (يُخصم من المشتري ويُضاف للبائع)
   *  والعنصر سيرفر-موثوق أيضاً (يُضاف فعلياً لمخزون المشتري على الخادم)
   *
   *  ⚠️ حماية double-spend هنا تعتمد بالكامل على كون هذه الدالة **متزامنة
   *  synchronous تماماً** (Node.js أحادي الخيط لا يقاطع تنفيذها في المنتصف).
   *  لا يوجد قفل صريح (mutex/transaction) بين قراءة listing/memStore وتعديلها.
   *  ‼️ لا تُضِف أي `await` داخل هذه الدالة (استدعاء DB، I/O، إلخ) بين قراءة
   *  الحالة وتعديلها دون إضافة قفل صريح أولاً — أي `await` كهذا يفتح نافذة
   *  سباق حقيقية تسمح بشراء نفس الكمية مرتين من رصيد واحد (انظر guard test
   *  في tests/market-manager.test.js الذي يتحقق من عدم وجود await هنا). */
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

    // 🛡️ العنصر المُشترى يُضاف فعلياً لمخزون المشتري الموثوق سيرفرياً — كان
    // البائع (الأصلي) قد فُصل مخزونه فعلياً عند العرض في listItem أعلاه
    creditOwnedItem(username, listing.itemId, qty, listing.level);

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

  /** إلغاء عرض — البائع فقط، لا يمس المال؛ العنصر يعود فعلياً لمخزون البائع
   *  الموثوق سيرفرياً (كان قد خُصم منه فعلياً عند العرض في listItem) */
  function removeListing(username, listingId) {
    const listing = listings.get(listingId);
    if (!listing || listing.sold) return { ok: false, reason: "listing_not_found" };
    if (listing.seller !== username) return { ok: false, reason: "not_your_listing" };

    listing.sold = true;
    creditOwnedItem(username, listing.itemId, listing.quantity, listing.level);
    broadcastToAll({ type: "market_listing_removed", listingId, itemId: listing.itemId, quantity: listing.quantity, reason: "cancelled" });
    return { ok: true, itemId: listing.itemId, quantity: listing.quantity };
  }

  /**
   * 🛡️ صرف مورد مقابل مورد آخر — كان convertResource في js/trade-market.js
   * يُنفَّذ بالكامل على العميل (economy.spend + economy.addRaw مباشرة، بلا
   * أي رسالة WS أو تحقق سيرفري إطلاقاً)، بعكس بقية عمليات السوق (عرض/شراء/
   * إلغاء) الموثوقة سيرفرياً بالكامل في هذا الملف. أي لاعب يستدعي
   * tradeMarket.convertResource() مباشرة من console المتصفح كان يستطيع صرف
   * مبلغ ضخم مصطنع (cash→gems مثلاً) بلا أي رصيد حقيقي — تحويل فوري لعملة
   * مميزة (gems) من عدم. الآن الخصم والإضافة يحدثان على memStore الموثوق
   * فقط، وبنفس جدول المعدلات المستخدم للعرض على العميل.
   */
  function convertResource(username, fromResource, toResource, amount) {
    if (!CONVERTIBLE_RESOURCES.has(fromResource) || !CONVERTIBLE_RESOURCES.has(toResource)) {
      return { ok: false, reason: "invalid_resource" };
    }
    if (fromResource === toResource) return { ok: false, reason: "invalid_resource" };
    const rate = CONVERSION_RATES[`${fromResource}_to_${toResource}`];
    if (!rate) return { ok: false, reason: "invalid_resource" };

    const amt = Math.floor(Number(amount) || 0);
    if (amt <= 0 || amt > MAX_CONVERT_AMOUNT) return { ok: false, reason: "invalid_amount" };

    const pData = memStore.get(username) || getDefaultPlayer(username);
    const have = Math.floor(Number(pData[fromResource]) || 0);
    if (have < amt) return { ok: false, reason: "insufficient_resource" };

    const received = Math.floor(amt * rate);
    if (received <= 0) return { ok: false, reason: "result_too_small" };

    pData[fromResource] = have - amt;
    pData[toResource] = Math.floor(Number(pData[toResource]) || 0) + received;
    memStore.set(username, pData);
    markDirty(username);

    return { ok: true, from: fromResource, to: toResource, spent: amt, received };
  }

  function getActiveListings() {
    return Array.from(listings.values()).filter(l => !l.sold && l.expiresAt > Date.now());
  }

  /** تنظيف دوري — القوائم المنتهية تُعاد فعلياً لمخزون البائع الموثوق سيرفرياً */
  function cleanupExpired() {
    const now = Date.now();
    for (const listing of listings.values()) {
      if (!listing.sold && listing.expiresAt <= now) {
        listing.sold = true;
        creditOwnedItem(listing.seller, listing.itemId, listing.quantity, listing.level);
        broadcastToAll({ type: "market_listing_removed", listingId: listing.id, itemId: listing.itemId, quantity: listing.quantity, reason: "expired" });
      }
    }
    // تحرير الذاكرة من القوائم المباعة/المنتهية القديمة (أكثر من ساعة)
    for (const [id, listing] of listings) {
      if (listing.sold && now - listing.expiresAt > 60 * 60 * 1000) listings.delete(id);
    }
  }

  return { listItem, buyListing, removeListing, convertResource, getActiveListings, cleanupExpired, getSuggestedPrice };
}

module.exports = { createMarketManager, TRADEABLE_ITEMS, MARKET_FEE_PERCENT, MAX_LISTINGS_PER_PLAYER };
