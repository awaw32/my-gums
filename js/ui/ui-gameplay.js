import { formatNumber } from "../economy.js";

export function injectGameplayMethods(GameUI) {

GameUI.prototype.buildRankingScreen = function() {
  const div = document.createElement("div");
  div.className = "screen-panel";
  div.innerHTML = `<div class="panel-header">🏆 قمة المجد</div><div id="ranking-list"></div><div class="version-badge" id="version-badge"></div>`;
  return div;
};

GameUI.prototype.buildTerritoriesScreen = function() {
  const div = document.createElement("div");
  div.className = "lands-page lands-page-full";
  div.innerHTML = `
    <div class="lands-bg" id="lands-bg"></div>
    <div class="lands-vignette"></div>
    <div id="lands-buildings" class="lands-buildings"></div>
    <div id="lands-toast" class="lands-toast hidden"></div>
    <div id="lands-village-info" class="lands-village-info"></div>
    <button id="lands-next-village-btn" class="lands-next-village-btn hidden">الانتقال للقرية التالية ➡️</button>
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
};

GameUI.prototype.buildWarScreen = function() {
  const div = document.createElement("div");
  div.className = "screen-panel";
  div.innerHTML = `
    <div class="panel-header">⚔️ ساحات الحرب</div>
    <div class="war-modes-row">
      <button class="war-mode-btn" id="arena-enter-btn" data-mode="oasis">
        <div class="war-mode-icon">🌴</div>
        <div class="war-mode-name">واحة الغنائم</div>
        <div class="war-mode-desc">PvP — قاتل اللاعبين</div>
      </button>
      <button class="war-mode-btn" id="adventure-enter-btn" data-mode="adventure">
        <div class="war-mode-icon">🐍</div>
        <div class="war-mode-name">مغامرة</div>
        <div class="war-mode-desc">PvE — وحوش الصحراء</div>
      </button>
      <button class="war-mode-btn" id="campaign-enter-btn" data-mode="campaign">
        <div class="war-mode-icon">🗺️</div>
        <div class="war-mode-name">حملة</div>
        <div class="war-mode-desc">PvE — مراحل القصة</div>
      </button>
    </div>
    <div class="war-mode-details" id="war-mode-details">
      <div class="war-detail-card" id="war-detail-oasis">
        <div class="war-detail-header">
          <span class="war-detail-icon">🌴</span>
          <span class="war-detail-title">واحة الغنائم</span>
        </div>
        <div class="war-detail-body">
          <p>ادخل عالم الصحراء وقاتل اللاعبين الآخرين في معارك PvP مباشرة. اجمع الغنائم واحترق أعداءك!</p>
          <div class="war-detail-stats">
            <div class="war-stat"><span class="war-stat-icon">⚔️</span><span class="war-stat-label">نوع القتال</span><span class="war-stat-value">PvP + PvE</span></div>
            <div class="war-stat"><span class="war-stat-icon">🏆</span><span class="war-stat-label">المكافآت</span><span class="war-stat-value">ذهب + غنائم</span></div>
            <div class="war-stat"><span class="war-stat-icon">💀</span><span class="war-stat-label">العقوبة</span><span class="war-stat-value">خسارة جزء من المال</span></div>
          </div>
          <button class="war-start-btn" id="war-start-oasis">🚀 ادخل واحة الغنائم</button>
        </div>
      </div>
      <div class="war-detail-card hidden" id="war-detail-adventure">
        <div class="war-detail-header">
          <span class="war-detail-icon">🐍</span>
          <span class="war-detail-title">مغامرة الصحراء</span>
        </div>
        <div class="war-detail-body">
          <p>استكشف أعماق الصحراء واقتل الوحوش البرية. لا PvP هنا — ركز على القتال والجمع!</p>
          <div class="war-detail-stats">
            <div class="war-stat"><span class="war-stat-icon">⚔️</span><span class="war-stat-label">نوع القتال</span><span class="war-stat-value">PvE فقط</span></div>
            <div class="war-stat"><span class="war-stat-icon">🏆</span><span class="war-stat-label">المكافآت</span><span class="war-stat-value">ذهب + خبرة + مواد</span></div>
            <div class="war-stat"><span class="war-stat-icon">🔒</span><span class="war-stat-label"> PvP</span><span class="war-stat-value">معطّل</span></div>
          </div>
          <button class="war-start-btn" id="war-start-adventure">🚀 ابدأ المغامرة</button>
        </div>
      </div>
      <div class="war-detail-card hidden" id="war-detail-campaign">
        <div class="war-detail-header">
          <span class="war-detail-icon">🗺️</span>
          <span class="war-detail-title">حملة الأبطال</span>
        </div>
        <div class="war-detail-body">
          <p>اتبع القصة الرئيسية وتقدم عبر المراحل. قاتل الزعماء واكتمل الفصول!</p>
          <div class="war-detail-stats">
            <div class="war-stat"><span class="war-stat-icon">⚔️</span><span class="war-stat-label">نوع القتال</span><span class="war-stat-value">PvE + مراحل</span></div>
            <div class="war-stat"><span class="war-stat-icon">🏆</span><span class="war-stat-label">المكافآت</span><span class="war-stat-value">ذهب + مكافآت خاصة</span></div>
            <div class="war-stat"><span class="war-stat-icon">📖</span><span class="war-stat-label">المراحل</span><span class="war-stat-value" id="war-campaign-progress">0/∞</span></div>
          </div>
          <button class="war-start-btn" id="war-start-campaign">🚀 ابدأ الحملة</button>
        </div>
      </div>
    </div>
  `;
  return div;
};

GameUI.prototype.renderRanking = function() {
  const list = document.getElementById("ranking-list");
  if (!list) return;
  // تحديث رقم الإصدار
  const vb = document.getElementById("version-badge");
  if (vb) {
    const bid = window._buildId || localStorage.getItem('game_build') || '';
    if (bid) {
      let vnum = parseInt(localStorage.getItem('version_num') || '0');
      const stored = localStorage.getItem('version_bid');
      if (stored !== bid) {
        vnum++;
        localStorage.setItem('version_num', '' + vnum);
        localStorage.setItem('version_bid', bid);
      }
      vb.textContent = `الإصدار رقم ${vnum}`;
    } else {
      vb.textContent = 'الإصدار رقم —';
    }
  }
  list.innerHTML = `<div style="text-align:center;padding:20px;color:var(--beige-dark)">⏳ جاري التحميل...</div>`;
  const apiBase = this.world?.apiBase || "";
  fetch(apiBase + "/api/leaderboard")
    .then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
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
};

GameUI.prototype.renderTerritories = function() {
  const container = document.getElementById("lands-buildings");
  if (!container) return;
  if (!this._landsInitialized) {
    this._initLandsPage();
  }
};

GameUI.prototype._initLandsPage = function() {
  if (this._landsInitialized) return;
  this._landsInitialized = true;
  if (!this.village) return;
  const villageData = this.village.currentVillage;
  if (!villageData) return;

  const bg = villageData.bg || (ImageResolver ? ImageResolver.src('landsBg') : 'assets/images/bg-village.jpg');
  const bgEl = document.getElementById('lands-bg');
  if (bgEl) bgEl.style.backgroundImage = `url('${bg}')`;

  this._landsState = {};
  for (const b of this.village.buildings) {
    const landsState = this._toLandsState(b.state);
    this._landsState[b.id] = { state: landsState, level: b.level || 1, unlocked: b.state !== 'locked' };
  }

  if (window._pendingLandsState) {
    for (const [id, saved] of Object.entries(window._pendingLandsState)) {
      const vb = this.village.buildings.find(b => b.id === id);
      if (vb) {
        if (saved.state === 'built') { vb.state = 'ready'; vb.level = saved.level || 1; }
        else if (saved.state === 'building') { vb.state = 'building'; }
        else { vb.state = 'locked'; }
        this._landsState[id] = { state: saved.state || 'empty', level: saved.level || 1, unlocked: saved.unlocked ?? (vb.state !== 'locked') };
      }
    }
    delete window._pendingLandsState;
  }

  this._landsProgress = this.village.buildings.filter(b => b.state === 'ready').length;
  this._landsMax = this.village.buildings.length;
  this._renderLandsBuildings();
};

GameUI.prototype._toLandsState = function(villageState) {
  if (villageState === 'ready') return 'built';
  if (villageState === 'building') return 'building';
  if (villageState === 'locked') return 'locked';
  return 'empty';
};

GameUI.prototype._toVillageState = function(landsState) {
  if (landsState === 'built') return 'ready';
  if (landsState === 'building') return 'building';
  return 'locked';
};

GameUI.prototype._renderLandsBuildings = function() {
  const container = document.getElementById('lands-buildings');
  if (!container || !this.village) return;
  container.innerHTML = '';
  const villageData = this.village.currentVillage;
  const infoEl = document.getElementById('lands-village-info');
  if (infoEl && villageData) {
    const progress = this.village.getProgress();
    infoEl.innerHTML = `<div class="lands-village-name">${villageData.name}</div><div class="lands-village-progress">${progress.built}/${progress.total} مبنى</div>`;
  }
  const nextBtn = document.getElementById('lands-next-village-btn');
  if (nextBtn) {
    const canMove = this.village.canMoveToNext();
    nextBtn.classList.toggle('hidden', !canMove);
    nextBtn.onclick = () => {
      const storyManager = window._storyManager;
      if (storyManager && storyManager.canCompleteChapter()) {
        storyManager.completeChapter();
      }
      if (this.village.moveToNext()) {
        this._landsInitialized = false;
        this._initLandsPage();
        this.showNotification(`🎉 تم الانتقال إلى ${this.village.currentVillage.name}!`);
      }
    };
  }
  for (const b of this.village.buildings) {
    const st = this._landsState[b.id];
    const imgSet = b.img || { empty: '', building: '', built: '' };
    const isLocked = st.state === 'locked';
    const imgSrc = st.state === 'built' ? imgSet.built
      : st.state === 'building' ? imgSet.building
      : isLocked ? '' : imgSet.empty;
    const badgeText = st.state === 'built' ? 'تم'
      : st.state === 'building' ? 'يبني'
      : isLocked ? 'مقفل'
      : 'فارغ';
    const badgeClass = st.state === 'built' ? 'lands-badge-done'
      : st.state === 'building' ? 'lands-badge-progress'
      : isLocked ? 'lands-badge-locked'
      : 'lands-badge-empty';
    const btn = document.createElement('button');
    btn.className = 'lands-building' + (isLocked ? ' lands-building-locked' : '');
    btn.style.right = (b.x ?? 50) + '%';
    btn.style.top = (b.y ?? 50) + '%';
    btn.dataset.id = b.id;
    const iconDisplay = isLocked ? '🔒' : (b.icon || '🏗️');
    const bgColor = st.state === 'built' ? '#2e7d32'
      : st.state === 'building' ? '#f57f17'
      : isLocked ? '#1a1a2e'
      : '#2a2a4e';
    btn.innerHTML = `
      <div class="lands-building-pad">
        <div class="lands-building-icon-wrap" style="background:${bgColor}">
          <span class="lands-building-icon-fallback">${iconDisplay}</span>
          ${isLocked ? '' : `<img src="${imgSrc}" alt="${b.name}" width="56" height="56" loading="lazy" onerror="this.style.display='none'">`}
        </div>
        <span class="lands-state-badge ${badgeClass}">${badgeText}</span>
      </div>
      <div class="lands-building-name">${b.name}</div>
    `;
    btn.addEventListener('click', () => this._onLandsBuildingClick(b.id));
    container.appendChild(btn);
  }
};

GameUI.prototype._onLandsBuildingClick = function(id) {
  if (!this.village) return;
  const b = this.village.buildings.find(x => x.id === id);
  if (!b) return;
  const st = this._landsState[id];
  if (st.state === 'locked') {
    const village = this.village.currentVillage;
    if (village && this.economy.level < village.levelRequired) {
      this._landsToast(b.name + ' • مقفل' + ` (يتطلب المستوى ${village.levelRequired})`);
      return;
    }
    // فتح المبنى: يتطلب محاربة الوحش وتكلفة البناء
    this.showBuildingModal(b, this._landsBuildingCard(id));
    return;
  }
  if (st.state === 'empty') {
    this.showBuildingModal(b, this._landsBuildingCard(id));
  } else if (st.state === 'building') {
    // إنهاء البناء الفوري (لأغراض العرض التوضيحي) — يمكن إزالته لاحقاً
    st.state = 'built';
    b.state = 'ready';
    b.level = Math.max(1, b.level);
    this._landsProgress++;
    this._landsToast('تم البناء: ' + b.name);
    this._updateLandsProgress();
    this._renderLandsBuildings();
    this._openLandsUpgradeModal(id);
  } else if (st.state === 'built') {
    this._openLandsUpgradeModal(id);
  }
};

GameUI.prototype._landsBuildingCard = function(id) {
  const container = document.getElementById('lands-buildings');
  if (!container) return null;
  return Array.from(container.children).find(el => el.dataset.id === id) || null;
};

GameUI.prototype._updateLandsProgress = function() {};

GameUI.prototype.checkBuildingUnlocks = function() {
  if (!this.village) return;
  // في النظام الجديد، المباني تُبنى تدريجياً ضمن القرية الحالية
  // نتحقق فقط من إمكانية الانتقال للقرية التالية
  if (this.village.isVillageComplete() && this.village.canMoveToNext()) {
    this.showNotification(`🎉 اكتملت قرية ${this.village.currentVillage.name}! يمكنك الانتقال للقرية التالية.`);
  }
};

GameUI.prototype._openLandsUpgradeModal = function(id) {
  if (!this.village) return;
  const b = this.village.buildings.find(x => x.id === id);
  if (!b) return;
  const st = this._landsState[id];
  if (st.state !== 'built') return;
  const overlay = document.getElementById('lands-modal');
  const imgEl = document.getElementById('lands-modal-img');
  const nameEl = document.getElementById('lands-modal-name');
  const levelEl = document.getElementById('lands-modal-level');
  const costEl = document.getElementById('lands-modal-cost');
  if (!overlay) return;
  const imgSet = b.img || { built: '' };
  if (imgEl) imgEl.src = imgSet.built;
  if (nameEl) nameEl.textContent = b.name;
  if (levelEl) levelEl.textContent = 'المستوى ' + st.level;
  const cost = b.currentUpgradeCost;
  const costText = Object.entries(cost).map(([res, amt]) => {
    const icons = { gold: '🪙', cash: '💵', gems: '💎', hammers: '🔨', scrolls: '📜', food: '🌾' };
    return `${icons[res] || '•'} ${amt}`;
  }).join(' + ');
  if (costEl) costEl.textContent = 'تكلفة الترقية: ' + costText;
  overlay.classList.remove('hidden');
  const upgradeBtn = document.getElementById('lands-modal-upgrade');
  const closeBtn = document.getElementById('lands-modal-close');
  if (upgradeBtn) {
    upgradeBtn.onclick = null;
    upgradeBtn.onclick = () => {
      if (b.canUpgrade(this.economy)) {
        b.upgrade(this.economy);
        st.level = b.level;
        this._landsToast('تمت الترقية إلى المستوى ' + b.level);
        if (levelEl) levelEl.textContent = 'المستوى ' + b.level;
        const newCost = b.currentUpgradeCost;
        const newCostText = Object.entries(newCost).map(([res, amt]) => {
          const icons = { gold: '🪙', cash: '💵', gems: '💎', hammers: '🔨', scrolls: '📜', food: '🌾' };
          return `${icons[res] || '•'} ${amt}`;
        }).join(' + ');
        if (costEl) costEl.textContent = 'تكلفة الترقية: ' + newCostText;
        this.updateTopBar();
      } else {
        this._landsToast('موارد غير كافية');
      }
    };
  }
  if (closeBtn) {
    closeBtn.onclick = null;
    closeBtn.onclick = () => overlay.classList.add('hidden');
  }
  overlay.onclick = (e) => { if (e.target === overlay) overlay.classList.add('hidden'); };
};

GameUI.prototype._landsToast = function(msg) {
  const el = document.getElementById('lands-toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.add('hidden'), 1600);
};

GameUI.prototype.renderWar = function() {
  const modes = ['oasis', 'adventure', 'campaign'];
  const selectMode = (mode) => {
    for (const m of modes) {
      const btn = document.querySelector(`.war-mode-btn[data-mode="${m}"]`);
      const detail = document.getElementById(`war-detail-${m}`);
      if (btn) btn.classList.toggle('war-mode-active', m === mode);
      if (detail) detail.classList.toggle('hidden', m !== mode);
    }
  };
  for (const m of modes) {
    const btn = document.querySelector(`.war-mode-btn[data-mode="${m}"]`);
    if (btn) {
      btn.addEventListener('click', () => selectMode(m));
    }
  }
  selectMode('oasis');
  const oasisBtn = document.getElementById("war-start-oasis");
  const adventureBtn = document.getElementById("war-start-adventure");
  const campaignBtn = document.getElementById("war-start-campaign");
  if (oasisBtn) oasisBtn.addEventListener('click', () => this.enterArena());
  if (adventureBtn) adventureBtn.addEventListener('click', () => this.enterAdventure());
  if (campaignBtn) campaignBtn.addEventListener('click', () => this.enterCampaign());
};

GameUI.prototype.enterArena = function() {
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
  if (this.world) this.world._pvpDisabled = false;
  this.world.enterWorldMap();
  this.showNotification("🌴 واحة الغنائم — قاتل اللاعبين واجمع الغنائم!");
};

GameUI.prototype.enterAdventure = function() {
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
  if (this.world) {
    this.world._pvpDisabled = true;
    this.world._campaignMode = false;
    this.world.enterWorldMap();
  }
  this.showNotification("🐍 مغامرة الصحراء — قاتل الوحوش واجمع الغنائم! (PvP معطّل)");
};

GameUI.prototype.enterCampaign = function() {
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
  if (this.world) {
    this.world._pvpDisabled = true;
    this.world._campaignMode = true;
    const storyManager = window._storyManager;
    const villageId = this.village?.currentVillageId || "wadi";
    const chapter = storyManager?.currentChapterData;
    const includeBoss = storyManager?.canCompleteChapter() || false;
    this.world.spawnCampaignMonsters(villageId, includeBoss);
    this.world.enterWorldMap();
    const objective = chapter ? chapter.title : "حملة الأبطال";
    this.showNotification(`🗺️ ${objective} — اقضِ على وحوش ${this.village?.currentVillage?.name || "القرية"}!`);
  }
};

GameUI.prototype.getBuildingIcon = function(b) {
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
};

GameUI.prototype.showBuildingModal = function(b, cardEl) {
  const overlay = document.getElementById("modal-overlay");
  const card = document.getElementById("modal-card");
  if (!overlay || !card) return;
  const diff = this.village.getMonsterDifficulty(b.currentMonsterPower);
  const playerPower = this.economy.power || 0;
  const canFight = playerPower >= b.currentMonsterPower;
  const canAffordCost = b.canAfford(this.economy);
  const costText = Object.entries(b.cost).map(([res, amt]) => {
    const icons = { gold: '🪙', cash: '💵', gems: '💎', hammers: '🔨', scrolls: '📜', food: '🌾' };
    return `${icons[res] || '•'} ${amt}`;
  }).join(' + ');
  const productionText = Object.entries(b.productionRate).map(([res, amt]) => {
    const icons = { gold: '🪙', cash: '💵', gems: '💎', hammers: '🔨', scrolls: '📜', food: '🌾' };
    return `${icons[res] || '•'} ${amt}/ث`;
  }).join(' + ');
  card.innerHTML = `
    <div class="flex items-center justify-between mb-3">
      <h3 class="font-bold text-base" style="color:var(--accent-red);font-family:'Cairo',sans-serif">${b.name}</h3>
      <button id="modal-close-btn" class="text-xl leading-none" style="color:var(--text-secondary);background:none;border:none;cursor:pointer;font-family:inherit">&times;</button>
    </div>
    <div class="flex flex-col items-center gap-3">
      <div class="w-20 h-20 rounded-xl flex items-center justify-center text-4xl" style="background:var(--bg-input);border:1px solid var(--border-light)">
        👹
      </div>
      <p style="color:var(--text-secondary);font-size:0.85rem;text-align:center">${b.description}</p>
      <div class="w-full rounded-lg p-3 space-y-2" style="background:var(--bg-card);border:1px solid var(--border-light)">
        <div class="flex justify-between text-sm">
          <span style="color:var(--text-secondary)">👹 ${b.monsterName}</span>
          <span style="color:var(--accent-red);font-weight:bold">⚔️ ${b.currentMonsterPower.toFixed(0)}</span>
        </div>
        <div class="flex justify-between text-sm">
          <span style="color:var(--text-secondary)">📊 الصعوبة</span>
          <span style="color:#e67e22;font-weight:bold">${diff}</span>
        </div>
        <div class="flex justify-between text-sm">
          <span style="color:var(--text-secondary)">⏱️ وقت البناء</span>
          <span style="color:var(--accent-red);font-weight:bold">${b.constructDuration}ث</span>
        </div>
        <div class="flex justify-between text-sm">
          <span style="color:var(--text-secondary)">🪙 الإنتاج</span>
          <span style="color:#2ecc71;font-weight:bold">${productionText}</span>
        </div>
        <div class="flex justify-between text-sm">
          <span style="color:var(--text-secondary)">💰 تكلفة البناء</span>
          <span style="color:${canAffordCost ? '#2ecc71' : 'var(--accent-red)'};font-weight:bold">${costText}</span>
        </div>
        <div class="flex justify-between text-sm">
          <span style="color:var(--text-secondary)">👊 قوتك</span>
          <span class="font-bold" style="color:${canFight ? '#2ecc71' : 'var(--accent-red)'}">${playerPower.toFixed(0)}</span>
        </div>
      </div>
      <button id="modal-action-btn" class="w-full py-3 rounded-xl font-bold text-base transition-transform active:scale-95" style="background:${canFight && canAffordCost ? 'var(--accent-red)' : 'var(--text-muted)'};color:#fff;border:none;cursor:pointer;font-family:inherit">
        ${!canAffordCost ? `💰 تحتاج ${costText}` : canFight ? `⚔️ مقاتلة ${b.monsterName}` : `💥 قوة غير كافية (تحتاج ${b.currentMonsterPower.toFixed(0)})`}
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
  if (actionBtn && canFight && canAffordCost) {
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
};

GameUI.prototype._renderWeaponUpgradeModal = function() {
  const overlay = document.getElementById("modal-overlay");
  const card = document.getElementById("modal-card");
  if (!overlay || !card) return;
  const houseLevel = this._landsState?.['b1']?.level || 1;
  const weapons = this.army?.weapons || [];
  card.innerHTML = `
    <div class="flex items-center justify-between mb-3">
      <h3 class="font-bold text-base" style="color:var(--accent-red);font-family:'Cairo',sans-serif">🗡️ مستودع السلاح</h3>
      <button id="modal-close-btn" style="color:var(--text-secondary);background:none;border:none;cursor:pointer;font-family:inherit;font-size:1.2rem">&times;</button>
    </div>
    <div class="flex flex-col gap-2" style="max-height:60vh;overflow-y:auto">
      <div style="color:var(--text-secondary);font-size:0.65rem;text-align:center;margin-bottom:6px">🏠 بيت الزعيم المستوى ${houseLevel} — السلاح يتطلب مستوى معين لفتحه</div>
      ${weapons.map(w => {
        const canUpg = w.canUpgrade(this.economy, houseLevel);
        const starStr = '⭐'.repeat(w.level) + '☆'.repeat(w.maxLevel - w.level);
        const isLocked = houseLevel < w.requireLevel;
        return `<div style="background:var(--bg-card);border:1px solid var(--border-light);border-radius:10px;padding:8px 10px;display:flex;align-items:center;gap:6px">
          <div style="flex:1">
            <div style="font-size:0.75rem;font-weight:700;color:${isLocked ? 'var(--text-muted)' : 'var(--text-primary)'}">${isLocked ? '🔒 ' : ''}${w.name}</div>
            <div style="font-size:0.55rem;color:var(--text-secondary)">${w.desc}</div>
            <div style="font-size:0.6rem;color:var(--accent-red)">${starStr}</div>
          </div>
          <div style="text-align:center;min-width:50px">
            <div style="font-size:0.6rem;color:var(--accent-red)">👊 ${w.power.toFixed(0)}</div>
          </div>
          ${isLocked ? `<div style="font-size:0.5rem;color:var(--text-muted)">تحتاج\nمستوى ${w.requireLevel}</div>` :
          w.level >= w.maxLevel ? `<div style="font-size:0.55rem;color:var(--accent-red)">⭐⭐⭐</div>` :
          `<button class="weapon-upg-btn" data-wid="${w.id}" style="padding:6px 12px;font-size:0.6rem;font-weight:700;background:${canUpg ? 'var(--accent-red)' : '#999'};color:#fff;border:none;border-radius:8px;cursor:${canUpg ? 'pointer' : 'default'};font-family:inherit" ${canUpg ? '' : 'disabled'}>
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
};

GameUI.prototype._renderTrainingGroundModal = function() {
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
      <h3 class="font-bold text-base" style="color:var(--accent-red);font-family:'Cairo',sans-serif">🏋️ ساحة التدريب</h3>
      <button id="modal-close-btn" style="color:var(--text-secondary);background:none;border:none;cursor:pointer;font-family:inherit;font-size:1.2rem">&times;</button>
    </div>
    <div class="flex flex-col gap-2">
      <div style="background:var(--bg-card);border:1px solid var(--border-light);border-radius:10px;padding:10px">
        <div style="display:flex;justify-content:space-between;font-size:0.7rem;padding:3px 0;border-bottom:1px solid var(--border-light)">
          <span style="color:var(--text-secondary)">🎖️ مستوى الجندي</span>
          <span style="color:var(--accent-red);font-weight:700">${army.unitLevel}</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:0.7rem;padding:3px 0;border-bottom:1px solid var(--border-light)">
          <span style="color:var(--text-secondary)">👊 قوة الجندي</span>
          <span style="color:var(--accent-red);font-weight:700">${army.unitPower.toFixed(0)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:0.7rem;padding:3px 0;border-bottom:1px solid var(--border-light)">
          <span style="color:var(--text-secondary)">📊 مستوى التدريب</span>
          <span style="color:var(--accent-red);font-weight:700">${army.trainingLevel}/${army.maxTrainingLevel}</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:0.7rem;padding:3px 0;border-bottom:1px solid var(--border-light)">
          <span style="color:var(--text-secondary)">🛏️ سكن الجنود</span>
          <span style="color:var(--accent-red);font-weight:700">المستوى ${barLevel}</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:0.7rem;padding:3px 0">
          <span style="color:var(--text-secondary)">👥 أقصى عدد جنود</span>
          <span style="color:#2ecc71;font-weight:700">${maxUnits}</span>
        </div>
      </div>
      <button id="train-units-btn" style="padding:10px;font-size:0.75rem;font-weight:700;background:var(--accent-red);color:#fff;border:none;border-radius:10px;cursor:pointer;font-family:inherit">
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
};

GameUI.prototype.showUpgradeModal = function(b) {
  if (b.name === "مستودع السلاح") {
    this._renderWeaponUpgradeModal();
    return;
  }
  if (b.name === "ساحة التدريب") {
    this._renderTrainingGroundModal();
    return;
  }
  const overlay = document.getElementById("modal-overlay");
  const card = document.getElementById("modal-card");
  if (!overlay || !card) return;
  const isMax = b.level >= b.maxLevel;
  const currentRate = b.productionRate;
  const nextRate = {};
  for (const [res, base] of Object.entries(b.production)) {
    nextRate[res] = Math.floor(base * (1 + (b.level + 1) * 0.1));
  }
  const upgradeCost = b.currentUpgradeCost;
  const costEntries = Object.entries(upgradeCost);
  const canAfford = this.economy ? costEntries.every(([res, amt]) => this.economy.canAfford(res, amt)) : false;
  const costStr = costEntries.map(([res, amt]) => {
    const icons = { gold: '🪙', cash: '💵', gems: '💎', hammers: '🔨', scrolls: '📜', food: '🌾' };
    return `${icons[res] || '•'} ${amt}`;
  }).join(' + ');
  const rateStr = Object.entries(currentRate).map(([res, amt]) => {
    const icons = { gold: '🪙', cash: '💵', gems: '💎', hammers: '🔨', scrolls: '📜', food: '🌾' };
    return `${icons[res] || '•'} ${amt}`;
  }).join(' + ');
  const nextRateStr = Object.entries(nextRate).map(([res, amt]) => {
    const icons = { gold: '🪙', cash: '💵', gems: '💎', hammers: '🔨', scrolls: '📜', food: '🌾' };
    return `${icons[res] || '•'} ${amt}`;
  }).join(' + ');
  card.innerHTML = `
    <div class="flex items-center justify-between mb-3">
      <h3 class="font-bold text-base" style="color:var(--accent-red);font-family:'Cairo',sans-serif">${b.name}</h3>
      <button id="modal-close-btn" style="color:var(--text-secondary);background:none;border:none;cursor:pointer;font-family:inherit;font-size:1.2rem">&times;</button>
    </div>
    <div class="flex flex-col items-center gap-3">
      <div class="w-20 h-20 rounded-xl flex items-center justify-center text-4xl" style="background:var(--bg-input);border:1px solid var(--border-light)">
        🏠
      </div>
      <div class="rounded-lg px-3 py-1" style="background:var(--bg-card);border:1px solid var(--border-light)">
        <span style="color:var(--accent-red);font-weight:bold;font-size:0.85rem">LV ${b.level}</span>
      </div>
      <div class="w-full rounded-lg p-3 space-y-2" style="background:var(--bg-card);border:1px solid var(--border-light)">
        <div class="flex justify-between text-sm">
          <span style="color:var(--text-secondary)">🪙 الإنتاج الحالي</span>
          <span style="color:#2ecc71;font-weight:bold">${rateStr}/ث</span>
        </div>
        ${!isMax ? `
        <div class="flex justify-between text-sm">
          <span style="color:var(--text-secondary)">⬆️ بعد الترقية</span>
          <span style="color:var(--accent-red);font-weight:bold">${nextRateStr}/ث</span>
        </div>
        <div class="flex justify-between text-sm">
          <span style="color:var(--text-secondary)">💵 التكلفة</span>
          <span class="font-bold" style="color:${canAfford ? '#2ecc71' : 'var(--accent-red)'}">${costStr}</span>
        </div>` : ''}
      </div>
      ${!isMax ? `
      <button id="modal-action-btn" class="w-full py-3 rounded-xl font-bold text-base transition-transform active:scale-95" style="background:${canAfford ? 'var(--accent-red)' : 'var(--text-muted)'};color:#fff;border:none;cursor:${canAfford ? 'pointer' : 'default'};font-family:inherit" ${canAfford ? '' : 'disabled'}>
        ▲ ترقية (${costStr})
      </button>` : `
      <div style="color:var(--accent-red);font-weight:bold;font-size:0.85rem;padding:8px 0">⭐⭐⭐ المستوى الأقصى</div>`}
    </div>
  `;
  overlay.classList.remove("hidden");
  document.body.classList.add("modal-open");
  document.getElementById("modal-close-btn").onclick = () => {
    overlay.classList.add("hidden");
    document.body.classList.remove("modal-open");
  };
  const actionBtn = document.getElementById("modal-action-btn");
  if (actionBtn && canAfford) {
    actionBtn.onclick = () => {
      if (this.village.upgradeBuilding(b)) {
        this.renderPromotion();
        this.updateTopBar();
        if (this._onSave) this._onSave();
        overlay.classList.add("hidden");
        document.body.classList.remove("modal-open");
        this._landsToast('تمت الترقية: ' + b.name);
      }
    };
  }
  overlay.onclick = (e) => {
    if (e.target === overlay) {
      overlay.classList.add("hidden");
      document.body.classList.remove("modal-open");
    }
  };
};

GameUI.prototype.startBuildingTimerLoop = function() {
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
};

GameUI.prototype.doFight = function(b, card) {
  const playerPower = this.economy.power;
  if (!b.canAfford(this.economy)) {
    this.showFloatingText(card, "💰 موارد غير كافية!", "#ff9500");
    return;
  }
  const won = b.fight(playerPower, this.economy);
  if (!won) {
    this.showFloatingText(card, "💥 غير كافٍ! قوّ جيشك", "#ff4444");
    return;
  }
  // تحديث حالة الأراضي الداخلية لتطابق حالة المبنى
  if (this._landsState && this._landsState[b.id]) {
    this._landsState[b.id].state = 'building';
  }
  this.showFloatingText(card, "⚔️ انتصرت! 🎉", "#4cd964");
  this.economy.addXp(50);
  this.renderPromotion();
  this.updateTopBar();
  this._renderLandsBuildings();
};

GameUI.prototype.showFloatingText = function(parent, text, color) {
  const el = document.createElement("div");
  el.className = "floating-fight-text";
  el.textContent = text;
  el.style.color = color;
  parent.appendChild(el);
  setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 1500);
};

}
