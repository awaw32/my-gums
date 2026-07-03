import { formatNumber } from "../economy.js";
import { injectPromotionMethods } from "./ui-promotion.js";
import { injectGameplayMethods } from "./ui-gameplay.js";

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
    this._lastPlayerList = [];
    if (this.world) {
      this.world._onPlayersChanged = (list) => {
        this._lastPlayerList = list;
        this.updatePlayerPanel(list);
      };
      this.world._onSelfStatsChanged = () => {
        this.updatePlayerPanel(this._lastPlayerList);
      };
      this.world._onNotification = (msg) => this.showNotification(msg);
      this.world._onChatMessage = (username, msg) => {
        this.addChatMessage(username, msg);
        this.addChatToOverlay(username, msg);
      };
    }
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

  addChatToOverlay(username, msg) {
    const msgEl = document.getElementById("chat-overlay-msg");
    const playerEl = document.getElementById("chat-overlay-player");
    if (msgEl) msgEl.textContent = msg;
    if (playerEl) playerEl.textContent = `${username}:`;
    if (this.achievements) this.achievements.updateProgress('chat_messages', 1);
  }

  updatePlayerPanel(players) {
    if (!this._playerListEl) return;
    const filtered = players.filter(p => p && p.username !== this.world?.username);
    this._playerCountEl.textContent = filtered.length + 1;
    this._playerListEl.innerHTML = "";
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

  showPlayerPanel() {
    if (this._playerPanel) {
      this._playerPanel.classList.remove("hidden");
    }
    this.updatePlayerPanel([]);
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

  buildAllianceScreen() {
    const div = document.createElement("div");
    div.className = "screen-panel";
    div.innerHTML = `
      <div class="panel-header">👑 التحالف</div>
      <div id="alliance-content"></div>
    `;
    return div;
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
    this.updateNotifBadges();
  }

  updateQuickUpgrades() {
    if (!this.upgradeTree) return;
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
    if (this.achievements) {
      const unclaimed = this.achievements.getAll().filter(a => a.completed && !a.claimed).length;
      const badge = document.getElementById('badge-achievements');
      if (badge) badge.classList.toggle('hidden', unclaimed === 0);
    }
    if (this.dailyLogin) {
      const state = this.dailyLogin.getState();
      const canClaim = state?.canClaim ?? false;
      const badge = document.getElementById('badge-daily');
      if (badge) badge.classList.toggle('hidden', !canClaim);
    }
    if (this.events) {
      const hasActive = this.events.getActiveEvents().length > 0;
      const badge = document.getElementById('badge-events');
      if (badge) badge.classList.toggle('hidden', !hasActive);
    }
    if (this.prestige) {
      const canPrestige = this.prestige.getState().canPrestige;
      const badge = document.getElementById('badge-prestige');
      if (badge) badge.classList.toggle('hidden', !canPrestige);
    }
    if (this.inventory) {
      const items = this.inventory.getState().items;
      const usableCount = ['heal_potion','xp_scroll','arena_ticket','fire_sword','desert_shield','power_helmet','power_gem','tower_blueprint']
        .filter(id => (items[id] || 0) > 0).length;
      const badge = document.getElementById('badge-inventory');
      if (badge) badge.classList.toggle('hidden', usableCount === 0);
    }
  }

  startTopBarLoop() {
    this._topBarInterval = setInterval(() => this.updateTopBar(), 500);
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
    const chatOverlay = document.getElementById("chat-overlay");
    if (chatOverlay) {
      chatOverlay.addEventListener("click", () => {
        const chatPanel = document.getElementById("chat-panel");
        if (chatPanel) {
          chatPanel.classList.toggle("hidden");
        }
      });
    }
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

  setShopBuyCallback(fn) {
    this._shopBuy = fn;
    window.shopBuy = fn;
  }

  _scheduleSave() {
    if (this._onSave) this._onSave();
  }
}

injectPromotionMethods(GameUI);
injectGameplayMethods(GameUI);
