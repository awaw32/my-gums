import { GameEconomy, getXpForLevel } from "./economy.js";
import { GameVillage } from "./village.js";
import { GameArmy } from "./army.js";
import { GameUI } from "./ui.js";
import { WorldMap } from "./world.js";
import { AssetManager } from "./asset-manager.js";
import { AudioManager } from "./audio.js";
import { saveGame, loadGame } from "./save.js";
import { QuestManager } from "./quests.js";
import { OasisManager } from "./oasis-manager.js";
import { UpgradeTree } from "./upgrade-tree.js";
import { AllianceManager } from "./alliance-manager.js";
import { AchievementManager } from "./achievements.js";
import { DailyLoginManager } from "./daily-login.js";
import { PrestigeManager } from "./prestige.js";
import { InventoryManager } from "./inventory.js";
import { EventManager } from "./events.js";
import { TutorialManager } from "./tutorial.js";
import { GameStore } from "./game-store.js";
import { NetworkSync } from "./network-sync.js";
import { WorldUpgradesUI } from "./ui/world-upgrades.js";
import { GameHero } from "./hero.js";
import { StoryManager } from "./story-manager.js";

const API_BASE = ""; // سيرفر اللعبة يخدم الـ API والواجهة من نفس المنفذ 

function getOrPromptUsername() {
  const saved = localStorage.getItem("player_username");
  if (saved && saved.trim()) return saved.trim();

  const overlay = document.createElement("div");
  overlay.id = "name-overlay";
  overlay.innerHTML = `
    <div class="name-overlay-content">
      <div class="name-overlay-crown">👑</div>
      <h1 class="name-overlay-title">ملك الصحراء</h1>
      <p class="name-overlay-sub">أدخل اسمك لتبدأ المغامرة</p>
      <input type="text" id="name-input" class="name-input" placeholder="اسمك في اللعبة..." maxlength="20" dir="rtl" autofocus />
      <button id="name-submit-btn" class="name-submit-btn">🚀 ابدأ المغامرة</button>
    </div>
  `;
  Object.assign(overlay.style, {
    position: "fixed", inset: "0", zIndex: "10000",
    display: "flex", alignItems: "center", justifyContent: "center",
    background: "var(--bg-page)",
  });
  document.body.appendChild(overlay);

  const input = overlay.querySelector("#name-input");
  const btn = overlay.querySelector("#name-submit-btn");

  const submit = () => {
    const name = input.value.trim() || "بطل الصحراء";
    localStorage.setItem("player_username", name);
    overlay.remove();
    return name;
  };

  return new Promise(resolve => {
    btn.onclick = () => { const name = submit(); resolve(name); };
    input.onkeydown = e => { if (e.key === "Enter") btn.click(); };
    setTimeout(() => input?.focus(), 200);
  });
}

async function loadFromDatabase(economy, army, village, username) {
  try {
    const response = await fetch(`${API_BASE}/api/players/${encodeURIComponent(username)}`);
    const data = await response.json();
    if (data && data.cash !== undefined) {
      economy.cash = data.cash;
      economy.gems = data.gems || 0;
      economy.gold = data.gold || 0;
      economy.hammers = data.hammers || 0;
      economy.scrolls = data.scrolls || 0;
      economy.resources.food = data.food ?? 50;
      economy.level = data.level || 1;
      economy.xp = data.xp || 0;
      economy.xpToNext = getXpForLevel(economy.level);
      if (data.currentVillageId && data.currentVillageId !== village.currentVillageId) {
        village.initVillage(data.currentVillageId);
      }
      army.unitLevel = data.unitLevel || 1;
      army.trainingLevel = data.trainingLevel || 1;
      economy.buildings = data.buildings || {};
      economy.research = data.research || {};
      if (data.weapons && Array.isArray(data.weapons)) {
        for (const wd of data.weapons) {
          const w = army.weapons.find(ww => ww.id === wd.id);
          if (w) {
            w.level = wd.level || 0;
            w.upgradeLevel = wd.upgradeLevel ?? (wd.level > 0 ? wd.level * 8 : 0);
            if (wd.starLevel) w.starLevel = wd.starLevel;
            if (wd.gemLevel) w.gemLevel = wd.gemLevel;
          }
        }
      }
      window._loadedLandsState = data.landsState || null;
      // تخزين مؤقت لبيانات التحالف والترقيات والواحات لاستخدامها لاحقاً
      window._loadedAllianceLevel = data.allianceLevel ?? 0;
      window._loadedUpgrades = data.upgrades || {};
      window._loadedOases = data.oases || [];
      window._loadedAchievements = data.achievements || null;
      window._loadedDailyLogin = data.dailyLogin || null;
      window._loadedPrestige = data.prestigeLevel ?? 0;
      window._loadedInventory = data.inventory || null;
      window._loadedEvents = data.events || null;
      window._loadedTutorial = data.tutorial || null;
      window._loadedStory = data.story || null;
      window._brWins = data.brWins ?? 0;
      window._brKills = data.brKills ?? 0;
      window._loadedHero = data.hero || null;
      console.log("✅ [API] تم استعادة بياناتك من قاعدة البيانات!");
    }
  } catch (err) {
    console.warn("⚠️ [API] لم يتم العثور على بيانات سابقة، سنبدأ من الصفر:", err.message);
  }
}

async function init() {
  const loadingFill = document.getElementById("loading-progress");
  const loadingPct = document.getElementById("loading-pct");
  const loadingScreen = document.getElementById("loading-screen");
  const appShell = document.getElementById("app-shell");

  function setProgress(pct) {
    if (loadingFill) loadingFill.style.width = pct + "%";
    if (loadingPct) loadingPct.textContent = pct + "%";
  }

  setProgress(10);
  const PLAYER_USERNAME = await getOrPromptUsername();
  setProgress(20);
  
  const economy = new GameEconomy();
  const village = new GameVillage(economy);
  const army = new GameArmy(economy);

  // تحميل localStorage أولاً كنسخة احتياطية سريعة
  const { lastSave } = loadGame(economy, village, army);

  // ثم تحميل من قاعدة البيانات (الرسمية) — يلغي بيانات localStorage
  await loadFromDatabase(economy, army, village, PLAYER_USERNAME);
  
  const hasSavedData = economy.level > 1 || economy.xp > 0 || economy.cash > 0 || 
                       economy.gold > 0 || economy.gems > 0 || 
                       (economy.buildings && Object.keys(economy.buildings).length > 0);
  
  const oasisManager = new OasisManager(economy);
  const upgradeTree = new UpgradeTree(economy);
  const allianceManager = new AllianceManager(economy);
  const quests = new QuestManager(economy, army, village); 
  const world = new WorldMap(economy, PLAYER_USERNAME, API_BASE, army);
  const store = new GameStore();
  const netSync = new NetworkSync(API_BASE, PLAYER_USERNAME);
  world.netSync = netSync;
  netSync.world = world;
  world.store = store;
  const wu = new WorldUpgradesUI(world);
  const assets = new AssetManager();
  const audio = new AudioManager();
  const hero = new GameHero();
  const achievements = new AchievementManager(economy);
  const dailyLogin = new DailyLoginManager(economy);
  const prestige = new PrestigeManager(economy, village, army);
  const inventory = new InventoryManager(economy);
  const events = new EventManager();
  const tutorial = new TutorialManager();
  const storyManager = new StoryManager(economy, village);
  window._storyManager = storyManager;
  
  setProgress(80);

  // استعادة بيانات التحالف والترقيات والواحات من التخزين المؤقت
  if (window._loadedAllianceLevel !== undefined) allianceManager.loadState(window._loadedAllianceLevel);
  if (window._loadedUpgrades) upgradeTree.loadState(window._loadedUpgrades);
  if (window._loadedOases) oasisManager.loadState(window._loadedOases);
  if (window._loadedAchievements) achievements.loadState(window._loadedAchievements);
  if (window._loadedDailyLogin) dailyLogin.loadState(window._loadedDailyLogin);
  if (window._loadedPrestige !== 0 && window._loadedPrestige !== undefined) prestige.loadState(window._loadedPrestige);
  if (window._loadedInventory) inventory.loadState(window._loadedInventory);
  if (window._loadedEvents) events.loadState(window._loadedEvents);
  if (window._loadedTutorial) tutorial.loadState(window._loadedTutorial);
  if (window._loadedStory) storyManager.loadState(window._loadedStory);
  if (window._loadedHero) hero.loadState(window._loadedHero);
  delete window._loadedAllianceLevel;
  delete window._loadedUpgrades;
  delete window._loadedOases;
  delete window._loadedAchievements;
  delete window._loadedDailyLogin;
  delete window._loadedPrestige;
  delete window._loadedInventory;
  delete window._loadedEvents;
  delete window._loadedTutorial;
  delete window._loadedStory;
  delete window._loadedHero;
  if (window._loadedLandsState) {
    window._pendingLandsState = window._loadedLandsState;
    delete window._loadedLandsState;
  }
  
  // 🎁 بونص ترحيبي للاعب الجديد (1000 من كل عملة)
  if (!hasSavedData) {
    economy.addRaw("cash", 1000);
    economy.addRaw("gems", 1000);
    economy.addRaw("gold", 1000);
    economy.addRaw("hammers", 1000);
    economy.addRaw("scrolls", 1000);
    economy.addRaw("food", 500);
    console.log("🎉 [بونص] تم منح الرصيد الترحيبي للاعب الجديد!");
    // حفظ فوري في قاعدة البيانات عشان ما يضيع البونص
    try {
      fetch(`${API_BASE}/api/players/${encodeURIComponent(PLAYER_USERNAME)}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cash: economy.cash, gems: economy.gems, gold: economy.gold, hammers: economy.hammers, scrolls: economy.scrolls, food: economy.food, army_power: economy.power, unitLevel: 1, weapons: [], last_active: Date.now() })
      }).catch(e => console.warn("[Save] welcome bonus save:", e.message));
    } catch (e) { console.warn("[Save] welcome bonus error:", e.message); }
  } else {
    // حفظ حالة الدخول
    try {
      fetch(`${API_BASE}/api/players/${encodeURIComponent(PLAYER_USERNAME)}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ last_active: Date.now() })
      }).catch(e => console.warn("[Save] login ping save:", e.message));
    } catch (e) { console.warn("[Save] login ping error:", e.message); }
  }

  // حساب المكافآت غير المتصلة (Offline Rewards)
  if (lastSave && lastSave > 0) {
    const offlineSeconds = Math.floor((Date.now() - lastSave) / 1000);
    if (offlineSeconds > 60) {
      const incomeRate = village.getIncomeRate();
      const oasisIncome = oasisManager.totalIncome;
      const villageCash = Math.floor(incomeRate * offlineSeconds * 0.5);
      const oasisGold = Math.floor(oasisIncome * offlineSeconds * 0.5);
      const armyFood = Math.floor(8 * offlineSeconds * 0.02);

      if (villageCash > 0 || oasisGold > 0) {
        economy.addRaw("cash", villageCash);
        economy.addRaw("gold", oasisGold);
        if (armyFood > 0) economy.resources.food = Math.max(0, economy.food - armyFood);

        const rewardsList = document.getElementById("offline-rewards-list");
        const offlineTimeText = document.getElementById("offline-time-text");
        const offlinePopup = document.getElementById("offline-rewards-popup");

        if (offlineTimeText) {
          const hours = Math.floor(offlineSeconds / 3600);
          const mins = Math.floor((offlineSeconds % 3600) / 60);
          offlineTimeText.textContent = hours > 0
            ? `لقد غبت لمدة ${hours} ساعة و ${mins} دقيقة`
            : `لقد غبت لمدة ${mins} دقيقة`;
        }

        if (rewardsList) {
          rewardsList.innerHTML = "";
          if (villageCash > 0) {
            rewardsList.innerHTML += `<div class="offline-reward-item"><span class="reward-icon">💵</span><span class="reward-label">دخل القرية</span><span class="reward-amount">+${villageCash.toLocaleString()}</span></div>`;
          }
          if (oasisGold > 0) {
            rewardsList.innerHTML += `<div class="offline-reward-item"><span class="reward-icon">🪙</span><span class="reward-label">ذهب الواحات</span><span class="reward-amount">+${oasisGold.toLocaleString()}</span></div>`;
          }
          if (armyFood > 0) {
            rewardsList.innerHTML += `<div class="offline-reward-item"><span class="reward-icon">🌾</span><span class="reward-label">استهلاك الجيش</span><span class="reward-amount">-${armyFood.toLocaleString()}</span></div>`;
          }
        }

        if (offlinePopup) {
          offlinePopup.classList.remove("hidden");
          const claimBtn = document.getElementById("offline-claim-btn");
          if (claimBtn) {
            claimBtn.onclick = () => {
              offlinePopup.classList.add("hidden");
              audio.playSound('offline');
            };
          }
        }

        audio.playSound('offline');
      }
    }
  }

  setProgress(100);

  if (loadingScreen) loadingScreen.classList.add("fade-out");
  if (appShell) appShell.classList.remove("hidden");

    const ui = new GameUI(village, army, economy, world, oasisManager, upgradeTree, allianceManager, achievements, dailyLogin, prestige, inventory, events, tutorial, store, quests);
    world.onExit = () => ui.exitWorldMap();

    // ربط العالم بأنظمة الترقيات والتحالف
    world._allianceManager = allianceManager;
    world._upgradeTree = upgradeTree;

    // تسجيل مصادر القوة (powerSources) — بدونه يكون power = 0 دائماً
    economy.powerSources.push(() => village.getPower());
    economy.powerSources.push(() => army.totalArmyPower || army.unitLevel * 10);
    economy.powerSources.push(() => Math.floor(economy.level * 5));
    economy.powerSources.push(() => allianceManager.level * 10);
    economy.powerSources.push(() => prestige.level * 50);
    economy.powerSources.push(() => hero.powerContribution);

    // ربط إنجازات المباني
    village.setBuildingCallbacks(
      (b) => { achievements.updateProgress('builds', 1); audio.playSound('build'); hero.addXp(10); },
      (b) => { achievements.updateProgress('upgrades', 1); audio.playSound('upgrade'); hero.addXp(8); }
    );

    // ربط إنجازات الواحات
    const _oasisOrig = oasisManager._onOasesChanged;
    oasisManager._onOasesChanged = (state) => {
      if (_oasisOrig) _oasisOrig(state);
      const captured = state.filter(o => o.captured).length;
      achievements.updateProgress('oases', captured);
    };

    // ربط army_level + مهام التدريب
    const origArmyUpgrade = army.upgradeUnits.bind(army);
    army.upgradeUnits = function() {
      const result = origArmyUpgrade();
      if (result) {
        achievements.updateProgress('army_level', this.unitLevel);
        quests.updateProgress('train', 1);
      }
      return result;
    };

    // ربط alliance_level
    const origAllianceUpgrade = allianceManager.upgrade.bind(allianceManager);
    allianceManager.upgrade = function() {
      const result = origAllianceUpgrade();
      if (result) achievements.updateProgress('alliance_level', this.level);
      return result;
    };

    // ربط ترقيات الجيش/المعرفة/الدفاع/التجارة بالإنجازات
    const _upgradeOrig = upgradeTree._onChanged;
    upgradeTree._onChanged = (pathId, level) => {
      if (_upgradeOrig) _upgradeOrig(pathId, level);
      if (pathId === 'army') achievements.updateProgress('upgrade_damage', level);
      else if (pathId === 'defense') achievements.updateProgress('upgrade_defense', level);
      else if (pathId === 'trade') achievements.updateProgress('upgrade_capacity', level);
      else if (pathId === 'knowledge') achievements.updateProgress('upgrade_speed', level);
      if (world.sessionStats) world.sessionStats.upgradesToday++;
    };

    // ربط cash_earned (من قتل الوحوش + دخل المباني)
    world._onCashEarned = (amount) => {
      achievements.updateProgress('cash_earned', amount);
    };
    economy._onCashEarned = (amount) => {
      achievements.updateProgress('cash_earned', amount);
    };

    // ربط الإنجازات اليومية (كل استلام = +1 بغض النظر عن streak)
    dailyLogin._onClaim = (day, reward) => {
      achievements.updateProgress('login_days', 1);
      ui.showNotification(`📅 يوم ${day}: حصلت على ${reward.label}`);
    };

    const saveToDB = () => {
      const landsState = ui._landsState || {};
      fetch(`${API_BASE}/api/players/${encodeURIComponent(PLAYER_USERNAME)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cash: economy.cash,
          gems: economy.gems,
          gold: economy.gold,
          hammers: economy.hammers,
          scrolls: economy.scrolls,
          food: economy.food,
          army_power: economy.power,
          unitLevel: army.unitLevel,
          trainingLevel: army.trainingLevel,
          weapons: army.weapons.map(w => ({ id: w.id, level: w.level || 0, upgradeLevel: w.upgradeLevel || 0, starLevel: w.starLevel || 1, gemLevel: w.gemLevel || 1 })),
          equippedWeapon: world._equippedWeapon || "",
          armyYardLevel: economy.armyYardLevel || 1,
          knowledgeLevel: economy.knowledgeLevel || 1,
          knowledgeType: economy.knowledgeType || "economic",
          buildings: economy.buildings || {},
          research: economy.research || {},
          x_position: world.leader ? Math.floor(world.leader.x) : 0,
          y_position: world.leader ? Math.floor(world.leader.y) : 0,
          xp: economy.xp,
          level: economy.level,
          allianceLevel: allianceManager.level,
          upgrades: upgradeTree.levels,
          oases: oasisManager.getState().map(o => ({ id: o.id, captured: o.captured })),
          prestigeLevel: prestige.level,
          achievements: achievements.getSaveData(),
          dailyLogin: dailyLogin.getSaveData(),
          inventory: inventory.getSaveData(),
          events: events.getSaveData(),
          tutorial: tutorial.getSaveData(),
          story: storyManager.getSaveData(),
          brWins: window._brWinsGlobal || 0,
          brKills: window._brKillsGlobal || 0,
          landsState: landsState,
          hero: hero.getSaveData(),
          last_active: Date.now()
        })
      }).catch(e => console.warn("[Save] saveToDB:", e.message));
    };

    ui._onSave = saveToDB;
    ui.setShopBuyCallback(function shopBuy(item) {
      switch (item) {
        case "unit":
            if (army.unitLevel < army.maxUnitLevel) {
            const cost = army.unitUpgradeCost;
            if (economy.spend("cash", cost)) {
              army.unitLevel++;
              achievements.updateProgress('army_level', army.unitLevel);
              audio.playSound('upgrade');
              saveToDB();
              ui.updateTopBar();
            }
          }
          break;

        case "heal":
          if (economy.spend("cash", 20)) {
            if (world.leader) {
              world.leader.hp = Math.min(world.leader.maxHp, world.leader.hp + 30);
            }
            audio.playSound('heal');
            saveToDB();
            ui.updateTopBar();
          }
          break;

        default:
          const weapon = army.weapons.find(w => w.id === item);
          if (weapon) {
            const houseLevel = ui._landsState?.['b1']?.level || 1;
            if (weapon.upgrade(economy, houseLevel)) {
              achievements.updateProgress('weapon_max', weapon.level);
              audio.playSound('upgrade');
              saveToDB();
              ui.updateTopBar();
              ui.showNotification(`⬆️ ${weapon.name} → المستوى ${weapon.level}/5 ⭐`);
            } else {
              ui.showNotification(`❌ مجوهرات غير كافية أو مستوى بيت الزعيم منخفض`);
            }
          }
          break;
      }
    });

    // ربط أحداث الإنجازات الأخرى
    economy._onLevelUp = (lvl) => {
      ui.showNotification(`🎉 ترقيت إلى المستوى ${lvl}!`);
      audio.playSound('levelup');
      ui.updateTopBar();
      achievements.updateProgress('player_level', lvl);
      hero.addXp(30);
      // فتح المباني المقفلة عند الوصول للمستوى المناسب
      ui.checkBuildingUnlocks(lvl);
    };

    // توصيل الأصوات والإنجازات والمهام بأحداث اللعبة
    world._onMonsterKilled = () => {
      audio.playSound('kill');
      achievements.updateProgress('kills', 1);
      hero.addXp(15);
      quests.updateProgress('kill', 1);
      // cash_earned يُتبع في damageMonster عبر _onCashEarned(reward)
    };
    world._onDropCollected = () => {
      audio.playSound('collect');
      // drop value يُتبع في collectDrop عبر _onCashEarned
    };
    world._onPvPWin = () => {
      audio.playSound('levelup');
      achievements.updateProgress('pvp_wins', 1);
      hero.addXp(50);
    };
    world._onPvPLose = () => audio.playSound('hit');
    world._onPvPReturn = async () => {
      await world.exitWorldMap();
    };

    // توصيل الإنجازات والمهام
    economy._onGoldEarned = (amount) => {
      achievements.updateProgress('gold_earned', amount);
      quests.updateProgress('collect', amount);
    };
    inventory._onCrafted = () => {
      achievements.updateProgress('crafts', 1);
    };
    achievements._onUnlock = (a) => {
      ui.showNotification(`🏆 إنجاز: ${a.title} — ${a.desc}`);
      audio.playSound('levelup');
    };

    quests._onQuestCompleted = (q) => {
      ui.showNotification(`📜 اكتملت المهمة: ${q.title} — حصلت على المكافأة!`);
      audio.playSound('levelup');
    };

    hero._onLevelUp = (lvl) => {
      ui.showNotification(`🦸 البطل وصل المستوى ${lvl}!`);
      audio.playSound('hero_levelup');
      hero.maxHp = 120 + (lvl - 1) * 10;
      hero.hp = hero.maxHp;
    };

    hero._onAbilityUnlock = (key, ab) => {
      ui.showNotification(`🔓 قدرة جديدة: ${key} متاحة!`);
      audio.playSound('ability');
    };



    // ربط الأحداث (EventManager) بالاقتصاد والعالم والواحات للمضاعفات
    economy._events = events;
    world._events = events;
    oasisManager._events = events;

    // ربط بونص XP من Prestige
    economy._prestige = prestige;

    // توصيل Prestige
    prestige._onPrestige = (lvl) => {
      ui.showNotification(`🔄 Prestige ${lvl}! القوة تتضاعف!`);
      achievements.updateProgress('prestige', 1);
      saveToDB();
      if (world.leader) world.leader.maxHp = 100 + lvl * 20;
      if (world.leader) world.leader.hp = world.leader.maxHp;
    };

    // توصيل Tutorial
    tutorial._onComplete = () => {
      ui.showNotification('🎉 أكملت البرنامج التعليمي!');
      const tutEl = document.getElementById('tutorial-overlay');
      if (tutEl) tutEl.style.display = 'none';
    };

    // زر كتم الصوت
    const muteBtn = document.getElementById('mute-btn');
    if (muteBtn) {
      const muteIcon = document.getElementById('mute-icon') || muteBtn;
      const muteLabel = document.getElementById('mute-label');
      muteBtn.onclick = () => {
        audio.toggleMute();
        if (muteIcon !== muteBtn) muteIcon.textContent = audio.muted ? '🔇' : '🔊';
        else muteBtn.textContent = audio.muted ? '🔇' : '🔊';
        if (muteLabel) muteLabel.textContent = audio.muted ? 'تشغيل الصوت' : 'كتم الصوت';
        audio.playSound('click');
      };
    }

    // لوحة البطل
    const heroPanel = document.getElementById('hero-panel');
    const heroCloseBtn = document.getElementById('hero-close-btn');
    const heroToggleBtn = document.getElementById('hero-toggle-btn');
    if (heroCloseBtn) {
      heroCloseBtn.onclick = () => {
        if (heroPanel) heroPanel.classList.add('hidden');
      };
    }
    if (heroToggleBtn) {
      heroToggleBtn.onclick = () => {
        if (heroPanel) heroPanel.classList.toggle('hidden');
        audio.playSound('click');
      };
    }

    // أزرار قدرات البطل
    const heroAbilityBtns = {
      'hero-ability-1': 'heal',
      'hero-ability-2': 'powerStrike',
      'hero-ability-3': 'shield',
      'hero-ability-4': 'rally',
    };

    for (const [btnId, abilityKey] of Object.entries(heroAbilityBtns)) {
      const btn = document.getElementById(btnId);
      if (btn) {
        btn.onclick = () => {
          if (hero.useAbility(abilityKey)) {
            audio.playSound('ability');
            const abilityNames = {
              heal: '💚 علاج البطل',
              powerStrike: '⚡ ضربة قوية',
              shield: '🛡️ درع الحماية',
              rally: '📯 نداء الحرب'
            };
            const abilityDescs = {
              heal: `+${Math.floor(hero.maxHp * 0.4)} HP`,
              powerStrike: `ضرر ×1.8 لمدة 20 ث`,
              shield: `دفاع +15 لمدة 8 ث`,
              rally: `قوة الجيش +30% لمدة 10 ث`
            };
            ui.showNotification(`${abilityNames[abilityKey] || '⚡ قدرة'} — ${abilityDescs[abilityKey] || ''}`);
            if (btn) {
              btn.classList.add('ability-flash');
              setTimeout(() => btn.classList.remove('ability-flash'), 600);
            }
          } else {
            audio.playSound('error');
          }
        };
      }
    }

    // تخزين مؤقت لتنظيف الفواصل لاحقاً
    const _gameIntervals = [];

    // تحديث واجهة البطل كل ثانية
    const heroInterval = setInterval(() => {
      const levelLabel = document.getElementById('hero-level-label');
      const xpFill = document.getElementById('hero-xp-fill');
      const xpText = document.getElementById('hero-xp-text');
      const hpEl = document.getElementById('hero-hp');
      const dmgEl = document.getElementById('hero-dmg');
      const defEl = document.getElementById('hero-def');

      if (levelLabel) levelLabel.textContent = `المستوى ${hero.level}`;
      if (xpFill) xpFill.style.width = `${Math.min(100, (hero.xp / hero.xpToNext) * 100)}%`;
      if (xpText) xpText.textContent = `${hero.xp}/${hero.xpToNext}`;
      if (hpEl) hpEl.textContent = hero.hp;
      if (dmgEl) dmgEl.textContent = hero.damage;
      if (defEl) defEl.textContent = hero.defense;

      for (const [btnId, abilityKey] of Object.entries(heroAbilityBtns)) {
        const btn = document.getElementById(btnId);
        const ab = hero.abilities[abilityKey];
        if (btn && ab) {
          btn.disabled = !ab.unlocked || ab.cooldown > 0;
          btn.classList.toggle('active-ability', ab.active);
          const descEl = btn.querySelector('.hero-ab-desc');
          if (descEl) {
            if (!ab.unlocked) {
              descEl.textContent = `Lv.${ab.levelReq}`;
            } else if (ab.cooldown > 0) {
              descEl.textContent = `${Math.ceil(ab.cooldown)}s`;
            } else {
              descEl.textContent = 'جاهز';
            }
          }
        }
      }
    }, 1000);
    _gameIntervals.push(heroInterval);

    // ====== Battle Royale ======
    const brBtn = document.getElementById('br-enter-btn');
    const brVictoryBtn = document.getElementById('br-victory-btn');
    const brDefeatBtn = document.getElementById('br-defeat-btn');
    const brZoneWarningEl = document.getElementById('br-zone-warning');
    const brTimerEl = document.getElementById('br-timer');
    const brPlayersEl = document.getElementById('br-players');
    const brKillsEl = document.getElementById('br-kills');
    const brKillFeedEl = document.getElementById('br-kill-feed');
    const brVictoryScreen = document.getElementById('br-victory-screen');
    const brDefeatScreen = document.getElementById('br-defeat-screen');
    const brAliveCount = document.getElementById('br-alive-count');
    const brTotalCount = document.getElementById('br-total-count');
    const brKillCount = document.getElementById('br-kill-count');
    const brVictoryStats = document.getElementById('br-victory-stats');
    const brDefeatStats = document.getElementById('br-defeat-stats');

    if (brBtn) {
      brBtn.addEventListener('click', () => {
        // إخفاء واجهة القائمة وإظهار Canvas
        document.getElementById("gameCanvas")?.classList.remove("hidden");
        const topBar = document.getElementById("top-bar");
        const bottomBar = document.getElementById("bottom-bar");
        const subBar = document.getElementById("sub-bar");
        const content = document.getElementById("screen-content");
        const worldButtons = document.getElementById("world-buttons");
        const quickPanel = document.getElementById("quick-panel");
        if (topBar) topBar.style.display = "none";
        if (subBar) subBar.style.display = "none";
        if (quickPanel) quickPanel.style.display = "none";
        if (bottomBar) bottomBar.style.display = "none";
        if (content) content.style.display = "none";
        if (worldButtons) worldButtons.classList.remove("hidden");
        world.initBR();
        world.startBRMatch();
        ui.showNotification('🚀 بدأت المعركة الملكية! كن آخر من يبقى!');
      });
    }

    let brWins = window._brWins || 0;
    let brKillsTotal = window._brKills || 0;
    window._brWinsGlobal = brWins;
    window._brKillsGlobal = brKillsTotal;
    delete window._brWins;
    delete window._brKills;

    const onBRMatchEnd = (result) => {
      if (result.winner) {
        brWins++;
        brKillsTotal += result.kills || 0;
        if (brVictoryScreen) brVictoryScreen.classList.remove('hidden');
        if (brVictoryStats) brVictoryStats.textContent = `🏆 قضيت على ${result.kills || 0} أعداء`;
        economy.addRaw('gems', 100 + (result.kills || 0) * 10);
        saveToDB();
        fetch(`${API_BASE}/api/players/${encodeURIComponent(PLAYER_USERNAME)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ brWins, brKills: brKillsTotal, last_active: Date.now() })
        }).catch(e => console.warn("[Save] BR match save:", e.message));
        ui.updateTopBar();
      } else {
        if (brDefeatScreen) brDefeatScreen.classList.remove('hidden');
        if (brDefeatStats) brDefeatStats.textContent = `💀 قُتلت — قتلت ${result.kills || 0} أعداء`;
      }
    };
    world._onBRMatchEnd = onBRMatchEnd;
    netSync.onBRMatchEnd = onBRMatchEnd;
    // ربط شاشة الخسارة
    world._onWipe = (lost, killed) => {
      audio.playSound('hit');
    };

    store.on('notification', (data) => {
      if (!data || !data.text) return;
      ui.showNotification(data.text);
      if (data.text.includes('المنطقة تتصغر') && brZoneWarningEl) {
        brZoneWarningEl.classList.remove('hidden');
        clearTimeout(brZoneWarningEl._hideTimer);
        brZoneWarningEl._hideTimer = setTimeout(() => {
          if (brZoneWarningEl) brZoneWarningEl.classList.add('hidden');
        }, 2500);
      }
    });

    if (brVictoryBtn) {
      brVictoryBtn.addEventListener('click', async () => {
        if (brVictoryScreen) brVictoryScreen.classList.add('hidden');
        await world.exitWorldMap();
      });
    }

    if (brDefeatBtn) {
      brDefeatBtn.addEventListener('click', async () => {
        if (brDefeatScreen) brDefeatScreen.classList.add('hidden');
        await world.exitWorldMap();
      });
    }

    let brLastFeedLen = 0;
    world._onBRKillFeed = (feed) => {
      if (!brKillFeedEl) return;
      if (feed.length === brLastFeedLen) return;
      brLastFeedLen = feed.length;
      brKillFeedEl.textContent = '';
      for (const k of feed) {
        if (k.time > 0) {
          const div = document.createElement('div');
          div.className = 'kill-msg';
          div.textContent = k.text;
          brKillFeedEl.appendChild(div);
        }
      }
    };

    store.on('players', (list) => {
      ui._lastPlayerList = list;
      ui.updatePlayerPanel(list);
      if (world.mode !== 'battle_royale') return;
      if (brAliveCount && brTotalCount) {
        const alive = list.filter(p => p.br_alive !== false).length + 1;
        brAliveCount.textContent = alive;
        brTotalCount.textContent = list.length + 1;
      }
    });

    // تشغيل الأحداث الدورية
    let eventTimer = 0;
    let lastPowerCheck = economy.power; // نبدأ من القوة الحالية عشان ما نضاعفش التتبع
    const eventsInterval = setInterval(() => {
      eventTimer += 15;
      events.update(15);
      // تتبع إنجازات القوة (فقط القمم الجديدة)
      const curPower = economy.power;
      if (curPower > lastPowerCheck) {
        achievements.updateProgress('power', curPower - lastPowerCheck);
        lastPowerCheck = curPower;
      }
      if (eventTimer > 300) {
        eventTimer = 0;
        // بدء أحداث عشوائية إذا لم يكن هناك حدث نشط
        if (events.getActiveEvents().length === 0) {
          const available = events.getAll().filter(e => !e.active);
          if (available.length > 0) {
            const pick = available[Math.floor(Math.random() * available.length)];
            events.startEvent(pick.id);
            ui.showNotification(`🎊 حدث جديد: ${pick.title} — ${pick.desc}`);
          }
        }
      }
    }, 15000);
    _gameIntervals.push(eventsInterval);

    // تشغيل حدث Gold Rush كبداية
    setTimeout(() => {
      events.startEvent('gold_rush');
      ui.showNotification('🎊 🏆 انهيار الذهب! الذهب من الوحوش ×2!');
    }, 60000);

    const economyInterval = setInterval(() => {
      economy.tick();
      village.update(15);
      economy.refreshIncome(village);
      oasisManager.tick(15); // 15 ثانية انقضت
      hero.tick(15);
      // إعادة تعيين عدادات التحديات اليومية عند تغيير اليوم
      if (world.sessionStats && world._lastChallengeDate !== new Date().toDateString()) {
        world.sessionStats.upgradesToday = 0;
        world.sessionStats.pvpWins = 0;
        world.sessionStats.kills = 0;
        world.sessionStats.coinsEarned = 0;
        world._lastChallengeDate = new Date().toDateString();
      }
      // مزامنة مستوى مباني الأراضي مع أنظمة اللعبة
      if (ui._landsState) {
        const b1 = ui._landsState['b1']; // بيت الزعيم
        const b2 = ui._landsState['b2']; // سكن الجنود
        const b3 = ui._landsState['b3']; // مستودع البضائع
        const b4 = ui._landsState['b4']; // ساحة التدريب
        if (b2) {
          army.barracksLevel = b2.level || 1;
          army.unitsCount = army.getMaxUnits(b2.level || 1);
        }
        // مستودع البضائع: كل لفل يزيد إنتاج الذهب بـ 10%
        if (b3 && b3.state === 'built' && b3.level > 0) {
          economy.b3GoldBonus = 1 + (b3.level - 1) * 0.10;
        }
        // ساحة التدريب: كل لفل يزيد قوة الجنود بـ 5%
        if (b4 && b4.state === 'built' && b4.level > 0) {
          army.b4TrainingBonus = 1 + (b4.level - 1) * 0.05;
        }
      }
      // استهلاك الطعام للجيش
      if (world.leader && world.running) {
        const aliveUnits = world.armyUnits.filter(u => u.hp > 0).length;
        const foodCost = aliveUnits * 0.5;
        if (economy.food >= foodCost) {
          economy.addRaw("food", -foodCost);
        } else {
          economy.food = 0;
          // الجوع يضر بالجيش
          for (const u of world.armyUnits) {
            if (u.hp > 0) u.hp = Math.max(0, u.hp - 2);
          }
          if (world.leader) world.leader.hp = Math.max(0, world.leader.hp - 1);
        }
      }
      saveToDB();
    }, 15000);
    _gameIntervals.push(economyInterval);

    // إتاحة تنظيف الفواصل من خارج الدالة
    window._cleanupGameIntervals = () => {
      for (const id of _gameIntervals) { clearInterval(id); }
      _gameIntervals.length = 0;
    };

    // تحقق من حالة قاعدة البيانات
    fetch(`${API_BASE}/health`).then(r => r.json()).then(h => {
      if (h.mongo === "connected") {
        console.log("💾 [DB] قاعدة البيانات متصلة ✅");
        ui.setDbStatus(true);
      } else {
        console.warn("💾 [DB] قاعدة البيانات غير متصلة — الحفظ في الذاكرة مؤقتاً");
      }
    }).catch(() => console.warn("💾 [DB] تعذر التحقق من حالة قاعدة البيانات"));
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
init();