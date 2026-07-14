import { formatNumber } from "../economy.js";
import { ITEM_DEFS } from "../inventory.js";

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
      <button class="war-mode-btn" id="extraction-enter-btn" data-mode="extraction">
        <div class="war-mode-icon">🪙</div>
        <div class="war-mode-name">استخراج</div>
        <div class="war-mode-desc">PvE — جمع الذهب والتسليم</div>
      </button>
      <button class="war-mode-btn" id="horde-enter-btn" data-mode="horde">
        <div class="war-mode-icon">🌊</div>
        <div class="war-mode-name">حشد</div>
        <div class="war-mode-desc">PvE — موجات متصاعدة</div>
      </button>
      <button class="war-mode-btn" id="cave-enter-btn" data-mode="cave">
        <div class="war-mode-icon">🕯️</div>
        <div class="war-mode-name">كهف</div>
        <div class="war-mode-desc">PvE — استكشاف وظلام</div>
      </button>
    </div>
    <div class="war-mode-details" id="war-mode-details">
      <div class="war-detail-card" id="war-detail-extraction">
        <div class="war-detail-header">
          <span class="war-detail-icon">🪙</span>
          <span class="war-detail-title">استخراج الذهب</span>
        </div>
        <div class="war-detail-body">
          <p>وحوش في الصحراء — اذبحها واجمع الذهب المتساقط. كلما حملت أكثر، تباطأت أكثر! سلم الذهب في نقطة التسليم قبل فوات الوقت.</p>
          <div class="war-detail-stats">
            <div class="war-stat"><span class="war-stat-icon">⚔️</span><span class="war-stat-label">نوع القتال</span><span class="war-stat-value">PvE</span></div>
            <div class="war-stat"><span class="war-stat-icon">🎒</span><span class="war-stat-label">الحقيبة</span><span class="war-stat-value">تتثقل بالذهب</span></div>
            <div class="war-stat"><span class="war-stat-icon">📍</span><span class="war-stat-label">التسليم</span><span class="war-stat-value">نقطة في الخريطة</span></div>
          </div>
          <button class="war-start-btn" id="war-start-extraction">🪙 ابدأ الاستخراج</button>
        </div>
      </div>
      <div class="war-detail-card hidden" id="war-detail-horde">
        <div class="war-detail-header">
          <span class="war-detail-icon">🌊</span>
          <span class="war-detail-title">حشد الأعداء</span>
        </div>
        <div class="war-detail-body">
          <p>موجات متصاعدة من الوحوش — كل موجة أعداد وقوة أكبر من سابقتها. اصمد حتى الموجة 20 لتحقيق النصر!</p>
          <div class="war-detail-stats">
            <div class="war-stat"><span class="war-stat-icon">⚔️</span><span class="war-stat-label">نوع القتال</span><span class="war-stat-value">PvE (حشد)</span></div>
            <div class="war-stat"><span class="war-stat-icon">📈</span><span class="war-stat-label">التصعيد</span><span class="war-stat-value">قوة وعدد متزايدان</span></div>
            <div class="war-stat"><span class="war-stat-icon">🏆</span><span class="war-stat-label">الفوز</span><span class="war-stat-value">الصمود حتى الموجة 20</span></div>
          </div>
          <button class="war-start-btn" id="war-start-horde">🌊 ابدأ الحشد</button>
        </div>
      </div>
      <div class="war-detail-card hidden" id="war-detail-cave">
        <div class="war-detail-header">
          <span class="war-detail-icon">🕯️</span>
          <span class="war-detail-title">استكشاف الكهف</span>
        </div>
        <div class="war-detail-body">
          <p>ادخل الكهف المظلم — أرضية سوداء وبراكين ووحوش نارية. استكشف الأنفاق واجمع الكنوز النادرة!</p>
          <div class="war-detail-stats">
            <div class="war-stat"><span class="war-stat-icon">⚔️</span><span class="war-stat-label">نوع القتال</span><span class="war-stat-value">PvE (كهف)</span></div>
            <div class="war-stat"><span class="war-stat-icon">🌋</span><span class="war-stat-label">البيئة</span><span class="war-stat-value">ظلام + حمم</span></div>
            <div class="war-stat"><span class="war-stat-icon">💎</span><span class="war-stat-label">الكنوز</span><span class="war-stat-value">أشياء نادرة</span></div>
          </div>
          <button class="war-start-btn" id="war-start-cave">🕯️ ادخل الكهف</button>
        </div>
      </div>
      <div id="war-tribal-section" class="war-tribal-section">
        <div class="panel-header" style="margin-top:16px;font-size:0.9rem">⚜️ ساحات الحرب القبلية</div>
        <div id="war-tribal-content"></div>
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

  const bg = villageData.bg || (typeof ImageResolver !== 'undefined' ? ImageResolver.src('landsBg') : 'assets/images/bg-village.jpg');
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
  if (this._warListenersAttached) return;
  this._warListenersAttached = true;
  const modes = ['extraction', 'horde', 'cave'];
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
  selectMode('extraction');
  const extractionBtn = document.getElementById("war-start-extraction");
  const hordeBtn = document.getElementById("war-start-horde");
  const caveBtn = document.getElementById("war-start-cave");
  if (extractionBtn) extractionBtn.addEventListener('click', () => this.enterExtraction());
  if (hordeBtn) hordeBtn.addEventListener('click', () => this.enterHorde());
  if (caveBtn) caveBtn.addEventListener('click', () => this.enterCave());

  // ==================== ⚜️ قسم الحرب القبلية ====================
  this._renderTribalWarSection();
};

GameUI.prototype._renderTribalWarSection = function() {
  const container = document.getElementById("war-tribal-content");
  if (!container) return;
  const wm = this.warManager;
  if (!wm) {
    container.innerHTML = `<div style="text-align:center;padding:12px;color:var(--text-muted);font-size:0.8rem">⚠️ نظام الحرب القبلي غير متاح</div>`;
    return;
  }

  // حالة التحالف
  const am = this.allianceManager;
  if (!am || am.level === 0) {
    container.innerHTML = `
      <div class="tribal-war-card tribal-locked">
        <div class="tribal-war-icon">🏜️</div>
        <div class="tribal-war-text">
          <div class="tribal-war-title">تحالفك غير نشط</div>
          <div class="tribal-war-desc">ارقَ تحالفك أولاً للانضمام إلى الحروب القبلية</div>
        </div>
      </div>
    `;
    return;
  }

  const myPower = this.army ? this.army.totalArmyPower : 0;
  let html = `
    <div class="tribal-war-status">
      <div class="tribal-war-stat">
        <span class="tribal-stat-label">عشيرتك</span>
        <span class="tribal-stat-value">${am.tierName}</span>
      </div>
      <div class="tribal-war-stat">
        <span class="tribal-stat-label">قوة جيشك</span>
        <span class="tribal-stat-value">${this._fmt(myPower)}</span>
      </div>
      <div class="tribal-war-stat">
        <span class="tribal-stat-label">مستوى التحالف</span>
        <span class="tribal-stat-value">${am.level}/${am.maxLevel}</span>
      </div>
    </div>
  `;

  // الحروب الجارية
  const wars = wm.activeWars || [];
  if (wars.length === 0) {
    html += `<div class="tribal-war-empty">⚔️ لا توجد حروب قبلية نشطة حالياً</div>`;
  } else {
    html += `<div class="tribal-war-list">`;
    for (const war of wars) {
      const mySide = wm.getMySide(war);
      const timeLeft = Math.max(0, Math.floor((war.endsAt - Date.now()) / 1000));
      const mins = Math.floor(timeLeft / 60);
      const secs = timeLeft % 60;
      html += `
        <div class="tribal-war-card ${mySide === 'attacker' ? 'war-attacker' : mySide === 'defender' ? 'war-defender' : 'war-observer'}">
          <div class="tribal-war-header">
            <span class="war-tribe-name">${war.attacker}</span>
            <span class="war-vs">⚔️</span>
            <span class="war-tribe-name">${war.defender}</span>
          </div>
          <div class="tribal-war-scores">
            <span class="war-score">${war.attackerScore} نقطة</span>
            <span class="war-timer">⏱️ ${mins}:${secs.toString().padStart(2, '0')}</span>
            <span class="war-score">${war.defenderScore} نقطة</span>
          </div>
          <div class="tribal-war-loot">
            🪙 غنائم ${war.attacker}: ${war.attackerLoot || 0} | 🪙 غنائم ${war.defender}: ${war.defenderLoot || 0}
          </div>
          ${mySide ? `<button class="tribal-war-action-btn" data-war-id="${war.id}" data-side="${mySide}">🗡️ أرسل جيشك للحرب</button>` : ''}
        </div>
      `;
    }
    html += `</div>`;
  }

  // زر إعلان الحرب
  html += `
    <div class="tribal-war-declare-section" style="margin-top:12px">
      <button class="action-btn tribal-war-declare-btn" id="tribal-war-declare-btn">🗡️ أعلن الغزوة على قبيلة</button>
    </div>
  `;

  // الترتيب القبلي
  const rankings = wm.rankings || [];
  if (rankings.length > 0) {
    html += `<div class="panel-header" style="margin-top:12px;font-size:0.85rem">🏆 ترتيب القبائل</div>`;
    html += `<div class="tribal-rankings">`;
    rankings.slice(0, 10).forEach((r, i) => {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
      html += `
        <div class="tribal-ranking-row">
          <span class="tribal-rank-medal">${medal}</span>
          <span class="tribal-rank-name">${r.name}</span>
          <span class="tribal-rank-stats">🔥 ${r.wins} | 💔 ${r.losses} | 🪙 ${r.totalLoot}</span>
        </div>
      `;
    });
    html += `</div>`;
  }

  container.innerHTML = html;

  // ربط زر إعلان الحرب
  const declareBtn = container.querySelector('.tribal-war-declare-btn');
  if (declareBtn) {
    declareBtn.addEventListener('click', () => this._showWarDeclareModal());
  }

  // أزرار إرسال الجيش للحروب الجارية
  container.querySelectorAll('.tribal-war-action-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const warId = btn.dataset.warId;
      const side  = btn.dataset.side;
      const armyPower = this.army ? this.army.totalArmyPower : 0;
      if (wm.deployArmy(warId, 1, armyPower, side)) {
        if (this.world && this.world.store) {
          this.world.store.set('notification', { text: `🗡️ أرسلت جيشك بقوة ${this._fmt(armyPower)} للحرب القبلية!`, t: Date.now() });
        }
        wm.requestActiveWars();
      }
    });
  });
};

GameUI.prototype._renderTribalAllianceSection = function() {
  const container = document.getElementById("alliance-tribal-content");
  if (!container) return;
  const am = this.allianceManager;
  if (!am || !am.tribeName) {
    container.style.display = "none";
    return;
  }
  container.style.display = "";
  const state = am.getState();
  const myRank = state.myRank;
  const isShaykh = myRank && myRank.id === "shaykh";
  const myName = this.playerName || "???";

  let html = `
    <div class="tribal-alliance-header">
      <span class="tribal-alliance-banner">${state.tribeBanner || "🏕️"}</span>
      <span class="tribal-alliance-name">${state.tribeName}</span>
    </div>
  `;

  // شريط معلومات القبيلة
  html += `
    <div class="tribal-alliance-info">
      <div class="tribal-info-item">👥 الأعضاء <strong>${state.memberCount}</strong></div>
      <div class="tribal-info-item">🔥 قوة القبيلة <strong>${this._fmt(state.tribePower)}</strong></div>
      <div class="tribal-info-item">🪙 الخزينة <strong>${this._fmt(state.treasury)}</strong></div>
    </div>
  `;

  // صندوق الخزينة — مساهمة
  html += `
    <div class="tribal-treasury-box">
      <div class="tribal-treasury-bar-track">
        <div class="tribal-treasury-bar-fill" style="width:${Math.min(100, (state.treasury / 5000) * 100)}%"></div>
      </div>
      <div class="tribal-treasury-row">
        <input type="number" id="tribal-contribute-input" value="100" min="1" class="tribal-input" />
        <button id="tribal-contribute-btn" class="action-btn" style="padding:4px 12px">💰 ساهم</button>
        ${isShaykh ? `<button id="tribal-upgrade-from-treasury-btn" class="action-btn upgrade-btn" style="padding:4px 12px;margin-right:4px">▲ ترقية من الخزينة</button>` : ""}
      </div>
    </div>
  `;

  // قائمة الأعضاء
  html += `<div class="panel-header" style="margin-top:10px;font-size:0.85rem">👥 أعضاء القبيلة</div>`;
  html += `<div class="tribal-members-list">`;
  for (const m of state.members) {
    const rankInfo = am.getRank(m.rank);
    const rankIcon = rankInfo ? rankInfo.icon : "🏜️";
    const rankName = rankInfo ? rankInfo.name : m.rank;
    const canPromote = isShaykh && m.name !== myName;
    html += `
      <div class="tribal-member-row">
        <span class="tribal-member-rank-icon">${rankIcon}</span>
        <span class="tribal-member-name">${m.name}</span>
        <span class="tribal-member-rank-name">${rankName}</span>
        <span class="tribal-member-contribution">🪙 ${this._fmt(m.contribution || 0)}</span>
        <span class="tribal-member-power">🔥 ${this._fmt(m.power || 0)}</span>
        ${canPromote ? `
          <button class="tribal-promote-btn" data-name="${m.name}" title="ترقية">⬆</button>
          <button class="tribal-demote-btn" data-name="${m.name}" title="تنزيل">⬇</button>
        ` : ""}
      </div>
    `;
  }
  html += `</div>`;

  container.innerHTML = html;

  // ربط أزرار المساهمة
  const contributeBtn = document.getElementById("tribal-contribute-btn");
  const contributeInput = document.getElementById("tribal-contribute-input");
  if (contributeBtn && contributeInput) {
    contributeBtn.addEventListener("click", () => {
      const val = parseInt(contributeInput.value, 10);
      if (val > 0 && am.contribute(val)) {
        this.requestRender("alliance");
      }
    });
  }

  // ربط زر الترقية من الخزينة
  const upgradeTreasuryBtn = document.getElementById("tribal-upgrade-from-treasury-btn");
  if (upgradeTreasuryBtn) {
    upgradeTreasuryBtn.addEventListener("click", () => {
      if (am.upgradeFromTreasury(true)) {
        this.requestRender("alliance");
      }
    });
  }

  // ربط أزرار الترقية والتنزيل
  container.querySelectorAll(".tribal-promote-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      if (am.promoteMember(btn.dataset.name)) {
        this.requestRender("alliance");
      }
    });
  });
  container.querySelectorAll(".tribal-demote-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      if (am.demoteMember(btn.dataset.name)) {
        this.requestRender("alliance");
      }
    });
  });
};

GameUI.prototype._showWarDeclareModal = function() {
  const overlay = document.getElementById("modal-overlay");
  const card    = document.getElementById("modal-card");
  if (!overlay || !card) return;

  card.innerHTML = `
    <div class="flex items-center justify-between mb-3">
      <h3 class="font-bold text-base" style="color:var(--accent-red);font-family:'Cairo',sans-serif">🗡️ إعلان الغزوة القبلية</h3>
      <button id="war-modal-close-btn" class="text-xl leading-none" style="color:var(--text-secondary);background:none;border:none;cursor:pointer;font-family:inherit">&times;</button>
    </div>
    <div style="margin-bottom:12px">
      <label style="color:var(--text-secondary);font-size:0.8rem;display:block;margin-bottom:4px">اسم القبيلة المستهدفة</label>
      <input type="text" id="war-declare-input" placeholder="اكتب اسم القبيلة المستهدفة..." style="width:100%;padding:8px 12px;border-radius:8px;border:1px solid var(--border-light);background:var(--bg-surface);color:var(--text-primary);font-family:'Cairo',sans-serif;box-sizing:border-box" maxlength="30">
    </div>
    <div style="margin-bottom:12px">
      <label style="color:var(--text-secondary);font-size:0.8rem;display:block;margin-bottom:4px">قوة الجيش المعادي (تقدير)</label>
      <input type="number" id="war-declare-power" placeholder="0" style="width:100%;padding:8px 12px;border-radius:8px;border:1px solid var(--border-light);background:var(--bg-surface);color:var(--text-primary);font-family:'Cairo',sans-serif;box-sizing:border-box" min="0">
    </div>
    <button id="war-declare-confirm" class="w-full py-3 rounded-xl font-bold text-base" style="background:var(--accent-red);color:#fff;border:none;cursor:pointer;font-family:inherit">⚔️ أعلن الغزوة!</button>
    <div id="war-declare-error" style="text-align:center;color:var(--accent-red);font-size:0.8rem;margin-top:8px"></div>
  `;
  overlay.classList.remove("hidden");
  document.body.classList.add("modal-open");

  document.getElementById("war-modal-close-btn").onclick = () => {
    overlay.classList.add("hidden");
    document.body.classList.remove("modal-open");
  };
  document.getElementById("war-declare-confirm").onclick = () => {
    const name  = document.getElementById("war-declare-input").value.trim();
    const power = parseInt(document.getElementById("war-declare-power").value) || 0;
    if (!name) {
      document.getElementById("war-declare-error").textContent = "⚠️ اكتب اسم القبيلة المستهدفة";
      return;
    }
    const wm = this.warManager;
    if (!wm) return;
    const ok = wm.declareWar(name, power);
    if (!ok) {
      document.getElementById("war-declare-error").textContent = "⚠️ لا يمكن الإرسال — تأكد من اتصالك بالخادم";
      return;
    }
    overlay.classList.add("hidden");
    document.body.classList.remove("modal-open");
    if (this.world && this.world.store) {
      this.world.store.set('notification', { text: `⚔️ أرسلت غزوتك القبلية على ${name}!`, t: Date.now() });
    }
  };
};

GameUI.prototype._fmt = function(n) { return formatNumber(n); };

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

// ═══════════════════════════════════════════════════════════════════
//  🎒 واجهة اختيار العتاد (Loadout) قبل الدخول لأي نمط
// ═══════════════════════════════════════════════════════════════════

/** إظهار شاشة اختيار العتاد قبل الدخول للنمط */
GameUI.prototype.showLoadoutScreen = function(modeName) {
  const loadoutMgr = window._loadoutManager;
  if (!loadoutMgr) {
    // إذا لم يكن هناك نظام شنطة، ندخل النمط مباشرة
    this._enterModeDirect(modeName);
    return;
  }

  // تجهيز واجهة الشنطة
  const modeNames = { extraction: 'استخراج الذهب', horde: 'الحشد', cave: 'الكهف' };
  const modeIcons = { extraction: '🪙', horde: '🌊', cave: '🕯️' };
  
  const existing = document.getElementById("loadout-overlay");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.id = "loadout-overlay";
  overlay.className = "loadout-overlay";
  
  const hasBag = loadoutMgr.hasBag;
  const ownedWeapons = loadoutMgr.getOwnedWeapons();
  const availableItems = loadoutMgr.getAvailableItemsForMode(modeName);
  
  // الأيقونات العربية للأسلحة
  const _imgKey = (k, fb) => {
    const url = typeof ImageResolver !== 'undefined' ? ImageResolver.src(k) : null;
    return url ? `<img src="${url}" class="lod-icon-img" alt="">` : fb;
  };
  const weaponIcons = {
    'w1': _imgKey('itemDesertScimitar', '🗡️'), 'w2': '🏹', 'w3': '🔱',
    'w4': '🗡️', 'w5': '🏹🔥', 'w6': '🪓'
  };
  const itemIcons = {
    bandage: _imgKey('itemBandage', '🩹'), heal_potion: _imgKey('itemHealPotion', '🧪'),
    fire_sword: _imgKey('itemFireSword', '🗡️'), desert_shield: _imgKey('itemDesertShield', '🛡️'),
    power_helmet: _imgKey('itemPowerHelmet', '⛑️'), xp_scroll: _imgKey('itemXpScroll', '📜'),
    power_gem: _imgKey('itemPowerGem', '💎'), iron_sword: _imgKey('itemIronSword', '🗡️')
  };
  
  // بناء HTML للأسلحة المجهزة
  let weaponsHtml = '<div class="loadout-weapons-grid">';
  for (const w of ownedWeapons) {
    const equipped = loadoutMgr.isWeaponEquipped(w.id);
    const canEquip = loadoutMgr.canEquipWeapon(w.id) && !equipped;
    weaponsHtml += `
      <div class="loadout-weapon-card${equipped ? ' loadout-equipped' : ''}" data-wid="${w.id}">
        <div class="lod-w-icon">${weaponIcons[w.id] || '🗡️'}</div>
        <div class="lod-w-name">${w.name}</div>
        <div class="lod-w-power">👊 ${w.power.toFixed(0)}</div>
        <div class="lod-w-stars">${'⭐'.repeat(w.level)}${'☆'.repeat(Math.max(0, w.maxLevel - w.level))}</div>
        ${equipped ? '<div class="lod-equipped-badge">✅ مجهز</div>' : (canEquip ? '<button class="lod-equip-btn" data-wid="'+w.id+'">تجهيز</button>' : '<div class="lod-locked-badge">🔒 ممتلئ</div>')}
      </div>
    `;
  }
  weaponsHtml += '</div>';
  
  // بناء HTML للعناصر المتاحة حسب النمط
  let itemsHtml = '<div class="loadout-items-grid">';
  if (availableItems.length === 0) {
    itemsHtml += '<div class="loadout-no-items">لا توجد عناصر متاحة لهذا النمط في مخزونك</div>';
  } else {
    for (const item of availableItems) {
      const equipped = loadoutMgr.isItemEquipped(item.id);
      const canEquip = loadoutMgr.canEquipItem(item.id, modeName) && !equipped;
      itemsHtml += `
        <div class="loadout-item-card${equipped ? ' loadout-equipped' : ''}" data-iid="${item.id}">
          <div class="lod-i-icon">${itemIcons[item.id] || '📦'}</div>
          <div class="lod-i-info">
            <div class="lod-i-name">${(ITEM_DEFS[item.id]?.name) || item.id}</div>
            <div class="lod-i-count">×${item.count} (Lv.${item.level || 1})</div>
          </div>
          ${equipped ? '<div class="lod-equipped-badge">✅ في الشنطة</div>' : (canEquip ? '<button class="lod-equip-item-btn" data-iid="'+item.id+'">➕</button>' : '<div class="lod-locked-badge">🔒 ممتلئ</div>')}
        </div>
      `;
    }
  }
  itemsHtml += '</div>';
  
  // شريط الحالة — الأسلحة والعناصر المجهزة حالياً
  const eqWeapons = loadoutMgr.equippedWeapons.map(wid => {
    const w = ownedWeapons.find(ww => ww.id === wid);
    return w ? w.name : wid;
  }).join('، ') || '—';
  const eqItems = loadoutMgr.equippedItems.map(iid => {
    const def = ITEM_DEFS[iid];
    return def ? def.name : iid;
  }).join('، ') || '—';
  
  // معلومات الترقية
  const craftCostDesc = hasBag && !loadoutMgr.isMaxLevel 
    ? loadoutMgr.getCraftCostDescription() 
    : '';
  const canCraftOrUpgrade = loadoutMgr.canCraftBag();
  
  overlay.innerHTML = `
    <div class="loadout-bg" onclick="document.getElementById('loadout-overlay')?.remove()"></div>
    <div class="loadout-panel">
      <div class="loadout-header">
        <span class="loadout-mode-icon">${modeIcons[modeName] || '⚔️'}</span>
        <span class="loadout-title">تجهيز العتاد — ${modeNames[modeName] || modeName}</span>
        <button class="loadout-close-btn" onclick="this.closest('#loadout-overlay').remove()">✕</button>
      </div>
      
      {{BAG_INFO}}
      
      {{BAG_UPGRADE}}
      
      <div class="loadout-section">
        <div class="loadout-section-title">🗡️ الأسلحة (${loadoutMgr.equippedWeapons.length}/${loadoutMgr.maxWeapons})</div>
        <div class="loadout-equipped-summary">المجهز: ${eqWeapons}</div>
        ${weaponsHtml}
      </div>
      
      <div class="loadout-section">
        <div class="loadout-section-title">📦 العناصر (${loadoutMgr.equippedItems.length}/${loadoutMgr.maxItems})</div>
        <div class="loadout-equipped-summary">المجهز: ${eqItems}</div>
        ${itemsHtml}
      </div>
      
      <div class="loadout-footer">
        <button class="loadout-auto-btn" id="loadout-auto-btn">🎲 تجهيز تلقائي</button>
        <button class="loadout-enter-btn" id="loadout-enter-btn">${modeIcons[modeName] || '⚔️'} ابدأ ${modeNames[modeName] || modeName}!</button>
      </div>
    </div>
  `;
  
  // تعبئة معلومات الشنطة
  const bagInfoHtml = hasBag 
    ? `<div class="loadout-bag-info">
        <span class="lod-bag-icon">${loadoutMgr.bagIcon}</span>
        <span class="lod-bag-name">${loadoutMgr.bagName} (Lv.${loadoutMgr.bagLevel})</span>
        <span class="lod-bag-stats">🗡️ ${loadoutMgr.maxWeapons} أسلحة | 📦 ${loadoutMgr.maxItems} عناصر</span>
      </div>`
    : `<div class="loadout-no-bag">
        <span>👜 ليس لديك شنطة بعد! اصنع واحدة لتحمل أسلحة وعناصر</span>
      </div>`;
  
  const upgradeHtml = hasBag && !loadoutMgr.isMaxLevel 
    ? `<div class="loadout-upgrade-row">
        <span class="lod-upgrade-cost">⬆️ ${craftCostDesc}</span>
        <button class="lod-craft-btn" id="loadout-craft-btn" ${canCraftOrUpgrade ? '' : 'disabled'}>ترقية</button>
      </div>`
    : (hasBag ? `<div class="loadout-upgrade-row loadout-maxed">👑 المستوى الأقصى!</div>` : '');
  
  overlay.innerHTML = overlay.innerHTML
    .replace('{{BAG_INFO}}', bagInfoHtml)
    .replace('{{BAG_UPGRADE}}', upgradeHtml);
  
  document.body.appendChild(overlay);
  
  // ── ربط الأحداث ──
  
  // تجهيز/إلغاء تجهيز الأسلحة
  overlay.querySelectorAll('.lod-equip-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const wid = btn.dataset.wid;
      if (loadoutMgr.equipWeapon(wid)) {
        this._markDirty?.();
        this._onSave?.();
        this.showNotification(`🗡️ تم تجهيز ${ownedWeapons.find(w => w.id === wid)?.name}`);
        overlay.remove();
        this.showLoadoutScreen(modeName);
      }
    });
  });
  overlay.querySelectorAll('.loadout-weapon-card.loadout-equipped').forEach(card => {
    card.addEventListener('click', () => {
      const wid = card.dataset.wid;
      if (wid && loadoutMgr.unequipWeapon(wid)) {
        this._markDirty?.();
        this._onSave?.();
        this.showNotification(`✕ إلغاء تجهيز السلاح`);
        overlay.remove();
        this.showLoadoutScreen(modeName);
      }
    });
  });
  
  // تجهيز/إلغاء تجهيز العناصر
  overlay.querySelectorAll('.lod-equip-item-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const iid = btn.dataset.iid;
      if (loadoutMgr.equipItem(iid, modeName)) {
        this._markDirty?.();
        this._onSave?.();
        this.showNotification(`📦 تم تجهيز العنصر`);
        overlay.remove();
        this.showLoadoutScreen(modeName);
      }
    });
  });
  overlay.querySelectorAll('.loadout-item-card.loadout-equipped').forEach(card => {
    card.addEventListener('click', () => {
      const iid = card.dataset.iid;
      if (iid && loadoutMgr.unequipItem(iid)) {
        this._markDirty?.();
        this._onSave?.();
        this.showNotification(`✕ إلغاء تجهيز العنصر`);
        overlay.remove();
        this.showLoadoutScreen(modeName);
      }
    });
  });
  
  // زر التجهيز التلقائي
  document.getElementById('loadout-auto-btn')?.addEventListener('click', () => {
    loadoutMgr.autoEquip(modeName);
    this._markDirty?.();
    this._onSave?.();
    this.showNotification('🎲 تم التجهيز التلقائي!');
    overlay.remove();
    this.showLoadoutScreen(modeName);
  });
  
  // زر الترقية/الصناعة
  document.getElementById('loadout-craft-btn')?.addEventListener('click', () => {
    if (loadoutMgr.craftBag()) {
      this._markDirty?.();
      this._onSave?.();
      this.showNotification(`⬆️ ${loadoutMgr.bagName} (Lv.${loadoutMgr.bagLevel})!`);
      this.updateTopBar();
      overlay.remove();
      this.showLoadoutScreen(modeName);
    } else {
      this.showNotification('❌ الموارد غير كافية لترقية الشنطة');
    }
  });
  
  // زر الدخول للنمط
  document.getElementById('loadout-enter-btn')?.addEventListener('click', () => {
    overlay.remove();
    this._enterModeDirect(modeName);
  });
};

/** الدخول المباشر للنمط (بعد تطبيق العتاد) */
GameUI.prototype._enterModeDirect = function(modeName) {
  // تطبيق العتاد على العالم قبل الدخول
  const loadoutMgr = window._loadoutManager;
  if (loadoutMgr && this.world) {
    loadoutMgr.applyToWorld(this.world);
  }
  
  // إخفاء واجهة شاشة الحرب إذا كانت مفتوحة
  const warOverlay = document.querySelector('.screen-panel');
  if (warOverlay) {
    // لا نحذف، فقط نخفي screens أخرى
  }
  
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
  
  const modeNotifications = {
    extraction: { text: '🪙 وضع الاستخراج — اذبح الوحوش المسالمة واجمع الذهب! سلمه قبل فوات الوقت!' },
    horde: { text: '🌊 وضع الحشد — اصمد 20 موجة! كل موجة تجلب وحوشاً أقوى!' },
    cave: { text: '🕯️ كهف الاستكشاف — ظلام وبراكين ووحوش نارية! ابحث عن الكنوز النادرة!' },
  };
  
  if (this.world) {
    this.world.switchToMode(modeName);
  }
  
  const notif = modeNotifications[modeName];
  if (notif) this.showNotification(notif.text);
};

// ═══════════════════════════════════════════════════════════════════
//  🎯 تحديث دوال الدخول لإظهار شاشة العتاد أولاً
// ═══════════════════════════════════════════════════════════════════

GameUI.prototype.enterExtraction = function() {
  this.showLoadoutScreen("extraction");
};

GameUI.prototype.enterHorde = function() {
  this.showLoadoutScreen("horde");
};

GameUI.prototype.enterCave = function() {
  this.showLoadoutScreen("cave");
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
