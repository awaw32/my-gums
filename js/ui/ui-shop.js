"use strict";

/**
 * js/ui/ui-shop.js
 * ============================================================================
 * 🎨 متجر المظاهر — Cosmetics Shop (بصري بحت، لا يُباع فيه أي قوة إطلاقاً)
 * 3 أقسام: مظاهر سيوف، مظاهر جمال (تظهر في ملفك الشخصي)، ألقاب ملوّنة تظهر
 * للجميع. كل عملية شراء/تجهيز تُرسل للسيرفر (cosmetic_purchase/cosmetic_equip)
 * الذي يخصم gems ويتحقق من الملكية فعلياً — لا شيء يُطبَّق محلياً قبل تأكيد الخادم.
 * ============================================================================
 */

const COSMETIC_CATALOG = [
  { id: "sword_black", category: "sword", name: "جلد السيف الأسود", icon: "🗡️", price: 40, color: "#1a1a1a" },
  { id: "sword_gold", category: "sword", name: "جلد السيف الذهبي", icon: "🗡️", price: 80, color: "#FFD700" },
  { id: "camel_white", category: "camel", name: "جمل أبيض", icon: "🐪", price: 30, color: "#f5f5f5" },
  { id: "camel_black", category: "camel", name: "جمل أسود", icon: "🐪", price: 30, color: "#2c2c2c" },
  { id: "title_ruby", category: "title", name: "لقب ياقوتي", icon: "👑", price: 60, color: "#e74c3c" },
  { id: "title_emerald", category: "title", name: "لقب زمرّدي", icon: "👑", price: 60, color: "#2ecc71" },
  { id: "title_sapphire", category: "title", name: "لقب ياقوت أزرق", icon: "👑", price: 60, color: "#3498db" },
];

const CATEGORY_LABELS = {
  sword: "🗡️ مظاهر السيوف",
  camel: "🐪 مظاهر الجمال",
  title: "👑 ألقاب ملوّنة",
};

export function injectShopMethods(GameUI) {

GameUI.prototype.buildCosmeticsShopScreen = function() {
  const div = document.createElement("div");
  div.className = "screen-panel";
  div.innerHTML = `
    <div class="panel-header" style="display:flex;align-items:center;gap:8px">
      <span style="font-size:1.3rem">🎨</span>
      <span>متجر المظاهر</span>
      <button id="cosmetics-shop-open-btn" style="margin-left:auto;padding:6px 14px;border-radius:8px;border:none;background:linear-gradient(135deg,#9b59b6,#6c3483);color:#fff;font-weight:700;font-size:0.82rem;cursor:pointer;font-family:Cairo,sans-serif">🚪 دخول المتجر</button>
    </div>
    <div style="padding:8px 0;font-size:0.75rem;color:var(--text-secondary);text-align:center">
      كل شيء هنا بصري بحت — لا يزيد قوة ولا ذهباً ولا موارد، فقط مظهرك يا بطل!
    </div>
  `;
  return div;
};

GameUI.prototype.renderCosmeticsShop = function() {
  const openBtn = document.getElementById('cosmetics-shop-open-btn');
  if (openBtn && !openBtn._boundOpen) {
    openBtn._boundOpen = true;
    openBtn.addEventListener('click', () => this.openCosmeticsShop());
  }
};

GameUI.prototype.openCosmeticsShop = function() {
  const existing = document.getElementById('cosmetics-shop-overlay');
  if (existing) existing.remove();
  document.body.style.overflow = 'hidden';

  const overlay = document.createElement('div');
  overlay.id = 'cosmetics-shop-overlay';
  overlay.className = 'market-overlay';
  overlay.innerHTML = `
    <div class="market-bg" onclick="document.getElementById('cosmetics-shop-overlay')?.remove(); document.body.style.overflow='';"></div>
    <div class="market-panel">
      <div class="market-header">
        <span class="market-title-icon">🎨</span>
        <span class="market-title">متجر المظاهر</span>
        <button class="market-close-btn" id="cosmetics-shop-close-btn">✕</button>
      </div>
      <div style="padding:6px 12px;font-size:0.72rem;color:#9a8a6a;text-align:center">
        💎 رصيدك: <span id="cosmetics-gems-balance">0</span> جوهرة — بصري 100%، ممنوع بيع قوة
      </div>
      <div id="cosmetics-shop-content" style="padding:8px 12px;overflow-y:auto;flex:1"></div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.querySelector('#cosmetics-shop-close-btn').addEventListener('click', () => {
    overlay.remove();
    document.body.style.overflow = '';
  });

  this._renderCosmeticsShop(overlay);
};

GameUI.prototype._renderCosmeticsShop = function(overlay) {
  const container = overlay.querySelector('#cosmetics-shop-content');
  const balanceEl = overlay.querySelector('#cosmetics-gems-balance');
  if (!container) return;
  if (balanceEl) balanceEl.textContent = (this.economy?.gems || 0).toLocaleString();

  const owned = this.world?._myCosmetics?.owned || [];
  const equipped = this.world?._myCosmetics || {};

  let html = '';
  for (const category of ['sword', 'camel', 'title']) {
    html += `<div style="font-weight:800;color:#f5e6c8;margin:12px 0 8px;font-size:0.85rem">${CATEGORY_LABELS[category]}</div>`;
    html += `<div style="display:flex;flex-direction:column;gap:8px">`;
    for (const item of COSMETIC_CATALOG.filter(i => i.category === category)) {
      const isOwned = owned.includes(item.id);
      const isEquipped = (category === 'sword' && equipped.swordSkin === item.id) ||
        (category === 'camel' && equipped.camelSkin === item.id) ||
        (category === 'title' && equipped.titleColor === item.id);
      html += `
        <div style="display:flex;align-items:center;gap:10px;background:var(--bg-card,#1a1208);border:2px solid ${isEquipped ? item.color : 'var(--border-light,#3a2f1f)'};border-radius:12px;padding:10px">
          <div style="font-size:1.6rem;width:36px;text-align:center">${item.icon}</div>
          <div style="flex:1">
            <div style="font-weight:700;font-size:0.8rem;color:${item.color}">${item.name}</div>
            <div style="font-size:0.65rem;color:#9a8a6a">${isOwned ? (isEquipped ? '✔ مجهّز حالياً' : 'مملوك') : `${item.price} 💎`}</div>
          </div>
          <button class="cosmetic-action-btn" data-item="${item.id}" data-owned="${isOwned}" style="padding:8px 14px;border:none;border-radius:8px;font-size:0.72rem;font-weight:800;cursor:pointer;font-family:inherit;background:${isEquipped ? '#4a4a4a' : `linear-gradient(135deg,${item.color},#5a3d2b)`};color:#fff" ${isEquipped ? 'disabled' : ''}>
            ${isEquipped ? '✔ مجهّز' : (isOwned ? '🏹 تجهيز' : '🛒 شراء')}
          </button>
        </div>`;
    }
    html += `</div>`;
  }
  container.innerHTML = html;

  container.querySelectorAll('.cosmetic-action-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const itemId = btn.dataset.item;
      const isOwned = btn.dataset.owned === 'true';
      if (isOwned) {
        this.world?._sendWS({ type: 'cosmetic_equip', itemId });
        this.world._onCosmeticEquipResponse = (res) => {
          if (res.ok) {
            this.showNotification('✔ تم تجهيز المظهر!');
            this._renderCosmeticsShop(overlay);
          } else {
            this.showNotification('❌ تعذّر التجهيز');
          }
        };
      } else {
        this.world?._sendWS({ type: 'cosmetic_purchase', itemId });
        this.world._onCosmeticPurchaseResponse = (res) => {
          if (res.ok) {
            if (!this.world._myCosmetics) this.world._myCosmetics = { swordSkin: '', camelSkin: '', titleColor: '', owned: [] };
            this.world._myCosmetics.owned.push(itemId);
            this.economy.gems = res.gemsRemaining;
            this.showNotification(`✅ اشتريت ${res.item?.name || 'مظهراً'}!`);
            this.updateTopBar();
            this._renderCosmeticsShop(overlay);
          } else if (res.reason === 'insufficient_gems') {
            this.showNotification('❌ جواهر غير كافية');
          } else if (res.reason === 'already_owned') {
            this.showNotification('❌ تملك هذا المظهر بالفعل');
          } else {
            this.showNotification('❌ تعذّر الشراء');
          }
        };
      }
    });
  });
};

} // end injectShopMethods

export { COSMETIC_CATALOG };
