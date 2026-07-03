import { formatNumber } from "../economy.js";

export function injectGameplayMethods(GameUI) {

GameUI.prototype.buildRankingScreen = function() {
  const div = document.createElement("div");
  div.className = "screen-panel";
  div.innerHTML = `<div class="panel-header">🏆 قمة المجد</div><div id="ranking-list"></div>`;
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
};

GameUI.prototype.renderRanking = function() {
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
  this._landsState = {};
  for (const b of L.buildings) {
    this._landsState[b.id] = { state: 'empty', level: b.level };
  }
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
  const bgEl = document.getElementById('lands-bg');
  if (bgEl) bgEl.style.backgroundImage = `url('${L.bg}')`;
  this._renderLandsBuildings();
};

GameUI.prototype._renderLandsBuildings = function() {
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
};

GameUI.prototype._onLandsBuildingClick = function(id) {
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
};

GameUI.prototype._updateLandsProgress = function() {};

GameUI.prototype._openLandsUpgradeModal = function(id) {
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
  this.world.enterWorldMap();
};

GameUI.prototype.enterAdventure = function() {
  this.enterArena();
};

GameUI.prototype.enterCampaign = function() {
  this.enterArena();
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
  card.innerHTML = `
    <div class="flex items-center justify-between mb-3">
      <h3 class="font-bold text-base" style="color:var(--accent-red);font-family:'Cairo',sans-serif">${b.name}</h3>
      <button id="modal-close-btn" class="text-xl leading-none" style="color:var(--text-secondary);background:none;border:none;cursor:pointer;font-family:inherit">&times;</button>
    </div>
    <div class="flex flex-col items-center gap-3">
      <div class="w-20 h-20 rounded-xl flex items-center justify-center text-4xl" style="background:var(--bg-input);border:1px solid var(--border-light)">
        👹
      </div>
      <p style="color:var(--text-secondary);font-size:0.85rem;text-align:center">${b.desc}</p>
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
          <span style="color:var(--accent-red);font-weight:bold">${b.buildTime}ث</span>
        </div>
        <div class="flex justify-between text-sm">
          <span style="color:var(--text-secondary)">🪙 الإنتاج</span>
          <span style="color:#2ecc71;font-weight:bold">${b.baseProduction}/ث</span>
        </div>
        <div class="flex justify-between text-sm">
          <span style="color:var(--text-secondary)">👊 قوتك</span>
          <span class="font-bold" style="color:${canFight ? '#2ecc71' : 'var(--accent-red)'}">${playerPower.toFixed(0)}</span>
        </div>
      </div>
      <button id="modal-action-btn" class="w-full py-3 rounded-xl font-bold text-base transition-transform active:scale-95" style="background:var(--accent-red);color:#fff;border:none;cursor:pointer;font-family:inherit">
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
  const canAfford = this.economy ? this.economy.canAfford('cash', b.upgradeCost) : false;
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
          <span style="color:#2ecc71;font-weight:bold">${b.productionRate.toFixed(1)}/ث</span>
        </div>
        ${!isMax ? `
        <div class="flex justify-between text-sm">
          <span style="color:var(--text-secondary)">⬆️ بعد الترقية</span>
          <span style="color:var(--accent-red);font-weight:bold">${(b.productionRate + b.baseProduction * 0.1).toFixed(1)}/ث</span>
        </div>
        <div class="flex justify-between text-sm">
          <span style="color:var(--text-secondary)">💵 التكلفة</span>
          <span class="font-bold" style="color:${canAfford ? '#2ecc71' : 'var(--accent-red)'}">${b.upgradeCost}</span>
        </div>` : ''}
      </div>
      ${!isMax ? `
      <button id="modal-action-btn" class="w-full py-3 rounded-xl font-bold text-base transition-transform active:scale-95" style="background:var(--accent-red);color:#fff;border:none;cursor:pointer;font-family:inherit">
        ▲ ترقية (${b.upgradeCost} 💵)
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
  const won = b.fight(playerPower);
  if (!won) {
    this.showFloatingText(card, "💥 غير كافٍ! قوّ جيشك", "#ff4444");
    return;
  }
  this.showFloatingText(card, "⚔️ انتصرت! 🎉", "#4cd964");
  this.economy.addXp(50);
  this.renderPromotion();
  this.updateTopBar();
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
