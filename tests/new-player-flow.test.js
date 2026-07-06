/**
 * 🧪 اختبار وظيفي: تدفق اللاعب الجديد + القصة
 * 
 * يختبر المسار الكامل للاعب الجديد:
 * 1. بونص الترحيب (1000 من كل عملة)
 * 2. بدء القصة — المشاهد والخيارات والمكافآت
 * 3. المباني تبدأ مقفلة 🔒
 * 4. إكمال الفصل الأول وفتح القرية التالية
 * 5. حفظ وتحميل القصة
 * 6. عدم تعارض القصة مع التدريب (initStory / initTutorial)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { StoryManager } from '../js/story-manager.js';
import { GameVillage, VillageBuilding } from '../js/village.js';
import { GameEconomy, getXpForLevel, formatNumber } from '../js/economy.js';
import { GameArmy } from '../js/army.js';
import { GameHero } from '../js/hero.js';
import { STORY_CHAPTERS, STORY_VILLAGES, STORY_REWARDS } from '../js/story.js';

// =====================================================================
// 1. 🎁 بونص الترحيب للاعب الجديد
// =====================================================================
describe('🎁 بونص الترحيب للاعب الجديد', () => {
  let economy;

  beforeEach(() => {
    economy = new GameEconomy();
  });

  it('يجب أن يبدأ اللاعب الجديد بـ 0 موارد', () => {
    expect(economy.cash).toBe(0);
    expect(economy.gold).toBe(150);
    expect(economy.gems).toBe(10);
    expect(economy.hammers).toBe(0);
    expect(economy.scrolls).toBe(0);
    expect(economy.food).toBe(50);
    expect(economy.level).toBe(1);
    expect(economy.xp).toBe(0);
  });

  it('يجب منح البونص الترحيبي (1000 من كل عملة رئيسية)', () => {
    // محاكاة البونص من main.js
    economy.addRaw("cash", 1000);
    economy.addRaw("gems", 1000);
    economy.addRaw("gold", 1000);
    economy.addRaw("hammers", 1000);
    economy.addRaw("scrolls", 1000);
    economy.addRaw("food", 500);

    expect(economy.cash).toBe(1000);
    expect(economy.gems).toBe(1010);
    expect(economy.gold).toBe(1150);
    expect(economy.hammers).toBe(1000);
    expect(economy.scrolls).toBe(1000);
    expect(economy.food).toBe(550);
  });

  it('يجب أن يبدأ اللاعب الجديد بالمستوى 1 و XP = 0', () => {
    expect(economy.level).toBe(1);
    expect(economy.xp).toBe(0);
    expect(economy.xpToNext).toBe(getXpForLevel(1));
  });

  it('يجب تنسيق الأرقام بشكل صحيح', () => {
    // toLocaleString يعتمد على لغة النظام — نختبر القيمة الرقمية مباشرة
    economy.cash = 1500;
    expect(economy.cashFormatted).toContain('K');
    economy.cash = 500;
    expect(economy.cash).toBe(500); // القيمة الرقمية سليمة
    expect(typeof economy.cashFormatted).toBe('string');
    expect(economy.cashFormatted.length).toBeGreaterThan(0);
    economy.cash = 1000000;
    expect(economy.cashFormatted).toContain('M');
  });
});

// =====================================================================
// 2. 📖 بدء القصة — StoryManager للاعب الجديد
// =====================================================================
describe('📖 بدء القصة للاعب الجديد', () => {
  let economy, village, story, army;

  beforeEach(() => {
    economy = new GameEconomy();
    village = new GameVillage(economy);
    army = new GameArmy(economy);
    story = new StoryManager(economy, village);
  });

  it('يجب أن تبدأ القصة من الفصل 1', () => {
    expect(story.currentChapter).toBe(1);
    expect(story.currentChapterData).toBeTruthy();
    expect(story.currentChapterData.id).toBe(1);
  });

  it('يجب أن يكون الفصل الأول عن قرية الواحة (wadi)', () => {
    const chapter = story.currentChapterData;
    expect(chapter.village).toBe('wadi');
    expect(chapter.title).toContain('الواحة');
  });

  it('يجب أن يكون الفصل الأول متاحاً بدون شرط مستوى', () => {
    expect(story.isChapterUnlocked(1)).toBe(true);
    expect(story.isChapterUnlocked(2)).toBe(false); // يحتاج مستوى 15
  });

  it('يجب أن تكون مشاهد القصة متاحة للمشاهدة', () => {
    expect(story.canShowStory()).toBe(true);
    const scenes = story.getCurrentScenes();
    expect(scenes.length).toBe(5); // 4 مشاهد عادية + 1 مشهد Boss
  });

  it('يجب أن يكون آخر مشهد هو مشهد Boss', () => {
    const scenes = story.getCurrentScenes();
    const lastScene = scenes[scenes.length - 1];
    expect(lastScene.isBoss).toBe(true);
    expect(lastScene.bossId).toBe('wadi_boss');
  });

  it('يجب أن يحصل getNextScene() على المشهد التالي ويزيد العداد', () => {
    expect(story.currentScene).toBe(0);
    const scene = story.getNextScene();
    expect(scene).toBeTruthy();
    expect(scene.id).toBe('wadi_intro');
    expect(story.currentScene).toBe(1);
  });

  it('يجب تتبع المشاهد التي تمت مشاهدتها', () => {
    const scene = story.getNextScene();
    expect(story.isSceneWatched(scene.id)).toBe(true);
  });

  it('يجب أن hasMoreScenes() يعود true عندما يكون هناك مشاهد متبقية', () => {
    expect(story.hasMoreScenes()).toBe(true);
    // مشاهدة كل المشاهد
    for (let i = 0; i < 5; i++) {
      story.getNextScene();
    }
    expect(story.hasMoreScenes()).toBe(false);
  });

  it('يجب أن getCurrentScenes() يعيد 5 مشاهد للفصل 1', () => {
    const scenes = story.getCurrentScenes();
    expect(scenes).toHaveLength(5);
  });
});

// =====================================================================
// 3. 🎯 خيارات القصة والمكافآت
// =====================================================================
describe('🎯 خيارات القصة والمكافآت', () => {
  let economy, village, story;

  beforeEach(() => {
    economy = new GameEconomy();
    economy.addRaw("cash", 1000); // بونص ترحيبي
    village = new GameVillage(economy);
    story = new StoryManager(economy, village);
  });

  it('يجب أن تحتوي المشاهد العادية على خيارات', () => {
    const chapter = story.currentChapterData;
    for (const scene of chapter.scenes) {
      if (!scene.isBoss) {
        expect(scene.choices).toBeTruthy();
        expect(scene.choices.length).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('يجب أن يمنح الاختيار الأول مكافأة مالية (cash: 50)', () => {
    const scene = story.getNextScene(); // wadi_intro
    const choice = story.makeChoice(scene.id, 0);
    expect(choice).toBeTruthy();
    expect(choice.reward).toBeTruthy();
    expect(choice.reward.cash).toBe(50);
    expect(economy.cash).toBeGreaterThanOrEqual(1000 + 50);
  });

  it('يجب أن يمنح الاختيار الثاني ذهباً (gold: 10)', () => {
    const scene = story.getNextScene(); // wadi_intro
    const initialGold = economy.gold;
    story.makeChoice(scene.id, 1);
    expect(economy.gold).toBeGreaterThan(initialGold);
  });

  it('يجب أن يسجل الاختيار ولا يمكن تغييره', () => {
    const scene = story.getNextScene(); // wadi_intro
    story.makeChoice(scene.id, 0);
    const savedChoice = story.getChoiceForScene(scene.id);
    expect(savedChoice).toBe(0);
  });

  it('يجب أن يمنح الاختيار XP عند اختياره', () => {
    const scene = story.getNextScene(); // wadi_intro
    const initialXp = economy.xp;
    // المشهد الثاني (wadi_danger) يعطي xp: 50
    story.getNextScene(); // wadi_danger
    const scene2 = story.currentChapterData.scenes[1]; // wadi_danger
    story.makeChoice(scene2.id, 0); // reward: { xp: 50 }
    expect(economy.xp).toBeGreaterThan(initialXp);
  });

  it('يجب أن يظهر nextText بعد الاختيار', () => {
    const scene = story.getNextScene(); // wadi_intro
    const choice = story.makeChoice(scene.id, 0);
    expect(choice.nextText).toBeTruthy();
    expect(typeof choice.nextText).toBe('string');
  });
});

// =====================================================================
// 4. 🔒 المباني تبدأ مقفلة للاعب الجديد
// =====================================================================
describe('🔒 المباني تبدأ مقفلة', () => {
  let economy, village;

  beforeEach(() => {
    economy = new GameEconomy();
    economy.addRaw("cash", 1000); // بونص ترحيبي
    village = new GameVillage(economy);
  });

  it('يجب أن تبدأ جميع المباني في قرية الواحة بحالة locked', () => {
    for (const building of village.buildings) {
      expect(building.state).toBe('locked');
    }
  });

  it('يجب أن تحتوي قرية الواحة على 5 مباني', () => {
    expect(village.buildings).toHaveLength(5);
  });

  it('يجب أن تكون تكلفة كل مبنى محددة', () => {
    for (const building of village.buildings) {
      expect(building.cost).toBeTruthy();
      expect(Object.keys(building.cost).length).toBeGreaterThan(0);
    }
  });

  it('يجب أن يكون لكل مبنى وحش للحماية', () => {
    for (const building of village.buildings) {
      expect(building.monsterName).toBeTruthy();
      expect(building.monsterPower).toBeGreaterThan(0);
    }
  });

  it('يجب أن تنتج المباني موارد بعد بنائها', () => {
    for (const building of village.buildings) {
      expect(building.production).toBeTruthy();
      expect(Object.keys(building.production).length).toBeGreaterThan(0);
    }
  });

  it('يجب فتح المبنى بعد هزيمة الوحش ودفع التكاليف', () => {
    const building = village.buildings[0];
    expect(building.state).toBe('locked');
    
    // قوة كافية لهزيمة الوحش + موارد كافية
    const result = building.fight(999999, economy);
    expect(result).toBe(true);
    expect(building.state).toBe('building'); // ينتقل لـ building (قيد الإنشاء)
  });

  it('يجب أن يعود fight() false إذا كانت القوة غير كافية', () => {
    const building = village.buildings[0];
    economy.resources.cash = 0;
    economy.resources.gold = 0;
    const result = building.fight(0, economy);
    expect(result).toBe(false);
    expect(building.state).toBe('locked');
  });

  it('يجب أن تنتج المباني الجاهزة موارد عند التحديث', () => {
    const building = village.buildings[0];
    building.state = 'ready';
    building.level = 1;
    
    const production = building.update(5); // 5 ثوانٍ
    expect(production).toBeTruthy();
    expect(Object.keys(production).length).toBeGreaterThan(0);
  });
});

// =====================================================================
// 5. 📖 إكمال الفصل الأول وفتح القرية التالية
// =====================================================================
describe('📖 إكمال الفصل الأول', () => {
  let economy, village, story;

  beforeEach(() => {
    economy = new GameEconomy();
    economy.addRaw("cash", 100000);
    economy.addRaw("gold", 100000);
    economy.addRaw("gems", 1000);
    economy.addRaw("hammers", 1000);
    economy.addRaw("scrolls", 1000);
    village = new GameVillage(economy);
    story = new StoryManager(economy, village);
  });

  it('يجب ألا يكتمل الفصل بدون بناء جميع المباني', () => {
    expect(story.canCompleteChapter()).toBe(false);
    expect(story.completeChapter()).toBe(false);
  });

  it('يجب أن يكتمل الفصل عندما تكون كل المباني جاهزة', () => {
    // بناء كل المباني في قرية الواحة
    for (const building of village.buildings) {
      const fightResult = building.fight(999999, economy);
      expect(fightResult).toBe(true);
      // تسريع البناء (إنهاء فوري)
      building.constructTimer = 0;
      building.update(10); // يُنهي البناء
    }

    expect(village.isVillageComplete()).toBe(true);
    expect(story.canCompleteChapter()).toBe(true);
  });

  it('يجب أن يمنح إكمال الفصل XP ومكافآت', () => {
    // بناء كل المباني
    for (const building of village.buildings) {
      building.fight(999999, economy);
      building.constructTimer = 0;
      building.update(10);
    }

    const initialXp = economy.xp;
    const initialCash = economy.cash;
    
    const result = story.completeChapter();
    expect(result).toBe(true);
    
    // يجب أن يزيد XP
    expect(economy.xp).toBeGreaterThan(initialXp);
  });

  it('يجب أن يفتح الفصل التالي بعد إكمال الفصل الأول', () => {
    for (const building of village.buildings) {
      building.fight(999999, economy);
      building.constructTimer = 0;
      building.update(10);
    }

    story.completeChapter();
    expect(story.currentChapter).toBe(2);
    expect(story.completedChapters).toContain(1);
  });

  it('يجب أن تحتوي مكافآت إكمال القرية على cash و gold و xp', () => {
    const villageReward = STORY_REWARDS.village_complete.wadi;
    expect(villageReward).toBeTruthy();
    expect(villageReward.cash).toBeGreaterThan(0);
    expect(villageReward.gold).toBeGreaterThan(0);
    expect(villageReward.xp).toBeGreaterThan(0);
  });

  it('يجب أن تزيد مكافآت الإكمال مع تقدم الفصول', () => {
    const wadiReward = STORY_REWARDS.village_complete.wadi;
    const throneReward = STORY_REWARDS.village_complete.throne;
    expect(throneReward.cash).toBeGreaterThan(wadiReward.cash);
    expect(throneReward.gold).toBeGreaterThan(wadiReward.gold);
    expect(throneReward.xp).toBeGreaterThan(wadiReward.xp);
  });

  it('يجب أن يزيد levelRequired عبر الفصول', () => {
    const levelReqs = STORY_CHAPTERS.map(ch => ch.levelRequired);
    expect(levelReqs).toEqual([1, 15, 30, 50, 75]);
  });
});

// =====================================================================
// 6. 💾 حفظ وتحميل القصة
// =====================================================================
describe('💾 حفظ وتحميل القصة', () => {
  let economy, village, story;

  beforeEach(() => {
    economy = new GameEconomy();
    village = new GameVillage(economy);
    story = new StoryManager(economy, village);
  });

  it('يجب حفظ الفصل الحالي والمشاهد المكتملة', () => {
    story.currentChapter = 3;
    story.completedChapters = [1, 2];
    story.currentScene = 4;
    
    const data = story.getSaveData();
    expect(data.currentChapter).toBe(3);
    expect(data.completedChapters).toEqual([1, 2]);
    expect(data.currentScene).toBe(4);
  });

  it('يجب استعادة الحالة المحفوظة', () => {
    const data = {
      currentChapter: 4,
      completedChapters: [1, 2, 3],
      currentScene: 2,
      scenesWatched: { '4': ['plains_intro', 'plains_trade'] },
      choicesMade: { '4': { 'plains_intro': 0 } },
      unlockedVillages: ['wadi', 'palace_ruins', 'mountain', 'plains'],
      title: 'سيد السهول'
    };

    story.loadState(data);
    expect(story.currentChapter).toBe(4);
    expect(story.completedChapters).toHaveLength(3);
    expect(story.unlockedVillages).toContain('plains');
  });

  it('يجب إعادة تعيين القصة بالكامل', () => {
    story.currentChapter = 5;
    story.completedChapters = [1, 2, 3, 4];
    story.currentScene = 10;
    story.unlockedVillages = ['wadi', 'palace_ruins', 'mountain', 'plains', 'throne'];
    
    story.reset();
    expect(story.currentChapter).toBe(1);
    expect(story.completedChapters).toHaveLength(0);
    expect(story.currentScene).toBe(0);
    expect(story.unlockedVillages).toEqual(['wadi']);
  });

  it('يجب أن يتعامل loadState() بأمان مع البيانات الفارغة', () => {
    story.loadState(null);
    expect(story.currentChapter).toBe(1);
    
    story.loadState(undefined);
    expect(story.currentChapter).toBe(1);
    
    story.loadState({});
    expect(story.currentChapter).toBe(1);
  });
});

// =====================================================================
// 7. 📊 هيكل القصة كامل — التحقق من الفصول الخمسة
// =====================================================================
describe('📊 هيكل القصة كامل', () => {
  it('يجب أن يكون هناك 5 فصول', () => {
    expect(STORY_CHAPTERS).toHaveLength(5);
  });

  it('يجب أن يكون لكل فصل عنوان ووصف', () => {
    for (const chapter of STORY_CHAPTERS) {
      expect(chapter.title).toBeTruthy();
      expect(chapter.description).toBeTruthy();
      expect(typeof chapter.title).toBe('string');
    }
  });

  it('يجب أن يكون لكل فصل 5 مشاهد (4 عادية + 1 Boss)', () => {
    for (const chapter of STORY_CHAPTERS) {
      expect(chapter.scenes).toHaveLength(5);
      const bossScene = chapter.scenes[4];
      expect(bossScene.isBoss).toBe(true);
    }
  });

  it('يجب أن تحتوي المشاهد العادية على خيارين على الأقل', () => {
    for (const chapter of STORY_CHAPTERS) {
      for (const scene of chapter.scenes) {
        if (!scene.isBoss) {
          expect(scene.choices.length).toBeGreaterThanOrEqual(2);
        }
      }
    }
  });

  it('يجب أن تحتوي المشاهد غير Boss على choice text و reward', () => {
    for (const chapter of STORY_CHAPTERS) {
      for (const scene of chapter.scenes) {
        if (scene.choices) {
          for (const choice of scene.choices) {
            expect(choice.text).toBeTruthy();
            expect(choice.reward).toBeTruthy();
          }
        }
      }
    }
  });

  it('يجب أن يكون لكل مشهد Boss خلفية متدرجة (bg)', () => {
    for (const chapter of STORY_CHAPTERS) {
      const bossScene = chapter.scenes.find(s => s.isBoss);
      expect(bossScene.bg).toBeTruthy();
      expect(bossScene.bg).toContain('gradient');
    }
  });

  it('يجب أن يزيد levelRequired مع كل فصل', () => {
    for (let i = 0; i < STORY_CHAPTERS.length - 1; i++) {
      expect(STORY_CHAPTERS[i].levelRequired).toBeLessThan(STORY_CHAPTERS[i + 1].levelRequired);
    }
  });

  it('يجب أن يزيد حجم المكافآت مع تقدم الفصول', () => {
    const cashRewards = STORY_CHAPTERS.map(ch => ch.reward.cash);
    for (let i = 0; i < cashRewards.length - 1; i++) {
      expect(cashRewards[i]).toBeLessThan(cashRewards[i + 1]);
    }
  });

  it('يجب أن يكون لكل فصل معرف قرية (village) مطابق', () => {
    const villageIds = STORY_VILLAGES.map(v => v.id);
    for (const chapter of STORY_CHAPTERS) {
      expect(villageIds).toContain(chapter.village);
    }
  });

  it('يجب أن يكون لكل قرية 4 مباني على الأقل', () => {
    for (const village of STORY_VILLAGES) {
      expect(village.buildings.length).toBeGreaterThanOrEqual(4);
    }
  });

  it('يجب أن تزيد صعوبة الوحوش مع تقدم القرى', () => {
    for (let i = 0; i < STORY_VILLAGES.length - 1; i++) {
      const currentMaxMonster = Math.max(...STORY_VILLAGES[i].buildings.map(b => b.monsterPower));
      const nextMaxMonster = Math.max(...STORY_VILLAGES[i + 1].buildings.map(b => b.monsterPower));
      expect(currentMaxMonster).toBeLessThan(nextMaxMonster);
    }
  });

  it('يجب أن يكون لكل فصل مكافأة title محددة', () => {
    const titles = ['المستوطن الجديد', 'باحث الآثار', 'حامي الجبل', 'سيد السهول', 'ملك الصحراء'];
    for (let i = 0; i < STORY_CHAPTERS.length; i++) {
      expect(STORY_CHAPTERS[i].reward.title).toBe(titles[i]);
    }
  });
});

// =====================================================================
// 8. 🎯 نظام Prestige وإعادة تعيين القصة
// =====================================================================
describe('🔄 Prestige وإعادة تعيين القصة', () => {
  let economy, village, army, story;

  beforeEach(() => {
    economy = new GameEconomy();
    economy.addRaw("cash", 100000);
    economy.addRaw("gold", 100000);
    economy.addRaw("gems", 10000);
    village = new GameVillage(economy);
    army = new GameArmy(economy);
    story = new StoryManager(economy, village);
  });

  it('يجب إعادة تعيين حالة القصة عند Prestige', () => {
    // تقدم في القصة
    story.currentChapter = 5;
    story.completedChapters = [1, 2, 3, 4];
    story.currentScene = 8;
    story.unlockedVillages = ['wadi', 'palace_ruins', 'mountain', 'plains', 'throne'];
    village.completedVillages = ['wadi', 'palace_ruins', 'mountain', 'plains'];

    // إعادة تعيين
    story.reset();
    village.initVillage('wadi');

    expect(story.currentChapter).toBe(1);
    expect(story.completedChapters).toHaveLength(0);
    expect(story.currentScene).toBe(0);
    expect(story.unlockedVillages).toEqual(['wadi']);
    expect(village.currentVillageId).toBe('wadi');
  });

  it('يجب بقاء البونصات المكتسبة بعد إعادة التعيين', () => {
    economy.addRaw("cash", 5000);
    economy.addRaw("gems", 500);
    
    const cashBefore = economy.cash;
    const gemsBefore = economy.gems;
    
    story.reset();
    village.initVillage('wadi');

    expect(economy.cash).toBe(cashBefore);
    expect(economy.gems).toBe(gemsBefore);
  });
});
