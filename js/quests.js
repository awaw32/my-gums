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
    title: "مساعدة الحلفاء",
    desc: "ساعد 3 أعضاء في التحالف",
    target: 3,
    progress: 0,
    reward: { alliancePoints: 50, gold: 300 }
  }
];

export class QuestManager {
  constructor(economy, army, village) {
    this.economy = economy;
    this.army = army;
    this.village = village;

    this.allianceMissions = JSON.parse(JSON.stringify(ALLIANCE_MISSIONS));
  }

  getAllianceMissions() {
    return this.allianceMissions;
  }
}
