import { GameEconomy, getXpForLevel } from "./economy.js";
import { GameVillage } from "./village.js";
import { GameArmy } from "./army.js";
import { GameUI } from "./ui.js";
import { WorldMap } from "./world.js";
import { spawnLevelUp, spawnGoldBurst, spawnXpGain } from "./particles.js";
import { celebrate } from "./celebrations.js";
import { AssetManager } from "./asset-manager.js";
import { AudioManager } from "./audio.js";
import { saveGame, loadGame, persistGameSession } from "./save.js";
import { QuestManager } from "./quests.js";
import { OasisManager } from "./oasis-manager.js";
import { UpgradeTree } from "./upgrade-tree.js";
import { AllianceManager } from "./alliance-manager.js";
import { WarManager } from "./war-manager.js";
import { NotificationManager } from "./notification-manager.js";
import { AchievementManager } from "./achievements.js";
import { DailyLoginManager } from "./daily-login.js";
import { PrestigeManager } from "./prestige.js";
import { InventoryManager } from "./inventory.js";
import { DroppedItemsManager } from "./dropped-items.js";
import { EventManager } from "./events.js";
import { TutorialManager } from "./tutorial.js";
import { GameStore } from "./game-store.js";
import { NetworkSync } from "./network-sync.js";
import { ResearchTree } from "./research-tree.js";
import { GameHero } from "./hero.js";
import { StoryManager } from "./story-manager.js";
import { LoadoutManager } from "./loadout-manager.js";
import { TradeMarket } from "./trade-market.js";
import { ReputationManager } from "./reputation-manager.js";
import { errorLogger } from "./error-logger.js";
import { networkManager } from "./network-manager.js";

const API_BASE = ""; // سيرفر اللعبة يخدم الـ API والواجهة من نفس المنفذ

function sanitizeUsername(name) {
  return name.replace(/[^\w\s\u0600-\u06FF-]/g, '').trim().slice(0, 20) || 'بطل الصحراء';
}

function sanitizePassword(pw) {
  return typeof pw === 'string' ? pw.slice(0, 128) : '';
}

// ═══════════════════════════════════════════════════════════════════
//  🛡️ نظام تسجيل الدخول الجديد (2026-07-13)
//  - يدعم التوافق العكسي للحسابات القديمة (بدون كلمة مرور)
//  - الحسابات الجديدة تتطلب كلمة مرور (4 أحرف كحد أدنى)
//  - يتم تخزين كلمة المرور في localStorage لإعادة الدخول التلقائي
// ═══════════════════════════════════════════════════════════════════
async function tryLogin(username, password, isGuest = false) {
  try {
    const data = await networkManager.post('/api/auth/login', { username, password, isGuest }, { timeout: 8000 });
    localStorage.setItem("player_token", data.token);
    return { ok: true, isNew: !!data.isNew, passwordUpgraded: !!data.passwordUpgraded, username: data.username };
  } catch (err) {
    if (err?.name === 'AbortError') return { ok: false, error: 'تعذر الاتصال بالخادم', status: 0 };
    return { ok: false, error: err?.message || 'خطأ في الشبكة', status: err?.status || 0 };
  }
}

async function getOrPromptUsername() {
  // ── محاولة الدخول التلقائي عبر التحقق من صلاحية التوكن المحفوظ (بلا كلمة مرور) ──
  const savedUser = localStorage.getItem("player_username");
  const savedToken = localStorage.getItem("player_token");

  if (savedUser && savedUser.trim() && savedToken) {
    const name = sanitizeUsername(savedUser.trim());
    try {
      const verifyResult = await networkManager.get('/api/auth/verify', { timeout: 6000 });
      if (verifyResult?.valid && verifyResult.username === name) {
        return name;
      }
    } catch { /* التوكن غير صالح أو انتهت صلاحيته — سنطلب تسجيل دخول جديداً أدناه */ }
    // إذا فشل التوكن، نزيله ونطلب تسجيل دخول من جديد
    localStorage.removeItem("player_token");
  }

  // ── إظهار واجهة تسجيل الدخول ──
  const loadingPctEl = document.getElementById("loading-pct");
  if (loadingPctEl) loadingPctEl.textContent = "👤 تسجيل الدخول";

  const overlay = document.createElement("div");
  overlay.id = "name-overlay";
  overlay.innerHTML = `
    <div class="name-overlay-content">
      <div class="name-overlay-crown">👑</div>
      <h1 class="name-overlay-title">ملك الصحراء</h1>
      <p class="name-overlay-sub" id="login-subtitle">سجل الدخول أو أنشئ حساباً جديداً</p>
      <input type="text" id="name-input" class="name-input" placeholder="اسم المستخدم..." maxlength="20" dir="rtl" autofocus />
      <input type="password" id="password-input" class="name-input" placeholder="كلمة المرور (4 أحرف على الأقل)..." maxlength="128" dir="rtl" />
      <div id="login-error" class="login-error-msg"></div>
      <div style="display:flex;gap:8px;width:100%;margin-top:8px">
        <button id="login-btn" class="name-submit-btn" style="flex:1">🔑 تسجيل دخول</button>
        <button id="register-btn" class="name-submit-btn" style="flex:1;background:var(--green,#27ae60)">✨ إنشاء حساب</button>
      </div>
      <button id="guest-btn" class="name-submit-btn" style="width:100%;margin-top:8px;background:var(--beige-dark,#8d7b68)">🎭 دخول كضيف (بدون تسجيل)</button>
      <p style="font-size:0.6rem;color:var(--text-secondary);margin-top:8px">
        الحسابات القديمة: أدخل كلمة مرور جديدة لترقية حسابك
      </p>
    </div>
  `;
  Object.assign(overlay.style, {
    position: "fixed", inset: "0", zIndex: "100000",
    display: "flex", alignItems: "center", justifyContent: "center",
    background: "var(--bg-page)",
  });
  document.body.appendChild(overlay);

  const nameInput = overlay.querySelector("#name-input");
  const passInput = overlay.querySelector("#password-input");
  const loginBtn = overlay.querySelector("#login-btn");
  const registerBtn = overlay.querySelector("#register-btn");
  const guestBtn = overlay.querySelector("#guest-btn");
  const errorEl = overlay.querySelector("#login-error");

  // تعبئة اسم المستخدم المحفوظ إن وجد
  if (savedUser) nameInput.value = savedUser;

  const showError = (msg) => {
    errorEl.textContent = msg || '';
  };

  const doLogin = async (isRegister) => {
    const name = sanitizeUsername(nameInput.value);
    const pass = sanitizePassword(passInput.value);

    if (!name || name.length < 2) {
      showError('الاسم يجب أن يكون حرفين على الأقل');
      return;
    }

    if (isRegister && (!pass || pass.length < 4)) {
      showError('كلمة المرور يجب أن تكون 4 أحرف على الأقل');
      return;
    }

    if (!isRegister && !pass) {
      showError('الرجاء إدخال كلمة المرور');
      return;
    }

    showError('⏳ جاري الاتصال...');

    const result = await tryLogin(name, pass);

    if (result.ok) {
      localStorage.setItem("player_username", name);
      overlay.remove();
      // إذا تم ترقية حساب قديم، نعرض رسالة تأكيد
      if (result.passwordUpgraded) {
        setTimeout(() => {
          const toast = document.getElementById('notification-container');
          if (toast) {
            const el = document.createElement('div');
            el.className = 'notification-toast notif-success';
            el.textContent = '✅ تم ترقية حسابك القديم! يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة 🔐';
            toast.appendChild(el);
            setTimeout(() => { el.classList.add('notif-dismiss'); setTimeout(() => el.remove(), 300); }, 4000);
          }
        }, 500);
      }
      return name;
    }

    // معالجة الأخطاء
    if (result.status === 401) {
      showError('❌ ' + (result.error || 'كلمة المرور خاطئة'));
    } else if (result.status === 400) {
      showError('⚠️ ' + (result.error || 'بيانات غير صحيحة'));
    } else if (result.status === 0) {
      showError('🌐 لا يمكن الاتصال بالخادم');
    } else {
      showError('❌ ' + (result.error || 'حدث خطأ'));
    }

    return null; // فشل
  };

  const doGuestLogin = async () => {
    showError('⏳ جاري إنشاء حساب ضيف...');
    const randomSuffix = () => Math.random().toString(36).slice(2, 8);
    for (let attempt = 0; attempt < 3; attempt++) {
      const name = sanitizeUsername(`ضيف_${randomSuffix()}`);
      const pass = randomSuffix() + randomSuffix();
      const result = await tryLogin(name, pass, true);
      if (result.ok) {
        localStorage.setItem("player_username", name);
        overlay.remove();
        return name;
      }
      // تصادم نادر في اسم المستخدم (401) → إعادة المحاولة باسم عشوائي جديد
      if (result.status !== 401) {
        showError('❌ ' + (result.error || 'تعذر إنشاء حساب الضيف'));
        return null;
      }
    }
    showError('❌ تعذر إنشاء حساب الضيف، حاول مجدداً');
    return null;
  };

  return new Promise(resolve => {
    loginBtn.onclick = async () => {
      const name = await doLogin(false);
      if (name) resolve(name);
    };
    registerBtn.onclick = async () => {
      const name = await doLogin(true);
      if (name) resolve(name);
    };
    guestBtn.onclick = async () => {
      const name = await doGuestLogin();
      if (name) resolve(name);
    };
    const handleKey = (e) => {
      if (e.key === "Enter") {
        // إذا كان حقل كلمة المرور فيه نص → تسجيل دخول
        // وإلا → إذا حقل الاسم فقط، ركز على كلمة المرور
        if (passInput.value) {
          loginBtn.click();
        } else {
          passInput.focus();
        }
      }
    };
    nameInput.onkeydown = handleKey;
    passInput.onkeydown = handleKey;
    setTimeout(() => nameInput?.focus(), 200);
  });
}

async function loadFromDatabase(economy, army, village, username) {
  let data;
  try {
    data = await networkManager.loadFromDatabase(username);
  } catch (err) {
    if (err?.status === 401 || err?.status === 403) {
      localStorage.removeItem("player_token");
      try {
        const loginData = await networkManager.post('/api/auth/login', { username, password: '' }, { timeout: 8000 });
        if (loginData?.token) {
          localStorage.setItem("player_token", loginData.token);
          data = await networkManager.loadFromDatabase(username);
        }
      } catch { /* old account fallback failed */ }
    }
  }
  if (!data) return;
  try {
    if (data && data.cash !== undefined) {
      economy.cash = Math.max(economy.cash, data.cash);
      economy.gems = Math.max(economy.gems, data.gems || 0);
      economy.gold = Math.max(economy.gold, data.gold || 0);
      economy.hammers = Math.max(economy.hammers, data.hammers || 0);
      economy.scrolls = Math.max(economy.scrolls, data.scrolls || 0);
      economy.resources.food = Math.max(economy.resources.food, data.food ?? 50);
      economy.resources.artifacts = Math.max(economy.resources.artifacts, data.artifacts ?? 0);
      economy.resources.desertGem = Math.max(economy.resources.desertGem, data.desertGem ?? 0);
      economy.resources.water = Math.max(economy.resources.water, data.water ?? 0);
      economy.resources.salt = Math.max(economy.resources.salt, data.salt ?? 0);
      economy.resources.leather = Math.max(economy.resources.leather, data.leather ?? 0);
      economy.resources.copper = Math.max(economy.resources.copper, data.copper ?? 0);
      economy.resources.herbs = Math.max(economy.resources.herbs, data.herbs ?? 0);
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
            w.owned = w.upgradeLevel > 0; // ✅ استعادة حالة التملك من السيرفر
            if (wd.starLevel) w.starLevel = wd.starLevel;
            if (wd.gemLevel) w.gemLevel = wd.gemLevel;
          }
        }
      }
      window._loadedLandsState = data.landsState || null;
      // تخزين مؤقت لبيانات التحالف والترقيات والواحات لاستخدامها لاحقاً
      window._loadedAllianceLevel = data.allianceLevel ?? 0;
  window._loadedUpgrades = data.upgrades || {};
  window._loadedResearch = data.researchTree || null;
  window._loadedOases = data.oases || [];
  window._loadedAchievements = data.achievements || null;
      window._loadedDailyLogin = data.dailyLogin || null;
      window._loadedPrestige = data.prestigeLevel ?? 0;
      window._loadedInventory = data.inventory || null;
      window._loadedLoadout = data.loadout || null;
      window._loadedMarket = data.market || null;
      window._loadedReputation = data.reputation || null;
      window._loadedEvents = data.events || null;
      window._loadedTutorial = data.tutorial || null;
      window._loadedStory = data.story || null;
      window._loadedEquippedWeapon = data.equippedWeapon || '';
      window._brWins = data.brWins ?? 0;
      window._brKills = data.brKills ?? 0;
      window._loadedHero = data.hero || null;
      if (data.multiplier) economy.multiplier = data.multiplier;
      if (data.knowledgeLevel) economy.knowledgeLevel = data.knowledgeLevel;
      if (data.knowledgeType) economy.knowledgeType = data.knowledgeType;
      if (data.armyYardLevel) economy.armyYardLevel = data.armyYardLevel;
      if (data.completedVillages) village.completedVillages = data.completedVillages;
      if (data.currentChapter) village.currentChapter = data.currentChapter;
      if (data.x_position != null && data.y_position != null) {
        window._loadedPosition = { x: data.x_position, y: data.y_position };
      }
      if (import.meta.env?.DEV) { console.log("✅ [API] تم استعادة بياناتك من قاعدة البيانات!"); }
    }
  } catch (err) {
    console.warn("⚠️ [API] لم يتم العثور على بيانات سابقة، سنبدأ من الصفر:", err.message);
  }
}

function showLoadingError() {
  const loadingPct = document.getElementById("loading-pct");
  const loadingError = document.getElementById("loading-error");
  if (loadingPct) loadingPct.textContent = "❌ فشل";
  if (loadingError) loadingError.classList.remove("hidden");
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
  setProgress(15);
  
  networkManager.apiBase = API_BASE;
  
  setProgress(20);
  
  const economy = new GameEconomy();
  const village = new GameVillage(economy);
  const army = new GameArmy(economy);

  // تحميل localStorage أولاً كنسخة احتياطية سريعة
  const { lastSave } = loadGame(economy, village, army);

  // ثم تحميل من قاعدة البيانات (الرسمية) — يلغي بيانات localStorage
  await loadFromDatabase(economy, army, village, PLAYER_USERNAME);
  
  const hasSavedData = economy.level > 1 || economy.xp > 0 || 
                       (economy.buildings && Object.keys(economy.buildings).length > 0);
  
  const oasisManager = new OasisManager(economy);
  const upgradeTree = new UpgradeTree(economy);
  upgradeTree.setArmyRef(army);
  const researchTree = new ResearchTree(economy);
  const allianceManager = new AllianceManager(economy);
  allianceManager.setMyName(PLAYER_USERNAME);
  const quests = new QuestManager(economy, army, village);
  const world = new WorldMap(economy, PLAYER_USERNAME, API_BASE, army);
  const store = new GameStore();
  const netSync = new NetworkSync(API_BASE, PLAYER_USERNAME);
  world.netSync = netSync;
  netSync.world = world;
  world.store = store;

  // 🏜️ نظام الحرب القبلي
  const warManager = new WarManager(allianceManager, economy, army, netSync);
  warManager.attachToWorld(world);
  window._warManager = warManager;

  new AssetManager();
  const audio = new AudioManager();
  window._audio = audio;
  const hero = new GameHero();
  const achievements = new AchievementManager(economy);
  const dailyLogin = new DailyLoginManager(economy);
  const storyManager = new StoryManager(economy, village, army, allianceManager, hero);
  window._storyManager = storyManager;
  window._army = army;
  window._economy = economy;
  window._world = world;
  window._allianceManager = allianceManager;
  const prestige = new PrestigeManager(economy, village, army, storyManager);
  const inventory = new InventoryManager(economy);
  const droppedItems = new DroppedItemsManager();
  window._inventory = inventory;

  // 🧭 خطواتك الأولى — توجيه اللاعب الجديد (يختفي نهائياً بعد إكمال الخطوات الثلاث)
  const { FirstStepsManager } = await import("./first-steps.js");
  const firstSteps = new FirstStepsManager(economy);
  window._firstSteps = firstSteps;
  if (!firstSteps.done) setTimeout(() => firstSteps.render(), 3000);

  // تحديث الإسقاطات من الخادم (لللاعبين الجدد أو إعادة الاتصال)
  world._onWorldDrops = (list) => {
    if (list && list.length > 0) {
      for (const d of list) {
        const dropObj = { id: d.id, x: d.x, y: d.y, name: d.name, icon: d.icon, username: d.username, spawnTime: d._droppedAt || Date.now(), size: 20 };
        droppedItems.add(dropObj);
      }
    }
  };
  
  // 🎒 نظام الشنطة (Loadout)
  const loadoutManager = new LoadoutManager(economy, inventory, army);
  window._loadoutManager = loadoutManager;
  window._droppedItems = droppedItems;
  const events = new EventManager();
  const tutorial = new TutorialManager();

  // 🏪 سوق الصحراء (Trade Market)
  const tradeMarket = new TradeMarket(economy, inventory, netSync, PLAYER_USERNAME);
  window._tradeMarket = tradeMarket;

  const reputation = new ReputationManager();
  tradeMarket._priceModifier = () => reputation.tradeModifier;
  window._reputation = reputation;
  
  setProgress(80);

  // استعادة بيانات التحالف والترقيات والواحات من التخزين المؤقت
  if (window._loadedAllianceLevel !== undefined) allianceManager.loadState(window._loadedAllianceLevel);
  if (window._loadedUpgrades) upgradeTree.loadState(window._loadedUpgrades);
  if (window._loadedResearch) researchTree.loadState(window._loadedResearch);
  if (window._loadedOases) oasisManager.loadState(window._loadedOases);
  if (window._loadedAchievements) achievements.loadState(window._loadedAchievements);
  if (window._loadedDailyLogin) dailyLogin.loadState(window._loadedDailyLogin);
  if (window._loadedPrestige !== 0 && window._loadedPrestige !== undefined) prestige.loadState(window._loadedPrestige);
  if (window._loadedInventory) inventory.loadState(window._loadedInventory);
  // 🆕 استعادة بيانات الشنطة من قاعدة البيانات (إذا كانت محفوظة)
  if (window._loadedLoadout) {
    loadoutManager.loadState(window._loadedLoadout);
    delete window._loadedLoadout;
  }
  // 🏪 استعادة بيانات السوق
  if (window._loadedMarket) {
    tradeMarket.loadState(window._loadedMarket);
    delete window._loadedMarket;
  }
  if (window._loadedReputation) {
    reputation.loadState(window._loadedReputation);
    delete window._loadedReputation;
  }
  if (window._loadedEvents) events.loadState(window._loadedEvents);
  // 🔥 حدث الأسبوع — يبدأ تلقائياً (نفس الحدث للجميع، يتغير كل أسبوع)
  const newWeeklyEvent = events.ensureWeeklyEvent();
  if (newWeeklyEvent) {
    setTimeout(async () => {
      ui.showNotification(`🔥 حدث الأسبوع بدأ: ${newWeeklyEvent.title} — ${newWeeklyEvent.desc}!`);
      const { confettiBurst } = await import("./celebrations.js");
      confettiBurst(16);
    }, 2500);
  }
  if (window._loadedTutorial) tutorial.loadState(window._loadedTutorial);
  if (window._loadedStory) {
    storyManager.loadState(window._loadedStory);
    // storyManager.currentChapter هو المرجع الرسمي
    village.currentChapter = storyManager.currentChapter;
  } else if (village.currentChapter > 1) {
    // توافق عكسي: saves القديمة التي ليس لديها storyManager في DB
    storyManager.currentChapter = village.currentChapter;
  }
  if (window._loadedHero) hero.loadState(window._loadedHero);
  delete window._loadedAllianceLevel;
  delete window._loadedUpgrades;
  delete window._loadedResearch;
  delete window._loadedOases;
  delete window._loadedAchievements;
  delete window._loadedDailyLogin;
  delete window._loadedPrestige;
  delete window._loadedInventory;
  delete window._loadedEvents;
  delete window._loadedTutorial;
  delete window._loadedStory;
  delete window._loadedHero;
  
  // 🆕 استعادة السلاح المجهز من قاعدة البيانات
  if (window._loadedEquippedWeapon) {
    world._equippedWeapon = window._loadedEquippedWeapon;
    world.syncWeaponVisuals();
    delete window._loadedEquippedWeapon;
  }
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
    if (import.meta.env?.DEV) { console.log("🎉 [بونص] تم منح الرصيد الترحيبي للاعب الجديد!"); }
    // حفظ فوري في قاعدة البيانات عشان ما يضيع البونص
    networkManager.post(`/api/players/${encodeURIComponent(PLAYER_USERNAME)}`, {
      cash: economy.cash, gems: economy.gems, gold: economy.gold,
      hammers: economy.hammers, scrolls: economy.scrolls, food: economy.food,
      army_power: economy.power, unitLevel: 1, weapons: [], last_active: Date.now()
    }, { timeout: 5000, retries: 1 }).catch(() => {});
  } else {
    // حفظ حالة الدخول
    networkManager.post(`/api/players/${encodeURIComponent(PLAYER_USERNAME)}`, {
      last_active: Date.now()
    }, { timeout: 5000, retries: 1 }).catch(() => {});
  }

  // حساب المكافآت غير المتصلة (Offline Rewards)
  if (lastSave && lastSave > 0) {
    const offlineSeconds = Math.floor((Date.now() - lastSave) / 1000);
    if (offlineSeconds > 60) {
      const incomeRate = village.getIncomeRate();
      const oasisIncome = oasisManager.totalIncome;
      const villageCash = Math.floor((incomeRate.cash || 0) * offlineSeconds * 0.5);
      const oasisGold = Math.floor((oasisIncome || 0) * offlineSeconds * 0.5);
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

  // تشغيل السينماتيك للمستخدم الجديد
  if (!hasSavedData) {
    // 🛡️ يمنع GameUI.initStory() من تشغيل مشهد قصة ثانٍ متزامن (كان يسبب تراكب نافذتين)
    window._newPlayerStoryPending = true;
    setTimeout(() => {
      storyManager.playCinematicIntro().then(() => {
        // بعد السينماتيك، عرض مشهد الفصل الأول
        if (storyManager.hasMoreScenes()) {
          setTimeout(() => ui.showStoryScene(() => {
            window._newPlayerStoryPending = false;
            ui.initTutorial();
          }), 500);
        } else {
          window._newPlayerStoryPending = false;
          ui.initTutorial();
        }
      });
    }, 1000);
  } else if (storyManager.shouldShowIntro()) {
    setTimeout(() => {
      storyManager.playChapterIntro();
    }, 2000);
  }

  let ui;
  try {
    const notificationManager = new NotificationManager();
    ui = new GameUI(village, army, economy, world, oasisManager, upgradeTree, researchTree, allianceManager, achievements, dailyLogin, prestige, inventory, events, tutorial, store, quests, warManager, notificationManager, reputation);
    ui._tradeMarket = tradeMarket;
    world._ui = ui;
  } catch (err) {
    errorLogger.logError({ type: 'gameInit', message: 'GameUI constructor threw', stack: err?.stack, original: err?.message });
    throw err;
  }
    world.onExit = () => ui.exitWorldMap();
    world._onBeforeExit = () => { saveToDB(); persistGameSession(economy, village, army); };

    // ربط العالم بأنظمة الترقيات والتحالف
    world._allianceManager = allianceManager;
    world._upgradeTree = upgradeTree;
    world._reputation = reputation;

    // تسجيل مصادر القوة (powerSources) — بدونه يكون power = 0 دائماً
    economy.powerSources.push(() => village.getPower());
    economy.powerSources.push(() => (army.unitPower + army.getEquippedWeaponPower(world._equippedWeapon)) || army.unitLevel * 10);
    economy.powerSources.push(() => Math.floor(economy.level * 5));
    economy.powerSources.push(() => allianceManager.level * 10);
    economy.powerSources.push(() => prestige.level * 50);
    economy.powerSources.push(() => hero.powerContribution);

    // تشغيل الخريطة المصغرة
    ui.startMiniMapLoop();

    // ربط إنجازات المباني
    village.setBuildingCallbacks(
      () => { achievements.updateProgress('builds', 1); audio.playSound('build'); hero.addXp(10); },
      () => { achievements.updateProgress('upgrades', 1); audio.playSound('upgrade'); hero.addXp(8); }
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
        window._firstSteps?.notify('train');
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

    // 🔥 تحسين: dirty flag — نحفظ فقط عندما يكون هناك تغيير حقيقي
    let _saveDirty = false;
    const markDirty = () => { _saveDirty = true; };

    const saveToDB = () => {
      if (!_saveDirty) return; // ما في تغيير — لا نحفظ
      _saveDirty = false;

      const landsState = ui._landsState || {};
      // نسخة احتياطية محلية دائماً
      saveGame(economy, village, army);
      networkManager.saveToDatabase(PLAYER_USERNAME, {
        cash: economy.cash,
        gems: economy.gems,
        gold: economy.gold,
        hammers: economy.hammers,
        scrolls: economy.scrolls,
        food: economy.food,
        artifacts: economy.resources.artifacts || 0,
        desertGem: economy.resources.desertGem || 0,
        water: economy.resources.water || 0,
        salt: economy.resources.salt || 0,
        leather: economy.resources.leather || 0,
        copper: economy.resources.copper || 0,
        herbs: economy.resources.herbs || 0,
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
        multiplier: economy.multiplier,
        xp: economy.xp,
        level: economy.level,
        allianceLevel: allianceManager.level,
        upgrades: upgradeTree.levels,
        researchTree: researchTree ? researchTree.getSaveData() : {},
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
        loadout: loadoutManager.getSaveData(),
        market: tradeMarket.getSaveData(),
        reputation: reputation.getSaveData(),
        completedVillages: village.completedVillages,
        currentChapter: village.currentChapter,
        last_active: Date.now()
      }).catch(e => console.warn("[Save] saveToDB:", e.message));
    };

    // أي تغيير في الاقتصاد أو الجيش أو القرية = علامة متسخ + حفظ خلفي
    const _origAddRaw = economy.addRaw.bind(economy);
    economy.addRaw = function(...args) {
      _origAddRaw(...args);
      markDirty();
      persistGameSession(economy, village, army);
    };
    const _origSpend = economy.spend.bind(economy);
    economy.spend = function(...args) {
      const ok = _origSpend(...args);
      if (ok) markDirty();
      if (ok) persistGameSession(economy, village, army);
      return ok;
    };
    const _origAddXp = economy.addXp.bind(economy);
    economy.addXp = function(...args) {
      _origAddXp(...args);
      markDirty();
      persistGameSession(economy, village, army);
    };

    ui._onSave = saveToDB;
    ui._markDirty = markDirty;
    ui.setShopBuyCallback(function shopBuy(item) {
      // 🆕 شراء سلاح جديد بالكاش
      if (item.startsWith('buy_')) {
        const wid = item.replace('buy_', '');
        const weapon = army.weapons.find(w => w.id === wid);
        if (weapon && !weapon.owned) {
          if (weapon.buy(economy)) {
            audio.playSound('buy');
            world._equippedWeapon = wid;
            world.syncWeaponVisuals();
            audio.playWeaponSound(wid, 'equip');
            ui.showNotification(`🔓 تم شراء ${weapon.name}! 🗡️ مجهز تلقائياً`);
            saveToDB(); persistGameSession(economy, village, army);
            ui.updateTopBar();
          } else {
            ui.showNotification(`❌ المال غير كافٍ لشراء ${weapon.name}`);
          }
        }
        return;
      }

      // 🆕 تجهيز سلاح
      if (item.startsWith('equip_')) {
        const wid = item.replace('equip_', '');
        const weapon = army.weapons.find(w => w.id === wid);
        if (weapon && weapon.owned) {
          world._equippedWeapon = wid;
          world.syncWeaponVisuals();
          audio.playWeaponSound(wid, 'equip');
          ui.showNotification(`🗡️ تم تجهيز ${weapon.name}`);
          window._firstSteps?.notify('equip');
          saveToDB(); persistGameSession(economy, village, army);
          ui.updateTopBar();
        }
        return;
      }

      // 🆕 إلغاء تجهيز السلاح
      if (item === 'unequip') {
        world._equippedWeapon = '';
        world.syncWeaponVisuals();
        audio.playSound('click');
        ui.showNotification('✕ تم إلغاء تجهيز السلاح');
        saveToDB(); persistGameSession(economy, village, army);
        ui.updateTopBar();
        return;
      }

      switch (item) {
        case "unit":
            if (army.upgradeUnits(economy)) {
              audio.playSound('upgrade');
              saveToDB(); persistGameSession(economy, village, army);
              ui.updateTopBar();
            }
          break;

        case "heal":
          if (economy.spend("cash", 20)) {
            if (world.leader) {
              world.leader.hp = Math.min(world.leader.maxHp, world.leader.hp + 30);
            }
            audio.playSound('heal');
            saveToDB(); persistGameSession(economy, village, army);
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
              world.syncWeaponVisuals();
              // إرسال الترقية عبر WebSocket للمزامنة مع الخادم
              if (world.netSync && world.netSync.isConnected) {
                world.netSync.send({ type: "weapon_upgrade", weaponId: weapon.id });
              }
              saveToDB(); persistGameSession(economy, village, army);
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
      celebrate('level_up', `المستوى ${lvl} 🏅`);
      spawnLevelUp(window.innerWidth / 2, window.innerHeight / 2);
      ui.updateTopBar();
      achievements.updateProgress('player_level', lvl);
      hero.addXp(30);
      ui.checkBuildingUnlocks(lvl);
    };

    world._onMonsterKilled = () => {
      if (world._equippedWeapon) {
        audio.playWeaponSound(world._equippedWeapon, 'attack');
      } else {
        audio.playSound('kill');
      }
      achievements.updateProgress('kills', 1);
      hero.addXp(15);
      economy.addXp(10);
      quests.updateProgress('kill', 1);
      window._firstSteps?.notify('kill');

      // 🎁 إسقاط عناصر عشوائية من الوحوش (فرصة 15%)
      if (Math.random() < 0.15) {
        const dropTable = [
          { id: "bandage", chance: 0.40, name: "باندج" },
          { id: "heal_potion", chance: 0.25, name: "جرعة علاج" },
          { id: "xp_scroll", chance: 0.15, name: "لفافة خبرة" },
          { id: "fire_sword", chance: 0.08, name: "سيف ناري" },
          { id: "desert_shield", chance: 0.06, name: "درع صحراوي" },
          { id: "arena_ticket", chance: 0.04, name: "تذكرة ساحة" },
          { id: "iron_sword", chance: 0.02, name: "سيف حديدي" },
        ];
        const roll = Math.random();
        let cumulative = 0;
        for (const item of dropTable) {
          cumulative += item.chance;
          if (roll <= cumulative) {
            if (inventory.canCarry(item.id, 1)) {
              inventory._addItem(item.id, 1);
              ui.showNotification(`🎁 حصلت على ${item.name}!`);
              audio.playSound('collect');
            }
            break;
          }
        }
      }
    };
    world._onDropCollected = () => {
      audio.playSound('collect');
      spawnXpGain(window.innerWidth / 2, window.innerHeight / 2);
      economy.addXp(3);
    };
    world._onTreasureOpened = (reward) => {
      audio.playSound('treasure');
      spawnGoldBurst(window.innerWidth / 2, window.innerHeight / 2);
      const gemText = reward.desertGem > 0 ? ` 💠x${reward.desertGem}` : '';
      ui.showNotification(`🎁 صندوق كنز! +${reward.artifacts} 🏺 +${reward.cash} 💵 +${reward.gold} 🪙${gemText}`);
      saveToDB(); persistGameSession(economy, village, army);
    };
    world._onPvPWin = () => {
      audio.playSound('levelup');
      spawnGoldBurst(window.innerWidth / 2, window.innerHeight / 2, 8);
      if (world._equippedWeapon) {
        audio.playWeaponSound(world._equippedWeapon, 'attack');
      }
      achievements.updateProgress('pvp_wins', 1);
      hero.addXp(50);
      economy.addXp(25);
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

    // ربط نظام الإسقاط مع المخزون
    inventory._onItemDropped = (dropped) => {
      droppedItems.add(dropped);
      // بث الإسقاط للاعبين الآخرين
      if (netSync && netSync._ws && netSync._ws.readyState === 1) {
        netSync._ws.send(JSON.stringify({
          type: "item_dropped",
          item: dropped,
        }));
      }
    };

    inventory._onItemUsed = (_itemId) => {
      achievements.updateProgress('items_used', 1);
    };

    // تخزين مؤقت لتنظيف الفواصل لاحقاً
    const _gameIntervals = [];

    // تنظيف الأدوات القديمة + السوق كل دقيقة
    _gameIntervals.push(setInterval(() => {
      droppedItems.cleanup();
      tradeMarket.cleanup();
    }, 60000));
    achievements._onUnlock = (a) => {
      ui.showNotification(`🏆 إنجاز: ${a.title} — ${a.desc}`);
      audio.playSound('levelup');
      spawnGoldBurst(window.innerWidth / 2, window.innerHeight / 2);
    };

    quests._onQuestCompleted = (q) => {
      ui.showNotification(`📜 اكتملت المهمة: ${q.title} — حصلت على المكافأة!`);
      audio.playSound('levelup');
      spawnGoldBurst(window.innerWidth / 2, window.innerHeight / 2);
    };

    // توصيل القصة — عرض مشاهد الفصل التالي بعد إكمال الفصل الحالي
    storyManager._onChapterComplete = (chapter) => {
      // مكافآت إضافية: Hero XP, Army Levels, Knowledge, Training
      if (chapter.reward.heroXp) hero.addXp(chapter.reward.heroXp);
      if (chapter.reward.unitLevels) {
        for (let i = 0; i < chapter.reward.unitLevels; i++) {
          if (army.unitLevel < army.maxUnitLevel) army.unitLevel++;
        }
      }
      if (chapter.reward.trainingLevel) {
        for (let i = 0; i < chapter.reward.trainingLevel; i++) {
          if (army.trainingLevel < army.maxTrainingLevel) army.trainingLevel++;
        }
      }
      if (chapter.reward.knowledgeLevel && economy.knowledgeLevel < chapter.reward.knowledgeLevel) {
        economy.knowledgeLevel = chapter.reward.knowledgeLevel;
      }
      saveToDB(); persistGameSession(economy, village, army);
      
      // تشغيل مشهد النصر
      storyManager.playVictoryScene().then(() => {
        if (storyManager.hasMoreScenes()) {
          setTimeout(() => {
            ui.showStoryScene(() => {});
          }, 1500);
        }
      });
    };

    storyManager._onVillageUnlocked = (village) => {
      ui.showNotification(`🗺️ تم فتح قرية جديدة: ${village.name}`);
    };

    storyManager._onChapterScenesShow = (callback) => {
      ui.showStoryScene(callback);
    };

    storyManager._onSceneWatched = (_sceneId) => {
      achievements.updateProgress('story_scenes', 1);
    };

    // 🦅 ربط مشاهد الـ Boss — تحويل القصة إلى وضع قتال الزعيم
    storyManager._onBossFight = (bossId) => {
      // لا تقاطع أوضاع اللعب الخاصة (استخراج، حشد، كهف)
      if (world._activeMode) { return; }
      // تشغيل حوار الزعيم أولاً
      storyManager.playBossDialogue().then(() => {
        ui.showNotification(`⚔️ معركة الزعيم: ${bossId}!`);
        const chapter = storyManager.currentChapterData;
        if (chapter && chapter.village) {
          const includeBoss = true;
          world.spawnCampaignMonsters(chapter.village, includeBoss);
          const canvas = document.getElementById("gameCanvas");
          if (canvas) canvas.classList.remove("hidden");
          const worldButtons = document.getElementById("world-buttons");
          if (worldButtons) worldButtons.classList.remove("hidden");
          world.enterWorldMap();
        }
      });
    };

    hero._onLevelUp = (lvl) => {
      ui.showNotification(`🦸 البطل وصل المستوى ${lvl}!`);
      audio.playSound('hero_levelup');
      hero.maxHp = 120 + (lvl - 1) * 10;
      hero.hp = hero.maxHp;
    };

    hero._onAbilityUnlock = (key) => {
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
      saveToDB(); persistGameSession(economy, village, army);
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

    // أزرار قدرات البطل (لوحة البطل الكاملة + شريط سريع عائم أثناء القتال)
    const heroAbilityBtns = {
      'hero-ability-1': 'heal',
      'hero-ability-2': 'powerStrike',
      'hero-ability-3': 'shield',
      'hero-ability-4': 'rally',
      'hero-quick-1': 'heal',
      'hero-quick-2': 'powerStrike',
      'hero-quick-3': 'shield',
      'hero-quick-4': 'rally',
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

      let anyUnlocked = false;
      for (const [btnId, abilityKey] of Object.entries(heroAbilityBtns)) {
        const btn = document.getElementById(btnId);
        const ab = hero.abilities[abilityKey];
        if (btn && ab) {
          if (ab.unlocked) anyUnlocked = true;
          btn.disabled = !ab.unlocked || ab.cooldown > 0;
          btn.classList.toggle('active-ability', ab.active);
          const descEl = btn.querySelector('.hero-ab-desc');
          if (descEl) {
            if (!ab.unlocked) descEl.textContent = `Lv.${ab.levelReq}`;
            else if (ab.cooldown > 0) descEl.textContent = `${Math.ceil(ab.cooldown)}s`;
            else descEl.textContent = 'جاهز';
          }
          const cdEl = btn.querySelector('.hero-quick-cd');
          if (cdEl) cdEl.textContent = ab.unlocked && ab.cooldown > 0 ? Math.ceil(ab.cooldown) : '';
        }
      }
      const quickbar = document.getElementById('hero-quickbar');
      if (quickbar) quickbar.classList.toggle('hidden', !anyUnlocked);
    }, 1000);
    _gameIntervals.push(heroInterval);

    // ====== Battle Royale ======
    const brBtn = document.getElementById('br-enter-btn');

    // 👥 زر "العب مع صديق" — في القائمة وفي أزرار الخريطة
    const openParty = async () => {
      const { openPartyModal } = await import('./ui/party-ui.js');
      openPartyModal(world);
    };
    document.getElementById('play-friend-btn')?.addEventListener('click', openParty);
    document.getElementById('party-world-btn')?.addEventListener('click', openParty);

    // 🎯 أهداف PvP مقترحة
    document.getElementById('pvp-targets-btn')?.addEventListener('click', async () => {
      const { openPvPTargetsPanel } = await import('./ui/pvp-targets.js');
      openPvPTargetsPanel(world);
    });
    const brVictoryBtn = document.getElementById('br-victory-btn');
    const brDefeatBtn = document.getElementById('br-defeat-btn');
    const brZoneWarningEl = document.getElementById('br-zone-warning');
    const brKillFeedEl = document.getElementById('br-kill-feed');
    const brVictoryScreen = document.getElementById('br-victory-screen');
    const brDefeatScreen = document.getElementById('br-defeat-screen');
    const brAliveCount = document.getElementById('br-alive-count');
    const brTotalCount = document.getElementById('br-total-count');
    const brVictoryStats = document.getElementById('br-victory-stats');
    const brDefeatStats = document.getElementById('br-defeat-stats');
    const brEvacuateBtn = document.getElementById('br-evacuate-btn');

    if (brEvacuateBtn) {
      brEvacuateBtn.addEventListener('click', () => {
        if (world && world._doBRExtraction) world._doBRExtraction();
      });
    }

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
        const isExtraction = result.reason === "extraction";
        celebrate(isExtraction ? 'extraction' : 'br_win', `${result.kills || 0} قتل ⚔️`);
        const icon = isExtraction ? "🚁" : "👑";
        const titleText = isExtraction ? "إخلاء ناجح!" : "أنت الفائز!";
        const bonusDisplay = result.bonusGems ? ` +${result.bonusGems} 💎` : '';
        const bonusDisplay2 = result.bonusGold ? ` +${result.bonusGold} 🪙` : '';
        if (brVictoryStats) {
          brVictoryStats.textContent = isExtraction
            ? `🚁 هربت مع ${result.kills || 0} قتل!${bonusDisplay}${bonusDisplay2}`
            : `🏆 قضيت على ${result.kills || 0} أعداء`;
        }
        const titleEl = brVictoryScreen?.querySelector('h2');
        if (titleEl) titleEl.textContent = titleText;
        const iconEl = brVictoryScreen?.querySelector('.victory-icon');
        if (iconEl) iconEl.textContent = icon;
        // 🛡️ مسار الإخلاء (extraction) يمنح مكافأته بالفعل في world.js._doBRExtraction() —
        // لا نكررها هنا؛ فقط "آخر لاعب صامد" يحصل على المكافأة الثابتة من هذا المسار
        if (result.reason !== "extraction") {
          economy.addRaw('gems', (result.bonusGems || 0) + 100 + (result.kills || 0) * 10);
          economy.addRaw('gold', (result.bonusGold || 0) + 50 + (result.kills || 0) * 5);
        }
        if (reputation) {
          const r = reputation.addScore(10 + (result.kills || 0) * 2, "br_win");
          if (r.changed) ui.showNotification(`${reputation.getTitle().icon} أصبحت ${r.newTitle}!`);
        }
        saveToDB(); persistGameSession(economy, village, army);
        networkManager.post(`/api/players/${encodeURIComponent(PLAYER_USERNAME)}`, {
          brWins, brKills: brKillsTotal, last_active: Date.now()
        }, { timeout: 5000, retries: 1 }).catch(() => {});
        ui.updateTopBar();
      } else {
        if (brDefeatScreen) brDefeatScreen.classList.remove('hidden');
        if (brDefeatStats) brDefeatStats.textContent = `💀 قُتلت — قتلت ${result.kills || 0} أعداء`;
        saveToDB(); persistGameSession(economy, village, army);
      }
    };
    world._onBRMatchEnd = onBRMatchEnd;
    netSync.onBRMatchEnd = onBRMatchEnd;
    // ربط شاشة الخسارة
    world._onWipe = () => {
      audio.playSound('hit');
    };

    store.on('notification', (data) => {
      if (!data || !data.text) return;
      ui.notifier.show(data.text);
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
    const TICK_INTERVAL = 15000; // 15 ثانية لكل tick
    let eventTimer = 0;
    let lastPowerCheck = economy.power;
    let lastTickTime = performance.now();
    
    // Self-correcting tick loop — يعوّض الـ drift تلقائياً
    let tickTimer = null;
    let expectedTickTime = performance.now();
    
    function scheduleNextTick() {
      const now = performance.now();
      const drift = now - expectedTickTime;
      const nextDelay = Math.max(0, TICK_INTERVAL - drift);
      expectedTickTime += TICK_INTERVAL;
      tickTimer = setTimeout(runGameTick, nextDelay);
    }
    
    function runGameTick() {
      const now = performance.now();
      const dt = (now - lastTickTime) / 1000; // الوقت الفعلي بالثواني
      lastTickTime = now;
      
      // استرداد تدريجي لمضاعف القوة بعد خسائر PvP
      if (economy.multiplier < 1) {
        economy.multiplier = Math.min(1, economy.multiplier + 0.01);
      }

      // تحديث الاقتصاد والقرية والواحات
      economy.tick();
      village.update(dt);
      economy.refreshIncome(village);
      oasisManager.tick(dt);
      allianceManager.tickRaidCooldown(dt);
      if (warManager) warManager.tick(dt);
      hero.tick(dt);
      
      // الأحداث
      eventTimer += dt;
      events.update(dt);
      
      // تتبع إنجازات القوة
      const curPower = economy.power;
      if (curPower > lastPowerCheck) {
        achievements.updateProgress('power', curPower - lastPowerCheck);
        lastPowerCheck = curPower;
      }
      
      // بدء أحداث عشوائية كل 5 دقائق
      if (eventTimer > 300) {
        eventTimer = 0;
        if (events.getActiveEvents().length === 0) {
          const available = events.getAll().filter(e => !e.active);
          if (available.length > 0) {
            const pick = available[Math.floor(Math.random() * available.length)];
            events.startEvent(pick.id);
            ui.showNotification(`🎊 حدث جديد: ${pick.title} — ${pick.desc}`);
          }
        }
      }
      
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
        const b1 = ui._landsState['b1'];
        const b2 = ui._landsState['b2'];
        const b3 = ui._landsState['b3'];
        const b4 = ui._landsState['b4'];
        if (b1 && b1.state === 'built') {
          if (researchTree) researchTree.palaceLevel = b1.level || 1;
        }
        if (b2) {
          army.barracksLevel = b2.level || 1;
          army.unitsCount = army.getMaxUnits(b2.level || 1);
        }
        if (b3 && b3.state === 'built' && b3.level > 0) {
          economy.b3GoldBonus = 1 + (b3.level - 1) * 0.10;
        }
        if (b4 && b4.state === 'built' && b4.level > 0) {
          army.b4TrainingBonus = 1 + (b4.level - 1) * 0.05;
          if (researchTree) researchTree.academyLevel = b4.level || 0;
        }
      }
      // تطبيق تأثيرات البحوث على الاقتصاد
      if (researchTree) {
        const effects = researchTree.getEffects();
        economy.researchGoldBonus = 1 + (effects.goldProduction / 100);
        economy.researchDefenseBonus = effects.defensePercent;
      }
      // تطبيق تأثيرات شجرة الترقيات (المعرفة)
      if (upgradeTree) {
        economy.knowledgeGoldBonus = 1 + (upgradeTree.getEffect('knowledge') / 100);
        economy.tradeIncomeBonus = 1 + (upgradeTree.getEffect('trade') / 100);
      }
      
      // استهلاك الطعام للجيش
      if (world.leader && world.running) {
        const aliveUnits = world.armyUnits.filter(u => u.hp > 0).length;
        const foodCost = Math.ceil(aliveUnits * 0.5);
        if (economy.food >= foodCost) {
          economy.addRaw("food", -foodCost);
        } else {
          economy.food = 0;
          for (const u of world.armyUnits) {
            if (u.hp > 0) u.hp = Math.max(0, u.hp - 2);
          }
          if (world.leader) world.leader.hp = Math.max(0, world.leader.hp - 1);
        }
      }
      
      saveToDB(); persistGameSession(economy, village, army); // يحفظ فقط إذا كان هناك تغيير (dirty flag)
      
      // جدولة الـ tick التالي
      scheduleNextTick();
    }
    
    // بدء الـ tick loop
    scheduleNextTick();

    // تشغيل حدث Gold Rush كبداية
    setTimeout(() => {
      events.startEvent('gold_rush');
      ui.showNotification('🎊 🏆 انهيار الذهب! الذهب من الوحوش ×2!');
    }, 60000);

    // إتاحة تنظيف الفواصل من خارج الدالة
    let _keydownHandler;
    window._cleanupGameIntervals = () => {
      for (const id of _gameIntervals) { clearInterval(id); }
      _gameIntervals.length = 0;
      if (tickTimer) { clearTimeout(tickTimer); tickTimer = null; }
      if (_keydownHandler) { document.removeEventListener('keydown', _keydownHandler); _keydownHandler = null; }
      const pvpModal = document.getElementById("pvp-defeat-modal");
      if (pvpModal) {
        const returnBtn = document.getElementById("pvp-defeat-return-btn");
        if (returnBtn && returnBtn._pvpCountdown) { clearInterval(returnBtn._pvpCountdown); returnBtn._pvpCountdown = null; }
      }
    };

    // اختصارات لوحة المفاتيح
    _keydownHandler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      switch (e.key) {
        case 'm': case 'M': document.getElementById('mute-btn')?.click(); break;
        case 'h': case 'H': document.getElementById('hero-toggle-btn')?.click(); break;
        case 'b': case 'B': document.getElementById('br-enter-btn')?.click(); break;
        case 'Escape': ui.closeQuickPanel(); if (world && world.exitWorldMap) world.exitWorldMap(); else ui.exitWorldMap?.(); break;
        case 'i': case 'I': ui.showScreen('inventory'); break;
        case 'q': case 'Q': ui.showScreen('quests'); break;
        case 'a': case 'A': ui.showScreen('achievements'); break;
        case 'p': case 'P': ui.showScreen('prestige_panel'); break;
        case 'c': case 'C': ui.showScreen('challenges'); break;
        case '1': document.getElementById('hero-ability-1')?.click(); break;
        case '2': document.getElementById('hero-ability-2')?.click(); break;
        case '3': document.getElementById('hero-ability-3')?.click(); break;
        case '4': document.getElementById('hero-ability-4')?.click(); break;
        case 'u': case 'U': document.getElementById('panel-toggle')?.click(); break;
        case 'f': case 'F': document.getElementById('fullscreen-btn')?.click(); break;
        case 'e': case 'E': document.getElementById('br-evacuate-btn')?.click(); break;
      }
    };
    document.addEventListener('keydown', _keydownHandler);

    // تحقق من حالة قاعدة البيانات
    networkManager.checkHealth().then(h => {
      if (h?.mongo === "connected") {
        if (import.meta.env?.DEV) { console.log("💾 [DB] قاعدة البيانات متصلة ✅"); }
        ui.setDbStatus(true);
      } else {
        console.warn("💾 [DB] قاعدة البيانات غير متصلة — الحفظ في الذاكرة مؤقتاً");
      }
    });

    document.addEventListener("visibilitychange", () => {
      if (document.hidden && world?.engine) {
        world.engine.setTargetFPS(4);
      } else if (world?.engine) {
        world.engine.setTargetFPS(60);
      }
    });

    document.getElementById('reload-btn')?.addEventListener('click', () => location.reload());

    window.addEventListener("beforeunload", () => {
      try { saveGame(economy, village, army); saveToDB(); persistGameSession(economy, village, army); } catch {}
    });
}


const loadingTimer = setTimeout(() => {
  console.warn("⚠️ [LOAD] تجاوزت 20 ثانية تحميل — نعرض شاشة الخطأ");
  showLoadingError();
}, 20000);

init().then(() => clearTimeout(loadingTimer)).catch(err => {
  clearTimeout(loadingTimer);
  errorLogger.logError({ type: 'initFailed', message: 'فشل تهيئة اللعبة', stack: err?.stack, original: err?.message });
  showLoadingError();
});