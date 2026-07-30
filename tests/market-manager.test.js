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
  memStore.set(username, { username, cash });
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
      const result = manager.listItem('seller1', { itemId: 'bandage', quantity: 0, pricePerUnit: 15, level: 1 });
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('invalid_data');
    });

    it('يرفض سعراً أعلى من الحد الأقصى المسموح (3x السعر المقترح)', () => {
      const suggested = manager.getSuggestedPrice('bandage', 1);
      const result = manager.listItem('seller1', { itemId: 'bandage', quantity: 1, pricePerUnit: suggested * 10, level: 1 });
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('price_out_of_range');
    });

    it('يرفض سعراً أقل من الحد الأدنى المسموح (0.5x السعر المقترح)', () => {
      const suggested = manager.getSuggestedPrice('bandage', 1);
      const result = manager.listItem('seller1', { itemId: 'bandage', quantity: 1, pricePerUnit: Math.floor(suggested * 0.1), level: 1 });
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('price_out_of_range');
    });

    it('يقبل عرضاً صحيحاً ويشتق الاسم/الأيقونة من TRADEABLE_ITEMS وليس من العميل', () => {
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
    });

    it('يرفض تجاوز الحد الأقصى لعدد العروض النشطة للاعب الواحد', () => {
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
      const suggested = manager.getSuggestedPrice('bandage', 1);
      return manager.listItem(seller, { itemId: 'bandage', quantity: 5, pricePerUnit: suggested, level: 1 }).listing;
    }

    it('يرفض إلغاء عرض ليس ملكاً للمُلغي', () => {
      const listing = listBandage('seller1');
      const result = manager.removeListing('someone_else', listing.id);
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('not_your_listing');
    });

    it('يسمح للبائع بإلغاء عرضه الخاص', () => {
      const listing = listBandage('seller1');
      const result = manager.removeListing('seller1', listing.id);
      expect(result.ok).toBe(true);
      expect(manager.getActiveListings().find(l => l.id === listing.id)).toBeUndefined();
    });

    it('لا يمس رصيد أي طرف عند الإلغاء', () => {
      const listing = listBandage('seller1');
      setCash(memStore, 'seller1', 500);
      manager.removeListing('seller1', listing.id);
      expect(memStore.get('seller1').cash).toBe(500);
    });
  });

  describe('التنظيف الدوري (cleanupExpired)', () => {
    it('يُعلِّم العروض المنتهية كمباعة ويبث إشعار انتهاء', () => {
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
    });
  });
});
