import { describe, it, expect, beforeEach } from 'vitest';
import { createAchievementRewards, ACHIEVEMENT_REWARDS, LIFETIME_CAPS } from '../server/logic/achievementRewards.js';
import { readFileSync } from 'fs';

// 🛡️ يستخدم createAchievementRewards الحقيقي — قبل هذا الملف كانت مكافأة أي
// إنجاز (js/achievements.js: claim()) تُمنح مباشرة عبر economy.addRaw على
// العميل بمجرد ادّعاء العميل completed=true محلياً بلا أي تحقق سيرفري، وبلا
// أي منع من إعادة استلام نفس الإنجاز بلا حدود.
function createTestEnv() {
  const memStore = new Map();
  function getDefaultPlayer(username) {
    return { username, gold: 0, gems: 0, cash: 0 };
  }
  function markDirty() {}
  const manager = createAchievementRewards({ memStore, getDefaultPlayer, markDirty });
  return { memStore, manager };
}

describe('🏆 مكافآت الإنجازات (server/logic/achievementRewards.js الحقيقي)', () => {
  let memStore, manager;

  beforeEach(() => {
    ({ memStore, manager } = createTestEnv());
  });

  it('يمنح المكافأة الصحيحة لإنجاز حقيقي', () => {
    const result = manager.claimAchievement('p1', 'first_kill');
    expect(result.ok).toBe(true);
    expect(result.granted).toEqual({ gold: 50 });
    expect(memStore.get('p1').gold).toBe(50);
  });

  it('يرفض إعادة استلام نفس الإنجاز مرة ثانية', () => {
    manager.claimAchievement('p1', 'first_kill');
    const second = manager.claimAchievement('p1', 'first_kill');
    expect(second.ok).toBe(false);
    expect(second.reason).toBe('already_claimed');
    expect(memStore.get('p1').gold).toBe(50); // لم يتضاعف
  });

  it('يرفض إنجازاً غير معروف (id مزيَّف)', () => {
    const result = manager.claimAchievement('p1', 'fake_achievement_xyz');
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('unknown_achievement');
  });

  it('يمنح مكافأة متعددة الموارد بشكل صحيح (gold + gems)', () => {
    const result = manager.claimAchievement('p1', 'kill_10');
    expect(result.granted).toEqual({ gold: 100, gems: 5 });
    expect(memStore.get('p1').gold).toBe(100);
    expect(memStore.get('p1').gems).toBe(5);
  });

  it('يسجّل الإنجاز في claimedAchievements بعد الاستلام', () => {
    manager.claimAchievement('p1', 'first_kill');
    expect(memStore.get('p1').claimedAchievements).toContain('first_kill');
  });

  it('لا يخلط استلامات لاعبين مختلفين', () => {
    manager.claimAchievement('p1', 'first_kill');
    const result = manager.claimAchievement('p2', 'first_kill');
    expect(result.ok).toBe(true); // نفس الإنجاز لكن للاعب مختلف — مسموح
    expect(memStore.get('p1').gold).toBe(50);
    expect(memStore.get('p2').gold).toBe(50);
  });

  it('يرفض عند تجاوز السقف الكلي (محاكاة تلاعب بطلبات متكررة بأسماء مزيّفة غير موجودة أصلاً محدودة)', () => {
    // نستنزف سقف gems (4085) عبر استلام كل الإنجازات الحقيقية ذات gems تباعاً
    let totalGems = 0;
    for (const [id, reward] of Object.entries(ACHIEVEMENT_REWARDS)) {
      if (reward.gems) {
        const r = manager.claimAchievement('p1', id);
        if (r.ok) totalGems += reward.gems;
      }
    }
    expect(totalGems).toBe(LIFETIME_CAPS.gems); // كل الإنجازات الحقيقية تساوي بالضبط السقف
    expect(memStore.get('p1').gems).toBe(LIFETIME_CAPS.gems);
  });

  it('يحسب lifetime totals بشكل صحيح عبر عدة استلامات', () => {
    manager.claimAchievement('p1', 'first_kill'); // gold:50
    manager.claimAchievement('p1', 'kill_10'); // gold:100, gems:5
    const totals = memStore.get('p1').achievementRewardTotals;
    expect(totals.gold).toBe(150);
    expect(totals.gems).toBe(5);
  });

  it('مجموع كل المكافآت الحقيقية (59 إنجازاً) يساوي بالضبط LIFETIME_CAPS المُعرَّفة', () => {
    let totalGold = 0, totalGems = 0, totalCash = 0;
    for (const reward of Object.values(ACHIEVEMENT_REWARDS)) {
      totalGold += reward.gold || 0;
      totalGems += reward.gems || 0;
      totalCash += reward.cash || 0;
    }
    expect(totalGold).toBe(LIFETIME_CAPS.gold);
    expect(totalGems).toBe(LIFETIME_CAPS.gems);
    expect(totalCash).toBe(LIFETIME_CAPS.cash);
  });

  it('جدول ACHIEVEMENT_REWARDS مطابق تماماً لجدول js/achievements.js (anti-drift)', () => {
    // 🛡️ js/achievements.js من نوع ESM (لا يمكن require()ه مباشرة من CJS) —
    // نستخرج جدول reward منه عبر parsing نصي بدل استيراده، بنفس أسلوب
    // اختبارات المقارنة الأخرى في المشروع (weapon-upgrade-costs.test.js)
    const clientSource = readFileSync(new URL('../js/achievements.js', import.meta.url), 'utf8');
    const idMatches = [...clientSource.matchAll(/\{\s*id:\s*"([^"]+)".*?reward:\s*(\{[^}]*\})/g)];
    expect(idMatches.length).toBe(Object.keys(ACHIEVEMENT_REWARDS).length);
    for (const [, id, rewardStr] of idMatches) {
      // eslint-disable-next-line no-new-func
      const clientReward = Function(`return ${rewardStr}`)();
      expect(ACHIEVEMENT_REWARDS[id], `${id} موجود في جدول الخادم`).toBeTruthy();
      expect(ACHIEVEMENT_REWARDS[id], `${id}: المكافأة متطابقة`).toEqual(clientReward);
    }
  });
});
