export class WorldUpgradesUI {
  constructor(world) {
    this.world = world;
    this.store = world.store;
    this.apiBase = world.apiBase || "";
    this._defs = {};
    this._createDOM();
  }

  _createDOM() {
    this._overlay = document.createElement("div");
    this._overlay.id = "wu-overlay";
    this._overlay.className = "wu-overlay hidden";
    this._overlay.innerHTML = `<div class="wu-card" id="wu-card"><div class="wu-body" id="wu-body"></div></div>`;
    this._overlay.addEventListener("click", (e) => {
      if (e.target === this._overlay) this.hide();
    });
    document.body.appendChild(this._overlay);
    this._body = this._overlay.querySelector("#wu-body");
  }

  hide() {
    this._overlay.classList.add("hidden");
    this._body.innerHTML = "";
  }

  _showLoading() {
    this._body.innerHTML = `<div class="wu-loading">جاري التحميل...</div>`;
    this._overlay.classList.remove("hidden");
  }

  _showError(msg) {
    this._body.innerHTML = `<div class="wu-error">${msg}</div><button class="wu-btn-close" data-action="close">إغلاق</button>`;
    this._bindActions();
  }

  _bindActions() {
    this._body.querySelectorAll("[data-action]").forEach(el => {
      el.addEventListener("click", () => {
        const a = el.dataset.action;
        if (a === "close") this.hide();
      });
    });
  }

  _sendWS(msg) {
    if (this.world.netSync) this.world.netSync.send(msg);
  }

  _notify(text, isError) {
    if (this.store) this.store.set("notification", { text: `${isError ? "❌ " : "✅ "}${text}`, t: Date.now() });
  }

  _costRow(resources) {
    return Object.entries(resources).map(([k, v]) => {
      const icons = { cash: "💵", gold: "🪙", gems: "💎", scrolls: "📜", hammers: "🔨", artifact: "🏺", desertGem: "💠" };
      return `<span class="wu-cost"><span class="wu-cost-icon">${icons[k] || "📦"}</span>${v}</span>`;
    }).join(" ");
  }

  _hasResources(cost) {
    const e = this.world.economy;
    if (!e) return false;
    for (const [k, v] of Object.entries(cost)) {
      if ((e[k] || 0) < v) return false;
    }
    return true;
  }

  // ===== ❌ showWeapon() محذوف =====
  // تم نقل نظام ترقية الأسلحة إلى ui-promotion.js (_openWeaponsLibrary)
  // الذي يستخدم army.js (Weapon class) بدلاً من WebSocket القديم
  // see: js/ui/ui-promotion.js → _openWeaponsLibrary(), _renderWeaponsLibraryPage()
  async showBuildings() {
    this._showLoading();
    try {
      const defs = await this._fetchDefs("buildings");
      const w = this.world;
      const b = (w.economy && w.economy.buildings) || {};
      const buildings = Object.values(defs);
      const palaceLvl = b.chiefPalace || 0;
      this._body.innerHTML = `
        <div class="wu-header">
          <span class="wu-title">🏛️ المباني</span>
          <button class="wu-btn-close" data-action="close">✕</button>
        </div>
        <div class="wu-section">
          <div class="wu-palace-info">🏠 بيت الزعيم: ${"★".repeat(Math.min(palaceLvl, 5))} المستوى ${palaceLvl} — يحد أقصى كل المباني</div>
        </div>
        ${buildings.map(bd => this._buildingCardHTML(bd, b, palaceLvl)).join("")}
        <button class="wu-btn-close wu-btn-bottom" data-action="close">إغلاق</button>`;
      this._overlay.classList.remove("hidden");
      this._bindBuildingActions();
    } catch (e) {
      this._showError("فشل تحميل بيانات المباني");
    }
  }

  // ===== ❌ _bindWeaponActions() محذوف =====
  // (محذوف مع showWeapon())

  _buildingCardHTML(bd, playerBuildings, palaceLvl) {
    const current = playerBuildings[bd.id] || 0;
    const maxed = current >= bd.maxLevel;
    const limitedByPalace = bd.id !== "chiefPalace" && current >= palaceLvl;
    const canUpgrade = !maxed && !limitedByPalace;
    const cost = this._computeCost(bd, current);
    const canAfford = canUpgrade && this._hasResources(cost);
    const icons = { chiefPalace: "🏠", troopBarracks: "🏕️", armoryVault: "⚔️", researchAcademy: "📚", resourceDepot: "🏪" };
    return `<div class="wu-building-card">
      <div class="wu-bd-header">
        <span class="wu-bd-icon">${icons[bd.id] || "🏗️"}</span>
        <span class="wu-bd-name">${bd.name}</span>
        <span class="wu-bd-level">المستوى ${current}/${bd.maxLevel}</span>
      </div>
      <div class="wu-bd-desc">${bd.desc}</div>
      ${canUpgrade ? `<div class="wu-cost-row">${this._costRow(cost)}</div>
        <button class="wu-btn-upgrade ${canAfford ? "" : "wu-btn-disabled"}" data-action="building" data-building="${bd.id}" ${canAfford ? "" : "disabled"}>
          🏗️ ترقية إلى ${current + 1}
        </button>` : (maxed ? '<div class="wu-dim">الحد الأقصى</div>' : '<div class="wu-dim">ممنوع — بيت الزعيم أقصاه</div>')}
    </div>`;
  }

  _computeCost(def, current) {
    const base = def.baseCost || { cash: 100, gold: 5 };
    const scale = def.costScale || 1.2;
    const cost = {};
    for (const [k, v] of Object.entries(base)) {
      cost[k] = Math.floor(v * Math.pow(scale, current));
    }
    return cost;
  }

  _bindBuildingActions() {
    this._body.querySelectorAll("[data-action]").forEach(el => {
      el.addEventListener("click", () => {
        const a = el.dataset.action;
        if (a === "close") { this.hide(); return; }
        if (a === "building") {
          this._sendWS({ type: "upgrade_building", buildingId: el.dataset.building });
          this._notify("جاري ترقية المبنى...");
          this.hide();
        }
      });
    });
  }

  async showResearch() {
    this._showLoading();
    try {
      const defs = await this._fetchDefs("research");
      const w = this.world;
      const r = (w.economy && w.economy.research) || {};
      const academy = (w.economy && w.economy.buildings && w.economy.buildings.researchAcademy) || 0;
      const categories = Object.values(defs);
      this._body.innerHTML = `
        <div class="wu-header">
          <span class="wu-title">🔬 شجرة البحوث</span>
          <button class="wu-btn-close" data-action="close">✕</button>
        </div>
        <div class="wu-section">
          <div class="wu-academy-info">📚 أكاديمية الأبحاث: المستوى ${academy}</div>
        </div>
        ${categories.map(cat => this._categoryHTML(cat, r, academy)).join("")}
        <button class="wu-btn-close wu-btn-bottom" data-action="close">إغلاق</button>`;
      this._overlay.classList.remove("hidden");
      this._bindResearchActions();
    } catch (e) {
      this._showError("فشل تحميل شجرة البحوث");
    }
  }

  _categoryHTML(cat, playerResearch, academyLvl) {
    const skills = Object.values(cat.skills || {});
    return `<div class="wu-category">
      <div class="wu-cat-title">${cat.name}</div>
      ${skills.map(sk => this._skillCardHTML(cat.id, sk, playerResearch, academyLvl)).join("")}
    </div>`;
  }

  _skillCardHTML(catId, sk, playerResearch, academyLvl) {
    const key = `${catId}.${sk.id}`;
    const current = playerResearch[key] || 0;
    const maxed = current >= sk.maxLevel;
    const limitedByAcademy = current >= academyLvl;
    const canUpgrade = !maxed && !limitedByAcademy;
    const cost = sk.baseCost ? this._computeCost(sk, current) : { cash: 100, gold: 3 };
    const canAfford = canUpgrade && this._hasResources(cost);
    return `<div class="wu-skill-card">
      <div class="wu-sk-header">
        <span class="wu-sk-name">${sk.name}</span>
        <span class="wu-sk-level">${current}/${sk.maxLevel}</span>
      </div>
      <div class="wu-sk-desc">${sk.effectDesc || ""}</div>
      ${canUpgrade ? `<div class="wu-cost-row">${this._costRow(cost)}</div>
        <button class="wu-btn-upgrade ${canAfford ? "" : "wu-btn-disabled"}" data-action="research" data-category="${catId}" data-skill="${sk.id}" ${canAfford ? "" : "disabled"}>
          🔬 ${sk.name} → ${current + 1}
        </button>` : (maxed ? '<div class="wu-dim">الحد الأقصى</div>' : '<div class="wu-dim">ممنوع — رفع مستوى الأكاديمية أولاً</div>')}
    </div>`;
  }

  _bindResearchActions() {
    this._body.querySelectorAll("[data-action]").forEach(el => {
      el.addEventListener("click", () => {
        const a = el.dataset.action;
        if (a === "close") { this.hide(); return; }
        if (a === "research") {
          this._sendWS({ type: "upgrade_research", categoryId: el.dataset.category, skillId: el.dataset.skill });
          this._notify("جاري ترقية البحث...");
          this.hide();
        }
      });
    });
  }

  async _fetchDefs(endpoint) {
    const cached = this._defs[endpoint];
    if (cached) return cached;
    const res = await fetch(`${this.apiBase}/api/${endpoint}`);
    const data = await res.json();
    this._defs[endpoint] = data;
    return data;
  }
}
