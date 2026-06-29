import { GameEconomy } from "./economy.js";
import { GameVillage } from "./village.js";
import { GameArmy } from "./army.js";
import { GameUI } from "./ui.js";
import { WorldMap } from "./world.js";
import { AssetManager } from "./asset-manager.js";
import { AudioManager } from "./audio.js";
import { saveGame, loadGame } from "./save.js";
import { QuestManager } from "./quests.js";

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
  setProgress(20);
  await sleep(150);

  const village = new GameVillage(economy);
  setProgress(35);
  await sleep(150);

  const army = new GameArmy(economy);
  setProgress(50);
  await sleep(150);

  const quests = new QuestManager(economy, army, village); // نظام القصة + المهام اليومية + التحالف (الخطوة 1 - للإدمان)
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

  setTimeout(() => {
    const ui = new GameUI(village, army, economy, world);

    ui.setShopBuyCallback(function shopBuy(item) {
      switch (item) {
        case "army_boost":
          if (economy.spend("cash", 100)) {
            army.unitLevel += 2;
            ui.updateTopBar();
            audio.sfxCollect();
          }
          break;
        case "shards":
          if (economy.spend("cash", 200)) {
            economy.addRaw("gems", 20);
            ui.updateTopBar();
            audio.sfxCollect();
          }
          break;
        case "speed":
          if (economy.spend("cash", 150)) {
            for (const b of village.buildings) {
              if (b.state === "building") b.constructTimer = Math.max(0, b.constructTimer - 30);
            }
            ui.renderPromotion();
            audio.sfxBuild();
          }
          break;
      }
    });

    economy.refreshIncome(village);

    let autoSaveTimer = 0;

    setInterval(() => {
      economy.tick();
      village.update(0.5);
      ui.updateTopBar();
      autoSaveTimer += 0.5;
      if (autoSaveTimer >= 15) {
        autoSaveTimer = 0;
        saveGame(economy, village, army);
      }
    }, 500);

    // World map exit event
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
      const eng = world.engine;
      if (eng) eng.resize();
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
