import { formatNumber } from "../economy.js";
import { WeaponsLibrary } from "../weapons.js";

export function injectPromotionMethods(GameUI) {

GameUI.prototype.bindPromoBackButtons = function() {
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
};

GameUI.prototype.buildPromotionScreen = function() {
  const container = document.createElement("div");
  container.className = "screen-panel upgrade-panel";
  container.innerHTML = `
    <div class="panel-header" style="font-size:1.3rem;margin-bottom:16px">🏪 مركز التطوير</div>
    <div class="promo-hub-grid" id="promo-hub-grid"></div>
    <div id="upgrade-tree-page" class="promo-sub-page hidden">
      <button class="promo-back-btn" id="back-from-tree">→ رجوع</button>
      <div class="panel-header" style="font-size:1.1rem;margin-bottom:14px">⭐ شجرة الترقيات</div>
      <div class="upgrade-grid" id="upgrade-grid"></div>
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
    <div id="weapons-page" class="promo-sub-page hidden">
      <button class="promo-back-btn" id="back-from-weapons">→ رجوع</button>
      <div class="panel-header" style="font-size:1.1rem;margin-bottom:14px">🗡️ مخزن الأسلحة</div>
      <div class="weapons-grid" id="weapons-grid"></div>
    </div>
    <div id="weapon-detail-overlay" class="wd-overlay hidden">
      <div class="wd-card" id="weapon-detail-card"></div>
    </div>
    <div id="knowledge-page" class="promo-sub-page hidden">
      <button class="promo-back-btn" id="back-from-knowledge">→ رجوع</button>
      <div class="panel-header" style="font-size:1.1rem;margin-bottom:14px">📜 شجرة المعرفة</div>
      <div class="knowledge-upgrades" id="knowledge-upgrades"></div>
    </div>
    <div id="rewards-page" class="promo-sub-page hidden">
      <button class="promo-back-btn" id="back-from-rewards">→ رجوع</button>
      <div class="panel-header" style="font-size:1.1rem;margin-bottom:14px">🎁 صندوق المكافآت</div>
      <div class="rewards-content" id="rewards-content"></div>
    </div>
  `;
  return container;
};

GameUI.prototype.renderPromotion = function() {
  const hubGrid = document.getElementById("promo-hub-grid");
  const treePage = document.getElementById("upgrade-tree-page");
  const weaponsPage = document.getElementById("weapons-page");
  const knowledgePage = document.getElementById("knowledge-page");
  const rewardsPage = document.getElementById("rewards-page");
  [treePage, weaponsPage, knowledgePage, rewardsPage].forEach(p => {
    if (p) p.classList.add("hidden");
  });
  if (hubGrid && !this._promoSubPage) {
    this._renderPromotionHub();
  }
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
      if (this._promoSubPage === 'tree') this._renderUpgradeTree();
      if (this._promoSubPage === 'weapons') this._renderWeaponsPage();
      if (this._promoSubPage === 'knowledge') this._renderKnowledgePage();
      if (this._promoSubPage === 'rewards') this._renderRewardsPage();
    }
  }
};

GameUI.prototype._promotionShowHub = function() {
  this._promoSubPage = null;
  this.renderPromotion();
};

GameUI.prototype._openWeaponsLibrary = function() {
  const existing = document.getElementById('weapons-library-overlay');
  if (existing) existing.remove();
  document.body.style.overflow = 'hidden';
  const lib = new WeaponsLibrary(this.army.weapons, this.economy, this);
  document.body.appendChild(lib.render());
};

GameUI.prototype._renderPromotionHub = function() {
  const hubGrid = document.getElementById("promo-hub-grid");
  if (!hubGrid) return;
  hubGrid.textContent = "";
  const treePaths = this.upgradeTree ? this.upgradeTree.getPaths() : [];
  const totalUpgrades = treePaths.reduce((sum, p) => sum + p.currentLevel, 0);
  const totalMax = treePaths.reduce((sum, p) => sum + p.maxLevel, 0);
  const wCount = this.army?.weapons?.length || 6;
  const wUpgraded = this.army?.weapons?.filter(w => w.upgradeLevel > 0).length || 0;
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
      if (c.id === 'weapons') {
        this._promoSubPage = null;
        this.renderPromotion();
        this._openWeaponsLibrary();
      } else {
        this._promoSubPage = c.id;
        this.renderPromotion();
      }
    });
    hubGrid.appendChild(card);
  }
};

GameUI.prototype._renderUpgradeTree = function() {
  const grid = document.getElementById("upgrade-grid");
  if (!grid || !this.upgradeTree) return;
  grid.textContent = "";
  const paths = [
    {
      id: 'army', icon: '⚔️', name: 'الجيش',
      desc: 'تطوير قوة الجيش الصحراوي',
      color: '#ff6b6b', bgGrad: 'linear-gradient(135deg, rgba(255,68,68,0.15), rgba(180,40,40,0.08))'
    },
    {
      id: 'knowledge', icon: '📜', name: 'المعرفة',
      desc: 'تطوير المعرفة والعلوم الصحراوية',
      color: '#9b59b6', bgGrad: 'linear-gradient(135deg, rgba(155,89,182,0.15), rgba(100,50,120,0.08))'
    },
    {
      id: 'defense', icon: '🛡️', name: 'الدفاع',
      desc: 'تحصينات القلعة والدفاع',
      color: '#2ecc71', bgGrad: 'linear-gradient(135deg, rgba(46,204,113,0.15), rgba(20,150,70,0.08))'
    },
    {
      id: 'trade', icon: '🐪', name: 'التجارة',
      desc: 'قوافل التجارة الصحراوية',
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
    card.addEventListener('click', (e) => {
      if (e.target.closest('.ug-btn')) return;
      this._openUpgradeDetail(p.id);
    });
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
};

GameUI.prototype._openUpgradeDetail = function(pathId) {
  const modal = document.getElementById("upgrade-detail-modal");
  const p = this.upgradeTree.getPaths().find(x => x.id === pathId);
  if (!modal || !p) return;
  const lvl = p.currentLevel;
  const maxLvl = p.maxLevel;
  const isMax = lvl >= maxLvl;
  const pct = maxLvl > 0 ? (lvl / maxLvl) * 100 : 0;
  const nextEffect = !isMax ? p.levels[lvl]?.effect || 0 : '—';
  const cost = !isMax ? p.cost : '—';
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
  const closeBtn = document.getElementById("detail-modal-close");
  if (closeBtn) closeBtn.onclick = () => modal.classList.add("hidden");
  modal.onclick = (e) => { if (e.target === modal) modal.classList.add("hidden"); };
};

GameUI.prototype._renderWeaponsPage = function() {
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
};

GameUI.prototype._openWeaponDetail = function(weaponId) {
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
};

GameUI.prototype._upgradeWeapon = function(weaponId) {
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
};

GameUI.prototype._renderKnowledgePage = function() {
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
};

GameUI.prototype._renderRewardsPage = function() {
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
};

}
