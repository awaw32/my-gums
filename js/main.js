import { GameEngine } from "./engine.js";
import { GameEconomy } from "./economy.js";
import { GameVillage } from "./village.js";
import { GameArmy } from "./army.js";
import { GameUI } from "./ui.js";
import { WorldMap } from "./world.js";
import { AssetManager } from "./asset-manager.js";
import { AudioManager } from "./audio.js";
import { saveGame, loadGame } from "./save.js";
import { QuestManager } from "./quests.js";

// رابط الويب هوك الخاص بك للتزامن أونلاين والمزامنة التلقائية
const N8N_WEBHOOK_URL = "https://n8n.d-king.online/webhook-test/2ba51d69-7b2a-412d-8ddb-ae864319b146"; 

async function init() {
  const loadingFill = document.getElementById("loading-progress");
  const loadingPct = document.getElementById("loading-pct");
  const loadingScreen = document.getElementById("loading-screen");
  const appShell = document.getElementById("app-shell");

  function setProgress(pct) {
    if (loadingFill) loadingFill.style.width = pct + "%";
    if (loadingPct) loadingPct.textContent = pct + "%";
  }

  setProgress(5);
  await sleep(200);

  // ─── فحص أمان وجود الملفات لضمان عدم حدوث Crash ───
  if (typeof GameEconomy === "undefined" || typeof WorldMap === "undefined") {
    console.error("خطأ حرج: بعض السكربتات الأساسية لم يتم تحميلها بالشكل الصحيح.");
    return;
  }

  const economy = new GameEconomy();
  setProgress(20);
  await sleep(150);

  const village = new GameVillage(economy);
  setProgress(35);
  await sleep(150);

  const army = new GameArmy(economy);
  setProgress(50);
  await sleep(150);

  const quests = new QuestManager(economy, army, village); 
  setProgress(55);
  await sleep(100);

  // تهيئة خريطة العالم
  const world = new WorldMap(economy);
  setProgress(65);
  await sleep(150);

  const assets = new AssetManager();
  const audio = new AudioManager();
  setProgress(80);
  await sleep(150);

  economy.powerSources.push(() => village.getPower());
  economy.powerSources.push(() => army.totalArmyPower);

  setProgress(90);
  await sleep(150);

  // تحميل البيانات المحفوظة محلياً أو سحبها أونلاين
  loadGame(economy, village, army);

  setProgress(98);
  await sleep(200);

  if (loadingScreen) loadingScreen.classList.add("fade-out");
  if (appShell) appShell.classList.remove("hidden");
  setProgress(100);

  setTimeout(() => {
    const ui = new GameUI(village, army, economy, world);

    // ربط كائن المحرك للعمل أونلاين وضمان عدم تعارض الخرائط
    let engineInstance = null;
    try {
      engineInstance = new GameEngine("gameCanvas", N8N_WEBHOOK_URL);
      world.engine = engineInstance; // ربط المحرك بملف الخريطة
    } catch (err) {
      console.warn("فشل تهيئة الـ GameEngine، تأكد من وجود كود HTML للـ Canvas مناسب:", err.message);
    }

    ui.setShopBuyCallback(function shopBuy(item) {
      switch (item) {
        case "army_boost":
          if (economy.spend("cash", 100)) {
            army.unitLevel += 2;
            ui.updateTopBar();
            audio.sfxCollect();
            if(engineInstance) engineInstance._sendEvent("buy_boost", { item: "army_boost" });
          }
          break;
        case "shards":
          if (economy.spend("cash", 200)) {
            economy.addRaw("gems", 20);
            ui.updateTopBar();
            audio.sfxCollect();
            if(engineInstance) engineInstance._sendEvent("buy_shards", { item: "shards", current_gems: economy.gems });
          }
          break;
        case "speed":
          if (economy.spend("cash", 150)) {
            for (const b of village.buildings) {
              if (b.state === "building") b.constructTimer = Math.max(0, b.constructTimer - 30);
            }
            ui.renderPromotion();
            audio.sfxBuild();
            if(engineInstance) engineInstance._sendEvent("speed_build", { item: "speed" });
          }
          break;
      }
    });

    economy.refreshIncome(village);

    let autoSaveTimer = 0;
    const TICK_RATE = 0.5; // نصف ثانية لتحديث اللعبة

    // حلقة التحديث والمزامنة الأساسية
    setInterval(() => {
      economy.tick();
      village.update(TICK_RATE);
      ui.updateTopBar();
      autoSaveTimer += TICK_RATE;
      
      // حفظ كل 15 ثانية محلياً، وإرسال حالة الحفظ أونلاين للحماية من الغش
      if (autoSaveTimer >= 15) {
        autoSaveTimer = 0;
        saveGame(economy, village, army);
        if (engineInstance) {
          engineInstance._sendEvent("player_autosave", {
            cash: economy.cash,
            gems: economy.gems,
            army_power: army.totalArmyPower
          });
        }
      }
    }, TICK_RATE * 1000);

    // تشغيل حلقة رسم المحرك عند فتح خريطة العالم
    if (engineInstance) {
      engineInstance.start((dt, ctx, camera) => {
        if (typeof world.render === "function" && !document.getElementById("gameCanvas").classList.contains("hidden")) {
          world.render(dt, ctx, camera); 
        }
      });
    }

    // حدث الخروج من خريطة العالم والمزامنة التلقائية عند الإغلاق
    document.addEventListener("click", (e) => {
      const exitBtn = e.target.closest("#exit-world-btn");
      if (exitBtn) {
        audio.sfxClick();
        world.exitWorldMap();
        const canvas = document.getElementById("gameCanvas");
        const topBar = document.getElementById("top-bar");
        const bottomBar = document.getElementById("bottom-bar");
        const content = document.getElementById("screen-content");
        const eventRow = document.getElementById("event-row");
        const taskRow = document.getElementById("task-row");
        const worldButtons = document.getElementById("world-buttons");
        
        if (canvas) canvas.classList.add("hidden");
        if (worldButtons) worldButtons.classList.add("hidden");
        if (topBar) topBar.style.display = "";
        if (bottomBar) bottomBar.style.display = "";
        if (content) content.style.display = "";
        if (eventRow) eventRow.style.display = "";
        if (taskRow) taskRow.style.display = "";
        
        saveGame(economy, village, army);
        if (engineInstance) engineInstance._sendEvent("exit_world_map");
        return;
      }
    });

    window.addEventListener("resize", () => {
      if (engineInstance) engineInstance.resize();
    });

    window.addEventListener("beforeunload", () => {
      saveGame(economy, village, army);
    });
  }, 400);
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

init();