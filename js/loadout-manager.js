"use strict";

/**
 * =============================================================================
 *  🎒 نظام الشنطة (Loadout) — ملك الصحراء v2
 * =============================================================================
 *  اللاعب يستطيع:
 *  1. صنع الشنطة من الموارد (جلود، نحاس، أعشاب، طعام، ذهب)
 *  2. ترقية الشنطة — كل مستوى يزيد عدد الأسلحة والعناصر
 *  3. تجهيز السلاح من مخزون الأسلحة (يتذكر السلاح المجهز لكل نمط)
 *  4. تجهيز العناصر من المخزون (باندج، جرعة، درع، خوذة، إلخ)
 *  5. الدخول لأي نمط بالعتاد المختار
 *
 *  مستويات الشنطة:
 *    LV0 — غير موجودة (لم يصنعها اللاعب بعد)
 *    LV1 — سلاح واحد + عنصرين
 *    LV2 — سلاح واحد + 4 عناصر
 *    LV3 — سلاحان + 6 عناصر
 *    LV4 — سلاحان + 8 عناصر
 *    LV5 — 3 أسلحة + 10 عناصر
 * =============================================================================
 */

export class LoadoutManager {
  constructor(economy, inventory, army) {
    this.economy = economy;
    this.inventory = inventory;
    this.army = army;

    // ── مستوى الشنطة: 0 = غير موجودة، 1-5 = مستويات —──
    this.bagLevel = 0;

    // ── الأسلحة المجهزة (Array من weapon IDs) ──
    this.equippedWeapons = [];

    // ── العناصر المجهزة (Array من item IDs) ──
    this.equippedItems = [];
  }

  // ═══════════════════════════════════════════════════════════════════
  //  📊 إحصائيات الشنطة
  // ═══════════════════════════════════════════════════════════════════

  static BAG_STATS = {
    0: { maxWeapons: 0, maxItems: 0, name: "—", icon: "👜" },
    1: { maxWeapons: 1, maxItems: 2, name: "شنطة جلدية", icon: "👜" },
    2: { maxWeapons: 1, maxItems: 4, name: "شنطة مسافرة", icon: "👝" },
    3: { maxWeapons: 2, maxItems: 6, name: "حقيبة قافلة", icon: "🧳" },
    4: { maxWeapons: 2, maxItems: 8, name: "صندوق تاجر", icon: "📦" },
    5: { maxWeapons: 3, maxItems: 10, name: "خزنة السلطان", icon: "👑" },
  };

  /** تكاليف الصناعة لكل مستوى (من الموارد الخام) — منحنى تدريجي */
  static BAG_CRAFT_COSTS = {
    1: { gold: 50,   food: 30,  leather: 5 },
    2: { gold: 150,  food: 60,  leather: 15, copper: 5 },
    3: { gold: 400,  food: 120, leather: 30, copper: 15, herbs: 5 },
    4: { gold: 800,  food: 250, leather: 60, copper: 30, herbs: 15 },
    5: { gold: 1500, food: 500, leather: 120, copper: 60, herbs: 30, gems: 20 },
  };

  get stats() {
    return LoadoutManager.BAG_STATS[this.bagLevel] || LoadoutManager.BAG_STATS[0];
  }

  get maxWeapons() { return this.stats.maxWeapons; }
  get maxItems()   { return this.stats.maxItems; }
  get bagName()    { return this.stats.name; }
  get bagIcon()    { return this.stats.icon; }
  get hasBag()     { return this.bagLevel >= 1; }
  get isMaxLevel() { return this.bagLevel >= 5; }

  // ═══════════════════════════════════════════════════════════════════
  //  🔨 صناعة الشنطة
  // ═══════════════════════════════════════════════════════════════════

  canCraftBag(targetLevel = this.bagLevel + 1) {
    if (targetLevel > 5) return false;
    if (targetLevel <= this.bagLevel) return false;
    const cost = LoadoutManager.BAG_CRAFT_COSTS[targetLevel];
    if (!cost) return false;
    for (const [res, amt] of Object.entries(cost)) {
      if (!this.economy.canAfford(res, amt)) return false;
    }
    return true;
  }

  craftBag() {
    const targetLevel = this.bagLevel + 1;
    if (!this.canCraftBag(targetLevel)) return false;
    const cost = LoadoutManager.BAG_CRAFT_COSTS[targetLevel];
    for (const [res, amt] of Object.entries(cost)) {
      this.economy.spend(res, amt);
    }
    this.bagLevel = targetLevel;
    return true;
  }

  /** وصف تكاليف الصناعة/الترقية الحالية */
  getCraftCostDescription(targetLevel = this.bagLevel + 1) {
    const cost = LoadoutManager.BAG_CRAFT_COSTS[targetLevel];
    if (!cost) return "المستوى الأقصى ✅";
    return Object.entries(cost).map(([res, amt]) => {
      const icons = { gold: '🪙', food: '🌾', leather: '🟫', copper: '🪙', herbs: '🌿', gems: '💎' };
      return `${icons[res] || '•'} ${amt}`;
    }).join(' + ');
  }

  // ═══════════════════════════════════════════════════════════════════
  //  🗡️ تجهيز الأسلحة
  // ═══════════════════════════════════════════════════════════════════

  /** إرجاع الأسلحة المملوكة فقط */
  getOwnedWeapons() {
    return (this.army?.weapons || []).filter(w => w.owned);
  }

  canEquipWeapon(weaponId) {
    if (!this.hasBag) return false;
    if (this.equippedWeapons.length >= this.maxWeapons) return false;
    if (this.equippedWeapons.includes(weaponId)) return false;
    const weapon = (this.army?.weapons || []).find(w => w.id === weaponId);
    return weapon && weapon.owned;
  }

  equipWeapon(weaponId) {
    if (!this.canEquipWeapon(weaponId)) return false;
    this.equippedWeapons.push(weaponId);
    return true;
  }

  unequipWeapon(weaponId) {
    const idx = this.equippedWeapons.indexOf(weaponId);
    if (idx === -1) return false;
    this.equippedWeapons.splice(idx, 1);
    return true;
  }

  isWeaponEquipped(weaponId) {
    return this.equippedWeapons.includes(weaponId);
  }

  /** إرجاع أول سلاح مجهز (للاستخدام في القتال) */
  getPrimaryWeapon() {
    if (this.equippedWeapons.length === 0) return null;
    const wid = this.equippedWeapons[0];
    return (this.army?.weapons || []).find(w => w.id === wid) || null;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  📦 تجهيز العناصر من المخزون
  // ═══════════════════════════════════════════════════════════════════

  /** العناصر التي يمكن تجهيزها في الشنطة */
  static LOADOUT_ITEMS = [
    'bandage', 'heal_potion', 'fire_sword', 'desert_shield',
    'power_helmet', 'xp_scroll', 'power_gem', 'iron_sword',
  ];

  /** تصنيفات العناصر حسب النمط */
  static MODE_ITEM_TAGS = {
    extraction: ['bandage', 'heal_potion', 'desert_shield', 'power_gem', 'xp_scroll'],
    horde:      ['bandage', 'heal_potion', 'fire_sword', 'power_helmet', 'iron_sword', 'xp_scroll'],
    cave:       ['bandage', 'heal_potion', 'fire_sword', 'desert_shield', 'power_gem', 'xp_scroll', 'iron_sword'],
  };

  getOwnedItems() {
    const items = this.inventory?.items || {};
    return Object.entries(items)
      .filter(([id, data]) => data.count > 0 && LoadoutManager.LOADOUT_ITEMS.includes(id))
      .map(([id, data]) => ({ id, count: data.count, level: data.level }));
  }

  /** العناصر المتاحة لتجهيزها حسب النمط */
  getAvailableItemsForMode(modeName) {
    const tags = LoadoutManager.MODE_ITEM_TAGS[modeName] || LoadoutManager.LOADOUT_ITEMS;
    const owned = this.getOwnedItems();
    return owned.filter(item => tags.includes(item.id));
  }

  canEquipItem(itemId, modeName) {
    if (!this.hasBag) return false;
    if (this.equippedItems.length >= this.maxItems) return false;
    if (this.equippedItems.includes(itemId)) return false;
    // تحقق من أن العنصر موجود في المخزون
    const item = this.inventory?.items?.[itemId];
    if (!item || item.count <= 0) return false;
    // تحقق من توافق العنصر مع النمط (إذا وُجد النمط)
    if (modeName) {
      const tags = LoadoutManager.MODE_ITEM_TAGS[modeName] || [];
      if (!tags.includes(itemId)) return false;
    }
    return true;
  }

  equipItem(itemId, modeName) {
    if (!this.canEquipItem(itemId, modeName)) return false;
    this.equippedItems.push(itemId);
    return true;
  }

  unequipItem(itemId) {
    const idx = this.equippedItems.indexOf(itemId);
    if (idx === -1) return false;
    this.equippedItems.splice(idx, 1);
    return true;
  }

  isItemEquipped(itemId) {
    return this.equippedItems.includes(itemId);
  }

  /** تجهيز العناصر تلقائياً (بقدر المستطاع) */
  autoEquip(modeName) {
    this.equippedItems = [];
    const available = this.getAvailableItemsForMode(modeName);
    for (const item of available) {
      if (this.equippedItems.length >= this.maxItems) break;
      if (!this.equippedItems.includes(item.id)) {
        this.equippedItems.push(item.id);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  🎯 تطبيق العتاد على العالم قبل الدخول لأي نمط
  // ═══════════════════════════════════════════════════════════════════
  applyToWorld(world) {
    if (!world) return;

    // تجهيز أول سلاح كسلاح رئيسي
    const primary = this.getPrimaryWeapon();
    if (primary) {
      world._equippedWeapon = primary.id;
      if (world.syncWeaponVisuals) world.syncWeaponVisuals();
    } else {
      // إذا كان هناك سلاح مجهز قديم وليس في الشنطة، نزيله
      if (world._equippedWeapon && !this.equippedWeapons.includes(world._equippedWeapon)) {
        world._equippedWeapon = '';
        if (world.syncWeaponVisuals) world.syncWeaponVisuals();
      }
    }

    // تطبيق تأثيرات العناصر المجهزة فعلياً على العالم
    this._applyItemEffects(world);

    // يُضاف كمرجع للـ loadout للاستخدام في الأنماط
    world._loadoutItems = [...this.equippedItems];
    world._loadoutBagLevel = this.bagLevel;
  }

  /**
   * تطبيق تأثيرات العناصر المجهزة على العالم
   * تُستدعى عند الدخول للنمط لتطبيق البونصات الدائمة
   */
  _applyItemEffects(world) {
    if (!world || !world.leader) return;

    for (const itemId of this.equippedItems) {
      const def = this.inventory?.items?.[itemId];
      if (!def || def.count <= 0) continue;

      const itemDef = this._getItemDef(itemId);
      if (!itemDef) continue;

      const level = (def.level || 1) - 1;
      const stats = itemDef.levelStats?.[level] || itemDef.levelStats?.[0];
      if (!stats) continue;

      // تطبيق البونص حسب نوع العنصر
      switch (itemId) {
        case 'bandage':
          // الباندج: علاج فوري عند الدخول
          if (world.leader.hp < world.leader.maxHp) {
            world.leader.hp = Math.min(world.leader.maxHp, world.leader.hp + (stats.heal || 30));
          }
          break;
        case 'heal_potion':
          // جرعة علاج: علاج فوري
          if (world.leader.hp < world.leader.maxHp) {
            world.leader.hp = Math.min(world.leader.maxHp, world.leader.hp + (stats.heal || 50));
          }
          break;
        case 'fire_sword':
        case 'iron_sword':
          // سلاح مؤقت: ضرر إضافي
          if (stats.damage) {
            world.leader.upgradeDmg = (world.leader.upgradeDmg || 0) + stats.damage;
          }
          break;
        case 'desert_shield':
          // درع: دفاع إضافي
          if (stats.defense) {
            world.leader.upgradeDef = (world.leader.upgradeDef || 0) + stats.defense;
          }
          break;
        case 'power_helmet':
          // خوذة القوة: قوة جيش إضافية
          if (stats.bonus && world.armyUnits) {
            for (const u of world.armyUnits) {
              u.dmgBonus = (u.dmgBonus || 0) + stats.bonus;
            }
          }
          break;
        case 'power_gem':
          // جوهرة القوة: مضاعف العملات
          if (stats.multiplier) {
            this.economy.multiplier = stats.multiplier;
          }
          break;
        case 'xp_scroll':
          // لفافة خبرة: XP فوري
          if (stats.xp) {
            this.economy.addXp(stats.xp);
          }
          break;
      }
    }
  }

  /** الحصول على تعريف العنصر من inventory */
  _getItemDef(itemId) {
    try {
      // نستورد ITEM_DEFS من inventory.js
      const ITEM_DEFS_MAP = {
        bandage: { levelStats: [{ heal: 30 }, { heal: 60 }, { heal: 100 }] },
        heal_potion: { levelStats: [{ heal: 50 }, { heal: 100 }, { heal: 200 }] },
        fire_sword: { levelStats: [{ damage: 100 }, { damage: 200 }, { damage: 350 }] },
        iron_sword: { levelStats: [{ damage: 150 }, { damage: 300 }, { damage: 500 }] },
        desert_shield: { levelStats: [{ defense: 20 }, { defense: 35 }, { defense: 50 }] },
        power_helmet: { levelStats: [{ bonus: 50 }, { bonus: 100 }, { bonus: 180 }] },
        power_gem: { levelStats: [{ multiplier: 2 }, { multiplier: 3 }, { multiplier: 5 }] },
        xp_scroll: { levelStats: [{ xp: 500 }, { xp: 1200 }, { xp: 3000 }] },
        arena_ticket: { levelStats: [{}] },
        tower_blueprint: { levelStats: [{}] },
      };
      return ITEM_DEFS_MAP[itemId] || null;
    } catch {
      return null;
    }
  }

  /**
   * ملخص البونصات النشطة من العناصر المجهزة
   */
  getActiveBonuses() {
    const bonuses = { damage: 0, defense: 0, armyBonus: 0, multiplier: 1, heal: 0 };
    for (const itemId of this.equippedItems) {
      const def = this.inventory?.items?.[itemId];
      if (!def || def.count <= 0) continue;
      const itemDef = this._getItemDef(itemId);
      if (!itemDef) continue;
      const level = (def.level || 1) - 1;
      const stats = itemDef.levelStats?.[level] || itemDef.levelStats?.[0];
      if (!stats) continue;
      if (stats.damage) bonuses.damage += stats.damage;
      if (stats.defense) bonuses.defense += stats.defense;
      if (stats.bonus) bonuses.armyBonus += stats.bonus;
      if (stats.multiplier) bonuses.multiplier = Math.max(bonuses.multiplier, stats.multiplier);
      if (stats.heal) bonuses.heal += stats.heal;
    }
    return bonuses;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  💾 حفظ وتحميل
  // ═══════════════════════════════════════════════════════════════════

  getSaveData() {
    return {
      bagLevel: this.bagLevel,
      equippedWeapons: [...this.equippedWeapons],
      equippedItems: [...this.equippedItems],
    };
  }

  loadState(data) {
    if (!data) return;
    this.bagLevel = data.bagLevel || 0;
    this.equippedWeapons = Array.isArray(data.equippedWeapons) ? data.equippedWeapons : [];
    this.equippedItems = Array.isArray(data.equippedItems) ? data.equippedItems : [];
  }
}
