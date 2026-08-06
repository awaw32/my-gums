import { describe, it, expect, beforeEach } from 'vitest';
import {
  createBattleRoyaleRewards, MAX_GEMS_PER_DAY, MAX_GOLD_PER_DAY,
  MAX_GEMS_PER_CLAIM, MAX_GOLD_PER_CLAIM, MAX_KILLS_PER_CLAIM,
} from '../server/logic/battleRoyaleRewards.js';

// 🛡️ يستخدم createBattleRoyaleRewards الحقيقي — قبل هذا الملف كانت مكافآت
// الفوز/الإخلاء في Battle Royale تُمنح بالكامل على العميل (economy.addRaw
// مباشرة) بلا أي تحقق سيرفري، ما يعني أن استدعاء دالة الفوز من console
// المتصفح يمنح جواهر/ذهب حقيقيين فوراً بلا أي قتال فعلي. الحد الأقصى لكل
// مطالبة (MAX_*_PER_CLAIM) يمنع لاحقاً تضخيم brKills محلياً لاستنزاف كامل
// السقف اليومي بمطالبة واحدة "مباراة وهمية" بدل عدة مباريات حقيقية.
function createTestEnv() {
  const memStore = new Map();
  function getDefaultPlayer(username) {
    return { username, gems: 0, gold: 0 };
  }
  function markDirty() {}
  const manager = createBattleRoyaleRewards({ memStore, getDefaultPlayer, markDirty });
  return { memStore, manager };
}

/** يتجاوز الحد الأدنى بين الطلبات (5 ثوانٍ) بإعادة ضبط lastClaimAt يدوياً —
 *  يحاكي عدة مباريات حقيقية متتالية بدل انتظار الوقت الفعلي في الاختبار */
function bypassRateLimit(memStore, username) {
  const pData = memStore.get(username);
  if (pData?.brDailyRewards) pData.brDailyRewards.lastClaimAt = 0;
}

describe('🏆 مكافآت المعركة الملكية (server/logic/battleRoyaleRewards.js الحقيقي)', () => {
  let memStore, manager;

  beforeEach(() => {
    ({ memStore, manager } = createTestEnv());
  });

  it('يمنح المكافأة المطلوبة كاملة إن كانت ضمن حد المطالبة والحد اليومي', () => {
    const result = manager.claimReward('p1', 100, 200);
    expect(result.ok).toBe(true);
    expect(result.grantedGems).toBe(100);
    expect(result.grantedGold).toBe(200);
    expect(result.capped).toBe(false);
    expect(memStore.get('p1').gems).toBe(100);
    expect(memStore.get('p1').gold).toBe(200);
  });

  describe('حد المطالبة الواحدة (MAX_*_PER_CLAIM) — يمنع "مباراة وهمية" واحدة من استنزاف اليوم كله', () => {
    it('يقصّ الجواهر المطلوبة في مطالبة واحدة عند تجاوز حد المطالبة', () => {
      const result = manager.claimReward('p1', MAX_GEMS_PER_CLAIM + 5000, 0);
      expect(result.ok).toBe(true);
      expect(result.grantedGems).toBe(MAX_GEMS_PER_CLAIM);
      expect(result.capped).toBe(true);
    });

    it('يقصّ الذهب المطلوب في مطالبة واحدة عند تجاوز حد المطالبة', () => {
      const result = manager.claimReward('p1', 0, MAX_GOLD_PER_CLAIM + 5000);
      expect(result.ok).toBe(true);
      expect(result.grantedGold).toBe(MAX_GOLD_PER_CLAIM);
      expect(result.capped).toBe(true);
    });

    it('حد المطالبة الواحدة أقل بكثير من الحد اليومي (لا يستنزف اليوم كله دفعة واحدة)', () => {
      expect(MAX_GEMS_PER_CLAIM).toBeLessThan(MAX_GEMS_PER_DAY);
      expect(MAX_GOLD_PER_CLAIM).toBeLessThan(MAX_GOLD_PER_DAY);
    });

    it('حد القتلى المفترض لكل مطالبة معقول (لا يفوق حجم مباراة واقعية)', () => {
      expect(MAX_KILLS_PER_CLAIM).toBeGreaterThan(0);
      expect(MAX_KILLS_PER_CLAIM).toBeLessThanOrEqual(50);
    });
  });

  it('يرفض طلباً جديداً بمعدل متكرر جداً (أقل من الفاصل الأدنى بين الطلبات)', () => {
    manager.claimReward('p1', 10, 10);
    const second = manager.claimReward('p1', 10, 10);
    expect(second.ok).toBe(false);
    expect(second.reason).toBe('too_frequent');
    // 🛡️ الرصيد يجب ألا يتغير عند الرفض
    expect(memStore.get('p1').gems).toBe(10);
  });

  it('يبلغ السقف اليومي فعلياً بعد عدة مطالبات متتالية (محاكاة عدة مباريات حقيقية)', () => {
    let totalGranted = 0;
    for (let i = 0; i < 200 && totalGranted < MAX_GEMS_PER_DAY; i++) {
      bypassRateLimit(memStore, 'p1');
      const result = manager.claimReward('p1', MAX_GEMS_PER_CLAIM, 0);
      if (!result.ok) break;
      totalGranted += result.grantedGems;
    }
    expect(memStore.get('p1').gems).toBe(MAX_GEMS_PER_DAY);

    // 🛡️ الجواهر بلغت سقفها اليومي — طلب جواهر إضافية يُمنح صفراً (لا خطأ، فقط
    // 0 ممنوح) بينما الذهب يبقى غير متأثر (سقف مستقل تماماً عن سقف الجواهر)
    bypassRateLimit(memStore, 'p1');
    const moreGems = manager.claimReward('p1', 100, 0);
    expect(moreGems.ok).toBe(true);
    expect(moreGems.grantedGems).toBe(0);
    expect(moreGems.capped).toBe(true);
    expect(memStore.get('p1').gems).toBe(MAX_GEMS_PER_DAY);

    bypassRateLimit(memStore, 'p1');
    const goldStillWorks = manager.claimReward('p1', 0, 200);
    expect(goldStillWorks.ok).toBe(true);
    expect(goldStillWorks.grantedGold).toBe(200);
  });

  it('يرفض المطالبة بالكامل (daily_cap_reached) فقط عندما يبلغ كل من الجواهر والذهب سقفهما اليومي معاً', () => {
    let totalGems = 0;
    for (let i = 0; i < 200 && totalGems < MAX_GEMS_PER_DAY; i++) {
      bypassRateLimit(memStore, 'p1');
      const r = manager.claimReward('p1', MAX_GEMS_PER_CLAIM, 0);
      totalGems += r.grantedGems;
    }
    let totalGold = 0;
    for (let i = 0; i < 200 && totalGold < MAX_GOLD_PER_DAY; i++) {
      bypassRateLimit(memStore, 'p1');
      const r = manager.claimReward('p1', 0, MAX_GOLD_PER_CLAIM);
      totalGold += r.grantedGold;
    }
    expect(memStore.get('p1').gems).toBe(MAX_GEMS_PER_DAY);
    expect(memStore.get('p1').gold).toBe(MAX_GOLD_PER_DAY);

    bypassRateLimit(memStore, 'p1');
    const finalAttempt = manager.claimReward('p1', 100, 100);
    expect(finalAttempt.ok).toBe(false);
    expect(finalAttempt.reason).toBe('daily_cap_reached');
  });

  it('لا يخلط الحدود اليومية بين لاعبين مختلفين', () => {
    manager.claimReward('p1', MAX_GEMS_PER_CLAIM, 0);
    const result = manager.claimReward('p2', 500, 0);
    expect(result.ok).toBe(true);
    expect(result.grantedGems).toBe(500);
    expect(result.capped).toBe(false);
  });

  it('يعيد ضبط الحد اليومي بعد مرور 24 ساعة', () => {
    manager.claimReward('p1', MAX_GEMS_PER_CLAIM, 0);
    const pData = memStore.get('p1');
    // محاكاة مرور أكثر من يوم (ويتجاوز أيضاً الحد الأدنى بين الطلبات)
    pData.brDailyRewards.resetAt = Date.now() - 1000;
    pData.brDailyRewards.lastClaimAt = 0;
    memStore.set('p1', pData);

    const result = manager.claimReward('p1', 100, 0);
    expect(result.ok).toBe(true);
    expect(result.grantedGems).toBe(100);
    expect(result.capped).toBe(false);
  });

  it('يتجاهل قيماً سالبة أو غير رقمية من العميل (لا تمنح موارد سالبة أو NaN)', () => {
    const result = manager.claimReward('p1', -500, NaN);
    expect(result.ok).toBe(true);
    expect(result.grantedGems).toBe(0);
    expect(result.grantedGold).toBe(0);
    expect(memStore.get('p1').gems).toBe(0);
  });
});
