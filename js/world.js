import { GameEngine } from "./engine.js";
import {
  aStar,
  initCollisionGrid,
  markObstacle,
  simplifyPath
} from "./pathfinding.js";
import { drawPathLine, spawnPvPParticles, updatePvPParticles, drawPvPParticles, spawnHitEffect, spawnMonsterDeathEffect, spawnComboEffect } from "./combat/combat-effects.js";
import { showPvPMenu, hidePvPMenu, showPvPDefeat, showWipeScreen } from "./ui/context-menu.js";
import { computeWeaponDamage, computePlayerMaxHp, computePlayerDamage, applyRageMultiplier, computePvPDamage, rollCrit } from "./combat-engine.js";
import { WeaponAbilityManager } from "./combat/weapon-abilities.js";
import { computeKnowledgeBonuses } from "./economy.js";
import { getVisualTroopCount, getTroopFormation } from "./combat/troop-visuals.js";
import { drawWeaponGlow, drawWeaponStarIcons, drawWeaponOnHero } from "./combat/weapon-visuals.js";
import { spriteFactory, SpriteFactory } from "./sprite-factory.js";
import { IsometricSystem, DepthSorter } from "./isometric.js";
import { SOLDIER_ROLES } from "./army.js";
import { getBossPhaseConfig, triggerBossPhase, updateBossEnrage } from "./combat/epic-bosses.js";
import { injectPartyMethods } from "./world-party.js";
import { injectModesMethods } from "./world-modes.js";
import { injectMonstersMethods } from "./world-monsters.js";
import { injectLootMethods } from "./world-loot.js";
import { injectBRMethods } from "./world-br.js";
import { injectRenderMethods } from "./world-render.js";

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
  findDropAt(x, y) {
    for (let i = this.drops.length - 1; i >= 0; i--) {
      if (Math.hypot(this.drops[i].x - x, this.drops[i].y - y) < 30) return i;
    }
    return -1;
  }

  collectDrop(index) {
    if (index < 0 || index >= this.drops.length) return;
    const drop = this.drops[index];
    if (!drop || drop.collected) return;
    drop.collected = true;
    const money = drop.money || 0;
    const gold = drop.gold || 0;
    if (this._activeMode && this._activeMode.modeName === "extraction" && gold > 0) {
      const bagMult = 1 + ((this._activeMode._currentUpgrades?.bagSize || 1) - 1) * 0.1;
      const goldToCarry = Math.floor(gold * bagMult);
      this._activeMode._carryingGold = Math.min(
        this._activeMode._carryingGold + goldToCarry,
        this._activeMode._getMaxBag()
      );
      this.worldFx.push({
        x: drop.x, y: drop.y,
        text: `🪙 +${goldToCarry} (${this._activeMode._carryingGold}/${this._activeMode._getMaxBag()})`,
        color: "#FFD700", life: 0.8, maxLife: 0.8
      });
      if (this._onSelfStatsChanged) this._onSelfStatsChanged();
      if (money > 0 && this.economy) {
        this.economy.addRaw("cash", money);
        this.sessionStats.coinsEarned += money;
        if (this._onCashEarned) this._onCashEarned(money);
      }
    } else {
      if (this.economy) {
        if (money > 0) this.economy.addRaw("cash", money);
        if (gold > 0) this.economy.addRaw("gold", gold);
        if (money > 0 && this._onCashEarned) this._onCashEarned(money);
      }
      this.sessionStats.coinsEarned += money;
      this.worldFx.push({ x: drop.x, y: drop.y, text: `+${money} 💵${gold > 0 ? ` +${gold} 🪙` : ''}`, color: "#FFD700", life: 0.8, maxLife: 0.8 });
    }
    this.drops.splice(index, 1);
    if (this._onDropCollected) this._onDropCollected();
  }

  findTreasureChestAt(x, y) {
    for (let i = this.treasureChests.length - 1; i >= 0; i--) {
      const c = this.treasureChests[i];
      if (!c.opened && Math.hypot(c.x - x, c.y - y) < 40) return i;
    }
    return -1;
  }

  openTreasureChest(index) {
    if (index < 0 || index >= this.treasureChests.length) return;
    const chest = this.treasureChests[index];
    if (!chest || chest.opened) return;
    chest.opened = true;
    chest.respawnTimer = 90; // يعود بعد 90 ثانية
    const { artifacts, cash, gold, desertGem } = chest.reward;
    if (this.economy) {
      if (artifacts > 0) this.economy.addRaw('artifacts', artifacts);
      if (cash > 0) this.economy.addRaw('cash', cash);
      if (gold > 0) this.economy.addRaw('gold', gold);
      if (desertGem > 0) this.economy.addRaw('desertGem', desertGem);
    }
    const gemText = desertGem > 0 ? ` 💠x${desertGem}` : '';
    this.worldFx.push({
      x: chest.x, y: chest.y,
      text: `🎁 ${artifacts} 🏺 +${cash} 💵 +${gold} 🪙${gemText}`,
      color: "#ffd700", life: 2.0, maxLife: 2.0
    });
    if (this._onTreasureOpened) this._onTreasureOpened(chest.reward);
  }

  onTap(wx, wy) {
    // 🎁 فتح صندوق كنز إذا نقر عليه
    const chestIdx = this.findTreasureChestAt(wx, wy);
    if (chestIdx >= 0) {
      this.openTreasureChest(chestIdx);
      this._hidePvPMenu();
      return;
    }

    const dropIdx = this.findDropAt(wx, wy);
    if (dropIdx >= 0) {
      this.collectDrop(dropIdx);
      this._hidePvPMenu();
      return;
    }

    const monster = this.findMonsterAt(wx, wy);
    if (monster && monster.alive) {
      this.engageMonster(monster);
      this._hidePvPMenu();
      return;
    }

    const otherPlayer = this.findOtherPlayerAt(wx, wy);
    if (otherPlayer) {
      if (this._pvpFledTarget && this._pvpFledTarget.username === otherPlayer.username) {
        this._hidePvPMenu();
        this._startPvPPursuit(otherPlayer);
        return;
      }
      this._showPvPMenu(otherPlayer);
      return;
    }

    this._hidePvPMenu();
    this._cancelPvPAttack();

    this.leader.fighting = null;
    this.armyUnits.forEach(u => u.fighting = null);

    const path = aStar(this.leader.x, this.leader.y, wx, wy, this.W, this.H);
    this.leader.path = simplifyPath(path);
    this.leader.pathIdx = 0;
    this._moveTargetX = wx;
    this._moveTargetY = wy;
    this.leader.fighting = null;
    this.armyUnits.forEach(u => { u.fighting = null; });

    if (this.netSync) this.netSync.sendWSUpdate();
  }

  movePlayerTo(x, y) {
    if (!this.leader) return;
    this.leader.fighting = null;
    this.armyUnits.forEach(u => u.fighting = null);
    const path = aStar(this.leader.x, this.leader.y, x, y, this.W, this.H);
    this.leader.path = simplifyPath(path);
    this.leader.pathIdx = 0;
    this._moveTargetX = x;
    this._moveTargetY = y;
    if (this.netSync) this.netSync.sendWSUpdate();
  }

  _startPvPPursuit(target) {
    this._isPvPEngaged = false;
    this._pvpResultSent = false;
    this._pvpDamageCD = 0;
    this._pvpAttackTarget = target;
    this._pvpFledTarget = null;

    const path = aStar(this.leader.x, this.leader.y, target.x, target.y, this.W, this.H);
    this.leader.path = simplifyPath(path);
    this.leader.pathIdx = 0;
    this._moveTargetX = target.x;
    this._moveTargetY = target.y;
  }

  _showPvPMenu(otherPlayer) {
    if (this._pvpDisabled) return;
    showPvPMenu(this, otherPlayer);
  }

  _hidePvPMenu() {
    hidePvPMenu(this);
  }

  _onPvPAttack() {
    const target = this._pvpTarget;
    if (!target) return;
    if (this._pvpDisabled) return;
    // حماية لمدة 30 ثانية بعد الموت
    if (this._pvpProtectionTimer > 0) {
      const secs = Math.ceil(this._pvpProtectionTimer);
      this.worldFx.push({
        x: this.leader.x, y: this.leader.y,
        text: `🛡️ أنت محمي لمدة ${secs}ث`,
        color: "#4cd964", life: 2, maxLife: 2
      });
      return;
    }
    this._hidePvPMenu();
    this._startPvPAttack(target);
  }

  _onPvPInspect() {
    const target = this._pvpTarget;
    if (!target) return;
    const popup = document.getElementById("pvp-inspect-popup");
    const nameEl = document.getElementById("pvp-inspect-name");
    const repEl = document.getElementById("pvp-inspect-rep");
    const powerEl = document.getElementById("pvp-inspect-power");
    const killsEl = document.getElementById("pvp-inspect-kills");
    const coinsEl = document.getElementById("pvp-inspect-coins");
    if (popup && nameEl) {
      nameEl.textContent = target.username || "—";
      if (repEl) repEl.textContent = `${target.repIcon || "😐"} ${target.repTitle || "محايد"}`;
      const est = this.estimateEnemyStats(target);
      if (powerEl) powerEl.textContent = `${target.army_power || 0} 👊 (DMG: ${est.damage} | HP: ${est.maxHp})`;
      if (killsEl) killsEl.textContent = target.kills || 0;
      if (coinsEl) coinsEl.textContent = target.coinsEarned || 0;
      popup.classList.remove("hidden");
    }
  }

  _startPvPAttack(target) {
    const myStats = this.computePvPStats();
    this.leader.maxHp = myStats.maxHp;
    if (this.leader.hp > this.leader.maxHp) this.leader.hp = this.leader.maxHp;

    target._hp = null;
    this._pvpAttackTarget = target;
    this._isPvPEngaged = false;
    this._pvpDamageCD = 0;
    this._pvpResultSent = false;
    this._pvpFledTarget = null;
    this._pvpParticles = [];

    const path = aStar(this.leader.x, this.leader.y, target.x, target.y, this.W, this.H);
    this.leader.path = simplifyPath(path);
    this.leader.pathIdx = 0;
    this._moveTargetX = target.x;
    this._moveTargetY = target.y;
  }

  _cancelPvPAttack() {
    this._pvpAttackTarget = null;
    this._isPvPEngaged = false;
    this._pvpDamageCD = 0;
    this._pvpResultSent = false;
    this._pvpFledTarget = null;
    this._pvpParticles = [];
  }

  findMonsterAt(x, y) {
    let closest = null;
    let minDist = 120;
    for (const m of this.monsters) {
      if (!m.alive) continue;
      const d = Math.hypot(m.x - x, m.y - y);
      if (d < minDist) {
        minDist = d;
        closest = m;
      }
    }
    return closest;
  }

  engageMonster(monster) {
    this.leader.fighting = monster;
    this.armyUnits.forEach(u => u.fighting = monster);
  }

  drawPathLine(ctx, cam) {
    drawPathLine(this, ctx, cam);
  }

  checkWipe() {
    if (this.mode === "battle_royale") return;
    if (this.leader.hp <= 0 && this._pvpDefeatShown) return;
    if (this.leader.hp <= 0) {
      this._wipeFlag = true;
    }
    if (this._wipeFlag) {
      this._wipeFlag = false;
      this.onWipe();
    }
  }

  onWipe() {
    this._invulnerableTimer = 3;
    // 🛡️ إذا كان النمط النشط ينهي "جولته" بالموت (مثل الحشد) ويعرض شاشة نتيجة خاصة به،
    // نتجنب ازدواج شاشة الهزيمة العامة فوقها. الأنماط الأخرى (كهف/استخراج) تستمر جولتها
    // بعد الموت فتبقى شاشة الهزيمة العامة مناسبة لها كما هي.
    let modeHandledScreen = false;
    if (this._activeMode && typeof this._activeMode.onWipe === 'function') {
      modeHandledScreen = this._activeMode.onWipe() === true;
    }
    this._cancelPvPAttack();
    this._pvpDefeatShown = false;
    const pvpModal = document.getElementById("pvp-defeat-modal");
    if (pvpModal) {
      pvpModal.classList.add("hidden");
      const returnBtn = document.getElementById("pvp-defeat-return-btn");
      if (returnBtn && returnBtn._pvpCountdown) { clearInterval(returnBtn._pvpCountdown); returnBtn._pvpCountdown = null; }
    }
    const lost = this.sessionStats.coinsEarned;
    const killed = this.sessionStats.kills;
    if (this.economy && lost > 0) {
      this.economy.addRaw("cash", -lost);
      this.economy.addXp(-Math.floor(killed * 5));
      if (this.netSync) this.netSync.sendPositionUpdate();
    }
    this.sessionStats = { kills: 0, coinsEarned: 0, pvpWins: 0, upgradesToday: 0 };
    this.leader.hp = this.leader.maxHp;
    this.leader.x = this.W / 2;
    this.leader.y = this.H / 2;
    this.leader.path = null;
    this.initArmyUnits(8);
    if (!modeHandledScreen) this._showWipeScreen(lost, killed);
    if (this.store) this.store.set('notification', { text: `💀 هُزمت! خسرت ${lost} 💵`, t: Date.now() });
    if (this._onWipe) this._onWipe(lost, killed);
  }

  _showWipeScreen(lost, killed) {
    showWipeScreen(this, lost, killed);
  }

  drawArmyHUD(dt, ctx) {
    const total = 8;
    const alive = this.armyUnits.length;
    ctx.save();
    // إعادة تعيين التحويلات للرسم في شاشة الفضاء
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const dpr = window.devicePixelRatio || 1;
    ctx.scale(dpr, dpr);
    const cw = ctx.canvas.width / dpr;
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(cw - 130, 8, 122, 28);
    ctx.fillStyle = alive > 0 ? "#4cd964" : "#ff4444";
    ctx.font = "bold 11px Cairo, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(`🛡️ ${alive}/${total}`, cw - 12, 28);
    ctx.restore();
  }

  drawPvPMenu(ctx, cam) {
    const target = this._pvpTarget;
    if (!target) return;
    const sx = target.x - cam.x;
    const sy = target.y - cam.y;
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(sx - 38, sy - 48, 76, 22);
    ctx.fillStyle = "#FFD700";
    ctx.font = "bold 9px Cairo, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`👤 ${target.username}`, sx, sy - 34);
    ctx.restore();
  }

  update(dt, ctx, cam) {
    this._glowTime = (this._glowTime || 0) + dt;

    if (this._invulnerableTimer > 0) {
      this._invulnerableTimer -= dt;
      if (this._invulnerableTimer <= 0) this._invulnerableTimer = 0;
    }

    // ── تحديث إطار الأنيميشن ──
    this._spriteFrameTimer += dt;
    if (this._spriteFrameTimer >= this._spriteFrameInterval) {
      this._spriteFrameTimer -= this._spriteFrameInterval;
      this._spriteFrame = (this._spriteFrame + 1) % 4;
    }

    this.updateLeader(dt);
    this.updateArmy(dt);
    this.updateMonstersAI(dt);
    this.updateOtherPlayers(dt);
    this.updateProjectiles(dt);
    this.updateFx(dt);
    this.updateSandParticles(dt);
    this.updatePvPParticles(dt);
    this.checkCombatProximity();
    this.updatePvPCombat(dt);
    this._updateComboTimer(dt);
    this._updatePoisonEffects(dt);

    // ── تحديث قدرات الأسلحة + تطبيق DOT على الوحوش ──
    if (this._weaponAbilities) {
      this._weaponAbilities.update(dt);
      // تطبيق الضرر المستمر (DOT) على الوحوش
      for (const m of this.monsters) {
        if (!m.alive) continue;
        const dotDmg = this._weaponAbilities.getDotDamage(m.id);
        if (dotDmg > 0) {
          m.hp -= dotDmg;
          this.worldFx.push({ x: m.x, y: m.y - 10, text: `-${Math.floor(dotDmg)}`, color: "#af52de", life: 0.5, maxLife: 0.5 });
          if (m.hp <= 0) {
            m.hp = 0;
            m.alive = false;
            m.respawnTimer = 25;
            if (this._onMonsterKilled) this._onMonsterKilled();
            if (this._activeMode) this._activeMode.onMonsterKilled(m);
            this.sessionStats.kills++;
            this.createDrop(m.x, m.y, m.rewardMoney ?? 10, m.rewardGold ?? 5);
            this.worldFx.push({ x: m.x, y: m.y, text: `💀 ${m.name}`, color: "#FFD700", life: 1.5, maxLife: 1.5 });
          }
        }
        // تطبيق التأثيرات (stun/slow) على الوحوش
        const mods = this._weaponAbilities.getDamageModifiers(m.id);
        if (mods.stunned) {
          m._stunTimer = (m._stunTimer || 0) + dt;
        }
        if (mods.speedMultiplier < 1) {
          m._slowMult = mods.speedMultiplier;
        } else {
          m._slowMult = 1;
        }
      }
    }

    // تحديث timers القدرات
    if (this._sandstormTimer > 0) {
      this._sandstormTimer -= dt;
      if (this._sandstormTimer <= 0) this._sandstormActive = false;
    }
    if (this._stompSlowTimer > 0) this._stompSlowTimer -= dt;

    // تحديث enrage timer للزعماء
    for (const m of this.monsters) {
      if (m.isBoss && m.alive) {
        const bossConfig = getBossPhaseConfig(m.enemyId || "");
        if (bossConfig) updateBossEnrage(this, m, bossConfig, dt);
      }
      if (m._summoned && m._lifetime !== undefined) {
        m._lifetime -= dt;
        if (m._lifetime <= 0) {
          m.alive = false;
          this.worldFx.push({ x: m.x, y: m.y, text: "💨 تلاشى!", color: "#888", life: 1, maxLife: 1 });
        }
      }
    }

    // تحديث telegraphs
    if (this._telegraphs) {
      for (let i = this._telegraphs.length - 1; i >= 0; i--) {
        this._telegraphs[i].life -= dt;
        if (this._telegraphs[i].life <= 0) this._telegraphs.splice(i, 1);
      }
    }

    this.checkWipe();
    // 🎁 إعادة ظهور صناديق الكنز بعد فتحها
    for (const c of this.treasureChests) {
      if (c.opened) {
        c.respawnTimer -= dt;
        if (c.respawnTimer <= 0) {
          c.opened = false;
          // اختيار موقع جديد عشوائي
          let nx, ny;
          do {
            nx = 150 + Math.random() * (this.W - 300);
            ny = 150 + Math.random() * (this.H - 300);
          } while (this.isInSafeZone(nx, ny));
          c.x = nx;
          c.y = ny;
          const levelScale = 1 + ((this.economy?.level || 1) - 1) * 0.15;
          c.reward = {
            artifacts: Math.max(1, Math.floor((1 + Math.random() * 3) * levelScale)),
            cash: Math.floor((50 + Math.random() * 200) * levelScale),
            gold: Math.floor((10 + Math.random() * 50) * levelScale),
            desertGem: Math.random() < 0.15 ? 1 : 0,
          };
        }
      }
    }
    if (this.mode === "battle_royale") this.updateBR(dt);
    if (this._activeMode) this._activeMode.update(dt);

    // 🛡️ منع الكاميرا من الخروج عن حدود الخريطة الحالية إلى فراغ (تختلف الحدود حسب النمط)
    if (typeof cam.clamp === "function") cam.clamp(this.W, this.H);

    ctx.save();
    ctx.translate(-cam.x, -cam.y);

    // ── رسم الأرضية (isometric tiles أو flat) ──
    if (this._activeMode && this._activeMode.modeName === "cave") {
      this._activeMode.drawBackground(ctx);
    } else if (this._isometricEnabled && this._iso._generated) {
      this._iso.drawTiles(ctx);
    } else if (this.mapImage) {
      ctx.drawImage(this.mapImage, 0, 0, this.W, this.H);
    } else {
      ctx.fillStyle = "#c2a06e";
      ctx.fillRect(0, 0, this.W, this.H);
    }

    this.drawSandParticles(ctx);
    this.drawMapObstacles(ctx);
    this.drawPathLine(ctx, cam);
    this.drawBRZone(ctx);

    // ── رسم الكائنات مع Depth Sorting ──
    this._drawEntitiesSorted(ctx);

    this.drawPvPParticles(ctx);
    if (this._activeMode && this._activeMode.modeName === "cave") {
      this._activeMode.drawDarkness(ctx);
    }
    this._drawTelegraphs(ctx);
    this.drawWorldFx(ctx);
    // 🗺️ الخريطة المصغّرة الآن عنصر DOM واحد فقط (#mini-map) بدل نسختين متزاحمتين

    ctx.restore();

    this.drawArmyHUD(dt, ctx);
    this.drawPvPMenu(ctx, cam);
    // 🛡️ واجهة BR (المؤقت/اللاعبون/القتلى) عنصر DOM واحد فقط (#br-timer/#br-players/#br-kills) — لا نسخة مكررة على الـ canvas
    if (this._activeMode) this._activeMode.drawUI(ctx);
  }

  _drawTelegraphs(ctx) {
    if (!this._telegraphs || this._telegraphs.length === 0) return;
    ctx.save();
    for (const t of this._telegraphs) {
      const alpha = Math.min(1, t.life / (t.maxLife || 1));
      ctx.globalAlpha = alpha * 0.35;
      if (t.w && t.h) {
        ctx.fillStyle = t.color || "#ff444466";
        ctx.fillRect(t.x, t.y, t.w, t.h);
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.globalAlpha = alpha * 0.7;
        ctx.strokeRect(t.x, t.y, t.w, t.h);
      } else if (t.radius) {
        ctx.beginPath();
        ctx.arc(t.x, t.y, t.radius, 0, Math.PI * 2);
        ctx.fillStyle = t.color || "#ff444466";
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.globalAlpha = alpha * 0.7;
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  /**
   * رسم جميع الكائنات مع ترتيب العمق (2.5D depth sorting).
   * الكائنات التي يبلغ عمقها (x+y) أقل تُرسم أولاً (خلف).
   */
  /**
   * 🖼️ حجب الكيانات خارج نطاق رؤية الكاميرا (Frustum Culling) — شبكة أمان أداء
   * تستخدم camera.visible() الموجودة أصلاً في المحرك، بلا أي تغيير بصري.
   */
  _isEntityVisible(x, y, margin = 150) {
    const visible = this.engine?.camera?.visible;
    if (typeof visible !== "function") return true; // بيئة بلا كاميرا (اختبارات مثلاً) — لا حجب
    return visible(x, y, margin);
  }

  _drawEntitiesSorted(ctx) {
    const ds = this._depthSorter;
    ds.clear();

    // إضافة الوحوش
    for (const m of this.monsters) {
      if (!m.alive) continue;
      if (!this._isEntityVisible(m.x, m.y, m.radius + 60)) continue;
      ds.add(m.x, m.y, (c) => this._drawMonsterEntity(c, m));
    }

    // إضافة الـ drops
    for (const d of this.drops) {
      if (d.collected) continue;
      if (!this._isEntityVisible(d.x, d.y)) continue;
      ds.add(d.x, d.y, (c) => this._drawDropEntity(c, d));
    }

    // 🎁 إضافة صناديق الكنز
    for (const c of this.treasureChests) {
      if (c.opened) continue;
      if (!this._isEntityVisible(c.x, c.y)) continue;
      ds.add(c.x, c.y, (c2) => this._drawTreasureChestEntity(c2, c));
    }

    // إضافة الجنود
    for (const u of this.armyUnits) {
      if (!this._isEntityVisible(u.x, u.y, u.radius + 60)) continue;
      ds.add(u.x, u.y, (c) => this._drawArmyEntity(c, u));
    }

    // إضافة اللاعبين الآخرين
    for (const [, p] of this.otherPlayers) {
      if (!this._isEntityVisible(p.x, p.y, (p.radius || 20) + 100)) continue;
      ds.add(p.x, p.y, (c) => this._drawOtherPlayerEntity(c, p));
    }

    // إضافة قطاع الطرق (BR)
    if (this.mode === "battle_royale") {
      for (const b of this.bandits) {
        if (!b.alive) continue;
        if (!this._isEntityVisible(b.x, b.y, 80)) continue;
        ds.add(b.x, b.y, (c) => this._drawBanditEntity(c, b));
      }
    }

    // إضافة القائد (دائماً في الأعلى — بلا حجب، يبقى ظاهراً دوماً)
    ds.add(this.leader.x, this.leader.y + 1000, (c) => this.drawHero(c));

    ds.drawAll(ctx);
  }

  /**
   * 🎬 يحدّد حالة حركة الكيان (وقوف/مشي/هجوم) اعتماداً على معطيات موجودة أصلاً —
   * بلا حاجة لتتبّع حالة جديدة معقّدة. يُستخدم مع كل استدعاءات spriteFactory.draw.
   */
  _getAnimState(entity, isFighting) {
    if (isFighting) return "attack";
    const px = entity._animPrevX, py = entity._animPrevY;
    entity._animPrevX = entity.x;
    entity._animPrevY = entity.y;
    if (px === undefined) return "idle";
    const moved = Math.hypot(entity.x - px, entity.y - py) > 0.15;
    return moved ? "walk" : "idle";
  }

  /**
   * رسم وحش واحد
   */
  _drawMonsterEntity(ctx, m) {
    const useSprites = this._isometricEnabled && spriteFactory.isReady;
    const dir = SpriteFactory.vectorToDirection(
      m._chaseTarget ? m._chaseTarget.x - m.x : (m._patrolTarget ? m._patrolTarget.x - m.x : 0),
      m._chaseTarget ? m._chaseTarget.y - m.y : (m._patrolTarget ? m._patrolTarget.y - m.y : 0)
    );

    ctx.save();
    ctx.translate(m.x, m.y);

    // ظل
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath();
    ctx.ellipse(0, m.radius * 0.5, m.radius * 0.7, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // رسم الشخصية
    if (useSprites) {
      const flipX = m.facing < 0;
      const spriteType = m.imageKey === "monster-1" ? "wolf" :
                          m.imageKey === "monster-2" ? "shadow" : "sandlord";
      const isAttacking = !!(m._chaseTarget && Math.hypot(m.x - m._chaseTarget.x, m.y - m._chaseTarget.y) < 30);
      const animState = this._getAnimState(m, isAttacking);
      spriteFactory.draw(ctx, spriteType, 0, 0, dir, animState, this._spriteFrame, 1.2, flipX);
    } else {
      ctx.scale(m.facing || 1, 1);
      this._drawSprite(ctx, m.imageKey, m.color, m.radius);
      ctx.scale(1 / (m.facing || 1), 1);
    }

    // HP bar
    const hp = m.hp / m.maxHp;
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(-m.radius, -m.radius - 12, m.radius * 2, 4);
    ctx.fillStyle = hp > 0.5 ? "#4cd964" : "#ff4444";
    ctx.fillRect(-m.radius, -m.radius - 12, m.radius * 2 * hp, 4);

    // Name
    ctx.fillStyle = "#fff";
    ctx.font = "bold 11px Cairo, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(m.name, 0, -m.radius - 18);

    ctx.restore();
  }

  /**
   * رسم جندي واحد
   */
  _drawArmyEntity(ctx, u) {
    const useSprites = this._isometricEnabled && spriteFactory.isReady;

    ctx.save();
    ctx.translate(u.x, u.y);

    // ظل
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath();
    ctx.ellipse(0, u.radius * 0.6, u.radius * 0.7, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    if (useSprites) {
      const dir = SpriteFactory.vectorToDirection(
        u.fighting ? (u.fighting.x - u.x) : 0,
        u.fighting ? (u.fighting.y - u.y) : 0
      );
      const animState = this._getAnimState(u, !!u.fighting);
      spriteFactory.draw(ctx, "soldier", 0, 0, dir, animState, this._spriteFrame, 1, u.facing < 0);
    } else {
      ctx.scale(u.facing || 1, 1);
      this._drawSprite(ctx, "soldier-player", "#3d2b1f", u.radius);
      ctx.scale(1 / (u.facing || 1), 1);
    }

    // HP bar
    const hp = u.hp / u.maxHp;
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(-u.radius, -u.radius - 10, u.radius * 2, 3);
    ctx.fillStyle = hp > 0.5 ? "#4cd964" : "#ffaa00";
    ctx.fillRect(-u.radius, -u.radius - 10, u.radius * 2 * hp, 3);

    ctx.restore();
  }

  /**
   * رسم لاعب آخر
   */
  _drawOtherPlayerEntity(ctx, p) {
    const useSprites = this._isometricEnabled && spriteFactory.isReady;
    // 🎬 نحسب حالة الحركة مرة واحدة للاعب الآخر ونشاركها مع جنوده الشبحيين
    // (يتحركون معاً أصلاً)، لتفادي تضارب تتبّع "آخر موضع" عند استدعائها مرتين
    const animState = this._getAnimState(p, false);

    // جيش اللاعب الآخر
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
      if (useSprites) {
        spriteFactory.draw(ctx, "soldier", 0, 0, "S", animState, this._spriteFrame, 0.7, p.facing < 0);
      } else {
        ctx.scale(p.facing || 1, 1);
        this._drawSprite(ctx, "soldier-enemy", p.color + "99", 8);
      }
      ctx.restore();
    }

    ctx.save();
    ctx.translate(p.x, p.y);

    // ظل
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath();
    ctx.ellipse(0, p.radius * 0.5, p.radius * 0.7, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    if (useSprites) {
      spriteFactory.draw(ctx, "leader", 0, 0, p.facing >= 0 ? "E" : "W", animState, this._spriteFrame, 1, p.facing < 0);
    } else {
      ctx.scale(p.facing || 1, 1);
      this._drawSprite(ctx, "leader-enemy", p.color, p.radius);
    }

    ctx.restore();

    // الاسم
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 11px Cairo, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(p.username, 0, -p.radius - 10);
    ctx.restore();

    // HP bar
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

    // Power display
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

    // Weapon glow
    const wStar = p.weaponStarLevel || 1;
    if (wStar >= 2) {
      drawWeaponGlow(ctx, p.x, p.y, wStar, p.radius, this._glowTime || 0);
    }
    if (wStar >= 1) {
      drawWeaponStarIcons(ctx, p.x, p.y - p.radius - 44, wStar, 8);
    }
  }

  /**
   * رسم قاطع طريق (BR)
   */
  _drawBanditEntity(ctx, b) {
    const useSprites = this._isometricEnabled && spriteFactory.isReady;

    ctx.save();
    ctx.translate(b.x, b.y);

    ctx.fillStyle = "rgba(0,0,0,0.2)";
    ctx.beginPath();
    ctx.ellipse(0, 12, 16, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    if (useSprites) {
      const animState = this._getAnimState(b, false);
      spriteFactory.draw(ctx, "bandit", 0, 0, "S", animState, this._spriteFrame, 1, b.facing < 0);
    } else {
      ctx.scale(b.facing || 1, 1);
      const banditImg = this.images.get("bandit-br");
      if (banditImg) {
        ctx.drawImage(banditImg, -14, -20, 28, 40);
      } else {
        ctx.fillStyle = "#4a4a3a";
        ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#8a7a5a";
        ctx.beginPath(); ctx.arc(0, -14, 7, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#222";
        ctx.fillRect(-8, -16, 16, 3);
        ctx.strokeStyle = "#666"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(15, -2); ctx.lineTo(25, -12); ctx.stroke();
      }
    }

    // HP bar
    const hpPct = b.hp / b.maxHp;
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(-14, -22, 28, 3);
    ctx.fillStyle = "#ff6600";
    ctx.fillRect(-14, -22, 28 * hpPct, 3);
    ctx.restore();
  }

  /**
   * رسم صندوق كنز 🎁
   */
  _drawTreasureChestEntity(ctx, c) {
    const time = Date.now() * 0.003;
    const bobY = Math.sin(time + c.x * 0.01) * 3;
    const pulse = Math.sin(time * 1.5) * 0.15 + 0.85;

    ctx.save();
    ctx.translate(c.x, c.y + bobY);

    // 🟤 توهج ذهبي خلف الصندوق
    ctx.shadowColor = "#ffd700";
    ctx.shadowBlur = 18 * pulse;

    // جسم الصندوق
    ctx.fillStyle = "#8B4513";
    ctx.beginPath();
    ctx.roundRect(-12, -10, 24, 18, 3);
    ctx.fill();

    // غطاء الصندوق
    ctx.fillStyle = "#A0522D";
    ctx.beginPath();
    ctx.roundRect(-13, -12, 26, 6, 2);
    ctx.fill();

    // إبزيم ذهبي
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#FFD700";
    ctx.beginPath();
    ctx.arc(0, -2, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#DAA520";
    ctx.beginPath();
    ctx.arc(0, -2, 2, 0, Math.PI * 2);
    ctx.fill();

    // علامة استفهام فوق الصندوق
    ctx.fillStyle = "rgba(255,215,0," + (0.5 + Math.sin(time * 2) * 0.3) + ")";
    ctx.font = "bold 12px Cairo, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText("❓", 0, -14);

    ctx.restore();
  }

  /**
   * رسم drop
   */
  _drawDropEntity(ctx, d) {
    ctx.save();
    ctx.translate(d.x, d.y);

    // Glow effect
    ctx.shadowColor = "#f1c40f";
    ctx.shadowBlur = 8;
    ctx.fillStyle = d.gold > 0 ? "#FFD700" : "#f1c40f";
    ctx.beginPath();
    const bobY = Math.sin(Date.now() * 0.003 + d.x) * 2;
    ctx.arc(0, bobY - 4, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Inner highlight
    ctx.fillStyle = "#fff8dc";
    ctx.beginPath();
    ctx.arc(-2, bobY - 6, 3, 0, Math.PI * 2);
    ctx.fill();

    // Label
    ctx.fillStyle = "#fff";
    ctx.font = "bold 10px Cairo";
    ctx.textAlign = "center";
    if (d.gold > 0 && d.money <= 0) {
      ctx.fillText("🪙", 0, -14);
    } else if (d.gold > 0) {
      ctx.fillText("+" + d.money + " 💵🪙", 0, -14);
    } else {
      ctx.fillText("+" + d.money, 0, -14);
    }
    ctx.restore();
  }

  updatePvPCombat(dt) {
    if (this._pvpResultSent) return;
    const target = this._pvpAttackTarget;
    if (!target) return;

    // درع المبتدئين — حماية من PvP لأول دقيقتين
    if (this._newbieShieldTimer > 0) {
      this._newbieShieldTimer -= dt;
      if (this._newbieShieldTimer > 0) {
        this.worldFx.push({ x: this.leader.x, y: this.leader.y - 30, text: "🛡️ أنت محمي!", color: "#4a90d9", life: 0.3, maxLife: 0.3 });
        this._pvpResultSent = true;
        this._isPvPEngaged = false;
        this._pvpAttackTarget = null;
        if (this.store) this.store.set('notification', { text: "🛡️ درع المبتدئين يحميك! عد بعد دقيقتين.", t: Date.now() });
        return;
      }
    }

    const dist = Math.hypot(this.leader.x - target.x, this.leader.y - target.y);
    const inRange = dist <= this.engagementRadius;

    // ── Engagement check ──
    if (inRange) {
      this._isPvPEngaged = true;
    }

    if (!this._isPvPEngaged) return;

    // ── Escape detection (check ALL units every 0.5s) ──
    this._pvpEscapeCheckTimer += dt;
    if (this._pvpEscapeCheckTimer >= 0.5) {
      this._pvpEscapeCheckTimer = 0;
      if (this._checkPvPEscape(target)) {
        this._onPvPEscape(target);
        return;
      }
    }

    // ── Particles ──
    this.spawnPvPParticles(
      (this.leader.x + target.x) / 2 + (Math.random() - 0.5) * 30,
      (this.leader.y + target.y) / 2 + (Math.random() - 0.5) * 30
    );

    // ── Damage tick ──
    this._pvpDamageCD -= dt;
    if (this._pvpDamageCD <= 0) {
      this._pvpDamageCD = this._pvpDamageInterval;

      const myStats = this.computePvPStats();
      const enemyStats = this.estimateEnemyStats(target);
      const crit = this._rollCrit();

      const myDmg = computePvPDamage(myStats.totalDamage, crit, myStats.weaponStats.weaponDamage);
      const theirDmg = enemyStats.damage;

      target._hp = (target._hp ?? enemyStats.maxHp) - myDmg;
      this.damageHero(theirDmg * 0.6);

      if (target._hp <= 0) target._hp = 0;
      if (this.leader.hp <= 0) this.leader.hp = 0;

      // تأثيرات مرئية
      const midX = (this.leader.x + target.x) / 2;
      const midY = (this.leader.y + target.y) / 2 - 20;
      spawnHitEffect(this, midX, midY, crit.isCrit, this._equippedWeapon);
      if (this.engine) {
        this.engine.shake(crit.isCrit ? 8 : 3, 0.08);
      }

      const dmgText = crit.isCrit ? `💥 CRIT ${myDmg}!` : `-${myDmg}`;
      this.worldFx.push({
        x: midX,
        y: midY,
        text: dmgText,
        color: crit.isCrit ? "#ffd700" : "#ff6b35",
        life: 0.8, maxLife: 0.8
      });

      if (this.leader.hp <= 0 || target._hp <= 0) {
        this._pvpResultSent = true;
        this.resolvePvP(target, target._hp <= 0);
        return;
      }
    }
  }

  _checkPvPEscape(target) {
    if (!target) return true;
    const leaderIn = Math.hypot(this.leader.x - target.x, this.leader.y - target.y) <= this.engagementRadius;
    if (leaderIn) return false;
    for (const u of this.armyUnits) {
      if (u.hp > 0 && Math.hypot(u.x - target.x, u.y - target.y) <= this.engagementRadius) {
        return false;
      }
    }
    return true;
  }

  _onPvPEscape(target) {
    this._isPvPEngaged = false;
    this._pvpAttackTarget = null;
    this._pvpFledTarget = target;
    this._pvpDamageCD = 0;

    this.leader.path = null;
    this.leader.fighting = null;
    this.armyUnits.forEach(u => { u.fighting = null; });

    this.worldFx.push({
      x: this.leader.x, y: this.leader.y,
      text: "🛑 انسحاب! الجيش في الانتظار",
      color: "#ffaa00",
      life: 1.5, maxLife: 1.5
    });

    if (this.store) {
      this.store.set('notification', {
        text: `🛑 انسحبت من المعركة ضد ${target.username} — اضغط عليه للمطاردة`,
        t: Date.now()
      });
    }
  }

  updateSandParticles(dt) {
    for (const p of this.sandParticles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.x < 0 || p.x > this.W) p.vx *= -1;
      if (p.y < 0 || p.y > this.H) p.vy *= -1;
    }
  }

  /**
   * 🪨 يخزّن شكل كل صخرة (الظل + التدرّج + بقع التظليل) في canvas صغير مرة واحدة
   * بدل إعادة إنشاء التدرّجات وإعادة الرسم كل فريم — نفس أسلوب تخزين الـ sprites.
   */
  _prerenderObstacleSprites() {
    if (!this.MAP_OBSTACLES) { this._obstacleSprites = []; return; }
    this._obstacleSprites = this.MAP_OBSTACLES.map((rock) => {
      const { r } = rock;
      const size = Math.ceil(r * 2.4);
      const cx = size / 2, cy = size / 2;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");

      // ظل أسفل الصخرة
      ctx.fillStyle = "rgba(0,0,0,0.18)";
      ctx.beginPath();
      ctx.ellipse(cx, cy + r * 0.55, r * 0.9, r * 0.32, 0, 0, Math.PI * 2);
      ctx.fill();

      const grad = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.1, cx, cy, r);
      grad.addColorStop(0, "#a8998a");
      grad.addColorStop(0.55, "#8a7a6a");
      grad.addColorStop(1, "#5c4d3f");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(cx, cy, r * 0.85, r * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();

      // بقع تظليل بسيطة لإحساس صخري خشن
      ctx.fillStyle = "rgba(0,0,0,0.12)";
      ctx.beginPath();
      ctx.ellipse(cx + r * 0.25, cy + r * 0.1, r * 0.3, r * 0.18, 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.10)";
      ctx.beginPath();
      ctx.ellipse(cx - r * 0.28, cy - r * 0.25, r * 0.22, r * 0.14, -0.3, 0, Math.PI * 2);
      ctx.fill();

      return { canvas, offsetX: cx, offsetY: cy };
    });
  }

  /** 🪨 رسم صخور/عوائق الخريطة كمعالم بصرية تطابق مناطق التصادم الفعلية (this.MAP_OBSTACLES) */
  drawMapObstacles(ctx) {
    if (!this.MAP_OBSTACLES) return;
    if (!this._obstacleSprites) this._prerenderObstacleSprites();
    for (let i = 0; i < this.MAP_OBSTACLES.length; i++) {
      const rock = this.MAP_OBSTACLES[i];
      const sprite = this._obstacleSprites[i];
      if (!sprite) continue;
      ctx.drawImage(sprite.canvas, rock.x - sprite.offsetX, rock.y - sprite.offsetY);
    }
  }

  drawSandParticles(ctx) {
    ctx.save();
    for (const p of this.sandParticles) {
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = "#d4a76a";
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // ==================== PvP Combat Particles ====================

  spawnPvPParticles(x, y) {
    spawnPvPParticles(this, x, y);
  }

  updatePvPParticles(dt) {
    updatePvPParticles(this, dt);
  }

  drawPvPParticles(ctx) {
    drawPvPParticles(this, ctx);
  }

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