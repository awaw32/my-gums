import { describe, it, expect, beforeEach } from 'vitest';
import { InventoryManager } from '../js/inventory.js';

function makeMockEconomy() {
  const resources = { gold: 500, gems: 50, food: 100, hammers: 60, scrolls: 40, cash: 200 };
  return {
    resources,
    canAfford: function(type, cost) { return (this.resources[type] || 0) >= cost; },
    spend: function(type, amt) {
      if ((this.resources[type] || 0) >= amt) { this.resources[type] -= amt; return true; }
      return false;
    },
    addRaw: function(type, amt) { if (this.resources[type] !== undefined) this.resources[type] += amt; },
    addXp: function(amt) { /* mock */ },
    multiplier: 1,
  };
}

describe('InventoryManager', () => {
  let eco;
  let inv;

  beforeEach(() => {
    eco = makeMockEconomy();
    inv = new InventoryManager(eco);
  });

  describe('getAllRecipes', () => {
    it('should return all 9 recipes', () => {
      const recipes = inv.getAllRecipes();
      expect(recipes).toHaveLength(9);
      expect(recipes[0].id).toBe('r1');
    });
  });

  describe('canCraft', () => {
    it('should return true when enough resources', () => {
      expect(inv.canCraft('r1')).toBe(true);
    });

    it('should return false when not enough resources', () => {
      eco.resources.gold = 0;
      expect(inv.canCraft('r1')).toBe(false);
    });

    it('should return false for unknown recipe', () => {
      expect(inv.canCraft('nonexistent')).toBe(false);
    });

    it('should correctly check gold=500 recipe when gold is exactly 500', () => {
      eco.resources.gold = 500;
      expect(inv.canCraft('r7')).toBe(true);
    });

    it('should return false if gold is barely insufficient', () => {
      eco.resources.gold = 499;
      expect(inv.canCraft('r7')).toBe(false);
    });
  });

  describe('craft', () => {
    it('should deduct resources and add item on success', () => {
      const goldBefore = eco.resources.gold;
      const foodBefore = eco.resources.food;
      const result = inv.craft('r1');
      expect(result).toBe(true);
      expect(eco.resources.gold).toBe(goldBefore - 10);
      expect(eco.resources.food).toBe(foodBefore - 5);
      expect(inv.getItemCount('bandage')).toBe(1);
    });

    it('should return false and not change state when resources insufficient', () => {
      eco.resources.gold = 0;
      const goldBefore = eco.resources.gold;
      const result = inv.craft('r1');
      expect(result).toBe(false);
      expect(eco.resources.gold).toBe(goldBefore);
      expect(inv.getItemCount('bandage')).toBe(0);
    });

    it('should return false for unknown recipe', () => {
      expect(inv.craft('nope')).toBe(false);
    });

    it('should increment item count on multiple crafts', () => {
      inv.craft('r1');
      inv.craft('r1');
      expect(inv.getItemCount('bandage')).toBe(2);
    });

    it('should fire _onCrafted callback on success', () => {
      let crafted = null;
      inv._onCrafted = (r) => { crafted = r; };
      inv.craft('r8');
      expect(crafted).toBeTruthy();
      expect(crafted.id).toBe('r8');
    });
  });

  describe('getItemCount', () => {
    it('should return 0 for uncrafted items', () => {
      expect(inv.getItemCount('bandage')).toBe(0);
    });

    it('should return count after crafting', () => {
      inv.craft('r2');
      expect(inv.getItemCount('heal_potion')).toBe(1);
    });
  });

  describe('useItem', () => {
    it('should return false if item not owned', () => {
      expect(inv.useItem('bandage')).toBe(false);
    });

    it('should decrease item count after use', () => {
      inv.craft('r1');
      expect(inv.getItemCount('bandage')).toBe(1);
      inv.useItem('bandage', null);
      expect(inv.getItemCount('bandage')).toBe(0);
    });

    it('should add xp when using xp_scroll', () => {
      inv.craft('r6');
      let xpAdded = 0;
      eco.addXp = (amt) => { xpAdded = amt; };
      inv.useItem('xp_scroll', null);
      expect(xpAdded).toBe(500);
    });

    it('should set multiplier to 2 when using power_gem', () => {
      inv.craft('r7');
      eco.multiplier = 1;
      inv.useItem('power_gem', null);
      expect(eco.multiplier).toBe(2);
      // Clean up timer
      if (inv._gemTimer) { clearTimeout(inv._gemTimer); inv._gemTimer = null; }
    });
  });

  describe('getState / loadState / getSaveData', () => {
    it('getState should return items and recipes', () => {
      const state = inv.getState();
      expect(state.items).toBeDefined();
      expect(state.recipes).toHaveLength(9);
    });

    it('getSaveData should return items and maxCapacity', () => {
      inv.craft('r1');
      const data = inv.getSaveData();
      expect(data.items.bandage).toBeDefined();
      expect(data.items.bandage.count).toBe(1);
      expect(data.maxCapacity).toBe(20);
    });

    it('loadState should restore items', () => {
      inv.loadState({ items: { bandage: { count: 3, level: 1 }, heal_potion: { count: 1, level: 1 } } });
      expect(inv.getItemCount('bandage')).toBe(3);
      expect(inv.getItemCount('heal_potion')).toBe(1);
    });

    it('loadState should handle null gracefully', () => {
      inv.loadState(null);
      expect(inv.getItemCount('bandage')).toBe(0);
    });
  });
});
