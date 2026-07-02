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
    this.currentScreen = "territories";
    this.screens = {};
    this.fightOverlayEl = null;
    this.init();
  }

  init() {
    this.cacheDOM();
    this.createScreens();
    this.bindNav();
    this.bindSubNav();
    this.bindTogglePanel();
    this.showScreen("territories");
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
          if (this.achievements) this.achievements.updateProgress('chat_messages', 1);
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
      this.world._onChatMessage = (username, msg) => {
        this.addChatMessage(username, msg);
        this.addChatToOverlay(username, msg);
      };
    }
    // ربط زر الشات مع لوحة المتصلين
    const chatToggle = document.getElementById("chat-toggle-btn");
    if (chatToggle) {
      chatToggle.addEventListener("click", () => {
        if (this._chatPanel) this._chatPanel.classList.toggle("hidden");
        if (this._playerPanel) this._playerPanel.classList.toggle("hidden");
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
    this._playerCountEl.textContent = filtered.length + 1;
    this._playerListEl.innerHTML = "";
    // إظهار اللاعب نفسه أولاً بإحصائياته الحقيقية من اللعبة
    if (this.world) {
      const myItem = document.createElement("div");
      myItem.className = "player-item player-item-me";
      const myPower = this.economy?.power || 0;
      const myKills = this.world.sessionStats?.kills || 0;
      const myCoins = this.world.sessionStats?.coinsEarned || 0;
      myItem.innerHTML = `
        <div class="player-item-name" style="color:var(--gold)">⭐ ${this.world.username} (أنت)</div>
        <div class="player-item-stats">
          <span class="player-stat"><span class="player-stat-icon">👊</span><span class="player-stat-value">${formatNumber(myPower)}</span></span>
          <span class="player-stat"><span class="player-stat-icon">💀</span><span class="player-stat-value">${myKills}</span></span>
          <span class="player-stat"><span class="player-stat-icon">💵</span><span class="player-stat-value">${formatNumber(myCoins)}</span></span>
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
      foodDisplay: document.getElementById("food-display"),
      powerDisplay: document.getElementById("power-display"),
      levelLabel: document.getElementById("level-label"),
      levelFill: document.getElementById("level-fill"),
      levelAmount: document.getElementById("level-amount"),
      avatar: document.getElementById("top-avatar"),
    };
  }

  setDbStatus(connected) {}

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
    container.className = "game-map";
    container.innerHTML = `
      <div class="map-oasis-banner" id="oasis-title">🐪 واحة البداية</div>
      <div id="building-grid" class="map-buildings-grid"></div>
      <div class="map-sand-overlay"></div>
    `;
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
    div.className = "lands-page lands-page-full";
    div.innerHTML = `
      <div class="lands-bg" id="lands-bg"></div>
      <div class="lands-vignette"></div>

      <!-- المباني -->
      <div id="lands-buildings" class="lands-buildings"></div>

      <!-- Toast -->
      <div id="lands-toast" class="lands-toast hidden"></div>

      <!-- Modal الترقية -->
      <div id="lands-modal" class="lands-modal-overlay hidden">
        <div class="lands-modal-card" id="lands-modal-card">
          <img id="lands-modal-img" src="" width="72" height="72" style="border-radius:14px">
          <h3 id="lands-modal-name" class="lands-modal-name"></h3>
          <p id="lands-modal-level" class="lands-modal-level">المستوى 1</p>
          <div id="lands-modal-cost" class="lands-modal-cost">تكلفة الترقية: 🪙 50</div>
          <button id="lands-modal-upgrade" class="lands-btn-upgrade">ترقية الآن</button>
          <button id="lands-modal-close" class="lands-btn-close">إغلاق</button>
        </div>
      </div>
    `;
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
    document.querySelectorAll("#bottom-bar .nav-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const screen = btn.dataset.screen;
        if (screen) this.showScreen(screen);
      });
    });
  }

  bindSubNav() {
    document.querySelectorAll("#sub-bar .circular-sub-btn").forEach(btn => {
      const screen = btn.dataset.sub;
      if (screen) {
        btn.addEventListener("click", () => this.showScreen(screen));
      }
    });
  }

  bindTogglePanel() {
    const toggle = document.getElementById("panel-toggle");
    const panel = document.getElementById("quick-panel");
    if (toggle && panel) {
      toggle.addEventListener("click", () => {
        panel.classList.toggle("open");
        toggle.classList.toggle("open");
        if (panel.classList.contains("open")) {
          this.updateQuickUpgrades();
          this.updateNotifBadges();
        }
      });
    }
  }

  closeQuickPanel() {
    const panel = document.getElementById("quick-panel");
    const toggle = document.getElementById("panel-toggle");
    if (panel) panel.classList.remove("open");
    if (toggle) toggle.classList.remove("open");
  }

  showScreen(name) {
    this.closeQuickPanel();
    const canvas = document.getElementById("gameCanvas");
    if (canvas) canvas.classList.add("hidden");
    this.currentScreen = name;
    const content = this.els.content;
    content.textContent = "";
    if (this.screens[name]) {
      content.appendChild(this.screens[name]);
    }
    document.querySelectorAll("#bottom-bar .nav-btn").forEach(b => {
      b.classList.toggle("active", b.dataset.screen === name);
    });
    this.renderScreen(name);
  }

  showPlayerPanel() {
    if (this._playerPanel) {
      this._playerPanel.classList.remove("hidden");
    }
    // عرض اللاعب فوراً حتى لو WebSocket مش متصل
    this.updatePlayerPanel([]);
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
      card.className = `map-building state-${b.state}`;
      card.dataset.buildingId = b.id;

      // عقدة الأرباح العائمة (فوق المباني الجاهزة فقط)
      if (b.state === "ready" && b.productionRate > 0) {
        const incomeNode = document.createElement("div");
        incomeNode.className = "income-node";
        incomeNode.id = `income-${b.id}`;
        const incomeValue = b.productionRate * 15;
        incomeNode.innerHTML = `<span class="income-node-icon">💰</span><span class="income-node-value">${formatNumber(incomeValue)}</span>`;
        incomeNode.title = "انقر لتحصيل الأرباح";
        incomeNode.addEventListener("click", (e) => {
          e.stopPropagation();
          if (this.economy) {
            this.economy.addRaw("gold", incomeValue);
            incomeNode.classList.add("collecting");
            setTimeout(() => {
              if (incomeNode.parentNode) {
                incomeNode.innerHTML = `<span class="income-node-icon">💰</span><span class="income-node-value">${formatNumber(b.productionRate * 15)}</span>`;
                incomeNode.classList.remove("collecting");
              }
            }, 500);
            this.updateTopBar();
          }
        });
        card.appendChild(incomeNode);
      }

      // غلاف الأيقونة (مع خلفية حسب الحالة)
      const iconWrap = document.createElement("div");
      iconWrap.className = "map-building-icon-wrap";
      iconWrap.textContent = this.getBuildingIcon(b);
      card.appendChild(iconWrap);

      const nameEl = document.createElement("div");
      nameEl.className = "map-building-name";
      nameEl.textContent = b.name;
      card.appendChild(nameEl);

      if (b.state === "locked") {
        const desc = document.createElement("div");
        desc.className = "map-building-desc";
        desc.textContent = `${b.monsterName} — ⚔️ ${b.currentMonsterPower.toFixed(0)}`;
        card.appendChild(desc);
        // نقرة على البطاقة بالكامل تفتح مودال البناء
        card.addEventListener("click", () => this.showBuildingModal(b, card));
      } else if (b.state === "building") {
        const desc = document.createElement("div");
        desc.className = "map-building-desc";
        desc.textContent = `🔨 البناء... ${Math.ceil(b.constructTimer)}ث`;
        card.appendChild(desc);
        // شريط تقدم البناء
        const timerTrack = document.createElement("div");
        timerTrack.className = "building-timer-track";
        const timerFill = document.createElement("div");
        timerFill.className = "building-timer-fill";
        const duration = b.constructDuration || 1;
        const elapsed = duration - b.constructTimer;
        const pct = (elapsed / duration) * 100;
        timerFill.style.width = `${Math.min(100, pct)}%`;
        timerTrack.appendChild(timerFill);
        card.appendChild(timerTrack);
      } else if (b.state === "ready") {
        const badge = document.createElement("div");
        badge.className = "map-building-level";
        badge.textContent = `LV ${b.level}`;
        card.appendChild(badge);
        const produce = document.createElement("div");
        produce.className = "map-building-produce";
        produce.textContent = `🪙 ${b.productionRate.toFixed(1)}/ث`;
        card.appendChild(produce);
        // نقرة تفتح مودال الترقية
        card.addEventListener("click", () => this.showUpgradeModal(b));
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

  // ====== مودال بناء المبنى (حالة locked) ======
  showBuildingModal(b, cardEl) {
    const overlay = document.getElementById("modal-overlay");
    const card = document.getElementById("modal-card");
    if (!overlay || !card) return;

    const diff = this.village.getMonsterDifficulty(b.currentMonsterPower);
    const playerPower = this.economy.power || 0;
    const canFight = playerPower >= b.currentMonsterPower;

    card.innerHTML = `
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-[#FFD700] font-bold text-base" style="font-family:'Cairo',sans-serif">${b.name}</h3>
        <button id="modal-close-btn" class="text-[#a08060] hover:text-[#FFD700] text-xl leading-none" style="background:none;border:none;cursor:pointer;font-family:inherit">&times;</button>
      </div>
      <div class="flex flex-col items-center gap-3">
        <div class="w-20 h-20 rounded-xl flex items-center justify-center text-4xl" style="background:rgba(44,26,10,0.5);border:1px solid rgba(255,215,0,0.12)">
          👹
        </div>
        <p class="text-[#a08060] text-sm text-center">${b.desc}</p>
        <div class="w-full rounded-lg p-3 space-y-2" style="background:rgba(26,18,8,0.8);border:1px solid rgba(255,215,0,0.08)">
          <div class="flex justify-between text-sm">
            <span class="text-[#a08060]">👹 ${b.monsterName}</span>
            <span class="text-[#ff4444] font-bold">⚔️ ${b.currentMonsterPower.toFixed(0)}</span>
          </div>
          <div class="flex justify-between text-sm">
            <span class="text-[#a08060]">📊 الصعوبة</span>
            <span class="text-[#e67e22] font-bold">${diff}</span>
          </div>
          <div class="flex justify-between text-sm">
            <span class="text-[#a08060]">⏱️ وقت البناء</span>
            <span class="text-[#FFD700] font-bold">${b.buildTime}ث</span>
          </div>
          <div class="flex justify-between text-sm">
            <span class="text-[#a08060]">🪙 الإنتاج</span>
            <span class="text-[#2ecc71] font-bold">${b.baseProduction}/ث</span>
          </div>
          <div class="flex justify-between text-sm">
            <span class="text-[#a08060]">👊 قوتك</span>
            <span class="font-bold" style="color:${canFight ? '#2ecc71' : '#ff4444'}">${playerPower.toFixed(0)}</span>
          </div>
        </div>
        <button id="modal-action-btn" class="w-full py-3 rounded-xl font-bold text-base transition-transform active:scale-95" style="background:linear-gradient(180deg,#d43a3a,#8a2020);color:#fff;border:none;cursor:pointer;font-family:inherit">
          ${canFight ? `⚔️ مقاتلة ${b.monsterName}` : `💥 قوة غير كافية (تحتاج ${b.currentMonsterPower.toFixed(0)})`}
        </button>
      </div>
    `;

    overlay.classList.remove("hidden");
    document.body.classList.add("modal-open");

    document.getElementById("modal-close-btn").onclick = () => {
      overlay.classList.add("hidden");
      document.body.classList.remove("modal-open");
    };

    const actionBtn = document.getElementById("modal-action-btn");
    if (actionBtn && canFight) {
      actionBtn.onclick = () => {
        overlay.classList.add("hidden");
        document.body.classList.remove("modal-open");
        this.doFight(b, cardEl);
      };
    } else if (actionBtn) {
      actionBtn.onclick = () => {
        overlay.classList.add("hidden");
        document.body.classList.remove("modal-open");
      };
    }

    overlay.onclick = (e) => {
      if (e.target === overlay) {
        overlay.classList.add("hidden");
        document.body.classList.remove("modal-open");
      }
    };
  }

  // ====== مودال ترقية المبنى (حالة ready) ======
  showUpgradeModal(b) {
    const overlay = document.getElementById("modal-overlay");
    const card = document.getElementById("modal-card");
    if (!overlay || !card) return;

    const isMax = b.level >= b.maxLevel;
    const canAfford = this.economy ? this.economy.canAfford('cash', b.upgradeCost) : false;

    card.innerHTML = `
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-[#FFD700] font-bold text-base" style="font-family:'Cairo',sans-serif">${b.name}</h3>
        <button id="modal-close-btn" class="text-[#a08060] hover:text-[#FFD700] text-xl leading-none" style="background:none;border:none;cursor:pointer;font-family:inherit">&times;</button>
      </div>
      <div class="flex flex-col items-center gap-3">
        <div class="w-20 h-20 rounded-xl flex items-center justify-center text-4xl" style="background:rgba(44,26,10,0.5);border:1px solid rgba(46,204,113,0.2)">
          🏠
        </div>
        <div class="rounded-lg px-3 py-1" style="background:rgba(26,18,8,0.8);border:1px solid rgba(255,215,0,0.08)">
          <span class="text-[#FFD700] font-bold text-sm">LV ${b.level}</span>
        </div>
        <div class="w-full rounded-lg p-3 space-y-2" style="background:rgba(26,18,8,0.8);border:1px solid rgba(255,215,0,0.08)">
          <div class="flex justify-between text-sm">
            <span class="text-[#a08060]">🪙 الإنتاج الحالي</span>
            <span class="text-[#2ecc71] font-bold">${b.productionRate.toFixed(1)}/ث</span>
          </div>
          ${!isMax ? `
          <div class="flex justify-between text-sm">
            <span class="text-[#a08060]">⬆️ بعد الترقية</span>
            <span class="text-[#FFD700] font-bold">${(b.productionRate + b.baseProduction * 0.1).toFixed(1)}/ث</span>
          </div>
          <div class="flex justify-between text-sm">
            <span class="text-[#a08060]">💵 التكلفة</span>
            <span class="font-bold" style="color:${canAfford ? '#2ecc71' : '#ff4444'}">${b.upgradeCost}</span>
          </div>` : ''}
        </div>
        ${!isMax ? `
        <button id="modal-action-btn" class="w-full py-3 rounded-xl font-bold text-base transition-transform active:scale-95" style="background:linear-gradient(180deg,#3a8ab5,#1a5a7a);color:#fff;border:none;cursor:pointer;font-family:inherit">
          ▲ ترقية (${b.upgradeCost} 💵)
        </button>` : `
        <div class="text-[#FFD700] font-bold text-sm py-2">⭐⭐⭐ المستوى الأقصى</div>`}
      </div>
    `;

    overlay.classList.remove("hidden");
    document.body.classList.add("modal-open");

    document.getElementById("modal-close-btn").onclick = () => {
      overlay.classList.add("hidden");
      document.body.classList.remove("modal-open");
    };

    const actionBtn = document.getElementById("modal-action-btn");
    if (actionBtn) {
      actionBtn.onclick = () => {
        if (this.village.upgradeBuilding(b)) {
          this.renderPromotion();
          this.updateTopBar();
          overlay.classList.add("hidden");
          document.body.classList.remove("modal-open");
        }
      };
    }

    overlay.onclick = (e) => {
      if (e.target === overlay) {
        overlay.classList.add("hidden");
        document.body.classList.remove("modal-open");
      }
    };
  }

  // ====== حلقة تحديث مؤقتات البناء ======
  startBuildingTimerLoop() {
    this._buildingTimerInterval = setInterval(() => {
      const cards = document.querySelectorAll('.map-building.state-building');
      for (const card of cards) {
        const id = card.dataset.buildingId;
        const b = this.village.buildings.find(b => b.id === id);
        if (b && b.state === "building") {
          const desc = card.querySelector('.map-building-desc');
          if (desc) desc.textContent = `🔨 البناء... ${Math.ceil(b.constructTimer)}ث`;
          const fill = card.querySelector('.building-timer-fill');
          if (fill) {
            const duration = b.constructDuration || 1;
            const elapsed = duration - b.constructTimer;
            const pct = (elapsed / duration) * 100;
            fill.style.width = `${Math.min(100, pct)}%`;
          }
        }
      }
    }, 200);
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
    const container = document.getElementById("lands-buildings");
    if (!container) return;
    if (!this._landsInitialized) {
      this._initLandsPage();
    }
  }

  _initLandsPage() {
    if (this._landsInitialized) return;
    this._landsInitialized = true;

    // ==================== CONFIG — استبدل الروابط هنا فقط ====================
    const L = {
      bg: ImageResolver ? ImageResolver.src('landsBg') : 'assets/images/bg-village.jpg',
      buildings: [
        {
          id: 'b1', x: 72, y: 38, name: 'الميناء',
          img_empty: ImageResolver ? ImageResolver.src('b1Empty') : '',
          img_building: ImageResolver ? ImageResolver.src('b1Construction') : '',
          img_built: ImageResolver ? ImageResolver.src('b1Built') : '',
          locked: false, level: 1
        },
        {
          id: 'b2', x: 25, y: 55, name: 'سوق السمك',
          img_empty: ImageResolver ? ImageResolver.src('b2Empty') : '',
          img_building: ImageResolver ? ImageResolver.src('b2Construction') : '',
          img_built: ImageResolver ? ImageResolver.src('b2Built') : '',
          locked: false, level: 1
        },
        {
          id: 'b3', x: 78, y: 70, name: 'مستودع البضائع',
          img_empty: ImageResolver ? ImageResolver.src('b3Empty') : '',
          img_building: ImageResolver ? ImageResolver.src('b3Construction') : '',
          img_built: ImageResolver ? ImageResolver.src('b3Built') : '',
          locked: false, level: 1
        },
        {
          id: 'b4', x: 20, y: 28, name: 'قلعة الحراسة',
          img_empty: ImageResolver ? ImageResolver.src('b4Empty') : '',
          img_building: ImageResolver ? ImageResolver.src('b4Construction') : '',
          img_built: ImageResolver ? ImageResolver.src('b4Built') : '',
          locked: false, level: 1
        },
        {
          id: 'b5', x: 50, y: 18, name: 'المنارة',
          img_empty: ImageResolver ? ImageResolver.src('b5Empty') : '',
          img_building: ImageResolver ? ImageResolver.src('b5Construction') : '',
          img_built: ImageResolver ? ImageResolver.src('b5Built') : '',
          locked: false, level: 1
        },
        {
          id: 'b6', x: 45, y: 82, name: 'ساحة التدريب',
          img_empty: ImageResolver ? ImageResolver.src('b6Empty') : '',
          img_building: ImageResolver ? ImageResolver.src('b6Construction') : '',
          img_built: ImageResolver ? ImageResolver.src('b6Built') : '',
          locked: false, level: 1
        },
      ]
    };

    // حالة المباني (فارغ/قيد الإنشاء/مبني)
    this._landsState = {};
    for (const b of L.buildings) {
      this._landsState[b.id] = { state: 'empty', level: b.level };
    }
    this._landsData = L;
    this._landsProgress = 0;
    this._landsMax = L.buildings.length;

    // ضبط خلفية الأراضي
    const bgEl = document.getElementById('lands-bg');
    if (bgEl) bgEl.style.backgroundImage = `url('${L.bg}')`;

    // بناء عناصر المباني
    this._renderLandsBuildings();
  }

  _renderLandsBuildings() {
    const container = document.getElementById('lands-buildings');
    if (!container) return;
    container.innerHTML = '';
    for (const b of this._landsData.buildings) {
      const st = this._landsState[b.id];
      const imgSrc = st.state === 'built' ? b.img_built
        : st.state === 'building' ? b.img_building
        : b.img_empty;
      const badgeText = st.state === 'built' ? 'تم'
        : st.state === 'building' ? 'يبني'
        : 'فارغ';
      const badgeClass = st.state === 'built' ? 'lands-badge-done'
        : st.state === 'building' ? 'lands-badge-progress'
        : 'lands-badge-empty';

      const btn = document.createElement('button');
      btn.className = 'lands-building';
      btn.style.right = b.x + '%';
      btn.style.top = b.y + '%';
      btn.dataset.id = b.id;
      btn.innerHTML = `
        <div class="lands-building-pad">
          <img src="${imgSrc}" width="56" height="56" onerror="this.style.display='none'" loading="lazy">
          <span class="lands-state-badge ${badgeClass}">${badgeText}</span>
          ${b.locked ? '<span class="lands-lock-badge">🔒</span>' : ''}
        </div>
        <div class="lands-building-name">${b.name}</div>
      `;
      btn.addEventListener('click', () => this._onLandsBuildingClick(b.id));
      container.appendChild(btn);
    }
  }

  _onLandsBuildingClick(id) {
    const b = this._landsData.buildings.find(x => x.id === id);
    if (!b) return;
    const st = this._landsState[id];
    if (b.locked) { this._landsToast(b.name + ' • مقفل'); return; }
    if (st.state === 'empty') {
      st.state = 'building';
      this._landsToast('قيد الإنشاء: ' + b.name);
      this._renderLandsBuildings();
    } else if (st.state === 'building') {
      st.state = 'built';
      this._landsProgress++;
      this._landsToast('تم البناء: ' + b.name);
      this._updateLandsProgress();
      this._renderLandsBuildings();
      this._openLandsUpgradeModal(id);
    } else if (st.state === 'built') {
      this._openLandsUpgradeModal(id);
    }
  }

  _updateLandsProgress() {
    // التقدم محذوف من الـ UI الرئيسي — يحتفظ به داخلياً
  }

  _openLandsUpgradeModal(id) {
    const b = this._landsData.buildings.find(x => x.id === id);
    if (!b) return;
    const st = this._landsState[id];
    if (st.state !== 'built') return;

    const overlay = document.getElementById('lands-modal');
    const imgEl = document.getElementById('lands-modal-img');
    const nameEl = document.getElementById('lands-modal-name');
    const levelEl = document.getElementById('lands-modal-level');
    const costEl = document.getElementById('lands-modal-cost');
    if (!overlay) return;

    if (imgEl) imgEl.src = b.img_built;
    if (nameEl) nameEl.textContent = b.name;
    if (levelEl) levelEl.textContent = 'المستوى ' + st.level;
    const cost = 50 + (st.level - 1) * 25;
    if (costEl) costEl.textContent = 'تكلفة الترقية: 🪙 ' + cost;
    overlay.classList.remove('hidden');

    // ربط أزرار المودال
    const upgradeBtn = document.getElementById('lands-modal-upgrade');
    const closeBtn = document.getElementById('lands-modal-close');
    if (upgradeBtn) {
      upgradeBtn.onclick = () => {
        if (this.economy && this.economy.gold >= cost) {
          this.economy.gold -= cost;
          st.level++;
          this._landsToast('تمت الترقية إلى المستوى ' + st.level);
          if (levelEl) levelEl.textContent = 'المستوى ' + st.level;
          const newCost = 50 + (st.level - 1) * 25;
          if (costEl) costEl.textContent = 'تكلفة الترقية: 🪙 ' + newCost;
          this.updateTopBar();
        } else {
          this._landsToast('ذهب غير كافي');
        }
      };
    }
    if (closeBtn) closeBtn.onclick = () => overlay.classList.add('hidden');
    overlay.onclick = (e) => { if (e.target === overlay) overlay.classList.add('hidden'); };
  }

  _landsToast(msg) {
    const el = document.getElementById('lands-toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.remove('hidden');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.add('hidden'), 1600);
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
    const worldButtons = document.getElementById("world-buttons");
    const quickPanel = document.getElementById("quick-panel");
    if (topBar) topBar.style.display = "none";
    if (subBar) subBar.style.display = "none";
    if (quickPanel) quickPanel.style.display = "none";
    if (bottomBar) bottomBar.style.display = "none";
    if (content) content.style.display = "none";
    if (worldButtons) worldButtons.classList.remove("hidden");
    this.showPlayerPanel();
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
    const worldButtons = document.getElementById("world-buttons");
    const quickPanel = document.getElementById("quick-panel");
    if (topBar) topBar.style.display = "";
    if (subBar) subBar.style.display = "";
    if (quickPanel) quickPanel.style.display = "";
    if (bottomBar) bottomBar.style.display = "";
    if (content) content.style.display = "";
    if (worldButtons) worldButtons.classList.add("hidden");
    if (this._playerPanel) this._playerPanel.classList.add("hidden");
    if (this._chatPanel) this._chatPanel.classList.add("hidden");
    if (this.currentScreen) this.showScreen(this.currentScreen);
  }

  updateTopBar() {
    const eco = this.economy;
    if (this.els.multiplierDisplay) {
      this.els.multiplierDisplay.textContent = `x${eco.multiplier}`;
    }
    if (this.els.goldDisplay) {
      this.els.goldDisplay.textContent = formatNumber(eco.gold);
    }
    if (this.els.cashDisplay) {
      this.els.cashDisplay.textContent = formatNumber(eco.cash);
    }
    if (this.els.foodDisplay) {
      this.els.foodDisplay.textContent = formatNumber(eco.food);
    }
    if (this.els.powerDisplay) {
      this.els.powerDisplay.textContent = formatNumber(eco.power);
    }
    if (this.els.levelLabel) {
      this.els.levelLabel.textContent = `Lv.${eco.level}`;
    }
    if (this.els.levelFill) {
      const pct = eco.xpToNext > 0 ? Math.min(100, (eco.xp / eco.xpToNext) * 100) : 0;
      this.els.levelFill.style.width = pct + "%";
    }
    if (this.els.levelAmount) {
      this.els.levelAmount.textContent = `${eco.xp}/${eco.xpToNext}`;
    }
    // تحديث باجات الإشعارات
    this.updateNotifBadges();
  }

  updateQuickUpgrades() {
    if (!this.upgradeTree) return;
    const paths = [
      { id: 'damage', icon: '⚔️', label: 'ترقية الضرر' },
      { id: 'defense', icon: '🛡️', label: 'ترقية الدفاع' },
      { id: 'capacity', icon: '📦', label: 'ترقية السعة' },
      { id: 'speed', icon: '⚡', label: 'ترقية السرعة' },
    ];
    for (const p of paths) {
      const levelEl = document.getElementById(`qu-level-${p.id}`);
      const fillEl = document.getElementById(`qu-fill-${p.id}`);
      if (levelEl) {
        const lvl = this.upgradeTree.getLevel(p.id);
        levelEl.textContent = `Lv.${lvl}`;
      }
      if (fillEl) {
        const maxLevel = 20;
        const lvl = this.upgradeTree.getLevel(p.id);
        fillEl.style.width = `${Math.min(100, (lvl / maxLevel) * 100)}%`;
      }
    }
    // ربط أزرار الترقية (مرة واحدة فقط)
    if (!this._quBound) {
      this._quBound = true;
      document.querySelectorAll('.qu-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.qu;
          if (id && this.upgradeTree.upgrade(id)) {
            this.updateTopBar();
            this.showNotification(`⬆️ تمت ترقية ${paths.find(p => p.id === id)?.label || id}!`);
          }
        });
      });
    }
  }

  updateNotifBadges() {
    // إنجازات غير مستلمة
    if (this.achievements) {
      const unclaimed = this.achievements.getAll().filter(a => a.completed && !a.claimed).length;
      const badge = document.getElementById('badge-achievements');
      if (badge) badge.classList.toggle('hidden', unclaimed === 0);
    }
    // مكافأة يومية متاحة
    if (this.dailyLogin) {
      const state = this.dailyLogin.getState();
      const canClaim = state?.canClaim ?? false;
      const badge = document.getElementById('badge-daily');
      if (badge) badge.classList.toggle('hidden', !canClaim);
    }
    // حدث نشط
    if (this.events) {
      const hasActive = this.events.getActiveEvents().length > 0;
      const badge = document.getElementById('badge-events');
      if (badge) badge.classList.toggle('hidden', !hasActive);
    }
    // Prestige متاح
    if (this.prestige) {
      const canPrestige = this.prestige.getState().canPrestige;
      const badge = document.getElementById('badge-prestige');
      if (badge) badge.classList.toggle('hidden', !canPrestige);
    }
    // عناصر قابلة للاستخدام في المخزون
    if (this.inventory) {
      const items = this.inventory.getState().items;
      const usableCount = ['heal_potion','xp_scroll','arena_ticket','fire_sword','desert_shield','power_helmet','power_gem','tower_blueprint']
        .filter(id => (items[id] || 0) > 0).length;
      const badge = document.getElementById('badge-inventory');
      if (badge) badge.classList.toggle('hidden', usableCount === 0);
    }
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
      const rewardStr = Object.entries(a.reward).map(([k, v]) => `${v} ${k === 'gold' ? '🪙' : k === 'gems' ? '💎' : '💵'}`).join(' + ');
      card.innerHTML = `
        <div class="achievement-icon">${a.icon}</div>
        <div class="achievement-info">
          <div class="achievement-name">${a.title}</div>
          <div class="achievement-desc">${a.desc}</div>
          <div class="achievement-progress-track">
            <div class="achievement-progress-fill" style="width:${pct}%"></div>
          </div>
          <div class="achievement-progress-text">${a.completed ? (a.claimed ? '✅ تم الاستلام' : `🏆 المكافأة: ${rewardStr}`) : `${a.progress}/${a.target}`}</div>
        </div>
        ${a.completed && !a.claimed ? '<button class="achievement-claim-btn">📦 استلم</button>' : ''}
      `;
      if (a.completed && !a.claimed) {
        const btn = card.querySelector('.achievement-claim-btn');
        if (btn) {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this.achievements.claim(a.id)) {
              this.renderAchievements();
              this.updateTopBar();
              this.showNotification(`🏆 حصلت على ${rewardStr}`);
            }
          });
        }
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
      const usableItems = ['heal_potion', 'xp_scroll', 'arena_ticket', 'fire_sword', 'desert_shield', 'power_helmet', 'power_gem', 'tower_blueprint'];
      const itemIcons = { heal_potion: '🧪', xp_scroll: '📜', arena_ticket: '🎫', fire_sword: '🗡️', desert_shield: '🛡️', power_helmet: '⛑️', power_gem: '💎', tower_blueprint: '📐' };
      const itemLabels = { heal_potion: 'جرعة علاج (+50 HP)', xp_scroll: 'لفافة خبرة (+500 XP)', arena_ticket: 'تذكرة ساحة', fire_sword: 'سيف ناري (30ث)', desert_shield: 'درع صحراوي (60ث)', power_helmet: 'خوذة القوة (60ث)', power_gem: 'جوهرة القوة (×2 5د)', tower_blueprint: 'مخطط برج' };
      itemsEl.innerHTML = Object.keys(state.items).length === 0
        ? '<div style="text-align:center;padding:20px;color:var(--beige-dark)">📭 المخزون فارغ — اصنع قطعتك الأولى!</div>'
        : Object.entries(state.items).map(([id, count]) => {
            const isUsable = usableItems.includes(id);
            return `<div class="inventory-item">
              <span class="inv-item-icon">${itemIcons[id] || '📦'}</span>
              <span class="inv-item-name">${itemLabels[id] || id}</span>
              <span class="inv-item-count">×${count}</span>
              ${isUsable ? `<button class="action-btn use-item-btn" data-item="${id}" style="padding:4px 10px;font-size:0.75rem">▶ استخدم</button>` : ''}
            </div>`;
          }).join('');
      itemsEl.querySelectorAll('.use-item-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.item;
          if (this.inventory.useItem(id, this.world)) {
            this.showNotification(`✅ استخدمت ${itemLabels[id] || id}`);
            this.renderInventory();
            this.updateTopBar();
          }
        });
      });
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

  startTopBarLoop() {
    this._topBarInterval = setInterval(() => this.updateTopBar(), 500);

    // بدء حلقة تحديث مؤقتات البناء
    this.startBuildingTimerLoop();
    if (this.oasisManager) {
      this.oasisManager._onOasesChanged = () => {
        if (this.currentScreen === "territories") this.renderTerritories();
        if (this.currentScreen === "promotion") this.renderPromotion();
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
    // ربط شريط المحادثة الشفاف
    const chatOverlay = document.getElementById("chat-overlay");
    const chatToggle = document.getElementById("chat-overlay-toggle");
    if (chatOverlay && chatToggle) {
      chatOverlay.addEventListener("click", () => {
        const chatPanel = document.getElementById("chat-panel");
        if (chatPanel) {
          chatPanel.classList.toggle("hidden");
          chatToggle.classList.toggle("open");
          chatToggle.textContent = chatPanel.classList.contains("hidden") ? "▲" : "▼";
        }
      });
    }
    // زر تصغير الشات
    const minimizeBtn = document.getElementById("chat-minimize-btn");
    if (minimizeBtn) {
      minimizeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const chatPanel = document.getElementById("chat-panel");
        if (chatPanel) {
          chatPanel.classList.add("hidden");
          const toggle = document.getElementById("chat-overlay-toggle");
          if (toggle) { toggle.classList.remove("open"); toggle.textContent = "▲"; }
        }
      });
    }
  }

  addChatToOverlay(username, msg) {
    const msgEl = document.getElementById("chat-overlay-msg");
    const playerEl = document.getElementById("chat-overlay-player");
    if (msgEl) msgEl.textContent = msg;
    if (playerEl) playerEl.textContent = `${username}:`;
    // تحديث الإنجاز
    if (this.achievements) this.achievements.updateProgress('chat_messages', 1);
  }

  setShopBuyCallback(fn) {
    this._shopBuy = fn;
    window.shopBuy = fn;
  }
}
