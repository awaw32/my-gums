import { describe, it, expect, beforeEach } from "vitest";

// ── Mock Economy ──
class MockEconomy {
  constructor() {
    this.resources = { gold: 0, food: 0, leather: 0, copper: 0, herbs: 0, gems: 0 };
    this.multiplier = 1;
    this.level = 1;
    this.xp = 0;
    this.xpToNext = 100;
  }
  canAfford(res, amt) {
    if (res === 'gold') return this.resources.gold >= amt;
    if (res === 'food') return this.resources.food >= amt;
    if (res === 'leather') return this.resources.leather >= amt;
    if (res === 'copper') return this.resources.copper >= amt;
    if (res === 'herbs') return this.resources.herbs >= amt;
    if (res === 'gems') return this.resources.gems >= amt;
    return true;
  }
  spend(res, amt) {
    if (!this.canAfford(res, amt)) return false;
    if (res === 'gold') this.resources.gold -= amt;
    else if (res === 'food') this.resources.food -= amt;
    else if (res === 'leather') this.resources.leather -= amt;
    else if (res === 'copper') this.resources.copper -= amt;
    else if (res === 'herbs') this.resources.herbs -= amt;
    else if (res === 'gems') this.resources.gems -= amt;
    return true;
  }
  addRaw(res, amt) {
    if (this.resources[res] !== undefined) this.resources[res] += amt;
  }
  get gold() { return this.resources.gold; }
  get food() { return this.resources.food; }
}

// ── Mock Inventory ──
class MockInventory {
  constructor() {
    this.items = {};
  }
  addItem(id, count = 1) {
    if (!this.items[id]) this.items[id] = { count: 0, level: 1 };
    this.items[id].count += count;
  }
}

// ── Mock Army ──
class MockArmy {
  constructor() {
    this.weapons = [
      { id: "w1", name: "سيف بدوي", basePower: 5, owned: true, level: 2, maxLevel: 5 },
      { id: "w2", name: "قوس طويل", basePower: 15, owned: true, level: 1, maxLevel: 5 },
      { id: "w3", name: "رمح حديدي", basePower: 30, owned: false, level: 0, maxLevel: 5 },
      { id: "w4", name: "سيف دمشقي", basePower: 50, owned: true, level: 1, maxLevel: 5 },
    ];
  }
}

// ── استيراد LoadoutManager ──
import { LoadoutManager } from "../js/loadout-manager.js";

describe("LoadoutManager - 🎒 نظام الشنطة", () => {
  let economy, inventory, army, loadout;

  beforeEach(() => {
    economy = new MockEconomy();
    inventory = new MockInventory();
    army = new MockArmy();
    loadout = new LoadoutManager(economy, inventory, army);
  });

  // ════════════════════════════════════════════
  //  الأساسيات
  // ════════════════════════════════════════════

  it("يبدأ بدون شنطة (bagLevel = 0)", () => {
    expect(loadout.bagLevel).toBe(0);
    expect(loadout.hasBag).toBe(false);
    expect(loadout.stats.maxWeapons).toBe(0);
    expect(loadout.stats.maxItems).toBe(0);
  });

  it("لا يمكن تجهيز أسلحة أو عناصر بدون شنطة", () => {
    expect(loadout.canEquipWeapon("w1")).toBe(false);
    expect(loadout.equipWeapon("w1")).toBe(false);
    expect(loadout.canEquipItem("bandage")).toBe(false);
    expect(loadout.equipItem("bandage")).toBe(false);
  });

  it("العودة الصحيحة للإحصائيات حسب مستوى الشنطة", () => {
    // المستوى 1
    loadout.bagLevel = 1;
    expect(loadout.maxWeapons).toBe(1);
    expect(loadout.maxItems).toBe(2);
    expect(loadout.bagName).toBe("شنطة جلدية");

    // المستوى 3
    loadout.bagLevel = 3;
    expect(loadout.maxWeapons).toBe(2);
    expect(loadout.maxItems).toBe(6);
    expect(loadout.bagName).toBe("حقيبة قافلة");
  });

  // ════════════════════════════════════════════
  //  صناعة وترقية الشنطة
  // ════════════════════════════════════════════

  it("يمكن صناعة الشنطة Lv1 عند توفر الموارد", () => {
    economy.resources.gold = 100;
    economy.resources.food = 50;
    economy.resources.leather = 10;

    expect(loadout.canCraftBag()).toBe(true);
    expect(loadout.craftBag()).toBe(true);
    expect(loadout.bagLevel).toBe(1);
    expect(loadout.hasBag).toBe(true);
    // الموارد خُصمت
    expect(economy.resources.gold).toBe(0);
    expect(economy.resources.food).toBe(0);
    expect(economy.resources.leather).toBe(0);
  });

  it("لا يمكن صناعة الشنطة بدون موارد كافية", () => {
    economy.resources.gold = 50; // تحتاج 100
    economy.resources.food = 50;
    economy.resources.leather = 10;

    expect(loadout.canCraftBag()).toBe(false);
    expect(loadout.craftBag()).toBe(false);
    expect(loadout.bagLevel).toBe(0);
  });

  it("يمكن ترقية الشنطة إلى المستوى 2", () => {
    loadout.bagLevel = 1;
    economy.resources.gold = 300;
    economy.resources.food = 100;
    economy.resources.leather = 30;
    economy.resources.copper = 10;

    expect(loadout.canCraftBag(2)).toBe(true);
    expect(loadout.craftBag()).toBe(true);
    expect(loadout.bagLevel).toBe(2);
    expect(loadout.maxWeapons).toBe(1);
    expect(loadout.maxItems).toBe(4);
  });

  it("لا يمكن ترقية الشنطة في أقصى مستوى", () => {
    loadout.bagLevel = 5;
    expect(loadout.isMaxLevel).toBe(true);
    expect(loadout.canCraftBag()).toBe(false);
    expect(loadout.craftBag()).toBe(false);
  });

  it("getCraftCostDescription يعيد النص الصحيح", () => {
    const desc = loadout.getCraftCostDescription(1);
    expect(desc).toContain("🪙");
    expect(desc).toContain("100");
    expect(desc).toContain("🌾");
    expect(desc).toContain("50");
  });

  // ════════════════════════════════════════════
  //  تجهيز الأسلحة
  // ════════════════════════════════════════════

  it("يمكن تجهيز سلاح واحد فقط في Lv1", () => {
    loadout.bagLevel = 1;
    expect(loadout.canEquipWeapon("w1")).toBe(true);
    expect(loadout.equipWeapon("w1")).toBe(true);
    expect(loadout.isWeaponEquipped("w1")).toBe(true);
  });

  it("لا يمكن تجهيز سلاح ثاني في Lv1", () => {
    loadout.bagLevel = 1;
    loadout.equipWeapon("w1");
    // cannot equip second weapon
    expect(loadout.canEquipWeapon("w2")).toBe(false);
    expect(loadout.equipWeapon("w2")).toBe(false);
  });

  it("يمكن تجهيز سلاحين في Lv3", () => {
    loadout.bagLevel = 3;
    expect(loadout.equipWeapon("w1")).toBe(true);
    expect(loadout.equipWeapon("w4")).toBe(true);
    expect(loadout.equippedWeapons.length).toBe(2);
  });

  it("لا يمكن تجهيز سلاح غير مملوك", () => {
    loadout.bagLevel = 3;
    expect(loadout.canEquipWeapon("w3")).toBe(false); // w3 غير مملوك
    expect(loadout.equipWeapon("w3")).toBe(false);
  });

  it("يمكن إلغاء تجهيز السلاح", () => {
    loadout.bagLevel = 1;
    loadout.equipWeapon("w1");
    expect(loadout.unequipWeapon("w1")).toBe(true);
    expect(loadout.isWeaponEquipped("w1")).toBe(false);
  });

  it("getPrimaryWeapon يعيد أول سلاح مجهز", () => {
    loadout.bagLevel = 3;
    loadout.equipWeapon("w4");
    loadout.equipWeapon("w1");
    const pw = loadout.getPrimaryWeapon();
    expect(pw).not.toBeNull();
    expect(pw.id).toBe("w4"); // أول سلاح
  });

  it("getPrimaryWeapon يعيد null بدون أسلحة مجهزة", () => {
    expect(loadout.getPrimaryWeapon()).toBeNull();
  });

  // ════════════════════════════════════════════
  //  تجهيز العناصر
  // ════════════════════════════════════════════

  it("يمكن تجهيز عناصر من المخزون حسب النمط", () => {
    loadout.bagLevel = 3;
    inventory.addItem("bandage", 3);
    inventory.addItem("heal_potion", 1);

    expect(loadout.canEquipItem("bandage", "extraction")).toBe(true);
    expect(loadout.equipItem("bandage", "extraction")).toBe(true);
    expect(loadout.isItemEquipped("bandage")).toBe(true);
    expect(loadout.equippedItems.length).toBe(1);
  });

  it("لا يمكن تجهيز عنصر غير متوافق مع النمط", () => {
    loadout.bagLevel = 3;
    // iron_sword ليس في extraction
    inventory.addItem("iron_sword", 1);

    expect(loadout.canEquipItem("iron_sword", "extraction")).toBe(false);
    expect(loadout.equipItem("iron_sword", "extraction")).toBe(false);
  });

  it("يمكن تجهيز العناصر حسب سعة الشنطة", () => {
    loadout.bagLevel = 2; // 4 عناصر
    inventory.addItem("bandage", 5);
    inventory.addItem("heal_potion", 3);
    inventory.addItem("xp_scroll", 2);
    inventory.addItem("power_gem", 1);

    expect(loadout.equipItem("bandage", "extraction")).toBe(true);
    expect(loadout.equipItem("heal_potion", "extraction")).toBe(true);
    expect(loadout.equipItem("xp_scroll", "extraction")).toBe(true);
    expect(loadout.equipItem("power_gem", "extraction")).toBe(true);
    // 5th item should fail
    expect(loadout.equipItem("bandage", "extraction")).toBe(false);
  });

  it("يمكن إلغاء تجهيز العنصر", () => {
    loadout.bagLevel = 1;
    inventory.addItem("bandage", 2);
    loadout.equipItem("bandage", "extraction");
    expect(loadout.unequipItem("bandage")).toBe(true);
    expect(loadout.isItemEquipped("bandage")).toBe(false);
  });

  // ════════════════════════════════════════════
  //  التجهيز التلقائي
  // ════════════════════════════════════════════

  it("autoEquip يملأ الشنطة بالعناصر المتاحة حسب النمط", () => {
    loadout.bagLevel = 2; // 4 عناصر
    inventory.addItem("bandage", 5);
    inventory.addItem("heal_potion", 3);
    inventory.addItem("xp_scroll", 2);
    inventory.addItem("power_gem", 1);
    inventory.addItem("desert_shield", 2);

    loadout.autoEquip("extraction");
    expect(loadout.equippedItems.length).toBe(4); // 4 maxItems في Lv2
  });

  // ════════════════════════════════════════════
  //  تطبيق العتاد على العالم
  // ════════════════════════════════════════════

  it("applyToWorld يضبط equippedWeapon في العالم", () => {
    loadout.bagLevel = 3;
    loadout.equipWeapon("w1");
    const world = { _equippedWeapon: "", syncWeaponVisuals: () => {} };
    loadout.applyToWorld(world);
    expect(world._equippedWeapon).toBe("w1");
    expect(world._loadoutItems).toEqual([]); // لا عناصر مجهزة
    expect(world._loadoutBagLevel).toBe(3);
  });

  it("applyToWorld يضبط _loadoutItems و _loadoutBagLevel", () => {
    loadout.bagLevel = 2;
    inventory.addItem("bandage", 1);
    inventory.addItem("heal_potion", 1);
    loadout.equipItem("bandage", "extraction");
    loadout.equipItem("heal_potion", "extraction");

    const world = { _equippedWeapon: "", syncWeaponVisuals: () => {} };
    loadout.applyToWorld(world);
    expect(world._loadoutItems).toEqual(["bandage", "heal_potion"]);
    expect(world._loadoutBagLevel).toBe(2);
  });

  // ════════════════════════════════════════════
  //  الحفظ والتحميل
  // ════════════════════════════════════════════

  it("getSaveData يعيد بنية البيانات الصحيحة", () => {
    loadout.bagLevel = 2;
    loadout.equipWeapon("w1");
    inventory.addItem("bandage", 1);
    loadout.equipItem("bandage", "extraction");

    const data = loadout.getSaveData();
    expect(data.bagLevel).toBe(2);
    expect(data.equippedWeapons).toEqual(["w1"]);
    expect(data.equippedItems).toEqual(["bandage"]);
  });

  it("loadState يستعيد الحالة المحفوظة", () => {
    const data = {
      bagLevel: 3,
      equippedWeapons: ["w1", "w4"],
      equippedItems: ["bandage", "heal_potion"],
    };
    loadout.loadState(data);
    expect(loadout.bagLevel).toBe(3);
    expect(loadout.equippedWeapons).toEqual(["w1", "w4"]);
    expect(loadout.equippedItems).toEqual(["bandage", "heal_potion"]);
  });

  it("loadState لا يسبب أخطاء مع بيانات غير كاملة", () => {
    loadout.loadState(null);
    expect(loadout.bagLevel).toBe(0);

    loadout.loadState(undefined);
    expect(loadout.bagLevel).toBe(0);

    loadout.loadState({});
    expect(loadout.bagLevel).toBe(0);
  });

  // ════════════════════════════════════════════
  //  العناصر الخاصة بكل نمط
  // ════════════════════════════════════════════

  it("MODE_ITEM_TAGS تحتوي على العناصر المناسبة لكل نمط", () => {
    expect(LoadoutManager.MODE_ITEM_TAGS.extraction).toContain("bandage");
    expect(LoadoutManager.MODE_ITEM_TAGS.extraction).toContain("heal_potion");
    expect(LoadoutManager.MODE_ITEM_TAGS.extraction).toContain("desert_shield");
    expect(LoadoutManager.MODE_ITEM_TAGS.horde).toContain("fire_sword");
    expect(LoadoutManager.MODE_ITEM_TAGS.horde).toContain("power_helmet");
    expect(LoadoutManager.MODE_ITEM_TAGS.cave).toContain("fire_sword");
    expect(LoadoutManager.MODE_ITEM_TAGS.cave).toContain("desert_shield");
    expect(LoadoutManager.MODE_ITEM_TAGS.cave).toContain("iron_sword");
  });

  it("getAvailableItemsForMode يعيد العناصر المملوكة والمتوافقة فقط", () => {
    inventory.addItem("bandage", 3);
    inventory.addItem("fire_sword", 1); // ليس في extraction
    inventory.addItem("heal_potion", 1);

    const items = loadout.getAvailableItemsForMode("extraction");
    expect(items.length).toBe(2);
    expect(items.find(i => i.id === "fire_sword")).toBeUndefined(); // غير متوافق
    expect(items.find(i => i.id === "bandage")).toBeDefined();
    expect(items.find(i => i.id === "heal_potion")).toBeDefined();
  });

  // ════════════════════════════════════════════
  //  تكاليف الترقية
  // ════════════════════════════════════════════

  it("تكاليف الصناعة تتدرج حسب المستوى", () => {
    expect(LoadoutManager.BAG_CRAFT_COSTS[1]).toEqual({ gold: 100, food: 50, leather: 10 });
    expect(LoadoutManager.BAG_CRAFT_COSTS[3]).toEqual({ gold: 600, food: 200, leather: 60, copper: 25, herbs: 10 });
    expect(LoadoutManager.BAG_CRAFT_COSTS[5]).toEqual({ gold: 2500, food: 800, leather: 200, copper: 100, herbs: 50, gems: 30 });
  });
});
