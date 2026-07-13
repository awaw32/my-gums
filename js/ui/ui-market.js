"use strict";

/**
 * واجهة سوق الصحراء — تتصل بنظام TradeMarket
 */

export function injectMarketMethods(GameUI) {

GameUI.prototype.buildMarketScreen = function() {
  const div = document.createElement("div");
  div.className = "screen-panel";
  div.innerHTML = `
    <div class="panel-header" style="display:flex;align-items:center;gap:8px">
      <span style="font-size:1.3rem">🏪</span>
      <span>سوق الصحراء</span>
      <button id="market-open-btn" style="margin-left:auto;padding:6px 14px;border-radius:8px;border:none;background:linear-gradient(135deg,#d4a017,#b8860b);color:#fff;font-weight:700;font-size:0.82rem;cursor:pointer;font-family:Cairo,sans-serif">🚪 دخول السوق</button>
    </div>
    <div id="market-stats-bar" style="display:flex;gap:12px;padding:8px 0;font-size:0.75rem;color:var(--text-secondary)">
      <span>📦 <span id="market-total-listings">0</span> معروض</span>
      <span>💰 <span id="market-total-value">0</span> 💵 قيمة</span>
      <span>📊 متوسط: <span id="market-avg-price">0</span> 💵</span>
    </div>
    <div id="market-content"></div>
  `;
  return div;
};

GameUI.prototype.openMarket = function() {
  const TradeMarket = this._tradeMarket;
  if (!TradeMarket) {
    this.showNotification("⚠️ السوق غير متاح حالياً");
    return;
  }

  const overlay = document.createElement("div");
  overlay.id = "market-overlay";
  overlay.className = "market-overlay";

  overlay.innerHTML = `
    <div class="market-bg" onclick="document.getElementById('market-overlay')?.remove()"></div>
    <div class="market-panel">
      <div class="market-header">
        <span class="market-title-icon">🏪</span>
        <span class="market-title">سوق الصحراء</span>
        <button class="market-close-btn" onclick="this.closest('#market-overlay')?.remove()">✕</button>
      </div>

      <div class="market-tabs">
        <button class="market-tab active" data-tab="buy">🛒 شراء</button>
        <button class="market-tab" data-tab="sell">📦 بيع</button>
        <button class="market-tab" data-tab="convert">🔄 تبادل</button>
      </div>

      <div id="market-tab-buy" class="market-tab-content">
        <div class="market-filters">
          <button class="market-filter-btn active" data-cat="all">الكل</button>
          <button class="market-filter-btn" data-cat="healing">🩹 علاج</button>
          <button class="market-filter-btn" data-cat="weapon">🗡️ أسلحة</button>
          <button class="market-filter-btn" data-cat="defense">🛡️ دفاع</button>
          <button class="market-filter-btn" data-cat="buff">💎 بونصات</button>
          <button class="market-filter-btn" data-cat="resource">📜 موارد</button>
          <button class="market-filter-btn" data-cat="special">🎫 خاص</button>
          <input class="market-search" id="market-search" placeholder="🔍 بحث..." />
        </div>
        <div class="market-listings" id="market-listings"></div>
      </div>

      <div id="market-tab-sell" class="market-tab-content" style="display:none">
        <div class="market-sell-section" id="market-sell-list"></div>
      </div>

      <div id="market-tab-convert" class="market-tab-content" style="display:none">
        <div class="market-convert-section">
          <div style="font-weight:700;color:#ffd700;margin-bottom:10px;text-align:center">🔄 تبادل الموارد</div>
          <div class="market-convert-row">
            <select class="market-convert-select" id="convert-from">
              <option value="cash">💵 المال</option>
              <option value="gold">🪙 الذهب</option>
              <option value="gems">💎 الجواهر</option>
            </select>
            <span class="market-convert-arrow">→</span>
            <select class="market-convert-select" id="convert-to">
              <option value="gold">🪙 الذهب</option>
              <option value="cash">💵 المال</option>
              <option value="gems">💎 الجواهر</option>
            </select>
          </div>
          <div class="market-convert-row">
            <input class="market-convert-input" id="convert-amount" type="number" placeholder="الكمية" min="1" />
            <span style="font-size:0.75rem;color:#9a8a6a" id="convert-preview"></span>
          </div>
          <button class="market-convert-btn" id="convert-execute-btn">🔄 تبادل الآن</button>
          <div class="market-convert-result" id="convert-result"></div>
        </div>
        <div style="padding:12px;font-size:0.75rem;color:#7a6a5a;text-align:center">
          <div style="margin-bottom:6px;font-weight:600;color:#9a8a6a">أسعار الصرف الحالية:</div>
          <div>💵 100 مال ← 🪙 20 ذهب</div>
          <div>🪙 1 ذهب ← 💵 4 مال</div>
          <div>💎 1 جوهرة ← 💵 80 مال</div>
          <div>💎 1 جوهرة ← 🪙 15 ذهب</div>
        </div>
      </div>

      <div class="market-footer">
        <span>رسوم السوق: 5%</span>
        <span id="market-my-listings">قوائمي: 0</span>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // ربط الأحداث
  this._bindMarketTabs(overlay);
  this._bindMarketFilters(overlay);
  this._bindMarketSearch(overlay);
  this._renderMarketBuyListings(overlay);
  this._renderMarketSellList(overlay);
  this._bindConvert(overlay);
};

GameUI.prototype._bindMarketTabs = function(overlay) {
  const tabs = overlay.querySelectorAll('.market-tab');
  const contents = overlay.querySelectorAll('.market-tab-content');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      contents.forEach(c => c.style.display = 'none');
      tab.classList.add('active');
      const target = overlay.querySelector(`#market-tab-${tab.dataset.tab}`);
      if (target) target.style.display = '';
    });
  });
};

GameUI.prototype._bindMarketFilters = function(overlay) {
  const btns = overlay.querySelectorAll('.market-filter-btn');
  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      btns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const cat = btn.dataset.cat;
      if (this._tradeMarket) {
        this._tradeMarket.setFilter({ category: cat });
        this._renderMarketBuyListings(overlay);
      }
    });
  });
};

GameUI.prototype._bindMarketSearch = function(overlay) {
  const input = overlay.querySelector('#market-search');
  if (input) {
    let debounce = null;
    input.addEventListener('input', () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        if (this._tradeMarket) {
          this._tradeMarket.setFilter({ search: input.value });
          this._renderMarketBuyListings(overlay);
        }
      }, 300);
    });
  }
};

GameUI.prototype._renderMarketBuyListings = function(overlay) {
  const container = overlay.querySelector('#market-listings');
  if (!container || !this._tradeMarket) return;

  const listings = this._tradeMarket.getFilteredListings();

  if (listings.length === 0) {
    container.innerHTML = '<div class="market-empty">🏪 لا توجد عناصر معروضة حالياً<br><span style="font-size:0.75rem">كن أول من يعرض عناصره!</span></div>';
    return;
  }

  const RARITY_COLORS = {
    common: { color: "#b0b0b0", label: "عادي" },
    uncommon: { color: "#4cd964", label: "غير شائع" },
    rare: { color: "#5ac8fa", label: "نادر" },
    epic: { color: "#af52de", label: "ملحمي" },
    legendary: { color: "#ff9500", label: "أسطوري" },
  };

  container.innerHTML = listings.map(l => {
    const rarity = RARITY_COLORS[l.itemRarity] || RARITY_COLORS.common;
    return `
      <div class="market-item-card" data-listing-id="${l.id}">
        <div class="market-item-icon">${l.itemIcon}</div>
        <div class="market-item-name">${l.itemName}</div>
        <div class="market-item-rarity" style="color:${rarity.color};background:${rarity.color}15">${rarity.label}</div>
        <div class="market-item-level">Lv.${l.level}</div>
        <div class="market-item-qty">الكمية: ${l.quantity}</div>
        <div class="market-item-price">${l.pricePerUnit} 💵</div>
        <div class="market-item-seller">البائع: ${l.seller}</div>
        <button class="market-buy-btn" data-listing-id="${l.id}">🛒 شراء</button>
      </div>
    `;
  }).join('');

  // ربط أزرار الشراء
  container.querySelectorAll('.market-buy-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const listingId = btn.dataset.listingId;
      const listing = listings.find(l => l.id === listingId);
      if (!listing) return;
      if (confirm(`شراء ${listing.itemName} × ${listing.quantity} بـ ${listing.totalPrice} 💵؟`)) {
        if (this._tradeMarket.buyListing(listingId, listing.quantity)) {
          this.showNotification(`✅ تم شراء ${listing.itemName}!`);
          this._renderMarketBuyListings(overlay);
          this._renderMarketSellList(overlay);
        }
      }
    });
  });

  // تحديث الإحصائيات
  const stats = this._tradeMarket.getMarketStats();
  const totalEl = overlay.querySelector('#market-total-listings');
  const valueEl = overlay.querySelector('#market-total-value');
  const avgEl = overlay.querySelector('#market-avg-price');
  if (totalEl) totalEl.textContent = stats.totalListings;
  if (valueEl) valueEl.textContent = stats.totalValue.toLocaleString();
  if (avgEl) avgEl.textContent = stats.avgPrice.toLocaleString();
};

GameUI.prototype._renderMarketSellList = function(overlay) {
  const container = overlay.querySelector('#market-sell-list');
  if (!container || !this._tradeMarket) return;

  const sellable = this._tradeMarket.getSellableItems();

  if (sellable.length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:20px;color:#7a6a5a">📦 لا توجد عناصر قابلة للبيع في مخزونك</div>';
    return;
  }

  const RARITY_COLORS = {
    common: "#b0b0b0", uncommon: "#4cd964", rare: "#5ac8fa",
    epic: "#af52de", legendary: "#ff9500",
  };

  container.innerHTML = sellable.map(item => `
    <div class="market-sell-item" data-item-id="${item.id}">
      <span class="market-sell-icon">${item.icon}</span>
      <div class="market-sell-info">
        <div class="market-sell-name" style="color:${RARITY_COLORS[item.rarity] || '#f5e6c8'}">${item.name}</div>
        <div class="market-sell-count">الكمية: ${item.count} | Lv.${item.level}</div>
      </div>
      <input class="market-sell-price-input" type="number" value="${item.suggestedPrice}" min="1" data-item-id="${item.id}" placeholder="السعر" />
      <button class="market-sell-list-btn" data-item-id="${item.id}" data-count="${item.count}">📦 عرض</button>
    </div>
  `).join('');

  // ربط أزرار البيع
  container.querySelectorAll('.market-sell-list-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const itemId = btn.dataset.itemId;
      const priceInput = overlay.querySelector(`.market-sell-price-input[data-item-id="${itemId}"]`);
      const price = parseInt(priceInput?.value) || 0;
      const item = sellable.find(s => s.id === itemId);
      if (!item) return;
      if (confirm(`عرض ${item.name} × ${item.count} بـ ${price} 💵 لكل وحدة؟`)) {
        if (this._tradeMarket.listItem(itemId, item.count, price)) {
          this.showNotification(`📦 تم عرض ${item.name} في السوق!`);
          this._renderMarketBuyListings(overlay);
          this._renderMarketSellList(overlay);
        }
      }
    });
  });

  // تحديث عدد القوائم
  const myListings = this._tradeMarket.listings.filter(l => l.seller === this._tradeMarket.username && !l.sold);
  const myListingsEl = overlay.querySelector('#market-my-listings');
  if (myListingsEl) myListingsEl.textContent = `قوائمي: ${myListings.length}/10`;
};

GameUI.prototype._bindConvert = function(overlay) {
  const fromSelect = overlay.querySelector('#convert-from');
  const toSelect = overlay.querySelector('#convert-to');
  const amountInput = overlay.querySelector('#convert-amount');
  const previewEl = overlay.querySelector('#convert-preview');
  const resultEl = overlay.querySelector('#convert-result');
  const executeBtn = overlay.querySelector('#convert-execute-btn');

  const rates = {
    cash_to_gold: 0.2, gold_to_cash: 4,
    cash_to_gems: 0.01, gems_to_cash: 80,
    gold_to_gems: 0.05, gems_to_gold: 15,
  };

  const updatePreview = () => {
    const from = fromSelect?.value;
    const to = toSelect?.value;
    const amount = parseInt(amountInput?.value) || 0;
    const rate = rates[`${from}_to_${to}`];
    if (rate && amount > 0) {
      const result = Math.floor(amount * rate);
      if (previewEl) previewEl.textContent = `← ${result} ${to === 'cash' ? '💵' : to === 'gold' ? '🪙' : '💎'}`;
    } else {
      if (previewEl) previewEl.textContent = '';
    }
  };

  if (fromSelect) fromSelect.addEventListener('change', updatePreview);
  if (toSelect) toSelect.addEventListener('change', updatePreview);
  if (amountInput) amountInput.addEventListener('input', updatePreview);

  if (executeBtn) {
    executeBtn.addEventListener('click', () => {
      const from = fromSelect?.value;
      const to = toSelect?.value;
      const amount = parseInt(amountInput?.value) || 0;
      if (from === to) {
        this.showNotification("❌ لا يمكنك صرف مورد في نفسه");
        return;
      }
      if (this._tradeMarket) {
        const result = this._tradeMarket.convertResource(from, to, amount);
        if (result && result.success) {
          const icons = { cash: '💵', gold: '🪙', gems: '💎' };
          this.showNotification(`✅ تم الصرف! حصلت على ${result.received} ${icons[to]}`);
          if (resultEl) resultEl.textContent = `✅ حصلت على ${result.received} ${icons[to]}`;
          updatePreview();
          this.updateTopBar();
        }
      }
    });
  }
};

} // end injectMarketMethods
