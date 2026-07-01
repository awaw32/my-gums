import { formatNumber, RESOURCE_TYPES } from "./economy.js";

export class GameUI {
  constructor(village, army, economy, world, oasisManager, upgradeTree, allianceManager, achievements, dailyLogin, prestige, inventory, events, tutorial) {
    this.village = village;
    this.army = army;
    this.economy = economy;
    this.world = world;
    this.oasisManager = oasisManager;
    this.upgradeTree = upgradeTree;
    this.allianceManager = allianceManager;
    this.achievements = achievements;
    this.dailyLogin = dailyLogin;
    this.prestige = prestige;
    this.inventory = inventory;
    this.events = events;
    this.tutorial = tutorial;
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
    this.initChat();
    this.initTutorial();
    this.initDailyCheck();
  }

  initChat() {
    const chatInput = document.getElementById("chat-input");
    const chatSend = document.getElementById("chat-send-btn");
    if (chatInput && chatSend) {
      chatSend.addEventListener("click", () => {
        const text = chatInput.value.trim();
        if (text && this.world) {
          this.world._sendWS({ type: "chat", message: text });
          chatInput.value = "";
        }
      });
      chatInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") chatSend.click();
      });
    }
  }

  initTutorial() {
    if (!this.tutorial || !this.tutorial.needsTutorial) return;
    setTimeout(() => this.showTutorialStep(), 2000);
  }

  showTutorialStep() {
    const step = this.tutorial.current;
    if (!step) return;
    const overlay = document.getElementById("tutorial-overlay");
    const textEl = document.getElementById("tutorial-text");
    const nextBtn = document.getElementById("tutorial-next-btn");
    const skipBtn = document.getElementById("tutorial-skip-btn");
    if (!overlay || !textEl) return;
    overlay.style.display = "flex";
    textEl.textContent = step.text;
    if (nextBtn) {
      nextBtn.onclick = () => {
        this.tutorial.next();
        const nextStep = this.tutorial.current;
        if (nextStep) this.showTutorialStep();
        else overlay.style.display = "none";
      };
    }
    if (skipBtn) {
      skipBtn.onclick = () => {
        this.tutorial.skip();
        overlay.style.display = "none";
      };
    }
  }

  initDailyCheck() {
    if (!this.dailyLogin) return;
    if (this.dailyLogin.checkDaily()) {
      setTimeout(() => {
        this.showNotification(`📅 لديك مكافأة يومية! اذهب إلى شاشة المكافآت.`);
      }, 5000);
    }
  }

  initPlayerPanel() {
    this._playerPanel = document.getElementById("player-panel");
    this._playerListEl = document.getElementById("player-list");
    this._playerCountEl = document.getElementById("player-count");
    this._chatPanel = document.getElementById("chat-panel");
    this._chatMessages = document.getElementById("chat-messages");
    if (this.world) {
      this.world._onPlayersChanged = (list) => this.updatePlayerPanel(list);
      this.world._onNotification = (msg) => this.showNotification(msg);
      this.world._onChatMessage = (username, msg) => this.addChatMessage(username, msg);
    }
    // ربط زر الشات
    const chatToggle = document.getElementById("chat-toggle-btn");
    if (chatToggle) {
      chatToggle.addEventListener("click", () => {
        if (this._chatPanel) this._chatPanel.classList.toggle("hidden");
      });
    }
  }

  addChatMessage(username, msg) {
    if (!this._chatMessages) return;
    const el = document.createElement("div");
    el.className = "chat-msg";
    const isMe = username === this.world?.username;
    el.innerHTML = `<span class="chat-author" style="color:${isMe ? '#4cd964' : '#FFD700'}">${username}</span>: ${msg}`;
    this._chatMessages.appendChild(el);
    this._chatMessages.scrollTop = this._chatMessages.scrollHeight;
  }

  updatePlayerPanel(players) {
    if (!this._playerListEl) return;
    const filtered = players.filter(p => p && p.username !== this.world?.username);
    this._playerCountEl.textContent = filtered.length;
    this._playerListEl.innerHTML = "";
    // إظهار اللاعب نفسه أولاً
    const me = players.find(p => p && p.username === this.world?.username);
    if (me) {
      const myItem = document.createElement("div");
      myItem.className = "player-item player-item-me";
      myItem.innerHTML = `
        <div class="player-item-name" style="color:var(--gold)">⭐ ${me.username} (أنت)</div>
        <div class="player-item-stats">
          <span class="player-stat">👊 ${formatNumber(me.army_power || 0)}</span>
        </div>`;
      this._playerListEl.appendChild(myItem);
    }
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
    this.screens.achievements = this.buildAchievementsScreen();
    this.screens.inventory = this.buildInventoryScreen();
    this.screens.events_panel = this.buildEventsScreen();
    this.screens.prestige_panel = this.buildPrestigeScreen();
    this.screens.daily = this.buildDailyLoginScreen();
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
    document.querySelectorAll(".nav-btn, .sub-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const screen = btn.dataset.screen;
        if (screen) this.showScreen(screen);
      });
    });
  }

  showScreen(name) {
    const canvas = document.getElementById("gameCanvas");
    if (canvas) canvas.classList.add("hidden");
    this.currentScreen = name;
    const content = this.els.content;
    content.textContent = "";
    if (this.screens[name]) {
      content.appendChild(this.screens[name]);
    }
    document.querySelectorAll(".nav-btn, .sub-btn").forEach(b => {
      b.classList.toggle("active", b.dataset.screen === name);
    });
    document.querySelectorAll(".nav-btn").forEach(b => {
      b.classList.toggle("active", b.dataset.screen === name);
    });
    this.renderScreen(name);
  }

  buildAchievementsScreen() {
    const div = document.createElement("div");
    div.className = "screen-panel";
    div.innerHTML = `<div class="panel-header">🏆 الإنجازات</div><div id="achievements-list" class="achievements-grid"></div>`;
    return div;
  }

  buildInventoryScreen() {
    const div = document.createElement("div");
    div.className = "screen-panel";
    div.innerHTML = `
      <div class="panel-header">📦 التصنيع والمخزون</div>
      <div id="inventory-items" class="inventory-items"></div>
      <div class="panel-header" style="margin-top:12px">🔨 وصفات التصنيع</div>
      <div id="crafting-recipes" class="crafting-grid"></div>
    `;
    return div;
  }

  buildEventsScreen() {
    const div = document.createElement("div");
    div.className = "screen-panel";
    div.innerHTML = `<div class="panel-header">🎊 الأحداث</div><div id="events-list" class="events-list"></div>`;
    return div;
  }

  buildPrestigeScreen() {
    const div = document.createElement("div");
    div.className = "screen-panel";
    div.innerHTML = `<div class="panel-header">🔄 Prestige (إعادة الميلاد)</div><div id="prestige-content"></div>`;
    return div;
  }

  buildDailyLoginScreen() {
    const div = document.createElement("div");
    div.className = "screen-panel";
    div.innerHTML = `<div class="panel-header">📅 المكافآت اليومية</div><div id="daily-content"></div>`;
    return div;
  }

  renderScreen(name) {
    switch (name) {
      case "promotion": this.renderPromotion(); break;
      case "ranking": this.renderRanking(); break;
      case "territories": this.renderTerritories(); break;
      case "war": this.renderWar(); break;
      case "alliance": this.renderAlliance(); break;
      case "achievements": this.renderAchievements(); break;
      case "inventory": this.renderInventory(); break;
      case "events_panel": this.renderEvents(); break;
      case "prestige_panel": this.renderPrestige(); break;
      case "daily": this.renderDailyLogin(); break;
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
    const subBar = document.getElementById("sub-bar");
    const content = document.getElementById("screen-content");
    const eventRow = document.getElementById("event-row");
    const taskRow = document.getElementById("task-row");
    const worldButtons = document.getElementById("world-buttons");
    if (topBar) topBar.style.display = "none";
    if (bottomBar) bottomBar.style.display = "none";
    if (subBar) subBar.style.display = "none";
    if (content) content.style.display = "none";
    if (eventRow) eventRow.style.display = "none";
    if (taskRow) taskRow.style.display = "none";
    if (worldButtons) worldButtons.classList.remove("hidden");
    if (this._playerPanel) this._playerPanel.classList.remove("hidden");
    document.querySelectorAll(".world-buttons .hidden").forEach(b => b.classList.remove("hidden"));
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
    const subBar = document.getElementById("sub-bar");
    const content = document.getElementById("screen-content");
    const eventRow = document.getElementById("event-row");
    const taskRow = document.getElementById("task-row");
    const worldButtons = document.getElementById("world-buttons");
    if (topBar) topBar.style.display = "";
    if (bottomBar) bottomBar.style.display = "";
    if (subBar) subBar.style.display = "";
    if (content) content.style.display = "";
    if (eventRow) eventRow.style.display = "";
    if (taskRow) taskRow.style.display = "";
    if (worldButtons) worldButtons.classList.add("hidden");
    if (this._playerPanel) this._playerPanel.classList.add("hidden");
    if (this._chatPanel) this._chatPanel.classList.add("hidden");
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
    const powerEl = document.getElementById("power-display");
    if (powerEl) powerEl.textContent = `👊 ${eco.powerFormatted}`;
    if (this.els.levelLabel) {
      this.els.levelLabel.textContent = `LV ${eco.level}/${eco.maxLevel}`;
    }
    if (this.els.levelFill) {
      const pct = eco.xpToNext > 0 ? Math.min(100, (eco.xp / eco.xpToNext) * 100) : 0;
      this.els.levelFill.style.width = pct + "%";
    }
    this.updateTasks();
  }

  renderAchievements() {
    const list = document.getElementById("achievements-list");
    if (!list || !this.achievements) return;
    list.innerHTML = "";
    const all = this.achievements.getAll();
    for (const a of all) {
      const card = document.createElement("div");
      card.className = `achievement-card${a.completed ? (a.claimed ? ' achievement-claimed' : ' achievement-done') : ''}`;
      const pct = a.target > 0 ? Math.min(100, (a.progress / a.target) * 100) : 0;
      card.innerHTML = `
        <div class="achievement-icon">${a.icon}</div>
        <div class="achievement-info">
          <div class="achievement-name">${a.title}</div>
          <div class="achievement-desc">${a.desc}</div>
          <div class="achievement-progress-track">
            <div class="achievement-progress-fill" style="width:${pct}%"></div>
          </div>
          <div class="achievement-progress-text">${a.completed ? (a.claimed ? '✅ تم' : '🏆 استلم!') : `${a.progress}/${a.target}`}</div>
        </div>
      `;
      if (a.completed && !a.claimed) {
        card.style.cursor = "pointer";
        card.addEventListener("click", () => {
          if (this.achievements.claim(a.id)) {
            this.renderAchievements();
            this.updateTopBar();
          }
        });
      }
      list.appendChild(card);
    }
  }

  renderInventory() {
    const itemsEl = document.getElementById("inventory-items");
    const recipesEl = document.getElementById("crafting-recipes");
    if (!this.inventory) return;
    if (itemsEl) {
      const state = this.inventory.getState();
      itemsEl.innerHTML = Object.keys(state.items).length === 0
        ? '<div style="text-align:center;padding:20px;color:var(--beige-dark)">📭 المخزون فارغ — اصنع قطعتك الأولى!</div>'
        : Object.entries(state.items).map(([id, count]) =>
            `<div class="inventory-item"><span class="inv-item-icon">${id.includes('sword') ? '🗡️' : id.includes('shield') ? '🛡️' : id.includes('helmet') ? '⛑️' : id.includes('potion') ? '🧪' : id.includes('gem') ? '💎' : id.includes('ticket') ? '🎫' : id.includes('scroll') ? '📜' : id.includes('blueprint') ? '📐' : '📦'}</span><span class="inv-item-name">${id}</span><span class="inv-item-count">×${count}</span></div>`
          ).join('');
    }
    if (recipesEl) {
      const recipes = this.inventory.getAllRecipes();
      recipesEl.innerHTML = recipes.map(r => {
        const canCraft = this.inventory.canCraft(r.id);
        return `<div class="crafting-card${canCraft ? ' craftable' : ''}">
          <div class="craft-icon">${r.icon}</div>
          <div class="craft-info">
            <div class="craft-name">${r.name}</div>
            <div class="craft-desc">${r.description}</div>
            <div class="craft-cost">${Object.entries(r.ingredients).map(([res, amt]) => {
              const icons = {gold:'🪙',cash:'💵',hammers:'🔨',scrolls:'📜',horns:'📯',kingCoins:'👑',food:'🌾',gems:'💎'};
              return `${icons[res]||'•'} ${amt}`;
            }).join(' + ')}</div>
          </div>
          <button class="action-btn craft-btn" data-recipe="${r.id}" ${canCraft ? '' : 'disabled'}>🔨 اصنع</button>
        </div>`;
      }).join('');
      recipesEl.querySelectorAll('.craft-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          if (this.inventory.craft(btn.dataset.recipe)) {
            this.showNotification('✅ تم التصنيع!');
            this.renderInventory();
            this.updateTopBar();
          }
        });
      });
    }
  }

  renderEvents() {
    const list = document.getElementById("events-list");
    if (!list || !this.events) return;
    const all = this.events.getState();
    list.innerHTML = all.length === 0
      ? '<div style="text-align:center;padding:20px;color:var(--beige-dark)">لا توجد أحداث حالياً</div>'
      : all.map(e => `<div class="event-card${e.active ? ' event-active' : ''}">
          <div class="event-icon">${e.icon}</div>
          <div class="event-info">
            <div class="event-title">${e.title}</div>
            <div class="event-desc">${e.desc}</div>
            ${e.active ? `<div class="event-timer">⏱️ ${Math.floor(e.remaining / 60)}:${String(Math.floor(e.remaining % 60)).padStart(2, '0')}</div>` : '<div class="event-inactive">⏳ غير نشط</div>'}
          </div>
        </div>`).join('');
  }

  renderPrestige() {
    const container = document.getElementById("prestige-content");
    if (!container || !this.prestige) return;
    const state = this.prestige.getState();
    container.innerHTML = `
      <div class="prestige-card">
        <div class="prestige-level">${state.icon} المستوى ${state.level}/${state.maxLevel}</div>
        <div class="prestige-title">اللقب: ${state.title}</div>
        <div class="prestige-bonus">⚔️ ضرر ×${state.dmgMult.toFixed(1)}</div>
        <div class="prestige-desc">عند المستوى 110، يمكنك إعادة الميلاد (Prestige) للحصول على بونص دائم.</div>
      </div>
    `;
    if (state.canPrestige) {
      const btn = document.createElement("button");
      btn.className = "action-btn prestige-btn";
      btn.textContent = `🔄 Prestige الآن!`;
      btn.addEventListener("click", () => {
        if (this.prestige.prestige()) {
          this.showNotification(`🔄 Prestige #${state.level + 1}!`);
          this.renderPrestige();
          this.renderPromotion();
          this.updateTopBar();
        }
      });
      container.appendChild(btn);
    } else {
      const need = document.createElement("div");
      need.className = "prestige-need";
      need.textContent = state.level >= state.maxLevel ? '⭐ أقصى Prestige' : `👑 تحتاج المستوى ${this.economy.maxLevel}`;
      container.appendChild(need);
    }
  }

  renderDailyLogin() {
    const container = document.getElementById("daily-content");
    if (!container || !this.dailyLogin) return;
    const state = this.dailyLogin.getState();
    container.innerHTML = `
      <div class="daily-streak">🔥 Streak: ${state.streak} يوم</div>
      <div class="daily-grid">
        ${state.rewards.map((r, i) => `
          <div class="daily-day${i === state.currentDay % 7 && state.canClaim ? ' daily-today' : ''}${i < state.currentDay % 7 ? ' daily-done' : ''}">
            <div class="daily-day-num">اليوم ${r.day}</div>
            <div class="daily-reward-icon">${r.icon}</div>
            <div class="daily-reward-label">${r.label}</div>
          </div>
        `).join('')}
      </div>
    `;
    if (state.canClaim) {
      const btn = document.createElement("button");
      btn.className = "action-btn daily-claim-btn";
      btn.textContent = `📦 استلم مكافأة اليوم ${(state.currentDay % 7) + 1}`;
      btn.addEventListener("click", () => {
        if (this.dailyLogin.claim()) {
          this.renderDailyLogin();
          this.updateTopBar();
        }
      });
      container.appendChild(btn);
    } else {
      const done = document.createElement("div");
      done.className = "daily-done-msg";
      done.textContent = "✅ استلمت مكافأة اليوم! عد غداً.";
      container.appendChild(done);
    }
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
    if (this.events) {
      this.events._onEventStart = (e) => {
        this.showNotification(`🎊 ${e.title} بدأ! ${e.desc}`);
        if (this.currentScreen === "events_panel") this.renderEvents();
        this.updateTopBar();
      };
      this.events._onEventEnd = () => {
        if (this.currentScreen === "events_panel") this.renderEvents();
        this.updateTopBar();
      };
    }
  }

  setShopBuyCallback(fn) {
    this._shopBuy = fn;
    window.shopBuy = fn;
  }
}
