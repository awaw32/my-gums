const UPGRADE_PATHS = [
  {
    id: "damage", name: "الضرر", icon: "⚔️",
    levels: [
      { cost: 50, desc: "ضرر +2", effect: 2 },
      { cost: 120, desc: "ضرر +5", effect: 5 },
      { cost: 250, desc: "ضرر +10", effect: 10 },
      { cost: 500, desc: "ضرر +20", effect: 20 },
    ]
  },
  {
    id: "defense", name: "الدفاع", icon: "🛡️",
    levels: [
      { cost: 40, desc: "دفاع +1", effect: 1 },
      { cost: 100, desc: "دفاع +2", effect: 2 },
      { cost: 200, desc: "دفاع +4", effect: 4 },
      { cost: 400, desc: "دفاع +8", effect: 8 },
    ]
  },
  {
    id: "capacity", name: "السعة", icon: "📦",
    levels: [
      { cost: 60, desc: "سعة +2", effect: 2 },
      { cost: 150, desc: "سعة +4", effect: 4 },
      { cost: 300, desc: "سعة +6", effect: 6 },
      { cost: 600, desc: "سعة +10", effect: 10 },
    ]
  },
  {
    id: "speed", name: "السرعة", icon: "💨",
    levels: [
      { cost: 35, desc: "سرعة +5", effect: 5 },
      { cost: 90, desc: "سرعة +10", effect: 10 },
      { cost: 180, desc: "سرعة +15", effect: 15 },
      { cost: 360, desc: "سرعة +25", effect: 25 },
    ]
  },
];

export class UpgradeTree {
  constructor(economy) {
    this.economy = economy;
    this.levels = {};
    for (const p of UPGRADE_PATHS) {
      this.levels[p.id] = 0;
    }
    this._onChanged = null;
  }

  getMaxLevel(pathId) {
    const p = UPGRADE_PATHS.find(x => x.id === pathId);
    return p ? p.levels.length : 0;
  }

  getLevel(pathId) {
    return this.levels[pathId] || 0;
  }

  getCurrentCost(pathId) {
    const p = UPGRADE_PATHS.find(x => x.id === pathId);
    if (!p) return Infinity;
    const lvl = this.levels[pathId] || 0;
    if (lvl >= p.levels.length) return Infinity;
    return p.levels[lvl].cost;
  }

  getDesc(pathId) {
    const p = UPGRADE_PATHS.find(x => x.id === pathId);
    if (!p) return "";
    const lvl = this.levels[pathId] || 0;
    if (lvl >= p.levels.length) return "⭐⭐⭐ الأقصى";
    return p.levels[lvl].desc;
  }

  getEffect(pathId) {
    const p = UPGRADE_PATHS.find(x => x.id === pathId);
    if (!p) return 0;
    const lvl = this.levels[pathId] || 0;
    if (lvl >= p.levels.length) return p.levels[p.levels.length - 1].effect;
    let total = 0;
    for (let i = 0; i < lvl; i++) total += p.levels[i].effect;
    return total;
  }

  canUpgrade(pathId) {
    const p = UPGRADE_PATHS.find(x => x.id === pathId);
    if (!p) return false;
    const lvl = this.levels[pathId] || 0;
    if (lvl >= p.levels.length) return false;
    return this.economy.canAfford("gold", p.levels[lvl].cost);
  }

  upgrade(pathId) {
    const p = UPGRADE_PATHS.find(x => x.id === pathId);
    if (!p) return false;
    const lvl = this.levels[pathId] || 0;
    if (lvl >= p.levels.length) return false;
    const cost = p.levels[lvl].cost;
    if (!this.economy.spend("gold", cost)) return false;
    this.levels[pathId] = lvl + 1;
    if (this._onChanged) this._onChanged(pathId, this.levels[pathId]);
    return true;
  }

  getPaths() {
    return UPGRADE_PATHS.map(p => ({
      ...p,
      currentLevel: this.levels[p.id] || 0,
      maxLevel: p.levels.length,
      cost: this.getCurrentCost(p.id),
      canAfford: this.canUpgrade(p.id),
      effect: this.getEffect(p.id),
      desc: this.getDesc(p.id),
    }));
  }

  loadState(saved) {
    if (!saved) return;
    for (const key of Object.keys(this.levels)) {
      if (saved[key] !== undefined) this.levels[key] = saved[key];
    }
  }
}
