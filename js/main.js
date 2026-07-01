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

const N8N_WEBHOOK_URL = "https://n8n.d-king.online/webhook/1fe62b81-3e33-4d1c-a253-165f193f437e"; 
const N8N_WEBHOOK_URL_TEST = "https://n8n.d-king.online/webhook-test/1fe62b81-3e33-4d1c-a253-165f193f437e"; 

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
    background: "radial-gradient(ellipse at center, #3d2a15, #1a0e06)",
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

async function loadFromDatabase(economy, army, username) {
  try {
    const response = await fetch(`${N8N_WEBHOOK_URL}?username=${encodeURIComponent(username)}`);
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

async function sendLoginNotification(username) {
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

  setProgress(10);
  const PLAYER_USERNAME = await getOrPromptUsername();
  setProgress(20);
  
  const economy = new GameEconomy();
  const village = new GameVillage(economy);
  const army = new GameArmy(economy);
  
  await loadFromDatabase(economy, army, PLAYER_USERNAME);
  
  const quests = new QuestManager(economy, army, village); 
  const world = new WorldMap(economy, PLAYER_USERNAME);
  const assets = new AssetManager();
  const audio = new AudioManager();
  
  setProgress(80);
  loadGame(economy, village, army);
  
  // 🎁 بونص ترحيبي للاعب الجديد (1000 من كل عملة)
  const isNew = [!economy.cash, !economy.gems, !economy.gold, !economy.kingCoins, !economy.hammers, !economy.scrolls, !economy.horns].every(v => v === true);
  if (isNew) {
    economy.addRaw("cash", 1000);
    economy.addRaw("gems", 1000);
    economy.addRaw("gold", 1000);
    economy.addRaw("kingCoins", 1000);
    economy.addRaw("hammers", 1000);
    economy.addRaw("scrolls", 1000);
    economy.addRaw("horns", 1000);
    console.log("🎉 [بونص] تم منح الرصيد الترحيبي للاعب الجديد!");
  }
  
  setProgress(100);

  if (loadingScreen) loadingScreen.classList.add("fade-out");
  if (appShell) appShell.classList.remove("hidden");

  sendLoginNotification(PLAYER_USERNAME);

  setTimeout(() => {
    const ui = new GameUI(village, army, economy, world);
    let engineInstance = new GameEngine("gameCanvas", N8N_WEBHOOK_URL);
    world.engine = engineInstance;

    world.onExit = () => ui.exitWorldMap();

    ui.setShopBuyCallback(function shopBuy(item) {
      switch (item) {
        case "unit":
          if (army.unitLevel < army.maxUnitLevel) {
            const cost = army.unitUpgradeCost;
            if (economy.spend("cash", cost)) {
              army.unitLevel++;
              fetch(N8N_WEBHOOK_URL, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username: PLAYER_USERNAME, event: "buy_unit", cash: economy.cash, army_power: army.totalArmyPower })
              });
            }
          }
          break;

        case "heal":
          if (economy.spend("cash", 20)) {
            if (world.leader) {
              world.leader.hp = Math.min(world.leader.maxHp, world.leader.hp + 30);
            }
            fetch(N8N_WEBHOOK_URL, {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ username: PLAYER_USERNAME, event: "buy_heal", cash: economy.cash })
            });
          }
          break;

        default:
          const weapon = army.weapons.find(w => w.id === item);
          if (weapon && weapon.level < weapon.maxLevel) {
            const cost = weapon.upgradeCost;
            if (economy.spend("gems", cost)) {
              weapon.level++;
              fetch(N8N_WEBHOOK_URL, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username: PLAYER_USERNAME, event: "buy_" + item, weapon: weapon.id, level: weapon.level, gems: economy.gems, army_power: army.totalArmyPower })
              });
            }
          }
          break;
      }
    });

    setInterval(() => {
      economy.tick();
      village.update(0.5);
      
      fetch(N8N_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: PLAYER_USERNAME,
          event: "player_autosave",
          cash: economy.cash,
          gems: economy.gems,
          gold: economy.gold,
          kingCoins: economy.kingCoins,
          hammers: economy.hammers,
          scrolls: economy.scrolls,
          horns: economy.horns,
          army_power: army.totalArmyPower,
          x_position: world.leader ? Math.floor(world.leader.x) : 0,
          y_position: world.leader ? Math.floor(world.leader.y) : 0,
          last_active: Date.now()
        })
      });
    }, 15000);
  }, 400);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
init();