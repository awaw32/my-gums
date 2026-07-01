import { formatNumber, RESOURCE_TYPES } from "./economy.js";

export class GameUI {
  constructor(village, army, economy, world, oasisManager, upgradeTree, allianceManager) {
    this.village = village;
    this.army = army;
    this.economy = economy;
    this.world = world;
    this.oasisManager = oasisManager;
    this.upgradeTree = upgradeTree;
    this.allianceManager = allianceManager;
    this.currentScreen = "promotion";
    this.screens = {};
    this.fightOverlayEl = null;
    this.init();
  }

  init() {
    this.cacheDOM();
    this.createScreens();
    this.bindNav();
    this.showScreen("promotion");
    this.startTopBarLoop();
    this.initPlayerPanel();
  }

  initPlayerPanel() {
    this._playerPanel = document.getElementById("player-panel");
    this._playerListEl = document.getElementById("player-list");
    this._playerCountEl = document.getElementById("player-count");
    if (this.world) {
      this.world._onPlayersChanged = (list) => this.updatePlayerPanel(list);
      this.world._onNotification = (msg) => this.showNotification(msg);
    }
  }

  updatePlayerPanel(players) {
    if (!this._playerListEl) return;
    const filtered = players.filter(p => p && p.username !== this.world?.username);
    this._playerCountEl.textContent = filtered.length;
    this._playerListEl.innerHTML = "";
    if (filtered.length === 0) return;
    for (const p of filtered) {
      const item = document.createElement("div");
      item.className = "player-item";
      item.innerHTML = `
        <div class="player-item-name" title="${p.username}">${p.username}</div>
        <div class="player-item-stats">
          <span class="player-stat"><span class="player-stat-icon">⚔️</span><span class="player-stat-value">${p.kills || 0}</span></span>
          <span class="player-stat"><span class="player-stat-icon">💵</span><span class="player-stat-value">${formatNumber(p.coinsEarned || 0)}</span></span>
          <span class="player-stat"><span class="player-stat-icon">👊</span><span class="player-stat-value">${formatNumber(p.army_power || 0)}</span></span>
        </div>`;
      this._playerListEl.appendChild(item);
    }
  }

  showNotification(msg) {
    const container = document.getElementById("notification-container");
    if (!container) return;
    const toast = document.createElement("div");
    toast.className = "notification-toast";
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 3000);
  }

  cacheDOM() {
    this.els = {
      appShell: document.getElementById("app-shell"),
      topBar: document.getElementById("top-bar"),
      content: document.getElementById("screen-content"),
      bottomNav: document.getElementById("bottom-bar"),
      multiplierDisplay: document.getElementById("multiplier-display"),
      cashDisplay: document.getElementById("cash-display"),
      goldDisplay: document.getElementById("gold-display"),
      levelLabel: document.getElementById("level-label"),
      levelFill: document.getElementById("level-fill"),
      avatar: document.getElementById("top-avatar"),
    };
    // إنشاء مؤشر حالة قاعدة البيانات
    this._dbStatusEl = document.createElement("span");
    this._dbStatusEl.id = "db-status";
    this._dbStatusEl.title = "قاعدة البيانات";
    Object.assign(this._dbStatusEl.style, {
      width: "8px", height: "8px", borderRadius: "50%",
      display: "inline-block", marginLeft: "6px", flexShrink: "0",
      background: "#666", transition: "background 0.5s"
    });
    this.els.avatar?.after(this._dbStatusEl);
  }

  setDbStatus(connected) {
    if (this._dbStatusEl) {
      this._dbStatusEl.style.background = connected ? "#4cd964" : "#ff4444";
      this._dbStatusEl.title = connected ? "قاعدة البيانات متصلة ✅" : "قاعدة البيانات غير متصلة ❌";
    }
  }

  createScreens() {
    this.screens.promotion = this.buildPromotionScreen();
    this.screens.ranking = this.buildRankingScreen();
    this.screens.territories = this.buildTerritoriesScreen();
    this.screens.war = this.buildWarScreen();
    this.screens.alliance = this.buildAllianceScreen();
  }

  buildPromotionScreen() {
    const container = document.createElement("div");
    container.className = "isometric-map";

    const oasis = document.createElement("div");
    oasis.className = "iso-oasis";
    oasis.id = "main-oasis";

    const title = document.createElement("div");
    title.className = "iso-oasis-title";
    title.id = "oasis-title";
    title.textContent = "🐪 واحة البداية";
    oasis.appendChild(title);

    const grid = document.createElement("div");
    grid.className = "iso-oasis-buildings";
    grid.id = "building-grid";
    oasis.appendChild(grid);

    container.appendChild(oasis);
    return container;
  }

  buildRankingScreen() {
    const div = document.createElement("div");
    div.className = "screen-panel";
    div.innerHTML = `<div class="panel-header">🏆 قمة المجد</div><div id="ranking-list"></div>`;
    return div;
  }

  buildTerritoriesScreen() {
    const div = document.createElement("div");
    div.className = "screen-panel";
    div.innerHTML = `<div class="panel-header">🗺️ الأراضي والواحات</div><div id="territory-list"></div>`;
    return div;
  }

  buildWarScreen() {
    const div = document.createElement("div");
    div.className = "screen-panel";
    div.innerHTML = `
      <div class="panel-header">⚔️ ساحات الحرب</div>
      <div class="war-card war-arena-bg">
        <div class="war-card-icon">🛡️</div>
        <div class="war-card-title">🏟️ الساحة</div>
        <div class="war-card-desc">PvP — تصفيات التأهل • 5d 19:44:19</div>
        <button id="arena-enter-btn" class="war-enter-btn">🚀 الدخول</button>
      </div>
      <div class="war-card war-adventure-bg">
        <div class="war-card-icon">🐍</div>
        <div class="war-card-title">🧭 المغامرة</div>
        <div class="war-card-desc">PvE — واجه الوحوش في الصحراء</div>
        <button id="adventure-enter-btn" class="war-enter-btn">🚀 الدخول</button>
      </div>
      <div class="war-card">
        <div class="war-card-icon">🗺️</div>
        <div class="war-card-title">🎯 الحملة</div>
        <div class="war-card-desc">PvE — 1500+ مستوى • 1257/1261</div>
        <button id="campaign-enter-btn" class="war-enter-btn">🚀 الدخول</button>
      </div>
    `;
    return div;
  }

  buildAllianceScreen() {
    const div = document.createElement("div");
    div.className = "screen-panel";
    div.innerHTML = `
      <div class="panel-header">👑 التحالف</div>
      <div id="alliance-content"></div>
    `;
    return div;
  }

  bindNav() {
    document.querySelectorAll(".nav-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const screen = btn.dataset.screen;
        if (screen) this.showScreen(screen);
      });
    });
  }

  showScreen(name) {
    this.currentScreen = name;
    const content = this.els.content;
    content.textContent = "";
    if (this.screens[name]) {
      content.appendChild(this.screens[name]);
    }
    document.querySelectorAll(".nav-btn").forEach(b => {
      b.classList.toggle("active", b.dataset.screen === name);
    });
    this.renderScreen(name);
    if (name === "promotion") {
      document.getElementById("gameCanvas")?.classList.add("hidden");
    }
  }

  renderScreen(name) {
    switch (name) {
      case "promotion": this.renderPromotion(); break;
      case "ranking": this.renderRanking(); break;
      case "territories": this.renderTerritories(); break;
      case "war": this.renderWar(); break;
      case "alliance": this.renderAlliance(); break;
    }
  }

  renderAlliance() {
    const container = document.getElementById("alliance-content");
    if (!container) return;
    if (!this.allianceManager) {
      container.innerHTML = `<div style="text-align:center;padding:20px;color:var(--beige-dark)">⚠️ التحالف غير متاح</div>`;
      return;
    }
    const state = this.allianceManager.getState();
    container.innerHTML = `
      <div class="alliance-card alliance-main">
        <div class="alliance-tier-icon">${state.level === 0 ? "🏜️" : state.level >= 4 ? "👑" : state.level >= 2 ? "🏰" : "⛺"}</div>
        <div class="alliance-tier-name">${state.tierName || "بدون تحالف"}</div>
        <div class="alliance-tier-level">المستوى ${state.level}/${state.maxLevel}</div>
        <div class="alliance-tier-bar-track">
          <div class="alliance-tier-bar-fill" style="width:${(state.level / state.maxLevel) * 100}%"></div>
        </div>
      </div>
      <div class="alliance-bonuses">
        <div class="alliance-card bonus-card">⚔️ ضرر +${state.damageBonus}</div>
        <div class="alliance-card bonus-card">🛡️ دفاع +${state.defenseBonus}</div>
        <div class="alliance-card bonus-card">💵 دخل ×${state.incomeMult.toFixed(1)}</div>
      </div>
    `;
    if (state.canUpgrade) {
      const btn = document.createElement("button");
      btn.className = "action-btn upgrade-btn alliance-upgrade-btn";
      btn.textContent = `▲ ترقية (${formatNumber(state.upgradeCost)} 🪙)`;
      btn.addEventListener("click", () => {
        if (this.allianceManager.upgrade()) {
          this.renderAlliance();
          this.updateTopBar();
        }
      });
      container.appendChild(btn);
    } else if (state.level < state.maxLevel) {
      const need = document.createElement("div");
      need.className = "alliance-need";
      need.textContent = `تحتاج ${formatNumber(state.upgradeCost)} 🪙`;
      container.appendChild(need);
    } else {
      const max = document.createElement("div");
      max.className = "alliance-max";
      max.textContent = "⭐⭐⭐ المستوى الأقصى";
      container.appendChild(max);
    }
  }

  renderPromotion() {
    const village = this.village;
    const eco = this.economy;

    const titleEl = document.getElementById("oasis-title");
    if (titleEl) {
      titleEl.textContent = village.currentVillage
        ? `🐪 ${village.currentVillage.name} — المستوى ${eco.level}`
        : "🐪 الواحة";
    }

    const grid = document.getElementById("building-grid");
    if (!grid) return;
    grid.textContent = "";

    for (const b of village.buildings) {
      const card = document.createElement("div");
      card.className = `building-card state-${b.state}`;
      card.dataset.buildingId = b.id;

      const icon = document.createElement("div");
      icon.className = "building-icon";
      icon.textContent = this.getBuildingIcon(b);

      const nameEl = document.createElement("div");
      nameEl.className = "building-name";
      nameEl.textContent = b.name;

      const info = document.createElement("div");
      info.className = "building-info";

      if (b.state === "locked") {
        info.textContent = `${b.monsterName} — ⚔️ ${b.currentMonsterPower.toFixed(0)}`;
        const fightBtn = document.createElement("button");
        fightBtn.className = "action-btn fight-btn";
        fightBtn.textContent = "⚔️ مقاتلة";
        fightBtn.addEventListener("click", () => this.doFight(b, card));
        card.appendChild(icon);
        card.appendChild(nameEl);
        card.appendChild(info);
        card.appendChild(fightBtn);
      } else if (b.state === "building") {
        info.textContent = `🔨 البناء... ${Math.ceil(b.constructTimer)}ث`;
        card.appendChild(icon);
        card.appendChild(nameEl);
        card.appendChild(info);
      } else if (b.state === "ready") {
        const badge = document.createElement("div");
        badge.className = "building-level-badge";
        badge.textContent = `LV ${b.level}`;
        info.textContent = `🪙 ${b.productionRate.toFixed(1)}/ث`;
        const upgradeBtn = document.createElement("button");
        upgradeBtn.className = "action-btn upgrade-btn";
        upgradeBtn.textContent = b.level >= b.maxLevel ? "⭐ الأقصى" : `▲ ${formatNumber(b.upgradeCost)}`;
        if (b.level < b.maxLevel) {
          upgradeBtn.addEventListener("click", () => {
            if (village.upgradeBuilding(b)) {
              this.renderPromotion();
              this.updateTopBar();
            }
          });
        }
        card.appendChild(icon);
        card.appendChild(nameEl);
        card.appendChild(badge);
        card.appendChild(info);
        card.appendChild(upgradeBtn);
      }

      grid.appendChild(card);
    }
  }

  getBuildingIcon(b) {
    if (b.state === "locked") return "👹";
    if (b.state === "building") return "🔨";
    if (b.state === "ready") {
      const icons = {
        "خيمة المؤن": "⛺",
        "مستودع السلاح": "🗡️",
        "ساحة التدريب": "🏋️",
        "برج المراقبة": "🏰",
        "سوق التجارة": "🏪",
        "مسبك الحديد": "⚒️",
        "قاعة الأبطال": "🏛️",
        "حصون الدفاع": "🛡️",
        "مزرعة الإبل": "🐪",
      };
      return icons[b.name] || "🏠";
    }
    return "❓";
  }

  doFight(b, card) {
    const playerPower = this.economy.power;
    const won = b.fight(playerPower);

    if (!won) {
      this.showFloatingText(card, "💥 غير كافٍ! قوّ جيشك", "#ff4444");
      return;
    }

    this.showFloatingText(card, "⚔️ انتصرت! 🎉", "#4cd964");
    this.economy.addXp(50);
    this.renderPromotion();
    this.updateTopBar();
  }

  showFloatingText(parent, text, color) {
    const el = document.createElement("div");
    el.className = "floating-fight-text";
    el.textContent = text;
    el.style.color = color;
    parent.appendChild(el);
    setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 1500);
  }

  renderRanking() {
    const list = document.getElementById("ranking-list");
    if (!list) return;
    list.innerHTML = `<div style="text-align:center;padding:20px;color:var(--beige-dark)">⏳ جاري التحميل...</div>`;

    fetch("/api/leaderboard")
      .then(r => r.json())
      .then(players => {
        list.innerHTML = "";
        if (!players || players.length === 0) {
          list.innerHTML = `<div style="text-align:center;padding:20px;color:var(--beige-dark)">لا يوجد لاعبون بعد</div>`;
          return;
        }
        const myName = this.world?.username || "";
        players.forEach((p, i) => {
          const isMe = p.username === myName;
          const card = document.createElement("div");
          card.className = `rank-card${isMe ? " rank-card-me" : ""}`;
          card.innerHTML = `
            <div class="rank-num">${i + 1}</div>
            <div class="rank-avatar">${isMe ? "🐪" : "🧙"}</div>
            <div class="rank-info">
              <div class="rank-name">${isMe ? "⭐ " : ""}${p.username}${isMe ? " (أنت)" : ""}</div>
              <div class="rank-power">👊 ${formatNumber(p.army_power || 0)} | 💵 ${formatNumber(p.cash || 0)}</div>
            </div>
          `;
          list.appendChild(card);
        });
      })
      .catch(() => {
        list.innerHTML = `<div style="text-align:center;padding:20px;color:var(--red)">❌ فشل التحميل</div>`;
      });
  }

  renderTerritories() {
    const list = document.getElementById("territory-list");
    if (!list) return;
    list.innerHTML = "";
    if (!this.oasisManager) return;
    const oases = this.oasisManager.getState();
    for (const o of oases) {
      const card = document.createElement("div");
      card.className = `territory-card${o.captured ? " territory-owned" : ""}`;
      const canCapture = !o.captured && this.oasisManager.canCapture(o.id);
      card.innerHTML = `
        <div class="territory-icon">${o.icon}</div>
        <div class="territory-info">
          <div class="territory-name">${o.name}</div>
          <div class="territory-status">${o.captured ? "🟢 محررة" : "🔴 تحت السيطرة"}</div>
          <div class="territory-detail">🪙 ${o.income}/ث</div>
        </div>
      `;
      if (canCapture) {
        const capBtn = document.createElement("button");
        capBtn.className = "action-btn capture-btn";
        capBtn.textContent = `⚔️ احتلال (${this.economy.power.toFixed(0)}/${o.capturePower})`;
        capBtn.addEventListener("click", () => {
          if (this.oasisManager.capture(o.id)) {
            this.renderTerritories();
            this.updateTopBar();
          }
        });
        card.appendChild(capBtn);
      } else if (!o.captured) {
        const need = document.createElement("div");
        need.className = "territory-need";
        need.textContent = `👊 تحتاج ${o.capturePower}`;
        card.appendChild(need);
      }
      list.appendChild(card);
    }
  }

  renderWar() {
    const arenaBtn = document.getElementById("arena-enter-btn");
    if (arenaBtn) {
      arenaBtn.onclick = () => this.enterArena();
    }
    const adventureBtn = document.getElementById("adventure-enter-btn");
    if (adventureBtn) {
      adventureBtn.onclick = () => this.enterAdventure();
    }
    const campaignBtn = document.getElementById("campaign-enter-btn");
    if (campaignBtn) {
      campaignBtn.onclick = () => this.enterCampaign();
    }
  }

  enterArena() {
    document.getElementById("gameCanvas")?.classList.remove("hidden");
    const topBar = document.getElementById("top-bar");
    const bottomBar = document.getElementById("bottom-bar");
    const content = document.getElementById("screen-content");
    const eventRow = document.getElementById("event-row");
    const taskRow = document.getElementById("task-row");
    const worldButtons = document.getElementById("world-buttons");
    if (topBar) topBar.style.display = "none";
    if (bottomBar) bottomBar.style.display = "none";
    if (content) content.style.display = "none";
    if (eventRow) eventRow.style.display = "none";
    if (taskRow) taskRow.style.display = "none";
    if (worldButtons) worldButtons.classList.remove("hidden");
    if (this._playerPanel) this._playerPanel.classList.remove("hidden");
    this.world.enterWorldMap();
  }

  enterAdventure() {
    this.enterArena();
  }

  enterCampaign() {
    this.enterArena();
  }

  exitWorldMap() {
    const topBar = document.getElementById("top-bar");
    const bottomBar = document.getElementById("bottom-bar");
    const content = document.getElementById("screen-content");
    const eventRow = document.getElementById("event-row");
    const taskRow = document.getElementById("task-row");
    const worldButtons = document.getElementById("world-buttons");
    if (topBar) topBar.style.display = "";
    if (bottomBar) bottomBar.style.display = "";
    if (content) content.style.display = "";
    if (eventRow) eventRow.style.display = "";
    if (taskRow) taskRow.style.display = "";
    if (worldButtons) worldButtons.classList.add("hidden");
    if (this._playerPanel) this._playerPanel.classList.add("hidden");
    if (this.currentScreen) this.showScreen(this.currentScreen);
  }

  updateTopBar() {
    const eco = this.economy;
    if (this.els.multiplierDisplay) {
      this.els.multiplierDisplay.textContent = `x${formatNumber(eco.multiplier)}`;
    }
    if (this.els.cashDisplay) {
      this.els.cashDisplay.textContent = eco.cashFormatted;
    }
    if (this.els.goldDisplay) {
      this.els.goldDisplay.textContent = eco.goldFormatted;
    }
    const foodEl = document.getElementById("food-display");
    if (foodEl) foodEl.textContent = eco.foodFormatted;
    if (this.els.levelLabel) {
      this.els.levelLabel.textContent = `LV ${eco.level}/${eco.maxLevel}`;
    }
    if (this.els.levelFill) {
      const pct = eco.xpToNext > 0 ? Math.min(100, (eco.xp / eco.xpToNext) * 100) : 0;
      this.els.levelFill.style.width = pct + "%";
    }
    this.updateTasks();
  }

  updateTasks() {
    const village = this.village;
    const eco = this.economy;

    const totalLevel = village.buildings.reduce((s, b) => s + b.level, 0);
    const task0Prog = document.getElementById("task-progress-0");
    if (task0Prog) task0Prog.textContent = totalLevel.toString();
    const task0Fill = document.getElementById("task-fill-0");
    if (task0Fill) task0Fill.style.width = Math.min(100, (totalLevel / 920) * 100) + "%";

    const camelFarm = village.buildings.find(b => b.name.includes("إبل") || b.name.includes("مزرعة"));
    const camelLevel = camelFarm ? camelFarm.level : 0;
    const task1Prog = document.getElementById("task-progress-1");
    if (task1Prog) task1Prog.textContent = camelLevel.toString();
    const task1Fill = document.getElementById("task-fill-1");
    if (task1Fill) task1Fill.style.width = Math.min(100, (camelLevel / 200) * 100) + "%";

    const task2Prog = document.getElementById("task-progress-2");
    if (task2Prog) task2Prog.textContent = eco.cashFormatted;
    const task2Fill = document.getElementById("task-fill-2");
    if (task2Fill) task2Fill.style.width = Math.min(100, (eco.cash / 3.5e15) * 100) + "%";
  }

  startTopBarLoop() {
    this._topBarInterval = setInterval(() => this.updateTopBar(), 500);
    if (this.oasisManager) {
      this.oasisManager._onOasesChanged = () => {
        if (this.currentScreen === "territories") this.renderTerritories();
        this.updateTopBar();
      };
    }
    if (this.upgradeTree) {
      this.upgradeTree._onChanged = () => this.updateTopBar();
    }
    if (this.allianceManager) {
      this.allianceManager._onChanged = () => {
        if (this.currentScreen === "alliance") this.renderAlliance();
        this.updateTopBar();
      };
    }
  }

  setShopBuyCallback(fn) {
    this._shopBuy = fn;
    window.shopBuy = fn;
  }
}
