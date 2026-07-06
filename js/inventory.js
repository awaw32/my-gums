"use strict";

/**
 * نظام المخزون والشنطة - ملك الصحراء
 * شنطة محدودة الحجم، صناعة، تطوير، إسقاط، التقاط، علاج الآخرين
 */

// ═══════════════════════════════════════════════════════════════════
//  تعريف الأدوات — كل أداة لها وزن ومستوى أقصى
// ═══════════════════════════════════════════════════════════════════
export const ITEM_DEFS = {
  // ── أدوات علاج ──
  bandage: {
    id: "bandage",
    name: "باندج",
    icon: "🩹",
    category: "healing",
    weight: 1,
    maxLevel: 3,
    dropSize: 12,
    description: "يعالج 30 HP — تقدر تعالج لاعب ثاني",
    levelStats: [
      { heal: 30, name: "باندج عادي" },
      { heal: 60, name: "باندج محسن" },
      { heal: 100, name: "باندج متقدم" },
    ],
    upgradeCost: [
      null,
      { gold: 50, food: 20 },
      { gold: 150, food: 60, gems: 5 },
    ],
  },
  heal_potion: {
    id: "heal_potion",
    name: "جرعة علاج",
    icon: "🧪",
    category: "healing",
    weight: 2,
    maxLevel: 3,
    dropSize: 14,
    description: "يعيد 50 HP للقائد",
    levelStats: [
      { heal: 50, name: "جرعة عادية" },
      { heal: 100, name: "جرعة محسنة" },
      { heal: 200, name: "جرعة متقدمة" },
    ],
    upgradeCost: [
      null,
      { gold: 80, food: 30, scrolls: 5 },
      { gold: 200, food: 80, scrolls: 15, gems: 10 },
    ],
  },

  // ── أدوات قتال ──
  fire_sword: {
    id: "fire_sword",
    name: "سيف ناري",
    icon: "🗡️",
    category: "weapon",
    weight: 3,
    maxLevel: 3,
    dropSize: 16,
    description: "سلاح مؤقت بقوة 100",
    levelStats: [
      { damage: 100, duration: 30000, name: "سيف ناري" },
      { damage: 200, duration: 45000, name: "سيف ناري II" },
      { damage: 350, duration: 60000, name: "سيف ناري III" },
    ],
    upgradeCost: [
      null,
      { gold: 200, hammers: 40, scrolls: 20 },
      { gold: 500, hammers: 100, scrolls: 50, gems: 20 },
    ],
  },
  desert_shield: {
    id: "desert_shield",
    name: "درع صحراوي",
    icon: "🛡️",
    category: "defense",
    weight: 4,
    maxLevel: 3,
    dropSize: 18,
    description: "درع يقلل الضرر 20%",
    levelStats: [
      { defense: 20, duration: 60000, name: "درع عادي" },
      { defense: 35, duration: 90000, name: "درع محسن" },
      { defense: 50, duration: 120000, name: "درع متقدم" },
    ],
    upgradeCost: [
      null,
      { gold: 250, hammers: 50, gems: 15 },
      { gold: 600, hammers: 120, gems: 40 },
    ],
  },
  power_helmet: {
    id: "power_helmet",
    name: "خوذة القوة",
    icon: "⛑️",
    category: "buff",
    weight: 3,
    maxLevel: 3,
    dropSize: 15,
    description: "قوة جيش +50",
    levelStats: [
      { bonus: 50, duration: 60000, name: "خوذة عادية" },
      { bonus: 100, duration: 90000, name: "خوذة محسنة" },
      { bonus: 180, duration: 120000, name: "خوذة متقدمة" },
    ],
    upgradeCost: [
      null,
      { gold: 300, gems: 25, scrolls: 30 },
      { gold: 700, gems: 60, scrolls: 70 },
    ],
  },

  // ── أدوات موارد ──
  xp_scroll: {
    id: "xp_scroll",
    name: "لفافة خبرة",
    icon: "📜",
    category: "resource",
    weight: 1,
    maxLevel: 3,
    dropSize: 10,
    description: "يعطي 500 XP فوراً",
    levelStats: [
      { xp: 500, name: "لفافة عادية" },
      { xp: 1200, name: "لفافة محسنة" },
      { xp: 3000, name: "لفافة متقدمة" },
    ],
    upgradeCost: [
      null,
      { gold: 120, scrolls: 10, food: 40 },
      { gold: 300, scrolls: 30, food: 100 },
    ],
  },
  power_gem: {
    id: "power_gem",
    name: "جوهرة القوة",
    icon: "💎",
    category: "buff",
    weight: 2,
    maxLevel: 3,
    dropSize: 12,
    description: "كل العملات ×2 لمدة 5 دقائق",
    levelStats: [
      { multiplier: 2, duration: 300000, name: "جوهرة عادية" },
      { multiplier: 3, duration: 420000, name: "جوهرة محسنة" },
      { multiplier: 5, duration: 600000, name: "جوهرة متقدمة" },
    ],
    upgradeCost: [
      null,
      { gold: 800, gems: 80, hammers: 60 },
      { gold: 2000, gems: 200, hammers: 150 },
    ],
  },

  // ── أدوات خاصة ──
  arena_ticket: {
    id: "arena_ticket",
    name: "تذكرة ساحة",
    icon: "🎫",
    category: "special",
    weight: 1,
    maxLevel: 1,
    dropSize: 8,
    description: "دخول مجاني للساحة (PvP)",
    levelStats: [{ name: "تذكرة ساحة" }],
    upgradeCost: [null],
  },
  tower_blueprint: {
    id: "tower_blueprint",
    name: "مخطط برج",
    icon: "📐",
    category: "special",
    weight: 2,
    maxLevel: 1,
    dropSize: 14,
    description: "يفتح برج دفاع جديد",
    levelStats: [{ name: "مخطط برج" }],
    upgradeCost: [null],
  },
};

// ═══════════════════════════════════════════════════════════════════
//  وصفات الصناعة
// ═══════════════════════════════════════════════════════════════════
export const RECIPES = [
  {
    id: "r1", name: "باندج", icon: "🩹", product: "bandage",
    ingredients: { gold: 10, food: 5 },
    description: "يعالج 30 HP — تقدر تعالج لاعب ثاني",
  },
  {
    id: "r2", name: "جرعة علاج", icon: "🧪", product: "heal_potion",
    ingredients: { gold: 20, food: 10 },
    description: "يعيد 50 HP للقائد",
  },
  {
    id: "r3", name: "سيف ناري", icon: "🗡️", product: "fire_sword",
    ingredients: { gold: 100, hammers: 20, scrolls: 10 },
    description: "سلاح مؤقت بقوة 100",
  },
  {
    id: "r4", name: "درع صحراوي", icon: "🛡️", product: "desert_shield",
    ingredients: { gold: 150, hammers: 30, gems: 10 },
    description: "درع يقلل الضرر 20%",
  },
  {
    id: "r5", name: "خوذة القوة", icon: "⛑️", product: "power_helmet",
    ingredients: { gold: 200, gems: 15, scrolls: 25 },
    description: "قوة جيش +50",
  },
  {
    id: "r6", name: "لفافة خبرة", icon: "📜", product: "xp_scroll",
    ingredients: { gold: 80, scrolls: 5, food: 20 },
    description: "يعطي 500 XP فوراً",
  },
  {
    id: "r7", name: "جوهرة القوة", icon: "💎", product: "power_gem",
    ingredients: { gold: 500, gems: 50, hammers: 40, scrolls: 20 },
    description: "كل العملات ×2 لمدة 5 دقائق",
  },
  {
    id: "r8", name: "تذكرة ساحة", icon: "🎫", product: "arena_ticket",
    ingredients: { gold: 50, food: 30 },
    description: "دخول مجاني للساحة (PvP)",
  },
  {
    id: "r9", name: "مخطط برج", icon: "📐", product: "tower_blueprint",
    ingredients: { gold: 300, hammers: 50, scrolls: 30, gems: 8 },
    description: "يفتح برج دفاع جديد",
  },
];

// ═══════════════════════════════════════════════════════════════════
//  مدير المخزون
// ═══════════════════════════════════════════════════════════════════
export class InventoryManager {
  constructor(economy) {
    this.economy = economy;
    // items = { "bandage": { count: 3, level: 1 }, ... }
    this.items = {};
    this.maxCapacity = 20; // الحد الأقصى للوزن
    this._onCrafted = null;
    this._onItemDropped = null;
    this._onItemUsed = null;
    this._gemTimer = null;
  }

  // ── حساب الوزن الحالي ──
  get currentWeight() {
    let total = 0;
    for (const [id, data] of Object.entries(this.items)) {
      const def = ITEM_DEFS[id];
      if (def && data.count > 0) {
        total += def.weight * data.count;
      }
    }
    return total;
  }

  get remainingCapacity() {
    return this.maxCapacity - this.currentWeight;
  }

  canCarry(itemId, count = 1) {
    const def = ITEM_DEFS[itemId];
    if (!def) return false;
    return this.currentWeight + (def.weight * count) <= this.maxCapacity;
  }

  // ── ترقية حجم الشنطة ──
  upgradeCapacity(amount) {
    this.maxCapacity += amount;
  }

  // ── الصناعة ──
  getAllRecipes() { return RECIPES; }

  canCraft(recipeId) {
    const r = RECIPES.find(x => x.id === recipeId);
    if (!r) return false;
    if (!this.canCarry(r.product, 1)) return false;
    for (const [res, amt] of Object.entries(r.ingredients)) {
      if (!this.economy.canAfford(res, amt)) return false;
    }
    return true;
  }

  craft(recipeId) {
    const r = RECIPES.find(x => x.id === recipeId);
    if (!r) return false;
    if (!this.canCarry(r.product, 1)) return false;
    for (const [res, amt] of Object.entries(r.ingredients)) {
      if (!this.economy.canAfford(res, amt)) return false;
    }
    for (const [res, amt] of Object.entries(r.ingredients)) {
      this.economy.spend(res, amt);
    }
    this._addItem(r.product, 1);
    if (this._onCrafted) this._onCrafted(r);
    return true;
  }

  // ── إضافة عنصر ──
  _addItem(itemId, count = 1) {
    if (!this.items[itemId]) {
      this.items[itemId] = { count: 0, level: 1 };
    }
    this.items[itemId].count += count;
  }

  // ── عدد عنصر ──
  getItemCount(productId) {
    return this.items[productId]?.count || 0;
  }

  getItemLevel(productId) {
    return this.items[productId]?.level || 1;
  }

  // ── تطوير عنصر ──
  canUpgrade(itemId) {
    const def = ITEM_DEFS[itemId];
    if (!def) return false;
    const current = this.items[itemId];
    if (!current || current.count <= 0) return false;
    if (current.level >= def.maxLevel) return false;
    const cost = def.upgradeCost[current.level];
    if (!cost) return false;
    for (const [res, amt] of Object.entries(cost)) {
      if (!this.economy.canAfford(res, amt)) return false;
    }
    return true;
  }

  upgrade(itemId) {
    const def = ITEM_DEFS[itemId];
    if (!def) return false;
    const current = this.items[itemId];
    if (!current || current.count <= 0 || current.level >= def.maxLevel) return false;
    const cost = def.upgradeCost[current.level];
    if (!cost) return false;
    for (const [res, amt] of Object.entries(cost)) {
      if (!this.economy.canAfford(res, amt)) return false;
    }
    for (const [res, amt] of Object.entries(cost)) {
      this.economy.spend(res, amt);
    }
    current.level++;
    return true;
  }

  // ── استخدام عنصر ──
  useItem(productId, world) {
    if (!this.items[productId] || this.items[productId].count <= 0) return false;
    const def = ITEM_DEFS[productId];
    if (!def) return false;
    const level = this.items[productId].level - 1;
    const stats = def.levelStats[level] || def.levelStats[0];

    switch (productId) {
      case 'bandage':
        // الباندج يُستخدم على لاعب قريب — يستهلك أولاً ثم يرجع المعلومة
        this.items[productId].count--;
        if (this.items[productId].count <= 0) delete this.items[productId];
        return { type: 'bandage', heal: stats.heal, target: 'nearby_player' };

      case 'heal_potion':
        if (world && world.leader) {
          world.leader.hp = Math.min(world.leader.maxHp, world.leader.hp + stats.heal);
          if (world.store) world.store.set('notification', { text: `🧪 ${stats.name}! +${stats.heal} HP`, t: Date.now() });
        }
        break;

      case 'xp_scroll':
        if (this.economy) {
          this.economy.addXp(stats.xp);
          if (this.economy._onLevelUp) this.economy._onLevelUp(this.economy.level);
          if (world && world.store) world.store.set('notification', { text: `📜 ${stats.name}! +${stats.xp} XP`, t: Date.now() });
        }
        break;

      case 'arena_ticket':
        if (world) world._arenaTicket = true;
        break;

      case 'fire_sword':
        if (world && world.leader) {
          world.leader.upgradeDmg += stats.damage;
          setTimeout(() => { if (world.leader) world.leader.upgradeDmg -= stats.damage; }, stats.duration);
          if (world.store) world.store.set('notification', { text: `🗡️ ${stats.name}! +${stats.damage} ضرر`, t: Date.now() });
        }
        break;

      case 'desert_shield':
        if (world && world.leader) {
          world.leader.upgradeDef += stats.defense;
          setTimeout(() => { if (world.leader) world.leader.upgradeDef -= stats.defense; }, stats.duration);
          if (world.store) world.store.set('notification', { text: `🛡️ ${stats.name}! دفاع +${stats.defense}`, t: Date.now() });
        }
        break;

      case 'power_helmet':
        if (world) {
          for (const u of world.armyUnits) u.dmgBonus += stats.bonus;
          setTimeout(() => { for (const u of world.armyUnits) u.dmgBonus = Math.max(0, u.dmgBonus - stats.bonus); }, stats.duration);
          if (world.store) world.store.set('notification', { text: `⛑️ ${stats.name}! +${stats.bonus} قوة`, t: Date.now() });
        }
        break;

      case 'power_gem':
        if (this.economy) {
          if (this._gemTimer) clearTimeout(this._gemTimer);
          this.economy.multiplier = stats.multiplier;
          if (world && world.store) world.store.set('notification', { text: `💎 ${stats.name}! ×${stats.multiplier} كل العملات!`, t: Date.now() });
          this._gemTimer = setTimeout(() => {
            if (this.economy) this.economy.multiplier = 1;
            this._gemTimer = null;
          }, stats.duration);
        }
        break;

      case 'tower_blueprint':
        if (world && world.store) world.store.set('notification', { text: '📐 حصلت على مخطط برج!', t: Date.now() });
        break;

      default:
        break;
    }

    this.items[productId].count--;
    if (this.items[productId].count <= 0) delete this.items[productId];
    if (this._onItemUsed) this._onItemUsed(productId);
    return true;
  }

  // ── إسقاط عنصر على الأرض ──
  dropItem(itemId, x, y) {
    if (!this.items[itemId] || this.items[itemId].count <= 0) return null;
    const def = ITEM_DEFS[itemId];
    if (!def) return null;
    this.items[itemId].count--;
    const level = this.items[itemId].level;
    if (this.items[itemId].count <= 0) delete this.items[itemId];
    const dropped = {
      id: `${itemId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      itemId,
      level,
      x,
      y,
      size: def.dropSize,
      icon: def.icon,
      name: def.name,
      spawnTime: Date.now(),
    };
    if (this._onItemDropped) this._onItemDropped(dropped);
    return dropped;
  }

  // ── التقاط عنصر من الأرض ──
  pickupItem(droppedItem) {
    const def = ITEM_DEFS[droppedItem.itemId];
    if (!def) return false;
    if (!this.canCarry(droppedItem.itemId, 1)) return false;
    this._addItem(droppedItem.itemId, 1);
    if (this.items[droppedItem.itemId] && droppedItem.level > 1) {
      this.items[droppedItem.itemId].level = Math.max(
        this.items[droppedItem.itemId].level,
        droppedItem.level
      );
    }
    return true;
  }

  // ── حالة الحفظ ──
  getState() {
    return {
      items: { ...this.items },
      maxCapacity: this.maxCapacity,
      recipes: RECIPES.map(r => ({ ...r, canCraft: this.canCraft(r.id) })),
    };
  }

  loadState(saved) {
    if (!saved) return;
    if (saved.items) this.items = { ...saved.items };
    if (saved.maxCapacity) this.maxCapacity = saved.maxCapacity;
  }

  getSaveData() {
    return {
      items: this.items,
      maxCapacity: this.maxCapacity,
    };
  }
}

export { ITEM_DEFS as ITEMS };
