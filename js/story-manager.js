"use strict";

/**
 * مدير القصة - ملك الصحراء
 * يتحكم في عرض القصة والتقدم عبر الفصول
 */

import { STORY_CHAPTERS, STORY_VILLAGES, STORY_REWARDS } from './story.js';

export class StoryManager {
  constructor(economy, village) {
    this.economy = economy;
    this.village = village;
    this.currentChapter = 1;
    this.completedChapters = [];
    this.currentScene = 0;
    this.scenesWatched = {};
    this.unlockedVillages = ["wadi"];
    this._onChapterComplete = null;
    this._onSceneWatched = null;
    this._onVillageUnlocked = null;
  }

  get currentChapterData() {
    return STORY_CHAPTERS.find(ch => ch.id === this.currentChapter);
  }

  get currentVillageData() {
    return STORY_VILLAGES.find(v => v.id === this.village.currentVillageId);
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
      } else if (this.economy.resources[resource] !== undefined) {
        this.economy.add(resource, amount);
      }
    }

    // منح مكافآت إكمال القرية
    const villageReward = STORY_REWARDS.village_complete[chapter.village];
    if (villageReward) {
      for (const [resource, amount] of Object.entries(villageReward)) {
        if (this.economy.resources[resource] !== undefined) {
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
    return this.economy.level >= 1 && !this.isChapterComplete(1);
  }

  shouldShowIntro() {
    return this.economy.level === 1 && this.completedChapters.length === 0;
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
    this.unlockedVillages = data.unlockedVillages || ["wadi"];
    this._playerTitle = data.title || "المستوطن الجديد";
  }
}
