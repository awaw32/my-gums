"use strict";

/**
 * =============================================================================
 *  🏜️ ملك السحراء — المهام اليومية ونظام التحالف (Daily Quests & Alliance)
 * =============================================================================
 *  القصة الرئيسية أصبحت في StoryManager (story-manager.js)
 *  هذا الملف يدير المهام اليومية فقط
 * =============================================================================
 */

export const DAILY_QUESTS = [
  {
    id: "daily_1",
    title: "جمع الموارد",
    desc: "اجمع 500 ذهب من الإنتاج",
    type: "collect",
    target: 500,
    progress: 0,
    reward: { gold: 200, food: 100 },
    resetDaily: true
  },
  {
    id: "daily_2",
    title: "تدريب الجيش",
    desc: "درب 20 جندي جديد",
    type: "train",
    target: 20,
    progress: 0,
    reward: { armyPower: 30 },
    resetDaily: true
  },
  {
    id: "daily_3",
    title: "القتال في الصحراء",
    desc: "اقتل 10 أعداء في ساحة المعركة",
    type: "kill",
    target: 10,
    progress: 0,
    reward: { gems: 5, gold: 150 },
    resetDaily: true
  }
];

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
    
    this.dailyQuests = JSON.parse(JSON.stringify(DAILY_QUESTS));
    this.allianceMissions = JSON.parse(JSON.stringify(ALLIANCE_MISSIONS));
    this.lastDailyReset = Date.now();
    
    this.loadFromSave();
  }

  loadFromSave() {
    const saved = localStorage.getItem('desert_quests');
    if (saved) {
      const data = JSON.parse(saved);
      this.dailyQuests = data.dailyQuests || this.dailyQuests;
      this.lastDailyReset = data.lastDailyReset || Date.now();
      if (data.unitPowerBonus && this.army) this.army.unitPowerBase = data.unitPowerBonus;
    }
  }

  save() {
    localStorage.setItem('desert_quests', JSON.stringify({
      dailyQuests: this.dailyQuests,
      lastDailyReset: this.lastDailyReset,
      unitPowerBonus: this.army.unitPowerBase
    }));
  }

  checkDailyReset() {
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    if (now - this.lastDailyReset > oneDay) {
      this.resetDailyQuests();
      this.lastDailyReset = now;
      this.save();
    }
  }

  resetDailyQuests() {
    this.dailyQuests.forEach(q => {
      q.progress = 0;
    });
  }

  // تحديث التقدم (يُستدعى من أماكن أخرى)
  updateProgress(type, amount = 1) {
    this.dailyQuests.forEach(quest => {
      if (quest.type === type && quest.progress < quest.target) {
        quest.progress += amount;
        if (quest.progress >= quest.target) {
          this.claimReward(quest);
        }
      }
    });
    this.save();
  }

  claimReward(quest) {
    if (quest.reward.gold) this.economy.addRaw('gold', quest.reward.gold);
    if (quest.reward.gems) this.economy.addRaw('gems', quest.reward.gems);
    if (quest.reward.food) this.economy.addRaw('food', quest.reward.food);
    if (quest.reward.armyPower) this.army.unitPowerBase += quest.reward.armyPower;
    
    if (this._onQuestCompleted) this._onQuestCompleted(quest);
  }

  getDailyQuests() {
    this.checkDailyReset();
    return this.dailyQuests;
  }

  getAllianceMissions() {
    return this.allianceMissions;
  }
}
