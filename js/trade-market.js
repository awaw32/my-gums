"use strict";

/**
 * =============================================================================
 *  🏪 سوق الصحراء — نظام التبادل التجاري (Desert Market)
 * =============================================================================
 *  اللاعبون يستطيعون:
 *  1. بيع عناصر نادرة من مخزونهم بسعر يحددونه
 *  2. شراء عناصر نادرة من لاعبين آخرين
 *  3. تبادل الموارد (ذهب ↔ مال ↔ جواهر)
 *  4. تصفية وبحث في العناصر المعروضة
 *
 *  النظام يعمل عبر WebSocket — جميع اللاعبين يرون نفس السوق
 * =============================================================================
 */

import { ITEM_DEFS } from "./inventory.js";
import { RESOURCE_TYPES } from "./economy.js";

// ═══════════════════════════════════════════════════════════════════
//  تعريفات العناصر القابلة للبيع في السوق
// ═══════════════════════════════════════════════════════════════════

const TRADEABLE_ITEMS = [
  // أدوات علاج
  { id: "bandage",      name: "باندج",         icon: "🩹", category: "healing",  rarity: "common",    basePrice: 15 },
  { id: "heal_potion",  name: "جرعة علاج",     icon: "🧪", category: "healing",  rarity: "common",    basePrice: 30 },
  // أدوات قتال
  { id: "fire_sword",   name: "سيف ناري",      icon: "🗡️", category: "weapon",   rarity: "uncommon",  basePrice: 150 },
  { id: "iron_sword",   name: "سيف حديدي",     icon: "🗡️", category: "weapon",   rarity: "rare",      basePrice: 400 },
  { id: "desert_shield",name: "درع صحراوي",    icon: "🛡️", category: "defense",  rarity: "uncommon",  basePrice: 200 },
  { id: "power_helmet", name: "خوذة القوة",     icon: "⛑️", category: "buff",     rarity: "rare",      basePrice: 350 },
  // أدوات موارد
  { id: "xp_scroll",    name: "لفافة خبرة",    icon: "📜", category: "resource", rarity: "common",    basePrice: 80 },
  { id: "power_gem",    name: "جوهرة القوة",   icon: "💎", category: "buff",     rarity: "epic",      basePrice: 800 },
  // أدوات خاصة
  { id: "arena_ticket", name: "تذكرة ساحة",    icon: "🎫", category: "special",  rarity: "uncommon",  basePrice: 60 },
  { id: "tower_blueprint", name: "مخطط برج",   icon: "📐", category: "special",  rarity: "rare",      basePrice: 500 },
];

// ═══════════════════════════════════════════════════════════════════
//  ألوان الندرة (Rarity Colors)
// ═══════════════════════════════════════════════════════════════════

const RARITY_COLORS = {
  common:   { color: "#b0b0b0", label: "عادي",    bg: "rgba(176,176,176,0.1)" },
  uncommon: { color: "#4cd964", label: "غير شائع", bg: "rgba(76,217,100,0.1)" },
  rare:     { color: "#5ac8fa", label: "نادر",     bg: "rgba(90,200,250,0.1)" },
  epic:     { color: "#af52de", label: "ملحمي",   bg: "rgba(175,82,222,0.1)" },
  legendary:{ color: "#ff9500", label: "أسطوري",  bg: "rgba(255,149,0,0.1)" },
};

// ═══════════════════════════════════════════════════════════════════
//  معدّل السوق — يحدد السعر بناءً على العرض والطلب
// ═══════════════════════════════════════════════════════════════════

const MARKET_FEE_PERCENT = 0.05; // 5% رسوم السوق
const MAX_LISTINGS_PER_PLAYER = 10;
const LISTING_DURATION = 3600 * 24; // 24 ساعة

// ═══════════════════════════════════════════════════════════════════
//  مدير سوق الصحراء
// ═══════════════════════════════════════════════════════════════════

export class TradeMarket {
  constructor(economy, inventory, netSync, username) {
    this.economy = economy;
    this.inventory = inventory;
    this.netSync = netSync;
    this.username = username;

    // قائمة العناصر المعروضة للبيع
    this.listings = [];

    // سجل المعاملات الأخيرة
    this.transactionLog = [];

    // callbacks
    this._onListingAdded = null;
    this._onListingSold = null;
    this._onListingRemoved = null;
    this._onError = null;

    // تصفية الحالية
    this._filter = { category: "all", rarity: "all", sort: "newest" };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  📊 الحصول على العناصر القابلة للبيع من مخزون اللاعب
  // ═══════════════════════════════════════════════════════════════════

  getSellableItems() {
    const items = this.inventory?.items || {};
    const sellable = [];
    for (const [id, data] of Object.entries(items)) {
      if (data.count <= 0) continue;
      const tradeDef = TRADEABLE_ITEMS.find(t => t.id === id);
      if (!tradeDef) continue;
      const itemDef = ITEM_DEFS[id];
      sellable.push({
        ...tradeDef,
        count: data.count,
        level: data.level || 1,
        maxLevel: itemDef?.maxLevel || 1,
        suggestedPrice: this.getSuggestedPrice(id, data.level || 1),
      });
    }
    return sellable;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  💰 حساب السعر المقترح بناءً على المستوى والندرة
  // ═══════════════════════════════════════════════════════════════════

  getSuggestedPrice(itemId, level = 1) {
    const tradeDef = TRADEABLE_ITEMS.find(t => t.id === itemId);
    if (!tradeDef) return 0;
    const levelMult = 1 + (level - 1) * 0.5; // كل مستوى يزيد 50%
    return Math.floor(tradeDef.basePrice * levelMult);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  📦 عرض عنصر للبيع
  // ═══════════════════════════════════════════════════════════════════

  listItem(itemId, quantity, pricePerUnit) {
    // تحقق من صحة البيانات
    if (!itemId || quantity <= 0 || pricePerUnit <= 0) {
      if (this._onError) this._onError("بيانات غير صحيحة");
      return false;
    }

    // تحقق من أن العنصر قابل للبيع
    const tradeDef = TRADEABLE_ITEMS.find(t => t.id === itemId);
    if (!tradeDef) {
      if (this._onError) this._onError("هذا العنصر غير متاح للبيع في السوق");
      return false;
    }

    // تحقق من أن اللاعب لديه العنصر الكافي
    const owned = this.inventory?.items?.[itemId];
    if (!owned || owned.count < quantity) {
      if (this._onError) this._onError("ليس لديك كمية كافية");
      return false;
    }

    // تحقق من الحد الأقصى للقوائم
    const myListings = this.listings.filter(l => l.seller === this.username && !l.sold);
    if (myListings.length >= MAX_LISTINGS_PER_PLAYER) {
      if (this._onError) this._onError(`الحد الأقصى ${MAX_LISTINGS_PER_PLAYER} عناصر معروضة`);
      return false;
    }

    // تحقق من السعر المعقول (50% - 300% من السعر المقترح)
    const suggested = this.getSuggestedPrice(itemId, owned.level || 1);
    const minPrice = Math.floor(suggested * 0.5);
    const maxPrice = Math.floor(suggested * 3);
    if (pricePerUnit < minPrice || pricePerUnit > maxPrice) {
      if (this._onError) this._onError(`السعر يجب أن يكون بين ${minPrice} و ${maxPrice} 💵`);
      return false;
    }

    // خصم العنصر من المخزون
    this.inventory.items[itemId].count -= quantity;
    if (this.inventory.items[itemId].count <= 0) {
      delete this.inventory.items[itemId];
    }

    // إنشاء القائمة
    const listing = {
      id: `listing_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      itemId,
      itemName: tradeDef.name,
      itemIcon: tradeDef.icon,
      itemCategory: tradeDef.category,
      itemRarity: tradeDef.rarity,
      quantity,
      pricePerUnit,
      totalPrice: quantity * pricePerUnit,
      seller: this.username,
      sellerLevel: this.economy?.level || 1,
      level: owned.level || 1,
      sold: false,
      listedAt: Date.now(),
      expiresAt: Date.now() + LISTING_DURATION * 1000,
    };

    this.listings.push(listing);

    // إرسال للسيرفر
    if (this.netSync) {
      this.netSync.send({ type: "market_list", listing });
    }

    if (this._onListingAdded) this._onListingAdded(listing);
    return true;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  🛒 شراء عنصر من السوق
  // ═══════════════════════════════════════════════════════════════════

  buyListing(listingId, quantity = 1) {
    const listing = this.listings.find(l => l.id === listingId && !l.sold);
    if (!listing) {
      if (this._onError) this._onError("العنصر غير متاح");
      return false;
    }

    // لا تشتري من نفسك
    if (listing.seller === this.username) {
      if (this._onError) this._onError("لا يمكنك شراء من نفسك");
      return false;
    }

    // تحقق من الكمية
    if (quantity > listing.quantity) {
      if (this._onError) this._onError("الكمية غير متوفرة");
      return false;
    }

    const totalCost = listing.pricePerUnit * quantity;

    // تحقق من أن اللاعب لديه المال الكافي
    if (!this.economy.canAfford("cash", totalCost)) {
      if (this._onError) this._onError("ليس لديك مال كافٍ");
      return false;
    }

    // خصم المال
    this.economy.spend("cash", totalCost);

    // حساب رسوم السوق
    const fee = Math.floor(totalCost * MARKET_FEE_PERCENT);
    const sellerEarnings = totalCost - fee;

    // إضافة العنصر للمشتري
    if (!this.inventory.items[listing.itemId]) {
      this.inventory.items[listing.itemId] = { count: 0, level: listing.level };
    }
    this.inventory.items[listing.itemId].count += quantity;
    this.inventory.items[listing.itemId].level = Math.max(
      this.inventory.items[listing.itemId].level || 1,
      listing.level
    );

    // تحديث القائمة
    listing.quantity -= quantity;
    if (listing.quantity <= 0) listing.sold = true;

    // تسجيل المعاملة
    const transaction = {
      id: `tx_${Date.now()}`,
      itemId: listing.itemId,
      itemName: listing.itemName,
      itemIcon: listing.itemIcon,
      quantity,
      pricePerUnit: listing.pricePerUnit,
      totalCost,
      fee,
      sellerEarnings,
      buyer: this.username,
      seller: listing.seller,
      timestamp: Date.now(),
    };
    this.transactionLog.push(transaction);

    // إرسال للسيرفر
    if (this.netSync) {
      this.netSync.send({
        type: "market_buy",
        listingId,
        quantity,
        buyer: this.username,
        seller: listing.seller,
        totalCost,
        fee,
      });
    }

    if (this._onListingSold) this._onListingSold(transaction);
    return true;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  ❌ إلغاء عرض
  // ═══════════════════════════════════════════════════════════════════

  removeListing(listingId) {
    const listing = this.listings.find(l => l.id === listingId && !l.sold);
    if (!listing) return false;

    // فقط البائع يمكنه الإلغاء
    if (listing.seller !== this.username) {
      if (this._onError) this._onError("لا يمكنك إلغاء عرض شخص آخر");
      return false;
    }

    // إعادة العنصر للمخزون
    if (!this.inventory.items[listing.itemId]) {
      this.inventory.items[listing.itemId] = { count: 0, level: listing.level };
    }
    this.inventory.items[listing.itemId].count += listing.quantity;

    // حذف القائمة
    listing.sold = true; // نعلمها كمبيعة لإخفائها

    if (this.netSync) {
      this.netSync.send({ type: "market_remove", listingId });
    }

    if (this._onListingRemoved) this._onListingRemoved(listing);
    return true;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  🔄 تبادل الموارد المباشر
  // ═══════════════════════════════════════════════════════════════════

  /**
   * صرف مورد مقابل مورد آخر
   * مثال: صرف 100 ذهب مقابل 500 مال
   */
  convertResource(fromResource, toResource, amount) {
    const rates = {
      cash_to_gold:   0.2,   // 100 مال = 20 ذهب
      gold_to_cash:   4,     // 1 ذهب = 4 مال
      cash_to_gems:   0.01,  // 100 مال = 1 جوهرة
      gems_to_cash:   80,    // 1 جوهرة = 80 مال
      gold_to_gems:   0.05,  // 1 ذهب = 0.05 جوهرة
      gems_to_gold:   15,    // 1 جوهرة = 15 ذهب
    };

    const rateKey = `${fromResource}_to_${toResource}`;
    const rate = rates[rateKey];
    if (!rate) {
      if (this._onError) this._onError("بدائل الصرف غير متاحة لهذا المورد");
      return false;
    }

    if (amount <= 0) {
      if (this._onError) this._onError("أدخل موقتاً صحيحاً");
      return false;
    }

    // تحقق من أن اللاعب يملك المورد الكافي
    if (!this.economy.canAfford(fromResource, amount)) {
      if (this._onError) this._onError(`ليس لديك ${RESOURCE_TYPES[fromResource]?.name || fromResource} كافٍ`);
      return false;
    }

    const result = Math.floor(amount * rate);
    if (result <= 0) {
      if (this._onError) this._onError("النتيجة صغيرة جداً");
      return false;
    }

    // تنفيذ الصرف
    this.economy.spend(fromResource, amount);
    this.economy.addRaw(toResource, result);

    // تسجيل
    const conversion = {
      from: fromResource, fromAmount: amount,
      to: toResource, toAmount: result,
      rate, timestamp: Date.now(),
    };
    this.transactionLog.push(conversion);

    return { success: true, received: result };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  🔍 البحث والتصفية
  // ═══════════════════════════════════════════════════════════════════

  setFilter(filter) {
    this._filter = { ...this._filter, ...filter };
  }

  getFilteredListings() {
    let results = this.listings.filter(l => !l.sold && l.expiresAt > Date.now());

    // تصفية حسب الفئة
    if (this._filter.category !== "all") {
      results = results.filter(l => l.itemCategory === this._filter.category);
    }

    // تصفية حسب الندرة
    if (this._filter.rarity !== "all") {
      results = results.filter(l => l.itemRarity === this._filter.rarity);
    }

    // بحث بالاسم
    if (this._filter.search) {
      const q = this._filter.search.toLowerCase();
      results = results.filter(l => l.itemName.includes(q) || l.itemId.includes(q));
    }

    // ترتيب
    switch (this._filter.sort) {
      case "cheapest":
        results.sort((a, b) => a.pricePerUnit - b.pricePerUnit);
        break;
      case "expensive":
        results.sort((a, b) => b.pricePerUnit - a.pricePerUnit);
        break;
      case "newest":
      default:
        results.sort((a, b) => b.listedAt - a.listedAt);
    }

    return results;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  📡 استقبال تحديثات من السيرفر
  // ═══════════════════════════════════════════════════════════════════

  handleNetMessage(msg) {
    if (!msg || !msg.type) return;
    switch (msg.type) {
      case "market_listing_new":
        if (msg.listing && msg.listing.seller !== this.username) {
          this.listings.push(msg.listing);
          if (this._onListingAdded) this._onListingAdded(msg.listing);
        }
        break;
      case "market_listing_sold":
        if (msg.listingId) {
          const listing = this.listings.find(l => l.id === msg.listingId);
          if (listing) {
            listing.sold = true;
            if (this._onListingSold) this._onListingSold(msg);
          }
        }
        break;
      case "market_listing_removed":
        if (msg.listingId) {
          const listing = this.listings.find(l => l.id === msg.listingId);
          if (listing) listing.sold = true;
        }
        break;
      case "market_listings_sync":
        if (Array.isArray(msg.listings)) {
          this.listings = msg.listings;
        }
        break;
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  💾 حفظ وتحميل
  // ═══════════════════════════════════════════════════════════════════

  getSaveData() {
    return {
      listings: this.listings.filter(l => !l.sold),
      transactionLog: this.transactionLog.slice(-50), // آخر 50 معاملة
    };
  }

  loadState(data) {
    if (!data) return;
    if (data.listings) this.listings = data.listings;
    if (data.transactionLog) this.transactionLog = data.transactionLog;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  🧹 تنظيف القوائم المنتهية الصلاحية
  // ═══════════════════════════════════════════════════════════════════

  cleanup() {
    const now = Date.now();
    for (const listing of this.listings) {
      if (!listing.sold && listing.expiresAt < now) {
        // إعادة العنصر للمخزون
        if (listing.seller === this.username) {
          if (!this.inventory.items[listing.itemId]) {
            this.inventory.items[listing.itemId] = { count: 0, level: listing.level };
          }
          this.inventory.items[listing.itemId].count += listing.quantity;
        }
        listing.sold = true;
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  📈 إحصائيات السوق
  // ═══════════════════════════════════════════════════════════════════

  getMarketStats() {
    const active = this.listings.filter(l => !l.sold && l.expiresAt > Date.now());
    const totalValue = active.reduce((sum, l) => sum + l.totalPrice, 0);
    const avgPrice = active.length > 0 ? Math.floor(totalValue / active.length) : 0;
    const categories = {};
    for (const l of active) {
      categories[l.itemCategory] = (categories[l.itemCategory] || 0) + 1;
    }
    return {
      totalListings: active.length,
      totalValue,
      avgPrice,
      categories,
      recentTransactions: this.transactionLog.slice(-10),
    };
  }
}

export { TRADEABLE_ITEMS, RARITY_COLORS, MARKET_FEE_PERCENT };
