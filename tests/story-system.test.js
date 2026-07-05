import { describe, it, expect, beforeEach } from 'vitest';
import { StoryManager } from '../js/story-manager.js';
import { GameVillage, VillageBuilding } from '../js/village.js';
import { GameEconomy } from '../js/economy.js';
import { GameArmy } from '../js/army.js';
import { PrestigeManager } from '../js/prestige.js';
import { ENEMY_TYPES, getEnemyForLevel, getBossForVillage, getEnemiesForVillage } from '../js/enemies.js';
import { STORY_CHAPTERS, STORY_VILLAGES } from '../js/story.js';

describe('Story System', () => {
  let economy, village, story;

  beforeEach(() => {
    economy = new GameEconomy();
    village = new GameVillage(economy);
    story = new StoryManager(economy, village);
  });

  it('should have 5 chapters', () => {
    expect(STORY_CHAPTERS).toHaveLength(5);
  });

  it('should start at chapter 1', () => {
    expect(story.currentChapter).toBe(1);
  });

  it('should return current chapter data', () => {
    const chapter = story.currentChapterData;
    expect(chapter).toBeTruthy();
    expect(chapter.id).toBe(1);
  });

  it('should provide scenes for chapter 1', () => {
    const scenes = story.getCurrentScenes();
    expect(scenes.length).toBeGreaterThan(0);
  });

  it('should get next scene', () => {
    const scene = story.getNextScene();
    expect(scene).toBeTruthy();
    expect(scene.title).toBeTruthy();
  });

  it('should track watched scenes', () => {
    const scene = story.getNextScene();
    expect(story.isSceneWatched(scene.id)).toBe(true);
  });

  it('should not complete chapter without buildings', () => {
    expect(story.canCompleteChapter()).toBe(false);
  });

  it('should complete chapter when village is complete', () => {
    village.buildings.forEach(b => {
      b.state = 'ready';
      b.level = 1;
    });
    expect(story.canCompleteChapter()).toBe(true);
    expect(story.completeChapter()).toBe(true);
  });

  it('should save and load state', () => {
    story.currentChapter = 2;
    story.completedChapters = [1];
    const data = story.getSaveData();
    const newStory = new StoryManager(economy, village);
    newStory.loadState(data);
    expect(newStory.currentChapter).toBe(2);
    expect(newStory.completedChapters).toContain(1);
  });

  it('should reset story progress', () => {
    story.currentChapter = 3;
    story.completedChapters = [1, 2];
    story.unlockedVillages = ['wadi', 'palace_ruins', 'mountain'];
    story.reset();
    expect(story.currentChapter).toBe(1);
    expect(story.completedChapters).toHaveLength(0);
    expect(story.unlockedVillages).toEqual(['wadi']);
  });
});

describe('Village System', () => {
  let economy, village;

  beforeEach(() => {
    economy = new GameEconomy();
    village = new GameVillage(economy);
  });

  it('should have 5 villages defined', () => {
    expect(STORY_VILLAGES).toHaveLength(5);
  });

  it('should start at wadi village', () => {
    expect(village.currentVillageId).toBe('wadi');
  });

  it('should have 4 buildings in wadi', () => {
    expect(village.buildings).toHaveLength(4);
  });

  it('should have 4 buildings in palace_ruins', () => {
    village.initVillage('palace_ruins');
    expect(village.buildings).toHaveLength(4);
  });

  it('should have 4 buildings in mountain', () => {
    village.initVillage('mountain');
    expect(village.buildings).toHaveLength(4);
  });

  it('should require resources for building cost', () => {
    const building = village.buildings[0];
    expect(building.cost).toBeTruthy();
    expect(Object.keys(building.cost).length).toBeGreaterThan(0);
  });

  it('should produce real resources', () => {
    const building = village.buildings[0];
    expect(building.production).toBeTruthy();
    expect(Object.keys(building.production).length).toBeGreaterThan(0);
  });

  it('should not move to next village without completing current', () => {
    expect(village.canMoveToNext()).toBe(false);
  });

  it('should move to next village when complete and level high enough', () => {
    village.buildings.forEach(b => {
      b.state = 'ready';
      b.level = 1;
    });
    economy.level = 15;
    expect(village.canMoveToNext()).toBe(true);
    expect(village.moveToNext()).toBe(true);
    expect(village.currentVillageId).toBe('palace_ruins');
  });

  it('should deduct cost when fighting to build', () => {
    const building = village.buildings[0];
    const cost = building.cost;
    economy.resources.cash = 10000;
    economy.resources.gold = 10000;
    const initialCash = economy.resources.cash;
    const initialGold = economy.resources.gold;
    const result = building.fight(999999, economy);
    expect(result).toBe(true);
    expect(building.state).toBe('building');
    expect(economy.resources.cash).toBe(initialCash - (cost.cash || 0));
    expect(economy.resources.gold).toBe(initialGold - (cost.gold || 0));
  });

  it('should not fight if player cannot afford building cost', () => {
    const building = village.buildings[0];
    economy.resources.cash = 0;
    economy.resources.gold = 0;
    const result = building.fight(999999, economy);
    expect(result).toBe(false);
    expect(building.state).toBe('locked');
  });
});

describe('Enemy System', () => {
  it('should have enemies for each village', () => {
    expect(getEnemiesForVillage('wadi')).toHaveLength(3);
    expect(getEnemiesForVillage('palace_ruins')).toHaveLength(3);
    expect(getEnemiesForVillage('mountain')).toHaveLength(3);
    expect(getEnemiesForVillage('plains')).toHaveLength(3);
    expect(getEnemiesForVillage('throne')).toHaveLength(3);
  });

  it('should have a boss for each village', () => {
    expect(getBossForVillage('wadi')).toBeTruthy();
    expect(getBossForVillage('palace_ruins')).toBeTruthy();
    expect(getBossForVillage('mountain')).toBeTruthy();
    expect(getBossForVillage('plains')).toBeTruthy();
    expect(getBossForVillage('throne')).toBeTruthy();
  });

  it('should return enemy for level 1', () => {
    const enemy = getEnemyForLevel(1);
    expect(enemy).toBeTruthy();
    expect(enemy.level).toBeLessThanOrEqual(1);
  });

  it('should return stronger enemy for higher levels', () => {
    const enemy1 = getEnemyForLevel(1);
    // Level 50 pool includes enemies up to level 60; call multiple times to avoid randomness
    let foundStronger = false;
    for (let i = 0; i < 20; i++) {
      const enemy50 = getEnemyForLevel(50);
      if (enemy50.level > enemy1.level) {
        foundStronger = true;
        break;
      }
    }
    expect(foundStronger).toBe(true);
  });

  it('should not return boss from getEnemyForLevel', () => {
    const enemy = getEnemyForLevel(100);
    expect(enemy.isBoss).toBeFalsy();
  });

  it('should scale enemy power with player level', () => {
    const enemy = ENEMY_TYPES.desert_wolf;
    const scaled = calculateEnemyPower(enemy, 10);
    expect(scaled.hp).toBeGreaterThan(enemy.hp);
  });
});

function calculateEnemyPower(enemy, playerLevel) {
  const scale = 1 + (playerLevel - enemy.level) * 0.05;
  return {
    hp: Math.floor(enemy.hp * scale),
    damage: Math.floor(enemy.damage * scale),
    reward: {
      cash: Math.floor(enemy.reward.cash * scale),
      gold: Math.floor(enemy.reward.gold * scale)
    }
  };
}

describe('Prestige System', () => {
  let economy, village, army, story, prestige;

  beforeEach(() => {
    economy = new GameEconomy();
    village = new GameVillage(economy);
    army = new GameArmy(economy);
    story = new StoryManager(economy, village);
    prestige = new PrestigeManager(economy, village, army, story);
  });

  it('should reset story manager on prestige', () => {
    economy.maxLevel = 10;
    economy.level = economy.maxLevel;
    story.currentChapter = 3;
    story.completedChapters = [1, 2];
    story.unlockedVillages = ['wadi', 'palace_ruins', 'mountain'];
    village.completedVillages = ['wadi', 'palace_ruins'];

    prestige.prestige();

    expect(story.currentChapter).toBe(1);
    expect(story.completedChapters).toHaveLength(0);
    expect(story.unlockedVillages).toEqual(['wadi']);
    expect(village.currentVillageId).toBe('wadi');
    expect(village.completedVillages).toHaveLength(0);
  });
});
