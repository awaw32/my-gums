"use strict";

/**
 * مدير القصة - ملك الصحراء
 * يتحكم في عرض القصة والتقدم عبر الفصول
 */

import { STORY_CHAPTERS, STORY_VILLAGES, STORY_REWARDS } from './story.js';
import { CinematicEngine } from './cinematic-engine.js';

export class StoryManager {
  constructor(economy, village) {
    this.economy = economy;
    this.village = village;
    this.currentChapter = 1;
    this.completedChapters = [];
    this.currentScene = 0;
    this.scenesWatched = {};
    this.choicesMade = {}; // { chapterId: { sceneId: choiceIndex } }
    this.unlockedVillages = ["wadi"];
    this._onChapterComplete = null;
    this._onSceneWatched = null;
    this._onVillageUnlocked = null;
    this._onChapterScenesShow = null;
    this._onBossFight = null; // يُستدعى عند مشهد Boss
    
    // محرك السينماتيك
    this.cinematic = null;
    this._introPlayed = false;
    this._initCinematic();
  }

  _initCinematic() {
    try {
      if (typeof document !== "undefined" && document.body) {
        this.cinematic = new CinematicEngine(document.body);
      }
    } catch {
      this.cinematic = null;
    }
  }

  get currentChapterData() {
    return STORY_CHAPTERS.find(ch => ch.id === this.currentChapter);
  }

  get currentVillageData() {
    return STORY_VILLAGES.find(v => v.id === this.village.currentVillageId);
  }

  async playCinematicIntro() {
    if (this._introPlayed || !this.cinematic) return;
    this._introPlayed = true;
    await this.cinematic.playIntro();
  }

  async playChapterDialogue(sceneType) {
    if (!this.cinematic) return;
    const villageId = this.village.currentVillageId || "wadi";
    await this.cinematic.playDialogue(villageId, sceneType);
  }

  async playBossDialogue() {
    if (!this.cinematic) return;
    const villageId = this.village.currentVillageId || "wadi";
    await this.cinematic.playDialogue(villageId, "boss");
  }

  async playVictoryScene() {
    if (!this.cinematic) return;
    const villageId = this.village.currentVillageId || "wadi";
    await this.cinematic.playVictory(villageId);
  }

  async playChapterIntro() {
    if (!this.cinematic) return;
    const villageId = this.village.currentVillageId || "wadi";
    await this.cinematic.playDialogue(villageId, "intro");
  }

  isChapterUnlocked(chapterId) {
    const chapter = STORY_CHAPTERS.find(ch => ch.id === chapterId);
    if (!chapter) return false;
    if (chapterId === 1) return true;
    return this.completedChapters.includes(chapterId - 1) &&
           this.economy.level >= chapter.levelRequired;
  }

  isChapterComplete(chapterId) {
    return this.completedChapters.includes(chapterId);
  }

  canCompleteChapter() {
    const chapter = this.currentChapterData;
    if (!chapter) return false;
    return this.village.isVillageComplete();
  }

  completeChapter() {
    if (!this.canCompleteChapter()) return false;

    const chapter = this.currentChapterData;
    this.completedChapters.push(chapter.id);

    // منح مكافآت الفصل
    const chapterReward = chapter.reward;
    for (const [resource, amount] of Object.entries(chapterReward)) {
      if (resource === 'title') {
        // حفظ اللقب
        this._playerTitle = amount;
      } else if (resource === 'xp') {
        this.economy.addXp(amount);
      } else if (this.economy.resources[resource] !== undefined) {
        this.economy.add(resource, amount);
      }
    }

    // منح مكافآت إكمال القرية
    const villageReward = STORY_REWARDS.village_complete[chapter.village];
    if (villageReward) {
      for (const [resource, amount] of Object.entries(villageReward)) {
        if (resource === 'xp') {
          this.economy.addXp(amount);
        } else if (this.economy.resources[resource] !== undefined) {
          this.economy.add(resource, amount);
        }
      }
    }

    // فتح القرية التالية
    const nextVillage = this.village.nextVillage;
    if (nextVillage && !this.unlockedVillages.includes(nextVillage.id)) {
      this.unlockedVillages.push(nextVillage.id);
      if (this._onVillageUnlocked) {
        this._onVillageUnlocked(nextVillage);
      }
    }

    // الانتقال للفصل التالي
    if (this.currentChapter < STORY_CHAPTERS.length) {
      this.currentChapter++;
      this.currentScene = 0;
    }

    if (this._onChapterComplete) {
      this._onChapterComplete(chapter);
    }

    return true;
  }

  /**
   * اختيار خيار حواري وتطبيق المكافآت
   */
  makeChoice(sceneId, choiceIndex) {
    const scene = this.currentChapterData?.scenes?.find(s => s.id === sceneId);
    if (!scene || !scene.choices || !scene.choices[choiceIndex]) return null;
    
    if (!this.choicesMade[this.currentChapter]) {
      this.choicesMade[this.currentChapter] = {};
    }
    this.choicesMade[this.currentChapter][sceneId] = choiceIndex;
    
    const choice = scene.choices[choiceIndex];
    // تطبيق المكافآت
    if (choice.reward && this.economy) {
      for (const [res, amt] of Object.entries(choice.reward)) {
        if (res === 'xp') {
          this.economy.addXp(amt);
        } else if (res === 'alliancePower') {
          if (window._allianceManager) window._allianceManager.addPower(amt);
        } else if (res === 'unitLevels') {
          if (window._army) {
            for (let i = 0; i < amt; i++) {
              if (window._army.unitLevel < window._army.maxUnitLevel) window._army.unitLevel++;
            }
          }
        } else if (res === 'trainingLevel') {
          if (window._army) {
            for (let i = 0; i < amt; i++) {
              if (window._army.trainingLevel < window._army.maxTrainingLevel) window._army.trainingLevel++;
            }
          }
        } else if (res === 'defense') {
          if (window._economy) window._economy.defense = (window._economy.defense || 0) + amt;
        } else if (res === 'title') {
          this._playerTitle = amt;
        } else if (this.economy.resources[res] !== undefined) {
          this.economy.add(res, amt);
        }
      }
    }
    
    if (this._onSceneWatched) {
      this._onSceneWatched(sceneId);
    }
    
    return choice;
  }
  
  getChoiceForScene(sceneId) {
    return this.choicesMade[this.currentChapter]?.[sceneId] ?? null;
  }

  watchScene(sceneId) {
    if (!this.scenesWatched[this.currentChapter]) {
      this.scenesWatched[this.currentChapter] = [];
    }
    if (!this.scenesWatched[this.currentChapter].includes(sceneId)) {
      this.scenesWatched[this.currentChapter].push(sceneId);
    }
    if (this._onSceneWatched) {
      this._onSceneWatched(sceneId);
    }
  }

  isSceneWatched(sceneId) {
    return this.scenesWatched[this.currentChapter]?.includes(sceneId) || false;
  }

  getCurrentScenes() {
    const chapter = this.currentChapterData;
    if (!chapter) return [];
    return chapter.scenes || [];
  }

  getNextScene() {
    const scenes = this.getCurrentScenes();
    if (this.currentScene < scenes.length) {
      const scene = scenes[this.currentScene];
      this.currentScene++;
      this.watchScene(scene.id);
      return scene;
    }
    return null;
  }

  hasMoreScenes() {
    const scenes = this.getCurrentScenes();
    return this.currentScene < scenes.length;
  }

  canShowStory() {
    return this.hasMoreScenes();
  }

  shouldShowIntro() {
    return this.economy.level === 1 && this.completedChapters.length === 0;
  }

  showChapterScenes(callback) {
    if (!this.hasMoreScenes()) {
      if (callback) callback();
      return;
    }
    if (this._onChapterScenesShow) {
      this._onChapterScenesShow(callback);
    }
  }

  getProgress() {
    return {
      currentChapter: this.currentChapter,
      totalChapters: STORY_CHAPTERS.length,
      completedChapters: this.completedChapters.length,
      currentVillage: this.village.currentVillageId,
      unlockedVillages: this.unlockedVillages,
      percentage: Math.floor((this.completedChapters.length / STORY_CHAPTERS.length) * 100)
    };
  }

  getTitle() {
    return this._playerTitle || "المستوطن الجديد";
  }

  getSaveData() {
    return {
      currentChapter: this.currentChapter,
      completedChapters: this.completedChapters,
      currentScene: this.currentScene,
      scenesWatched: this.scenesWatched,
      choicesMade: this.choicesMade,
      unlockedVillages: this.unlockedVillages,
      title: this._playerTitle
    };
  }

  loadState(data) {
    if (!data) return;
    this.currentChapter = data.currentChapter || 1;
    this.completedChapters = data.completedChapters || [];
    this.currentScene = data.currentScene || 0;
    this.scenesWatched = data.scenesWatched || {};
    this.choicesMade = data.choicesMade || {};
    this.unlockedVillages = data.unlockedVillages || ["wadi"];
    this._playerTitle = data.title || "المستوطن الجديد";
  }

  reset() {
    this.currentChapter = 1;
    this.completedChapters = [];
    this.currentScene = 0;
    this.scenesWatched = {};
    this.choicesMade = {};
    this.unlockedVillages = ["wadi"];
    this._playerTitle = "المستوطن الجديد";
  }
}
