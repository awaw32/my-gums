const TOTAL_ROSES = 5;
const PETALS_PER_ROSE = 8;
const TOTAL_PETALS = TOTAL_ROSES * PETALS_PER_ROSE;

const WEAPON_ICONS = ['🗡️', '🏹', '🔱', '⚔️', '🔥', '⚒️'];

export class WeaponsLibrary {
  constructor(weapons, economy, ui, username) {
    this.weapons = weapons;
    this.economy = economy;
    this.ui = ui;
    this.username = username;
    this.container = null;
  }

  static createRose(upgradeLevel, roseIndex) {
    const totalLitPetals = upgradeLevel;
    const petalStart = roseIndex * PETALS_PER_ROSE;
    const cx = 20, cy = 20;
    let svg = `<svg class="rose-svg" viewBox="0 0 40 40">`;
    for (let i = 0; i < 8; i++) {
      const petalGlobalIndex = petalStart + i;
      const isLit = petalGlobalIndex < totalLitPetals;
      const angle = i * 45;
      svg += `<ellipse class="petal ${isLit ? 'lit' : 'unlit'}" cx="${cx}" cy="${cy - 4.5}" rx="2.5" ry="9" transform="rotate(${angle} ${cx} ${cy})"/>`;
    }
    const centerLit = petalStart < totalLitPetals;
    svg += `<circle class="rose-center ${centerLit ? 'lit' : 'unlit'}" cx="${cx}" cy="${cy}" r="2.5"/>`;
    svg += `</svg>`;
    return svg;
  }

  static calculatePrice(basePrice, currentLevel) {
    const multiplier = 1 + Math.floor(currentLevel / 3) * 0.5;
    return Math.floor(basePrice * multiplier);
  }

  render() {
    const overlay = document.createElement('div');
    overlay.className = 'wl-overlay';
    overlay.id = 'weapons-library-overlay';

    const lib = document.createElement('div');
    lib.className = 'weapons-library';

    lib.innerHTML = `
      <div class="wl-header">
        <h2 class="wl-title">⚔ مكتبة القطع الأسطورية</h2>
        <button class="wl-close-btn" id="wl-close-btn">✕</button>
      </div>
      <div class="weapons-grid" id="wl-grid"></div>
      <div class="wl-hint">— اضغط على السلاح لترقيته —</div>
    `;

    overlay.appendChild(lib);

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.close();
    });

    this.container = overlay;
    this.renderWeapons();

    overlay.querySelector('#wl-close-btn').addEventListener('click', () => this.close());

    return overlay;
  }

  renderWeapons() {
    const grid = this.container.querySelector('#wl-grid');
    if (!grid) return;
    grid.innerHTML = '';

    this.weapons.forEach((w, index) => {
      const isMax = w.upgradeLevel >= TOTAL_PETALS;
      const isLocked = w.upgradeLevel === 0;
      const currentPrice = WeaponsLibrary.calculatePrice(w.gemCost, w.upgradeLevel);

      let rosesHTML = '';
      for (let i = 0; i < TOTAL_ROSES; i++) {
        rosesHTML += WeaponsLibrary.createRose(w.upgradeLevel, i);
      }

      const card = document.createElement('div');
      card.className = `weapon-card${isLocked ? ' locked' : ''}${isMax ? ' maxed' : ''}`;

      card.innerHTML = `
        <div class="weapon-frame">
          <div class="status-badge">${isMax ? 'مكتمل' : (isLocked ? 'مغلق' : w.desc || 'نشط')}</div>
          ${isMax ? '<div class="max-badge">🔥 MAX</div>' : ''}
          <div class="weapon-image">${WEAPON_ICONS[index]}</div>
        </div>
        <div class="weapon-name">${w.name}</div>
        <div class="roses-container">${rosesHTML}</div>
        <div class="upgrade-info">
          ${isMax ? '⭐ المستوى الأقصى' : (isLocked ? '🔒 مقفل — اضغط لفتح' : `الترقية ${w.upgradeLevel}/${TOTAL_PETALS}`)}
        </div>
        <button class="upgrade-button ${isMax ? 'maxed' : ''}" data-index="${index}" ${isMax ? 'disabled' : ''}>
          <span>${isMax ? '⭐ أقصى ترقية' : (isLocked ? '🔓 فتح' : '▲ ترقية')}</span>
          <span class="price-tag">${isMax ? '✓' : currentPrice.toLocaleString('ar-SA') + ' 💎'}</span>
        </button>
      `;

      card.querySelector('.upgrade-button').addEventListener('click', (e) => {
        e.stopPropagation();
        this.handleUpgrade(index);
      });

      grid.appendChild(card);
    });
  }

  handleUpgrade(index) {
    const w = this.weapons[index];
    if (!w || w.upgradeLevel >= TOTAL_PETALS) return;

    const houseLevel = this.ui._landsState?.['b1']?.level || 1;
    if (!w.canUpgrade(this.economy, houseLevel)) {
      if (houseLevel < w.requireLevel) {
        this.ui.showNotification(`❌ يحتاج بيت الزعيم المستوى ${w.requireLevel}`);
      } else {
        this.ui.showNotification('❌ مجوهرات غير كافية');
      }
      return;
    }

    w.upgrade(this.economy, houseLevel);
    this.renderWeapons();
    this.ui.updateTopBar();
    this.ui._scheduleSave();

    if (w.upgradeLevel >= TOTAL_PETALS) {
      this.ui.showNotification(`🔥 ${w.name} — أقصى ترقية!`);
    } else {
      this.ui.showNotification(`⬆️ ${w.name} → ${w.upgradeLevel}/${TOTAL_PETALS}`);
    }
  }

  close() {
    if (this.container) {
      this.container.remove();
      this.container = null;
      document.body.style.overflow = '';
    }
    this.ui?._promotionShowHub();
  }
}
