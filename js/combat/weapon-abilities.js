"use strict";

/**
 * =============================================================================
 *  ⚔️ قدرات الأسلحة الخاصة — Weapon Special Abilities
 * =============================================================================
 *  كل سلاح له:
 *  1. قدرة سلبية (Passive) — تُفعّل تلقائياً عند تجهيز السلاح
 *  2. قدرة نشطة (Active) — تُفعّل عند الضربة (فرصة عشوائية)
 *
 *  القدرات تجعل كل سلاح يشعر بفريدية — ليس مجرد أرقام
 * =============================================================================
 */

export const WEAPON_ABILITIES = {
  w1: {
    weaponName: "سيف بدوي",
    icon: "🗡️",
    passive: {
      name: "دموع البدو",
      desc: "كل ضربة تُسبب نزيفاً — ضرر مستمر 3 ثوانٍ",
      type: "bleed",
      chance: 0.30,       // 30% فرصة التفعيل
      dps: 3,             // ضرر لكل ثانية
      duration: 3,        // المدة بالثواني
      icon: "🩸",
    },
    active: {
      name: "هجمة سريعة",
      desc: "هجوم مزدوج سريع — ضربتان في وقت واحد",
      type: "double_strike",
      chance: 0.15,       // 15% فرصة
      multiplier: 1.5,    // ضرر كل ضربة
      icon: "⚡",
    },
  },

  w2: {
    weaponName: "قوس طويل",
    icon: "🏹",
    passive: {
      name: "سهم السم",
      desc: "كل سهم يُضعف العدو — يقلل دفاعه 10% لمدة 5 ثوانٍ",
      type: "armor_break",
      chance: 0.25,
      defenseReduction: 0.10, // 10% تقليل دفاع
      duration: 5,
      icon: "☠️",
    },
    active: {
      name: "سهم مزدوج",
      desc: "يطلق سهمين في آن واحد — كل سهم 70% من الضرر",
      type: "double_shot",
      chance: 0.20,
      multiplier: 0.7,    // ضرر كل سهم
      icon: "🏹",
    },
  },

  w3: {
    weaponName: "رمح حديدي",
    icon: "🔱",
    passive: {
      name: "صدمه",
      desc: "كل ضربة فرصة 20% لتثبيت العدو لمدة ثانية",
      type: "stun",
      chance: 0.20,
      duration: 1.0,      // ثوانٍ
      icon: "💫",
    },
    active: {
      name: "رمح رميق",
      desc: "رمي الرمح — ضرر 2x + تثبيت لثانيتين",
      type: "throw",
      multiplier: 2.0,
      stunDuration: 2.0,
      icon: "🎯",
    },
  },

  w4: {
    weaponName: "سيف دمشقي",
    icon: "⚔️",
    passive: {
      name: "حدة الفولاذ",
      desc: "فرصة 20% لضربة حرجة إضافية (150% ضرر)",
      type: "crit_boost",
      chance: 0.20,
      bonusCritDamage: 1.5,
      icon: "💀",
    },
    active: {
      name: "قطع حاسم",
      desc: "هجوم واحد بـ 3x ضرر — لكن يأخذ 5% من HP كثمن",
      type: "execute",
      multiplier: 3.0,
      selfDamagePercent: 0.05,
      icon: "🩸",
    },
  },

  w5: {
    weaponName: "قوس ناري",
    icon: "🏹🔥",
    passive: {
      name: "لهيب مستمر",
      desc: "كل سهم يشعل العدو — حرق 5 ضرر لكل ثانية لمدة 4 ثوانٍ",
      type: "burn",
      chance: 0.25,
      dps: 5,
      duration: 4,
      icon: "🔥",
    },
    active: {
      name: "سهم كروي",
      desc: "سهم ينفجر — يضر كل الأعداء القريبين بـ 80% ضرر",
      type: "aoe",
      chance: 0.18,
      multiplier: 0.8,
      radius: 80,
      icon: "💥",
    },
  },

  w6: {
    weaponName: "فأس معركة",
    icon: "🪓",
    passive: {
      name: "صدمة ثقيلة",
      desc: "كل ضربة تبطئ العدو 30% لمدة ثانيتين",
      type: "slow",
      chance: 0.25,
      slowPercent: 0.30,
      duration: 2,
      icon: "🧊",
    },
    active: {
      name: "ضربة مدمرة",
      desc: "ضربة أرضية — تدمر كل شيء قريب بـ 2.5x ضرر + صدمة 3 ثوانٍ",
      type: "ground_slam",
      multiplier: 2.5,
      stunDuration: 3.0,
      radius: 100,
      icon: "🌋",
    },
  },
};

// ═══════════════════════════════════════════════════════════════════
//  مدير قدرات الأسلحة
// ═══════════════════════════════════════════════════════════════════

export class WeaponAbilityManager {
  constructor() {
    // التأثيرات النشطة حالياً على الوحوش
    this.activeEffects = new Map(); // monsterId → [{type, timer, ...}]

    // Cooldowns للقدرات النشطة
    this.activeCooldowns = new Map(); // weaponId → timer

    // إحصائيات
    this.stats = {
      passivesTriggered: 0,
      activesTriggered: 0,
      totalDamageDealt: 0,
    };
  }

  /**
   * محاولة تفعيل قدرة سلبية عند الضربة
   * @returns {Object|null} تأثير القدرة إذا تفعّلت، أو null
   */
  tryPassive(weaponId, target) {
    const weaponAbilities = WEAPON_ABILITIES[weaponId];
    if (!weaponAbilities || !weaponAbilities.passive) return null;

    const passive = weaponAbilities.passive;
    if (Math.random() >= passive.chance) return null;

    this.stats.passivesTriggered++;

    switch (passive.type) {
      case "bleed":
        return this._applyBleed(target, passive);
      case "armor_break":
        return this._applyArmorBreak(target, passive);
      case "stun":
        return this._applyStun(target, passive);
      case "crit_boost":
        return this._applyCritBoost(passive);
      case "burn":
        return this._applyBurn(target, passive);
      case "slow":
        return this._applySlow(target, passive);
      default:
        return null;
    }
  }

  /**
   * محاولة تفعيل قدرة نشطة عند الضربة
   * @returns {Object|null} تأثير القدرة إذا تفعّلت، أو null
   */
  tryActive(weaponId, target, baseDamage) {
    const weaponAbilities = WEAPON_ABILITIES[weaponId];
    if (!weaponAbilities || !weaponAbilities.active) return null;

    const active = weaponAbilities.active;
    if (Math.random() >= active.chance) return null;

    this.stats.activesTriggered++;

    switch (active.type) {
      case "double_strike":
        return this._activateDoubleStrike(active, baseDamage);
      case "double_shot":
        return this._activateDoubleShot(active, baseDamage);
      case "throw":
        return this._activateThrow(active, baseDamage, target);
      case "execute":
        return this._activateExecute(active, baseDamage, target);
      case "aoe":
        return this._activateAoe(active, baseDamage, target);
      case "ground_slam":
        return this._activateGroundSlam(active, baseDamage, target);
      default:
        return null;
    }
  }

  /**
   * تحديث جميع التأثيرات النشطة (يُستدعى كل frame)
   */
  update(dt) {
    // تحديث تأثيرات الوحوش
    for (const [monsterId, effects] of this.activeEffects) {
      for (let i = effects.length - 1; i >= 0; i--) {
        const effect = effects[i];
        effect.timer -= dt;

        // تطبيق الضرر المستمر
        if (effect.type === "bleed" || effect.type === "burn") {
          effect.tickTimer = (effect.tickTimer || 0) + dt;
          if (effect.tickTimer >= 1) {
            effect.tickTimer -= 1;
            effect.dpsApplied = (effect.dpsApplied || 0) + effect.dps;
          }
        }

        if (effect.timer <= 0) {
          effects.splice(i, 1);
        }
      }
      if (effects.length === 0) {
        this.activeEffects.delete(monsterId);
      }
    }

    // تحديث cooldowns
    for (const [weaponId, timer] of this.activeCooldowns) {
      if (timer > 0) {
        this.activeCooldowns.set(weaponId, timer - dt);
      }
    }
  }

  /**
   * الحصول على الضرر المستمر المتبقي لوحش معين
   */
  getDotDamage(monsterId) {
    const effects = this.activeEffects.get(monsterId);
    if (!effects) return 0;
    let totalDot = 0;
    for (const e of effects) {
      if ((e.type === "bleed" || e.type === "burn") && e.dpsApplied) {
        totalDot += e.dpsApplied;
        e.dpsApplied = 0; // reset after applying
      }
    }
    return totalDot;
  }

  /**
   * الحصول على مضاعفات الضرر الحالية لوحش معين
   */
  getDamageModifiers(monsterId) {
    const effects = this.activeEffects.get(monsterId) || [];
    const mods = { damageMultiplier: 1, defenseMultiplier: 1, speedMultiplier: 1, stunned: false };
    for (const e of effects) {
      if (e.type === "armor_break") {
        mods.defenseMultiplier -= e.defenseReduction;
      }
      if (e.type === "slow") {
        mods.speedMultiplier -= e.slowPercent;
      }
      if (e.type === "stun") {
        mods.stunned = true;
      }
    }
    return mods;
  }

  /**
   * الحصول على وصف قدرات سلاح معين
   */
  getWeaponAbilityInfo(weaponId) {
    return WEAPON_ABILITIES[weaponId] || null;
  }

  /**
   * الحصول على إحصائيات
   */
  getStats() {
    return { ...this.stats };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  تطبيقات القدرات السلبية
  // ═══════════════════════════════════════════════════════════════════

  _applyBleed(target, passive) {
    const id = target?.id ?? "unknown";
    if (!this.activeEffects.has(id)) this.activeEffects.set(id, []);
    this.activeEffects.get(id).push({
      type: "bleed",
      dps: passive.dps,
      timer: passive.duration,
      duration: passive.duration,
      tickTimer: 0,
      dpsApplied: 0,
      icon: passive.icon,
      name: passive.name,
    });
    return { type: "bleed", text: `${passive.icon} نزيف!`, dps: passive.dps, duration: passive.duration };
  }

  _applyBurn(target, passive) {
    const id = target?.id ?? "unknown";
    if (!this.activeEffects.has(id)) this.activeEffects.set(id, []);
    this.activeEffects.get(id).push({
      type: "burn",
      dps: passive.dps,
      timer: passive.duration,
      duration: passive.duration,
      tickTimer: 0,
      dpsApplied: 0,
      icon: passive.icon,
      name: passive.name,
    });
    return { type: "burn", text: `${passive.icon} حرق!`, dps: passive.dps, duration: passive.duration };
  }

  _applyArmorBreak(target, passive) {
    const id = target?.id ?? "unknown";
    if (!this.activeEffects.has(id)) this.activeEffects.set(id, []);
    this.activeEffects.get(id).push({
      type: "armor_break",
      defenseReduction: passive.defenseReduction,
      timer: passive.duration,
      icon: passive.icon,
      name: passive.name,
    });
    return { type: "armor_break", text: `${passive.icon} دفاع منخفض!`, percent: passive.defenseReduction * 100 };
  }

  _applyStun(target, passive) {
    const id = target?.id ?? "unknown";
    if (!this.activeEffects.has(id)) this.activeEffects.set(id, []);
    this.activeEffects.get(id).push({
      type: "stun",
      timer: passive.duration,
      icon: passive.icon,
      name: passive.name,
    });
    return { type: "stun", text: `${passive.icon} تثبيت!`, duration: passive.duration };
  }

  _applyCritBoost(passive) {
    return { type: "crit_boost", text: `${passive.icon} ضربة حرجة!`, bonusDamage: passive.bonusCritDamage };
  }

  _applySlow(target, passive) {
    const id = target?.id ?? "unknown";
    if (!this.activeEffects.has(id)) this.activeEffects.set(id, []);
    this.activeEffects.get(id).push({
      type: "slow",
      slowPercent: passive.slowPercent,
      timer: passive.duration,
      icon: passive.icon,
      name: passive.name,
    });
    return { type: "slow", text: `${passive.icon} تباطؤ!`, percent: passive.slowPercent * 100 };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  تطبيقات القدرات النشطة
  // ═══════════════════════════════════════════════════════════════════

  _activateDoubleStrike(active, baseDamage) {
    return {
      type: "double_strike",
      text: `${active.icon} هجمة مزدوجة!`,
      extraDamage: Math.floor(baseDamage * active.multiplier),
      hits: 2,
    };
  }

  _activateDoubleShot(active, baseDamage) {
    return {
      type: "double_shot",
      text: `${active.icon} سهم مزدوج!`,
      extraDamage: Math.floor(baseDamage * active.multiplier),
      hits: 2,
    };
  }

  _activateThrow(active, baseDamage, target) {
    return {
      type: "throw",
      text: `${active.icon} رمح رميق!`,
      damage: Math.floor(baseDamage * active.multiplier),
      stunDuration: active.stunDuration,
    };
  }

  _activateExecute(active, baseDamage, target) {
    const hpRatio = target?.hp && target?.maxHp ? target.hp / target.maxHp : 1;
    const executeBonus = hpRatio < 0.3 ? 2 : 1; // ضرر مضاعف إذا HP < 30%
    return {
      type: "execute",
      text: `${active.icon} قطع حاسم!`,
      damage: Math.floor(baseDamage * active.multiplier * executeBonus),
      selfDamagePercent: active.selfDamagePercent,
      bonusText: executeBonus > 1 ? " 🔥 تمديد!" : "",
    };
  }

  _activateAoe(active, baseDamage) {
    return {
      type: "aoe",
      text: `${active.icon} انفجار!`,
      damage: Math.floor(baseDamage * active.multiplier),
      radius: active.radius,
    };
  }

  _activateGroundSlam(active, baseDamage) {
    return {
      type: "ground_slam",
      text: `${active.icon} ضربة مدمرة!`,
      damage: Math.floor(baseDamage * active.multiplier),
      stunDuration: active.stunDuration,
      radius: active.radius,
    };
  }
}
