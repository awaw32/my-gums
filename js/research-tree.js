"use strict";

/**
 * 🧪 شجرة البحوث — نسخة العميل (متزامنة مع server/db/research.js)
 */

export const RESEARCH_DEFS = {
  military: {
    id: "military",
    name: "البحوث العسكرية",
    icon: "⚔️",
    skills: {
      desertShield: {
        id: "desertShield",
        name: "درع الصحراء",
        maxLevel: 20,
        baseCost: { cash: 200, gold: 5 },
        costScale: 1.22,
        effectDesc: "دفاع +3% لكل مستوى",
        effectPerLevel: { defensePercent: 3 },
      },
      pursuitTactic: {
        id: "pursuitTactic",
        name: "تكتيك الملاحقة",
        maxLevel: 15,
        baseCost: { cash: 150, gold: 3 },
        costScale: 1.25,
        effectDesc: "سرعة حركة +2% + قوة تحمل +1% لكل مستوى",
        effectPerLevel: { moveSpeedPercent: 2, endurancePercent: 1 },
      },
    },
  },
  economic: {
    id: "economic",
    name: "البحوث الاقتصادية",
    icon: "💰",
    skills: {
      insight: {
        id: "insight",
        name: "الفراسة",
        maxLevel: 25,
        baseCost: { cash: 100, gold: 2, gems: 1 },
        costScale: 1.18,
        effectDesc: "إنتاج الذهب +4% لكل مستوى",
        effectPerLevel: { goldProduction: 4 },
      },
      trade: {
        id: "trade",
        name: "التجارة",
        maxLevel: 20,
        baseCost: { cash: 150, gold: 4 },
        costScale: 1.20,
        effectDesc: "بلورات زرقاء +2% وسرعة بناء +2% لكل مستوى",
        effectPerLevel: { crystalProduction: 2, buildSpeed: 2 },
      },
    },
  },
  // 🏜️ بحوث سرية — تُقفل حتى يصل اللاعب برستيج "شيخ حكيم" (المستوى 3)
  secret: {
    id: "secret",
    name: "البحوث السرية",
    icon: "🔮",
    prestigeRequired: 3,
    skills: {
      mirage: {
        id: "mirage",
        name: "سراب الصحراء",
        maxLevel: 10,
        baseCost: { cash: 500, gold: 20, desertGem: 1 },
        costScale: 1.3,
        effectDesc: "فرصة تفادي +2% لكل مستوى",
        effectPerLevel: { dodgePercent: 2 },
      },
      ancientWisdom: {
        id: "ancientWisdom",
        name: "حكمة القدماء",
        maxLevel: 10,
        baseCost: { cash: 500, gold: 20, desertGem: 1 },
        costScale: 1.3,
        effectDesc: "خبرة +5% لكل مستوى",
        effectPerLevel: { xpBonusPercent: 5 },
      },
      forbiddenAlchemy: {
        id: "forbiddenAlchemy",
        name: "الخيمياء المحرَّمة",
        maxLevel: 10,
        baseCost: { cash: 500, gold: 20, desertGem: 1 },
        costScale: 1.3,
        effectDesc: "إنتاج الجواهر +3% لكل مستوى",
        effectPerLevel: { gemProduction: 3 },
      },
    },
  },
};

export class ResearchTree {
  constructor(economy) {
    this.economy = economy;
    this.research = {}; // { "military.desertShield": level }
    this.academyLevel = 0;
    this.palaceLevel = 1;
    this.prestigeLevel = 0; // يُضبط من main.js بعد إنشاء PrestigeManager
    this._onChanged = null;
  }

  getSkillDef(categoryId, skillId) {
    return RESEARCH_DEFS[categoryId]?.skills?.[skillId] || null;
  }

  isCategoryUnlocked(categoryId) {
    const cat = RESEARCH_DEFS[categoryId];
    if (!cat) return false;
    if (!cat.prestigeRequired) return true;
    return this.prestigeLevel >= cat.prestigeRequired;
  }

  getLevel(categoryId, skillId) {
    return this.research[`${categoryId}.${skillId}`] || 0;
  }

  computeCost(categoryId, skillId) {
    const def = this.getSkillDef(categoryId, skillId);
    if (!def) return null;
    const level = this.getLevel(categoryId, skillId);
    const scale = Math.pow(def.costScale, level);
    const cost = {};
    for (const [res, val] of Object.entries(def.baseCost)) {
      cost[res] = Math.floor(val * scale);
    }
    return cost;
  }

  canUpgrade(categoryId, skillId) {
    const def = this.getSkillDef(categoryId, skillId);
    if (!def) return { allowed: false, reason: "مهارة غير معروفة" };
    if (!this.isCategoryUnlocked(categoryId)) {
      const required = RESEARCH_DEFS[categoryId].prestigeRequired;
      return { allowed: false, reason: `🔒 يتطلب برستيج مستوى ${required}` };
    }
    const key = `${categoryId}.${skillId}`;
    const current = this.research[key] || 0;
    if (current >= def.maxLevel) return { allowed: false, reason: "الحد الأقصى" };
    const maxFromAcademy = this.academyLevel * 2;
    if (current >= maxFromAcademy) return { allowed: false, reason: `أكاديمية الأبحاث مستوى ${this.academyLevel} تسمح بحد أقصى ${maxFromAcademy}` };
    if (current >= this.palaceLevel) return { allowed: false, reason: `بيت الزعيم مستوى ${this.palaceLevel} يمنع الترقية أكثر` };
    const cost = this.computeCost(categoryId, skillId);
    for (const [res, val] of Object.entries(cost)) {
      if (!this.economy.canAfford(res, val)) {
        const names = { cash: "💵", gold: "🪙", gems: "💎", scrolls: "📜", hammers: "🔨", artifacts: "🏺", desertGem: "💠" };
        return { allowed: false, reason: `غير كافٍ ${names[res] || res}: تحتاج ${val}` };
      }
    }
    return { allowed: true, cost };
  }

  upgrade(categoryId, skillId) {
    const check = this.canUpgrade(categoryId, skillId);
    if (!check.allowed) return false;
    const key = `${categoryId}.${skillId}`;
    for (const [res, val] of Object.entries(check.cost)) {
      this.economy.spend(res, val);
    }
    this.research[key] = (this.research[key] || 0) + 1;
    if (this._onChanged) this._onChanged(categoryId, skillId, this.research[key]);
    return true;
  }

  getEffects() {
    const effects = {
      defensePercent: 0, moveSpeedPercent: 0, endurancePercent: 0,
      goldProduction: 0, crystalProduction: 0, buildSpeed: 0,
      dodgePercent: 0, xpBonusPercent: 0, gemProduction: 0,
    };
    for (const [catId, cat] of Object.entries(RESEARCH_DEFS)) {
      for (const [skillId, skill] of Object.entries(cat.skills)) {
        const level = this.getLevel(catId, skillId);
        for (const [effect, perLevel] of Object.entries(skill.effectPerLevel)) {
          effects[effect] = (effects[effect] || 0) + level * perLevel;
        }
      }
    }
    return effects;
  }

  getCategories() {
    return Object.values(RESEARCH_DEFS).filter(cat => this.isCategoryUnlocked(cat.id));
  }

  loadState(saved) {
    if (!saved) return;
    if (saved.research) this.research = { ...saved.research };
    if (saved.academyLevel !== undefined) this.academyLevel = saved.academyLevel;
    if (saved.palaceLevel !== undefined) this.palaceLevel = saved.palaceLevel;
  }

  getSaveData() {
    return {
      research: this.research,
      academyLevel: this.academyLevel,
      palaceLevel: this.palaceLevel,
    };
  }
}
