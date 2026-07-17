import { GameEngine } from "./engine.js";
import {
  aStar,
  initCollisionGrid,
  markObstacle,
  simplifyPath
} from "./pathfinding.js";
import { spawnHitEffect, spawnMonsterDeathEffect, spawnComboEffect } from "./combat/combat-effects.js";
import { showPvPDefeat } from "./ui/context-menu.js";
import { computeWeaponDamage, computePlayerMaxHp, computePlayerDamage, applyRageMultiplier, computePvPDamage, rollCrit } from "./combat-engine.js";
import { WeaponAbilityManager } from "./combat/weapon-abilities.js";
import { computeKnowledgeBonuses } from "./economy.js";
import { getVisualTroopCount, getTroopFormation } from "./combat/troop-visuals.js";
import { drawWeaponGlow, drawWeaponStarIcons, drawWeaponOnHero } from "./combat/weapon-visuals.js";
import { spriteFactory } from "./sprite-factory.js";
import { IsometricSystem, DepthSorter } from "./isometric.js";
import { SOLDIER_ROLES } from "./army.js";
import { getBossPhaseConfig, triggerBossPhase } from "./combat/epic-bosses.js";
import { injectPartyMethods } from "./world-party.js";
import { injectModesMethods } from "./world-modes.js";
import { injectMonstersMethods } from "./world-monsters.js";
import { injectLootMethods } from "./world-loot.js";
import { injectBRMethods } from "./world-br.js";
import { injectRenderMethods } from "./world-render.js";
import { injectFxMethods } from "./world-fx.js";
import { injectInteractionMethods } from "./world-interaction.js";
import { injectPvPMenuMethods } from "./world-pvp-menu.js";
import { injectWipeHudMethods } from "./world-wipe-hud.js";
import { injectEntitiesMethods } from "./world-entities.js";
import { injectUpdateMethods } from "./world-update.js";
import { injectPvPCombatMethods } from "./world-pvp-combat.js";

export class WorldMap {
  constructor(economy, username = "بطل الصحراء", apiBase = "", army = null) {
    this.username = username;
    this.economy = economy;
    this.apiBase = apiBase;
    this.army = army;
    this.W = 2400;
    this.H = 2400;
    this.engine = null;
    this.running = false;
    this.settings = {};

    // ==================== الملتيكاملة (WebSocket عبر NetworkSync) ====================
    this.netSync = null; // يُضبط من main.js بعد الإنشاء
    this.partyCode = null;
    this.store = null; // يُضبط من main.js
    this.otherPlayers = new Map();
    this.nearbyPlayer = null;
    this.combatCooldown = 0;
    this.engagementRadius = 80;
    this.onExit = null;
    this.sessionStats = { kills: 0, coinsEarned: 0, pvpWins: 0, upgradesToday: 0 };
    this._monstersSynced = false;
    this._pvpTarget = null;
    this._pvpAttackTarget = null;
    this._isPvPEngaged = false;
    this._pvpDamageCD = 0;
    this._pvpDamageInterval = 0.8;
    this._pvpResultSent = false;
    this._pvpFledTarget = null;
    this._pvpEscapeCheckTimer = 0;
    this._pvpDisabled = false;
    this._moveTargetX = null;
    this._moveTargetY = null;
    this._pvpParticles = [];
    this._pvpDefeatShown = false;
    this._pvpProtectionTimer = 0; // حماية بعد الموت بالثواني
    this._equippedWeapon = "";
    this._weaponStarLevel = 0;
    this._weaponGemLevel = 0;
    this._glowTime = 0;
    this._wipeFlag = false;
    this._allianceManager = null;
    this._upgradeTree = null;
    this._lastChallengeDate = null;
    this.images = new Map();
    this._preloadImages();

    // ── 2.5D Isometric + Sprite Factory ──
    this._iso = new IsometricSystem(this.W, this.H);
    this._depthSorter = new DepthSorter();
    this._spriteFrame = 0;
    this._spriteFrameTimer = 0;
    this._spriteFrameInterval = 0.15;
    this._isometricEnabled = true;

    // === القائد (الشيخ) ===
    this.leader = {
      x: this.W / 2,
      y: this.H / 2,
      speed: 140,
      path: null,
      pathIdx: 0,
      radius: 18,
      hp: 120,
      maxHp: 120,
      attackRange: 30,
      attackCD: 0,
      attackInterval: 0.8,
      baseDmg: 12,
      upgradeDmg: 0,
      upgradeDef: 0,
      fighting: null,
      isLeader: true,
      _posHistory: [],
      _maxHist: 50
    };

    this.armyUnits = [];
    this.monsters = [];
    this.drops = [];
    this.baseCamp = { x: this.W / 2, y: this.H / 2 + 200 };
    this.projectiles = [];
    this.spawnPoints = [];
    this.lastSpawn = 0;
    this.spawnInterval = 10;
    this.cameraMode = "follow";
    this.mapImage = null;
    this.safeZone = { x: this.W / 2 - 120, y: this.H / 2 - 120, w: 240, h: 240 };
    this.worldFx = [];
    this.sandParticles = this._initSandParticles(60);
    this._newbieShieldTimer = 120; // 2 دقيقة حماية للمبتدئين
    this._combatLog = [];

    // ==================== Battle Royale Mode ====================
    this.mode = "campaign";          // "campaign" | "battle_royale"
    this.matchStarted = false;
    this.matchEnded = false;
    this.matchTimer = 0;
    this.matchDuration = 600;        // 10 min default
    this.isAdmin = false;
    this.roomCode = "";
    this.brKills = 0;
    this.brAlivePlayers = [];
    this.bandits = [];
    this.killFeed = [];
    this.brMapSize = 2000;
    this.zone = {
      x: this.brMapSize / 2,
      y: this.brMapSize / 2,
      radius: this.brMapSize * 0.45,
      minRadius: 100,
      nextShrink: 30,
    };
    // ── Combat upgrades: Crit, Combo, Poison ──
    this._comboCount = 0;
    this._comboTimer = 0;
    this._comboThreshold = 3;
    this._poisonEffects = [];
    this._monsterAbilityTimers = {};
    this._sandstormActive = false;
    this._sandstormTimer = 0;
    this._stompSlowTimer = 0;
    this._telegraphs = [];

    // ── Weapon Abilities System ──
    this._weaponAbilities = new WeaponAbilityManager();

    this._onBRKillFeed = null;
    this._onCashEarned = null;
    this._events = null; // مرجع لـ EventManager
    this._onPvPWin = null;
    this._onPvPLose = null;
    this._onPvPReturn = null;
    this._onDropCollected = null;
    this._onTreasureOpened = null;
    this._onSelfStatsChanged = null;
    this.treasureChests = [];
    this._activeMode = null;
    this._invulnerableTimer = 0;
  }

  _sendWS(data) {
    if (this.netSync) this.netSync.send(data);
  }

  _preloadImages() {
    if (typeof window === "undefined" || typeof Image === "undefined") return;
    const v = window._buildId || Date.now();
    const keys = [
      "leader-player", "avatar-player", "soldier-player",
      "leader-enemy", "soldier-enemy", "bandit-br",
      "monster-1", "monster-2", "monster-3",
      "warrior-scimitar", "healer-oasis", "archer-desert", "camel-rider",
      "scorpion-elite", "sand-dragon", "giant-sand", "mystic-mage", "thief-assassin",
    ];
    for (const key of keys) {
      const img = new Image();
      img.onload = () => this.images.set(key, img);
      img.onerror = () => {};
      const base = typeof ImageResolver !== 'undefined' ? ImageResolver.src(key) : ("assets/images/" + key + ".png");
      img.src = base + '?v=' + v;
    }
  }

  _drawSprite(ctx, key, fallbackColor, radius) {
    const img = this.images.get(key);
    if (img) {
      ctx.drawImage(img, -radius, -radius, radius * 2, radius * 2);
    } else {
      ctx.fillStyle = fallbackColor;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _initSandParticles(count) {
    const pts = [];
    for (let i = 0; i < count; i++) {
      pts.push({
        x: Math.random() * this.W,
        y: Math.random() * this.H,
        vx: (Math.random() - 0.5) * 30,
        vy: (Math.random() - 0.5) * 30,
        r: 1 + Math.random() * 2,
        alpha: 0.1 + Math.random() * 0.3,
      });
    }
    return pts;
  }

  // ==================== WebSocket — ملتيكاملة فورية (عبر NetworkSync) ====================
  startMultiplayerSync() {
    if (this.netSync) this.netSync.start();
  }

  stopMultiplayerSync() {
    if (this.netSync) this.netSync.stop();
  }

  // حركة سلسة للوحوش (تُستدعى من updateMonstersAI)
  _lerpMonsterPositions(dt) {
    for (const m of this.monsters) {
      if (!m._targetX) continue;
      if (m.alive) {
        m.x += (m._targetX - m.x) * Math.min(1, dt * 8);
        m.y += (m._targetY - m.y) * Math.min(1, dt * 8);
      }
    }
  }

  findOtherPlayerAt(wx, wy) {
    let closest = null;
    let minDist = 60;
    for (const [, p] of this.otherPlayers) {
      const d = Math.hypot(p.x - wx, p.y - wy);
      if (d < minDist) {
        minDist = d;
        closest = p;
      }
    }
    return closest;
  }

  resolvePvP(target, iWon) {
    const tgt = target || this._pvpAttackTarget;
    if (!tgt) return;

    const won = iWon !== undefined ? iWon : false;
    const myPower = this.economy ? this.economy.power : 5000;
    const theirPower = tgt.army_power || 5000;
    const myMaxHp = this.leader.maxHp || 120;
    const myCurHp = Math.max(0, this.leader.hp);

    const myEffective = Math.floor(myPower * Math.max(0, myCurHp / myMaxHp));

    const enemyStats = this.estimateEnemyStats(tgt);
    let cashLost = 0;
    let reward = 0;

    if (won) {
      reward = Math.max(10, Math.floor(theirPower * 0.05));
      let goldReward = Math.floor(reward * 0.2);
      if (this._events) {
        const pvpMult = this._events.getMult("mult_pvp");
        if (pvpMult > 1) { reward = Math.floor(reward * pvpMult); goldReward = Math.floor(goldReward * pvpMult); }
      }

      if (this.economy) {
        this.economy.addRaw("cash", reward);
        this.economy.addRaw("gold", goldReward);
      }

      this.worldFx.push({
        x: this.leader.x, y: this.leader.y,
        text: `⚔️ انتصرت على ${tgt.username}! +${reward} 💵 +${goldReward} 🪙`,
        color: "#4cd964", life: 2.5, maxLife: 2.5
      });
      if (this.store) {
        this.store.set('notification', {
          text: `⚔️ انتصرت على ${tgt.username}! +${reward} 💵`,
          t: Date.now()
        });
      }
      if (this._onPvPWin) this._onPvPWin();
      this.sessionStats.pvpWins++;
      if (this._ui && this._ui.logCombat) this._ui.logCombat('win', `⚔️ انتصرت على ${tgt.username} | +${reward} 💵 +${Math.floor(reward * 0.2)} 🪙`);
    } else {
      this.worldFx.push({
        x: this.leader.x, y: this.leader.y,
        text: `💥 هُزمت أمام ${tgt.username}!`,
        color: "#ff4444", life: 2.5, maxLife: 2.5
      });
      this.leader.hp = 0;

      // خسارة 5% من الرصيد الكلي — توازن: يخسر المهزوم من ماله الحقيقي
      const myCash = this.economy?.cash || 0;
      cashLost = Math.min(Math.max(10, Math.floor(myCash * 0.05)), myCash);
      if (cashLost > 0 && this.economy) {
        this.economy.addRaw("cash", -cashLost);
      }

      // خسارة 10% من القوة — نخفض الـ multiplier
      if (this.economy) {
        this.economy.multiplier = Math.max(0.1, (this.economy.multiplier || 1) * 0.9);
      }

      // حماية لمدة 30 ثانية بعد الموت — لا يمكن مهاجمتك
      this._pvpProtectionTimer = 30;

      this._pvpDefeatShown = true;
      this._showPvPDefeat(
        tgt.username,
        theirPower,
        cashLost,
        Math.floor(myPower * 0.1),
        enemyStats.maxHp,
        enemyStats.damage
      );
      if (this._onPvPLose) this._onPvPLose();
      if (this._ui && this._ui.logCombat) this._ui.logCombat('lose', `💥 هُزمت أمام ${tgt.username} | خسرت ${cashLost} 💵`);
    }

    // 🛡️ نتيجة السيرفر (simulatePvPFull) هي المرجع الرسمي — نخزّن ما طبّقناه محلياً
    // بشكل متفائل كي نستطيع مصالحته مع رد الخادم في pvp_result (network-sync.js)
    this._pendingPvPRecon = {
      opponent: tgt.username,
      cashApplied: won ? reward : -cashLost,
      powerMultApplied: won ? 1 : 0.9,
      ts: Date.now(),
    };

    this._sendWS({
      type: "resolve_pvp",
      target: tgt.username,
      myPower: myEffective,
    });

    const newArmyPower = this.economy ? Math.max(500, Math.floor((this.economy.power || 5000))) : 5000;
    try {
      const hdrs = { "Content-Type": "application/json" };
      const tok = localStorage.getItem("player_token");
      if (tok) hdrs["Authorization"] = `Bearer ${tok}`;
      fetch(`${this.apiBase}/api/players/${encodeURIComponent(this.username)}`, {
        method: "POST",
        headers: hdrs,
        body: JSON.stringify({
          cash: this.economy?.cash || 0,
          gems: this.economy?.gems || 0,
          gold: this.economy?.gold || 0,
          hammers: this.economy?.hammers || 0,
          scrolls: this.economy?.scrolls || 0,
          army_power: newArmyPower,
          unitLevel: this.army?.unitLevel || 1,
          weapons: this.army?.weapons?.map(w => ({ id: w.id, starLevel: w.starLevel || 1, gemLevel: w.gemLevel || 1 })) || [],
          buildings: this.economy?.buildings || {},
          research: this.economy?.research || {},
          last_active: Date.now()
        })
      });
    } catch (err) { console.warn("⚠️ [MP] فشل إرسال نتيجة الهجوم:", err.message); }

    this._pvpAttackTarget = null;
    this._isPvPEngaged = false;
    this._pvpDamageCD = 0;
    this._pvpResultSent = false;
    this._pvpParticles = [];
  }

  _showPvPDefeat(killerName, killerPower, lootTaken, powerLoss, enemyMaxHp, enemyDamage) {
    showPvPDefeat(this, killerName, killerPower, lootTaken, powerLoss, enemyMaxHp, enemyDamage);
  }

  computePvPStats() {
    const e = this.economy;
    const playerLevel = e?.level || 1;
    const unitLevel = this.army?.unitLevel || 1;
    const trainingLevel = this.army?.trainingLevel || 1;
    const prestigeLevel = e?.prestigeLevel || 0;
    const armyPower = e?.power || 5000;
    const armyYardLevel = e?.armyYardLevel || 1;

    const maxHp = computePlayerMaxHp({ playerLevel, unitLevel, trainingLevel, prestigeLevel, armyYardLevel });

    const weaponStats = computeWeaponDamage(this._equippedWeapon || "", this.army?.weapons || []);

    const { totalDamage } = computePlayerDamage({
      equippedWeapon: this._equippedWeapon || "",
      weapons: this.army?.weapons || [],
      playerLevel, unitLevel, prestigeLevel,
      armyPower,
      upgradeTree: this._upgradeTree,
      allianceManager: this._allianceManager,
    });

    const rageResult = applyRageMultiplier(totalDamage, this.leader?.hp, maxHp);

    const knowledgeBonuses = computeKnowledgeBonuses({
      knowledgeLevel: e?.knowledgeLevel || 1,
      knowledgeType: e?.knowledgeType || "economic",
    });

    return {
      maxHp,
      totalDamage: rageResult.damage,
      weaponStats,
      defenseBuffPercent: knowledgeBonuses.defensePercent,
      moveSpeedBuffPercent: knowledgeBonuses.moveSpeedPercent,
      rageActive: rageResult.rageActive,
    };
  }

  _getWeaponCritStats() {
    const result = computeWeaponDamage({
      equippedWeapon: this._equippedWeapon || "",
      weapons: this.army?.weapons || [],
    });
    return {
      critChance: result.critChance || 0,
      critMultiplier: result.critMultiplier || 1,
      weaponDamage: result.weaponDamage || 0,
    };
  }

  _rollCrit() {
    const stats = this._getWeaponCritStats();
    const crit = rollCrit(stats.critChance, stats.critMultiplier);
    return { ...crit, weaponDmg: stats.weaponDamage };
  }

  _applyMonsterAbility(monster, target) {
    if (!monster.ability || !monster.alive) return false;
    const ab = monster.ability;
    if (Math.random() >= ab.chance) return false;

    const abKey = `${monster.id}_${ab.type}`;
    const now = Date.now();
    if (this._monsterAbilityTimers[abKey] && now < this._monsterAbilityTimers[abKey]) return false;

    switch (ab.type) {
      case "heal": {
        const healAmt = Math.floor(monster.maxHp * (ab.healPercent || 0.3));
        monster.hp = Math.min(monster.maxHp, monster.hp + healAmt);
        this.worldFx.push({ x: monster.x, y: monster.y, text: `💚 +${healAmt}`, color: "#4cd964", life: 1, maxLife: 1 });
        this._monsterAbilityTimers[abKey] = now + 5000;
        return true;
      }
      case "shield": {
        monster._shieldTimer = 3;
        this.worldFx.push({ x: monster.x, y: monster.y, text: "🛡️ درع!", color: "#4a90d9", life: 1, maxLife: 1 });
        this._monsterAbilityTimers[abKey] = now + 6000;
        return true;
      }
      case "poison": {
        const dps = ab.poisonDps || 3;
        const dur = ab.poisonDuration || 3;
        this._poisonEffects.push({ target, dps, duration: dur, timer: dur, sourceId: monster.id });
        this.worldFx.push({ x: monster.x, y: monster.y, text: "☠️ سم!", color: "#a855f7", life: 1, maxLife: 1 });
        this._monsterAbilityTimers[abKey] = now + 4000;
        return true;
      }
      case "charge": {
        const mult = ab.chargeMultiplier || 2;
        const chargeDmg = Math.floor(monster.damage * mult);
        if (target === this.leader) {
          this.damageHero(chargeDmg);
        } else {
          target.hp = Math.max(0, target.hp - chargeDmg);
        }
        this.worldFx.push({ x: monster.x, y: monster.y, text: `💥 ${chargeDmg}!`, color: "#ff4444", life: 1, maxLife: 1 });
        if (this.engine) this.engine.shake(6, 0.15);
        this._monsterAbilityTimers[abKey] = now + 8000;
        return true;
      }
      case "sandstorm": {
        this._sandstormActive = true;
        this._sandstormTimer = 3;
        this.worldFx.push({ x: monster.x, y: monster.y, text: "🌪️ عاصفة!", color: "#f39c12", life: 1.5, maxLife: 1.5 });
        if (this.engine) this.engine.shake(8, 0.3);
        this._monsterAbilityTimers[abKey] = now + 8000;
        return true;
      }
      case "phase": {
        monster._phaseTimer = 1.5;
        this.worldFx.push({ x: monster.x, y: monster.y, text: "👻 اختفى!", color: "#8e44ad", life: 1, maxLife: 1 });
        this._monsterAbilityTimers[abKey] = now + 6000;
        return true;
      }
      case "fire_breath": {
        const fbMult = ab.chargeMultiplier || 3;
        const fbDmg = Math.floor(monster.damage * fbMult);
        this.worldFx.push({ x: monster.x, y: monster.y, text: `🔥 نفس النار ${fbDmg}!`, color: "#e74c3c", life: 1.5, maxLife: 1.5 });
        this._aoeDamageAll(fbDmg, monster);
        if (this.engine) this.engine.shake(10, 0.4);
        this._monsterAbilityTimers[abKey] = now + 10000;
        return true;
      }
      case "swoop": {
        const swMult = ab.chargeMultiplier || 3;
        const swDmg = Math.floor(monster.damage * swMult);
        if (this.leader) this.damageHero(swDmg);
        this.worldFx.push({ x: monster.x, y: monster.y, text: `🦅 انقضاض ${swDmg}!`, color: "#ff6b6b", life: 1, maxLife: 1 });
        if (this.engine) this.engine.shake(8, 0.25);
        this._monsterAbilityTimers[abKey] = now + 9000;
        return true;
      }
      case "stomp": {
        const stompDmg = Math.floor(monster.damage * 1.5);
        this._stompSlowTimer = 2;
        if (target === this.leader) {
          this.damageHero(stompDmg);
        } else if (target) {
          target.hp = Math.max(0, target.hp - stompDmg);
        }
        this.worldFx.push({ x: monster.x, y: monster.y, text: `🗿 دكة ${stompDmg}!`, color: "#c4a35a", life: 1, maxLife: 1 });
        if (this.engine) this.engine.shake(12, 0.35);
        this._monsterAbilityTimers[abKey] = now + 7000;
        return true;
      }
      case "aoe": {
        const aoeDmg = ab.aoeDamage || Math.floor(monster.damage * 0.8);
        this.worldFx.push({ x: monster.x, y: monster.y, text: `💫 هجوم شامل ${aoeDmg}!`, color: "#9b59b6", life: 1.2, maxLife: 1.2 });
        this._aoeDamageAll(aoeDmg, monster);
        if (this.engine) this.engine.shake(8, 0.2);
        this._monsterAbilityTimers[abKey] = now + 8000;
        return true;
      }
      default:
        return false;
    }
  }

  _aoeDamageAll(dmg, _source) {
    if (this.leader) this.damageHero(Math.floor(dmg * 0.5));
    if (this.army && this.army.units) {
      for (const u of this.army.units) {
        if (u && u.alive !== false) u.hp = Math.max(0, (u.hp || 100) - Math.floor(dmg * 0.3));
      }
    }
  }

  /**
   * إضرار كل الوحوش القريبة من نقطة معينة (لقدرات الأسلحة)
   */
  _aoeDamageNearby(x, y, radius, dmg) {
    for (const m of this.monsters) {
      if (!m.alive) continue;
      const dist = Math.hypot(m.x - x, m.y - y);
      if (dist <= radius) {
        const falloff = 1 - (dist / radius) * 0.5; // ضرر يقل مع البعد
        this.damageMonster(m, Math.floor(dmg * falloff), false);
      }
    }
  }

  _checkBossPhase(monster) {
    if (!monster.isBoss) return;
    const hpPct = monster.hp / monster.maxHp;
    const bossId = monster.enemyId || "";
    const epicConfig = getBossPhaseConfig(bossId);
    const phases = epicConfig ? epicConfig.phases : (monster._phases || null);
    if (!phases) return;

    for (const phase of phases) {
      if (hpPct <= phase.threshold && !phase.triggered) {
        phase.triggered = true;
        if (epicConfig) {
          triggerBossPhase(this, monster, phase, bossId);
          if (this._ui && this._ui.showNotification) {
            this._ui.showNotification(`💢 ${monster.name}: ${phase.name}!`, "battle", 3000);
          }
        } else {
          this.worldFx.push({ x: monster.x, y: monster.y, text: phase.message || "💢!", color: "#ff4444", life: 2, maxLife: 2 });
          if (phase.enrage) {
            monster.damage = Math.floor(monster.damage * (phase.enrage.damageMult || 1.5));
            this.worldFx.push({ x: monster.x, y: monster.y, text: "🔥 طيران!", color: "#ff8800", life: 2, maxLife: 2 });
          }
          if (this.engine) this.engine.shake(14, 0.5);
        }
      }
    }
  }

  estimateEnemyStats(target) {
    const u = target.unitLevel || 1;
    const ap = target.army_power || 5000;
    const maxHp = 120 + u * 3 + Math.floor(ap / 20);
    const curHp = target._hp ?? target.hp ?? maxHp;
    const ratio = Math.max(0, Math.min(1, curHp / maxHp));
    const effectivePower = Math.max(500, Math.floor(ap * ratio));
    return {
      maxHp,
      damage: 12 + Math.floor(effectivePower / 15) + u,
    };
  }

  checkCombatProximity() {
    this.combatCooldown = Math.max(0, this.combatCooldown - 0.016);
    this._pvpProtectionTimer = Math.max(0, this._pvpProtectionTimer - 0.016);
    this.nearbyPlayer = null;

    let closest = null;
    let minDist = this.engagementRadius;
    for (const [, p] of this.otherPlayers) {
      const d = Math.hypot(p.x - this.leader.x, p.y - this.leader.y);
      if (d < minDist) {
        minDist = d;
        closest = p;
      }
    }
    this.nearbyPlayer = closest;
  }

  updateOtherPlayers(dt) {
    for (const [, p] of this.otherPlayers) {
      const lerp = Math.min(1, dt * 10);
      const dx = p.targetX - p.x;
      if (Math.abs(dx) > 1) p.facing = dx >= 0 ? 1 : -1;
      p.x += dx * lerp;
      p.y += (p.targetY - p.y) * lerp;
    }
  }

  drawOtherPlayers(ctx) {
    for (const [, p] of this.otherPlayers) {
      const armyPower = p.army_power || 0;
      const armyCount = getVisualTroopCount(armyPower);

      for (let i = 0; i < armyCount; i++) {
        const pos = getTroopFormation(i, armyCount);
        ctx.save();
        ctx.translate(p.x + pos.ox, p.y + pos.oy);
        ctx.fillStyle = "rgba(0,0,0,0.25)";
        ctx.beginPath();
        ctx.ellipse(0, 5, 6, 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.scale(p.facing || 1, 1);
        this._drawSprite(ctx, "soldier-enemy", p.color + "99", 8);
        ctx.restore();
      }

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.beginPath();
      ctx.ellipse(0, p.radius * 0.5, p.radius * 0.7, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.scale(p.facing || 1, 1);
      this._drawSprite(ctx, "leader-enemy", p.color, p.radius);
      ctx.restore();

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 11px Cairo, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(p.username, 0, -p.radius - 10);
      ctx.restore();

      const hp = p.hp ?? p._hp ?? 120;
      const maxHp = p.maxHp ?? 120;
      const hpRatio = Math.max(0, Math.min(1, hp / maxHp));
      const barW = p.radius * 2 + 4;
      ctx.save();
      ctx.translate(p.x, p.y - p.radius - 20);
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(-barW / 2, 0, barW, 4);
      ctx.fillStyle = hpRatio > 0.5 ? "#4cd964" : hpRatio > 0.25 ? "#ffaa00" : "#ff4444";
      ctx.fillRect(-barW / 2, 0, barW * hpRatio, 4);
      ctx.restore();

      const effective = Math.floor((p.army_power || 0) * Math.max(0, Math.min(1, hp / maxHp)));
      ctx.save();
      ctx.translate(p.x, p.y - p.radius - 32);
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.fillRect(-28, 0, 56, 10);
      ctx.fillStyle = "#ffcc00";
      ctx.font = "bold 8px monospace";
      ctx.textAlign = "center";
      ctx.fillText(effective.toLocaleString(), 0, 8);
      ctx.restore();

      const wStar = p.weaponStarLevel || 1;
      if (wStar >= 2) {
        drawWeaponGlow(ctx, p.x, p.y, wStar, p.radius, this._glowTime || 0);
      }
      if (wStar >= 1) {
        drawWeaponStarIcons(ctx, p.x, p.y - p.radius - 44, wStar, 8);
      }
    }
  }

  // ==================== تهيئة الجيش ====================
  initArmyUnits(count) {
    this.armyUnits = [];
    const roles = ["warrior", "archer", "shield", "warrior", "archer", "warrior", "shield", "warrior"];
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const dist = 20 + Math.random() * 25;
      const roleKey = roles[i % roles.length];
      const role = SOLDIER_ROLES[roleKey];
      this.armyUnits.push({
        x: this.leader.x + Math.cos(a) * dist,
        y: this.leader.y + Math.sin(a) * dist,
        speed: role.speed + Math.random() * 10,
        radius: 10,
        hp: role.hp,
        maxHp: role.hp,
        baseDmg: role.baseDmg,
        dmgBonus: 0,
        defBonus: 0,
        attackCD: 0,
        attackRange: role.range,
        path: null,
        pathIdx: 0,
        fighting: null,
        facing: 1,
        role: roleKey,
        roleName: role.name,
        icon: role.icon,
        color: role.color,
      });
    }
  }

  start() {
    if (this.running) return;
    this.running = true;
    if (window._loadedPosition) {
      this.leader.x = window._loadedPosition.x;
      this.leader.y = window._loadedPosition.y;
      delete window._loadedPosition;
    }

    const canvas = document.getElementById("gameCanvas");
    if (!canvas) return;
    canvas.classList.remove("hidden");

    this.engine = new GameEngine("gameCanvas");
    this.engine.camera.lookAt(this.leader.x, this.leader.y);

    this.engine.onTap((wx, wy) => this.onTap(wx, wy));

    const recenterBtn = document.getElementById("recenter-btn");
    if (recenterBtn) recenterBtn.onclick = () => this.recenterCamera();

    // أزرار PvP — هجوم / استعلام
    const pvpAttackBtn = document.getElementById("pvp-attack-btn");
    const pvpInspectBtn = document.getElementById("pvp-inspect-btn");
    const pvpContextBg = document.querySelector(".pvp-context-bg");
    if (pvpAttackBtn) pvpAttackBtn.onclick = () => this._onPvPAttack();
    if (pvpInspectBtn) pvpInspectBtn.onclick = () => this._onPvPInspect();
    if (pvpContextBg) pvpContextBg.onclick = () => this._hidePvPMenu();

    // PvP Inspect Popup
    const inspectClose = document.getElementById("pvp-inspect-close");
    const inspectPopup = document.getElementById("pvp-inspect-popup");
    if (inspectClose && inspectPopup) inspectClose.onclick = () => inspectPopup.classList.add("hidden");

    // Defeat modal
    const defeatReturnBtn = document.getElementById("pvp-defeat-return-btn");
    if (defeatReturnBtn) {
      defeatReturnBtn.onclick = () => {
        document.getElementById("pvp-defeat-modal")?.classList.add("hidden");
        if (this._onPvPReturn) this._onPvPReturn();
      };
    }

    const zoomInBtn = document.getElementById("zoom-in-btn");
    const zoomOutBtn = document.getElementById("zoom-out-btn");

    if (zoomInBtn) {
      zoomInBtn.onclick = () => {
        if (this.engine?.camera) this.engine.camera.zoom = Math.min(this.engine.camera.maxZoom, this.engine.camera.zoom * 1.25);
      };
      zoomInBtn.classList.remove("hidden");
    }
    if (zoomOutBtn) {
      zoomOutBtn.onclick = () => {
        if (this.engine?.camera) this.engine.camera.zoom = Math.max(this.engine.camera.minZoom, this.engine.camera.zoom / 1.25);
      };
      zoomOutBtn.classList.remove("hidden");
    }

    initCollisionGrid(this.W, this.H);
    this.initArmyUnits(8);

    // ── توليد شخصيات 2.5D + بلاطات أرضية ──
    try {
      spriteFactory.generateAll();
      this._iso.generateTileMap(Date.now() % 10000);
    } catch (e) {
      console.warn("[2.5D] Fallback to flat rendering:", e.message);
      this._isometricEnabled = false;
    }

    this.spawnMonsters(); // وحوش محلية كبديل (يتم تحديثها من السيرفر عند الاتصال)
    this.spawnTreasureChests(); // 🎁 صناديق الكنز في الخريطة

    // 🪨 عوائق/صخور الصحراء — مصفوفة واحدة تُستخدم لكل من التصادم والرسم البصري
    // (كانت سابقاً مجرد جدران خفية بلا أي تمثيل مرئي على الخريطة)
    this.MAP_OBSTACLES = [
      { x: 420, y: 380, r: 95 },
      { x: 780, y: 520, r: 70 },
      { x: 1150, y: 290, r: 110 },
      { x: 1420, y: 680, r: 85 },
      { x: 1680, y: 410, r: 65 },
      { x: 1950, y: 850, r: 120 },
      { x: 620, y: 920, r: 75 },
      { x: 980, y: 1150, r: 90 },
      { x: 1350, y: 1320, r: 55 },
      { x: 1720, y: 1080, r: 100 },
      { x: 2100, y: 1450, r: 80 },
      { x: 450, y: 1550, r: 70 },
      { x: 890, y: 1680, r: 95 },
      { x: 1280, y: 1820, r: 65 },
      { x: 1600, y: 1590, r: 85 },
      { x: 350, y: 350, r: 40 },   // صخرة شمال غرب
      { x: 1100, y: 250, r: 50 },  // صخرة شمال
      { x: 1850, y: 380, r: 45 },  // صخرة شمال شرق
      { x: 250, y: 800, r: 35 },   // صخرة غرب
      { x: 2050, y: 900, r: 55 },  // صخرة شرق
      { x: 400, y: 1480, r: 40 },  // صخرة جنوب غرب
      { x: 1500, y: 1900, r: 48 }, // صخرة جنوب
      { x: 2100, y: 1500, r: 42 }, // صخرة جنوب شرق
      { x: 750, y: 750, r: 30 },   // صخرة وسط غرب
      { x: 1600, y: 600, r: 35 },  // صخرة وسط شرق
    ];
    for (const rock of this.MAP_OBSTACLES) {
      markObstacle(rock.x, rock.y, rock.r);
    }
    this._prerenderObstacleSprites();

    const img = new Image();
    img.onload = () => { 
      this.mapImage = img; 
      if (this.netSync) this.netSync.sendLoginNotification();
    };
    img.src = typeof ImageResolver !== 'undefined' ? ImageResolver.src('mapDesert') : "img/map.jpg";

    this.engine.start((dt, ctx, cam) => this.update(dt, ctx, cam));

    const exitBtn = document.getElementById("exit-world-btn");
    if (exitBtn) {
      this._boundExit = () => this.exitWorldMap();
      exitBtn.onclick = this._boundExit;
    }

    this.startMultiplayerSync();
  }

  recenterCamera() {
    if (this.engine?.camera && this.leader) {
      this.engine.camera.lookAt(this.leader.x, this.leader.y);
    }
  }

  stop() {
    this.running = false;
    this.stopMultiplayerSync();
    this.otherPlayers.clear();
    const zoomInBtn = document.getElementById("zoom-in-btn");
    const zoomOutBtn = document.getElementById("zoom-out-btn");
    if (zoomInBtn) zoomInBtn.classList.add("hidden");
    if (zoomOutBtn) zoomOutBtn.classList.add("hidden");

    const exitBtn = document.getElementById("exit-world-btn");
    if (exitBtn && this._boundExit) {
      exitBtn.onclick = null;
      this._boundExit = null;
    }

    if (this.engine) {
      this.engine.stop();
      this.engine = null;
    }
  }

  respawnMonster(monster) {
    monster.alive = true;
    monster.hp = monster.maxHp;
    monster.x = monster.spawnX;
    monster.y = monster.spawnY;
    monster.attackCD = 0;
  }

  isInSafeZone(x, y) {
    const z = this.safeZone;
    return x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h;
  }

  // ==================== الحركة والقتال ====================
  _updateComboTimer(dt) {
    if (this._comboTimer > 0) {
      this._comboTimer -= dt;
      if (this._comboTimer <= 0) {
        this._comboCount = 0;
      }
    }
  }

  _updatePoisonEffects(dt) {
    for (let i = this._poisonEffects.length - 1; i >= 0; i--) {
      const p = this._poisonEffects[i];
      p.timer -= dt;
      // ضرر السم
      if (p.timer % 1 < dt || p.timer >= p.duration - dt) {
        if (p.target === this.leader) {
          this.damageHero(p.dps * dt);
        } else {
          p.target.hp = Math.max(0, p.target.hp - p.dps * dt);
        }
      }
      if (p.timer <= 0) {
        this._poisonEffects.splice(i, 1);
      }
    }
  }

  _syncBonuses() {
    let dmgBonus = 0, defBonus = 0;
    if (this._allianceManager) {
      dmgBonus = this._allianceManager.damageBonus;
      defBonus = this._allianceManager.defenseBonus;
    }
    if (this._upgradeTree) {
      dmgBonus += this._upgradeTree.getEffect("army");
      defBonus += this._upgradeTree.getEffect("defense");
    }
    const knowBonuses = computeKnowledgeBonuses({
      knowledgeLevel: this.economy?.knowledgeLevel || 1,
      knowledgeType: this.economy?.knowledgeType || "economic",
    });
    defBonus += knowBonuses.defensePercent;
    this.leader.upgradeDmg = dmgBonus;
    this.leader.upgradeDef = defBonus;
    for (const u of this.armyUnits) {
      u.dmgBonus = dmgBonus;
      u.defBonus = defBonus;
    }
  }

  updateLeader(dt) {
    this._syncBonuses();
    const h = this.leader;

    // سجل مسار القائد للجيش التابع
    h._posHistory.push({ x: h.x, y: h.y });
    if (h._posHistory.length > h._maxHist) h._posHistory.shift();

    if (h.fighting && h.fighting.alive) {
      const dx = h.fighting.x - h.x;
      const dy = h.fighting.y - h.y;
      const dist = Math.hypot(dx, dy);

      if (dist > h.attackRange) {
        const slowMult = this._stompSlowTimer > 0 ? 0.5 : 1;
        h.x += (dx / dist) * h.speed * dt * slowMult;
        h.y += (dy / dist) * h.speed * dt * slowMult;
      } else {
        h.attackCD -= dt;
        if (h.attackCD <= 0) {
          const playerDmg = computePlayerDamage({
            equippedWeapon: this._equippedWeapon,
            weapons: this.army?.weapons || [],
            playerLevel: this.economy?.level || 1,
            unitLevel: this.army?.unitLevel || 1,
            prestigeLevel: this.economy?.prestigeLevel || 0,
            armyPower: this.economy?.power || 5000,
            upgradeTree: this._upgradeTree,
            allianceManager: this._allianceManager,
          });
          const rageResult = applyRageMultiplier(playerDmg.totalDamage, h.hp, h.maxHp);
          const critResult = rollCrit(playerDmg.weaponStats.critChance, playerDmg.weaponStats.critMultiplier);
          let totalDmg = computePvPDamage(rageResult.damage, critResult, playerDmg.weaponStats.weaponDamage);

          // ── تطبيق قدرة السلاح السلبية ──
          const passiveResult = this._weaponAbilities.tryPassive(this._equippedWeapon, h.fighting);
          if (passiveResult) {
            this.worldFx.push({ x: h.fighting.x, y: h.fighting.y - 20, text: passiveResult.text, color: "#af52de", life: 1.2, maxLife: 1.2 });
            if (passiveResult.type === "crit_boost") {
              totalDmg = Math.floor(totalDmg * (1 + passiveResult.bonusDamage));
            }
          }

          // ── تطبيق قدرة السلاح النشطة ──
          const activeResult = this._weaponAbilities.tryActive(this._equippedWeapon, h.fighting, totalDmg);
          if (activeResult) {
            this.worldFx.push({ x: h.fighting.x, y: h.fighting.y - 30, text: activeResult.text, color: "#ffd700", life: 1.5, maxLife: 1.5 });
            if (activeResult.extraDamage) {
              totalDmg += activeResult.extraDamage;
            }
            if (activeResult.damage) {
              totalDmg += activeResult.damage;
            }
            if (activeResult.stunDuration && h.fighting) {
              h.fighting._stunTimer = activeResult.stunDuration;
            }
            if (activeResult.selfDamagePercent && this.leader) {
              const selfDmg = Math.floor(this.leader.hp * activeResult.selfDamagePercent);
              this.leader.hp = Math.max(1, this.leader.hp - selfDmg);
              this.worldFx.push({ x: h.x, y: h.y - 15, text: `-${selfDmg} HP`, color: "#ff6b6b", life: 0.8, maxLife: 0.8 });
            }
            if (activeResult.radius && h.fighting) {
              this._aoeDamageNearby(h.fighting.x, h.fighting.y, activeResult.radius, activeResult.damage || totalDmg);
            }
          }

          this.damageMonster(h.fighting, totalDmg, critResult.isCrit || (passiveResult?.type === "crit_boost"));
          if (rageResult.rageActive) {
            this.worldFx.push({ x: h.x, y: h.y - 20, text: "🔥 غضب!", color: "#ff4444", life: 0.5, maxLife: 0.5 });
          }
          h.attackCD = h.attackInterval;
        }
      }
      return;
    }

    if (!h.path || h.pathIdx >= h.path.length) {
      this._moveTargetX = null;
      this._moveTargetY = null;
      return;
    }

    const target = h.path[h.pathIdx];
    const dx = target.x - h.x;
    const dy = target.y - h.y;
    const dist = Math.hypot(dx, dy);

    if (dist < 8) {
      h.pathIdx++;
    } else {
      const slowMult = this._stompSlowTimer > 0 ? 0.5 : 1;
      h.x += (dx / dist) * h.speed * dt * slowMult;
      h.y += (dy / dist) * h.speed * dt * slowMult;
    }
  }

  updateArmy(dt) {
    this.armyUnits = this.armyUnits.filter(u => u.hp > 0);
    // تجديد صحة الجيش تدريجياً (كل 5 ثوان يتعافى 1 HP إذا مش في قتال)
    for (const u of this.armyUnits) {
      if (!u.fighting && u.hp < u.maxHp) {
        u.hp = Math.min(u.maxHp, u.hp + dt * 0.2);
      }
    }
    if (this.leader && !this.leader.fighting && this.leader.hp < this.leader.maxHp) {
      this.leader.hp = Math.min(this.leader.maxHp, this.leader.hp + dt * 0.1);
    }
    // جمع تلقائي للـ drops عندما يمر الجيش فوقها
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      if (d.collected) continue;
      d.life = (d.life || 25) - dt;
      if (d.life <= 0) { this.drops.splice(i, 1); continue; }
      if (Math.hypot(d.x - this.leader.x, d.y - this.leader.y) < 40 || this.armyUnits.some(u => Math.hypot(d.x - u.x, d.y - u.y) < 30)) {
        this.collectDrop(i);
      }
    }

    // 🎁 جمع تلقائي للصناديق عندما يمر القائد فوقها
    for (let i = this.treasureChests.length - 1; i >= 0; i--) {
      const c = this.treasureChests[i];
      if (c.opened) continue;
      if (Math.hypot(c.x - this.leader.x, c.y - this.leader.y) < 35) {
        this.openTreasureChest(i);
      }
    }
    const h = this.leader;
    const history = h._posHistory;
    const len = history.length;
    const time = Date.now();

    // ── في BR: الجيش يهاجم قطاع الطرق ──
    if (this.mode === "battle_royale") {
      for (const b of this.bandits) {
        if (!b.alive) continue;
        for (const u of this.armyUnits) {
          if (u.fighting && u.fighting.alive) continue;
          const d = Math.hypot(u.x - b.x, u.y - b.y);
          if (d < (u.attackRange || 25) + b.radius) {
            u.fighting = b;
          }
        }
      }
    }

    for (let i = 0; i < this.armyUnits.length; i++) {
      const unit = this.armyUnits[i];

      // ── اشتباك مع قطاع الطرق ──
      if (this.mode === "battle_royale" && unit.fighting && unit.fighting._isBandit !== undefined) {
        const b = unit.fighting;
        if (!b.alive) { unit.fighting = null; continue; }
        const dx = b.x - unit.x;
        const dy = b.y - unit.y;
        const dist = Math.hypot(dx, dy);
        const atkRange = unit.attackRange || 25;
        if (dist > atkRange + 5) {
          unit.facing = dx >= 0 ? 1 : -1;
          unit.x += (dx / dist) * unit.speed * dt;
          unit.y += (dy / dist) * unit.speed * dt;
        } else {
          unit.attackCD -= dt;
          if (unit.attackCD <= 0) {
            b.hp -= Math.max(1, Math.floor((unit.baseDmg + unit.dmgBonus) * 0.8));
            if (b.hp <= 0) {
              b.alive = false;
              this.createDrop(b.x, b.y, 15, 5);
              this.worldFx.push({ x: b.x, y: b.y, text: "💀 قطاع طرق!", color: "#ff6600", life: 1, maxLife: 1 });
              if (this.brKills !== undefined) this.brKills = (this.brKills || 0) + 1;
            }
            unit.attackCD = 0.8;
          }
        }
        continue;
      }

      // ── اشتباك مع الوحوش (مع crit + أدوار) ──
      if (unit.fighting && unit.fighting.alive) {
        const dx = unit.fighting.x - unit.x;
        const dy = unit.fighting.y - unit.y;
        const dist = Math.hypot(dx, dy);
        const atkRange = unit.attackRange || 25;

        if (dist > atkRange) {
          unit.facing = dx >= 0 ? 1 : -1;
          unit.x += (dx / dist) * unit.speed * dt;
          unit.y += (dy / dist) * unit.speed * dt;
        } else {
          unit.attackCD -= dt;
          if (unit.attackCD <= 0) {
            const crit = this._rollCrit();
            const totalDmg = Math.floor((unit.baseDmg + unit.dmgBonus + crit.weaponDmg * 0.3) * (unit.role === "shield" ? 0.7 : crit.multiplier));
            const isCrit = crit.isCrit && unit.role !== "shield";
            this.damageMonster(unit.fighting, totalDmg, isCrit);
            unit.attackCD = unit.role === "archer" ? 1.0 : unit.role === "shield" ? 0.8 : 0.6;
          }
        }
        continue;
      }

      // ── Leader Following (بدون path فردي) ──
      const delay = (i + 1) * 3 + 2;
      const idx = Math.max(0, len - delay);

      let tx, ty;

      if (this.leader.path && this.leader.pathIdx < this.leader.path.length) {
        // القائد يتحرك → اتباع المسار المتأخر مع تشتت بسيط
        if (len > delay && idx > 0 && idx < len - 1) {
          const scatter = 5;
          const angleOff = i * 1.3;
          tx = history[idx].x + Math.sin(angleOff + time * 0.002) * scatter;
          ty = history[idx].y + Math.cos(angleOff + time * 0.002) * scatter;
        } else {
          const aliveLen = Math.max(1, this.armyUnits.length);
          const a = (i / aliveLen) * Math.PI * 2;
          tx = h.x + Math.cos(a) * 30;
          ty = h.y + Math.sin(a) * 30;
        }
      } else {
        // القائد متوقف → تشكيل دائري طبيعي
        const aliveLen = Math.max(1, this.armyUnits.length);
        const a = (i / aliveLen) * Math.PI * 2 + Math.sin(i * 2.3) * 0.15;
        const r = 26 + Math.sin(i * 1.7) * 6;
        tx = h.x + Math.cos(a) * r;
        ty = h.y + Math.sin(a) * r;
      }

      const dx = tx - unit.x;
      const dy = ty - unit.y;
      const dist = Math.hypot(dx, dy);

      if (dist > 3) {
        unit.facing = dx >= 0 ? 1 : -1;
        const step = Math.min(unit.speed * dt, dist);
        unit.x += (dx / dist) * step;
        unit.y += (dy / dist) * step;
      }
    }
  }

  updateMonstersAI(dt) {
    const connected = this.netSync && this.netSync.isConnected;
    // إذا السيرفر متصل، نسحب مواقع الوحوش من السيرفر (حركة سلسة)
    if (connected) {
      this._lerpMonsterPositions(dt);
    }
    for (const m of this.monsters) {
      if (!m.alive) {
        m.respawnTimer -= dt;
        if (m.respawnTimer <= 0) this.respawnMonster(m);
        continue;
      }

      // تقليل timers الوحوش
      if (m._shieldTimer > 0) m._shieldTimer -= dt;
      if (m._phaseTimer > 0) m._phaseTimer -= dt;

      // إذا السيرفر متصل — لا نحرك الوحوش محلياً (السيرفر هو المسؤول)
      if (connected) continue;

      let target = this.leader;
      let minDist = Math.hypot(m.x - this.leader.x, m.y - this.leader.y);

      for (const u of this.armyUnits) {
        const d = Math.hypot(m.x - u.x, m.y - u.y);
        if (d < minDist) {
          minDist = d;
          target = u;
        }
      }

      // نطاق الرؤية (Chase range) — حسب نوع الوحش
      let CHASE_RANGE = 300;
      if (m._peaceful) CHASE_RANGE = 80;
      else if (m._aggressiveRange) CHASE_RANGE = m._aggressiveRange;

      if (minDist < CHASE_RANGE) {
        // ===== مطاردة سلسة (Chase) =====
        // فحص التثبيت — الوحش المثبّت لا يتحرك ولا يهاجم
        if (m._stunTimer > 0) {
          m._stunTimer -= dt;
          continue; // الوحش مثبّت — انتقل للوحش التالي
        }

        // تطبيق التباطؤ من قدرات الأسلحة
        const slowMult = m._slowMult || 1;

        if (minDist < 30) {
          m.attackCD -= dt;
          if (m.attackCD <= 0) {
            // قدرة الوحش الخاصة
            if (m.ability && !this._applyMonsterAbility(m, target)) {
              // هجوم عادي
              if (target === this.leader) {
                this.damageHero(m.damage);
              } else {
                target.hp = Math.max(0, target.hp - m.damage);
              }
              // تأثير هجوم عادي
              spawnHitEffect(this, target.x || m.x, target.y || m.y, false);
            }
            m.attackCD = m.ability?.type === "heal" ? 2.5 : m.ability?.type === "berserk" ? 0.7 : 1.0;
          }
          // تباطؤ تدريجي عند الاقتراب (حركة ناعمة حول الهدف)
          m._patrolTarget = null;
          m._idleTimer = 0;
        } else {
          // سير باتجاه الهدف مع سموث + تطبيق التباطؤ
          const speed = (35 + (300 - minDist) / 300 * 20) * slowMult;
          if (!m._chaseTarget || Math.hypot(m._chaseTarget.x - target.x, m._chaseTarget.y - target.y) > 30) {
            m._chaseTarget = { x: target.x, y: target.y };
          } else if (!m._chaseTarget) {
            m._chaseTarget = { x: target.x, y: target.y };
          }
          // تحديث هدف المطاردة تدريجياً
          m._chaseTarget.x += (target.x - m._chaseTarget.x) * Math.min(1, dt * 3);
          m._chaseTarget.y += (target.y - m._chaseTarget.y) * Math.min(1, dt * 3);

          const dx = m._chaseTarget.x - m.x;
          const dy = m._chaseTarget.y - m.y;
          const dist = Math.hypot(dx, dy);
          if (dist > 1) {
            m.x += (dx / dist) * speed * dt;
            m.y += (dy / dist) * speed * dt;
          }
          m._patrolTarget = null;
          m._idleTimer = 0;
        }
      } else {
        // ===== دورية سلسة (Patrol) =====
        if (!m._patrolTarget) {
          // اختيار هدف دورية جديد
          m._patrolTarget = {
            x: m.spawnX + (Math.random() - 0.5) * 120,
            y: m.spawnY + (Math.random() - 0.5) * 120,
          };
          m._idleTimer = 0;
        }

        const dx = m._patrolTarget.x - m.x;
        const dy = m._patrolTarget.y - m.y;
        const dist = Math.hypot(dx, dy);

        if (dist < 8) {
          // وصلنا لنقطة الدورية — توقف قصير ثم اختر هدفاً جديداً
          m._idleTimer = (m._idleTimer || 0) + dt;
          if (m._idleTimer > 1.5 + Math.random() * 2) {
            m._patrolTarget = null;
          }
        } else {
          // تحرك سلس نحو هدف الدورية
          const speed = 15 + Math.random() * 5; // سرعة متغيرة قليلاً
          m.x += (dx / dist) * speed * dt;
          m.y += (dy / dist) * speed * dt;
          m._idleTimer = 0;
        }
      }
    }
  }

  damageMonster(monster, dmg, isCrit = false) {
    if (!monster || !monster.alive) return;

    // فيز (تجنب تام للهجمات)
    if (monster._phaseTimer > 0) return false;

    // شيلد الوحش
    if (monster._shieldTimer > 0) {
      dmg = Math.floor(dmg * 0.5);
    }

    // دودج
    if (monster.ability?.type === "dodge" && Math.random() < (monster.ability.chance || 0)) {
      this.worldFx.push({ x: monster.x, y: monster.y, text: "💨 تفادى!", color: "#4a90d9", life: 0.8, maxLife: 0.8 });
      return;
    }

    // عاصفة رملية — تقلل الضرر 50%
    if (this._sandstormActive) {
      dmg = Math.floor(dmg * 0.5);
      this.worldFx.push({ x: monster.x, y: monster.y, text: "🌪️ عاصفة!", color: "#f39c12", life: 0.4, maxLife: 0.4 });
    }

    monster.hp -= dmg;
    const finalDmg = dmg;

    // تحقق من مراحل الزعيم (Phases)
    this._checkBossPhase(monster);

    // تأثيرات ضرب
    spawnHitEffect(this, monster.x, monster.y, isCrit, this._equippedWeapon);
    if (this.engine) {
      const shakeIntensity = isCrit ? 8 : Math.min(4, Math.floor(dmg / 10));
      this.engine.shake(shakeIntensity, 0.1);
    }

    // نص الضرر يظهر
    const dmgText = isCrit ? `💥 ${finalDmg}!` : `-${finalDmg}`;
    const dmgColor = isCrit ? "#ffd700" : "#ff6b35";
    this.worldFx.push({ x: monster.x, y: monster.y - 10, text: dmgText, color: dmgColor, life: 0.8, maxLife: 0.8 });

    if (monster.hp <= 0) {
      if (this._onMonsterKilled) this._onMonsterKilled();
      if (this._activeMode) this._activeMode.onMonsterKilled(monster);
      monster.alive = false;
      monster.respawnTimer = 25;

      this._comboCount++;
      this._comboTimer = 5;
      if (this._comboCount >= this._comboThreshold) {
        const comboMult = 1 + Math.floor(this._comboCount / 3) * 0.25;
        const bonusXp = Math.floor(10 * (comboMult - 1));
        if (this.economy) {
          this.economy.addXp(bonusXp);
          spawnComboEffect(this, monster.x, monster.y - 20, this._comboCount);
        }
      }

      this.sessionStats.kills++;
      this._sendWS({ type: "monster_killed", id: monster.id });

      spawnMonsterDeathEffect(this, monster);
      if (this.engine) this.engine.shake(monster.isBoss ? 12 : 4, monster.isBoss ? 0.3 : 0.15);

      this.worldFx.push({ x: monster.x, y: monster.y, text: `⚔️ قتلت ${monster.name}`, color: "#FFD700", life: 1.5, maxLife: 1.5 });
    }
  }

  damageHero(dmg) {
    if (this._invulnerableTimer > 0) return;
    this.leader.hp = Math.max(0, this.leader.hp - dmg);
  }

  createDrop(x, y, money, gold = 0) {
    this.drops.push({ x, y, money, gold, life: 25 });
  }

  updateProjectiles(dt) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) this.projectiles.splice(i, 1);
    }
  }

  updateFx(dt) {
    for (let i = this.worldFx.length - 1; i >= 0; i--) {
      this.worldFx[i].life -= dt;
      this.worldFx[i].y -= 20 * dt;
      if (this.worldFx[i].life <= 0) this.worldFx.splice(i, 1);
    }
  }

  enterWorldMap() {
    const canvas = document.getElementById("gameCanvas");
    if (canvas) canvas.classList.remove("hidden");
    if (!this.running) this.start();
  }

  async exitWorldMap() {
    this.exitCurrentMode();
    if (this._onBeforeExit) { try { this._onBeforeExit(); } catch {} }
    const pvpModal = document.getElementById("pvp-defeat-modal");
    if (pvpModal) {
      pvpModal.classList.add("hidden");
      const returnBtn = document.getElementById("pvp-defeat-return-btn");
      if (returnBtn && returnBtn._pvpCountdown) { clearInterval(returnBtn._pvpCountdown); returnBtn._pvpCountdown = null; }
    }
    if (this.netSync) {
      this.netSync.sendWSUpdate();
      await this.netSync.sendPositionUpdate();
    }
    this._pvpDisabled = false;
    if (this.mode === "battle_royale") {
      this.matchStarted = false;
      this.matchEnded = false;
      this.mode = "campaign";
      this.W = 2400;
      this.H = 2400;
      this.bandits = [];
      this.killFeed = [];
      // إخفاء واجهة BR
      document.getElementById("br-timer")?.classList.add("hidden");
      document.getElementById("br-players")?.classList.add("hidden");
      document.getElementById("br-kills")?.classList.add("hidden");
      document.getElementById("br-kill-feed")?.classList.add("hidden");
      document.getElementById("br-zone-warning")?.classList.add("hidden");
      document.getElementById("br-evacuate-btn")?.classList.add("hidden");
      this.brExtractionZone = null;
      this._brNearExtraction = false;
    }
    this.stop();
    const canvas = document.getElementById("gameCanvas");
    if (canvas) canvas.classList.add("hidden");
    if (this.onExit) this.onExit();
    if (this.store) this.store.set('players', []);
  }
}

injectPartyMethods(WorldMap);
injectModesMethods(WorldMap);
injectMonstersMethods(WorldMap);
injectLootMethods(WorldMap);
injectBRMethods(WorldMap);
injectRenderMethods(WorldMap);
injectFxMethods(WorldMap);
injectInteractionMethods(WorldMap);
injectPvPMenuMethods(WorldMap);
injectWipeHudMethods(WorldMap);
injectEntitiesMethods(WorldMap);
injectUpdateMethods(WorldMap);
injectPvPCombatMethods(WorldMap);