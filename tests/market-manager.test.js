import { describe, it, expect, beforeEach } from 'vitest';
import { createMarketManager, TRADEABLE_ITEMS, MARKET_FEE_PERCENT, MAX_LISTINGS_PER_PLAYER } from '../server/logic/market-manager.js';

// 🛡️ يستخدم createMarketManager الحقيقي (وليس محاكاة) — هذا الملف يحرّك مالاً
// حقيقياً بين لاعبين (memStore) وكان بلا أي تغطية اختبارية إطلاقاً رغم ذلك.
function createTestEnv() {
  const worldClients = new Map();
  const memStore = new Map();
  function getDefaultPlayer(username) {
    return { username, cash: 0 };
  }
  function markDirty() {}
  const manager = createMarketManager({ worldClients, memStore, getDefaultPlayer, markDirty });
  return { worldClients, memStore, manager };
}

function setCash(memStore, username, cash) {
  const existing = memStore.get(username) || { username };
  memStore.set(username, { ...existing, cash });
}

// 🛡️ يمنح username كمية qty من itemId في مخزونه الموثوق سيرفرياً — يحاكي ما
// يحدث فعلياً عندما يجمع اللاعب عنصراً في اللعبة (drop/craft) قبل عرضه للبيع
function giveItem(memStore, username, itemId, qty, level = 1) {
  const existing = memStore.get(username) || { username, cash: 0 };
  const inventory = existing.inventory && typeof existing.inventory === 'object' ? existing.inventory : {};
  const items = inventory.items && typeof inventory.items === 'object' ? inventory.items : {};
  items[itemId] = { count: (items[itemId]?.count || 0) + qty, level };
  memStore.set(username, { ...existing, inventory: { ...inventory, items } });
}

describe('🏪 سوق الصحراء (server/logic/market-manager.js الحقيقي)', () => {
  let worldClients, memStore, manager;

  beforeEach(() => {
    ({ worldClients, memStore, manager } = createTestEnv());
  });

  describe('عرض عنصر (listItem)', () => {
    it('يرفض عنصراً غير معرَّف في TRADEABLE_ITEMS', () => {
      const result = manager.listItem('seller1', { itemId: 'fake_item', quantity: 1, pricePerUnit: 100, level: 1 });
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('unknown_item');
    });

    it('يرفض كمية صفر أو سالبة', () => {
      giveItem(memStore, 'seller1', 'bandage', 5);
      const result = manager.listItem('seller1', { itemId: 'bandage', quantity: 0, pricePerUnit: 15, level: 1 });
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('invalid_data');
    });

    it('يرفض عرض عنصر لا يملكه اللاعب فعلياً على الخادم', () => {
      const result = manager.listItem('seller1', { itemId: 'bandage', quantity: 1, pricePerUnit: 15, level: 1 });
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('insufficient_quantity');
    });

    it('يرفض عرض كمية أكبر من المملوكة فعلياً ولا يخصم شيئاً', () => {
      giveItem(memStore, 'seller1', 'bandage', 2);
      const result = manager.listItem('seller1', { itemId: 'bandage', quantity: 5, pricePerUnit: 15, level: 1 });
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('insufficient_quantity');
      expect(memStore.get('seller1').inventory.items.bandage.count).toBe(2);
    });

    it('يرفض سعراً أعلى من الحد الأقصى المسموح (3x السعر المقترح)', () => {
      giveItem(memStore, 'seller1', 'bandage', 5);
      const suggested = manager.getSuggestedPrice('bandage', 1);
      const result = manager.listItem('seller1', { itemId: 'bandage', quantity: 1, pricePerUnit: suggested * 10, level: 1 });
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('price_out_of_range');
      // 🛡️ العرض رُفض — يجب أن يُسترجع العنصر المخصوم مؤقتاً بالكامل
      expect(memStore.get('seller1').inventory.items.bandage.count).toBe(5);
    });

    it('يرفض سعراً أقل من الحد الأدنى المسموح (0.5x السعر المقترح)', () => {
      giveItem(memStore, 'seller1', 'bandage', 5);
      const suggested = manager.getSuggestedPrice('bandage', 1);
      const result = manager.listItem('seller1', { itemId: 'bandage', quantity: 1, pricePerUnit: Math.floor(suggested * 0.1), level: 1 });
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('price_out_of_range');
      expect(memStore.get('seller1').inventory.items.bandage.count).toBe(5);
    });

    it('يقبل عرضاً صحيحاً ويشتق الاسم/الأيقونة من TRADEABLE_ITEMS وليس من العميل', () => {
      giveItem(memStore, 'seller1', 'bandage', 5);
      const suggested = manager.getSuggestedPrice('bandage', 1);
      const result = manager.listItem('seller1', {
        itemId: 'bandage', quantity: 5, pricePerUnit: suggested,
        // 🛡️ حتى لو حاول العميل إرسال اسم/أيقونة مزيّفة، يجب أن تُتجاهل تماماً
        itemName: '<img src=x onerror=alert(1)>', itemIcon: '<script>', level: 1,
      });
      expect(result.ok).toBe(true);
      expect(result.listing.itemName).toBe(TRADEABLE_ITEMS.bandage.name);
      expect(result.listing.itemIcon).toBe(TRADEABLE_ITEMS.bandage.icon);
      expect(result.listing.itemCategory).toBe(TRADEABLE_ITEMS.bandage.category);
      expect(result.listing.itemRarity).toBe(TRADEABLE_ITEMS.bandage.rarity);
      expect(result.listing.seller).toBe('seller1');
      expect(result.listing.totalPrice).toBe(5 * suggested);
      // 🛡️ الكمية المعروضة يجب أن تُخصم فعلياً من المخزون الموثوق سيرفرياً
      expect(memStore.get('seller1').inventory.items.bandage).toBeUndefined();
    });

    it('لا يسمح بعرض نفس الكمية مرتين (كانت هذه الثغرة: توليد كاش من عدم)', () => {
      giveItem(memStore, 'seller1', 'bandage', 5);
      const suggested = manager.getSuggestedPrice('bandage', 1);
      const first = manager.listItem('seller1', { itemId: 'bandage', quantity: 5, pricePerUnit: suggested, level: 1 });
      expect(first.ok).toBe(true);
      const second = manager.listItem('seller1', { itemId: 'bandage', quantity: 5, pricePerUnit: suggested, level: 1 });
      expect(second.ok).toBe(false);
      expect(second.reason).toBe('insufficient_quantity');
    });

    it('يرفض تجاوز الحد الأقصى لعدد العروض النشطة للاعب الواحد', () => {
      giveItem(memStore, 'seller1', 'bandage', MAX_LISTINGS_PER_PLAYER + 1);
      const suggested = manager.getSuggestedPrice('bandage', 1);
      for (let i = 0; i < MAX_LISTINGS_PER_PLAYER; i++) {
        const r = manager.listItem('seller1', { itemId: 'bandage', quantity: 1, pricePerUnit: suggested, level: 1 });
        expect(r.ok).toBe(true);
      }
      const overflow = manager.listItem('seller1', { itemId: 'bandage', quantity: 1, pricePerUnit: suggested, level: 1 });
      expect(overflow.ok).toBe(false);
      expect(overflow.reason).toBe('too_many_listings');
    });

    it('يبث market_listing_new لكل العملاء المتصلين عند نجاح العرض', () => {
      giveItem(memStore, 'seller1', 'bandage', 1);
      const sent = [];
      worldClients.set('watcher', { ws: { readyState: 1, send: (m) => sent.push(JSON.parse(m)) } });
      const suggested = manager.getSuggestedPrice('bandage', 1);
      manager.listItem('seller1', { itemId: 'bandage', quantity: 1, pricePerUnit: suggested, level: 1 });
      expect(sent).toHaveLength(1);
      expect(sent[0].type).toBe('market_listing_new');
    });
  });

  describe('الشراء (buyListing)', () => {
    function listBandage(seller = 'seller1', quantity = 10) {
      giveItem(memStore, seller, 'bandage', quantity);
      const suggested = manager.getSuggestedPrice('bandage', 1);
      return manager.listItem(seller, { itemId: 'bandage', quantity, pricePerUnit: suggested, level: 1 }).listing;
    }

    it('يرفض شراء عرض غير موجود', () => {
      const result = manager.buyListing('buyer1', 'fake_id', 1);
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('listing_not_found');
    });

    it('يرفض شراء البائع لعرضه الخاص', () => {
      const listing = listBandage('seller1');
      setCash(memStore, 'seller1', 100000);
      const result = manager.buyListing('seller1', listing.id, 1);
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('cannot_buy_own');
    });

    it('يرفض شراء كمية أكبر من المتوفرة', () => {
      const listing = listBandage('seller1', 5);
      setCash(memStore, 'buyer1', 100000);
      const result = manager.buyListing('buyer1', listing.id, 6);
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('invalid_quantity');
    });

    it('يرفض الشراء برصيد غير كافٍ', () => {
      const listing = listBandage('seller1', 5);
      setCash(memStore, 'buyer1', 1);
      const result = manager.buyListing('buyer1', listing.id, 5);
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('insufficient_cash');
      // 🛡️ الرصيد يجب ألا يتغير عند الرفض
      expect(memStore.get('buyer1').cash).toBe(1);
    });

    it('يخصم من المشتري ويضيف للبائع فعلياً مطروحاً منه رسوم السوق', () => {
      const listing = listBandage('seller1', 5);
      setCash(memStore, 'buyer1', 100000);
      setCash(memStore, 'seller1', 0);
      const startCash = 100000;
      const result = manager.buyListing('buyer1', listing.id, 3);
      expect(result.ok).toBe(true);
      const totalCost = listing.pricePerUnit * 3;
      const expectedFee = Math.floor(totalCost * MARKET_FEE_PERCENT);
      const expectedSellerEarnings = totalCost - expectedFee;
      expect(memStore.get('buyer1').cash).toBe(startCash - totalCost);
      expect(memStore.get('seller1').cash).toBe(expectedSellerEarnings);
      expect(result.fee).toBe(expectedFee);
      expect(result.totalCost).toBe(totalCost);
      // 🛡️ العنصر المُشترى يجب أن يُضاف فعلياً لمخزون المشتري الموثوق سيرفرياً
      expect(memStore.get('buyer1').inventory.items.bandage.count).toBe(3);
    });

    it('ينقص الكمية المتبقية في العرض ولا يُعلَّم كمباع بالكامل عند شراء جزئي', () => {
      const listing = listBandage('seller1', 10);
      setCash(memStore, 'buyer1', 100000);
      manager.buyListing('buyer1', listing.id, 4);
      const active = manager.getActiveListings();
      const updated = active.find(l => l.id === listing.id);
      expect(updated.quantity).toBe(6);
      expect(updated.sold).toBe(false);
    });

    it('يُعلَّم العرض كمباع بالكامل عند شراء كل الكمية', () => {
      const listing = listBandage('seller1', 3);
      setCash(memStore, 'buyer1', 100000);
      manager.buyListing('buyer1', listing.id, 3);
      const active = manager.getActiveListings();
      expect(active.find(l => l.id === listing.id)).toBeUndefined();
    });

    it('لا يمكن شراء نفس العرض بعد بيعه بالكامل', () => {
      const listing = listBandage('seller1', 2);
      setCash(memStore, 'buyer1', 100000);
      setCash(memStore, 'buyer2', 100000);
      manager.buyListing('buyer1', listing.id, 2);
      const result = manager.buyListing('buyer2', listing.id, 1);
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('listing_not_found');
    });

    it('يُرسل إشعاراً خاصاً للبائع بأن ماله وصل', () => {
      const listing = listBandage('seller1', 5);
      setCash(memStore, 'buyer1', 100000);
      const sellerMsgs = [];
      worldClients.set('seller1', { ws: { readyState: 1, send: (m) => sellerMsgs.push(JSON.parse(m)) } });
      manager.buyListing('buyer1', listing.id, 2);
      const earned = sellerMsgs.find(m => m.type === 'market_sale_earned');
      expect(earned).toBeTruthy();
      expect(earned.buyer).toBe('buyer1');
    });
  });

  describe('إلغاء عرض (removeListing)', () => {
    function listBandage(seller = 'seller1') {
      giveItem(memStore, seller, 'bandage', 5);
      const suggested = manager.getSuggestedPrice('bandage', 1);
      return manager.listItem(seller, { itemId: 'bandage', quantity: 5, pricePerUnit: suggested, level: 1 }).listing;
    }

    it('يرفض إلغاء عرض ليس ملكاً للمُلغي', () => {
      const listing = listBandage('seller1');
      const result = manager.removeListing('someone_else', listing.id);
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('not_your_listing');
    });

    it('يسمح للبائع بإلغاء عرضه الخاص ويعيد العنصر فعلياً لمخزونه', () => {
      const listing = listBandage('seller1');
      const result = manager.removeListing('seller1', listing.id);
      expect(result.ok).toBe(true);
      expect(manager.getActiveListings().find(l => l.id === listing.id)).toBeUndefined();
      expect(memStore.get('seller1').inventory.items.bandage.count).toBe(5);
    });

    it('لا يمس رصيد أي طرف عند الإلغاء', () => {
      const listing = listBandage('seller1');
      setCash(memStore, 'seller1', 500);
      manager.removeListing('seller1', listing.id);
      expect(memStore.get('seller1').cash).toBe(500);
    });
  });

  describe('التنظيف الدوري (cleanupExpired)', () => {
    it('يُعلِّم العروض المنتهية كمباعة ويبث إشعار انتهاء ويعيد العنصر للبائع', () => {
      giveItem(memStore, 'seller1', 'bandage', 1);
      const suggested = manager.getSuggestedPrice('bandage', 1);
      const listing = manager.listItem('seller1', { itemId: 'bandage', quantity: 1, pricePerUnit: suggested, level: 1 }).listing;
      // محاكاة انتهاء الصلاحية يدوياً
      listing.expiresAt = Date.now() - 1000;

      const sent = [];
      worldClients.set('watcher', { ws: { readyState: 1, send: (m) => sent.push(JSON.parse(m)) } });
      manager.cleanupExpired();

      const expiredMsg = sent.find(m => m.type === 'market_listing_removed' && m.reason === 'expired');
      expect(expiredMsg).toBeTruthy();
      expect(manager.getActiveListings().find(l => l.id === listing.id)).toBeUndefined();
      expect(memStore.get('seller1').inventory.items.bandage.count).toBe(1);
    });
  });

  describe('🛡️ حارس ضد race condition مستقبلي (double-spend)', () => {
    it('buyListing يجب أن تبقى دالة متزامنة (synchronous) تماماً بلا await', () => {
      // حماية double-spend في buyListing تعتمد بالكامل على أنها متزامنة صرفة
      // (Node.js أحادي الخيط لا يقاطع تنفيذها). أي تحويل مستقبلي لـ async/await
      // (مثلاً لاستدعاء قاعدة بيانات) يفتح نافذة سباق حقيقية بلا قفل صريح —
      // هذا الاختبار يفشل فوراً إن حدث ذلك، كتذكير إلزامي لإضافة قفل أولاً.
      expect(manager.buyListing.constructor.name).not.toBe('AsyncFunction');
      const suggested = manager.getSuggestedPrice('bandage', 1);
      giveItem(memStore, 'seller1', 'bandage', 5);
      const listing = manager.listItem('seller1', { itemId: 'bandage', quantity: 5, pricePerUnit: suggested, level: 1 }).listing;
      setCash(memStore, 'buyer1', 100000);
      const result = manager.buyListing('buyer1', listing.id, 5);
      // لو كانت async، هذا سيكون Promise وليس كائن النتيجة مباشرة
      expect(result).not.toBeInstanceOf(Promise);
      expect(result.ok).toBe(true);
    });

    it('listItem يجب أن تبقى دالة متزامنة تماماً بلا await', () => {
      expect(manager.listItem.constructor.name).not.toBe('AsyncFunction');
    });
  });

  // 🛡️ قبل هذا الإصلاح: صرف الموارد (cash↔gold↔gems) كان يُنفَّذ بالكامل على
  // العميل (js/trade-market.js: economy.spend + economy.addRaw مباشرة) بلا
  // أي رسالة WS أو تحقق سيرفري إطلاقاً — أي لاعب يستدعي convertResource()
  // من console المتصفح مباشرة يستطيع صرف مبلغ مصطنع (بلا رصيد حقيقي) والحصول
  // على عملة مميزة (gems) من عدم. الآن convertResource يُنفَّذ هنا فقط،
  // بالخصم/الإضافة على memStore الموثوق سيرفرياً.
  describe('صرف الموارد (convertResource)', () => {
    it('يرفض زوج موارد غير مدعوم', () => {
      setCash(memStore, 'p1', 1000);
      const result = manager.convertResource('p1', 'food', 'gems', 100);
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('invalid_resource');
    });

    it('يرفض صرف مورد في نفسه', () => {
      setCash(memStore, 'p1', 1000);
      const result = manager.convertResource('p1', 'cash', 'cash', 100);
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('invalid_resource');
    });

    it('يرفض مبلغاً صفرياً أو سالباً', () => {
      setCash(memStore, 'p1', 1000);
      const result = manager.convertResource('p1', 'cash', 'gold', 0);
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('invalid_amount');
    });

    it('يرفض الصرف بلا رصيد حقيقي كافٍ — لا يمنح شيئاً', () => {
      const before = memStore.get('p1');
      const result = manager.convertResource('p1', 'cash', 'gems', 100000);
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('insufficient_resource');
      // لا يوجد رصيد سابق أصلاً — يجب ألا يُنشئ أي رصيد جواهر من عدم
      expect(memStore.get('p1')?.gems || 0).toBe(before?.gems || 0);
    });

    it('يقبل صرف cash→gems برصيد حقيقي كافٍ ويطبّق المعدل الصحيح (100 cash = 1 gem)', () => {
      const p = { username: 'p1', cash: 1000, gems: 0 };
      memStore.set('p1', p);
      const result = manager.convertResource('p1', 'cash', 'gems', 500);
      expect(result.ok).toBe(true);
      expect(result.spent).toBe(500);
      expect(result.received).toBe(5); // 500 * 0.01
      expect(memStore.get('p1').cash).toBe(500);
      expect(memStore.get('p1').gems).toBe(5);
    });

    it('يخصم بالضبط المبلغ المطلوب — لا يمكن صرف أكثر من الرصيد الفعلي', () => {
      memStore.set('p1', { username: 'p1', cash: 100, gems: 0 });
      const result = manager.convertResource('p1', 'cash', 'gems', 500);
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('insufficient_resource');
      expect(memStore.get('p1').cash).toBe(100); // لم يُخصم شيء
    });

    it('يرفض مبلغاً يتجاوز الحد الأقصى المعقول لعملية صرف واحدة', () => {
      memStore.set('p1', { username: 'p1', cash: 999999999999, gems: 0 });
      const result = manager.convertResource('p1', 'cash', 'gems', 999999999);
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('invalid_amount');
    });

    it('لا يخلط بين أرصدة لاعبين مختلفين', () => {
      memStore.set('p1', { username: 'p1', cash: 1000, gems: 0 });
      memStore.set('p2', { username: 'p2', cash: 5, gems: 0 });
      const result = manager.convertResource('p2', 'cash', 'gems', 1000);
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('insufficient_resource');
      expect(memStore.get('p1').cash).toBe(1000); // لم يتأثر رصيد p1
    });

    it('يقبل صرف gold→cash بالمعدل الصحيح (1 gold = 4 cash)', () => {
      memStore.set('p1', { username: 'p1', gold: 100, cash: 0 });
      const result = manager.convertResource('p1', 'gold', 'cash', 100);
      expect(result.ok).toBe(true);
      expect(result.received).toBe(400);
      expect(memStore.get('p1').gold).toBe(0);
      expect(memStore.get('p1').cash).toBe(400);
    });

    it('convertResource يجب أن تبقى دالة متزامنة تماماً بلا await', () => {
      expect(manager.convertResource.constructor.name).not.toBe('AsyncFunction');
    });
  });
});
