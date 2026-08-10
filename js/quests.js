"use strict";

/**
 * =============================================================================
 *  🏜️ ملك السحراء — مهام التحالف (Alliance Missions)
 * =============================================================================
 *  القصة الرئيسية في StoryManager (story-manager.js)
 *  المكافآت اليومية/السلسلة في مجلس الشيوخ (daily-login.js)
 *  هذا الملف يدير مهام التحالف فقط
 * =============================================================================
 */

export const ALLIANCE_MISSIONS = [
  {
    id: "alliance_1",
    title: "دعم خزينة التحالف",
    desc: "ساهم في خزينة التحالف 3 مرات",
    target: 3,
    progress: 0,
    reward: { alliancePoints: 50, gold: 300 }
  }
];

// 🛡️ قبل هذا الإصلاح: allianceMissions كانت بلا أي كود يزيد progress إطلاقاً
// (لا تتبع، لا حفظ، لا منح مكافآت) — عالقة دائماً عند 0/3 لكل لاعب ينضم
// لتحالف. الآن مربوطة بعدّاد سيرفري حقيقي (member.contributionCount في
// server/logic/allianceManager.js) عبر AllianceManager._onContributeSuccess،
// والاستلام يمر عبر رد خادم موثَّق (نفس نمط achievements.js claim()) — لا
// تُمنح الموارد محلياً أبداً قبل تأكيد الخادم.
export class QuestManager {
  constructor(economy, army, village) {
    this.economy = economy;
    this.army = army;
    this.village = village;

    this.allianceMissions = JSON.parse(JSON.stringify(ALLIANCE_MISSIONS));
    this._pendingClaims = new Set();
    this._onClaimResponse = null;
  }

  getAllianceMissions() {
    return this.allianceMissions;
  }

  /** يُستدعى من AllianceManager._onContributeSuccess بعد كل مساهمة ناجحة */
  updateProgress(missionId, value) {
    const mission = this.allianceMissions.find(m => m.id === missionId);
    if (!mission || mission.completed) return;
    mission.progress = Math.min(mission.target, value);
    if (mission.progress >= mission.target) mission.completed = true;
  }

  /** يرسل طلب استلام للخادم — لا يمنح الموارد محلياً إطلاقاً */
  claim(missionId, allianceManager) {
    const mission = this.allianceMissions.find(m => m.id === missionId);
    if (!mission || mission.progress < mission.target || mission.claimed) return false;
    if (this._pendingClaims.has(missionId)) return false;
    if (!allianceManager) return false;
    this._pendingClaims.add(missionId);
    allianceManager.claimMission(missionId);
    return true;
  }

  /** يُستدعى من AllianceManager._onClaimMissionResponse عند وصول رد الخادم */
  _handleClaimResponse(msg) {
    this._pendingClaims.delete(msg.missionId);
    if (!msg.ok) {
      if (this._onClaimResponse) this._onClaimResponse(msg);
      return;
    }
    const mission = this.allianceMissions.find(m => m.id === msg.missionId);
    if (mission) mission.claimed = true;
    const granted = msg.granted || {};
    if (this.economy) {
      if (granted.gold) this.economy.addRaw("gold", granted.gold);
      if (granted.gems) this.economy.addRaw("gems", granted.gems);
      if (granted.cash) this.economy.addRaw("cash", granted.cash);
    }
    if (this._onClaimResponse) this._onClaimResponse(msg);
  }

  getSaveData() {
    return this.allianceMissions.map(m => ({ id: m.id, progress: m.progress, completed: !!m.completed, claimed: !!m.claimed }));
  }

  loadState(saved) {
    if (!Array.isArray(saved)) return;
    for (const s of saved) {
      const mission = this.allianceMissions.find(m => m.id === s.id);
      if (mission) {
        mission.progress = s.progress || 0;
        mission.completed = !!s.completed;
        mission.claimed = !!s.claimed;
      }
    }
  }
}
