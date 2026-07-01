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
const USERNAME = "عبد الله"; 

// ⬅️ دالة جلب البيانات من القاعدة (لجعل الربط أونلاين بالكامل)
async function loadFromDatabase(economy, army) {
  try {
    const response = await fetch(`${N8N_WEBHOOK_URL}?username=${encodeURIComponent(USERNAME)}`);
    const data = await response.json();
    if (data && data.cash !== undefined) {
      economy.cash = data.cash;
      economy.gems = data.gems || 0;
      army.totalArmyPower = data.army_power || 0;
      console.log("✅ [n8n] تم استعادة بياناتك من قاعدة البيانات بنجاح!");
    }
  } catch (err) {
    console.warn("⚠️ لم يتم العثور على بيانات سابقة، سنبدأ من الصفر:", err.message);
  }
}

async function sendLoginNotification(username = USERNAME) {
  try {
    await fetch(N8N_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: username,
        event: "player_login",
        message: `🔥 تنبيه: دخل البطل ${username} إلى عالم اللعبة الآن!`,
        timestamp: new Date().toISOString()
      })
    });
  } catch (err) { console.warn("⚠️ فشل إرسال إشعار الدخول:", err.message); }
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

  setProgress(20);
  const economy = new GameEconomy();
  const village = new GameVillage(economy);
  const army = new GameArmy(economy);
  
  // ⬅️ استدعاء دالة الجلب قبل بدء اللعبة
  await loadFromDatabase(economy, army);
  
  const quests = new QuestManager(economy, army, village); 
  const world = new WorldMap(economy);
  const assets = new AssetManager();
  const audio = new AudioManager();
  
  setProgress(80);
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
      // ... (نفس منطق الشراء السابق مع إضافة username)
      const payload = { username: USERNAME, event: "buy_" + item, cash: economy.cash };
      fetch(N8N_WEBHOOK_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      // (أضف منطق الشراء الخاص بك هنا كما كان)
    });

    setInterval(() => {
      economy.tick();
      village.update(0.5);
      
      // التزامن التلقائي
      fetch(N8N_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: USERNAME,
          event: "player_autosave",
          cash: economy.cash,
          gems: economy.gems,
          army_power: army.totalArmyPower
        })
      });
    }, 15000); // كل 15 ثانية
  }, 400);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
init();