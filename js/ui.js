import { formatNumber, RESOURCE_TYPES } from "./economy.js";

export class GameUI {
  constructor(village, army, economy, world) {
    this.village = village;
    this.army = army;
    this.economy = economy;
    this.world = world;
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
      <div class="alliance-card">
        <div style="font-size:2rem;text-align:center">🏰</div>
        <div style="font-weight:700;text-align:center;margin:6px 0">[NSOR] أنصار الصحراء</div>
        <div style="font-size:0.7rem;color:var(--beige-dark);text-align:center">الأعضاء: 32/50 • القوة: 1.2M</div>
      </div>
      <div class="alliance-card">
        <div style="font-weight:700;margin-bottom:8px">🌸 الأمنية</div>
        <div style="font-size:0.7rem;color:var(--beige-dark)">تبرع بالزهور لرفع مستوى التحالف (0/10 يومياً)</div>
      </div>
      <div class="alliance-card">
        <div style="font-weight:700;margin-bottom:8px">💬 الشات</div>
        <div style="font-size:0.7rem;color:var(--beige-dark)">تواصل مع أعضاء التحالف</div>
      </div>
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
      case "alliance": break;
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
    list.innerHTML = "";
    const players = [
      { name: "⚔️ فارس الصحراء", power: 1250760, rank: 1 },
      { name: "🧙 ساحر الرمال", power: 980450, rank: 2 },
      { name: "🛡️ حامي الواحة", power: 756230, rank: 3 },
      { name: "🐪 أنت", power: this.economy.power, rank: 4 },
    ];
    for (const p of players) {
      const card = document.createElement("div");
      card.className = "rank-card";
      card.innerHTML = `
        <div class="rank-num">${p.rank}</div>
        <div class="rank-avatar">${p.name.split(" ")[0]}</div>
        <div class="rank-info">
          <div class="rank-name">${p.name}</div>
          <div class="rank-power">👊 ${formatNumber(p.power)}</div>
        </div>
      `;
      list.appendChild(card);
    }
  }

  renderTerritories() {
    const list = document.getElementById("territory-list");
    if (!list) return;
    list.innerHTML = "";
    const territories = [
      { name: "واحة البداية", status: "🟢 محررة", icon: "🌴" },
      { name: "واحة النخيل", status: "🔴 تحت السيطرة", icon: "🌵" },
      { name: "واحة الكنز", status: "🔴 تحت السيطرة", icon: "💎" },
      { name: "واحة الأساطير", status: "🔴 تحت السيطرة", icon: "🏺" },
      { name: "واحة الفراعنة", status: "🔴 تحت السيطرة", icon: "👑" },
    ];
    for (const t of territories) {
      const card = document.createElement("div");
      card.className = "territory-card";
      card.innerHTML = `
        <div class="territory-icon">${t.icon}</div>
        <div class="territory-info">
          <div class="territory-name">${t.name}</div>
          <div class="territory-status">${t.status}</div>
        </div>
      `;
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
    setInterval(() => this.updateTopBar(), 500);
  }

  setShopBuyCallback(fn) {
    this._shopBuy = fn;
    window.shopBuy = fn;
  }
}
