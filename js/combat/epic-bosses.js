export function getBossPhaseConfig(bossId) {
  const configs = {
    wadi_boss: {
      phases: [
        { threshold: 1, triggered: false, name: "طور الواحة", },
        { threshold: 0.6, triggered: false, name: "طور العاصفة", enrage: { damageMult: 1.3 }, summon: { enemyId: "desert_wolf", count: 2 } },
        { threshold: 0.25, triggered: false, name: "طور الرمال المتحركة", enrage: { damageMult: 1.6 }, summon: { enemyId: "desert_scorpion", count: 3 }, special: "sandstorm_wave" },
      ],
      lootTable: { cash: [100, 200], gold: [30, 60], artifacts: 2, guaranteed: ["artifacts"] },
      enrageTimer: 90,
      lore: "ذئب الواحة — حارس الواحة القديم, يستدعي العواصف والرمال المتحركة لردع الغزاة",
    },
    palace_boss: {
      phases: [
        { threshold: 1, triggered: false, name: "طور الحراس" },
        { threshold: 0.6, triggered: false, name: "طور الرمال المسحورة", enrage: { damageMult: 1.35 }, summon: { enemyId: "palace_ghost", count: 2 } },
        { threshold: 0.3, triggered: false, name: "طور صرخة الصحراء", enrage: { damageMult: 1.7 }, special: "summon_shield", summon: { enemyId: "shadow_knight", count: 2 } },
      ],
      lootTable: { cash: [400, 800], gold: [80, 160], scrolls: [10, 20], artifacts: 4, guaranteed: ["scrolls", "artifacts"] },
      enrageTimer: 120,
      lore: "ساحر الرمال — يستخدم سحر الرمال القديم لحماية كنوز القصر المدفونة",
    },
    mountain_boss: {
      phases: [
        { threshold: 1, triggered: false, name: "طور التنين" },
        { threshold: 0.65, triggered: false, name: "طور لهيب الصحراء", enrage: { damageMult: 1.4 }, special: "desert_fire_aoe", summon: { enemyId: "mountain_warrior", count: 3 } },
        { threshold: 0.3, triggered: false, name: "طور زلزال الرمال", enrage: { damageMult: 1.8 }, special: "sand_quake", summon: { enemyId: "iron_knight", count: 2 } },
      ],
      lootTable: { cash: [1500, 3000], gold: [200, 400], gems: [10, 20], artifacts: 8, guaranteed: ["gems", "artifacts"] },
      enrageTimer: 150,
      lore: "تنين الجبل — كائن أسطوري ينام تحت الرمال منذ قرون, يستيقظ لحرق كل شيء",
    },
    plains_boss: {
      phases: [
        { threshold: 1, triggered: false, name: "طور الغزو" },
        { threshold: 0.55, triggered: false, name: "طور حصار القافلة", enrage: { damageMult: 1.45 }, summon: { enemyId: "bandit", count: 4 } },
        { threshold: 0.2, triggered: false, name: "طور عاصفة السهول", enrage: { damageMult: 2.0 }, special: "sand_barrage", summon: { enemyId: "war_sorcerer", count: 2 } },
      ],
      lootTable: { cash: [5000, 10000], gold: [500, 1000], gems: [50, 100], artifacts: 15, guaranteed: ["gems", "artifacts"] },
      enrageTimer: 180,
      lore: "جيش الغزاة — جيش ضخم من قطاع الطرق وسحرة الحرب يجتاح السهول بحثاً عن الكنوز",
    },
    final_boss: {
      phases: [
        { threshold: 1, triggered: false, name: "طور الصقر" },
        { threshold: 0.7, triggered: false, name: "طور زوبعة الصحراء", enrage: { damageMult: 1.5 }, special: "swoop_barrage", summon: { enemyId: "royal_rebel", count: 3 } },
        { threshold: 0.4, triggered: false, name: "طور لعنة الرمال", enrage: { damageMult: 2.0 }, special: "sand_curse", summon: { enemyId: "desert_guardian", count: 2 } },
        { threshold: 0.15, triggered: false, name: "طور صقر الموت", enrage: { damageMult: 2.5 }, special: "desert_wrath", summon: { enemyId: "sand_devil", count: 3 } },
      ],
      lootTable: { cash: [20000, 40000], gold: [2000, 4000], gems: [500, 1000], desertGem: 2, artifacts: 30, guaranteed: ["gems", "desertGem", "artifacts"] },
      enrageTimer: 240,
      lore: "صقر الصحراء — الحارس الأخير للعرش, طائر أسطوري يتحكم بالرياح والعواصف",
    },
  };
  return configs[bossId] || null;
}

export function triggerBossPhase(world, monster, phase, bossId) {
  if (!world || !monster || !monster.alive) return;
  const fx = world.worldFx || [];

  fx.push({ x: monster.x, y: monster.y, text: `💢 ${phase.name}!`, color: "#ff2222", life: 2.5, maxLife: 2.5 });
  if (world.engine) world.engine.shake(14, 0.5);

  if (phase.enrage) {
    monster.damage = Math.floor(monster.damage * (phase.enrage.damageMult || 1.5));
    fx.push({ x: monster.x, y: monster.y, text: "🔥 غضب الصحراء!", color: "#ff8800", life: 2, maxLife: 2 });
  }

  if (phase.summon && world.monsters) {
    const count = phase.summon.count || 2;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count;
      const dist = 80 + Math.random() * 40;
      const sx = monster.x + Math.cos(angle) * dist;
      const sy = monster.y + Math.sin(angle) * dist;
      const minionData = PHASE_MINIONS[bossId]?.[phase.summon.enemyId];
      if (!minionData) continue;
      const minion = world.createMonster(`minion_${bossId}_${Date.now()}_${i}`, sx, sy, minionData);
      if (minion) {
        minion.hp = Math.floor(minion.maxHp * 0.6);
        minion.maxHp = minion.hp;
        minion.alive = true;
        minion._summoned = true;
        minion._lifetime = 20;
        minion._aggressiveRange = 400;
        minion._phaseMinion = true;
        world.monsters.push(minion);
      }
    }
    fx.push({ x: monster.x, y: monster.y, text: `👥 استدعاء ${count} أتباع!`, color: "#ff6600", life: 2, maxLife: 2 });
  }

  if (phase.special) {
    triggerBossSpecial(world, monster, phase.special, bossId);
  }
}

const PHASE_MINIONS = {
  wadi_boss: {
    desert_wolf: { id: "desert_wolf", name: "ذئب مستدعى", icon: "🐺", hp: 20, damage: 8, reward: { cash: 3, gold: 1 }, level: 2, color: "#8a5a3a", radius: 12, speed: 120, description: "ذئب صحراوي مستدعى بالسحر" },
    desert_scorpion: { id: "desert_scorpion", name: "عقرب مستدعى", icon: "🦂", hp: 30, damage: 12, reward: { cash: 5, gold: 2 }, level: 4, color: "#8b4513", radius: 10, speed: 100, ability: { type: "poison", chance: 0.2, desc: "سم صحراوي خفيف", poisonDps: 2, poisonDuration: 2 } },
  },
  palace_boss: {
    palace_ghost: { id: "palace_ghost", name: "شبح مستدعى", icon: "👻", hp: 70, damage: 15, reward: { cash: 20, gold: 5 }, level: 12, color: "#7f8c8d", radius: 14, speed: 80, ability: { type: "phase", chance: 0.15, desc: "يتلاشى في الرمال" } },
    shadow_knight: { id: "shadow_knight", name: "فارس الظل", icon: "🗡️", hp: 100, damage: 20, reward: { cash: 30, gold: 10 }, level: 15, color: "#1a1a2e", radius: 16, speed: 90, ability: { type: "charge", chance: 0.15, desc: "هجوم رملي سريع", chargeMultiplier: 1.5 } },
  },
  mountain_boss: {
    mountain_warrior: { id: "mountain_warrior", name: "محارب مستدعى", icon: "⚔️", hp: 200, damage: 30, reward: { cash: 60, gold: 15 }, level: 25, color: "#7f8c8d", radius: 16, speed: 95 },
    iron_knight: { id: "iron_knight", name: "فارس حديد", icon: "🛡️", hp: 350, damage: 40, reward: { cash: 100, gold: 25 }, level: 30, color: "#566573", radius: 18, speed: 80, ability: { type: "shield", chance: 0.15, desc: "درع رملي" } },
  },
  plains_boss: {
    bandit: { id: "bandit", name: "تابع غاز", icon: "🗡️", hp: 500, damage: 50, reward: { cash: 200, gold: 40 }, level: 40, color: "#4a235a", radius: 14, speed: 100, ability: { type: "dodge", chance: 0.15, desc: "تفادي" } },
    war_sorcerer: { id: "war_sorcerer", name: "ساحر حرب", icon: "🧙", hp: 800, damage: 70, reward: { cash: 350, gold: 80 }, level: 45, color: "#6c3483", radius: 14, speed: 80, ability: { type: "aoe", chance: 0.1, desc: "عاصفة رملية", aoeDamage: 30 } },
  },
  final_boss: {
    royal_rebel: { id: "royal_rebel", name: "متمرد ملكي", icon: "⚔️", hp: 2000, damage: 100, reward: { cash: 800, gold: 100 }, level: 60, color: "#922b21", radius: 16, speed: 90, ability: { type: "charge", chance: 0.12, desc: "هجوم صحراوي سريع", chargeMultiplier: 1.8 } },
    desert_guardian: { id: "desert_guardian", name: "حارس الصحراء", icon: "🗿", hp: 3500, damage: 150, reward: { cash: 1500, gold: 200 }, level: 70, color: "#c4a35a", radius: 18, speed: 75, ability: { type: "heal", chance: 0.1, desc: "يشفي من رمال الصحراء", healPercent: 0.2 } },
    sand_devil: { id: "sand_devil", name: "شيطان الرمال", icon: "🌪️", hp: 5000, damage: 200, reward: { cash: 2500, gold: 350 }, level: 80, color: "#d4a017", radius: 20, speed: 90, ability: { type: "shield", chance: 0.15, desc: "درع رملي" } },
  },
};

function triggerBossSpecial(world, monster, special, bossId) {
  const fx = world.worldFx || [];

  switch (special) {
    case "sandstorm_wave": {
      world._sandstormActive = true;
      world._sandstormTimer = 4;
      fx.push({ x: monster.x, y: monster.y, text: "🌪️ عاصفة رملية عاتية!", color: "#f39c12", life: 2, maxLife: 2 });
      if (world.engine) world.engine.shake(12, 0.6);
      break;
    }
    case "summon_shield": {
      monster._shieldTimer = 5;
      fx.push({ x: monster.x, y: monster.y, text: "🛡️ درع رملي سحري!", color: "#d4a017", life: 2, maxLife: 2 });
      break;
    }
    case "desert_fire_aoe": {
      const dmg = Math.floor(monster.damage * 3);
      fx.push({ x: monster.x, y: monster.y, text: `🔥🔥 لهيب الصحراء ${dmg}!`, color: "#e74c3c", life: 2, maxLife: 2 });
      world._aoeDamageAll(dmg, monster);
      if (world.engine) world.engine.shake(14, 0.6);
      addTelegraph(world, monster.x - 100, monster.y, 200, 60, "#ff440088");
      break;
    }
    case "sand_quake": {
      for (let i = 0; i < 5; i++) {
        const mx = monster.x + (Math.random() - 0.5) * 300;
        const my = monster.y + (Math.random() - 0.5) * 300;
        addTelegraph(world, mx - 20, my - 20, 40, 40, "#c4a35a66");
      }
      fx.push({ x: monster.x, y: monster.y, text: "🏜️ زلزال رملي!", color: "#c4a35a", life: 2, maxLife: 2 });
      const quakeDmg = Math.floor(monster.damage * 2);
      if (world.leader) world.damageHero(quakeDmg);
      if (world.engine) world.engine.shake(16, 0.5);
      break;
    }
    case "sand_barrage": {
      const barrageDmg = Math.floor(monster.damage * 1.5);
      for (let i = 0; i < 3; i++) {
        setTimeout(() => {
          if (!monster.alive) return;
          world._aoeDamageAll(barrageDmg, monster);
          fx.push({ x: monster.x + (Math.random() - 0.5) * 100, y: monster.y + (Math.random() - 0.5) * 100, text: `🌪️ ${barrageDmg}!`, color: "#d4a017", life: 1, maxLife: 1 });
        }, i * 400);
      }
      fx.push({ x: monster.x, y: monster.y, text: "💫 زخات رملية!", color: "#d4a017", life: 2, maxLife: 2 });
      break;
    }
    case "swoop_barrage": {
      const swoopDmg = Math.floor(monster.damage * 2.5);
      fx.push({ x: monster.x, y: monster.y, text: `🦅🦅 انقضاض الصقر ${swoopDmg}!`, color: "#ff6b6b", life: 2, maxLife: 2 });
      if (world.leader) {
        for (let i = 0; i < 3; i++) {
          setTimeout(() => {
            if (!monster.alive) return;
            world.damageHero(Math.floor(swoopDmg * 0.5));
          }, i * 300);
        }
      }
      if (world.engine) world.engine.shake(10, 0.8);
      break;
    }
    case "sand_curse": {
      world._sandstormActive = true;
      world._sandstormTimer = 5;
      const curseDmg = Math.floor(monster.damage * 1.5);
      if (world.leader) {
        world.damageHero(curseDmg);
        for (let i = 0; i < 3; i++) {
          const x = world.leader.x + (Math.random() - 0.5) * 200;
          const y = world.leader.y + (Math.random() - 0.5) * 200;
          fx.push({ x, y, text: "🏜️ لعنة الصحراء!", color: "#c4a35a", life: 1.5, maxLife: 1.5 });
        }
      }
      if (world.engine) world.engine.shake(14, 0.7);
      break;
    }
    case "desert_wrath": {
      const wrathDmg = Math.floor(monster.damage * 2);
      fx.push({ x: monster.x, y: monster.y, text: `⚡⚡ غضب الصحراء ⚡⚡`, color: "#ffd700", life: 3, maxLife: 3 });
      world._aoeDamageAll(wrathDmg, monster);
      if (world.leader) world.damageHero(Math.floor(wrathDmg * 0.5));
      if (world.engine) world.engine.shake(20, 1);
      addTelegraph(world, monster.x - 150, monster.y - 150, 300, 300, "#d4a01766");
      break;
    }
  }
}

function addTelegraph(world, x, y, w, h, color) {
  if (!world._telegraphs) world._telegraphs = [];
  world._telegraphs.push({ x, y, w, h, color, life: 1.2, maxLife: 1.2 });
}

export function updateBossEnrage(world, monster, bossConfig, dt) {
  if (!monster.isBoss || !bossConfig || !monster.alive) return;
  if (monster._enrageTimer === undefined) monster._enrageTimer = bossConfig.enrageTimer || 120;
  monster._enrageTimer -= dt;
  if (monster._enrageTimer <= 0 && !monster._enraged) {
    monster._enraged = true;
    monster.damage = Math.floor(monster.damage * 3);
    monster.speed = (monster.speed || 80) * 1.5;
    const fx = world.worldFx || [];
    fx.push({ x: monster.x, y: monster.y, text: "⏰🔥 جنون الصحراء! ضرر ×3!", color: "#ff0000", life: 3, maxLife: 3 });
    if (world.engine) world.engine.shake(18, 1);
  }
}

export function getEpicBossLoot(bossId, world) {
  const config = getBossPhaseConfig(bossId);
  if (!config) return { cash: 0, gold: 0, gems: 0, scrolls: 0, artifacts: 0, desertGem: 0, cashBonus: 0 };
  const table = config.lootTable;
  const result = { cash: 0, gold: 0, gems: 0, scrolls: 0, artifacts: 0, desertGem: 0, cashBonus: 0 };
  if (table.cash) result.cash = Math.floor(table.cash[0] + Math.random() * (table.cash[1] - table.cash[0]));
  if (table.gold) result.gold = Math.floor(table.gold[0] + Math.random() * (table.gold[1] - table.gold[0]));
  if (table.gems) result.gems = Math.floor(table.gems[0] + Math.random() * (table.gems[1] - table.gems[0]));
  if (table.scrolls) result.scrolls = Math.floor(table.scrolls[0] + Math.random() * (table.scrolls[1] - table.scrolls[0]));
  result.artifacts = table.artifacts || 0;
  result.desertGem = table.desertGem || 0;
  result.cashBonus = result.cash;
  return result;
}

export { PHASE_MINIONS };
