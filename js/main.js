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
const N8N_WEBHOOK_URL = "https://n8n.d-king.online/webhook/2ba51d69-7b2a-412d-8ddb-ae864319b146"; 

// 🔥 دالة إرسال إشعار الدخول إلى n8n عند تشغيل اللعبة
async function sendLoginNotification(username = "عبد الله") {
  try {
    await fetch(N8N_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "player_login",
        message: `🔥 تنبيه: دخل البطل ${username} إلى عالم اللعبة الآن!`,
        timestamp: new Date().toISOString()
      })
    });
    console.log("🚀 [n8n] تم إرسال إشعار دخول اللاعب بنجاح عند تشغيل اللعبة!");
  } catch (err) {
    console.warn("⚠️ فشل إرسال إشعار الدخول إلى n8n:", err.message);
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

  setProgress(5);
  await sleep(200);

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

  loadGame(economy, village, army);

  setProgress(98);
  await sleep(200);

  if (loadingScreen) loadingScreen.classList.add("fade-out");
  if (appShell) appShell.classList.remove("hidden");
  setProgress(100);

  // 📍 استدعاء إشعار الدخول فوراً هنا بعد تخطي شاشة التحميل وظهور الصفحة الرئيسية للعبة
  sendLoginNotification("عبد الله");

  setTimeout(() => {
    const ui = new GameUI(village, army, economy, world);

    let engineInstance = null;
    try {
      engineInstance = new GameEngine("gameCanvas", N8N_WEBHOOK_URL);
      world.engine = engineInstance; 
    } catch (err) {
      console.warn("فشل تهيئة الـ GameEngine:", err.message);
    }

    ui.setShopBuyCallback(function shopBuy(item) {
      switch (item) {
        case "army_boost":
          if (economy.spend("cash", 100)) {
            army.unitLevel += 2;
            ui.updateTopBar();
            audio.sfxCollect();
            
            // إرسال مباشر عند الشراء لتفادي حظر المحرك
            fetch(N8N_WEBHOOK_URL, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ event: "buy_boost", item: "army_boost", cash: economy.cash })
            }).catch(e => console.warn("n8n error:", e.message));
          }
          break;
        case "shards":
          if (economy.spend("cash", 200)) {
            economy.addRaw("gems", 20);
            ui.updateTopBar();
            audio.sfxCollect();

            // إرسال مباشر عند الشراء
            fetch(N8N_WEBHOOK_URL, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ event: "buy_shards", item: "shards", current_gems: economy.gems })
            }).catch(e => console.warn("n8n error:", e.message));
          }
          break;
        case "speed":
          if (economy.spend("cash", 150)) {
            for (const b of village.buildings) {
              if (b.state === "building") b.constructTimer = Math.max(0, b.constructTimer - 30);
            }
            ui.renderPromotion();
            audio.sfxBuild();

            // إرسال مباشر عند التسريع
            fetch(N8N_WEBHOOK_URL, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ event: "speed_build", item: "speed" })
            }).catch(e => console.warn("n8n error:", e.message));
          }
          break;
      }
    });

    economy.refreshIncome(village);

    let autoSaveTimer = 0;
    const TICK_RATE = 0.5; 

    setInterval(() => {
      economy.tick();
      village.update(TICK_RATE);
      ui.updateTopBar();
      autoSaveTimer += TICK_RATE;
      
      if (autoSaveTimer >= 15) {
        autoSaveTimer = 0;
        saveGame(economy, village, army);
        
        // 🔥 إرسال البيانات مباشرة عبر الـ fetch القياسي لتخطي عائق الـ CSP تماماً
        fetch(N8N_WEBHOOK_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            event: "player_autosave",
            cash: economy.cash,
            gems: economy.gems,
            army_power: army.totalArmyPower
          })
        })
        .then(() => console.log("✨ تم التزامن التلقائي مع n8n بنجاح!"))
        .catch(err => console.error("❌ فشل إرسال البيانات إلى n8n:", err.message));
      }
    }, TICK_RATE * 1000);

    if (engineInstance) {
      engineInstance.start((dt, ctx, camera) => {
        if (typeof world.render === "function" && !document.getElementById("gameCanvas").classList.contains("hidden")) {
          world.render(dt, ctx, camera); 
        }
      });
    }

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