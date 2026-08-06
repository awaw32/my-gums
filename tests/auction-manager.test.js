import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createAuctionManager, LEGENDARY_ITEMS, AUCTION_DURATION_MS } from '../server/logic/auction-manager.js';

// 🛡️ يستخدم createAuctionManager الحقيقي — يحرّك ذهباً حقيقياً (memStore) عند
// انتهاء المزاد ولم يكن له أي تغطية اختبارية رغم ذلك.
function createTestEnv() {
  const worldClients = new Map();
  const memStore = new Map();
  function getDefaultPlayer(username) {
    return { username, gold: 0, gems: 0 };
  }
  function markDirty() {}
  const manager = createAuctionManager({ worldClients, memStore, getDefaultPlayer, markDirty, analytics: null });
  return { worldClients, memStore, manager };
}

function setGold(memStore, username, gold) {
  memStore.set(username, { username, gold, gems: 0 });
}

describe('🏆 مزاد الجمعة الأسطوري (server/logic/auction-manager.js الحقيقي)', () => {
  let worldClients, memStore, manager;

  beforeEach(() => {
    ({ worldClients, memStore, manager } = createTestEnv());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('حساب موعد الجمعة القادمة (nextFriday8pmKSA)', () => {
    it('يُرجع timestamp في المستقبل دائماً', () => {
      const now = Date.now();
      const next = manager.nextFriday8pmKSA(now);
      expect(next).toBeGreaterThan(now);
    });

    it('يُرجع موعداً يقع يوم جمعة الساعة 20:00 بتوقيت السعودية (UTC+3)', () => {
      const next = manager.nextFriday8pmKSA(Date.now());
      const ksaTime = new Date(next + 3 * 60 * 60 * 1000);
      expect(ksaTime.getUTCDay()).toBe(5); // الجمعة
      expect(ksaTime.getUTCHours()).toBe(20);
    });

    it('يقفز للأسبوع التالي إن كان الوقت الحالي بعد جمعة هذا الأسبوع', () => {
      // نبدأ من جمعة الساعة 20:01 بتوقيت السعودية — يجب أن يُرجع جمعة الأسبوع القادم
      const aFriday8pmKSA = manager.nextFriday8pmKSA(Date.now());
      const justAfter = aFriday8pmKSA + 60 * 1000;
      const next = manager.nextFriday8pmKSA(justAfter);
      expect(next).toBeGreaterThan(aFriday8pmKSA);
      expect(next - aFriday8pmKSA).toBe(7 * 24 * 60 * 60 * 1000);
    });
  });

  describe('بدء المزاد (startAuction)', () => {
    it('يختار عنصراً من LEGENDARY_ITEMS ويبثه للجميع', () => {
      const sent = [];
      worldClients.set('watcher', { ws: { readyState: 1, send: (m) => sent.push(JSON.parse(m)) } });
      manager.startAuction();
      const startMsg = sent.find(m => m.type === 'auction_start');
      expect(startMsg).toBeTruthy();
      expect(LEGENDARY_ITEMS.some(i => i.id === startMsg.itemId)).toBe(true);
      expect(manager.getActiveAuction()).toBeTruthy();
    });

    it('لا يبدأ مزاداً ثانياً إن كان هناك مزاد نشط بالفعل', () => {
      manager.startAuction();
      const first = manager.getActiveAuction();
      manager.startAuction();
      expect(manager.getActiveAuction().itemId).toBe(first.itemId);
      expect(manager.getActiveAuction().endsAt).toBe(first.endsAt);
    });
  });

  describe('المزايدة (placeBid)', () => {
    it('يرفض المزايدة بلا مزاد نشط', () => {
      const result = manager.placeBid('bidder1', 1000);
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('no_active_auction');
    });

    it('يرفض مزايدة أقل من الحد الأدنى (السعر الحالي + الزيادة الدنيا)', () => {
      manager.startAuction();
      const current = manager.getActiveAuction().currentBid;
      setGold(memStore, 'bidder1', 100000);
      const result = manager.placeBid('bidder1', current + 1);
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('bid_too_low');
    });

    it('يرفض مزايدة برصيد ذهب غير كافٍ', () => {
      manager.startAuction();
      setGold(memStore, 'bidder1', 1);
      const minBid = manager.getActiveAuction().currentBid + 50;
      const result = manager.placeBid('bidder1', minBid);
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('insufficient_gold');
    });

    it('لا يخصم الذهب فوراً عند المزايدة — فقط عند انتهاء المزاد', () => {
      manager.startAuction();
      setGold(memStore, 'bidder1', 100000);
      const minBid = manager.getActiveAuction().currentBid + 50;
      manager.placeBid('bidder1', minBid);
      expect(memStore.get('bidder1').gold).toBe(100000);
    });

    it('يحدّث currentBid وcurrentBidder عند مزايدة صحيحة ويبثها', () => {
      manager.startAuction();
      setGold(memStore, 'bidder1', 100000);
      const minBid = manager.getActiveAuction().currentBid + 50;
      const sent = [];
      worldClients.set('watcher', { ws: { readyState: 1, send: (m) => sent.push(JSON.parse(m)) } });
      const result = manager.placeBid('bidder1', minBid);
      expect(result.ok).toBe(true);
      expect(manager.getActiveAuction().currentBid).toBe(minBid);
      expect(manager.getActiveAuction().currentBidder).toBe('bidder1');
      expect(sent.find(m => m.type === 'auction_bid')).toBeTruthy();
    });

    it('مزايدة أعلى من لاعب آخر تحل محل السابقة', () => {
      manager.startAuction();
      setGold(memStore, 'bidder1', 100000);
      setGold(memStore, 'bidder2', 100000);
      const bid1 = manager.getActiveAuction().currentBid + 50;
      manager.placeBid('bidder1', bid1);
      const bid2 = bid1 + 50;
      manager.placeBid('bidder2', bid2);
      expect(manager.getActiveAuction().currentBidder).toBe('bidder2');
      expect(manager.getActiveAuction().currentBid).toBe(bid2);
    });
  });

  describe('انتهاء المزاد (endAuction عبر مؤقّت setTimeout الحقيقي المُجدوَل)', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    it('يخصم الذهب من الفائز فعلياً ويضيف العنصر لـ legendaryItems عند انتهاء المؤقّت', () => {
      manager.startAuction();
      const auction = manager.getActiveAuction();
      setGold(memStore, 'winner1', 100000);
      const bidAmount = auction.currentBid + 50;
      manager.placeBid('winner1', bidAmount);

      vi.advanceTimersByTime(AUCTION_DURATION_MS + 100);

      expect(memStore.get('winner1').gold).toBe(100000 - bidAmount);
      expect(memStore.get('winner1').legendaryItems).toContain(auction.itemId);
      expect(manager.getActiveAuction()).toBeNull();
    });

    it('يبث auction_end بالفائز والسعر النهائي', () => {
      manager.startAuction();
      const auction = manager.getActiveAuction();
      setGold(memStore, 'winner1', 100000);
      const bidAmount = auction.currentBid + 50;
      manager.placeBid('winner1', bidAmount);

      const sent = [];
      worldClients.set('watcher', { ws: { readyState: 1, send: (m) => sent.push(JSON.parse(m)) } });
      vi.advanceTimersByTime(AUCTION_DURATION_MS + 100);

      const endMsg = sent.find(m => m.type === 'auction_end');
      expect(endMsg).toBeTruthy();
      expect(endMsg.winner).toBe('winner1');
      expect(endMsg.finalBid).toBe(bidAmount);
    });

    it('لا يمنح العنصر لأحد إن لم تكن هناك أي مزايدة', () => {
      manager.startAuction();
      const sent = [];
      worldClients.set('watcher', { ws: { readyState: 1, send: (m) => sent.push(JSON.parse(m)) } });
      vi.advanceTimersByTime(AUCTION_DURATION_MS + 100);
      const endMsg = sent.find(m => m.type === 'auction_end');
      expect(endMsg.winner).toBeNull();
      expect(manager.getActiveAuction()).toBeNull();
    });

    it('يمسح كل حاملي التذاكر بعد انتهاء المزاد (تُشترى من جديد كل أسبوع)', () => {
      memStore.set('p1', { username: 'p1', gems: 100, gold: 0 });
      manager.buyTicket('p1');
      expect(manager.hasTicket('p1')).toBe(true);
      manager.startAuction();
      vi.advanceTimersByTime(AUCTION_DURATION_MS + 100);
      expect(manager.hasTicket('p1')).toBe(false);
    });
  });

  describe('تذاكر المزاد (buyTicket / hasTicket)', () => {
    it('يرفض شراء تذكرة برصيد جواهر غير كافٍ', () => {
      memStore.set('p1', { username: 'p1', gems: 5 });
      const result = manager.buyTicket('p1');
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('insufficient_gems');
    });

    it('يخصم 10 جواهر فعلياً عند شراء تذكرة صحيحة', () => {
      memStore.set('p1', { username: 'p1', gems: 20 });
      const result = manager.buyTicket('p1');
      expect(result.ok).toBe(true);
      expect(memStore.get('p1').gems).toBe(10);
      expect(manager.hasTicket('p1')).toBe(true);
    });

    it('يرفض شراء تذكرة ثانية لنفس اللاعب في نفس الأسبوع', () => {
      memStore.set('p1', { username: 'p1', gems: 100 });
      manager.buyTicket('p1');
      const result = manager.buyTicket('p1');
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('already_have_ticket');
    });

    it('التذكرة لا تمنح أي أفضلية في المزايدة نفسها (راحة فقط)', () => {
      memStore.set('p1', { username: 'p1', gems: 100, gold: 100000 });
      manager.buyTicket('p1');
      manager.startAuction();
      const minBid = manager.getActiveAuction().currentBid + 50;
      const result = manager.placeBid('p1', minBid);
      // نفس شروط أي لاعب آخر — لا خصم على السعر ولا أفضلية
      expect(result.ok).toBe(true);
      expect(manager.getActiveAuction().currentBid).toBe(minBid);
    });
  });

  describe('🛡️ حارس ضد race condition مستقبلي (double-spend)', () => {
    it('placeBid يجب أن تبقى دالة متزامنة (synchronous) تماماً بلا await', () => {
      // حماية double-spend في placeBid تعتمد بالكامل على أنها متزامنة صرفة —
      // أي تحويل مستقبلي لـ async/await دون قفل صريح يفتح نافذة سباق حقيقية
      // تسمح بمزايدتين متزامنتين من رصيد واحد. هذا الاختبار يفشل فوراً إن
      // حدث ذلك، كتذكير إلزامي لإضافة قفل أولاً.
      expect(manager.placeBid.constructor.name).not.toBe('AsyncFunction');
      manager.startAuction();
      setGold(memStore, 'p1', 100000);
      const result = manager.placeBid('p1', manager.getActiveAuction().currentBid + 50);
      expect(result).not.toBeInstanceOf(Promise);
      expect(result.ok).toBe(true);
    });
  });
});
