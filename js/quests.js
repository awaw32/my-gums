"use strict";

/**
 * =============================================================================
 *  🏜️ ملك السحراء — نظام القصة + المهام اليومية + التحالف (Quests & Story System)
 * =============================================================================
 *  يدعم:
 *  - قصة رئيسية (Story Chapters) مع صور ونصوص صحراوية
 *  - مهام يومية (Daily Quests) مع تايمر
 *  - مهام موسمية / أحداث
 *  - مهام تحالف (Alliance Missions)
 *  - مكافآت (موارد، قوة جيش، تقدم قصة)
 *  - نظام إدماني: ستريك يومي، مكافآت تسجيل دخول
 *
 *  الثيم: صحراوي نقي (جمال، سيوف، خيام، كثبان)
 * =============================================================================
 */

export const STORY_CHAPTERS = [
  {
    id: 1,
    title: "بداية الأمير",
    desc: "أنت أمير صغير في خيمة بسيطة في قلب الصحراء. ابدأ ببناء قوتك.",
    image: "img/desert-city-luxury.jpg", // سيتم استبدالها بصورة قصة مخصصة
    reward: { gold: 100, armyPower: 5 },
    unlockLevel: 1,
    completed: false
  },
  {
    id: 2,
    title: "الهجوم الأول",
    desc: "عصابة من اللصوص هاجمت caravan الخاص بك. دافع عن أرضك!",
    image: "img/desert-army-luxury.jpg",
    reward: { gold: 250, gems: 10, armyPower: 15 },
    unlockLevel: 5,
    completed: false
  },
  // يمكن إضافة المزيد لاحقاً
];

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
    
    this.storyProgress = 0;
    this.dailyQuests = JSON.parse(JSON.stringify(DAILY_QUESTS));
    this.allianceMissions = JSON.parse(JSON.stringify(ALLIANCE_MISSIONS));
    this.lastDailyReset = Date.now();
    
    this.loadFromSave();
  }

  loadFromSave() {
    // سيتم ربطه مع save.js لاحقاً
    const saved = localStorage.getItem('desert_quests');
    if (saved) {
      const data = JSON.parse(saved);
      this.storyProgress = data.storyProgress || 0;
      this.dailyQuests = data.dailyQuests || this.dailyQuests;
      this.lastDailyReset = data.lastDailyReset || Date.now();
      if (data.unitPowerBonus && this.army) this.army.unitPowerBase = data.unitPowerBonus;
    }
  }

  save() {
    localStorage.setItem('desert_quests', JSON.stringify({
      storyProgress: this.storyProgress,
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
    if (quest.reward.armyPower) this.army.unitPowerBase += quest.reward.armyPower;
    
    if (this._onQuestCompleted) this._onQuestCompleted(quest);
  }

  getStoryChapter() {
    return STORY_CHAPTERS[this.storyProgress] || null;
  }

  advanceStory() {
    if (this.storyProgress < STORY_CHAPTERS.length - 1) {
      const chapter = STORY_CHAPTERS[this.storyProgress];
      if (chapter.reward) {
        if (chapter.reward.gold) this.economy.addRaw('gold', chapter.reward.gold);
        if (chapter.reward.gems) this.economy.addRaw('gems', chapter.reward.gems);
        if (chapter.reward.armyPower) this.army.unitPowerBase += chapter.reward.armyPower;
      }
      this.storyProgress++;
      this.save();
      return true;
    }
    return false;
  }

  getDailyQuests() {
    this.checkDailyReset();
    return this.dailyQuests;
  }

  getAllianceMissions() {
    return this.allianceMissions;
  }
}
