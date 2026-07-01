import { GameEconomy } from "./economy.js";
import { GameVillage } from "./village.js";
import { GameArmy } from "./army.js";
import { GameUI } from "./ui.js";
import { WorldMap } from "./world.js";
import { AssetManager } from "./asset-manager.js";
import { AudioManager } from "./audio.js";
import { saveGame, loadGame } from "./save.js";
import { QuestManager } from "./quests.js";

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
    const response = await fetch(`${API_BASE}/api/players/${encodeURIComponent(username)}`);
    const data = await response.json();
    if (data && data.cash !== undefined) {
      economy.cash = data.cash;
      economy.gems = data.gems || 0;
      economy.gold = data.gold || 0;
      economy.kingCoins = data.kingCoins || 0;
      economy.hammers = data.hammers || 0;
      economy.scrolls = data.scrolls || 0;
      economy.horns = data.horns || 0;
      army.unitLevel = data.unitLevel || 1;
      if (data.weapons && Array.isArray(data.weapons)) {
        for (const wd of data.weapons) {
          const w = army.weapons.find(ww => ww.id === wd.id);
          if (w) w.level = wd.level || 0;
        }
      }
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
  
  await loadFromDatabase(economy, army, PLAYER_USERNAME);
  
  const quests = new QuestManager(economy, army, village); 
  const world = new WorldMap(economy, PLAYER_USERNAME, API_BASE);
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
    // حفظ فوري في قاعدة البيانات عشان ما يضيع البونص
    try {
      fetch(`${API_BASE}/api/players/${encodeURIComponent(PLAYER_USERNAME)}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cash: economy.cash, gems: economy.gems, gold: economy.gold, kingCoins: economy.kingCoins, hammers: economy.hammers, scrolls: economy.scrolls, horns: economy.horns, army_power: economy.power, unitLevel: 1, weapons: [], last_active: Date.now() })
      }).catch(() => {});
    } catch {}
  } else {
    // حفظ حالة الدخول
    try {
      fetch(`${API_BASE}/api/players/${encodeURIComponent(PLAYER_USERNAME)}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ last_active: Date.now() })
      }).catch(() => {});
    } catch {}
  }
  
  setProgress(100);

  if (loadingScreen) loadingScreen.classList.add("fade-out");
  if (appShell) appShell.classList.remove("hidden");

  setTimeout(() => {
    const ui = new GameUI(village, army, economy, world);
    world.onExit = () => ui.exitWorldMap();

    const saveToDB = () => {
      fetch(`${API_BASE}/api/players/${encodeURIComponent(PLAYER_USERNAME)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cash: economy.cash,
          gems: economy.gems,
          gold: economy.gold,
          kingCoins: economy.kingCoins,
          hammers: economy.hammers,
          scrolls: economy.scrolls,
          horns: economy.horns,
          army_power: economy.power,
          unitLevel: army.unitLevel,
          weapons: army.weapons.map(w => ({ id: w.id, level: w.level })),
          x_position: world.leader ? Math.floor(world.leader.x) : 0,
          y_position: world.leader ? Math.floor(world.leader.y) : 0,
          last_active: Date.now()
        })
      }).catch(() => {});
    };

    ui.setShopBuyCallback(function shopBuy(item) {
      switch (item) {
        case "unit":
          if (army.unitLevel < army.maxUnitLevel) {
            const cost = army.unitUpgradeCost;
            if (economy.spend("cash", cost)) {
              army.unitLevel++;
              saveToDB();
            }
          }
          break;

        case "heal":
          if (economy.spend("cash", 20)) {
            if (world.leader) {
              world.leader.hp = Math.min(world.leader.maxHp, world.leader.hp + 30);
            }
            saveToDB();
          }
          break;

        default:
          const weapon = army.weapons.find(w => w.id === item);
          if (weapon && weapon.level < weapon.maxLevel) {
            const cost = weapon.upgradeCost;
            if (economy.spend("gems", cost)) {
              weapon.level++;
              saveToDB();
            }
          }
          break;
      }
    });

    setInterval(() => {
      economy.tick();
      village.update(0.5);
      saveToDB();
    }, 15000);
  }, 400);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
init();