"use strict";

/**
 * نسخة الخادم من تعريفات الأعداء
 * يجب أن تبقى متزامنة مع js/enemies.js
 */

const ENEMY_TYPES = {
  // ── فصل 1: قرية الواحة ──
  desert_wolf: {
    id: "desert_wolf",
    name: "ذئب صحراوي",
    icon: "🐺",
    hp: 35,
    damage: 6,
    reward: { cash: 8, gold: 2 },
    level: 1,
    color: "#8a5a3a",
    radius: 14,
    speed: 120,
    description: "ذئب جائع يهاجم المستوطنين الجدد",
    ability: { type: "pack_call", chance: 0.2, desc: "ينادي ذئباً آخر للمساعدة" }
  },
  desert_scorpion: {
    id: "desert_scorpion",
    name: "عقرب صحراوي",
    icon: "🦂",
    hp: 50,
    damage: 10,
    reward: { cash: 15, gold: 5 },
    level: 3,
    color: "#8b4513",
    radius: 12,
    speed: 100,
    description: "عقرب سام يحرس الواحة",
    ability: { type: "poison", chance: 0.3, desc: "يسم الخصم — ضرر مستمر لمدة 3ث", poisonDps: 3, poisonDuration: 3 }
  },
  desert_thief: {
    id: "desert_thief",
    name: "لص صحراوي",
    icon: "🗡️",
    hp: 80,
    damage: 15,
    reward: { cash: 25, gold: 8 },
    level: 5,
    color: "#2c1810",
    radius: 16,
    speed: 110,
    description: "لص يسرق الموارد من المستوطنين",
    ability: { type: "dodge", chance: 0.3, desc: "يتفادى الهجمات بنسبة 30%" }
  },

  // ── Boss فصل 1 ──
  wadi_boss: {
    id: "wadi_boss",
    name: "ذئب الواحة",
    icon: "🌪️",
    hp: 200,
    damage: 25,
    reward: { cash: 100, gold: 30 },
    level: 8,
    color: "#c0392b",
    radius: 22,
    speed: 90,
    isBoss: true,
    description: "عاصفة رملية كبرى تهدد الواحة",
    ability: { type: "sandstorm", chance: 0.15, desc: "عاصفة رملية تعمي الخصم — تقلل دقته 50% لـ 3ث" }
  },

  // ── فصل 2: أطلال القصر ──
  palace_ghost: {
    id: "palace_ghost",
    name: "شبح القصر",
    icon: "👻",
    hp: 120,
    damage: 20,
    reward: { cash: 50, gold: 15 },
    level: 15,
    color: "#7f8c8d",
    radius: 18,
    speed: 80,
    description: "شبح فارس قديم يحرس القصر",
    ability: { type: "phase", chance: 0.25, desc: "يتلاشى ويتجنب الهجمات لـ 1.5ث" }
  },
  shadow_knight: {
    id: "shadow_knight",
    name: "فارس الظل",
    icon: "🗡️",
    hp: 180,
    damage: 30,
    reward: { cash: 80, gold: 25 },
    level: 18,
    color: "#1a1a2e",
    radius: 20,
    speed: 95,
    description: "فارس مدرع من العصر القديم",
    ability: { type: "charge", chance: 0.2, desc: "هجوم سريع — ضرر ×2", chargeMultiplier: 2 }
  },
  sand_sorcerer: {
    id: "sand_sorcerer",
    name: "ساحر متجول",
    icon: "🧙",
    hp: 250,
    damage: 40,
    reward: { cash: 120, gold: 40 },
    level: 22,
    color: "#8e44ad",
    radius: 18,
    speed: 70,
    description: "ساحر يستخدم قوى الرمال",
    ability: { type: "heal", chance: 0.15, desc: "يشفي نفسه بنسبة 30% من HP", healPercent: 0.3 }
  },

  // ── Boss فصل 2 ──
  palace_boss: {
    id: "palace_boss",
    name: "ساحر الرمال",
    icon: "🏰",
    hp: 800,
    damage: 60,
    reward: { cash: 400, gold: 80, scrolls: 10 },
    level: 25,
    color: "#d4ac0d",
    radius: 25,
    speed: 85,
    isBoss: true,
    description: "حارس أخير يحرس الكنوز القديمة",
    ability: { type: "shield", chance: 0.2, desc: "يدرع نفسه — يقلل الضرر 50% لـ 3ث" }
  },

  // ── فصل 3: قلعة الجبل ──
  mountain_warrior: {
    id: "mountain_warrior",
    name: "محارب الغزو",
    icon: "⚔️",
    hp: 400,
    damage: 50,
    reward: { cash: 200, gold: 50 },
    level: 30,
    color: "#7f8c8d",
    radius: 20,
    speed: 100,
    description: "محارب مدرب يهاجم القلاع",
    ability: { type: "charge", chance: 0.2, desc: "هجوم سريع — ضرر ×2", chargeMultiplier: 2 }
  },
  iron_knight: {
    id: "iron_knight",
    name: "فارس الحديد",
    icon: "🛡️",
    hp: 600,
    damage: 70,
    reward: { cash: 350, gold: 80 },
    level: 35,
    color: "#566573",
    radius: 22,
    speed: 85,
    description: "فارس بدرع حديدي ثقيل",
    ability: { type: "shield", chance: 0.2, desc: "يدرع نفسه — يقلل الضرر 50% لـ 3ث" }
  },
  mountain_eagle: {
    id: "mountain_eagle",
    name: "عصفور الجبل",
    icon: "🦅",
    hp: 800,
    damage: 90,
    reward: { cash: 500, gold: 120 },
    level: 40,
    color: "#1a5276",
    radius: 20,
    speed: 130,
    description: "طائر ضخم يهاجم من السماء",
    ability: { type: "swoop", chance: 0.15, desc: "انقضاض سريع — ضرر ×3", chargeMultiplier: 3 }
  },

  // ── Boss فصل 3 ──
  mountain_boss: {
    id: "mountain_boss",
    name: "تنين الجبل",
    icon: "🐉",
    hp: 3000,
    damage: 150,
    reward: { cash: 1500, gold: 200, gems: 10 },
    level: 45,
    color: "#922b21",
    radius: 30,
    speed: 80,
    isBoss: true,
    description: "تنين عظيم يحرس قمة الجبل",
    ability: { type: "fire_breath", chance: 0.12, desc: "نفس النار — ضرر ×3 لكل الجنود", chargeMultiplier: 3 }
  },

  // ── فصل 4: سهول الريف ──
  bandit: {
    id: "bandit",
    name: "قطاع طرق",
    icon: "🗡️",
    hp: 1200,
    damage: 100,
    reward: { cash: 800, gold: 150 },
    level: 50,
    color: "#4a235a",
    radius: 18,
    speed: 110,
    description: "لص مسلح يهاجم القوافل التجارية",
    ability: { type: "dodge", chance: 0.25, desc: "يتفادى الهجمات بنسبة 25%" }
  },
  armored_knight: {
    id: "armored_knight",
    name: "فارس مدرع",
    icon: "🛡️",
    hp: 1800,
    damage: 130,
    reward: { cash: 1200, gold: 220 },
    level: 55,
    color: "#1b2631",
    radius: 22,
    speed: 80,
    description: "فارس بدرع كامل وسلاح ثقيل",
    ability: { type: "shield", chance: 0.25, desc: "يدرع نفسه — يقلل الضرر 50% لـ 3ث" }
  },
  war_sorcerer: {
    id: "war_sorcerer",
    name: "ساحر حرب",
    icon: "🧙",
    hp: 2500,
    damage: 170,
    reward: { cash: 1800, gold: 300 },
    level: 60,
    color: "#6c3483",
    radius: 18,
    speed: 90,
    description: "ساحر يتحكم في عناصر الحرب",
    ability: { type: "aoe", chance: 0.12, desc: "هجوم شامل — يضر كل الجنود", aoeDamage: 50 }
  },

  // ── Boss فصل 4 ──
  plains_boss: {
    id: "plains_boss",
    name: "جيش الغزاة",
    icon: "⚔️",
    hp: 12000,
    damage: 300,
    reward: { cash: 5000, gold: 500, gems: 50 },
    level: 65,
    color: "#7b241c",
    radius: 35,
    speed: 70,
    isBoss: true,
    description: "جيش كامل من الغزاة يهدد السهول",
    ability: { type: "aoe", chance: 0.1, desc: "هجوم شامل — يضر كل الجنود", aoeDamage: 100 }
  },

  // ── فصل 5: قصر الملك ──
  royal_rebel: {
    id: "royal_rebel",
    name: "متمرد ملكي",
    icon: "⚔️",
    hp: 5000,
    damage: 200,
    reward: { cash: 3000, gold: 400 },
    level: 75,
    color: "#922b21",
    radius: 20,
    speed: 95,
    description: "محارب متمرد يريد العرش",
    ability: { type: "charge", chance: 0.15, desc: "هجوم سريع — ضرر ×2.5", chargeMultiplier: 2.5 }
  },
  fleet_knight: {
    id: "fleet_knight",
    name: "فارس الأسطول",
    icon: "🚢",
    hp: 7000,
    damage: 250,
    reward: { cash: 4500, gold: 550 },
    level: 85,
    color: "#1a5276",
    radius: 24,
    speed: 85,
    description: "قائد أسطول بحري غازي",
    ability: { type: "shield", chance: 0.2, desc: "يدرع نفسه — يقلل الضرر 50% لـ 3ث" }
  },
  dark_sorcerer: {
    id: "dark_sorcerer",
    name: "ساحر الظلام",
    icon: "🌑",
    hp: 10000,
    damage: 350,
    reward: { cash: 6000, gold: 700, gems: 100 },
    level: 95,
    color: "#0d0d0d",
    radius: 20,
    speed: 90,
    description: "ساحر ظلام أقوى يهدد المملكة",
    ability: { type: "heal", chance: 0.12, desc: "يشفي نفسه بنسبة 40% من HP", healPercent: 0.4 }
  },

  // ── Boss النهائي ──
  final_boss: {
    id: "final_boss",
    name: "صقر الصحراء",
    icon: "🦅",
    hp: 35000,
    damage: 500,
    reward: { cash: 20000, gold: 2000, gems: 500 },
    level: 100,
    color: "#ffd700",
    radius: 40,
    speed: 100,
    isBoss: true,
    description: "آخر تحدٍ قبل العرش - صقر عملاق يحرس العرش الملكي",
    ability: { type: "swoop", chance: 0.1, desc: "انقضاض سريع — ضرر ×4", chargeMultiplier: 4 }
  },

  // ── أعداء إضافيين ──
  scorpion_elite: {
    id: "scorpion_elite",
    name: "عقرب النخبة",
    icon: "🦂",
    hp: 180,
    damage: 35,
    reward: { cash: 80, gold: 25, gems: 3 },
    level: 10,
    color: "#8b0000",
    radius: 16,
    speed: 110,
    description: "عقرب ضخم بسم قاتل - يظهر نادراً",
    ability: { type: "poison", chance: 0.4, desc: "يسم الخصم بقوة — ضرر مستمر 5ث", poisonDps: 5, poisonDuration: 5 }
  },
  sand_dragon: {
    id: "sand_dragon",
    name: "تنين الرمال",
    icon: "🐉",
    hp: 5000,
    damage: 200,
    reward: { cash: 3000, gold: 500, gems: 25 },
    level: 70,
    color: "#daa520",
    radius: 28,
    speed: 90,
    isBoss: true,
    description: "تنين صحراوي نادر يظهر في العواصف الرملية",
    ability: { type: "fire_breath", chance: 0.12, desc: "نفس النار — ضرر ×3 لكل الجنود", chargeMultiplier: 3 }
  },
  giant_sand: {
    id: "giant_sand",
    name: "عملاق الرمال",
    icon: "🗿",
    hp: 800,
    damage: 80,
    reward: { cash: 600, gold: 150, gems: 10 },
    level: 25,
    color: "#c4a35a",
    radius: 26,
    speed: 60,
    description: "عملاق صحراوي ضخم مصنوع من الرمال المتحجرة",
    ability: { type: "stomp", chance: 0.15, desc: "ضربة أرضية — تبطئ الخصم 50% لـ 2ث" }
  },
  mystic_mage: {
    id: "mystic_mage",
    name: "ساحر غامض",
    icon: "🧙",
    hp: 350,
    damage: 55,
    reward: { cash: 250, gold: 60, scrolls: 10 },
    level: 20,
    color: "#6c3483",
    radius: 16,
    speed: 80,
    description: "ساحر قديم يحرس الأسرار المدفونة",
    ability: { type: "heal", chance: 0.2, desc: "يشفي نفسه بنسبة 50% من HP", healPercent: 0.5 }
  },
  thief_assassin: {
    id: "thief_assassin",
    name: "لص قاتل",
    icon: "🗡️",
    hp: 200,
    damage: 40,
    reward: { cash: 150, gold: 35, gems: 5 },
    level: 12,
    color: "#1a1a1a",
    radius: 14,
    speed: 130,
    description: "لص سريع يهاجم من الظلام",
    ability: { type: "dodge", chance: 0.35, desc: "يتفادى الهجمات بنسبة 35%" }
  }
};

function getEnemyForLevel(level) {
  const enemies = Object.values(ENEMY_TYPES).filter(e => !e.isBoss && e.level <= level);
  if (enemies.length === 0) return ENEMY_TYPES.desert_wolf;
  return enemies[Math.floor(Math.random() * enemies.length)];
}

function getBossForVillage(villageId) {
  const bossMap = {
    wadi: "wadi_boss",
    palace_ruins: "palace_boss",
    mountain: "mountain_boss",
    plains: "plains_boss",
    throne: "final_boss"
  };
  return ENEMY_TYPES[bossMap[villageId]] || null;
}

function getEnemiesForVillage(villageId) {
  const villageEnemies = {
    wadi: ["desert_wolf", "desert_scorpion", "desert_thief"],
    palace_ruins: ["palace_ghost", "shadow_knight", "sand_sorcerer"],
    mountain: ["mountain_warrior", "iron_knight", "mountain_eagle"],
    plains: ["bandit", "armored_knight", "war_sorcerer"],
    throne: ["royal_rebel", "fleet_knight", "dark_sorcerer"]
  };
  return (villageEnemies[villageId] || []).map(id => ENEMY_TYPES[id]);
}

function calculateEnemyPower(enemy, playerLevel) {
  const scale = 1 + (playerLevel - enemy.level) * 0.05;
  return {
    hp: Math.floor(enemy.hp * Math.max(1, scale)),
    damage: Math.floor(enemy.damage * Math.max(1, scale)),
    reward: {
      cash: Math.floor(enemy.reward.cash * Math.max(1, scale)),
      gold: Math.floor(enemy.reward.gold * Math.max(1, scale))
    }
  };
}

module.exports = {
  ENEMY_TYPES,
  getEnemyForLevel,
  getBossForVillage,
  getEnemiesForVillage,
  calculateEnemyPower
};
