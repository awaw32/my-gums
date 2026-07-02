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
    this.bindUiToggle();
    this.bindPromoBackButtons();
    this.showScreen("territories");
    this.startTopBarLoop();
    this.initPlayerPanel();
    this.initChat();
    this.initTutorial();
    this.initDailyCheck();
  }

  /** ربط أزرار الرجوع في صفحة الترقية */
  bindPromoBackButtons() {
    const backButtons = {
      'back-from-tree': 'tree',
      'back-from-weapons': 'weapons',
      'back-from-knowledge': 'knowledge',
      'back-from-rewards': 'rewards'
    };
    for (const [btnId, pageId] of Object.entries(backButtons)) {
      const btn = document.getElementById(btnId);
      if (btn) {
        btn.addEventListener('click', () => {
          this._promoSubPage = null;
          this.renderPromotion();
        });
      }
    }
  }

  /** إخفاء/إظهار كامل واجهة المستخدم (Top bar, Sub bar, Bottom bar, Chat) */
  bindUiToggle() {
    const toggleBtn = document.getElementById("ui-toggle-btn");
    if (!toggleBtn) return;
    this._uiVisible = true;
    toggleBtn.addEventListener("click", () => {
      this._uiVisible = !this._uiVisible;
      const topBar = document.getElementById("top-bar");
      const quickPanel = document.getElementById("quick-panel");
      const bottomBar = document.getElementById("bottom-bar");
      const chatOverlay = document.getElementById("chat-overlay");
      const els = [topBar, quickPanel, bottomBar, chatOverlay];
      if (this._uiVisible) {
        els.forEach(el => { if (el) { el.style.transform = ""; el.style.opacity = ""; el.style.pointerEvents = ""; } });
        toggleBtn.textContent = "👁️";
        toggleBtn.title = "إخفاء الواجهة";
      } else {
        els.forEach(el => {
          if (el) {
            el.style.transition = "transform 0.35s ease, opacity 0.3s ease";
            el.style.transform = "translateY(100%)";
            el.style.opacity = "0";
            el.style.pointerEvents = "none";
          }
        });
        // Top bar يختفي لأعلى
        if (topBar) {
          topBar.style.transform = "translateY(-100%)";
          topBar.style.opacity = "0";
        }
        toggleBtn.textContent = "👁️‍🗨️";
        toggleBtn.title = "إظهار الواجهة";
      }
    });
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
    this._lastPlayerList = []; // تخزين آخر قائمة لاعبين للتحديثات
    if (this.world) {
      this.world._onPlayersChanged = (list) => {
        this._lastPlayerList = list;
        this.updatePlayerPanel(list);
      };
      this.world._onSelfStatsChanged = () => {
        // تحديث إحصائيات النفس دون الحاجة لقائمة من السيرفر
        this.updatePlayerPanel(this._lastPlayerList);
      };
      this.world._onNotification = (msg) => this.showNotification(msg);
      this.world._onChatMessage = (username, msg) => {
        this.addChatMessage(username, msg);
        this.addChatToOverlay(username, msg);
      };
    }
    // ربط زر الشات في world-buttons
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
    // =========================================================================
    // 🏆 صفحة الترقية الرئيسية — لوحة التحكم
    // =========================================================================
    // تحتوي على 4 بطاقات كبيرة:
    //   1. 🏋️ ساحة الجيش ← شجرة الترقيات (الجيش، المعرفة، الدفاع، التجارة)
    //   2. 🗡️ الأسلحة ← مخزن الأسلحة (6 أسلحة)
    //   3. 📜 المعرفة ← تفاصيل الترقيات
    //   4. 🎁 صندوق المكافآت ← المكافآت اليومية + الإنجازات
    // =========================================================================
    const container = document.createElement("div");
    container.className = "screen-panel upgrade-panel";
    container.innerHTML = `
      <!-- ====== العنوان ====== -->
      <div class="panel-header" style="font-size:1.3rem;margin-bottom:16px">🏪 مركز التطوير</div>
      
      <!-- ====== بطاقات الأقسام الأربعة ====== -->
      <div class="promo-hub-grid" id="promo-hub-grid"></div>

      <!-- ====== صفحة شجرة الترقيات (تظهر عند النقر على ساحة الجيش) ====== -->
      <div id="upgrade-tree-page" class="promo-sub-page hidden">
        <button class="promo-back-btn" id="back-from-tree">→ رجوع</button>
        <div class="panel-header" style="font-size:1.1rem;margin-bottom:14px">⭐ شجرة الترقيات</div>
        <div class="upgrade-grid" id="upgrade-grid"></div>
        <!-- Modal تفاصيل الترقية -->
        <div id="upgrade-detail-modal" class="upgrade-detail-modal hidden">
          <div class="upgrade-detail-card">
            <button id="detail-modal-close" class="detail-close-btn">✕</button>
            <div class="detail-header">
              <div class="detail-icon" id="detail-icon">⚔️</div>
              <div class="detail-title-area">
                <h3 id="detail-name">الجيش</h3>
                <p id="detail-desc">تطوير قوة الجيش الصحراوي</p>
              </div>
            </div>
            <div class="detail-stats">
              <div class="detail-stat">
                <span class="ds-label">المستوى الحالي</span>
                <span class="ds-value" id="detail-level">Lv.0</span>
              </div>
              <div class="detail-stat">
                <span class="ds-label">التأثير الحالي</span>
                <span class="ds-value" id="detail-effect">+0</span>
              </div>
              <div class="detail-stat">
                <span class="ds-label">التأثير التالي</span>
                <span class="ds-value gold" id="detail-next-effect">—</span>
              </div>
              <div class="detail-stat">
                <span class="ds-label">تكلفة الترقية</span>
                <span class="ds-value" id="detail-cost">🪙 50</span>
              </div>
            </div>
            <div class="detail-track-wrap">
              <div class="detail-progress-track">
                <div class="detail-progress-fill" id="detail-progress-fill"></div>
              </div>
              <span class="detail-progress-text" id="detail-progress-text">0/5</span>
            </div>
            <button class="detail-upgrade-btn" id="detail-upgrade-btn">▲ ترقية الآن</button>
            <div class="detail-levels-preview" id="detail-levels-preview"></div>
          </div>
        </div>
      </div>

      <!-- ====== صفحة الأسلحة (تظهر عند النقر على الأسلحة) ====== -->
      <div id="weapons-page" class="promo-sub-page hidden">
        <button class="promo-back-btn" id="back-from-weapons">→ رجوع</button>
        <div class="panel-header" style="font-size:1.1rem;margin-bottom:14px">🗡️ مخزن الأسلحة</div>
        <div class="weapons-grid" id="weapons-grid"></div>
      </div>

      <!-- مودال تفاصيل السلاح (خارج promo-sub-page لتجنب مشاكل position:fixed) -->
      <div id="weapon-detail-overlay" class="wd-overlay hidden">
        <div class="wd-card" id="weapon-detail-card"></div>
      </div>

      <!-- ====== صفحة المعرفة (تظهر عند النقر على المعرفة) ====== -->
      <div id="knowledge-page" class="promo-sub-page hidden">
        <button class="promo-back-btn" id="back-from-knowledge">→ رجوع</button>
        <div class="panel-header" style="font-size:1.1rem;margin-bottom:14px">📜 شجرة المعرفة</div>
        <div class="knowledge-upgrades" id="knowledge-upgrades"></div>
      </div>

      <!-- ====== صفحة المكافآت (تظهر عند النقر على صندوق المكافآت) ====== -->
      <div id="rewards-page" class="promo-sub-page hidden">
        <button class="promo-back-btn" id="back-from-rewards">→ رجوع</button>
        <div class="panel-header" style="font-size:1.1rem;margin-bottom:14px">🎁 صندوق المكافآت</div>
        <div class="rewards-content" id="rewards-content"></div>
      </div>
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
    // =========================================================================
    // 🏆 صفحة الترقية — إما تعرض الـ Hub أو الصفحة الفرعية
    // =========================================================================
    const hubGrid = document.getElementById("promo-hub-grid");
    const treePage = document.getElementById("upgrade-tree-page");
    const weaponsPage = document.getElementById("weapons-page");
    const knowledgePage = document.getElementById("knowledge-page");
    const rewardsPage = document.getElementById("rewards-page");

    // إخفاء جميع الصفحات الفرعية
    [treePage, weaponsPage, knowledgePage, rewardsPage].forEach(p => {
      if (p) p.classList.add("hidden");
    });

    // عرض الـ Hub
    if (hubGrid && !this._promoSubPage) {
      this._renderPromotionHub();
    }

    // إذا كانت هناك صفحة فرعية مفعلة، اعرضها
    if (this._promoSubPage) {
      const pageMap = {
        'tree': treePage,
        'weapons': weaponsPage,
        'knowledge': knowledgePage,
        'rewards': rewardsPage
      };
      const targetPage = pageMap[this._promoSubPage];
      if (targetPage) {
        targetPage.classList.remove("hidden");
        // رسم المحتوى حسب الصفحة
        if (this._promoSubPage === 'tree') this._renderUpgradeTree();
        if (this._promoSubPage === 'weapons') this._renderWeaponsPage();
        if (this._promoSubPage === 'knowledge') this._renderKnowledgePage();
        if (this._promoSubPage === 'rewards') this._renderRewardsPage();
      }
    }
  }

  /** رسم بطاقات الـ Hub الأربع — تصميم جديد */
  _renderPromotionHub() {
    const hubGrid = document.getElementById("promo-hub-grid");
    if (!hubGrid) return;
    hubGrid.textContent = "";

    const treePaths = this.upgradeTree ? this.upgradeTree.getPaths() : [];
    const totalUpgrades = treePaths.reduce((sum, p) => sum + p.currentLevel, 0);
    const totalMax = treePaths.reduce((sum, p) => sum + p.maxLevel, 0);

    const wCount = this.army?.weapons?.length || 6;
    const wUpgraded = this.army?.weapons?.filter(w => w.level > 0).length || 0;

    const cards = [
      {
        id: 'tree', name: 'ساحة الجيش', desc: 'ترقية الجيش، المعرفة، الدفاع، التجارة',
        badge: `${totalUpgrades}/${totalMax}`,
        badgeColor: '#ff6b6b',
        img: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 200 180%22%3E%3Crect fill=%22%232c1a0a%22 width=%22200%22 height=%22180%22/%3E%3Ctext x=%22100%22 y=%22110%22 font-size=%2270%22 text-anchor=%22middle%22%3E%F0%9F%92%AA%3C/text%3E%3C/svg%3E',
        grad: 'linear-gradient(to bottom, rgba(255,68,68,0.25), rgba(44,26,10,0.95))'
      },
      {
        id: 'weapons', name: 'الأسلحة', desc: 'مخزن الأسلحة الصحراوية',
        badge: '!', badgeColor: '#9b59b6',
        badgeCount: wUpgraded,
        img: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 200 180%22%3E%3Crect fill=%22%233a2518%22 width=%22200%22 height=%22180%22/%3E%3Ctext x=%22100%22 y=%22110%22 font-size=%2270%22 text-anchor=%22middle%22%3E%F0%9F%97%A1%EF%B8%8F%3C/text%3E%3C/svg%3E',
        grad: 'linear-gradient(to bottom, rgba(155,89,182,0.25), rgba(44,26,10,0.95))'
      },
      {
        id: 'knowledge', name: 'المعرفة', desc: 'العلوم الصحراوية والحكمة',
        timer: '∞',
        img: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 200 150%22%3E%3Crect fill=%22%232c1a0a%22 width=%22200%22 height=%22150%22/%3E%3Ctext x=%22100%22 y=%22100%22 font-size=%2260%22 text-anchor=%22middle%22%3E%F0%9F%93%9C%3C/text%3E%3C/svg%3E',
        grad: 'linear-gradient(to bottom, rgba(46,204,113,0.25), rgba(44,26,10,0.95))'
      },
      {
        id: 'rewards', name: 'صندوق المكافآت', desc: 'المكافآت اليومية والإنجازات',
        badge: '🎁',
        img: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 200 150%22%3E%3Crect fill=%22%233a2518%22 width=%22200%22 height=%22150%22/%3E%3Ctext x=%22100%22 y=%22100%22 font-size=%2260%22 text-anchor=%22middle%22%3E%F0%9F%8E%81%3C/text%3E%3C/svg%3E',
        grad: 'linear-gradient(to bottom, rgba(243,156,18,0.25), rgba(44,26,10,0.95))'
      },
    ];

    for (const c of cards) {
      const card = document.createElement("div");
      card.className = "promo-card-new";
      card.style.backgroundImage = `url('${c.img}')`;
      card.innerHTML = `
        <div class="promo-card-overlay" style="background:${c.grad}">
          <div class="promo-card-top">
            ${c.badge ? `<span class="promo-badge" style="background:${c.badgeColor}">${c.badge}</span>` : ''}
            ${c.badgeCount !== undefined ? `<span class="promo-counter">${c.badgeCount}/${wCount}</span>` : ''}
          </div>
          <div class="promo-card-bottom">
            <div class="promo-card-title">${c.name}</div>
            <div class="promo-card-desc">${c.desc}</div>
            ${c.timer ? `<div class="promo-timer">${c.timer}</div>` : ''}
          </div>
        </div>
      `;
      card.addEventListener('click', () => {
        this._promoSubPage = c.id;
        this.renderPromotion();
      });
      hubGrid.appendChild(card);
    }
  }

  /** رسم شجرة الترقيات */
  _renderUpgradeTree() {
    const grid = document.getElementById("upgrade-grid");
    if (!grid || !this.upgradeTree) return;
    grid.textContent = "";

    // مسارات الترقية
    const paths = [
      { 
        id: 'army', icon: '⚔️', name: 'الجيش', 
        desc: 'تطوير قوة الجيش الصحراوي',
        // 🖼️ image: 'assets/images/upgrades/army.png', // 120×120 بكسل — ارفع صورتك هنا
        color: '#ff6b6b', bgGrad: 'linear-gradient(135deg, rgba(255,68,68,0.15), rgba(180,40,40,0.08))'
      },
      { 
        id: 'knowledge', icon: '📜', name: 'المعرفة', 
        desc: 'تطوير المعرفة والعلوم الصحراوية',
        // 🖼️ image: 'assets/images/upgrades/knowledge.png', // 120×120 بكسل — ارفع صورتك هنا
        color: '#9b59b6', bgGrad: 'linear-gradient(135deg, rgba(155,89,182,0.15), rgba(100,50,120,0.08))'
      },
      { 
        id: 'defense', icon: '🛡️', name: 'الدفاع', 
        desc: 'تحصينات القلعة والدفاع',
        // 🖼️ image: 'assets/images/upgrades/defense.png', // 120×120 بكسل — ارفع صورتك هنا
        color: '#2ecc71', bgGrad: 'linear-gradient(135deg, rgba(46,204,113,0.15), rgba(20,150,70,0.08))'
      },
      { 
        id: 'trade', icon: '🐪', name: 'التجارة', 
        desc: 'قوافل التجارة الصحراوية',
        // 🖼️ image: 'assets/images/upgrades/trade.png', // 120×120 بكسل — ارفع صورتك هنا
        color: '#f39c12', bgGrad: 'linear-gradient(135deg, rgba(243,156,18,0.15), rgba(200,120,10,0.08))'
      },
    ];

    for (const p of paths) {
      const lvl = this.upgradeTree.getLevel(p.id);
      const maxLvl = this.upgradeTree.getMaxLevel(p.id);
      const canAfford = this.upgradeTree.canUpgrade(p.id);
      const effect = this.upgradeTree.getEffect(p.id);
      const isMax = lvl >= maxLvl;
      const pct = maxLvl > 0 ? (lvl / maxLvl) * 100 : 0;

      // بطاقة الترقية
      const card = document.createElement("div");
      card.className = "upgrade-card-large";
      card.style.background = p.bgGrad;
      card.style.borderColor = p.color + '44';
      card.innerHTML = `
        <div class="ug-card-header">
          <div class="ug-icon-wrap" style="background:${p.color}22;border-color:${p.color}44">
            <span class="ug-icon" style="color:${p.color}">${p.icon}</span>
          </div>
          <div class="ug-title-area">
            <div class="ug-name">${p.name}</div>
            <div class="ug-desc">${p.desc}</div>
          </div>
        </div>
        <div class="ug-level-row">
          <span class="ug-level-badge" style="background:${p.color}22;color:${p.color}">
            ${isMax ? '⭐⭐⭐' : `Lv.${lvl}/${maxLvl}`}
          </span>
          <span class="ug-effect" style="color:${p.color}">+${effect}</span>
        </div>
        <div class="ug-track-wrap">
          <div class="ug-track">
            <div class="ug-fill" style="width:${pct}%;background:${p.color}"></div>
          </div>
        </div>
        <div class="ug-card-footer">
          <span class="ug-cost">${isMax ? '—' : `🪙 ${this.upgradeTree.getCurrentCost(p.id)}`}</span>
          <button class="ug-btn" data-ugid="${p.id}" ${canAfford && !isMax ? '' : 'disabled'} 
            style="${canAfford && !isMax ? `background:linear-gradient(180deg,${p.color},${p.color}88);color:#fff` : 'background:rgba(255,255,255,0.06);color:#666'}">
            ${isMax ? '⭐ الأقصى' : (canAfford ? '▲ ترقية' : '💰 تحتاج ذهب')}
          </button>
        </div>
      `;

      // النقر على البطاقة يفتح التفاصيل
      card.addEventListener('click', (e) => {
        if (e.target.closest('.ug-btn')) return;
        this._openUpgradeDetail(p.id);
      });

      // زر الترقية
      const btn = card.querySelector('.ug-btn');
      if (btn && canAfford && !isMax) {
        btn.addEventListener('click', () => {
          if (this.upgradeTree.upgrade(p.id)) {
            this.renderPromotion();
            this.updateTopBar();
            this.showNotification(`⬆️ ${p.name} → المستوى ${this.upgradeTree.getLevel(p.id)}`);
          }
        });
      }

      grid.appendChild(card);
    }
  }

  /** رسم صفحة الأسلحة — من GameArmy الحقيقي */
  _renderWeaponsPage() {
    const grid = document.getElementById("weapons-grid");
    if (!grid) return;
    grid.textContent = "";

    const weapons = this.army?.weapons || [];
    const icons = { w1: '🗡️', w2: '🏹', w3: '🔱', w4: '⚔️', w5: '🔥', w6: '⚒️' };
    const colors = { w1: '#b8956a', w2: '#d4a76a', w3: '#8b6914', w4: '#ffd700', w5: '#ff6b6b', w6: '#9b59b6' };

    for (const w of weapons) {
      const isMax = w.level >= w.maxLevel;
      const pct = w.maxLevel > 0 ? (w.level / w.maxLevel) * 100 : 0;
      const starsHtml = '⭐'.repeat(w.level) + '☆'.repeat(Math.max(0, w.maxLevel - w.level));
      const cost = w.level < w.maxLevel ? `${w.upgradeCost} 💎` : '—';

      const card = document.createElement("div");
      card.className = "weapon-card-new";
      card.style.setProperty('--w-color', colors[w.id] || '#b8956a');
      card.innerHTML = `
        <div class="wc-header">
          <div class="wc-icon">${icons[w.id] || '⚔️'}</div>
          <div class="wc-info">
            <div class="wc-name">${w.name}</div>
            <div class="wc-desc">${w.desc || ''}</div>
          </div>
          <div class="wc-rarity">${isMax ? 'S+' : w.level >= 3 ? 'A' : w.level >= 1 ? 'B' : 'C'}</div>
        </div>
        <div class="wc-body">
          <div class="wc-stars">${starsHtml}</div>
          <div class="wc-stats">
            <span class="wc-stat">👊 ${Math.round(w.power)}</span>
            <span class="wc-stat">💎 ${cost}</span>
          </div>
          <div class="wc-track"><div class="wc-fill" style="width:${pct}%"></div></div>
          <div class="wc-level">Lv.${w.level}/${w.maxLevel}</div>
        </div>
        <button class="wc-btn" data-wid="${w.id}" ${isMax ? 'disabled' : ''}>
          ${isMax ? '⭐ مكتمل' : '▲ ترقية'}
        </button>
      `;

      card.querySelector('.wc-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        this._upgradeWeapon(w.id);
      });

      card.addEventListener('click', () => {
        this._openWeaponDetail(w.id);
      });

      grid.appendChild(card);
    }
  }

  /** فتح تفاصيل السلاح */
  _openWeaponDetail(weaponId) {
    const w = this.army?.weapons?.find(x => x.id === weaponId);
    if (!w) return;
    const icons = { w1: '🗡️', w2: '🏹', w3: '🔱', w4: '⚔️', w5: '🔥', w6: '⚒️' };
    const colors = { w1: '#b8956a', w2: '#d4a76a', w3: '#8b6914', w4: '#ffd700', w5: '#ff6b6b', w6: '#9b59b6' };
    const isMax = w.level >= w.maxLevel;
    const starsHtml = '⭐'.repeat(w.level) + '☆'.repeat(Math.max(0, w.maxLevel - w.level));
    const pct = w.maxLevel > 0 ? (w.level / w.maxLevel) * 100 : 0;
    const cost = w.level < w.maxLevel ? `${w.upgradeCost} 💎` : '—';

    const overlay = document.getElementById("weapon-detail-overlay");
    const card = document.getElementById("weapon-detail-card");
    if (!overlay || !card) return;

    card.style.setProperty('--w-color', colors[w.id] || '#b8956a');
    card.innerHTML = `
      <div class="wd-header">
        <span class="wd-icon">${icons[w.id] || '⚔️'}</span>
        <div>
          <div class="wd-name">${w.name}</div>
          <div class="wd-desc">${w.desc || ''}</div>
        </div>
        <button class="wd-close" id="wd-close-btn">✕</button>
      </div>
      <div class="wd-stars">${starsHtml}</div>
      <div class="wd-stats-grid">
        <div class="wd-stat"><span class="wd-stat-label">القوة</span><span class="wd-stat-val">${Math.round(w.power)}</span></div>
        <div class="wd-stat"><span class="wd-stat-label">المستوى</span><span class="wd-stat-val">${w.level}/${w.maxLevel}</span></div>
        <div class="wd-stat"><span class="wd-stat-label">التكلفة</span><span class="wd-stat-val">${cost}</span></div>
        <div class="wd-stat"><span class="wd-stat-label">التقدم</span><span class="wd-stat-val">${Math.round(pct)}%</span></div>
      </div>
      <div class="wd-track"><div class="wd-fill" style="width:${pct}%"></div></div>
      <button class="wd-upgrade-btn" id="wd-upgrade-btn" ${isMax ? 'disabled' : ''}>
        ${isMax ? '⭐ مكتمل — المستوى الأقصى' : `▲ ترقية إلى المستوى ${w.level + 1} (${cost})`}
      </button>
    `;
    overlay.classList.remove("hidden");

    document.getElementById("wd-close-btn").onclick = () => overlay.classList.add("hidden");
    overlay.onclick = (e) => { if (e.target === overlay) overlay.classList.add("hidden"); };

    const upBtn = document.getElementById("wd-upgrade-btn");
    if (upBtn && !isMax) {
      upBtn.onclick = () => {
        this._upgradeWeapon(w.id);
        this._openWeaponDetail(w.id);
        this.renderPromotion();
        this.updateTopBar();
      };
    }
  }

  /** تنفيذ ترقية السلاح */
  _upgradeWeapon(weaponId) {
    const w = this.army?.weapons?.find(x => x.id === weaponId);
    if (!w || w.level >= w.maxLevel) return;
    const houseLevel = this._landsState?.['b1']?.level || 1;
    if (w.canUpgrade(this.economy, houseLevel)) {
      w.upgrade(this.economy, houseLevel);
      this.showNotification(`⬆️ ${w.name} → المستوى ${w.level}/${w.maxLevel}`);
      this.renderPromotion();
      this.updateTopBar();
    } else {
      this.showNotification(`❌ مجوهرات غير كافية أو مستوى بيت الزعيم ${w.requireLevel}`);
    }
  }

  /** رسم صفحة المعرفة */
  _renderKnowledgePage() {
    const container = document.getElementById("knowledge-upgrades");
    if (!container) return;
    container.textContent = "";

    const upgrades = [
      { icon: '📖', name: 'القراءة', desc: 'إنتاج ذهب +15%', level: 3, max: 5, color: '#9b59b6' },
      { icon: '📚', name: 'الكتابة', desc: 'إنتاج ذهب +30%', level: 2, max: 5, color: '#8e44ad' },
      { icon: '🔮', name: 'السحر', desc: 'إنتاج ذهب +50%', level: 1, max: 5, color: '#9b59b6' },
      { icon: '💎', name: 'الجواهر', desc: 'إنتاج ذهب +80%', level: 0, max: 5, color: '#8e44ad' },
      { icon: '👑', name: 'الحكمة', desc: 'إنتاج ذهب +120%', level: 0, max: 5, color: '#9b59b6' },
    ];

    for (const u of upgrades) {
      const pct = (u.level / u.max) * 100;
      const card = document.createElement("div");
      card.className = "knowledge-card";
      card.innerHTML = `
        <div class="knowledge-icon">${u.icon}</div>
        <div class="knowledge-info">
          <div class="knowledge-name">${u.name}</div>
          <div class="knowledge-desc">${u.desc}</div>
          <div class="knowledge-track">
            <div class="knowledge-fill" style="width:${pct}%;background:${u.color}"></div>
          </div>
          <div class="knowledge-level">Lv.${u.level}/${u.max}</div>
        </div>
      `;
      container.appendChild(card);
    }
  }

  /** رسم صفحة المكافآت */
  _renderRewardsPage() {
    const container = document.getElementById("rewards-content");
    if (!container) return;
    container.textContent = "";

    const rewards = [
      { icon: '📅', title: 'المكافأة اليومية', desc: 'استلم مكافأتك اليومية - اليوم 3/7', canClaim: true },
      { icon: '🏆', title: 'الإنجازات', desc: 'لديك 3 إنجازات جديدة غير مستلمة', canClaim: true },
      { icon: '🎁', title: 'صندوق الهدايا', desc: 'صندوق هدايا متاح - افتحه الآن!', canClaim: true },
    ];

    for (const r of rewards) {
      const card = document.createElement("div");
      card.className = "reward-card";
      card.innerHTML = `
        <div class="reward-icon">${r.icon}</div>
        <div class="reward-title">${r.title}</div>
        <div class="reward-desc">${r.desc}</div>
        <button class="reward-claim-btn" ${r.canClaim ? '' : 'disabled'}>
          ${r.canClaim ? '📦 استلم الآن' : '✅ تم الاستلام'}
        </button>
      `;
      container.appendChild(card);
    }
  }

  /** رسم شجرة الترقيات */
  _renderUpgradeTree() {
    const grid = document.getElementById("upgrade-grid");
    if (!grid || !this.upgradeTree) return;

    // مسارات الترقية
    const paths = [
      { 
        id: 'army', icon: '⚔️', name: 'الجيش', 
        desc: 'تطوير قوة الجيش الصحراوي',
        // 🖼️ image: 'assets/images/upgrades/army.png', // 120×120 بكسل — ارفع صورتك هنا
        color: '#ff6b6b', bgGrad: 'linear-gradient(135deg, rgba(255,68,68,0.15), rgba(180,40,40,0.08))'
      },
      { 
        id: 'knowledge', icon: '📜', name: 'المعرفة', 
        desc: 'تطوير المعرفة والعلوم الصحراوية',
        // 🖼️ image: 'assets/images/upgrades/knowledge.png', // 120×120 بكسل — ارفع صورتك هنا
        color: '#9b59b6', bgGrad: 'linear-gradient(135deg, rgba(155,89,182,0.15), rgba(100,50,120,0.08))'
      },
      { 
        id: 'defense', icon: '🛡️', name: 'الدفاع', 
        desc: 'تحصينات القلعة والدفاع',
        // 🖼️ image: 'assets/images/upgrades/defense.png', // 120×120 بكسل — ارفع صورتك هنا
        color: '#2ecc71', bgGrad: 'linear-gradient(135deg, rgba(46,204,113,0.15), rgba(20,150,70,0.08))'
      },
      { 
        id: 'trade', icon: '🐪', name: 'التجارة', 
        desc: 'قوافل التجارة الصحراوية',
        // 🖼️ image: 'assets/images/upgrades/trade.png', // 120×120 بكسل — ارفع صورتك هنا
        color: '#f39c12', bgGrad: 'linear-gradient(135deg, rgba(243,156,18,0.15), rgba(200,120,10,0.08))'
      },
    ];

    for (const p of paths) {
      const lvl = this.upgradeTree.getLevel(p.id);
      const maxLvl = this.upgradeTree.getMaxLevel(p.id);
      const canAfford = this.upgradeTree.canUpgrade(p.id);
      const effect = this.upgradeTree.getEffect(p.id);
      const isMax = lvl >= maxLvl;
      const pct = maxLvl > 0 ? (lvl / maxLvl) * 100 : 0;

      // بطاقة الترقية
      const card = document.createElement("div");
      card.className = "upgrade-card-large";
      card.style.background = p.bgGrad;
      card.style.borderColor = p.color + '44';
      card.innerHTML = `
        <div class="ug-card-header">
          <div class="ug-icon-wrap" style="background:${p.color}22;border-color:${p.color}44">
            <span class="ug-icon" style="color:${p.color}">${p.icon}</span>
          </div>
          <div class="ug-title-area">
            <div class="ug-name">${p.name}</div>
            <div class="ug-desc">${p.desc}</div>
          </div>
        </div>
        <div class="ug-level-row">
          <span class="ug-level-badge" style="background:${p.color}22;color:${p.color}">
            ${isMax ? '⭐⭐⭐' : `Lv.${lvl}/${maxLvl}`}
          </span>
          <span class="ug-effect" style="color:${p.color}">+${effect}</span>
        </div>
        <div class="ug-track-wrap">
          <div class="ug-track">
            <div class="ug-fill" style="width:${pct}%;background:${p.color}"></div>
          </div>
        </div>
        <div class="ug-card-footer">
          <span class="ug-cost">${isMax ? '—' : `🪙 ${this.upgradeTree.getCurrentCost(p.id)}`}</span>
          <button class="ug-btn" data-ugid="${p.id}" ${canAfford && !isMax ? '' : 'disabled'} 
            style="${canAfford && !isMax ? `background:linear-gradient(180deg,${p.color},${p.color}88);color:#fff` : 'background:rgba(255,255,255,0.06);color:#666'}">
            ${isMax ? '⭐ الأقصى' : (canAfford ? '▲ ترقية' : '💰 تحتاج ذهب')}
          </button>
        </div>
      `;

      // النقر على البطاقة يفتح التفاصيل
      card.addEventListener('click', (e) => {
        if (e.target.closest('.ug-btn')) return;
        this._openUpgradeDetail(p.id);
      });

      // زر الترقية
      const btn = card.querySelector('.ug-btn');
      if (btn && canAfford && !isMax) {
        btn.addEventListener('click', () => {
          if (this.upgradeTree.upgrade(p.id)) {
            this.renderPromotion();
            this.updateTopBar();
            this.showNotification(`⬆️ ${p.name} → المستوى ${this.upgradeTree.getLevel(p.id)}`);
          }
        });
      }

      grid.appendChild(card);
    }
  }

  /** فتح نافذة تفاصيل الترقية */
  _openUpgradeDetail(pathId) {
    const modal = document.getElementById("upgrade-detail-modal");
    const p = this.upgradeTree.getPaths().find(x => x.id === pathId);
    if (!modal || !p) return;

    const lvl = p.currentLevel;
    const maxLvl = p.maxLevel;
    const isMax = lvl >= maxLvl;
    const pct = maxLvl > 0 ? (lvl / maxLvl) * 100 : 0;
    const nextEffect = !isMax ? p.levels[lvl]?.effect || 0 : '—';
    const cost = !isMax ? p.cost : '—';

    // تعيين المحتوى
    document.getElementById("detail-icon").textContent = p.icon;
    document.getElementById("detail-name").textContent = p.name;
    document.getElementById("detail-desc").textContent = p.desc || '';
    document.getElementById("detail-level").textContent = `Lv.${lvl}/${maxLvl}`;
    document.getElementById("detail-effect").textContent = `+${p.effect}`;
    document.getElementById("detail-next-effect").textContent = isMax ? '⭐⭐⭐' : `+${nextEffect}`;
    document.getElementById("detail-cost").textContent = isMax ? '—' : `🪙 ${cost}`;
    document.getElementById("detail-progress-fill").style.width = pct + '%';
    document.getElementById("detail-progress-text").textContent = `${lvl}/${maxLvl}`;

    const upgradeBtn = document.getElementById("detail-upgrade-btn");
    const preview = document.getElementById("detail-levels-preview");
    
    if (isMax) {
      upgradeBtn.textContent = "⭐⭐⭐ المستوى الأقصى";
      upgradeBtn.disabled = true;
      upgradeBtn.style.opacity = "0.5";
    } else {
      const canBuy = this.upgradeTree.canUpgrade(pathId);
      upgradeBtn.textContent = `▲ ترقية إلى المستوى ${lvl + 1} (🪙 ${cost})`;
      upgradeBtn.disabled = !canBuy;
      upgradeBtn.style.opacity = canBuy ? "1" : "0.5";
      upgradeBtn.onclick = () => {
        if (this.upgradeTree.upgrade(pathId)) {
          this._openUpgradeDetail(pathId);
          this.renderPromotion();
          this.updateTopBar();
          this.showNotification(`⬆️ ${p.name} → المستوى ${this.upgradeTree.getLevel(pathId)}`);
        }
      };
    }

    // معاينة المستويات
    preview.innerHTML = p.levels.map((lv, i) => {
      const unlocked = i < lvl;
      const current = i === lvl;
      const locked = i > lvl;
      return `<div class="detail-level-item ${unlocked ? 'unlocked' : ''} ${current ? 'current' : ''} ${locked ? 'locked' : ''}">
        <div class="dli-indicator">
          ${unlocked ? '✅' : (current ? '📍' : '🔒')}
        </div>
        <div class="dli-info">
          <span class="dli-label">المستوى ${i + 1}</span>
          <span class="dli-desc">${lv.desc}</span>
        </div>
        <div class="dli-cost">${unlocked ? '✔️' : `🪙 ${lv.cost}`}</div>
      </div>`;
    }).join('');

    modal.classList.remove("hidden");

    // إغلاق
    const closeBtn = document.getElementById("detail-modal-close");
    if (closeBtn) closeBtn.onclick = () => modal.classList.add("hidden");
    modal.onclick = (e) => { if (e.target === modal) modal.classList.add("hidden"); };
  }

  getBuildingIcon(b) {
    if (b.state === "locked") return "👹";
    if (b.state === "building") return "🔨";
    if (b.state === "ready") {
      const icons = {
        "البحوث": "🔬",
        "مستودع السلاح": "🗡️",
        "ساحة التدريب": "🏋️",
        "صندوق المكافآت": "🎁",
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
  _renderWeaponUpgradeModal() {
    const overlay = document.getElementById("modal-overlay");
    const card = document.getElementById("modal-card");
    if (!overlay || !card) return;
    const houseLevel = this._landsState?.['b1']?.level || 1;
    const weapons = this.army?.weapons || [];

    card.innerHTML = `
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-[#FFD700] font-bold text-base" style="font-family:'Cairo',sans-serif">🗡️ مستودع السلاح</h3>
        <button id="modal-close-btn" class="text-[#a08060] hover:text-[#FFD700] text-xl leading-none" style="background:none;border:none;cursor:pointer;font-family:inherit">&times;</button>
      </div>
      <div class="flex flex-col gap-2" style="max-height:60vh;overflow-y:auto">
        <div style="color:var(--beige-dark);font-size:0.65rem;text-align:center;margin-bottom:6px">🏠 بيت الزعيم المستوى ${houseLevel} — السلاح يتطلب مستوى معين لفتحه</div>
        ${weapons.map(w => {
          const canUpg = w.canUpgrade(this.economy, houseLevel);
          const starStr = '⭐'.repeat(w.level) + '☆'.repeat(w.maxLevel - w.level);
          const isLocked = houseLevel < w.requireLevel;
          return `<div style="background:rgba(40,24,12,0.9);border:1px solid rgba(255,215,0,0.08);border-radius:10px;padding:8px 10px;display:flex;align-items:center;gap:6px">
            <div style="flex:1">
              <div style="font-size:0.75rem;font-weight:700;color:${isLocked ? '#666' : 'var(--beige)'}">${isLocked ? '🔒 ' : ''}${w.name}</div>
              <div style="font-size:0.55rem;color:var(--beige-dark)">${w.desc}</div>
              <div style="font-size:0.6rem;color:var(--gold)">${starStr}</div>
            </div>
            <div style="text-align:center;min-width:50px">
              <div style="font-size:0.6rem;color:#ff6b6b">👊 ${w.power.toFixed(0)}</div>
            </div>
            ${isLocked ? `<div style="font-size:0.5rem;color:#666">تحتاج\nمستوى ${w.requireLevel}</div>` :
            w.level >= w.maxLevel ? `<div style="font-size:0.55rem;color:var(--gold)">⭐⭐⭐</div>` :
            `<button class="weapon-upg-btn" data-wid="${w.id}" style="padding:6px 12px;font-size:0.6rem;font-weight:700;background:linear-gradient(180deg,${canUpg ? '#9b59b6,#7d3c98' : '#444,#333'});color:#fff;border:none;border-radius:8px;cursor:${canUpg ? 'pointer' : 'default'};font-family:inherit" ${canUpg ? '' : 'disabled'}>
              ${w.upgradeCost} 💎
            </button>`}
          </div>`;
        }).join('')}
      </div>
    `;

    overlay.classList.remove("hidden");
    document.body.classList.add("modal-open");

    document.getElementById("modal-close-btn").onclick = () => {
      overlay.classList.add("hidden");
      document.body.classList.remove("modal-open");
    };
    overlay.onclick = (e) => {
      if (e.target === overlay) {
        overlay.classList.add("hidden");
        document.body.classList.remove("modal-open");
      }
    };

    card.querySelectorAll('.weapon-upg-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const wid = btn.dataset.wid;
        const weapon = weapons.find(w => w.id === wid);
        if (weapon && weapon.upgrade(this.economy, houseLevel)) {
          this._renderWeaponUpgradeModal();
          this.updateTopBar();
          this.showNotification(`⬆️ ${weapon.name} → ⭐${weapon.level}`);
        }
      });
    });
  }

  _renderTrainingGroundModal() {
    const overlay = document.getElementById("modal-overlay");
    const card = document.getElementById("modal-card");
    if (!overlay || !card) return;
    const army = this.army;
    const barLevel = this._landsState?.['b2']?.level || 1;
    const maxUnits = 5 + barLevel * 3;
    if (!army) {
      card.innerHTML = `<div style="text-align:center;padding:20px;color:var(--beige-dark)">⚠️ الجيش غير متاح</div>`;
      overlay.classList.remove("hidden");
      return;
    }

    card.innerHTML = `
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-[#FFD700] font-bold text-base" style="font-family:'Cairo',sans-serif">🏋️ ساحة التدريب</h3>
        <button id="modal-close-btn" class="text-[#a08060] hover:text-[#FFD700] text-xl leading-none" style="background:none;border:none;cursor:pointer;font-family:inherit">&times;</button>
      </div>
      <div class="flex flex-col gap-2">
        <div style="background:rgba(40,24,12,0.9);border:1px solid rgba(255,215,0,0.08);border-radius:10px;padding:10px">
          <div style="display:flex;justify-content:space-between;font-size:0.7rem;padding:3px 0;border-bottom:1px solid rgba(255,215,0,0.06)">
            <span style="color:var(--beige-dark)">🎖️ مستوى الجندي</span>
            <span style="color:var(--gold);font-weight:700">${army.unitLevel}</span>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:0.7rem;padding:3px 0;border-bottom:1px solid rgba(255,215,0,0.06)">
            <span style="color:var(--beige-dark)">👊 قوة الجندي</span>
            <span style="color:#ff6b6b;font-weight:700">${army.unitPower.toFixed(0)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:0.7rem;padding:3px 0;border-bottom:1px solid rgba(255,215,0,0.06)">
            <span style="color:var(--beige-dark)">📊 مستوى التدريب</span>
            <span style="color:var(--gold);font-weight:700">${army.trainingLevel}/${army.maxTrainingLevel}</span>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:0.7rem;padding:3px 0;border-bottom:1px solid rgba(255,215,0,0.06)">
            <span style="color:var(--beige-dark)">🛏️ سكن الجنود</span>
            <span style="color:var(--gold);font-weight:700">المستوى ${barLevel}</span>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:0.7rem;padding:3px 0">
            <span style="color:var(--beige-dark)">👥 أقصى عدد جنود</span>
            <span style="color:#2ecc71;font-weight:700">${maxUnits}</span>
          </div>
        </div>
        <button id="train-units-btn" style="padding:10px;font-size:0.75rem;font-weight:700;background:linear-gradient(180deg,#3a8ab5,#1a5a7a);color:#fff;border:none;border-radius:10px;cursor:pointer;font-family:inherit">
          🎓 ترقية التدريب (${army.trainingUpgradeCost} 🪙)
        </button>
      </div>
    `;

    overlay.classList.remove("hidden");
    document.body.classList.add("modal-open");

    document.getElementById("modal-close-btn").onclick = () => {
      overlay.classList.add("hidden");
      document.body.classList.remove("modal-open");
    };
    overlay.onclick = (e) => {
      if (e.target === overlay) {
        overlay.classList.add("hidden");
        document.body.classList.remove("modal-open");
      }
    };
    document.getElementById("train-units-btn").onclick = () => {
      if (army.upgradeTraining()) {
        this._renderTrainingGroundModal();
        this.updateTopBar();
        this.showNotification(`🎓 تدريب المستوى ${army.trainingLevel}`);
      } else {
        this.showNotification('❌ ذهب غير كافي');
      }
    };
  }

  showUpgradeModal(b) {
    // مودال مخصص لمستودع السلاح
    if (b.name === "مستودع السلاح") {
      this._renderWeaponUpgradeModal();
      return;
    }
    // مودال مخصص لساحة التدريب
    if (b.name === "ساحة التدريب") {
      this._renderTrainingGroundModal();
      return;
    }

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
          id: 'b1', x: 72, y: 35, name: 'بيت الزعيم',
          img_empty: ImageResolver ? ImageResolver.src('b1Empty') : '',
          img_building: ImageResolver ? ImageResolver.src('b1Construction') : '',
          img_built: ImageResolver ? ImageResolver.src('b1Built') : '',
          locked: false, level: 1
        },
        {
          id: 'b2', x: 20, y: 55, name: 'سكن الجنود',
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
          id: 'b4', x: 45, y: 30, name: 'ساحة التدريب',
          img_empty: ImageResolver ? ImageResolver.src('b6Empty') : '',
          img_building: ImageResolver ? ImageResolver.src('b6Construction') : '',
          img_built: ImageResolver ? ImageResolver.src('b6Built') : '',
          locked: false, level: 1
        },
      ]
    };

    // حالة المباني (فارغ/قيد الإنشاء/مبني) — استعادة من الحفظ إن وجد
    this._landsState = {};
    for (const b of L.buildings) {
      this._landsState[b.id] = { state: 'empty', level: b.level };
    }
    // تطبيق الحالة المحفوظة (إن وجدت)
    if (window._pendingLandsState) {
      for (const [id, saved] of Object.entries(window._pendingLandsState)) {
        if (this._landsState[id]) {
          this._landsState[id].state = saved.state || 'empty';
          this._landsState[id].level = saved.level || 1;
        }
      }
      delete window._pendingLandsState;
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
    // مسارات الترقية المطابقة لـ upgrade-tree.js
    const paths = [
      { id: 'army', icon: '⚔️', label: 'الجيش' },
      { id: 'knowledge', icon: '📜', label: 'المعرفة' },
      { id: 'defense', icon: '🛡️', label: 'الدفاع' },
      { id: 'trade', icon: '🐪', label: 'التجارة' },
    ];
    for (const p of paths) {
      const levelEl = document.getElementById(`qu-level-${p.id}`);
      const fillEl = document.getElementById(`qu-fill-${p.id}`);
      if (levelEl) {
        const lvl = this.upgradeTree.getLevel(p.id);
        levelEl.textContent = `Lv.${lvl}`;
      }
      if (fillEl) {
        const maxLevel = this.upgradeTree.getMaxLevel(p.id) || 5;
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
    // ربط شريط المحادثة الشفاف — الضغط يفتح الشات
    const chatOverlay = document.getElementById("chat-overlay");
    if (chatOverlay) {
      chatOverlay.addEventListener("click", () => {
        const chatPanel = document.getElementById("chat-panel");
        if (chatPanel) {
          chatPanel.classList.toggle("hidden");
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
