
export function injectPromotionMethods(GameUI) {

GameUI.prototype._bindCloseButtons = function() {
  const ids = ['back-from-knowledge', 'back-from-rewards'];
  for (const id of ids) {
    document.getElementById(id)?.addEventListener('click', () => {
      this._promoSubPage = null;
      this.renderPromotion();
    });
  }
};

GameUI.prototype.buildPromotionScreen = function() {
  const container = document.createElement("div");
  container.className = "screen-panel upgrade-panel";
  container.innerHTML = `
    <div class="panel-header" id="promo-header" style="font-size:1.3rem;margin-bottom:16px">🏪 مركز التطوير</div>
    <div class="promo-hub-grid" id="promo-hub-grid"></div>
    <div id="weapon-detail-overlay" class="wd-overlay hidden">
      <div class="wd-card" id="weapon-detail-card"></div>
    </div>
    <div id="knowledge-page" class="promo-sub-page hidden">
      <button class="promo-back-btn" id="back-from-knowledge" style="font-size:1.2rem">✕</button>
      <div class="panel-header" style="font-size:1.1rem;margin-bottom:10px">📜 شجرة المعرفة</div>
      <div class="knowledge-tabs" style="display:flex;gap:8px;margin-bottom:14px">
        <button class="knowledge-tab active" data-tab="upgrades">🌳 شجرة الترقيات</button>
        <button class="knowledge-tab" data-tab="research">🔬 شجرة البحوث</button>
      </div>
      <div class="upgrade-grid" id="upgrade-grid"></div>
      <div id="research-tree" class="research-tree hidden"></div>
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
    <div id="rewards-page" class="promo-sub-page hidden">
      <button class="promo-back-btn" id="back-from-rewards" style="font-size:1.2rem">✕</button>
      <div class="panel-header" style="font-size:1.1rem;margin-bottom:14px">🎁 صندوق المكافآت</div>
      <div class="rewards-content" id="rewards-content"></div>
    </div>
  `;
  return container;
};

GameUI.prototype.renderPromotion = function() {
  const hubGrid = document.getElementById("promo-hub-grid");
  const header = document.getElementById("promo-header");
  const knowledgePage = document.getElementById("knowledge-page");
  const rewardsPage = document.getElementById("rewards-page");
  [knowledgePage, rewardsPage].forEach(p => {
    if (p) p.classList.add("hidden");
  });
  const isSubPage = !!this._promoSubPage;
  if (hubGrid) hubGrid.classList.toggle("hidden", isSubPage);
  if (header) header.classList.toggle("hidden", isSubPage);
  if (hubGrid && !isSubPage) {
    this._renderPromotionHub();
  }
  if (isSubPage) {
    const pageMap = {
      'knowledge': knowledgePage,
      'rewards': rewardsPage
    };
    const targetPage = pageMap[this._promoSubPage];
    if (targetPage) {
      targetPage.classList.remove("hidden");
      if (this._promoSubPage === 'knowledge') this._renderKnowledgePage();
      if (this._promoSubPage === 'rewards') this._renderFullRewardsPage();
    }
  }
  this._bindCloseButtons();
  this._bindKnowledgeTabs();
};

GameUI.prototype._promotionShowHub = function() {
  this._promoSubPage = null;
  this.renderPromotion();
};

GameUI.prototype._openWeaponsLibrary = function() {
  const existing = document.getElementById('weapons-library-overlay');
  if (existing) existing.remove();
  document.body.style.overflow = 'hidden';
  const overlay = document.createElement('div');
  overlay.id = 'weapons-library-overlay';
  overlay.className = 'wl-overlay';
  overlay.style.alignItems = 'center';
  overlay.style.touchAction = 'pan-y';
  const card = document.createElement('div');
  card.className = 'weapons-library';
  card.style.cssText = 'max-width:430px;max-height:88vh;border-radius:24px;padding:20px;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;touch-action:pan-y';
  card.innerHTML = `
    <div class="wl-header">
      <div class="wl-title" style="font-size:1.3rem">🗡️ الأسلحة الأسطورية</div>
      <button class="wl-close-btn" id="wl-close-btn">✕</button>
    </div>
    <div class="weapon-shop-grid" id="weapon-grid" style="display:flex;flex-direction:column;gap:10px"></div>
  `;
  card.querySelector('#wl-close-btn').addEventListener('click', () => {
    overlay.remove();
    document.body.style.overflow = '';
  });
  // لا تغلق عند الضغط خارج البطاقة في منطقة الأزرار السفلية
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay && e.clientY < window.innerHeight - 80) {
      overlay.remove();
      document.body.style.overflow = '';
    }
  });
  overlay.appendChild(card);
  document.body.appendChild(overlay);
  this._renderWeaponsLibraryPage();
};

GameUI.prototype._renderWeaponsLibraryPage = function() {
  const container = document.getElementById('weapon-grid');
  if (!container) return;
  const eco = this.economy;
  const weapons = this.army?.weapons || [];
  const houseLevel = this._landsState?.['b1']?.level || 1;
  const equippedId = this.world?._equippedWeapon || '';
  const ownedCount = weapons.filter(w => w.owned).length;
  const totalPower = weapons.reduce((sum, w) => sum + (w.owned ? w.power : 0), 0);
  const weaponIcons = { w1: '🗡️', w2: '🏹', w3: '🔱', w4: '⚔️', w5: '🔥', w6: '⚒️' };
  const weaponColors = { w1: '#b8956a', w2: '#d4a76a', w3: '#8b6914', w4: '#ffd700', w5: '#ff6b6b', w6: '#9b59b6' };
  const weaponRanges = { w1: 'قريب', w2: 'بعيد', w3: 'قريب', w4: 'قريب', w5: 'بعيد', w6: 'قريب' };

  let html = `
    <div class="shop-summary" style="background:var(--bg-card);border-radius:14px;padding:10px;margin-bottom:12px;border:1px solid var(--border-light);text-align:center;box-shadow:var(--shadow-card)">
      <div style="display:flex;justify-content:space-around;gap:8px">
        <div><span style="font-size:0.65rem;color:var(--text-secondary)">🗡️ المملوكة</span><br><span style="font-size:1rem;font-weight:900;color:var(--accent-red)">${ownedCount}/${weapons.length}</span></div>
        <div><span style="font-size:0.65rem;color:var(--text-secondary)">👊 القوة</span><br><span style="font-size:1rem;font-weight:900;color:var(--gold)">+${Math.round(totalPower)}</span></div>
        <div><span style="font-size:0.65rem;color:var(--text-secondary)">💵 الرصيد</span><br><span style="font-size:1rem;font-weight:900;color:var(--green)">${eco.cashFormatted}</span></div>
      </div>
    </div>
  `;

  for (const w of weapons) {
    const isOwned = w.owned;
    const isEquipped = equippedId === w.id;
    const isMaxed = w.level >= w.maxLevel;
    const isLockedByLevel = houseLevel < w.requireLevel;
    const canBuy = !isOwned && !isLockedByLevel && eco.canAfford('cash', w.cashPrice);
    const canUpg = isOwned && !isMaxed && w.canUpgrade(eco, houseLevel);
    const color = weaponColors[w.id] || '#b8956a';
    const icon = weaponIcons[w.id] || '🗡️';
    const starStr = '⭐'.repeat(w.level) + '☆'.repeat(Math.max(0, w.maxLevel - w.level));
    const powerVal = isOwned ? Math.round(w.power) : Math.round(w.basePower * 1.5);
    const costs = w.getUpgradeCosts ? w.getUpgradeCosts() : null;
    const upgradeCostStr = costs ? `💵${costs.cash} 💎${costs.gems}${costs.artifact > 0 ? ` 🏺${costs.artifact}` : ''}${costs.desertGem > 0 ? ` 💠${costs.desertGem}` : ''}` : '';

    html += `
      <div class="shop-weapon-card" style="background:var(--bg-card);border:2px solid ${isEquipped ? color : 'var(--border-light)'};border-radius:16px;padding:12px;box-shadow:${isEquipped ? '0 0 20px '+color+'33' : 'var(--shadow-card)'};transition:all 0.2s">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
          <div style="font-size:2rem;width:44px;text-align:center">${icon}</div>
          <div style="flex:1;min-width:0">
            <div style="font-size:0.85rem;font-weight:800;color:var(--text-primary)">${w.name}</div>
            <div style="font-size:0.6rem;color:var(--text-secondary)">${w.desc || ''} — مدى: ${weaponRanges[w.id] || 'قريب'}</div>
          </div>
          ${isEquipped ? '<div style="background:'+color+';color:#fff;padding:2px 8px;border-radius:8px;font-size:0.6rem;font-weight:800">✔ مجهز</div>' : ''}
        </div>
        <div style="display:flex;gap:8px;margin-bottom:6px">
          <div style="flex:1;background:var(--bg-input);border-radius:10px;padding:6px;text-align:center;border:1px solid var(--border-light)">
            <span style="font-size:0.55rem;color:var(--text-secondary);display:block">👊 القوة</span>
            <span style="font-size:0.9rem;font-weight:800;color:var(--text-primary)">${powerVal}</span>
          </div>
          <div style="flex:1;background:var(--bg-input);border-radius:10px;padding:6px;text-align:center;border:1px solid var(--border-light)">
            <span style="font-size:0.55rem;color:var(--text-secondary);display:block">🏠 يحتاج</span>
            <span style="font-size:0.9rem;font-weight:800;color:var(--text-primary)">Lv.${w.requireLevel}</span>
          </div>
          ${isOwned ? `<div style="flex:1;background:var(--bg-input);border-radius:10px;padding:6px;text-align:center;border:1px solid var(--border-light)"><span style="font-size:0.55rem;color:var(--text-secondary);display:block">⭐ الترقية</span><span style="font-size:0.9rem;font-weight:800;color:${color}">${w.level}/${w.maxLevel}</span></div>` : ''}
        </div>
        ${isOwned ? `<div style="font-size:0.65rem;color:var(--text-secondary);margin-bottom:6px;text-align:center">${starStr}</div>` : ''}
        ${!isOwned && isLockedByLevel ? `<div style="text-align:center;font-size:0.65rem;color:var(--red);margin-bottom:6px">🔒 يحتاج بيت الزعيم Lv.${w.requireLevel}</div>` : ''}
        <div style="display:flex;gap:6px">
          ${!isOwned ? `
            <button class="shop-buy-weapon-btn" data-wid="${w.id}" ${canBuy ? '' : 'disabled'}
              style="flex:1;padding:10px;border:none;border-radius:10px;font-size:0.75rem;font-weight:800;cursor:pointer;font-family:inherit;transition:transform 0.15s;${canBuy ? `background:linear-gradient(135deg,${color},#5a3d2b);color:#fff` : 'background:#4a4a4a;color:#888;cursor:default'}">
              ${canBuy ? `🔓 شراء (${w.cashPrice.toLocaleString()} 💵)` : (isLockedByLevel ? '🔒 مقفل' : '💰 غير كافٍ')}
            </button>
          ` : `
            ${!isEquipped ? `
            <button class="shop-equip-weapon-btn" data-wid="${w.id}"
              style="flex:1;padding:10px;border:2px solid ${color};border-radius:10px;font-size:0.75rem;font-weight:800;cursor:pointer;font-family:inherit;background:transparent;color:${color};transition:transform 0.15s">
              🏹 تجهيز
            </button>` : `
            <button class="shop-unequip-weapon-btn" data-wid="${w.id}"
              style="flex:1;padding:10px;border:2px solid var(--border-light);border-radius:10px;font-size:0.75rem;font-weight:800;cursor:pointer;font-family:inherit;background:var(--bg-input);color:var(--text-secondary);transition:transform 0.15s">
              ✕ إلغاء التجهيز
            </button>`}
            ${!isMaxed && !isLockedByLevel ? `
            <button class="shop-upgrade-weapon-btn" data-wid="${w.id}" ${canUpg ? '' : 'disabled'}
              style="flex:1;padding:10px;border:none;border-radius:10px;font-size:0.75rem;font-weight:800;cursor:pointer;font-family:inherit;transition:transform 0.15s;${canUpg ? `background:linear-gradient(135deg,${color},#5a3d2b);color:#fff` : 'background:#4a4a4a;color:#888;cursor:default'}">
              ${canUpg ? `▲ ${upgradeCostStr}` : (isLockedByLevel ? '🔒' : isMaxed ? '⭐ MAX' : '💰')}
            </button>` : `
            <div style="flex:1;padding:10px;border-radius:10px;font-size:0.75rem;font-weight:800;text-align:center;background:linear-gradient(135deg,#ffd700,#e69500);color:#2a1810">⭐ المستوى الأقصى</div>`}
          `}
        </div>
      </div>`;
  }

  container.innerHTML = html;

  container.querySelectorAll('.shop-buy-weapon-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const wid = btn.dataset.wid;
      if (window.shopBuy) window.shopBuy('buy_' + wid);
      this._renderWeaponsLibraryPage();
      this.updateTopBar();
    });
  });
  container.querySelectorAll('.shop-equip-weapon-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const wid = btn.dataset.wid;
      if (window.shopBuy) window.shopBuy('equip_' + wid);
      this._renderWeaponsLibraryPage();
      this.updateTopBar();
    });
  });
  container.querySelectorAll('.shop-unequip-weapon-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (window.shopBuy) window.shopBuy('unequip');
      this._renderWeaponsLibraryPage();
      this.updateTopBar();
    });
  });
  container.querySelectorAll('.shop-upgrade-weapon-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const wid = btn.dataset.wid;
      if (window.shopBuy) window.shopBuy(wid);
      this._renderWeaponsLibraryPage();
      this.updateTopBar();
    });
  });
};

GameUI.prototype._renderPromotionHub = function() {
  const hubGrid = document.getElementById("promo-hub-grid");
  if (!hubGrid) return;
  hubGrid.textContent = "";
  const army = this.army;
  const unitLvl = army?.unitLevel || 1;
  const trainLvl = army?.trainingLevel || 1;
  const cards = [
    {
      id: 'army-yard', name: 'ساحة الجيش', desc: 'تدريب وتطوير الجنود',
      badge: `${unitLvl}`, badgeColor: '#ff6b6b',
      img: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 200 180%22%3E%3Crect fill=%22%232c1a0a%22 width=%22200%22 height=%22180%22/%3E%3Ctext x=%22100%22 y=%22110%22 font-size=%2270%22 text-anchor=%22middle%22%3E%F0%9F%92%AA%3C/text%3E%3C/svg%3E',
      grad: 'linear-gradient(to bottom, rgba(255,68,68,0.25), rgba(44,26,10,0.95))'
    },
    {
      id: 'weapons', name: 'الأسلحة', desc: 'مكتبة الأسلحة الأسطورية',
      badge: '!', badgeColor: '#9b59b6',
      img: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 200 180%22%3E%3Crect fill=%22%233a2518%22 width=%22200%22 height=%22180%22/%3E%3Ctext x=%22100%22 y=%22110%22 font-size=%2270%22 text-anchor=%22middle%22%3E%F0%9F%97%A1%EF%B8%8F%3C/text%3E%3C/svg%3E',
      grad: 'linear-gradient(to bottom, rgba(155,89,182,0.25), rgba(44,26,10,0.95))'
    },
    {
      id: 'knowledge', name: 'المعرفة', desc: 'شجرة العلوم والتطوير',
      badge: `${trainLvl}`, badgeColor: '#2ecc71',
      img: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 200 150%22%3E%3Crect fill=%22%232c1a0a%22 width=%22200%22 height=%22150%22/%3E%3Ctext x=%22100%22 y=%22100%22 font-size=%2260%22 text-anchor=%22middle%22%3E%F0%9F%93%9C%3C/text%3E%3C/svg%3E',
      grad: 'linear-gradient(to bottom, rgba(46,204,113,0.25), rgba(44,26,10,0.95))'
    },
    {
      id: 'rewards', name: 'صندوق المكافآت', desc: 'المكافآت اليومية والإنجازات',
      badge: '🎁',
      img: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 200 150%22%3E%3Crect fill=%22%233a2518%22 width=%22200%22 height=%22150%22/%3E%3Ctext x=%22100%22 y=%22100%22 font-size=%2260%22 text-anchor=%22middle%22%3E%F0%9F%8E%81%3C/text%3E%3C/svg%3E',
      grad: 'linear-gradient(to bottom, rgba(243,156,18,0.25), rgba(44,26,10,0.95))'
    },
    {
      id: 'shop', name: 'المتجر', desc: 'شراء بنود وموارد',
      badge: '🛒',
      img: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 200 150%22%3E%3Crect fill=%22%232c1a0a%22 width=%22200%22 height=%22150%22/%3E%3Ctext x=%22100%22 y=%22100%22 font-size=%2260%22 text-anchor=%22middle%22%3E%F0%9F%9B%92%3C/text%3E%3C/svg%3E',
      grad: 'linear-gradient(to bottom, rgba(52,152,219,0.25), rgba(44,26,10,0.95))'
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
        </div>
        <div class="promo-card-bottom">
          <div class="promo-card-title">${c.name}</div>
          <div class="promo-card-desc">${c.desc}</div>
        </div>
      </div>
    `;
    card.addEventListener('click', () => {
      if (c.id === 'weapons') {
        this._openWeaponsLibrary();
      } else if (c.id === 'army-yard') {
        this._openArmyYard();
      } else if (c.id === 'shop') {
        this._openShop();
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
    const lockReason = this.upgradeTree.getLockReason(p.id);
    // تحديد سبب القفل
    let lockMsg = null;
    if (lockReason) {
      if (lockReason.reason === 'knowledge') {
        lockMsg = `🔒 تحتاج المعرفة من القصة المستوى ${lockReason.required} (حالياً ${lockReason.current})`;
      } else if (lockReason.reason === 'unit') {
        lockMsg = `🔒 تحتاج مستوى جنود ${lockReason.required} (حالياً ${lockReason.current})`;
      }
    }
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
      ${lockMsg ? `<div style="font-size:0.6rem;color:var(--red);text-align:center;padding:2px 0;margin-bottom:4px">${lockMsg}</div>` : ''}
      <div class="ug-card-footer">
        <span class="ug-cost">${isMax ? '—' : `🪙 ${this.upgradeTree.getCurrentCost(p.id)}`}</span>
        <button class="ug-btn" data-ugid="${p.id}" ${canAfford && !isMax ? '' : 'disabled'}
          style="${canAfford && !isMax ? `background:linear-gradient(180deg,${p.color},${p.color}88);color:#fff` : 'background:rgba(255,255,255,0.06);color:#666'}">
          ${isMax ? '⭐ الأقصى' : lockMsg ? '🔒 مقفل' : (canAfford ? '▲ ترقية' : '💰 تحتاج ذهب')}
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

GameUI.prototype._renderKnowledgePage = function() {
  const tab = this._knowledgeTab || 'upgrades';
  const upgradeGrid = document.getElementById("upgrade-grid");
  const researchTree = document.getElementById("research-tree");
  if (upgradeGrid) upgradeGrid.classList.toggle("hidden", tab !== 'upgrades');
  if (researchTree) researchTree.classList.toggle("hidden", tab !== 'research');
  document.querySelectorAll('.knowledge-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  if (tab === 'upgrades') this._renderUpgradeTree();
  else this._renderResearchTree();
};

GameUI.prototype._bindKnowledgeTabs = function() {
  document.querySelectorAll('.knowledge-tab').forEach(btn => {
    btn.onclick = () => {
      this._knowledgeTab = btn.dataset.tab;
      this._renderKnowledgePage();
    };
  });
};

GameUI.prototype._renderResearchTree = function() {
  const container = document.getElementById("research-tree");
  if (!container || !this.researchTree) return;
  container.textContent = "";
  const categories = this.researchTree.getCategories();
  const effects = this.researchTree.getEffects();

  let html = `<div class="research-effects-bar" style="background:var(--bg-card);border:1px solid var(--border-light);border-radius:14px;padding:10px;margin-bottom:12px;text-align:center;font-size:0.75rem">
    <div style="font-weight:800;color:var(--gold);margin-bottom:4px">✨ تأثيرات البحوث النشطة</div>
    <div style="display:flex;flex-wrap:wrap;justify-content:center;gap:8px;color:var(--text-secondary)">
      ${effects.goldProduction ? `<span>🪙 إنتاج الذهب +${effects.goldProduction}%</span>` : ''}
      ${effects.defensePercent ? `<span>🛡️ دفاع +${effects.defensePercent}%</span>` : ''}
      ${effects.moveSpeedPercent ? `<span>⚡ سرعة +${effects.moveSpeedPercent}%</span>` : ''}
      ${effects.crystalProduction ? `<span>💠 بلورات +${effects.crystalProduction}%</span>` : ''}
    </div>
  </div>`;

  for (const cat of categories) {
    html += `<div class="research-category" style="margin-bottom:14px">
      <div class="research-cat-header" style="font-size:0.95rem;font-weight:800;color:var(--text-primary);margin-bottom:8px;display:flex;align-items:center;gap:6px">
        <span>${cat.icon}</span><span>${cat.name}</span>
      </div>
      <div class="research-skills-grid" style="display:flex;flex-direction:column;gap:8px">`;
    for (const sk of Object.values(cat.skills)) {
      const level = this.researchTree.getLevel(cat.id, sk.id);
      const isMax = level >= sk.maxLevel;
      const check = this.researchTree.canUpgrade(cat.id, sk.id);
      const canAfford = check.allowed;
      const cost = this.researchTree.computeCost(cat.id, sk.id);
      const costStr = cost ? Object.entries(cost).map(([res, amt]) => {
        const icons = { cash: '💵', gold: '🪙', gems: '💎', scrolls: '📜', hammers: '🔨', artifacts: '🏺', desertGem: '💠' };
        return `${icons[res] || '•'} ${amt}`;
      }).join(' ') : '';
      html += `
        <div class="research-skill-card" style="background:var(--bg-card);border:1px solid var(--border-light);border-radius:14px;padding:10px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
            <span style="font-weight:700;font-size:0.8rem;color:var(--text-primary)">${sk.name}</span>
            <span style="font-size:0.7rem;color:var(--gold)">Lv.${level}/${sk.maxLevel}</span>
          </div>
          <div style="font-size:0.65rem;color:var(--text-secondary);margin-bottom:6px">${sk.effectDesc}</div>
          <div style="height:5px;background:rgba(0,0,0,0.1);border-radius:3px;overflow:hidden;margin-bottom:8px">
            <div style="height:100%;width:${(level / sk.maxLevel) * 100}%;background:linear-gradient(90deg,var(--gold),#e67e22);border-radius:3px"></div>
          </div>
          ${!isMax ? `<div style="font-size:0.65rem;color:var(--text-secondary);margin-bottom:6px">${costStr}</div>` : ''}
          <button class="research-upgrade-btn" data-cat="${cat.id}" data-skill="${sk.id}" ${canAfford ? '' : 'disabled'}
            style="width:100%;padding:8px;border:none;border-radius:10px;font-size:0.7rem;font-weight:800;font-family:inherit;cursor:${canAfford ? 'pointer' : 'default'};background:${canAfford ? 'linear-gradient(180deg,var(--gold),#e67e22)' : 'rgba(255,255,255,0.06)'};color:${canAfford ? '#2a1810' : '#666'}">
            ${isMax ? '⭐ الأقصى' : (canAfford ? '▲ بحث' : (check.reason || '🔒 مقفل'))}
          </button>
        </div>`;
    }
    html += `</div></div>`;
  }
  container.innerHTML = html;
  container.querySelectorAll('.research-upgrade-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const catId = btn.dataset.cat;
      const skillId = btn.dataset.skill;
      if (this.researchTree.upgrade(catId, skillId)) {
        this._renderResearchTree();
        this.updateTopBar();
        this.showNotification(`🔬 تم ترقية البحث!`);
        if (this._onSave) this._onSave();
      }
    });
  });
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
    const lockReason = p.lockReason || this.upgradeTree.getLockReason(pathId);
    let lockMsg = null;
    if (lockReason) {
      if (lockReason.reason === 'knowledge') {
        lockMsg = `🔒 تحتاج المعرفة من القصة المستوى ${lockReason.required}`;
      } else if (lockReason.reason === 'unit') {
        lockMsg = `🔒 تحتاج مستوى جنود ${lockReason.required}`;
      }
    }
    if (lockMsg) {
      upgradeBtn.textContent = lockMsg;
      upgradeBtn.disabled = true;
      upgradeBtn.style.opacity = "0.4";
    } else {
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


GameUI.prototype._openWeaponDetail = function(weaponId) {
  const w = this.army?.weapons?.find(x => x.id === weaponId);
  if (!w) return;
  const icons = { w1: '🗡️', w2: '🏹', w3: '🔱', w4: '⚔️', w5: '🔥', w6: '⚒️' };
  const colors = { w1: '#b8956a', w2: '#d4a76a', w3: '#8b6914', w4: '#ffd700', w5: '#ff6b6b', w6: '#9b59b6' };
  const isMax = w.level >= w.maxLevel;
  const starsHtml = '⭐'.repeat(w.level) + '☆'.repeat(Math.max(0, w.maxLevel - w.level));
  const pct = w.maxLevel > 0 ? (w.level / w.maxLevel) * 100 : 0;
  const costs = w.getUpgradeCosts ? w.getUpgradeCosts() : null;
  const cost = costs ? `💵${costs.cash} 💎${costs.gems}${costs.artifact > 0 ? ` 🏺${costs.artifact}` : ''}${costs.desertGem > 0 ? ` 💠${costs.desertGem}` : ''}` : '—';
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
      <div class="wd-stat"><span class="wd-stat-label">تكلفة الترقية</span><span class="wd-stat-val">${cost}</span></div>
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
  const costs = w.getUpgradeCosts();
  if (!costs || !w.canUpgrade(this.economy, houseLevel)) {
    this.showNotification(`❌ الموارد غير كافية! تحتاج: 💵 ${costs?.cash || 0} 💎 ${costs?.gems || 0} 🏺 ${costs?.artifact || 0} 💠 ${costs?.desertGem || 0}`);
    return;
  }
  const doUpgrade = () => {
    w.upgrade(this.economy, houseLevel);
    this.showNotification(`⬆️ ${w.name} → المستوى ${w.level}/${w.maxLevel}`);
    this.renderPromotion();
    this.updateTopBar();
  };
  if (costs.gems > 0) {
    this.showConfirmDialog({
      icon: "⬆️",
      title: `ترقية ${w.name} إلى ⭐${w.level + 1}`,
      desc: `ورشة السلاح جاهزة لترقية سلاحك. تكلفة الترقية تشمل جواهر ثمينة.`,
      cost: `${costs.gems} 💎`,
      okLabel: `⬆️ ادفع ${costs.gems} 💎`,
      onConfirm: doUpgrade
    });
  } else {
    doUpgrade();
  }
};

GameUI.prototype._openArmyYard = function() {
  const existing = document.getElementById('army-yard-overlay');
  if (existing) existing.remove();
  document.body.style.overflow = 'hidden';
  const overlay = document.createElement('div');
  overlay.id = 'army-yard-overlay';
  overlay.className = 'wl-overlay';
  overlay.style.alignItems = 'center';
  overlay.style.touchAction = 'pan-y';
  const card = document.createElement('div');
  card.className = 'weapons-library';
  card.style.cssText = 'max-width:430px;max-height:88vh;border-radius:24px;padding:20px;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;touch-action:pan-y';
  card.innerHTML = `
    <div class="wl-header">
      <div class="wl-title" style="font-size:1.3rem">💪 ساحة الجيش</div>
      <button class="wl-close-btn" id="ay-close-btn">✕</button>
    </div>
    <div class="army-yard-content" id="army-yard-content"></div>
  `;
  card.querySelector('#ay-close-btn').addEventListener('click', () => {
    overlay.remove();
    document.body.style.overflow = '';
  });
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.remove();
      document.body.style.overflow = '';
    }
  });
  overlay.appendChild(card);
  document.body.appendChild(overlay);
  this._renderArmyYardPage();
};

GameUI.prototype._openShop = function() {
  const existing = document.getElementById('shop-overlay');
  if (existing) existing.remove();
  document.body.style.overflow = 'hidden';
  const overlay = document.createElement('div');
  overlay.id = 'shop-overlay';
  overlay.className = 'wl-overlay';
  overlay.style.alignItems = 'center';
  overlay.style.touchAction = 'pan-y';
  const card = document.createElement('div');
  card.className = 'weapons-library';
  card.style.cssText = 'max-width:430px;max-height:88vh;border-radius:24px;padding:20px;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;touch-action:pan-y';
  card.innerHTML = `
    <div class="wl-header">
      <div class="wl-title" style="font-size:1.3rem">🛒 المتجر</div>
      <button class="wl-close-btn" id="shop-close-btn">✕</button>
    </div>
    <div class="shop-content" id="shop-content"></div>
  `;
  card.querySelector('#shop-close-btn').addEventListener('click', () => {
    overlay.remove();
    document.body.style.overflow = '';
  });
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.remove();
      document.body.style.overflow = '';
    }
  });
  overlay.appendChild(card);
  document.body.appendChild(overlay);
  this._renderShopPage();
};

GameUI.prototype._renderShopPage = function() {
  const container = document.getElementById('shop-content');
  if (!container) return;
  const eco = this.economy;
  const artifacts = eco.resources.artifacts || 0;
  const scrolls = eco.resources.scrolls || 0;
  const hammers = eco.resources.hammers || 0;
  const desertGem = eco.resources.desertGem || 0;

  let html = `
    <div class="shop-summary" style="background:var(--bg-card);border-radius:14px;padding:10px;margin-bottom:12px;border:1px solid var(--border-light);text-align:center;box-shadow:var(--shadow-card)">
      <div style="display:flex;justify-content:space-around;gap:8px">
        <div><span style="font-size:0.65rem;color:var(--text-secondary)">🏺 قطع أثرية</span><br><span style="font-size:1rem;font-weight:900;color:#8e44ad">${artifacts}</span></div>
        <div><span style="font-size:0.65rem;color:var(--text-secondary)">📜 مخطوطات</span><br><span style="font-size:1rem;font-weight:900;color:#f39c12">${scrolls}</span></div>
        <div><span style="font-size:0.65rem;color:var(--text-secondary)">🔨 مطارق</span><br><span style="font-size:1rem;font-weight:900;color:#e74c3c">${hammers}</span></div>
        <div><span style="font-size:0.65rem;color:var(--text-secondary)">💠 جوهرة</span><br><span style="font-size:1rem;font-weight:900;color:#00ffff">${desertGem}</span></div>
      </div>
    </div>

    <div class="shop-section-title">🏺 تجارة القطع الأثرية</div>
    <div style="margin-bottom:10px;font-size:0.65rem;color:var(--text-secondary);text-align:center">بيع قطعك الأثرية ومخطوطاتك للحصول على المال والذهب</div>
  `;

  // 🏺 بيع القطع الأثرية
  const sellItems = [
    { id: 'sell_artifact', icon: '🏺', name: 'بيع قطعة أثرية', desc: '1 🏺 → 500 💵', price: 500, resource: 'artifacts', cost: 1 },
    { id: 'sell_scroll', icon: '📜', name: 'بيع مخطوطة', desc: '1 📜 → 100 🪙', price: 100, resource: 'scrolls', cost: 1, currency: 'gold' },
    { id: 'sell_hammer', icon: '🔨', name: 'بيع مطرقة', desc: '1 🔨 → 200 💵', price: 200, resource: 'hammers', cost: 1 },
    { id: 'buy_scroll', icon: '📜', name: 'شراء مخطوطة', desc: '500 💵 → 1 📜', price: 500, resource: 'scrolls', cost: 0, isBuy: true },
    { id: 'buy_hammer', icon: '🔨', name: 'شراء مطرقة', desc: '800 💵 → 1 🔨', price: 800, resource: 'hammers', cost: 0, isBuy: true },
    { id: 'heal_potion', icon: '🧪', name: 'جرعة علاج', desc: '50 💵 → +30 HP', price: 50, resource: 'heal', cost: 0, isBuy: true, isHeal: true },
  ];

  for (const item of sellItems) {
    let canAfford = false;
    let label = '';
    if (item.isHeal) {
      canAfford = eco.canAfford('cash', item.price) && this.world?.leader;
      label = canAfford ? 'شراء' : 'غير كافٍ';
    } else if (item.isBuy) {
      canAfford = eco.canAfford('cash', item.price);
      label = canAfford ? 'شراء' : 'غير كافٍ';
    } else {
      canAfford = (eco.resources[item.resource] || 0) >= item.cost;
      label = canAfford ? 'بيع' : 'ليس لديك';
    }

    html += `
      <div class="shop-item${canAfford ? ' shop-item-available' : ' shop-item-locked'}" style="display:flex;align-items:center;gap:8px;">
        <div style="font-size:1.5rem;min-width:36px;text-align:center">${item.icon}</div>
        <div style="flex:1">
          <div style="font-size:0.8rem;font-weight:700;color:var(--text-primary)">${item.name}</div>
          <div style="font-size:0.65rem;color:var(--text-secondary)">${item.desc}</div>
        </div>
        <div style="text-align:center;min-width:70px">
          <button class="shop-buy-btn" data-shop="${item.id}" ${canAfford ? '' : 'disabled'} style="padding:5px 12px;font-size:0.7rem;font-weight:700;background:${canAfford ? 'var(--accent-red)' : '#666'};color:#fff;border:none;border-radius:8px;cursor:pointer;font-family:inherit">${label}</button>
        </div>
      </div>`;
  }

  html += `
    <div class="shop-section-title" style="margin-top:16px">💎 صرف العملات</div>
    <div style="margin-bottom:10px;font-size:0.65rem;color:var(--text-secondary);text-align:center">حوّل بين العملات المختلفة</div>
  `;

  // 💰 صرف العملات
  const exchanges = [
    { id: 'exchange_gold_cash', icon: '🔄', name: 'ذهب → مال', desc: '1 🪙 → 10 💵', from: 'gold', to: 'cash', rate: 10 },
    { id: 'exchange_cash_gold', icon: '🔄', name: 'مال → ذهب', desc: '50 💵 → 1 🪙', from: 'cash', to: 'gold', rate: 0.02 },
    { id: 'exchange_gems_cash', icon: '💎', name: 'جوهرة → مال', desc: '1 💎 → 200 💵', from: 'gems', to: 'cash', rate: 200 },
  ];

  for (const ex of exchanges) {
    const canEx = ex.from === 'gold' ? eco.canAfford('gold', 1) :
                   ex.from === 'cash' ? eco.canAfford('cash', 50) :
                   eco.canAfford('gems', 1);
    html += `
      <div class="shop-item${canEx ? ' shop-item-available' : ' shop-item-locked'}" style="display:flex;align-items:center;gap:8px;">
        <div style="font-size:1.5rem;min-width:36px;text-align:center">${ex.icon}</div>
        <div style="flex:1">
          <div style="font-size:0.8rem;font-weight:700;color:var(--text-primary)">${ex.name}</div>
          <div style="font-size:0.65rem;color:var(--text-secondary)">${ex.desc}</div>
        </div>
        <div style="text-align:center;min-width:70px">
          <button class="shop-exchange-btn" data-shop="${ex.id}" ${canEx ? '' : 'disabled'} style="padding:5px 12px;font-size:0.7rem;font-weight:700;background:${canEx ? 'var(--accent-red)' : '#666'};color:#fff;border:none;border-radius:8px;cursor:pointer;font-family:inherit">صرف</button>
        </div>
      </div>`;
  }

  container.innerHTML = html;

  // ربط أزرار البيع/الشراء
  container.querySelectorAll('.shop-buy-btn[data-shop]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.shop;
      switch(id) {
        case 'sell_artifact':
          if ((eco.resources.artifacts || 0) >= 1) {
            eco.spend('artifacts', 1);
            eco.addRaw('cash', 500);
            this.showNotification('🏺 بعت قطعة أثرية بـ 500 💵');
          }
          break;
        case 'sell_scroll':
          if ((eco.resources.scrolls || 0) >= 1) {
            eco.spend('scrolls', 1);
            eco.addRaw('gold', 100);
            this.showNotification('📜 بعت مخطوطة بـ 100 🪙');
          }
          break;
        case 'sell_hammer':
          if ((eco.resources.hammers || 0) >= 1) {
            eco.spend('hammers', 1);
            eco.addRaw('cash', 200);
            this.showNotification('🔨 بعت مطرقة بـ 200 💵');
          }
          break;
        case 'buy_scroll':
          if (eco.canAfford('cash', 500)) {
            eco.spend('cash', 500);
            eco.addRaw('scrolls', 1);
            this.showNotification('📜 اشتريت مخطوطة بـ 500 💵');
          }
          break;
        case 'buy_hammer':
          if (eco.canAfford('cash', 800)) {
            eco.spend('cash', 800);
            eco.addRaw('hammers', 1);
            this.showNotification('🔨 اشتريت مطرقة بـ 800 💵');
          }
          break;
        case 'heal_potion':
          if (eco.canAfford('cash', 50) && this.world?.leader) {
            eco.spend('cash', 50);
            this.world.leader.hp = Math.min(this.world.leader.maxHp, this.world.leader.hp + 30);
            this.showNotification('🧪 استخدمت جرعة علاج! +30 HP');
          }
          break;
      }
      this._renderShopPage();
      this.updateTopBar();
    });
  });

  // ربط أزرار الصرف
  container.querySelectorAll('.shop-exchange-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.shop;
      switch(id) {
        case 'exchange_gold_cash':
          if (eco.canAfford('gold', 1)) {
            eco.spend('gold', 1);
            eco.addRaw('cash', 10);
            this.showNotification('🔄 صرفت 1 🪙 → 10 💵');
          }
          break;
        case 'exchange_cash_gold':
          if (eco.canAfford('cash', 50)) {
            eco.spend('cash', 50);
            eco.addRaw('gold', 1);
            this.showNotification('🔄 صرفت 50 💵 → 1 🪙');
          }
          break;
        case 'exchange_gems_cash':
          if (!eco.canAfford('gems', 1)) break;
          this.showConfirmDialog({
            icon: "💎",
            title: "💰 صرف جوهرة → فلوس",
            desc: "التاجر الغريب يعرض عليك صرف جوهرة واحدة بـ 200 💵. هل توافق؟",
            cost: "1 💎 ← 200 💵",
            okLabel: "✅ صرف 1 💎",
            onConfirm: () => {
              eco.spend('gems', 1);
              eco.addRaw('cash', 200);
              this.showNotification('💎 صرفت 1 💎 → 200 💵');
              this._renderShopPage();
              this.updateTopBar();
            }
          });
          return;
      }
      this._renderShopPage();
      this.updateTopBar();
    });
  });
};

GameUI.prototype._renderArmyYardPage = function() {
  const container = document.getElementById("army-yard-content");
  if (!container) return;
  container.textContent = "";
  const army = this.army;
  if (!army) {
    container.innerHTML = `<div class="empty-state">النظام العسكري غير متاح</div>`;
    return;
  }
  const unitLvl = army.unitLevel || 1;
  const maxUnitLvl = army.maxUnitLevel || 100;
  const unitCost = army.unitUpgradeCost || 0;
  const trainLvl = army.trainingLevel || 1;
  const maxTrainLvl = army.maxTrainingLevel || 20;
  const trainCost = army.trainingUpgradeCost || 0;
  const canUnit = unitLvl < maxUnitLvl && this.economy.canAfford('cash', unitCost);
  const canTrain = trainLvl < maxTrainLvl && this.economy.canAfford('gold', trainCost);
  container.innerHTML = `
    <div class="ay-section">
      <div class="ay-section-title">⚔️ ترقية الوحدات</div>
      <div class="ay-card">
        <div class="ay-row">
          <span class="ay-label">مستوى الجنود</span>
          <span class="ay-value">${unitLvl}/${maxUnitLvl}</span>
        </div>
        <div class="ay-track"><div class="ay-fill" style="width:${(unitLvl/maxUnitLvl)*100}%"></div></div>
        <div class="ay-row">
          <span class="ay-label">قوة الوحدة</span>
          <span class="ay-value">👊 ${Math.round(army.unitPower)}</span>
        </div>
        <div class="ay-row">
          <span class="ay-label">التكلفة</span>
          <span class="ay-value">💵 ${unitCost}</span>
        </div>
        <button class="ay-btn ${canUnit ? '' : 'disabled'}" id="ay-unit-btn" ${canUnit ? '' : 'disabled'}>
          ${unitLvl >= maxUnitLvl ? '⭐ المستوى الأقصى' : (canUnit ? '▲ ترقية الجنود' : '💰 المال غير كاف')}
        </button>
      </div>
    </div>
    <div class="ay-section">
      <div class="ay-section-title">🎯 تطوير التدريب</div>
      <div class="ay-card">
        <div class="ay-row">
          <span class="ay-label">مستوى التدريب</span>
          <span class="ay-value">${trainLvl}/${maxTrainLvl}</span>
        </div>
        <div class="ay-track"><div class="ay-fill" style="width:${(trainLvl/maxTrainLvl)*100}%"></div></div>
        <div class="ay-row">
          <span class="ay-label">مضاعف القوة</span>
          <span class="ay-value">×${(1 + trainLvl * 0.05).toFixed(2)}</span>
        </div>
        <div class="ay-row">
          <span class="ay-label">التكلفة</span>
          <span class="ay-value">🪙 ${trainCost}</span>
        </div>
        <button class="ay-btn ${canTrain ? '' : 'disabled'}" id="ay-train-btn" ${canTrain ? '' : 'disabled'}>
          ${trainLvl >= maxTrainLvl ? '⭐ المستوى الأقصى' : (canTrain ? '▲ تطوير التدريب' : '💰 الذهب غير كاف')}
        </button>
      </div>
    </div>
    <div class="ay-section">
      <div class="ay-section-title">📊 إجمالي القوة العسكرية</div>
      <div class="ay-summary">
        <span>⚔️ قوة الوحدات: ${Math.round(army.unitPower)}</span>
        <span>🗡️ قوة الأسلحة: ${Math.round(army.weaponPower)}</span>
        <span>💪 القوة الإجمالية: ${Math.round(army.totalArmyPower)}</span>
      </div>
    </div>
  `;
  document.getElementById("ay-unit-btn")?.addEventListener("click", () => {
    if (army.upgradeUnits()) {
      this._renderArmyYardPage();
      this.updateTopBar();
      this.showNotification(`⬆️ مستوى الجنود → ${army.unitLevel}`);
    }
  });
  document.getElementById("ay-train-btn")?.addEventListener("click", () => {
    if (army.upgradeTraining()) {
      this._renderArmyYardPage();
      this.updateTopBar();
      this.showNotification(`⬆️ مستوى التدريب → ${army.trainingLevel}`);
    }
  });
};

GameUI.prototype._renderFullRewardsPage = function() {
  const container = document.getElementById("rewards-content");
  if (!container) return;
  container.textContent = "";
  const dl = this.dailyLogin;
  const ach = this.achievements;
  const dlState = dl ? dl.getState() : null;
  const allAchievements = ach ? ach.getAll() : [];
  const completed = allAchievements.filter(a => a.completed).length;
  const total = allAchievements.length;
  let html = `<div class="rw-section"><div class="rw-section-title">📅 المكافأة اليومية</div><div class="rw-daily-grid">`;
  const rewards = dlState?.rewards || [];
  const currentDay = dlState?.currentDay || 0;
  const canClaim = dlState?.canClaim;
  const today = new Date().toDateString();
  const lastClaim = dlState?.lastClaimDate || "";
  const isNewDay = lastClaim !== today;
  for (let i = 0; i < rewards.length; i++) {
    const r = rewards[i];
    const dayNum = i + 1;
    const isClaimed = dayNum <= currentDay;
    const isToday = dayNum === currentDay + 1 && isNewDay;
    html += `<div class="rw-day-card ${isClaimed ? 'claimed' : (isToday ? 'today' : 'locked')}">
      <div class="rw-day-num">اليوم ${dayNum}</div>
      <div class="rw-day-icon">${r.icon}</div>
      <div class="rw-day-label">${r.label}</div>
      ${isClaimed ? '<div class="rw-day-check">✅</div>' : ''}
    </div>`;
  }
  html += `</div>`;
  if (canClaim) {
    html += `<button class="rw-claim-btn" id="rw-daily-claim">📦 استلم المكافأة اليومية</button>`;
  } else {
    html += `<div class="rw-daily-done">✅ تم استلام مكافأة اليوم — عد غداً</div>`;
  }
  html += `</div>`;
  html += `<div class="rw-section"><div class="rw-section-title">🏆 الإنجازات (${completed}/${total})</div><div class="rw-ach-grid">`;
  for (const a of allAchievements) {
    const isClaimed = a.claimed;
    const isCompleted = a.completed;
    const pct = a.target > 0 ? Math.min(100, (a.progress / a.target) * 100) : 0;
    const rewardsStr = a.reward ? Object.entries(a.reward).map(([k, v]) => {
      const icons = { gold: '🪙', cash: '💵', gems: '💎' };
      return `${icons[k] || '📦'}${v}`;
    }).join(' ') : '';
    html += `<div class="rw-ach-card ${isClaimed ? 'claimed' : ''}">
      <div class="rw-ach-icon">${a.icon}</div>
      <div class="rw-ach-info">
        <div class="rw-ach-title">${a.title}</div>
        <div class="rw-ach-desc">${a.desc}</div>
        <div class="rw-ach-track"><div class="rw-ach-fill" style="width:${pct}%"></div></div>
        <div class="rw-ach-progress">${Math.min(a.progress, a.target)}/${a.target}</div>
        <div class="rw-ach-reward">${rewardsStr}</div>
      </div>
      ${isCompleted && !isClaimed ? `<button class="rw-ach-claim-btn" data-ach-id="${a.id}">📦 استلم</button>` : (isClaimed ? '<div class="rw-ach-done">✅</div>' : '')}
    </div>`;
  }
  html += `</div></div>`;
  container.innerHTML = html;
  document.getElementById("rw-daily-claim")?.addEventListener("click", () => {
    if (dl && dl.claim()) {
      this._renderFullRewardsPage();
      this.updateTopBar();
      this.showNotification('✅ تم استلام المكافأة اليومية!');
    } else {
      this.showNotification('❌ المكافأة مستلمة مسبقاً');
    }
  });
  container.querySelectorAll(".rw-ach-claim-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.achId;
      if (ach && ach.claim(id)) {
        this._renderFullRewardsPage();
        this.updateTopBar();
        this.showNotification('✅ تم استلام مكافأة الإنجاز!');
      }
    });
  });
};

}
