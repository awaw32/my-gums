import { describe, it, expect, beforeEach } from 'vitest';
import { QuestManager } from '../js/quests.js';

// 🛡️ قبل هذا الإصلاح: allianceMissions لم يكن لها أي كود يزيد progress
// إطلاقاً — عالقة دائماً عند 0/3 لكل لاعب ينضم لتحالف. الآن progress يُغذَّى
// من contributionCount السيرفري الحقيقي (server/logic/allianceManager.js)
// عبر updateProgress()، والاستلام لا يمنح الموارد محلياً أبداً قبل تأكيد
// الخادم (claim/_handleClaimResponse، نفس نمط achievements.js).

function makeEconomy() {
  const resources = { gold: 0, gems: 0, cash: 0 };
  return {
    resources,
    addRaw(res, amt) { resources[res] = (resources[res] || 0) + amt; },
  };
}

describe('🤝 QuestManager — مهام التحالف (js/quests.js)', () => {
  let economy, quests;

  beforeEach(() => {
    economy = makeEconomy();
    quests = new QuestManager(economy, {}, {});
  });

  it('يبدأ بمهمة alliance_1 عند progress=0', () => {
    const missions = quests.getAllianceMissions();
    expect(missions).toHaveLength(1);
    expect(missions[0].id).toBe('alliance_1');
    expect(missions[0].progress).toBe(0);
  });

  it('updateProgress يحدّث تقدّم المهمة المطابقة فقط', () => {
    quests.updateProgress('alliance_1', 2);
    expect(quests.getAllianceMissions()[0].progress).toBe(2);
    expect(quests.getAllianceMissions()[0].completed).toBeFalsy();
  });

  it('updateProgress يُكمل المهمة عند بلوغ الهدف', () => {
    quests.updateProgress('alliance_1', 3);
    const mission = quests.getAllianceMissions()[0];
    expect(mission.progress).toBe(3);
    expect(mission.completed).toBe(true);
  });

  it('updateProgress لا يتجاوز الهدف حتى لو أُرسلت قيمة أكبر', () => {
    quests.updateProgress('alliance_1', 999);
    expect(quests.getAllianceMissions()[0].progress).toBe(3);
  });

  it('updateProgress يتجاهل بصمت معرّف مهمة غير معروف', () => {
    expect(() => quests.updateProgress('unknown_mission', 5)).not.toThrow();
  });

  it('claim يرفض الاستلام قبل اكتمال التقدّم', () => {
    const fakeAllianceManager = { claimMission: () => {} };
    const result = quests.claim('alliance_1', fakeAllianceManager);
    expect(result).toBe(false);
  });

  it('claim يرسل الطلب للخادم فقط بعد اكتمال التقدّم — لا يمنح شيئاً محلياً', () => {
    quests.updateProgress('alliance_1', 3);
    let sentMissionId = null;
    const fakeAllianceManager = { claimMission: (id) => { sentMissionId = id; } };
    const result = quests.claim('alliance_1', fakeAllianceManager);
    expect(result).toBe(true);
    expect(sentMissionId).toBe('alliance_1');
    expect(economy.resources.gold).toBe(0); // لم يُمنح شيء بعد — بانتظار رد الخادم
  });

  it('claim يرفض إرسال طلب مكرر أثناء انتظار رد سابق لنفس المهمة', () => {
    quests.updateProgress('alliance_1', 3);
    let callCount = 0;
    const fakeAllianceManager = { claimMission: () => { callCount++; } };
    quests.claim('alliance_1', fakeAllianceManager);
    quests.claim('alliance_1', fakeAllianceManager);
    expect(callCount).toBe(1);
  });

  it('_handleClaimResponse يمنح الموارد فقط بعد تأكيد الخادم (ok:true)', () => {
    quests.updateProgress('alliance_1', 3);
    quests.claim('alliance_1', { claimMission: () => {} });
    quests._handleClaimResponse({ ok: true, missionId: 'alliance_1', granted: { gold: 300 } });
    expect(economy.resources.gold).toBe(300);
    expect(quests.getAllianceMissions()[0].claimed).toBe(true);
  });

  it('_handleClaimResponse لا يمنح شيئاً عند رفض الخادم (ok:false)', () => {
    quests.updateProgress('alliance_1', 3);
    quests.claim('alliance_1', { claimMission: () => {} });
    quests._handleClaimResponse({ ok: false, missionId: 'alliance_1', reason: 'progress_incomplete' });
    expect(economy.resources.gold).toBe(0);
    expect(quests.getAllianceMissions()[0].claimed).toBeFalsy();
  });

  it('claim يرفض الاستلام مرة ثانية بعد نجاح الاستلام فعلياً', () => {
    quests.updateProgress('alliance_1', 3);
    quests.claim('alliance_1', { claimMission: () => {} });
    quests._handleClaimResponse({ ok: true, missionId: 'alliance_1', granted: { gold: 300 } });
    const result = quests.claim('alliance_1', { claimMission: () => {} });
    expect(result).toBe(false);
    expect(economy.resources.gold).toBe(300); // لم يُمنح مرة ثانية
  });

  it('getSaveData/loadState يحافظان على التقدّم والاستلام عبر إعادة التحميل', () => {
    quests.updateProgress('alliance_1', 3);
    quests.claim('alliance_1', { claimMission: () => {} });
    quests._handleClaimResponse({ ok: true, missionId: 'alliance_1', granted: { gold: 300 } });
    const saved = quests.getSaveData();

    const freshEconomy = makeEconomy();
    const newQuests = new QuestManager(freshEconomy, {}, {});
    newQuests.loadState(saved);
    const mission = newQuests.getAllianceMissions()[0];
    expect(mission.progress).toBe(3);
    expect(mission.completed).toBe(true);
    expect(mission.claimed).toBe(true);
  });

  it('loadState لا يفشل مع بيانات غير مصفوفة (حفظة قديمة بلا الحقل)', () => {
    expect(() => quests.loadState(null)).not.toThrow();
    expect(() => quests.loadState(undefined)).not.toThrow();
  });
});
