import { formatNumber } from "../economy.js";
import { injectPromotionMethods } from "./ui-promotion.js";
import { injectGameplayMethods } from "./ui-gameplay.js";
import { ALLIANCE_RAIDS } from "../alliance-manager.js";

export class GameUI {
  constructor(village, army, economy, world, oasisManager, upgradeTree, researchTree, allianceManager, achievements, dailyLogin, prestige, inventory, events, tutorial, store, quests, warManager, notificationManager) {
    this.notifier = notificationManager;
    this.village = village;
    this.army = army;
    this.economy = economy;
    this.world = world;
    this.store = store;
    this.quests = quests;
    this.oasisManager = oasisManager;
    this.upgradeTree = upgradeTree;
    this.researchTree = researchTree;
    this.allianceManager = allianceManager;
    this.warManager = warManager;
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
    this.showScreen("territories");
    this.startTopBarLoop();
    this.initPlayerPanel();
    this.initChat();
    this.initTooltip();
    this.initDailyCheck();
    this.initStory();
    this.bindCombatLog();
    this.bindGlobalKeys();
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

  bindCombatLog() {
    const closeBtn = document.getElementById("combat-log-close");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => {
        const clog = document.getElementById("combat-log-overlay");
        if (clog) clog.classList.add("hidden");
      });
    }
  }

  bindGlobalKeys() {
    document.addEventListener("keydown", (e) => {
      if (e.key === "l" || e.key === "L") {
        const clog = document.getElementById("combat-log-overlay");
        if (clog) clog.classList.toggle("hidden");
        return;
      }
      if (e.key === "Escape") {
        const overlays = [
          { id: "confirm-overlay", close: (el) => el.classList.add("hidden") },
          { id: "modal-overlay", close: (el) => el.classList.add("hidden") },
          { id: "combat-log-overlay", close: (el) => el.classList.add("hidden") },
        ];
        const wd = document.querySelector(".wd-overlay:not(.hidden)");
        if (wd) { wd.classList.add("hidden"); return; }
        const wl = document.querySelector(".wl-overlay:not(.hidden)");
        if (wl) { wl.classList.add("hidden"); return; }
        const wu = document.querySelector(".wu-overlay:not(.hidden)");
        if (wu) { wu.classList.add("hidden"); return; }
        const upgrade = document.querySelector(".upgrade-detail-modal:not(.hidden)");
        if (upgrade) { upgrade.classList.add("hidden"); return; }
        const hero = document.querySelector(".hero-panel:not(.hidden)");
        if (hero) { hero.classList.add("hidden"); return; }
        for (const o of overlays) {
          const el = document.getElementById(o.id);
          if (el && !el.classList.contains("hidden")) {
            o.close(el);
            return;
          }
        }
      }
    });
  }

  initChat() {
    this._chatChannel = "general";
    this._chatMessageCache = [];
    const chatInput = document.getElementById("chat-input");
    const chatSend = document.getElementById("chat-send-btn");
    if (chatInput && chatSend) {
      chatSend.addEventListener("click", () => {
        const text = chatInput.value.trim();
        if (text && this.world) {
          this.world._sendWS({ type: "chat", message: text, channel: this._chatChannel });
          chatInput.value = "";
          if (this.achievements) this.achievements.updateProgress('chat_messages', 1);
        }
      });
      chatInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") chatSend.click();
      });
    }
    document.querySelectorAll(".chat-tab").forEach(tab => {
      tab.addEventListener("click", () => {
        document.querySelectorAll(".chat-tab").forEach(t => t.classList.remove("active"));
        tab.classList.add("active");
        this._chatChannel = tab.dataset.channel;
        this._filterChatMessages();
      });
    });
  }

  initTooltip() {
    this._tooltipEl = document.getElementById("game-tooltip");
    if (!this._tooltipEl) return;
    document.addEventListener("mouseenter", (e) => {
      const target = e.target?.closest?.("[data-tooltip]");
      if (target) this._showTooltip(target, e);
    }, true);
    document.addEventListener("mouseleave", (e) => {
      const target = e.target?.closest?.("[data-tooltip]");
      if (target) this._hideTooltip();
    }, true);
    document.addEventListener("mousemove", (e) => {
      if (this._tooltipEl && !this._tooltipEl.classList.contains("hidden")) {
        this._positionTooltip(e.clientX, e.clientY);
      }
    });
    document.addEventListener("touchstart", (e) => {
      const target = e.target?.closest?.("[data-tooltip]");
      if (target) { e.preventDefault(); this._showTooltip(target, e.touches[0]); }
    }, { passive: false });
    document.addEventListener("touchend", () => this._hideTooltip());
    document.addEventListener("touchmove", () => this._hideTooltip());
  }

  _showTooltip(el, ev) {
    const html = el.getAttribute("data-tooltip");
    if (!html || !this._tooltipEl) return;
    this._tooltipEl.innerHTML = html;
    this._tooltipEl.classList.remove("hidden");
    this._positionTooltip(ev.clientX || ev.pageX, ev.clientY || ev.pageY);
  }

  _hideTooltip() {
    if (this._tooltipEl) this._tooltipEl.classList.add("hidden");
  }

  _positionTooltip(x, y) {
    const tt = this._tooltipEl;
    if (!tt) return;
    const pad = 12;
    let left = x + pad;
    let top = y + pad;
    if (left + 220 > window.innerWidth) left = x - 220 - pad;
    if (top + 150 > window.innerHeight) top = y - 150 - pad;
    tt.style.left = left + "px";
    tt.style.top = top + "px";
  }

  initTutorial() {
    if (!this.tutorial || !this.tutorial.needsTutorial) return;
    setTimeout(() => this.showTutorialStep(), 2000);
  }

  initStory() {
    const storyManager = window._storyManager;
    if (!storyManager || !storyManager.canShowStory()) {
      // لا توجد مشاهد قصة — ابدأ التدريب مباشرة إذا كان مطلوباً
      this.initTutorial();
      return;
    }
    setTimeout(() => {
      this.showStoryScene(() => {
        // بعد انتهاء القصة، ابدأ التدريب إذا كان مطلوباً
        this.initTutorial();
      });
    }, 1000);
  }

  showStoryScene(callback) {
    const storyManager = window._storyManager;
    if (!storyManager) return;

    const scene = storyManager.getNextScene();
    if (!scene) {
      if (callback) callback();
      return;
    }

    // 🦅 مشهد Boss — له تأثير خاص
    if (scene.isBoss) {
      this._showBossScene(scene, callback);
      return;
    }

    const hasChoices = scene.choices && scene.choices.length > 0;
    const alreadyChosen = hasChoices ? storyManager.getChoiceForScene(scene.id) : null;

    const overlay = document.createElement("div");
    overlay.id = "story-overlay";
    overlay.className = "story-overlay";
    
    // بناء أزرار الخيارات
    let choicesHtml = '';
    if (hasChoices && alreadyChosen === null) {
      choicesHtml = '<div class="story-choices">' +
        scene.choices.map((c, i) => `
          <button class="story-choice-btn" data-choice="${i}">
            <span class="story-choice-text">${c.text}</span>
          </button>
        `).join('') +
      '</div>';
    } else if (hasChoices && alreadyChosen !== null) {
      const chosen = scene.choices[alreadyChosen];
      choicesHtml = `<div class="story-choice-result">
        <div class="story-choice-made">✅ ${chosen.text}</div>
        <p class="story-choice-next-text">${chosen.nextText || chosen.text}</p>
      </div>`;
    }

    overlay.innerHTML = `
      <div class="story-bg" style="background: ${scene.bg || 'linear-gradient(135deg, #1a0a00 0%, #3d1f00 50%, #5a2d00 100%)'}"></div>
      <div class="story-content">
        <div class="story-icon">${scene.icon}</div>
        <h2 class="story-title">${scene.title}</h2>
        <p class="story-text">${scene.text}</p>
        ${choicesHtml}
        <div class="story-progress">
          <div class="story-progress-bar" style="width: ${storyManager.getProgress().percentage}%"></div>
        </div>
        <div class="story-buttons">
          <button class="story-btn-skip">تخطي</button>
          <button class="story-btn-next">التالي</button>
        </div>
        <div class="story-counter" dir="ltr">${storyManager.currentScene} / ${storyManager.getCurrentScenes().length}</div>
      </div>
    `;
    document.body.appendChild(overlay);

    const nextBtn = overlay.querySelector('.story-btn-next');
    const skipBtn = overlay.querySelector('.story-btn-skip');
    
    // تعطيل زر التالي حتى يختار اللاعب إذا كان هناك خيارات
    if (hasChoices && alreadyChosen === null) {
      nextBtn.disabled = true;
      nextBtn.style.opacity = '0.5';
    }

    // ربط أزرار الخيارات
    if (hasChoices) {
      overlay.querySelectorAll('.story-choice-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.dataset.choice);
          const result = storyManager.makeChoice(scene.id, idx);
          if (result) {
            // إظهار نتيجة الاختيار
            nextBtn.disabled = false;
            nextBtn.style.opacity = '1';
            const choicesContainer = overlay.querySelector('.story-choices');
            if (choicesContainer) {
              choicesContainer.innerHTML = `<div class="story-choice-result">
                <div class="story-choice-made">✅ ${result.text}</div>
                <p class="story-choice-next-text">${result.nextText || ''}</p>
              </div>`;
            }
            // إظهار المكافأة
            if (result.reward) {
              const rewardStr = Object.entries(result.reward)
                .map(([k, v]) => {
                  const icons = { cash: '💵', gold: '🪙', gems: '💎', xp: '⭐', scrolls: '📜', hammers: '🔨', food: '🌾', defense: '🛡️', unitLevels: '⚔️', trainingLevel: '🏋️', alliancePower: '👑' };
                  return `${icons[k] || '•'} ${v}`;
                }).join(' ');
              if (rewardStr) this.showNotification(`🎯 حصلت على: ${rewardStr}`);
            }
            this.updateTopBar();
          }
        });
      });
    }

    nextBtn.onclick = () => {
      overlay.remove();
      if (storyManager.hasMoreScenes()) {
        this.showStoryScene(callback);
      } else {
        if (callback) callback();
      }
    };

    skipBtn.onclick = () => {
      overlay.remove();
      if (callback) callback();
    };
  }

  /** 🦅 مشهد Boss خاص بتأثيرات دراماتيكية */
  _showBossScene(scene, callback) {
    const storyManager = window._storyManager;
    if (!storyManager) return;

    const overlay = document.createElement("div");
    overlay.id = "story-overlay";
    overlay.className = "story-overlay story-boss-overlay";
    overlay.innerHTML = `
      <div class="story-boss-effect"></div>
      <div class="story-bg" style="background: ${scene.bg || 'linear-gradient(135deg, #1a0000 0%, #4a0000 50%, #8b0000 100%)'}"></div>
      <div class="story-content story-boss-content">
        <div class="story-boss-icon-pulse">${scene.icon}</div>
        <h2 class="story-boss-title">${scene.title}</h2>
        <p class="story-text story-boss-text">${scene.text}</p>
        <div class="story-boss-stats">
          <span class="story-boss-stat">⚔️ ${scene.bossId || 'Boss'}</span>
        </div>
        <div class="story-buttons">
          <button class="story-btn-skip story-btn-skip-boss">تخطي</button>
          <button class="story-btn-next story-btn-fight">⚔️ اذهب للمعركة!</button>
        </div>
        <div class="story-progress">
          <div class="story-progress-bar" style="width: ${storyManager.getProgress().percentage}%"></div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector('.story-btn-fight').onclick = () => {
      overlay.remove();
      // تفعيل وضع القتال ضد الزعيم
      if (storyManager._onBossFight) {
        storyManager._onBossFight(scene.bossId);
      }
      if (callback) callback();
    };

    overlay.querySelector('.story-btn-skip-boss').onclick = () => {
      overlay.remove();
      if (callback) callback();
    };
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
        this.tutorial.saveToDisk();
        const nextStep = this.tutorial.current;
        if (nextStep) this.showTutorialStep();
        else overlay.style.display = "none";
      };
    }
    if (skipBtn) {
      skipBtn.onclick = () => {
        this.tutorial.skip();
        this.tutorial.saveToDisk();
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
    if (this.store) {
      this.store.on('players', (list) => {
        this._lastPlayerList = list;
        this.updatePlayerPanel(list);
      });
      this.store.on('notification', (data) => {
        if (data && data.text) this.notifier.show(data.text);
      });
    }
    if (this.world) {
      this.world._onSelfStatsChanged = () => {
        this.updatePlayerPanel(this._lastPlayerList);
      };
      this.world._onChatMessage = (username, msg, channel) => {
        this.addChatMessage(username, msg, channel);
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

  addChatMessage(username, msg, channel) {
    channel = channel || "general";
    this._chatMessageCache.push({ username, msg, channel });
    if (this._chatMessageCache.length > 200) this._chatMessageCache.shift();
    this._filterChatMessages();
    if (this._chatChannel !== channel) {
      const overlay = document.getElementById("chat-overlay-msg");
      if (overlay) overlay.textContent = `${username}: ${msg}`;
    }
  }

  _filterChatMessages() {
    if (!this._chatMessages) return;
    const channel = this._chatChannel || "general";
    const filtered = channel === "general"
      ? this._chatMessageCache
      : this._chatMessageCache.filter(m => m.channel === "alliance");
    this._chatMessages.innerHTML = "";
    for (const m of filtered) {
      const el = document.createElement("div");
      el.className = "chat-msg";
      const isMe = m.username === this.world?.username;
      if (m.channel === "alliance") el.style.borderRight = "2px solid #d97706";
      const author = document.createElement("span");
      author.className = "chat-author";
      author.style.color = isMe ? '#4cd964' : '#FFD700';
      author.textContent = `${m.username}: `;
      el.appendChild(author);
      el.appendChild(document.createTextNode(m.msg));
      this._chatMessages.appendChild(el);
    }
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
      const curMode = this.world._activeMode?.modeName;
      let myKills, myExtra, extraIcon;
      if (curMode === "extraction") {
        myKills = this.world._activeMode._extractionKills || 0;
        myExtra = this.world._activeMode._totalDeposited || 0;
        extraIcon = "🪙";
      } else {
        myKills = this.world.sessionStats?.kills || 0;
        myExtra = this.world.sessionStats?.coinsEarned || 0;
        extraIcon = "💵";
      }
      const nameEl = document.createElement("div");
      nameEl.className = "player-item-name";
      nameEl.style.color = "var(--gold)";
      nameEl.textContent = `⭐ ${this.world.username} (أنت)`;
      myItem.appendChild(nameEl);
      const statsEl = document.createElement("div");
      statsEl.className = "player-item-stats";
      statsEl.innerHTML = `<span class="player-stat"><span class="player-stat-icon">👊</span><span class="player-stat-value">${formatNumber(myPower)}</span></span><span class="player-stat"><span class="player-stat-icon">💀</span><span class="player-stat-value">${myKills}</span></span><span class="player-stat"><span class="player-stat-icon">${extraIcon}</span><span class="player-stat-value">${formatNumber(myExtra)}</span></span>`;
      myItem.appendChild(statsEl);
      this._playerListEl.appendChild(myItem);
    }
    for (const p of filtered) {
      const item = document.createElement("div");
      item.className = "player-item";
      const nameEl = document.createElement("div");
      nameEl.className = "player-item-name";
      nameEl.title = p.username || "";
      nameEl.textContent = p.username || "";
      item.appendChild(nameEl);
      const statsEl = document.createElement("div");
      statsEl.className = "player-item-stats";
      statsEl.innerHTML = `<span class="player-stat"><span class="player-stat-icon">⚔️</span><span class="player-stat-value">${p.kills || 0}</span></span><span class="player-stat"><span class="player-stat-icon">💵</span><span class="player-stat-value">${formatNumber(p.coinsEarned || 0)}</span></span><span class="player-stat"><span class="player-stat-icon">👊</span><span class="player-stat-value">${formatNumber(p.army_power || 0)}</span></span>`;
      item.appendChild(statsEl);
      this._playerListEl.appendChild(item);
    }
  }

  showNotification(msg, type, duration) {
    this.notifier.show(msg, type, duration);
  }

  showConfirmDialog(opts) {
    const overlay = document.getElementById("confirm-overlay");
    const icon = document.getElementById("confirm-icon");
    const title = document.getElementById("confirm-title");
    const desc = document.getElementById("confirm-desc");
    const cost = document.getElementById("confirm-cost");
    const okBtn = document.getElementById("confirm-ok-btn");
    const cancelBtn = document.getElementById("confirm-cancel-btn");
    if (!overlay || !okBtn || !cancelBtn) return;

    icon.textContent = opts.icon || "💎";
    title.textContent = opts.title || "تأكيد الصرف";
    desc.textContent = opts.desc || "هل أنت متأكد؟";
    cost.textContent = opts.cost || "";
    okBtn.textContent = opts.okLabel || "تأكيد";
    overlay.classList.remove("hidden");

    const cleanup = () => {
      overlay.classList.add("hidden");
      okBtn.onclick = null;
      cancelBtn.onclick = null;
      overlay.onclick = null;
    };

    okBtn.onclick = () => { cleanup(); if (opts.onConfirm) opts.onConfirm(); };
    cancelBtn.onclick = cleanup;
    overlay.onclick = (e) => { if (e.target === overlay) cleanup(); };
  }

  spendWithConfirm(type, amount, label, onSpend) {
    if (amount <= 0) { if (onSpend) onSpend(); return; }
    const eco = this.economy;
    if (!eco.canAfford(type, amount)) {
      this.showNotification(`❌ لا تملك ${label} كافياً`);
      return;
    }
    this.showConfirmDialog({
      icon: "💎",
      title: `💰 صرف ${amount} ${label}`,
      desc: `هل أنت متأكد من صرف ${amount} ${label}؟ هذا الإجراء لا يمكن التراجع عنه.`,
      cost: `${amount} 💎`,
      okLabel: `✅ ادفع ${amount} ${label}`,
      onConfirm() { if (eco.spend(type, amount) && onSpend) onSpend(); }
    });
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
      gemsDisplay: document.getElementById("gems-display"),
      levelLabel: document.getElementById("level-label"),
      levelFill: document.getElementById("level-fill"),
      levelAmount: document.getElementById("level-amount"),
      avatar: document.getElementById("top-avatar"),
    };
  }

  setDbStatus(_connected) {}

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
    this.screens.oases = this.buildOasesScreen();
    this.screens.quests = this.buildQuestsScreen();
    this.screens.challenges = this.buildChallengesScreen();
    this.screens.mystats = this.buildMyStatsScreen();
    this.screens.settings = this.buildSettingsScreen();
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

  buildQuestsScreen() {
    const div = document.createElement("div");
    div.className = "screen-panel";
    div.innerHTML = `
      <div class="panel-header">📜 المهام</div>
      <div id="quests-content"></div>
    `;
    return div;
  }

  buildChallengesScreen() {
    const div = document.createElement("div");
    div.className = "screen-panel";
    div.innerHTML = `
      <div class="panel-header">⚔️ التحديات اليومية</div>
      <div id="challenges-content"></div>
    `;
    return div;
  }

  buildMyStatsScreen() {
    const div = document.createElement("div");
    div.className = "screen-panel";
    div.innerHTML = `
      <div class="panel-header">📊 إحصائياتي</div>
      <div id="mystats-content"></div>
    `;
    return div;
  }

  renderChallenges() {
    const container = document.getElementById("challenges-content");
    if (!container) return;
    
    // تحديات يومية عشوائية
    const challenges = this._getDailyChallenges();
    const completed = this._getCompletedChallenges();
    
    let html = '<div class="challenges-grid">';
    for (const ch of challenges) {
      const isCompleted = completed.includes(ch.id);
      const progress = this._getChallengeProgress(ch);
      const canClaim = isCompleted && !this._isChallengeClaimed(ch.id);
      
      html += `
        <div class="challenge-card${isCompleted ? ' challenge-done' : ''}">
          <div class="challenge-icon">${ch.icon}</div>
          <div class="challenge-info">
            <div class="challenge-title">${ch.title}</div>
            <div class="challenge-desc">${ch.desc}</div>
            <div class="challenge-progress">
              <div class="challenge-progress-track">
                <div class="challenge-progress-fill" style="width:${Math.min(100, (progress / ch.target) * 100)}%"></div>
              </div>
              <span class="challenge-progress-text">${progress}/${ch.target}</span>
            </div>
            <div class="challenge-reward">🏆 ${ch.reward}</div>
          </div>
          ${canClaim ? `<button class="action-btn challenge-claim-btn" data-challenge="${ch.id}">📦 استلم</button>` : ''}
        </div>
      `;
    }
    html += '</div>';
    
    container.innerHTML = html;
    
    // أزرار استلام المكافآت
    container.querySelectorAll('.challenge-claim-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const chId = btn.dataset.challenge;
        if (this._claimChallenge(chId)) {
          this.showNotification('✅ تم استلام المكافأة!');
          this.renderChallenges();
          this.updateTopBar();
        }
      });
    });
  }

  _getDailyChallenges() {
    // تحديات يومية ثابتة (يمكن جعلها عشوائية لاحقاً)
    return [
      {
        id: 'daily_kills',
        title: 'صائد الوحوش',
        desc: 'اقتل 20 وحشاً',
        icon: '⚔️',
        target: 20,
        type: 'kills',
        reward: '500 🪙 + 50 💎'
      },
      {
        id: 'daily_pvp',
        title: 'محترف القتال',
        desc: 'اربح 3 معارك PvP',
        icon: '🛡️',
        target: 3,
        type: 'pvp_wins',
        reward: '1000 💰 + 30 💎'
      },
      {
        id: 'daily_gold',
        title: 'جامع الذهب',
        desc: 'اجمع 2000 ذهب',
        icon: '🪙',
        target: 2000,
        type: 'gold_earned',
        reward: '500 🔨 + 100 📜'
      },
      {
        id: 'daily_buildings',
        title: 'المهندس',
        desc: 'طوّر 5 مباني',
        icon: '🏗️',
        target: 5,
        type: 'upgrades',
        reward: '300 💰 + 20 💎'
      }
    ];
  }

  _getCompletedChallenges() {
    // جلب من localStorage
    try {
      const saved = localStorage.getItem('desert_challenges');
      if (!saved) return [];
      const data = JSON.parse(saved);
      const today = new Date().toDateString();
      if (data.date !== today) {
        localStorage.setItem('desert_challenges', JSON.stringify({ date: today, completed: [], claimed: [] }));
        return [];
      }
      return data.completed || [];
    } catch {
      return [];
    }
  }

  _isChallengeClaimed(chId) {
    try {
      const saved = localStorage.getItem('desert_challenges');
      if (!saved) return false;
      const data = JSON.parse(saved);
      const today = new Date().toDateString();
      if (data.date !== today) return false;
      return (data.claimed || []).includes(chId);
    } catch {
      return false;
    }
  }

  _getChallengeProgress(challenge) {
    // تقدم التحدي من الإحصائيات الحالية
    if (challenge.type === 'kills') return this.world?.sessionStats?.kills || 0;
    if (challenge.type === 'pvp_wins') return this.world?.sessionStats?.pvpWins || 0;
    if (challenge.type === 'gold_earned') return this.world?.sessionStats?.coinsEarned || 0;
    if (challenge.type === 'upgrades') {
      // حساب عدد الترقيات اليوم
      return this._getTodayUpgrades();
    }
    return 0;
  }

  _getTodayUpgrades() {
    // يمكن تتبع الترقيات في sessionStats
    return this.world?.sessionStats?.upgradesToday || 0;
  }

  _claimChallenge(chId) {
    const claimed = this._isChallengeClaimed(chId);
    if (claimed) return false;
    
    const challenges = this._getDailyChallenges();
    const ch = challenges.find(c => c.id === chId);
    if (!ch) return false;
    
    const progress = this._getChallengeProgress(ch);
    if (progress < ch.target) return false;
    
    // حفظ كـ مكتمل ومستلم
    try {
      const saved = localStorage.getItem('desert_challenges');
      const data = saved ? JSON.parse(saved) : { date: new Date().toDateString(), completed: [], claimed: [] };
      if (data.date !== new Date().toDateString()) {
        data.date = new Date().toDateString();
        data.completed = [];
        data.claimed = [];
      }
      if (!data.completed.includes(chId)) data.completed.push(chId);
      data.claimed.push(chId);
      localStorage.setItem('desert_challenges', JSON.stringify(data));
    } catch {}
    
    // إعطاء المكافأة
    this._giveChallengeReward(ch);
    return true;
  }

  _giveChallengeReward(challenge) {
    // تحليل المكافأة وإعطاؤها
    // يمكن تحليل النص أو إضافة نظام مكافآت منفصل
    // للتبسيط، سنعطي مكافآت ثابتة حسب النوع
    if (challenge.id === 'daily_kills') {
      this.economy.addRaw('gold', 500);
      this.economy.addRaw('gems', 50);
    } else if (challenge.id === 'daily_pvp') {
      this.economy.addRaw('cash', 1000);
      this.economy.addRaw('gems', 30);
    } else if (challenge.id === 'daily_gold') {
      this.economy.addRaw('hammers', 500);
      this.economy.addRaw('scrolls', 100);
    } else if (challenge.id === 'daily_buildings') {
      this.economy.addRaw('cash', 300);
      this.economy.addRaw('gems', 20);
    }
  }

  renderMyStats() {
    const container = document.getElementById("mystats-content");
    if (!container) return;
    const eco = this.economy;
    const ach = this.achievements;
    const q = this.quests;
    const w = this.world;
    const completedAch = ach ? ach.achievements.filter(a => a.completed).length : 0;
    const totalAch = ach ? ach.achievements.length : 0;
    const dailyDone = q ? q.dailyQuests.filter(d => d.progress >= d.target).length : 0;
    const dailyTotal = q ? q.dailyQuests.length : 0;
    const stats = [
      { icon: '🏅', label: 'المستوى', value: eco?.level || 1 },
      { icon: '✨', label: 'الخبرة', value: `${(eco?.xp || 0).toLocaleString()} / ${(eco?.xpToNext || 100).toLocaleString()}` },
      { icon: '⚔️', label: 'القتل', value: (eco?.kills || 0).toLocaleString() },
      { icon: '💵', label: 'إجمالي المال المكتسب', value: (eco?.totalEarned?.cash || 0).toLocaleString() },
      { icon: '🪙', label: 'إجمالي الذهب', value: (eco?.totalEarned?.gold || 0).toLocaleString() },
      { icon: '💎', label: 'إجمالي الجواهر', value: (eco?.totalEarned?.gems || 0).toLocaleString() },
      { icon: '🏆', label: 'الإنجازات', value: `${completedAch} / ${totalAch}` },
      { icon: '📜', label: 'المهام اليومية', value: `${dailyDone} / ${dailyTotal}` },
      { icon: '🔨', label: 'التصنيعات', value: (ach?.achievements.find(a => a.type === 'crafts')?.progress || 0).toLocaleString() },
      { icon: '👑', label: 'انتصارات PvP', value: (ach?.achievements.find(a => a.type === 'pvp_wins')?.progress || 0).toLocaleString() },
      { icon: '🌴', label: 'الواحات المحتلة', value: (ach?.achievements.find(a => a.type === 'oases')?.progress || 0).toLocaleString() },
      { icon: '💬', label: 'رسائل الشات', value: (ach?.achievements.find(a => a.type === 'chat_messages')?.progress || 0).toLocaleString() },
      { icon: '📖', label: 'مشاهد القصة', value: (ach?.achievements.find(a => a.type === 'story_scenes')?.progress || 0).toLocaleString() },
      { icon: '🗡️', label: 'السلاح المجهز', value: w?._equippedWeapon ? (this.army?.weapons?.find(x => x.id === w._equippedWeapon)?.name || '—') : 'لا يوجد' },
    ];
    container.innerHTML = `<div style="display:flex;flex-direction:column;gap:6px;padding:4px 0 80px">${
      stats.map(s => `<div style="display:flex;align-items:center;gap:8px;background:var(--bg-card);border:1px solid var(--border-light);border-radius:10px;padding:10px 12px;box-shadow:var(--shadow-card)">
        <span style="font-size:1.2rem;width:32px;text-align:center">${s.icon}</span>
        <span style="flex:1;font-size:0.75rem;color:var(--text-secondary)">${s.label}</span>
        <span style="font-size:0.8rem;font-weight:800;color:var(--accent-gold)">${s.value}</span>
      </div>`).join('')
    }</div>`;
  }

  buildSettingsScreen() {
    const div = document.createElement("div");
    div.className = "screen-panel";
    div.innerHTML = `
      <div class="panel-header">⚙️ الإعدادات</div>
      <div id="settings-content"></div>
    `;
    return div;
  }

  renderSettings() {
    const container = document.getElementById("settings-content");
    if (!container) return;
    const settings = this.world?.settings || {};
    container.innerHTML = `
      <div class="settings-grid">
        <div class="setting-row">
          <span>🔊 المؤثرات الصوتية</span>
          <label class="toggle-switch">
            <input type="checkbox" id="sfx-toggle" ${settings.sfx !== false ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
        </div>
        <div class="setting-slider-row">
          <label>🔊 مستوى الصوت</label>
          <input type="range" id="sfx-volume" min="0" max="100" value="${Math.round((settings.sfxVolume ?? 0.5) * 100)}">
          <span class="slider-val" id="sfx-vol-label">${Math.round((settings.sfxVolume ?? 0.5) * 100)}</span>
        </div>
        <div class="setting-row">
          <span>🎵 الموسيقى</span>
          <label class="toggle-switch">
            <input type="checkbox" id="music-toggle" ${settings.music !== false ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
        </div>
        <div class="setting-slider-row">
          <label>🎵 مستوى الموسيقى</label>
          <input type="range" id="music-volume" min="0" max="100" value="${Math.round((settings.musicVolume ?? 0.3) * 100)}">
          <span class="slider-val" id="music-vol-label">${Math.round((settings.musicVolume ?? 0.3) * 100)}</span>
        </div>
        <div class="setting-row">
          <span>✨ جودة الرسوم (FPS)</span>
          <select id="quality-select" class="setting-select">
            <option value="60" ${settings.quality === '60' || !settings.quality ? 'selected' : ''}>60 FPS (عالي)</option>
            <option value="30" ${settings.quality === '30' ? 'selected' : ''}>30 FPS (متوسط)</option>
            <option value="15" ${settings.quality === '15' ? 'selected' : ''}>15 FPS (موفر للبطارية)</option>
          </select>
        </div>
        <div class="setting-row">
          <span>🖱️ تأكيد الإجراءات</span>
          <label class="toggle-switch">
            <input type="checkbox" id="confirm-toggle" ${settings.confirmActions !== false ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
        </div>
        <div class="setting-row">
          <span>📋 سجل المعارك</span>
          <label class="toggle-switch">
            <input type="checkbox" id="combat-log-toggle" ${settings.combatLog !== false ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
        </div>
        <div class="setting-row">
          <span>🗺️ الخريطة المصغرة</span>
          <label class="toggle-switch">
            <input type="checkbox" id="minimap-toggle" ${settings.minimap !== false ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
        </div>
        <div class="setting-row">
          <span>💾 حذف الحفظ</span>
          <button class="action-btn danger-btn" id="reset-game-btn">🗑️ حذف كل شيء</button>
        </div>
      </div>
    `;
    // ربط الأحداث
    container.querySelector('#sfx-toggle')?.addEventListener('change', e => {
      if (this.world) this.world.settings.sfx = e.target.checked;
      localStorage.setItem('desert_settings', JSON.stringify(this.world?.settings || {}));
    });
    container.querySelector('#music-toggle')?.addEventListener('change', e => {
      if (this.world) this.world.settings.music = e.target.checked;
      localStorage.setItem('desert_settings', JSON.stringify(this.world?.settings || {}));
    });
    container.querySelector('#sfx-volume')?.addEventListener('input', e => {
      const v = parseInt(e.target.value) / 100;
      if (this.world) {
        this.world.settings.sfxVolume = v;
        if (window._audio) window._audio.setSfxVolume(v);
      }
      const label = document.getElementById('sfx-vol-label');
      if (label) label.textContent = e.target.value;
      localStorage.setItem('desert_settings', JSON.stringify(this.world?.settings || {}));
    });
    container.querySelector('#music-volume')?.addEventListener('input', e => {
      const v = parseInt(e.target.value) / 100;
      if (this.world) {
        this.world.settings.musicVolume = v;
        if (window._audio) window._audio.setMusicVolume(v);
      }
      const label = document.getElementById('music-vol-label');
      if (label) label.textContent = e.target.value;
      localStorage.setItem('desert_settings', JSON.stringify(this.world?.settings || {}));
    });
    container.querySelector('#quality-select')?.addEventListener('change', e => {
      if (this.world) this.world.settings.quality = e.target.value;
      localStorage.setItem('desert_settings', JSON.stringify(this.world?.settings || {}));
    });
    container.querySelector('#confirm-toggle')?.addEventListener('change', e => {
      if (this.world) this.world.settings.confirmActions = e.target.checked;
      localStorage.setItem('desert_settings', JSON.stringify(this.world?.settings || {}));
    });
    container.querySelector('#combat-log-toggle')?.addEventListener('change', e => {
      if (this.world) this.world.settings.combatLog = e.target.checked;
      localStorage.setItem('desert_settings', JSON.stringify(this.world?.settings || {}));
    });
    container.querySelector('#minimap-toggle')?.addEventListener('change', e => {
      if (this.world) {
        this.world.settings.minimap = e.target.checked;
        const el = document.getElementById('mini-map');
        if (el) el.classList.toggle('hidden', !e.target.checked);
      }
      localStorage.setItem('desert_settings', JSON.stringify(this.world?.settings || {}));
    });
    container.querySelector('#reset-game-btn')?.addEventListener('click', () => {
      this.showConfirmDialog({ icon: '🗑️', title: 'حذف الحفظ', desc: 'سيتم حذف جميع التقدم! هل أنت متأكد؟', onConfirm: () => { localStorage.clear(); location.reload(); } });
    });
  }

  logCombat(type, text) {
    if (this.world && this.world.settings.combatLog === false) return;
    if (!this.world) return;
    this.world._combatLog.push({ type, text, time: Date.now() });
    if (this.world._combatLog.length > 100) this.world._combatLog.shift();
    const clogContent = document.getElementById("combat-log-content");
    if (!clogContent) return;
    const timeStr = new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
    const entry = document.createElement("div");
    entry.className = `combat-log-entry clog-${type}`;
    entry.innerHTML = `<span class="combat-log-time">${timeStr}</span> ${text}`;
    clogContent.appendChild(entry);
    clogContent.scrollTop = clogContent.scrollHeight;
  }

  renderQuests() {
    const container = document.getElementById("quests-content");
    if (!container || !this.quests) {
      if (container) container.innerHTML = '<div style="text-align:center;padding:20px;color:var(--beige-dark)">⚠️ المهام غير متاحة</div>';
      return;
    }
    const storyManager = window._storyManager;
    const storyChapter = storyManager ? storyManager.currentChapterData : null;
    const canCompleteStory = storyManager ? storyManager.canCompleteChapter() : false;
    const dailyQuests = this.quests.getDailyQuests();
    
    let html = '';
    
    // القصة الرئيسية
    if (storyChapter) {
      const rewardText = Object.entries(storyChapter.reward || {})
        .filter(([k]) => k !== 'title')
        .map(([k, v]) => {
          const icons = { gold: '🪙', cash: '💵', gems: '💎', xp: '⭐', food: '🌾', heroXp: '🦸', unitLevels: '⚔️', trainingLevel: '🏋️', knowledgeLevel: '📚' };
          return `${icons[k] || '•'} ${v}`;
        }).join(' + ');
      const completeBtnText = canCompleteStory ? 'أكمل الفصل ✓' : 'ابنِ جميع المباني أولاً';
      html += `
        <div class="quest-story-card">
          <div class="quest-story-header">📖 الفصل ${storyChapter.id}: ${storyChapter.title}</div>
          <div class="quest-story-desc">${storyChapter.description}</div>
          <div class="quest-story-reward">المكافأة: ${rewardText}</div>
          <button class="action-btn quest-advance-btn" id="quest-advance-btn" ${canCompleteStory ? '' : 'disabled'}>${completeBtnText}</button>
        </div>
      `;
    } else {
      html += '<div class="quest-story-complete">✅ أكملت جميع الفصول المتاحة!</div>';
    }
    
    // المهام اليومية
    html += '<div class="quests-section-title">📋 المهام اليومية</div>';
    if (!dailyQuests || dailyQuests.length === 0) {
      html += '<div class="empty-state" style="padding:20px"><div class="empty-state-icon">📋</div><div class="empty-state-title">لا مهام اليوم</div><div class="empty-state-desc">كل المهام اكتملت! استعد غداً لمهام جديدة.</div></div>';
    } else {
    html += '<div class="quests-list">';
    for (const quest of dailyQuests) {
      const progress = Math.min(100, (quest.progress / quest.target) * 100);
      const completed = quest.progress >= quest.target;
      html += `
        <div class="quest-card${completed ? ' quest-completed' : ''}">
          <div class="quest-header">
            <div class="quest-title">${quest.title}</div>
            <div class="quest-progress-text">${quest.progress}/${quest.target}</div>
          </div>
          <div class="quest-desc">${quest.desc}</div>
          <div class="quest-progress-track">
            <div class="quest-progress-fill" style="width:${progress}%"></div>
          </div>
          <div class="quest-reward">🏆 ${Object.entries(quest.reward).map(([k,v]) => `${v} ${k === 'gold' ? '🪙' : k === 'gems' ? '💎' : '💵'}`).join(' + ')}</div>
        </div>
      `;
    }
    html += '</div>';
    }
    
    container.innerHTML = html;
    
    this._updateQuestBadge();
    
    // زر إكمال الفصل
    const advanceBtn = document.getElementById('quest-advance-btn');
    if (advanceBtn) {
      advanceBtn.addEventListener('click', () => {
        const sm = window._storyManager;
        if (sm && sm.canCompleteChapter() && sm.completeChapter()) {
          this.showNotification('📖 أكملت الفصل وحصلت على المكافآت!');
          this.renderQuests();
          this.updateTopBar();
        } else {
          this.showNotification('❌ أكمل جميع مباني القرية أولاً');
        }
      });
    }
  }

  _updateQuestBadge() {
    if (!this.quests) return;
    const badge = document.getElementById('badge-quests');
    if (!badge) return;
    const completable = this.quests.dailyQuests.filter(q => q.progress >= q.target).length;
    if (completable > 0) {
      badge.textContent = completable;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
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
      case "oases": this.renderOases(); break;
      case "quests": this.renderQuests(); break;
      case "challenges": this.renderChallenges(); break;
      case "mystats": this.renderMyStats(); break;
      case "settings": this.renderSettings(); break;
    }
  }

  renderAlliance() {
    const container = document.getElementById("alliance-content");
    if (!container) return;
    if (!this.allianceManager) {
      container.innerHTML = `<div style="text-align:center;padding:20px;color:var(--beige-dark)">⚠️ التحالف غير متاح</div>`;
      return;
    }
    const am = this.allianceManager;
    this._renderTribalAllianceSection();
    const state = am.getState();
    
    let html = `
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

    // قسم القبيلة — يُعبّأ بواسطة _renderTribalAllianceSection
    html += `<div id="alliance-tribal-content"></div>`;

    // زر الترقية
    if (state.canUpgrade) {
      html += `<button class="action-btn upgrade-btn alliance-upgrade-btn" style="margin-bottom:10px">▲ ترقية (${formatNumber(state.upgradeCost)} 🪙)</button>`;
    } else if (state.level < state.maxLevel) {
      html += `<div class="alliance-need" style="text-align:center;padding:8px;color:var(--text-secondary);font-size:0.75rem">تحتاج ${formatNumber(state.upgradeCost)} 🪙</div>`;
    } else {
      html += `<div class="alliance-max" style="text-align:center;padding:8px;color:var(--gold);font-size:0.8rem">⭐⭐⭐ المستوى الأقصى</div>`;
    }
    
    // 🎯 قسم غارات التحالف
    html += `<div class="panel-header" style="margin-top:12px;font-size:0.9rem">🎯 غارات التحالف</div>`;
    
    if (am.isRaidActive && am._raidBoss) {
      // معركة الغارة نشطة
      const boss = am._raidBoss;
      const hpPct = Math.max(0, (boss.hp / boss.maxHp) * 100);
      html += `
        <div class="alliance-card" style="border-color:#e74c3c;background:linear-gradient(135deg,rgba(231,76,60,0.08),rgba(192,57,43,0.04))">
          <div style="text-align:center">
            <div style="font-size:2.5rem;margin-bottom:6px">🐉</div>
            <div style="font-weight:700;font-size:0.9rem;color:#e74c3c">${boss.name}</div>
            <div style="margin:10px 0">
              <div style="height:8px;background:rgba(0,0,0,0.1);border-radius:4px;overflow:hidden">
                <div style="height:100%;width:${hpPct}%;background:linear-gradient(90deg,#e74c3c,#c0392b);border-radius:4px;transition:width 0.3s"></div>
              </div>
              <div style="font-size:0.7rem;color:var(--text-secondary);margin-top:4px">${Math.floor(boss.hp).toLocaleString()} / ${boss.maxHp.toLocaleString()}</div>
            </div>
            <button class="action-btn" id="raid-attack-btn" style="background:#e74c3c">⚔️ هاجم الزعيم!</button>
            <button class="action-btn" id="raid-retreat-btn" style="margin-top:6px;background:#666;font-size:0.7rem">🏳️ انسحاب</button>
          </div>
        </div>
      `;
    } else if (am._raidCooldown > 0) {
      const mins = Math.ceil(am._raidCooldown / 60);
      html += `<div class="alliance-card" style="text-align:center;opacity:0.6">⏳ التبريد: ${mins} دقيقة</div>`;
    } else {
      // عرض الغارات المتاحة
      const raids = am.availableRaids;
      if (raids.length === 0) {
        html += `<div class="alliance-card" style="text-align:center;opacity:0.6;font-size:0.75rem">⚠️ ارقَ تحالفك أولاً أو زِد قوتك لفتح الغارات</div>`;
      } else {
        html += '<div style="display:flex;flex-direction:column;gap:8px">';
        for (let i = 0; i < ALLIANCE_RAIDS.length; i++) {
          const r = ALLIANCE_RAIDS[i];
          const unlocked = r.level <= am.level + 1;
          const enoughPower = am.economy.power >= r.powerReq;
          html += `
            <div class="alliance-card" style="${!unlocked ? 'opacity:0.4' : ''}">
              <div style="display:flex;align-items:center;gap:8px">
                <span style="font-size:1.5rem">${unlocked ? '🐉' : '🔒'}</span>
                <div style="flex:1">
                  <div style="font-weight:700;font-size:0.8rem;color:var(--text-primary)">${r.name}</div>
                  <div style="font-size:0.6rem;color:var(--text-secondary)">⚔️ ${r.powerReq.toLocaleString()} 👊</div>
                </div>
                <div style="font-size:0.55rem;text-align:left;direction:ltr">
                  ${Object.entries(r.reward).map(([k,v]) => {
                    const icons = {cash:'💵',gold:'🪙',gems:'💎',artifacts:'🏺',desertGem:'💠'};
                    return `${icons[k]||'•'}${v}`;
                  }).join(' ')}
                </div>
              </div>
              ${unlocked && enoughPower ? `<button class="action-btn raid-start-btn" data-raid="${i}" style="margin-top:8px;background:linear-gradient(135deg,#e67e22,#d35400)">🎯 ابدأ الغارة</button>` : ''}
              ${!enoughPower && unlocked ? `<div style="font-size:0.6rem;color:var(--text-secondary);margin-top:4px">تحتاج ${r.powerReq.toLocaleString()} 👊</div>` : ''}
            </div>
          `;
        }
        html += '</div>';
      }
    }
    
    container.innerHTML = html;
    
    // ربط الأزرار
    const upgradeBtn = container.querySelector('.alliance-upgrade-btn');
    if (upgradeBtn) {
      upgradeBtn.addEventListener('click', () => {
        if (am.upgrade()) {
          this.renderAlliance();
          this.updateTopBar();
        }
      });
    }
    
    container.querySelectorAll('.raid-start-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.raid);
        if (am.startRaid(idx)) {
          this.showNotification(`🎯 بدأت غارة ${ALLIANCE_RAIDS[idx].name}!`);
          this.renderAlliance();
        } else {
          this.showNotification('❌ لا يمكن بدء الغارة حالياً (تبريد أو متطلبات)');
        }
      });
    });
    
    const attackBtn = document.getElementById('raid-attack-btn');
    if (attackBtn) {
      attackBtn.addEventListener('click', () => {
        const dmg = am.dealRaidDamage();
        if (dmg > 0) {
          this.showNotification(`⚔️ ضربت الزعيم بـ ${dmg} ضرر!`);
          if (!am.isRaidActive) {
            this.showNotification(`🎉 انتصرت في الغارة! تحقق من المكافآت!`);
          }
          this.renderAlliance();
          this.updateTopBar();
        }
      });
    }
    
    const retreatBtn = document.getElementById('raid-retreat-btn');
    if (retreatBtn) {
      retreatBtn.addEventListener('click', () => {
        am.cancelRaid();
        this.showNotification('🏳️ انسحبت من الغارة (تبريد 5 دقائق)');
        this.renderAlliance();
      });
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
      const usableItems = ['heal_potion', 'xp_scroll', 'arena_ticket', 'fire_sword', 'desert_shield', 'power_helmet', 'power_gem', 'tower_blueprint', 'iron_sword'];
      const itemIcons = { heal_potion: '🧪', xp_scroll: '📜', arena_ticket: '🎫', fire_sword: '🗡️', desert_shield: '🛡️', power_helmet: '⛑️', power_gem: '💎', tower_blueprint: '📐', iron_sword: '🗡️', bandage: '🩹' };
      const itemLabels = { bandage: 'باندج', heal_potion: 'جرعة علاج', xp_scroll: 'لفافة خبرة', arena_ticket: 'تذكرة ساحة', fire_sword: 'سيف ناري', desert_shield: 'درع صحراوي', power_helmet: 'خوذة القوة', power_gem: 'جوهرة القوة', tower_blueprint: 'مخطط برج', iron_sword: 'سيف حديدي' };
      const itemTooltips = {
        bandage: '<div class="tt-name">🩹 باندج</div><div class="tt-desc">ضمادة بسيطة لمعالجة الجروح</div><div class="tt-sep"></div><div class="tt-stat"><span class="tt-stat-label">العلاج</span><span class="tt-stat-value">+30 HP</span></div><div class="tt-stat"><span class="tt-stat-label">الفئة</span><span class="tt-stat-value">علاج</span></div>',
        heal_potion: '<div class="tt-name">🧪 جرعة علاج</div><div class="tt-desc">جرعة سحرية لاستعادة الصحة</div><div class="tt-sep"></div><div class="tt-stat"><span class="tt-stat-label">العلاج</span><span class="tt-stat-value">+50 HP</span></div><div class="tt-stat"><span class="tt-stat-label">الفئة</span><span class="tt-stat-value">علاج</span></div>',
        fire_sword: '<div class="tt-name">🗡️ سيف ناري</div><div class="tt-desc">سيف مشتعل يسبب حرقاً إضافياً</div><div class="tt-sep"></div><div class="tt-stat"><span class="tt-stat-label">الضرر</span><span class="tt-stat-value">+40%</span></div><div class="tt-stat"><span class="tt-stat-label">المدة</span><span class="tt-stat-value">30 ثانية</span></div><div class="tt-stat"><span class="tt-stat-label">الفئة</span><span class="tt-stat-value">سلاح</span></div>',
        desert_shield: '<div class="tt-name">🛡️ درع صحراوي</div><div class="tt-desc">درع بدوي يقاوم الرمال والرياح</div><div class="tt-sep"></div><div class="tt-stat"><span class="tt-stat-label">الدفاع</span><span class="tt-stat-value">+50%</span></div><div class="tt-stat"><span class="tt-stat-label">المدة</span><span class="tt-stat-value">60 ثانية</span></div><div class="tt-stat"><span class="tt-stat-label">الفئة</span><span class="tt-stat-value">دفاع</span></div>',
        power_helmet: '<div class="tt-name">⛑️ خوذة القوة</div><div class="tt-desc">خوذة تعزز قوة المعركة</div><div class="tt-sep"></div><div class="tt-stat"><span class="tt-stat-label">القوة</span><span class="tt-stat-value">+30%</span></div><div class="tt-stat"><span class="tt-stat-label">المدة</span><span class="tt-stat-value">60 ثانية</span></div><div class="tt-stat"><span class="tt-stat-label">الفئة</span><span class="tt-stat-value">تعزيز</span></div>',
        xp_scroll: '<div class="tt-name">📜 لفافة خبرة</div><div class="tt-desc">لفافة قديمة تحتوي على معرفة أجدادية</div><div class="tt-sep"></div><div class="tt-stat"><span class="tt-stat-label">الخبرة</span><span class="tt-stat-value">+500 XP</span></div><div class="tt-stat"><span class="tt-stat-label">الفئة</span><span class="tt-stat-value">مورد</span></div>',
        power_gem: '<div class="tt-name">💎 جوهرة القوة</div><div class="tt-desc">جوهرة نادرة تضاعف ضرباتك</div><div class="tt-sep"></div><div class="tt-stat"><span class="tt-stat-label">الضرر</span><span class="tt-stat-value">×2</span></div><div class="tt-stat"><span class="tt-stat-label">المدة</span><span class="tt-stat-value">5 دقائق</span></div><div class="tt-stat"><span class="tt-stat-label">الفئة</span><span class="tt-stat-value">تعزيز</span></div>',
        arena_ticket: '<div class="tt-name">🎫 تذكرة ساحة</div><div class="tt-desc">تذكرة دخول لساحة القتال</div><div class="tt-sep"></div><div class="tt-stat"><span class="tt-stat-label">الاستخدام</span><span class="tt-stat-value">دخول الساحة</span></div><div class="tt-stat"><span class="tt-stat-label">الفئة</span><span class="tt-stat-value">خاص</span></div>',
        tower_blueprint: '<div class="tt-name">📐 مخطط برج</div><div class="tt-desc">رسمة هندسية لبناء أبراج دفاعية</div><div class="tt-sep"></div><div class="tt-stat"><span class="tt-stat-label">الاستخدام</span><span class="tt-stat-value">بناء البرج</span></div><div class="tt-stat"><span class="tt-stat-label">الفئة</span><span class="tt-stat-value">خاص</span></div>',
        iron_sword: '<div class="tt-name">🗡️ سيف حديدي</div><div class="tt-desc">سيف صلب من الحديد المطاوع</div><div class="tt-sep"></div><div class="tt-stat"><span class="tt-stat-label">الضرر الأساسي</span><span class="tt-stat-value">150</span></div><div class="tt-stat"><span class="tt-stat-label">المدة</span><span class="tt-stat-value">30 ثانية</span></div><div class="tt-stat"><span class="tt-stat-label">التحسين</span><span class="tt-stat-value">+150 ضرر/مستوى</span></div><div class="tt-stat"><span class="tt-stat-label">الفئة</span><span class="tt-stat-value">سلاح</span></div>',
      };
      itemsEl.innerHTML = Object.keys(state.items).length === 0
        ? '<div class="empty-state"><div class="empty-state-icon">📭</div><div class="empty-state-title">المخزون فارغ</div><div class="empty-state-desc">لم تصنع أي قطعة بعد. توجه إلى ورشة التصنيع لصنع أدواتك الأولى!</div></div>'
        : Object.entries(state.items).map(([id, count]) => {
            const isUsable = usableItems.includes(id);
            const tt = itemTooltips[id] || '';
            return `<div class="inventory-item"${tt ? ` data-tooltip="${tt.replace(/"/g, '&quot;')}"` : ''}>
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
              const icons = {gold:'🪙',cash:'💵',hammers:'🔨',scrolls:'📜',food:'🌾',gems:'💎'};
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
      ? '<div class="empty-state"><div class="empty-state-icon">🎊</div><div class="empty-state-title">لا توجد أحداث</div><div class="empty-state-desc">الصحراء هادئة اليوم... لكن التاجر يهمس بقدوم حدث قريب. ترقّب!</div></div>'
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
        const nextLevel = state.level + 1;
        const nextBonus = this.prestige.getBonusForLevel(nextLevel);
        this.showConfirmDialog({
          icon: "👑",
          title: `🔄 إعادة الميلاد — المستوى ${nextLevel}`,
          desc: `الملك العظيم، هل أنت متأكد من بدء الحكاية من جديد؟ ستفقد كل التقدم ولكن ستحتفظ بـ 50 💎 وقوة مضاعفة!`,
          cost: `🔄 Prestige ${nextLevel}: ${nextBonus?.icon || ''} ×${nextBonus?.dmgMult || '?'} ضرر | +${50 * nextLevel}% XP`,
          okLabel: "👑 أعد الميلاد",
          onConfirm: () => {
            if (this.prestige.prestige()) {
              this.showNotification(`🔄 Prestige #${nextLevel}! ${nextBonus?.icon} الضرر ×${nextBonus?.dmgMult}`);
              this.renderPrestige();
              this.renderPromotion();
              this.updateTopBar();
            }
          }
        });
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

  buildOasesScreen() {
    const div = document.createElement("div");
    div.className = "screen-panel";
    div.innerHTML = `
      <div class="panel-header">🌴 الواحات</div>
      <div id="oases-content"></div>
    `;
    return div;
  }

  renderOases() {
    const container = document.getElementById("oases-content");
    if (!container || !this.oasisManager) {
      if (container) container.innerHTML = '<div style="text-align:center;padding:20px;color:var(--beige-dark)">⚠️ الواحات غير متاحة</div>';
      return;
    }
    const state = this.oasisManager.getState();
    if (!state || state.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🌴</div><div class="empty-state-title">لا واحات بعد</div><div class="empty-state-desc">لم تسيطر على أي واحة بعد. الواحات تدر دخلاً ثابتاً — ابحث عنها في الخريطة!</div></div>';
      return;
    }
    container.innerHTML = `
      <div class="oases-grid">
        ${state.map((o, i) => `
          <div class="oasis-card${o.captured ? ' oasis-captured' : ''}">
            <div class="oasis-icon">${o.icon || '🌴'}</div>
            <div class="oasis-name">${o.name || `واحة ${i + 1}`}</div>
            <div class="oasis-income">💵 +${o.income || 0}/ثانية</div>
            ${o.captured 
              ? '<div class="oasis-status">✅ مأسور</div>' 
              : `<button class="action-btn oasis-capture-btn" data-oasis="${i}">⚔️ احتل</button>`
            }
          </div>
        `).join('')}
      </div>
    `;
    container.querySelectorAll('.oasis-capture-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.oasis);
        if (this.oasisManager.captureOasis(idx)) {
          this.showNotification(`🌴 احتلت ${state[idx].name || 'واحة'}!`);
          this.renderOases();
          this.updateTopBar();
        } else {
          this.showNotification('❌ قوة الجيش غير كافية!');
        }
      });
    });
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
    if (this.els.gemsDisplay) {
      this.els.gemsDisplay.textContent = formatNumber(eco.gems || 0);
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
    if (this.quests) {
      const completable = this.quests.dailyQuests.filter(q => q.progress >= q.target).length;
      const badge = document.getElementById('badge-quests');
      if (badge) {
        if (completable > 0) { badge.textContent = completable; badge.classList.remove('hidden'); }
        else { badge.classList.add('hidden'); }
      }
    }
  }

  startTopBarLoop() {
    if (this._topBarInterval) clearInterval(this._topBarInterval);
    if (this._buildingTimerInterval) clearInterval(this._buildingTimerInterval);
    if (this._questRefreshTimer) clearInterval(this._questRefreshTimer);
    this._topBarInterval = setInterval(() => this.updateTopBar(), 1000); // كل ثانية بدلاً من 500ms لتقليل الحمل
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
    // تحديث تلقائي لشاشة المهام كل 3 ثوانٍ أثناء عرضها
    this._questRefreshTimer = setInterval(() => {
      if (this.currentScreen === "quests" && this.quests) {
        this.renderQuests();
      }
    }, 3000);
    if (!this._chatBound) {
      this._chatBound = true;
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

  renderMiniMap() {
    const canvas = document.getElementById("mini-map");
    if (!canvas) return;
    if (!this.world || this.world.settings?.minimap === false || !this.world.running) {
      canvas.classList.add("hidden");
      return;
    }
    canvas.classList.remove("hidden");
    const ctx = canvas.getContext("2d");
    const W = this.world._worldW || 2400;
    const H = this.world._worldH || 2400;
    const scaleX = 180 / W;
    const scaleY = 180 / H;

    ctx.clearRect(0, 0, 180, 180);
    ctx.fillStyle = "rgba(210,180,140,0.3)";
    ctx.fillRect(0, 0, 180, 180);

    // رسم النقاط الساخنة (oases — b2, b3, b4, m1, m2)
    const POI = [
      { x: 600, y: 600, color: "#22c55e" }, { x: 1800, y: 600, color: "#22c55e" },
      { x: 1200, y: 1200, color: "#22c55e" }, { x: 600, y: 1800, color: "#22c55e" },
      { x: 1800, y: 1800, color: "#22c55e" }, { x: 1200, y: 400, color: "#f59e0b" },
      { x: 400, y: 1200, color: "#f59e0b" }, { x: 2000, y: 1200, color: "#f59e0b" },
    ];
    for (const p of POI) {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x * scaleX, p.y * scaleY, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // رسم الأعداء القريبين
    if (this.world._enemies) {
      for (const e of this.world._enemies) {
        if (!e || e.hp <= 0) continue;
        ctx.fillStyle = "#ef4444";
        ctx.fillRect(e.x * scaleX - 1, e.y * scaleY - 1, 3, 3);
      }
    }

    // رسم اللاعبين الآخرين
    if (this.world._otherPlayers) {
      for (const p of this.world._otherPlayers) {
        ctx.fillStyle = "#3b82f6";
        ctx.beginPath();
        ctx.arc(p.x * scaleX, p.y * scaleY, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // رسم موقع اللاعب
    const player = this.world._player;
    if (player) {
      ctx.fillStyle = "#ffd700";
      ctx.shadowColor = "#ffd700";
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(player.x * scaleX, player.y * scaleY, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // رسم الإطار
    ctx.strokeStyle = "rgba(255,215,0,0.4)";
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, 180, 180);
  }

  startMiniMapLoop() {
    this._mmInterval = setInterval(() => this.renderMiniMap(), 1000);
    this.renderMiniMap();
    // Click-to-navigate على الخريطة المصغرة
    const canvas = document.getElementById("mini-map");
    if (canvas) {
      canvas.addEventListener("click", (e) => {
        if (!this.world) return;
        const rect = canvas.getBoundingClientRect();
        const xRatio = (e.clientX - rect.left) / rect.width;
        const yRatio = (e.clientY - rect.top) / rect.height;
        const W = this.world._worldW || 2400;
        const H = this.world._worldH || 2400;
        this.world.movePlayerTo(Math.floor(xRatio * W), Math.floor(yRatio * H));
      });
    }
  }

  stopMiniMapLoop() {
    if (this._mmInterval) { clearInterval(this._mmInterval); this._mmInterval = null; }
  }
}

injectPromotionMethods(GameUI);
injectGameplayMethods(GameUI);
