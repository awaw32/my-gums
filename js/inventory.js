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
    return true;
  }

  getItemCount(productId) { return this.items[productId] || 0; }

  useItem(productId) {
    if (!this.items[productId] || this.items[productId] <= 0) return false;
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
