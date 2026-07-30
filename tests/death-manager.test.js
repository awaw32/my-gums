import { describe, it, expect, beforeEach } from 'vitest';
import { createDeathManager, GOLD_LOSS_PERCENT, WATER_LOSS_PERCENT } from '../server/logic/death-manager.js';

// 🛡️ يستخدم createDeathManager الحقيقي — يخصم ذهباً/ماءً حقيقياً من memStore
// وينشئ صناديق غنيمة قابلة للاستلام من لاعبين آخرين، ولم يكن له أي تغطية
// اختبارية رغم أنه يحرّك اقتصاد اللعبة مباشرة عند كل موت خارج الواحة.
const SAFE_ZONE = { x: 1080, y: 1080, w: 240, h: 240 }; // مطابق لما في server.js

function createTestEnv() {
  const worldClients = new Map();
  const memStore = new Map();
  function getDefaultPlayer(username) {
    return { username, gold: 0, water: 100 };
  }
  function markDirty() {}
  const manager = createDeathManager({ worldClients, memStore, getDefaultPlayer, markDirty, SAFE_ZONE, analytics: null });
  return { worldClients, memStore, manager };
}

function setPlayer(memStore, username, data) {
  memStore.set(username, { username, gold: 0, water: 100, ...data });
}

function addClient(worldClients, username, x, y) {
  worldClients.set(username, { username, x, y, ws: { readyState: 1, send: () => {} } });
}

describe('💀 عقوبة الموت خارج الواحة (server/logic/death-manager.js الحقيقي)', () => {
  let worldClients, memStore, manager;

  beforeEach(() => {
    ({ worldClients, memStore, manager } = createTestEnv());
  });

  describe('الموت داخل المنطقة الآمنة', () => {
    it('لا يفرض أي عقوبة عند الموت داخل الواحة الآمنة', () => {
      setPlayer(memStore, 'p1', { gold: 1000, water: 100 });
      const result = manager.handlePlayerDeath('p1', SAFE_ZONE.x + 10, SAFE_ZONE.y + 10);
      expect(result.ok).toBe(true);
      expect(result.penalized).toBe(false);
      expect(memStore.get('p1').gold).toBe(1000);
      expect(memStore.get('p1').water).toBe(100);
    });

    it('isInSafeZone يتحقق بشكل صحيح من حدود المنطقة', () => {
      expect(manager.isInSafeZone(SAFE_ZONE.x, SAFE_ZONE.y)).toBe(true);
      expect(manager.isInSafeZone(SAFE_ZONE.x + SAFE_ZONE.w, SAFE_ZONE.y + SAFE_ZONE.h)).toBe(true);
      expect(manager.isInSafeZone(SAFE_ZONE.x - 1, SAFE_ZONE.y)).toBe(false);
      expect(manager.isInSafeZone(0, 0)).toBe(false);
    });
  });

  describe('الموت خارج المنطقة الآمنة — العقوبة', () => {
    it('يخصم 15% من الذهب فعلياً من memStore', () => {
      setPlayer(memStore, 'p1', { gold: 1000, water: 100 });
      const result = manager.handlePlayerDeath('p1', 0, 0);
      expect(result.ok).toBe(true);
      expect(result.penalized).toBe(true);
      expect(result.goldLost).toBe(Math.floor(1000 * GOLD_LOSS_PERCENT));
      expect(memStore.get('p1').gold).toBe(1000 - Math.floor(1000 * GOLD_LOSS_PERCENT));
    });

    it('يخصم 50% من الماء فعلياً', () => {
      setPlayer(memStore, 'p1', { gold: 1000, water: 100 });
      manager.handlePlayerDeath('p1', 0, 0);
      expect(memStore.get('p1').water).toBe(Math.floor(100 * (1 - WATER_LOSS_PERCENT)));
    });

    it('لا ينشئ صندوقاً ولا يُعلَّم كمعاقَب إن كان اللاعب بلا ذهب أصلاً', () => {
      setPlayer(memStore, 'p1', { gold: 0, water: 100 });
      const result = manager.handlePlayerDeath('p1', 0, 0);
      expect(result.penalized).toBe(false);
      expect(manager.getActiveCrates()).toHaveLength(0);
    });

    it('ينشئ صندوق غنيمة عند خسارة ذهب حقيقية ويبثه للجميع', () => {
      setPlayer(memStore, 'p1', { gold: 1000, water: 100 });
      const sent = [];
      worldClients.set('watcher', { ws: { readyState: 1, send: (m) => sent.push(JSON.parse(m)) } });
      const result = manager.handlePlayerDeath('p1', 500, 500);
      expect(result.crateId).toBeTruthy();
      const crates = manager.getActiveCrates();
      expect(crates).toHaveLength(1);
      expect(crates[0].ownerId).toBe('p1');
      expect(crates[0].goldLost).toBe(result.goldLost);
      const spawnMsg = sent.find(m => m.type === 'death_crate_spawn');
      expect(spawnMsg).toBeTruthy();
      expect(spawnMsg.goldLost).toBe(result.goldLost);
    });
  });

  describe('استلام الصندوق (claimCrate)', () => {
    it('يرفض استلام صندوق غير موجود', () => {
      const result = manager.claimCrate('p2', 'fake_crate');
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('crate_not_found');
    });

    it('يرفض الاستلام إن كان اللاعب غير متصل (لا إحداثيات موثوقة)', () => {
      setPlayer(memStore, 'p1', { gold: 1000 });
      const { crateId } = manager.handlePlayerDeath('p1', 500, 500);
      const result = manager.claimCrate('p2_not_connected', crateId);
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('not_connected');
    });

    it('يرفض الاستلام من مسافة بعيدة (يعتمد على إحداثيات الخادم الموثوقة)', () => {
      setPlayer(memStore, 'p1', { gold: 1000 });
      const { crateId } = manager.handlePlayerDeath('p1', 500, 500);
      addClient(worldClients, 'p2', 2000, 2000); // بعيد جداً
      const result = manager.claimCrate('p2', crateId);
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('too_far');
    });

    it('يضيف الذهب فعلياً للمستلم القريب ويحذف الصندوق', () => {
      setPlayer(memStore, 'p1', { gold: 1000 });
      const { crateId, goldLost } = manager.handlePlayerDeath('p1', 500, 500);
      setPlayer(memStore, 'p2', { gold: 50 });
      addClient(worldClients, 'p2', 510, 510); // قريب (ضمن CLAIM_RADIUS=60)
      const result = manager.claimCrate('p2', crateId);
      expect(result.ok).toBe(true);
      expect(result.goldGained).toBe(goldLost);
      expect(memStore.get('p2').gold).toBe(50 + goldLost);
      expect(manager.getActiveCrates()).toHaveLength(0);
    });

    it('لا يمكن استلام نفس الصندوق مرتين', () => {
      setPlayer(memStore, 'p1', { gold: 1000 });
      const { crateId } = manager.handlePlayerDeath('p1', 500, 500);
      setPlayer(memStore, 'p2', { gold: 0 });
      addClient(worldClients, 'p2', 510, 510);
      manager.claimCrate('p2', crateId);
      const second = manager.claimCrate('p2', crateId);
      expect(second.ok).toBe(false);
      expect(second.reason).toBe('crate_not_found');
    });

    it('صاحب الصندوق نفسه يمكنه استلامه إن كان قريباً', () => {
      setPlayer(memStore, 'p1', { gold: 1000 });
      const { crateId, goldLost } = manager.handlePlayerDeath('p1', 500, 500);
      addClient(worldClients, 'p1', 505, 505);
      const result = manager.claimCrate('p1', crateId);
      expect(result.ok).toBe(true);
      expect(memStore.get('p1').gold).toBe((1000 - goldLost) + goldLost);
    });
  });

  describe('التأمين على الصندوق (insureCrate)', () => {
    it('يرفض التأمين من غير صاحب الصندوق', () => {
      setPlayer(memStore, 'p1', { gold: 1000 });
      const { crateId } = manager.handlePlayerDeath('p1', 500, 500);
      setPlayer(memStore, 'p2', { gold: 1000 });
      const result = manager.insureCrate('p2', crateId);
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('not_owner');
    });

    it('يرفض التأمين برصيد ذهب غير كافٍ', () => {
      setPlayer(memStore, 'p1', { gold: 1000 });
      const { crateId } = manager.handlePlayerDeath('p1', 500, 500);
      // بعد خصم عقوبة الموت (15%)، نُفرغ رصيده تماماً حتى لا يكفي للتأمين
      memStore.get('p1').gold = 10;
      const result = manager.insureCrate('p1', crateId);
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('insufficient_gold');
    });

    it('يخصم تكلفة التأمين فعلياً من ذهب اللعبة العادي (وليس جواهر) ويُخفي الصندوق عن الآخرين', () => {
      setPlayer(memStore, 'p1', { gold: 1000 });
      const { crateId } = manager.handlePlayerDeath('p1', 500, 500);
      const goldBeforeInsurance = memStore.get('p1').gold;
      const result = manager.insureCrate('p1', crateId);
      expect(result.ok).toBe(true);
      expect(memStore.get('p1').gold).toBe(goldBeforeInsurance - 50);

      // صندوق مؤمَّن: صاحبه يقدر يستلمه، لاعب آخر لا يقدر (crate_not_found له تحديداً)
      addClient(worldClients, 'other', 505, 505);
      const otherAttempt = manager.claimCrate('other', crateId);
      expect(otherAttempt.ok).toBe(false);
      expect(otherAttempt.reason).toBe('crate_not_found');

      addClient(worldClients, 'p1', 505, 505);
      const ownerAttempt = manager.claimCrate('p1', crateId);
      expect(ownerAttempt.ok).toBe(true);
    });

    it('يرفض تأمين صندوق مؤمَّن بالفعل', () => {
      setPlayer(memStore, 'p1', { gold: 1000 });
      const { crateId } = manager.handlePlayerDeath('p1', 500, 500);
      manager.insureCrate('p1', crateId);
      const second = manager.insureCrate('p1', crateId);
      expect(second.ok).toBe(false);
      expect(second.reason).toBe('already_insured');
    });
  });
});
