import { describe, it, expect, beforeEach } from 'vitest';
import { createBattleRoyaleRewards, MAX_GEMS_PER_DAY, MAX_GOLD_PER_DAY } from '../server/logic/battleRoyaleRewards.js';

// 🛡️ يستخدم createBattleRoyaleRewards الحقيقي — قبل هذا الملف كانت مكافآت
// الفوز/الإخلاء في Battle Royale تُمنح بالكامل على العميل (economy.addRaw
// مباشرة) بلا أي تحقق سيرفري، ما يعني أن استدعاء دالة الفوز من console
// المتصفح يمنح جواهر/ذهب حقيقيين فوراً بلا أي قتال فعلي.
function createTestEnv() {
  const memStore = new Map();
  function getDefaultPlayer(username) {
    return { username, gems: 0, gold: 0 };
  }
  function markDirty() {}
  const manager = createBattleRoyaleRewards({ memStore, getDefaultPlayer, markDirty });
  return { memStore, manager };
}

describe('🏆 مكافآت المعركة الملكية (server/logic/battleRoyaleRewards.js الحقيقي)', () => {
  let memStore, manager;

  beforeEach(() => {
    ({ memStore, manager } = createTestEnv());
  });

  it('يمنح المكافأة المطلوبة كاملة إن كانت ضمن الحد اليومي', () => {
    const result = manager.claimReward('p1', 100, 200);
    expect(result.ok).toBe(true);
    expect(result.grantedGems).toBe(100);
    expect(result.grantedGold).toBe(200);
    expect(result.capped).toBe(false);
    expect(memStore.get('p1').gems).toBe(100);
    expect(memStore.get('p1').gold).toBe(200);
  });

  it('يقصّ (clamp) المكافأة عند تجاوز الحد الأقصى اليومي للجواهر', () => {
    const result = manager.claimReward('p1', MAX_GEMS_PER_DAY + 500, 0);
    expect(result.ok).toBe(true);
    expect(result.grantedGems).toBe(MAX_GEMS_PER_DAY);
    expect(result.capped).toBe(true);
    expect(memStore.get('p1').gems).toBe(MAX_GEMS_PER_DAY);
  });

  it('يقصّ المكافأة عند تجاوز الحد الأقصى اليومي للذهب', () => {
    const result = manager.claimReward('p1', 0, MAX_GOLD_PER_DAY + 1000);
    expect(result.ok).toBe(true);
    expect(result.grantedGold).toBe(MAX_GOLD_PER_DAY);
    expect(result.capped).toBe(true);
  });

  it('يرفض طلباً جديداً بمعدل متكرر جداً (أقل من الفاصل الأدنى بين الطلبات)', () => {
    manager.claimReward('p1', 10, 10);
    const second = manager.claimReward('p1', 10, 10);
    expect(second.ok).toBe(false);
    expect(second.reason).toBe('too_frequent');
    // 🛡️ الرصيد يجب ألا يتغير عند الرفض
    expect(memStore.get('p1').gems).toBe(10);
  });

  it('يرفض بلا منح شيء بعد بلوغ السقف اليومي بالكامل على المحورين', () => {
    manager.claimReward('p1', MAX_GEMS_PER_DAY, MAX_GOLD_PER_DAY);
    const pData = memStore.get('p1');
    // إعادة ضبط lastClaimAt يدوياً لتفادي رفض too_frequent في هذا الاختبار
    pData.brDailyRewards.lastClaimAt = 0;
    memStore.set('p1', pData);

    const result = manager.claimReward('p1', 100, 100);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('daily_cap_reached');
    expect(memStore.get('p1').gems).toBe(MAX_GEMS_PER_DAY);
    expect(memStore.get('p1').gold).toBe(MAX_GOLD_PER_DAY);
  });

  it('لا يخلط الحدود اليومية بين لاعبين مختلفين', () => {
    manager.claimReward('p1', MAX_GEMS_PER_DAY, 0);
    const result = manager.claimReward('p2', 500, 0);
    expect(result.ok).toBe(true);
    expect(result.grantedGems).toBe(500);
    expect(result.capped).toBe(false);
  });

  it('يعيد ضبط الحد اليومي بعد مرور 24 ساعة', () => {
    manager.claimReward('p1', MAX_GEMS_PER_DAY, 0);
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
