import { describe, it, expect, beforeEach } from 'vitest';
import { createPveModeRewards, MODE_LIMITS, DAILY_CAPS, ALLIANCE_RAID_REWARDS } from '../server/logic/pveModeRewards.js';

// 🛡️ يستخدم createPveModeRewards الحقيقي — قبل هذا الملف كانت مكافآت Horde/
// Cave/Extraction وغارات التحالف تُمنح بالكامل على العميل (economy.addRaw
// مباشرة عند استدعاء دالة الانتهاء)، ما يعني أن استدعاء تلك الدوال من console
// المتصفح مباشرة يمنح موارد حقيقية فوراً بلا أي لعب فعلي، وبلا حدود تكرار.
function createTestEnv() {
  const memStore = new Map();
  function getDefaultPlayer(username) {
    return { username, gold: 0, cash: 0, gems: 0, artifacts: 0, desertGem: 0, xp: 0 };
  }
  function markDirty() {}
  const manager = createPveModeRewards({ memStore, getDefaultPlayer, markDirty });
  return { memStore, manager };
}

describe('🛡️ مكافآت أوضاع PvE الفردية (server/logic/pveModeRewards.js الحقيقي)', () => {
  let memStore, manager;

  beforeEach(() => {
    ({ memStore, manager } = createTestEnv());
  });

  describe('Horde/Cave/Extraction (claimModeReward)', () => {
    it('يمنح المكافأة المطلوبة كاملة إن كانت ضمن الحد اليومي وبيانات معقولة', () => {
      const result = manager.claimModeReward('p1', 'horde', { gold: 500, xp: 200, wave: 10, kills: 50 });
      expect(result.ok).toBe(true);
      expect(result.grantedGold).toBe(500);
      expect(result.grantedXp).toBe(200);
      expect(memStore.get('p1').gold).toBe(500);
    });

    it('يرفض بيانات Horde مستحيلة فيزيائياً (wave أكبر من الحد الأقصى)', () => {
      const result = manager.claimModeReward('p1', 'horde', { gold: 100, wave: MODE_LIMITS.horde.maxWave + 1, kills: 10 });
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('implausible_data');
      expect(memStore.get('p1')).toBeUndefined();
    });

    it('يرفض بيانات Cave مستحيلة فيزيائياً (depth أكبر من الحد الأقصى)', () => {
      const result = manager.claimModeReward('p1', 'cave', { gold: 100, depth: MODE_LIMITS.cave.maxDepth + 5 });
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('implausible_data');
    });

    it('يرفض بيانات Extraction مستحيلة فيزيائياً (deposited أكبر من الحد الأقصى)', () => {
      const result = manager.claimModeReward('p1', 'extraction', { gold: 100, deposited: MODE_LIMITS.extraction.maxDeposited + 1 });
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('implausible_data');
    });

    it('يرفض وضعاً غير معروف', () => {
      const result = manager.claimModeReward('p1', 'unknown_mode', { gold: 100 });
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('unknown_mode');
    });

    it('يقصّ (clamp) المكافأة عند تجاوز الحد الأقصى اليومي', () => {
      const result = manager.claimModeReward('p1', 'horde', { gold: DAILY_CAPS.horde.gold + 5000, wave: 5, kills: 20 });
      expect(result.ok).toBe(true);
      expect(result.grantedGold).toBe(DAILY_CAPS.horde.gold);
      expect(result.capped).toBe(true);
    });

    it('يرفض طلباً متكرراً بمعدل أسرع من الحد الأدنى بين الطلبات', () => {
      manager.claimModeReward('p1', 'horde', { gold: 10, wave: 1, kills: 1 });
      const second = manager.claimModeReward('p1', 'horde', { gold: 10, wave: 1, kills: 1 });
      expect(second.ok).toBe(false);
      expect(second.reason).toBe('too_frequent');
    });

    it('الحدود اليومية منفصلة لكل وضع (horde لا يستهلك سقف cave)', () => {
      const pData = { username: 'p1', gold: 0, pveDailyRewards: { resetAt: Date.now() + 86400000, lastClaimAt: 0, totals: { horde: { gold: DAILY_CAPS.horde.gold } } } };
      memStore.set('p1', pData);
      const result = manager.claimModeReward('p1', 'cave', { gold: 100, depth: 1 });
      expect(result.ok).toBe(true);
      expect(result.grantedGold).toBe(100);
    });

    it('لا يمنح موارد سالبة أو NaN من مدخلات خبيثة', () => {
      const result = manager.claimModeReward('p1', 'horde', { gold: -500, xp: NaN, wave: 1, kills: 1 });
      expect(result.ok).toBe(false); // لا شيء يُمنح فعلياً (0/0) → daily_cap_reached
      expect(memStore.get('p1')?.gold || 0).toBe(0);
    });
  });

  describe('غارات التحالف (claimAllianceRaidReward)', () => {
    it('يمنح جدول المكافآت الثابت للمستوى المطلوب', () => {
      const result = manager.claimAllianceRaidReward('p1', 1);
      expect(result.ok).toBe(true);
      expect(result.granted).toEqual(ALLIANCE_RAID_REWARDS[0]);
      expect(memStore.get('p1').cash).toBe(ALLIANCE_RAID_REWARDS[0].cash);
    });

    it('يمنح مكافأة الغارة الأعلى (250,000 cash) عند طلب صحيح', () => {
      const result = manager.claimAllianceRaidReward('p1', 4);
      expect(result.ok).toBe(true);
      expect(result.granted.cash).toBe(250000);
    });

    it('يرفض مستوى غارة غير صالح (خارج النطاق)', () => {
      const result = manager.claimAllianceRaidReward('p1', 99);
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('invalid_raid_level');
    });

    it('يرفض مستوى غارة صفر أو سالب', () => {
      const result = manager.claimAllianceRaidReward('p1', 0);
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('invalid_raid_level');
    });

    it('لا يقبل جدول مكافأة حر من العميل — فقط raidLevel كرقم', () => {
      // حتى لو كانت الدالة تستقبل فقط raidLevel، نتأكد أن أي محاولة تمرير
      // كائن مكافأة بدلاً من رقم تُرفض (يُحوَّل NaN)
      const result = manager.claimAllianceRaidReward('p1', { cash: 999999999 });
      expect(result.ok).toBe(false);
    });

    it('يقصّ عند تجاوز الحد الأقصى اليومي للغارات', () => {
      manager.claimAllianceRaidReward('p1', 4); // 250000 cash
      const pData = memStore.get('p1');
      pData.pveDailyRewards.lastClaimAt = 0; // تجاوز too_frequent لهذا الاختبار
      memStore.set('p1', pData);
      const result = manager.claimAllianceRaidReward('p1', 4);
      expect(result.ok).toBe(true);
      expect(result.granted.cash).toBe(DAILY_CAPS.alliance_raid.cash - 250000);
      expect(result.capped).toBe(true);
    });
  });
});
