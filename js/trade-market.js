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
 *  🛡️ السوق سيرفر-موثوق للمال: كل عرض/شراء/إلغاء يُرسَل للخادم وينتظر رده —
 *  القوائم لا تُضاف/تُحذف محلياً إلا بعد تأكيد الخادم. المال (cash) يُخصم من
 *  المشتري ويُضاف للبائع فعلياً على الخادم عبر memStore — لا economy.add
 *  مباشرة على العميل لأي طرف. المخزون (العنصر نفسه) يبقى موثوقاً من العميل
 *  عند العرض فقط لأن المخزون لا يُحفظ فورياً على السيرفر.
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

// ═══════════════════════════════════════════════════════════════════
//  مدير سوق الصحراء
// ═══════════════════════════════════════════════════════════════════

export class TradeMarket {
  constructor(economy, inventory, netSync, username) {
    this.economy = economy;
    this.inventory = inventory;
    this.netSync = netSync;
    this.username = username;

    // معامل السعر من السمعة (يُضبط من main.js)
    this._priceModifier = 1;

    // قائمة العناصر المعروضة للبيع — تُملأ فقط من ردود/بث الخادم
    this.listings = [];

    // سجل المعاملات الأخيرة
    this.transactionLog = [];

    // callbacks
    this._onListingAdded = null;
    this._onListingSold = null;
    this._onListingRemoved = null;
    this._onError = null;
    this._onSaleEarned = null; // يُستدعى عند بيع أحد عناصرك أنت تحديداً
    this._onConvertDone = null; // يُستدعى بعد تأكيد الخادم لعملية صرف موارد

    // طلب صرف معلّق بانتظار رد الخادم — يمنع إرسال طلبات مكررة قبل الرد
    this._pendingConvert = null;

    // تصفية الحالية
    this._filter = { category: "all", rarity: "all", sort: "newest" };

    // طلبات معلّقة بانتظار رد الخادم — تمنع إرسال طلبات مكررة قبل الرد
    this._pendingListItem = null;
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
  //  📦 عرض عنصر للبيع — يُرسَل للخادم وينتظر تأكيده قبل خصم المخزون فعلياً
  // ═══════════════════════════════════════════════════════════════════

  listItem(itemId, quantity, pricePerUnit) {
    if (!itemId || quantity <= 0 || pricePerUnit <= 0) {
      if (this._onError) this._onError("بيانات غير صحيحة");
      return false;
    }
    const tradeDef = TRADEABLE_ITEMS.find(t => t.id === itemId);
    if (!tradeDef) {
      if (this._onError) this._onError("هذا العنصر غير متاح للبيع في السوق");
      return false;
    }
    const owned = this.inventory?.items?.[itemId];
    if (!owned || owned.count < quantity) {
      if (this._onError) this._onError("ليس لديك كمية كافية");
      return false;
    }
    const myListings = this.listings.filter(l => l.seller === this.username && !l.sold);
    if (myListings.length >= MAX_LISTINGS_PER_PLAYER) {
      if (this._onError) this._onError(`الحد الأقصى ${MAX_LISTINGS_PER_PLAYER} عناصر معروضة`);
      return false;
    }
    if (this._pendingListItem) {
      if (this._onError) this._onError("طلب عرض سابق لا يزال قيد المعالجة");
      return false;
    }

    const level = owned.level || 1;
    this._pendingListItem = { itemId, quantity, pricePerUnit, level };

    if (this.netSync) {
      this.netSync.send({
        type: "market_list",
        listing: {
          itemId, itemName: tradeDef.name, itemIcon: tradeDef.icon,
          itemCategory: tradeDef.category, itemRarity: tradeDef.rarity,
          quantity, pricePerUnit, level,
        },
      });
    }
    return true;
  }

  /** يُستدعى من handleNetMessage عند وصول market_list_response */
  _handleListItemResponse(msg) {
    const pending = this._pendingListItem;
    this._pendingListItem = null;
    if (!msg.ok) {
      const reasons = {
        price_out_of_range: `السعر يجب أن يكون بين ${msg.minPrice} و ${msg.maxPrice} 💵`,
        too_many_listings: `الحد الأقصى ${MAX_LISTINGS_PER_PLAYER} عناصر معروضة`,
        unknown_item: "هذا العنصر غير متاح للبيع في السوق",
        invalid_data: "بيانات غير صحيحة",
      };
      if (this._onError) this._onError(reasons[msg.reason] || "تعذّر عرض العنصر");
      return;
    }
    if (!pending) return;
    // ✅ تأكيد الخادم وصل — الآن فقط نخصم من المخزون المحلي فعلياً
    if (this.inventory?.items?.[pending.itemId]) {
      this.inventory.items[pending.itemId].count -= pending.quantity;
      if (this.inventory.items[pending.itemId].count <= 0) {
        delete this.inventory.items[pending.itemId];
      }
    }
    if (msg.listing) {
      this.listings.push(msg.listing);
      if (this._onListingAdded) this._onListingAdded(msg.listing);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  🛒 شراء عنصر من السوق — المال يُخصم فعلياً على الخادم فقط
  // ═══════════════════════════════════════════════════════════════════

  buyListing(listingId, quantity = 1) {
    const listing = this.listings.find(l => l.id === listingId && !l.sold);
    if (!listing) {
      if (this._onError) this._onError("العنصر غير متاح");
      return false;
    }
    if (listing.seller === this.username) {
      if (this._onError) this._onError("لا يمكنك شراء من نفسك");
      return false;
    }
    if (quantity > listing.quantity) {
      if (this._onError) this._onError("الكمية غير متوفرة");
      return false;
    }
    const priceMod = typeof this._priceModifier === "function" ? this._priceModifier() : (this._priceModifier || 1);
    const estimatedCost = Math.floor(listing.pricePerUnit * quantity * priceMod);
    if (!this.economy.canAfford("cash", estimatedCost)) {
      if (this._onError) this._onError("ليس لديك مال كافٍ");
      return false;
    }

    if (this.netSync) {
      this.netSync.send({ type: "market_buy", listingId, quantity });
    }
    return true;
  }

  /** يُستدعى من handleNetMessage عند وصول market_buy_response (للمشتري نفسه فقط) */
  _handleBuyResponse(msg) {
    if (!msg.ok) {
      const reasons = {
        insufficient_cash: "ليس لديك مال كافٍ",
        listing_not_found: "العنصر غير متاح",
        cannot_buy_own: "لا يمكنك شراء من نفسك",
        invalid_quantity: "الكمية غير متوفرة",
      };
      if (this._onError) this._onError(reasons[msg.reason] || "تعذّر الشراء");
      return;
    }
    // ✅ الخادم خصم المال فعلياً — الآن نطبّق النتيجة محلياً (المخزون + سجل المعاملة)
    this.economy.spend("cash", msg.totalCost);
    if (!this.inventory.items[msg.item.itemId]) {
      this.inventory.items[msg.item.itemId] = { count: 0, level: 1 };
    }
    this.inventory.items[msg.item.itemId].count += msg.quantity;

    const transaction = {
      id: `tx_${Date.now()}`,
      itemId: msg.item.itemId,
      itemName: msg.item.itemName,
      quantity: msg.quantity,
      totalCost: msg.totalCost,
      fee: msg.fee,
      buyer: this.username,
      timestamp: Date.now(),
    };
    this.transactionLog.push(transaction);
    if (this._onListingSold) this._onListingSold(transaction);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  ❌ إلغاء عرض — يُرسَل للخادم وينتظر تأكيده قبل إعادة العنصر للمخزون
  // ═══════════════════════════════════════════════════════════════════

  removeListing(listingId) {
    const listing = this.listings.find(l => l.id === listingId && !l.sold);
    if (!listing) return false;
    if (listing.seller !== this.username) {
      if (this._onError) this._onError("لا يمكنك إلغاء عرض شخص آخر");
      return false;
    }
    if (this.netSync) {
      this.netSync.send({ type: "market_remove", listingId });
    }
    return true;
  }

  /** يُستدعى من handleNetMessage عند وصول market_remove_response (للبائع نفسه فقط) */
  _handleRemoveResponse(msg) {
    if (!msg.ok) {
      if (this._onError) this._onError("تعذّر إلغاء العرض");
      return;
    }
    const listing = this.listings.find(l => l.id === msg.listingId);
    if (listing) listing.sold = true;
    // ✅ تأكيد الخادم وصل — الآن نعيد العنصر للمخزون المحلي فعلياً
    if (!this.inventory.items[msg.itemId]) {
      this.inventory.items[msg.itemId] = { count: 0, level: 1 };
    }
    this.inventory.items[msg.itemId].count += msg.quantity;
    if (listing && this._onListingRemoved) this._onListingRemoved(listing);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  🔄 تبادل الموارد المباشر
  // ═══════════════════════════════════════════════════════════════════

  // 🛡️ جدول المعدلات هنا للعرض/المعاينة فقط (updatePreview في ui-market.js) —
  // مطابق حرفياً لـ CONVERSION_RATES في server/logic/market-manager.js، وهو
  // المصدر الوحيد الموثوق فعلياً للتنفيذ الآن. كان الصرف الفعلي يحدث هنا
  // بالكامل محلياً (economy.spend + economy.addRaw) بلا أي رسالة WS أو تحقق
  // سيرفري — يسمح بصرف مبلغ مصطنع من console المتصفح مباشرة (تحويل فوري
  // لعملة مميزة مثل الجواهر من عدم).
  static CONVERSION_RATES = {
    cash_to_gold:   0.2,   // 100 مال = 20 ذهب
    gold_to_cash:   4,     // 1 ذهب = 4 مال
    cash_to_gems:   0.01,  // 100 مال = 1 جوهرة
    gems_to_cash:   80,    // 1 جوهرة = 80 مال
    gold_to_gems:   0.05,  // 1 ذهب = 0.05 جوهرة
    gems_to_gold:   15,    // 1 جوهرة = 15 ذهب
  };

  /**
   * صرف مورد مقابل مورد آخر — يرسل طلباً للخادم وينتظر تأكيده قبل تطبيق أي
   * تغيير على الموارد محلياً (نفس نمط listItem/buyListing/removeListing).
   */
  convertResource(fromResource, toResource, amount) {
    const rate = TradeMarket.CONVERSION_RATES[`${fromResource}_to_${toResource}`];
    if (!rate) {
      if (this._onError) this._onError("بدائل الصرف غير متاحة لهذا المورد");
      return false;
    }

    if (amount <= 0) {
      if (this._onError) this._onError("أدخل مبلغاً صحيحاً");
      return false;
    }

    if (!this.economy.canAfford(fromResource, amount)) {
      if (this._onError) this._onError(`ليس لديك ${RESOURCE_TYPES[fromResource]?.name || fromResource} كافٍ`);
      return false;
    }

    if (this._pendingConvert) {
      if (this._onError) this._onError("طلب صرف سابق لا يزال قيد المعالجة");
      return false;
    }

    if (this.netSync) {
      this._pendingConvert = { fromResource, toResource, amount };
      this.netSync.send({ type: "market_convert", from: fromResource, to: toResource, amount });
    }
    return true;
  }

  /** يُستدعى من handleNetMessage عند وصول market_convert_response */
  _handleConvertResponse(msg) {
    this._pendingConvert = null;
    if (!msg.ok) {
      const reasons = {
        invalid_resource: "بدائل الصرف غير متاحة لهذا المورد",
        invalid_amount: "أدخل مبلغاً صحيحاً",
        insufficient_resource: "ليس لديك رصيد كافٍ",
        result_too_small: "النتيجة صغيرة جداً",
      };
      if (this._onError) this._onError(reasons[msg.reason] || "تعذّر الصرف");
      return;
    }
    // ✅ الخادم نفّذ الصرف فعلياً — الآن نطبّق النتيجة محلياً
    this.economy.spend(msg.from, msg.spent);
    this.economy.addRaw(msg.to, msg.received);

    const conversion = {
      from: msg.from, fromAmount: msg.spent,
      to: msg.to, toAmount: msg.received,
      timestamp: Date.now(),
    };
    this.transactionLog.push(conversion);
    if (this._onConvertDone) this._onConvertDone(conversion);
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
      case "market_list_response":
        this._handleListItemResponse(msg);
        break;
      case "market_buy_response":
        this._handleBuyResponse(msg);
        break;
      case "market_remove_response":
        this._handleRemoveResponse(msg);
        break;
      case "market_convert_response":
        this._handleConvertResponse(msg);
        break;
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
            listing.quantity = msg.remainingQuantity ?? 0;
            listing.sold = !!msg.fullySold;
          }
        }
        break;
      case "market_sale_earned":
        // 🔔 بِعت عنصراً من عروضك — المال وصل فعلياً على الخادم بالفعل
        this.economy.addRaw("cash", msg.sellerEarnings);
        if (this._onSaleEarned) this._onSaleEarned(msg);
        break;
      case "market_listing_removed":
        if (msg.listingId) {
          const listing = this.listings.find(l => l.id === msg.listingId);
          if (listing) listing.sold = true;
          // 🕐 انتهت صلاحية عرض لأحد آخر (أو لك وأُلغي من مكان آخر) — لا نلمس مخزوننا
          // إلا إذا كان هذا فعلاً عرضنا نحن ولم نكن من طلب الإلغاء (مثال: انتهت صلاحيته)
          if (listing && listing.seller === this.username && msg.reason === "expired") {
            if (!this.inventory.items[msg.itemId]) {
              this.inventory.items[msg.itemId] = { count: 0, level: 1 };
            }
            this.inventory.items[msg.itemId].count += msg.quantity;
          }
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
      transactionLog: this.transactionLog.slice(-50), // آخر 50 معاملة — القوائم نفسها من الخادم دائماً
    };
  }

  loadState(data) {
    if (!data) return;
    if (data.transactionLog) this.transactionLog = data.transactionLog;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  🧹 تنظيف — التنظيف الفعلي (إعادة العناصر المنتهية) يتم على الخادم الآن
  // ═══════════════════════════════════════════════════════════════════

  cleanup() {
    // لا شيء — الخادم هو من يبث market_listing_removed عند انتهاء الصلاحية فعلياً
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
