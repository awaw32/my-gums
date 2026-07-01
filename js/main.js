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

const N8N_WEBHOOK_URL = "https://n8n.d-king.online/webhook/2ba51d69-7b2a-412d-8ddb-ae864319b146"; 
const USERNAME = "عبد الله"; // المعرف الثابت للاعب لربط البيانات في قاعدة البيانات

async function sendLoginNotification(username = USERNAME) {
  try {
    await fetch(N8N_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: username, // إرسال المعرف
        event: "player_login",
        message: `🔥 تنبيه: دخل البطل ${username} إلى عالم اللعبة الآن!`,
        timestamp: new Date().toISOString()
      })
    });
    console.log("🚀 [n8n] تم إرسال إشعار دخول اللاعب بنجاح!");
  } catch (err) {
    console.warn("⚠️ فشل إرسال إشعار الدخول:", err.message);
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

  const economy = new GameEconomy();
  const village = new GameVillage(economy);
  const army = new GameArmy(economy);
  const quests = new QuestManager(economy, army, village); 
  const world = new WorldMap(economy);
  const assets = new AssetManager();
  const audio = new AudioManager();
  
  setProgress(90);
  loadGame(economy, village, army);
  setProgress(100);

  if (loadingScreen) loadingScreen.classList.add("fade-out");
  if (appShell) appShell.classList.remove("hidden");

  sendLoginNotification(USERNAME);

  setTimeout(() => {
    const ui = new GameUI(village, army, economy, world);
    let engineInstance = new GameEngine("gameCanvas", N8N_WEBHOOK_URL);
    world.engine = engineInstance;

    ui.setShopBuyCallback(function shopBuy(item) {
      switch (item) {
        case "army_boost":
          if (economy.spend("cash", 100)) {
            army.unitLevel += 2;
            ui.updateTopBar();
            audio.sfxCollect();
            fetch(N8N_WEBHOOK_URL, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ username: USERNAME, event: "buy_boost", item: "army_boost", cash: economy.cash })
            }).catch(e => console.warn("n8n error:", e.message));
          }
          break;
        case "shards":
          if (economy.spend("cash", 200)) {
            economy.addRaw("gems", 20);
            ui.updateTopBar();
            audio.sfxCollect();
            fetch(N8N_WEBHOOK_URL, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ username: USERNAME, event: "buy_shards", item: "shards", current_gems: economy.gems })
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
            fetch(N8N_WEBHOOK_URL, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ username: USERNAME, event: "speed_build", item: "speed" })
            }).catch(e => console.warn("n8n error:", e.message));
          }
          break;
      }
    });

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
        
        fetch(N8N_WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: USERNAME, // إضافة الهوية هنا
            event: "player_autosave",
            cash: economy.cash,
            gems: economy.gems,
            army_power: army.totalArmyPower
          })
        })
        .then(() => console.log("✨ تم التزامن التلقائي مع n8n بنجاح!"))
        .catch(err => console.error("❌ فشل إرسال البيانات:", err.message));
      }
    }, TICK_RATE * 1000);
  }, 400);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
init();