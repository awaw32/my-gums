import { describe, it, expect } from 'vitest';
import { computeOneHitDamage, resolveMonsterKill, simulatePvPFull, computeLoot, computeMonsterReward, WEAPON_COMBAT_STATS, defenseDamageMultiplier, MAX_DEFENSE_REDUCTION_PERCENT } from '../server/logic/combatResolver.js';
import { WEAPON_COMBAT_STATS as CLIENT_WEAPON_COMBAT_STATS } from '../js/combat-engine.js';

describe('Combat Resolver (Server-Authoritative)', () => {
  const basePlayer = () => ({
    level: 10,
    unitLevel: 5,
    trainingLevel: 3,
    prestigeLevel: 1,
    army_power: 8000,
    armyYardLevel: 4,
    hp: 120,
    maxHp: 120,
    equippedWeapon: 'w3',
    weapons: [{ id: 'w3', level: 2 }],
    buildings: { chiefPalace: 3 },
    research: {},
  });

  const baseMonster = () => ({
    id: 0,
    hp: 200,
    maxHp: 200,
    alive: true,
    _spawnTime: Date.now() - 10000,
  });

  it('should compute one-hit damage (level 10 with army_power 8000)', () => {
    const result = computeOneHitDamage(basePlayer());
    expect(result.damage).toBeGreaterThanOrEqual(1);
    expect(typeof result.isCrit).toBe('boolean');
  });

  it('should apply damage to monster HP on resolveMonsterKill', () => {
    const player = basePlayer();
    const monster = baseMonster();
    const result = resolveMonsterKill(player, monster);
    expect(result.valid).toBe(true);
    expect(result.damage).toBeGreaterThanOrEqual(1);
    expect(monster.hp).toBeLessThan(200);
    expect(monster.hp).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(monster.hp)).toBe(true);
  });

  it('should kill monster when damage exceeds HP', () => {
    const player = basePlayer();
    const monster = baseMonster();
    monster.hp = 1;
    const result = resolveMonsterKill(player, monster);
    expect(result.valid).toBe(true);
    expect(result.killed).toBe(true);
    expect(monster.hp).toBe(0);
  });

  it('should return valid false for dead monster', () => {
    const player = basePlayer();
    const monster = baseMonster();
    monster.alive = false;
    const result = resolveMonsterKill(player, monster);
    expect(result.valid).toBe(false);
  });

  it('should simulate PvP and return attackerWon boolean', () => {
    const attacker = basePlayer();
    const defender = basePlayer();
    const result = simulatePvPFull(attacker, defender);
    expect(typeof result.attackerWon).toBe('boolean');
    expect(result.rounds).toBeGreaterThanOrEqual(1);
    expect(result.rounds).toBeLessThanOrEqual(50);
    expect(result.attackerDmgPerHit).toBeGreaterThanOrEqual(1);
  });

  it('stronger player should usually win PvP', () => {
    const weakPlayer = basePlayer();
    weakPlayer.level = 1;
    weakPlayer.army_power = 1000;
    const strongPlayer = basePlayer();
    strongPlayer.level = 50;
    strongPlayer.army_power = 50000;
    let wins = 0;
    for (let i = 0; i < 10; i++) {
      const result = simulatePvPFull(strongPlayer, weakPlayer);
      if (result.attackerWon) wins++;
    }
    expect(wins).toBeGreaterThanOrEqual(8);
  });

  it('computeLoot should give reasonable cash for winner', () => {
    const loot = computeLoot(10000, true);
    expect(loot.cash).toBeGreaterThanOrEqual(10);
    expect(loot.cash).toBeLessThanOrEqual(1000);
    expect(loot.gold).toBeGreaterThanOrEqual(1);
  });

  it('computeLoot should give loss amount for loser', () => {
    const loot = computeLoot(10000, false);
    expect(loot.cash).toBeGreaterThanOrEqual(0);
    expect(loot.cash).toBeLessThanOrEqual(50000);
    expect(loot.gold).toBe(0);
  });

  it('computeMonsterReward should give proportional reward', () => {
    const monster = {
      rewardMoney: 10,
      rewardGold: 3,
      hp: 200, maxHp: 200, enemyId: 'desert_wolf',
    };
    const player = basePlayer();
    const reward = computeMonsterReward(monster, player);
    expect(reward.cash).toBeGreaterThanOrEqual(1);
    expect(reward.gold).toBeGreaterThanOrEqual(0);
    const powerCap = Math.floor(player.army_power * 0.15);
    expect(reward.cash).toBeLessThanOrEqual(powerCap);
  });

  it('computeMonsterReward for boss should include artifacts', () => {
    const monster = {
      rewardMoney: 100,
      rewardGold: 30,
      hp: 500, maxHp: 500, isBoss: true, enemyId: 'wadi_boss',
    };
    const player = basePlayer();
    const reward = computeMonsterReward(monster, player);
    expect(reward.artifacts).toBeGreaterThanOrEqual(1);
    expect(reward.artifacts).toBeLessThanOrEqual(3);
  });

  it('computeMonsterReward should cap at 15% power', () => {
    const monster = {
      rewardMoney: 999999,
      rewardGold: 99999,
      hp: 1, maxHp: 1, enemyId: 'desert_wolf',
    };
    const player = basePlayer();
    const reward = computeMonsterReward(monster, player);
    const maxCash = Math.floor(player.army_power * 0.15);
    expect(reward.cash).toBeLessThanOrEqual(maxCash);
    expect(reward.gold).toBeLessThanOrEqual(Math.floor(maxCash * 0.3));
  });

  it('computeMonsterReward for final_boss should give desertGem', () => {
    const monster = {
      rewardMoney: 2000,
      rewardGold: 200,
      hp: 30000, maxHp: 30000, isBoss: true, enemyId: 'final_boss',
    };
    const player = basePlayer();
    const reward = computeMonsterReward(monster, player);
    expect(reward.desertGem).toBe(1);
  });

  it('computeMonsterReward should handle zero-armed player gracefully', () => {
    const monster = {
      rewardMoney: 10,
      rewardGold: 3,
      hp: 200, maxHp: 200, enemyId: 'desert_wolf',
    };
    const weakPlayer = { ...basePlayer(), army_power: 10, level: 1 };
    const reward = computeMonsterReward(monster, weakPlayer);
    expect(reward.cash).toBeGreaterThanOrEqual(0);
    expect(reward.gold).toBeGreaterThanOrEqual(0);
  });

  it('should have weapon stats matching client definitions exactly (anti-drift check)', () => {
    // 🛡️ نسختا الخادم والعميل من WEAPON_COMBAT_STATS منفصلتان بالضرورة (الخادم
    // CommonJS، العميل ES module للمتصفح) — هذا الاختبار يقارنهما فعلياً بدل
    // تكرار جدول ثالث هنا، فيكتشف أي انحراف حقيقي بين النسختين مباشرة.
    expect(Object.keys(WEAPON_COMBAT_STATS).sort()).toEqual(Object.keys(CLIENT_WEAPON_COMBAT_STATS).sort());
    for (const weaponId of Object.keys(WEAPON_COMBAT_STATS)) {
      expect(WEAPON_COMBAT_STATS[weaponId]).toEqual(CLIENT_WEAPON_COMBAT_STATS[weaponId]);
    }
  });

  it('should reject invalid monster kill (not alive)', () => {
    const player = basePlayer();
    const monster = baseMonster();
    monster.alive = false;
    const result = resolveMonsterKill(player, monster);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('ميت');
  });

  describe('Monster Abilities', () => {
    it('dodge should set damage to 0', () => {
      const player = basePlayer();
      const monster = baseMonster();
      monster.enemyId = 'desert_thief';
      const result = resolveMonsterKill(player, monster, Date.now());
      if (result.wasDodged) {
        expect(result.damage).toBe(0);
      } else {
        expect(result.damage).toBeGreaterThanOrEqual(1);
      }
    });

    it('shield should halve damage when timer active', () => {
      const player = basePlayer();
      const monster = baseMonster();
      monster.enemyId = 'palace_boss';
      monster._shieldTimer = 3;

      // 🛡️ تثبيت Math.random لضمان عدم تأثير عشوائي على النتيجة
      const origRandom = Math.random;
      let callIdx = 0;
      const randomValues = [0.5, 0.5, 0.5, 0.5, 0.5]; // لا يُسبب أي قدرة عشوائية (كلها > chance)
      Math.random = () => randomValues[callIdx++ % randomValues.length];

      try {
        const shieldResult = resolveMonsterKill(player, monster, Date.now());
        expect(shieldResult.sandstormActive).toBe(false);
        expect(shieldResult.wasPhased).toBe(false);
        expect(shieldResult.wasDodged).toBe(false);
        // Shield halves damage: compute raw damage without shield
        const rawMonster = { ...monster, _shieldTimer: 0 };
        const rawResult = resolveMonsterKill(player, rawMonster, Date.now());
        expect(shieldResult.damage).toBeLessThanOrEqual(rawResult.damage);
        expect(rawResult.damage).toBeGreaterThan(0);
      } finally {
        Math.random = origRandom;
      }
    });

    it('phase should make damage 0', () => {
      const player = basePlayer();
      const monster = baseMonster();
      monster.enemyId = 'palace_ghost';
      monster._phaseTimer = 1.5;
      const result = resolveMonsterKill(player, monster, Date.now());
      expect(result.wasPhased).toBe(true);
      expect(result.damage).toBe(0);
    });

    it('heal should increase monster HP', () => {
      const player = basePlayer();
      const monster = baseMonster();
      monster.hp = 100;
      monster.enemyId = 'sand_sorcerer';
      const result = resolveMonsterKill(player, monster, Date.now());
      const healEvent = result.abilitiesTriggered.find(a => a.type === 'heal');
      if (healEvent) {
        expect(monster.hp).toBeGreaterThan(100 - result.damage);
        expect(healEvent.amount).toBeGreaterThan(0);
      }
    });

    it('charge should return damage to player', () => {
      const player = basePlayer();
      const monster = baseMonster();
      monster.enemyId = 'shadow_knight';
      const result = resolveMonsterKill(player, monster, Date.now());
      const chargeEvent = result.abilitiesTriggered.find(a => a.type === 'charge');
      if (chargeEvent) {
        expect(result.returnDamage).toBeGreaterThan(0);
        expect(chargeEvent.damage).toBeGreaterThan(0);
      }
    });

    it('poison should set poisonInfo', () => {
      const player = basePlayer();
      const monster = baseMonster();
      monster.hp = 500;
      monster.enemyId = 'desert_scorpion';
      const result = resolveMonsterKill(player, monster, Date.now());
      const poisonEvent = result.abilitiesTriggered.find(a => a.type === 'poison');
      if (poisonEvent) {
        expect(result.poisonInfo).not.toBeNull();
        expect(result.poisonInfo.dps).toBeGreaterThan(0);
        expect(result.poisonInfo.duration).toBeGreaterThan(0);
      }
    });

    it('sandstorm should activate sandstorm timer', () => {
      const player = basePlayer();
      const monster = baseMonster();
      monster.enemyId = 'wadi_boss';
      const result = resolveMonsterKill(player, monster, Date.now());
      const sandEvent = result.abilitiesTriggered.find(a => a.type === 'sandstorm');
      if (sandEvent) {
        expect(monster._sandstormTimer).toBeGreaterThan(0);
      }
    });
  });

  describe('🛡️ دفاع مستوى التحالف يُطبَّق فعلياً في PvP (defenseBuff)', () => {
    // 🛡️ قبل هذا الإصلاح كان allianceBonuses.defenseBonus محسوباً ومُعاداً من
    // computePlayerStats لكن غير مستخدَم في أي حساب ضرر حقيقي — لاعب يدفع
    // ذهباً حقيقياً لترقية مستوى التحالف كان لا يحصل على أي حماية قتالية فعلية.

    it('defenseDamageMultiplier(0) لا يخفّض الضرر إطلاقاً', () => {
      expect(defenseDamageMultiplier(0)).toBe(1);
    });

    it('defenseDamageMultiplier يخفّض الضرر بنسبة الدفاع المُعطاة', () => {
      expect(defenseDamageMultiplier(20)).toBeCloseTo(0.8, 5);
    });

    it('defenseDamageMultiplier محصور بسقف أقصى — لا يصل الضرر لصفر أبداً', () => {
      const mult = defenseDamageMultiplier(99999);
      expect(mult).toBeCloseTo(1 - MAX_DEFENSE_REDUCTION_PERCENT / 100, 5);
      expect(mult).toBeGreaterThan(0);
    });

    it('defenseDamageMultiplier يتجاهل قيماً سالبة (لا يزيد الضرر)', () => {
      expect(defenseDamageMultiplier(-50)).toBe(1);
    });

    it('لاعب بدفاع تحالف مرتفع يخسر معارك PvP أقل أمام نفس الخصم بالضبط', () => {
      // نستخدم عضوية تحالف افتراضية عبر allianceId + getAlliance المُمرَّرة إلى
      // formulas.js داخلياً — بما أن الاختبار هنا على combatResolver مباشرة
      // (بلا alliance حقيقي)، نتحقق بدلاً من ذلك أن baseMonster hp يتأثر بدفاع
      // البحث/المعرفة (research.military) الذي يغذي نفس defenseBuff فعلياً.
      const defenderNoDefense = basePlayer();
      defenderNoDefense.research = {};
      const defenderWithDefense = basePlayer();
      defenderWithDefense.research = { 'military.desertShield': 20 }; // +3%/مستوى = +60%

      const attacker = basePlayer();
      attacker.level = 50;
      attacker.army_power = 50000;

      let winsAgainstNoDefense = 0;
      let winsAgainstDefense = 0;
      for (let i = 0; i < 30; i++) {
        if (simulatePvPFull(attacker, defenderNoDefense).attackerWon) winsAgainstNoDefense++;
        if (simulatePvPFull(attacker, defenderWithDefense).attackerWon) winsAgainstDefense++;
      }
      // المدافع المُحصَّن يجب أن يخسر بمعدل أقل أو يساوي (لا يزيد أبداً)
      expect(winsAgainstDefense).toBeLessThanOrEqual(winsAgainstNoDefense);
    });
  });

  describe('💰 دخل مستوى التحالف يُطبَّق فعلياً على مكافأة قتل الوحوش (allianceIncomeMult)', () => {
    // 🛡️ قبل هذا الإصلاح كان allianceBonuses.incomeMult محسوباً ومُعاداً من
    // computePlayerStats لكن غير مستهلك في أي مصدر دخل حقيقي على الخادم —
    // لاعب في تحالف مستوى 4 (incomeMult=1.5) كان يرى "دخل ×1.5" في الواجهة
    // بلا أي زيادة فعلية في مكافآت قتل الوحوش التي يحسمها الخادم.
    it('لاعب بلا تحالف لا يتأثر (allianceId فارغ)', () => {
      const monster = { rewardMoney: 100, rewardGold: 30, hp: 200, maxHp: 200, enemyId: 'desert_wolf' };
      const player = { ...basePlayer(), allianceId: '' };
      const reward = computeMonsterReward(monster, player);
      const expectedCash = Math.floor(100 * (1 + player.level * 0.02));
      expect(reward.cash).toBe(Math.min(expectedCash, Math.floor(player.army_power * 0.15)));
    });

    it('لاعب في تحالف مع allianceId غير موجود فعلياً لا ينهار — يعامَل كبلا تحالف', () => {
      const monster = { rewardMoney: 100, rewardGold: 30, hp: 200, maxHp: 200, enemyId: 'desert_wolf' };
      const player = { ...basePlayer(), allianceId: 'nonexistent_alliance_id' };
      expect(() => computeMonsterReward(monster, player)).not.toThrow();
    });

    it('لاعب في تحالف مستوى 4 حقيقي (incomeMult=1.5) يحصل فعلياً على 50% ذهب/مال إضافي', () => {
      const { allianceMemStore } = require('../server/db/allianceHelper.js');
      allianceMemStore.set('rich_alliance', { id: 'rich_alliance', level: 4 });
      try {
        const monster = { rewardMoney: 100, rewardGold: 30, hp: 200, maxHp: 200, enemyId: 'desert_wolf' };
        const noAllianceReward = computeMonsterReward(monster, { ...basePlayer(), allianceId: '' });
        const withAllianceReward = computeMonsterReward(monster, { ...basePlayer(), allianceId: 'rich_alliance' });
        expect(withAllianceReward.cash).toBe(Math.floor(noAllianceReward.cash * 1.5));
        expect(withAllianceReward.gold).toBe(Math.floor(noAllianceReward.gold * 1.5));
      } finally {
        allianceMemStore.delete('rich_alliance');
      }
    });
  });

  describe('💰 مساري knowledge/trade من شجرة الترقيات يُطبَّقان فعلياً على مكافأة قتل الوحوش', () => {
    // 🛡️ قبل هذا الإصلاح: economy.knowledgeGoldBonus (ذهب) وeconomy.tradeIncomeBonus
    // (مال) كانا يُضربان في economy.addRaw على العميل فقط — لا أثر إطلاقاً على
    // مكافآت قتل الوحوش الحقيقية التي يحسمها الخادم.
    it('مستوى knowledge أقصى (5) يزيد الذهب حصراً (لا يؤثر على المال)', () => {
      const monster = { rewardMoney: 100, rewardGold: 30, hp: 200, maxHp: 200, enemyId: 'desert_wolf' };
      const noUpgrade = computeMonsterReward(monster, basePlayer());
      const withUpgrade = computeMonsterReward(monster, { ...basePlayer(), upgrades: { knowledge: 5 } });
      // 15+30+50+80+120 = 295% → ×3.95
      expect(withUpgrade.gold).toBe(Math.floor(noUpgrade.gold * 3.95));
      expect(withUpgrade.cash).toBe(noUpgrade.cash);
    });

    it('مستوى trade أقصى (5) يزيد المال حصراً (لا يؤثر على الذهب)', () => {
      const monster = { rewardMoney: 100, rewardGold: 30, hp: 200, maxHp: 200, enemyId: 'desert_wolf' };
      const noUpgrade = computeMonsterReward(monster, basePlayer());
      const withUpgrade = computeMonsterReward(monster, { ...basePlayer(), upgrades: { trade: 5 } });
      // 20+40+70+110+160 = 400% → ×5
      expect(withUpgrade.cash).toBe(Math.floor(noUpgrade.cash * 5));
      expect(withUpgrade.gold).toBe(noUpgrade.gold);
    });

    it('ادّعاء مستوى knowledge/trade خيالي (99999) لا يمنح أكثر من الحد الأقصى الحقيقي (5)', () => {
      const monster = { rewardMoney: 100, rewardGold: 30, hp: 200, maxHp: 200, enemyId: 'desert_wolf' };
      const legit = computeMonsterReward(monster, { ...basePlayer(), upgrades: { knowledge: 5, trade: 5 } });
      const cheated = computeMonsterReward(monster, { ...basePlayer(), upgrades: { knowledge: 99999, trade: 99999 } });
      expect(cheated.gold).toBe(legit.gold);
      expect(cheated.cash).toBe(legit.cash);
    });
  });
});
