"use strict";

/**
 * واجهة سوق الصحراء — تتصل بنظام TradeMarket
 */

import { escapeHtml } from "../dom-utils.js";

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
        <button class="market-tab" data-tab="auction">🏆 مزاد الجمعة</button>
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

      <div id="market-tab-auction" class="market-tab-content" style="display:none">
        <div id="market-auction-content"></div>
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
  this._renderAuctionTab(overlay);
  this._auctionRefreshTimer = setInterval(() => {
    if (document.getElementById('market-overlay')) this._renderAuctionTab(overlay);
    else clearInterval(this._auctionRefreshTimer);
  }, 1000);
};

// 🏆 مزاد الجمعة الأسطوري
GameUI.prototype._renderAuctionTab = function(overlay) {
  const container = overlay.querySelector('#market-auction-content');
  if (!container) return;
  const auction = this.world?._activeAuction;
  if (!auction) {
    const hasTicket = !!this.world?._hasAuctionTicket;
    container.innerHTML = `
      <div style="text-align:center;padding:30px 12px;color:#7a6a5a">
        <div style="font-size:2.2rem;margin-bottom:8px">🏆</div>
        <div style="font-weight:700;margin-bottom:4px">لا يوجد مزاد نشط حالياً</div>
        <div style="font-size:0.75rem;margin-bottom:14px">مزاد الجمعة الأسطوري يبدأ كل جمعة الساعة 8 مساءً بتوقيت السعودية!</div>
        ${hasTicket
          ? `<div style="font-size:0.75rem;color:#4cd964">🎫 معك تذكرة — ستصلك إشعار وتُفتح لك المزايدة تلقائياً قبل بدء المزاد بـ5 دقائق!</div>`
          : `<button id="auction-ticket-btn" style="padding:10px 18px;border:none;border-radius:8px;background:linear-gradient(135deg,#9b59b6,#6c3483);color:#fff;font-weight:800;cursor:pointer;font-family:inherit">🎫 اشترِ تذكرة مزاد (10 💎) — تذكير + دخول تلقائي، بلا أي أفضلية مزايدة</button>`
        }
      </div>`;
    const ticketBtn = container.querySelector('#auction-ticket-btn');
    if (ticketBtn) {
      ticketBtn.addEventListener('click', () => {
        this.world?._sendWS({ type: 'auction_ticket_buy' });
        this.world._onAuctionTicketBuyResponse = (res) => {
          if (res.ok) {
            this.world._hasAuctionTicket = true;
            this.showNotification('🎫 اشتريت تذكرة المزاد! ستُنبَّه قبل البدء بـ5 دقائق');
            this._renderAuctionTab(overlay);
          } else if (res.reason === 'insufficient_gems') {
            this.showNotification('❌ جواهر غير كافية');
          } else if (res.reason === 'already_have_ticket') {
            this.showNotification('❌ معك تذكرة بالفعل لهذا المزاد');
          } else {
            this.showNotification('❌ تعذّر شراء التذكرة');
          }
        };
      });
    }
    return;
  }
  const remainingMs = Math.max(0, auction.endsAt - Date.now());
  const mins = Math.floor(remainingMs / 60000);
  const secs = Math.floor((remainingMs % 60000) / 1000);
  const isMe = auction.currentBidder === this.world?.username;
  container.innerHTML = `
    <div style="text-align:center;padding:16px 12px">
      <div style="font-size:3rem;margin-bottom:6px">${auction.icon}</div>
      <div style="font-weight:800;font-size:1.05rem;color:#ffd700;margin-bottom:4px">${auction.name}</div>
      <div style="font-size:0.8rem;color:#9a8a6a;margin-bottom:10px">⏳ الوقت المتبقي: ${mins}:${String(secs).padStart(2, '0')}</div>
      <div style="background:rgba(212,160,23,0.1);border:1px solid #d4a01755;border-radius:12px;padding:10px;margin-bottom:12px">
        <div style="font-size:0.7rem;color:#9a8a6a">أعلى مزايدة حالياً</div>
        <div style="font-size:1.3rem;font-weight:900;color:#ffd700">${auction.currentBid} 🪙</div>
        <div style="font-size:0.75rem;color:${isMe ? '#4cd964' : '#f5e6c8'}">${auction.currentBidder ? `بواسطة: ${auction.currentBidder}${isMe ? ' (أنت!)' : ''}` : 'لا يوجد مزايدون بعد'}</div>
      </div>
      <div style="display:flex;gap:8px;justify-content:center;align-items:center">
        <input type="number" id="auction-bid-input" placeholder="مبلغ المزايدة" min="${auction.currentBid + 50}" style="flex:1;max-width:160px;padding:10px;border-radius:8px;border:1px solid #d4a01755;background:var(--bg-input,#1a1208);color:#f5e6c8;text-align:center;font-family:inherit" />
        <button id="auction-bid-btn" style="padding:10px 18px;border:none;border-radius:8px;background:linear-gradient(135deg,#d4a017,#b8860b);color:#fff;font-weight:800;cursor:pointer;font-family:inherit">زايد!</button>
      </div>
    </div>
  `;
  const bidBtn = container.querySelector('#auction-bid-btn');
  const bidInput = container.querySelector('#auction-bid-input');
  if (bidBtn && bidInput) {
    bidBtn.addEventListener('click', () => {
      const amount = parseInt(bidInput.value, 10) || 0;
      if (amount < auction.currentBid + 50) {
        this.showNotification(`❌ المزايدة يجب أن تكون ${auction.currentBid + 50} 🪙 على الأقل`);
        return;
      }
      this.world?._sendWS({ type: 'auction_bid', amount });
      this.world._onAuctionBidResponse = (res) => {
        if (res.ok) this.showNotification('✅ تمت مزايدتك بنجاح!');
        else if (res.reason === 'insufficient_gold') this.showNotification('❌ ذهب غير كافٍ');
        else if (res.reason === 'bid_too_low') this.showNotification(`❌ المزايدة منخفضة جداً — الحد الأدنى ${res.minBid} 🪙`);
        else this.showNotification('❌ تعذّرت المزايدة');
      };
    });
  }
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
        <div class="market-item-icon">${escapeHtml(l.itemIcon)}</div>
        <div class="market-item-name">${escapeHtml(l.itemName)}</div>
        <div class="market-item-rarity" style="color:${rarity.color};background:${rarity.color}15">${rarity.label}</div>
        <div class="market-item-level">Lv.${l.level}</div>
        <div class="market-item-qty">الكمية: ${l.quantity}</div>
        <div class="market-item-price">${l.pricePerUnit} 💵</div>
        <div class="market-item-seller">البائع: ${escapeHtml(l.seller)}</div>
        <button class="market-buy-btn" data-listing-id="${l.id}">🛒 شراء</button>
      </div>
    `;
  }).join('');

  // ربط أزرار الشراء — التأكيد الفعلي يصل من الخادم عبر market_buy_response
  container.querySelectorAll('.market-buy-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const listingId = btn.dataset.listingId;
      const listing = listings.find(l => l.id === listingId);
      if (!listing) return;
      if (confirm(`شراء ${listing.itemName} × ${listing.quantity} بـ ${listing.totalPrice} 💵؟`)) {
        this._tradeMarket._onListingSold = (tx) => {
          this.showNotification(`✅ تم شراء ${tx.itemName}!`);
          this.updateTopBar();
          if (document.getElementById('market-overlay')) this._renderMarketBuyListings(overlay);
        };
        this._tradeMarket._onError = (err) => this.showNotification(`❌ ${err}`);
        this._tradeMarket.buyListing(listingId, listing.quantity);
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

  // ربط أزرار البيع — التأكيد الفعلي يصل من الخادم عبر market_list_response
  container.querySelectorAll('.market-sell-list-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const itemId = btn.dataset.itemId;
      const priceInput = overlay.querySelector(`.market-sell-price-input[data-item-id="${itemId}"]`);
      const price = parseInt(priceInput?.value) || 0;
      const item = sellable.find(s => s.id === itemId);
      if (!item) return;
      if (confirm(`عرض ${item.name} × ${item.count} بـ ${price} 💵 لكل وحدة؟`)) {
        this._tradeMarket._onListingAdded = (listing) => {
          this.showNotification(`📦 تم عرض ${listing.itemName} في السوق!`);
          if (document.getElementById('market-overlay')) {
            this._renderMarketBuyListings(overlay);
            this._renderMarketSellList(overlay);
          }
        };
        this._tradeMarket._onError = (err) => this.showNotification(`❌ ${err}`);
        this._tradeMarket.listItem(itemId, item.count, price);
      }
    });
  });

  // تحديث عدد القوائم
  const myListings = this._tradeMarket.listings.filter(l => l.seller === this._tradeMarket.username && !l.sold);
  const myListingsEl = overlay.querySelector('#market-my-listings');
  if (myListingsEl) myListingsEl.textContent = `قوائمي: ${myListings.length}/10`;

  this._renderMarketMyListings(overlay, myListings);
};

// 📋 عروضي النشطة حالياً في السوق — مع إمكانية إلغاء أي عرض لم يُبَع بعد
GameUI.prototype._renderMarketMyListings = function(overlay, myListings) {
  let container = overlay.querySelector('#market-my-listings-list');
  if (!container) {
    const sellTab = overlay.querySelector('#market-tab-sell');
    if (!sellTab) return;
    container = document.createElement('div');
    container.id = 'market-my-listings-list';
    sellTab.appendChild(container);
  }
  if (!myListings || myListings.length === 0) {
    container.innerHTML = '';
    return;
  }
  container.innerHTML = `
    <div style="font-weight:700;color:#f5e6c8;margin:14px 0 8px;font-size:0.8rem">📋 عروضي النشطة</div>
    ${myListings.map(l => `
      <div class="market-sell-item" data-listing-id="${l.id}">
        <span class="market-sell-icon">${escapeHtml(l.itemIcon)}</span>
        <div class="market-sell-info">
          <div class="market-sell-name">${escapeHtml(l.itemName)}</div>
          <div class="market-sell-count">الكمية: ${l.quantity} — ${l.pricePerUnit} 💵/وحدة</div>
        </div>
        <button class="market-cancel-btn" data-listing-id="${l.id}" style="padding:8px 14px;border:1px solid var(--accent-red,#c0392b);border-radius:8px;background:transparent;color:var(--accent-red,#c0392b);font-weight:700;font-size:0.7rem;cursor:pointer;font-family:inherit">✕ إلغاء</button>
      </div>
    `).join('')}
  `;
  container.querySelectorAll('.market-cancel-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const listingId = btn.dataset.listingId;
      if (!confirm('إلغاء هذا العرض وإعادة العنصر لمخزونك؟')) return;
      this._tradeMarket._onListingRemoved = () => {
        this.showNotification('✅ أُلغي العرض وأُعيد العنصر لمخزونك');
        if (document.getElementById('market-overlay')) {
          this._renderMarketBuyListings(overlay);
          this._renderMarketSellList(overlay);
        }
      };
      this._tradeMarket._onError = (err) => this.showNotification(`❌ ${err}`);
      this._tradeMarket.removeListing(listingId);
    });
  });
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
