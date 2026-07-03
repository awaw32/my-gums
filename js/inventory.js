const RECIPES = [
  {
    id: "r1", name: "جرعة علاج", icon: "🧪", product: "heal_potion",
    ingredients: { gold: 20, food: 10 },
    description: "يعيد 50 HP للقائد"
  },
  {
    id: "r2", name: "سيف ناري", icon: "🗡️", product: "fire_sword",
    ingredients: { gold: 100, hammers: 20, scrolls: 10 },
    description: "سلاح مؤقت بقوة 100"
  },
  {
    id: "r3", name: "درع صحراوي", icon: "🛡️", product: "desert_shield",
    ingredients: { gold: 150, hammers: 30, horns: 10 },
    description: "درع يقلل الضرر 20%"
  },
  {
    id: "r4", name: "خوذة القوة", icon: "⛑️", product: "power_helmet",
    ingredients: { gold: 200, kingCoins: 10, scrolls: 25 },
    description: "قوة جيش +50"
  },
  {
    id: "r5", name: "مخطط برج", icon: "📐", product: "tower_blueprint",
    ingredients: { gold: 300, hammers: 50, scrolls: 30, kingCoins: 5 },
    description: "يفتح برج دفاع جديد"
  },
  {
    id: "r6", name: "جوهرة القوة", icon: "💎", product: "power_gem",
    ingredients: { gold: 500, gems: 25, kingCoins: 10, horns: 20 },
    description: "كل العملات ×2 لمدة 5 دقائق"
  },
  {
    id: "r7", name: "تذكرة ساحة", icon: "🎫", product: "arena_ticket",
    ingredients: { gold: 50, food: 30 },
    description: "دخول مجاني للساحة (PvP)"
  },
  {
    id: "r8", name: "لفافة خبرة", icon: "📜", product: "xp_scroll",
    ingredients: { gold: 80, scrolls: 5, food: 20 },
    description: "يعطي 500 XP فوراً"
  },
];

export class InventoryManager {
  constructor(economy) {
    this.economy = economy;
    this.items = {};
    this._onCrafted = null;
    this._gemTimer = null;
  }

  getAllRecipes() { return RECIPES; }

  canCraft(recipeId) {
    const r = RECIPES.find(x => x.id === recipeId);
    if (!r) return false;
    for (const [res, amt] of Object.entries(r.ingredients)) {
      if (!this.economy.canAfford(res, amt)) return false;
    }
    return true;
  }

  craft(recipeId) {
    const r = RECIPES.find(x => x.id === recipeId);
    if (!r) return false;
    for (const [res, amt] of Object.entries(r.ingredients)) {
      if (!this.economy.spend(res, amt)) return false;
    }
    this.items[r.product] = (this.items[r.product] || 0) + 1;
    if (this._onCrafted) this._onCrafted(r);
    return true;
  }

  getItemCount(productId) { return this.items[productId] || 0; }

  useItem(productId, world) {
    if (!this.items[productId] || this.items[productId] <= 0) return false;
    // تطبيق تأثير العنصر
    switch (productId) {
      case 'heal_potion':
        if (world && world.leader) {
          world.leader.hp = Math.min(world.leader.maxHp, world.leader.hp + 50);
          if (world.store) world.store.set('notification', { text: '🧪 استخدمت جرعة علاج! +50 HP', t: Date.now() });
        }
        break;
      case 'xp_scroll':
        if (this.economy) {
          const xp = 500;
          this.economy.addXp(xp);
          if (this.economy._onLevelUp) this.economy._onLevelUp(this.economy.level);
        }
        break;
      case 'arena_ticket':
        // التذكرة تسمح بدخول PvP بدون عقوبة الخسارة — نخزنها مؤقتاً
        if (world) world._arenaTicket = true;
        break;
      case 'fire_sword':
        if (world && world.leader) {
          world.leader.upgradeDmg += 100;
          setTimeout(() => { if (world.leader) world.leader.upgradeDmg -= 100; }, 30000);
          if (world.store) world.store.set('notification', { text: '🗡️ سيف ناري! +100 ضرر لمدة 30 ثانية', t: Date.now() });
        }
        break;
      case 'desert_shield':
        if (world && world.leader) {
          world.leader.upgradeDef += 20;
          setTimeout(() => { if (world.leader) world.leader.upgradeDef -= 20; }, 60000);
          if (world.store) world.store.set('notification', { text: '🛡️ درع صحراوي! دفاع +20 لمدة 60 ثانية', t: Date.now() });
        }
        break;
      case 'power_helmet':
        // قوة جيش +50 مؤقت — تطبق على كل الوحدات
        if (world) {
          const bonus = 50;
          for (const u of world.armyUnits) u.dmgBonus += bonus;
          setTimeout(() => { for (const u of world.armyUnits) u.dmgBonus = Math.max(0, u.dmgBonus - bonus); }, 60000);
          if (world.store) world.store.set('notification', { text: '⛑️ خوذة القوة! +50 ضرر للجيش لمدة 60 ثانية', t: Date.now() });
        }
        break;
      case 'power_gem':
        // مضاعفة كل العملات لمدة 5 دقائق
        if (this.economy) {
          if (this._gemTimer) clearTimeout(this._gemTimer);
          this.economy.multiplier = 2;
          if (world && world.store) world.store.set('notification', { text: '💎 جوهرة القوة! ×2 كل العملات لمدة 5 دقائق!', t: Date.now() });
          this._gemTimer = setTimeout(() => {
            if (this.economy) this.economy.multiplier = 1;
            this._gemTimer = null;
          }, 300000);
        }
        break;
      case 'tower_blueprint':
        // يفتح برج دفاع جديد — للمستقبل
        if (world && world.store) world.store.set('notification', { text: '📐 حصلت على مخطط برج! سيُضاف لقائمة المباني قريباً', t: Date.now() });
        break;
      default:
        // عنصر غير معروف — فقط نستهلكه
        break;
    }
    this.items[productId]--;
    return true;
  }

  getState() {
    return {
      items: { ...this.items },
      recipes: RECIPES.map(r => ({ ...r, canCraft: this.canCraft(r.id) })),
    };
  }

  loadState(saved) {
    if (!saved) return;
    this.items = { ...saved };
  }

  getSaveData() { return this.items; }
}
