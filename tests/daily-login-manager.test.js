import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createDailyLoginManager, DAILY_REWARDS, STREAK_MILESTONES } from '../server/logic/dailyLoginManager.js';

// 🛡️ يستخدم createDailyLoginManager الحقيقي (وليس محاكاة) — قبل هذا الملف كانت
// كل حسابات المكافأة اليومية تتم بالكامل على العميل بلا أي تحقق سيرفري، بما
// يعني أن تلاعباً بـ lastClaimDate/streak في localStorage يمنح موارد غير
// محدودة يومياً دون أن يرصده الخادم.
function createTestEnv() {
  const memStore = new Map();
  function getDefaultPlayer(username) {
    return { username, cash: 0, gold: 0, gems: 0, food: 0 };
  }
  function markDirty() {}
  const manager = createDailyLoginManager({ memStore, getDefaultPlayer, markDirty });
  return { memStore, manager };
}

describe('🏛️ مجلس الشيوخ (server/logic/dailyLoginManager.js الحقيقي)', () => {
  let memStore, manager;

  beforeEach(() => {
    ({ memStore, manager } = createTestEnv());
    vi.useRealTimers();
  });

  it('يمنح مكافأة اليوم الأول (مع بونص +5% للسلسلة يوم واحد) عند أول استلام لاعب جديد', () => {
    const result = manager.claim('p1');
    expect(result.ok).toBe(true);
    expect(result.currentDay).toBe(1);
    expect(result.streak).toBe(1);
    const expectedGold = Math.floor(DAILY_REWARDS[0].reward.gold * 1.05); // streak=1 → +5%
    expect(result.granted.gold).toBe(expectedGold);
    expect(memStore.get('p1').gold).toBe(expectedGold);
  });

  it('يرفض استلاماً ثانياً في نفس اليوم (لا يمكن مضاعفة المكافأة بإعادة الطلب)', () => {
    manager.claim('p1');
    const goldAfterFirst = memStore.get('p1').gold;
    const second = manager.claim('p1');
    expect(second.ok).toBe(false);
    expect(second.reason).toBe('already_claimed');
    expect(memStore.get('p1').gold).toBe(goldAfterFirst);
  });

  it('يحفظ lastClaimDate/streak في memStore.dailyLogin — لا يعتمد على العميل', () => {
    manager.claim('p1');
    const state = memStore.get('p1').dailyLogin;
    expect(state.lastClaimDate).toBe(new Date().toDateString());
    expect(state.streak).toBe(1);
    expect(state.currentDay).toBe(1);
  });

  it('claim لا يقبل أي وسيطة من العميل — الحالة الوحيدة الموثوقة هي memStore', () => {
    // توقيع claim(username) لا يقبل حتى محاولة تمرير lastClaimDate/streak مزيّفة؛
    // النتيجة تعتمد فقط على ما هو محفوظ فعلياً في memStore لهذا المستخدم
    memStore.set('p1', { username: 'p1', cash: 0, gold: 999999, gems: 0 });
    const result = manager.claim('p1', { lastClaimDate: '2000-01-01', streak: 9999 });
    expect(result.ok).toBe(true);
    expect(result.currentDay).toBe(1); // لا حالة سابقة فعلية في memStore — يبدأ من اليوم 1
    expect(result.streak).toBe(1);
  });

  it('يزيد اليوم والسلسلة بشكل صحيح عبر أيام متتالية', () => {
    const day1 = manager.claim('p1');
    expect(day1.currentDay).toBe(1);
    // محاكاة يوم تالٍ عبر التلاعب المباشر بـ lastClaimDate المخزّن سيرفرياً
    const pData = memStore.get('p1');
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toDateString();
    pData.dailyLogin.lastClaimDate = yesterday;
    memStore.set('p1', pData);

    const day2 = manager.claim('p1');
    expect(day2.ok).toBe(true);
    expect(day2.currentDay).toBe(2);
    expect(day2.streak).toBe(2);
  });

  it('ينكسر التتابع (streak يعود لـ1) إذا فات أكثر من يوم واحد، ويُفقد لقب الوفي', () => {
    manager.claim('p1');
    const pData = memStore.get('p1');
    pData.dailyLogin.loyalTitleEarned = true;
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toDateString();
    pData.dailyLogin.lastClaimDate = threeDaysAgo;
    memStore.set('p1', pData);

    const result = manager.claim('p1');
    expect(result.ok).toBe(true);
    expect(result.streak).toBe(1);
    expect(result.currentDay).toBe(1);
    expect(result.loyalTitleLost).toBe(true);
    expect(result.loyalTitleEarned).toBe(false);
  });

  it('يطبّق مضاعف السلسلة (streakBonusPercent) على المكافأة الممنوحة', () => {
    const pData = { username: 'p1', cash: 0, gold: 0, gems: 0,
      dailyLogin: { currentDay: 3, lastClaimDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toDateString(), streak: 3, claimedMilestones: [], loyalTitleEarned: false } };
    memStore.set('p1', pData);
    const result = manager.claim('p1');
    // اليوم 4 (streak=4) → بونص 20% على مكافأة اليوم 4 (250 ذهب)
    const expectedGold = Math.floor(DAILY_REWARDS[3].reward.gold * 1.2);
    expect(result.granted.gold).toBe(expectedGold);
  });

  it('يمنح مكافأة معلم السلسلة (streak milestone) مرة واحدة فقط عند بلوغه', () => {
    const pData = { username: 'p1', cash: 0, gold: 0, gems: 0,
      dailyLogin: { currentDay: 6, lastClaimDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toDateString(), streak: 6, claimedMilestones: [], loyalTitleEarned: false } };
    memStore.set('p1', pData);
    const result = manager.claim('p1'); // streak يصبح 7 — أول معلم
    expect(result.milestone).toEqual({ streak: 7, gems: STREAK_MILESTONES[0].gems });
    expect(memStore.get('p1').dailyLogin.claimedMilestones).toContain(7);

    // محاكاة يوم آخر — لا يجب منح نفس المعلم مرة أخرى
    const pData2 = memStore.get('p1');
    pData2.dailyLogin.lastClaimDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toDateString();
    memStore.set('p1', pData2);
    const result2 = manager.claim('p1');
    expect(result2.milestone).toBeNull();
  });

  it('يمنح لقب الوفي عند استلام صندوق اليوم السابع الأسطوري', () => {
    const pData = { username: 'p1', cash: 0, gold: 0, gems: 0,
      dailyLogin: { currentDay: 6, lastClaimDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toDateString(), streak: 6, claimedMilestones: [], loyalTitleEarned: false } };
    memStore.set('p1', pData);
    const result = manager.claim('p1');
    expect(result.currentDay).toBe(7);
    expect(result.loyalTitleEarned).toBe(true);
  });

  it('لا يخلط بين حسابات لاعبين مختلفين', () => {
    manager.claim('p1');
    manager.claim('p2');
    expect(memStore.get('p1').dailyLogin.streak).toBe(1);
    expect(memStore.get('p2').dailyLogin.streak).toBe(1);
    expect(memStore.get('p1').gold).not.toBe(memStore.get('p2').gems);
  });
});
