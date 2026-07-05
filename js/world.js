import { GameEngine } from "./engine.js";
import {
  aStar,
  initCollisionGrid,
  markObstacle,
  isWalkable,
  findNearestWalkable,
  simplifyPath,
  worldPos
} from "./pathfinding.js";
import { drawPathLine, spawnPvPParticles, updatePvPParticles, drawPvPParticles } from "./combat/combat-effects.js";
import { showPvPMenu, hidePvPMenu, showPvPDefeat, showWipeScreen } from "./ui/context-menu.js";
import { computeWeaponDamage, getWeaponDef } from "./combat/weapon-system.js";
import { computeKnowledgeBonuses } from "./combat/knowledge-system.js";
import { getVisualTroopCount, getTroopFormation } from "./combat/troop-visuals.js";
import { drawWeaponGlow, drawWeaponStarIcons } from "./combat/weapon-visuals.js";
import { spriteFactory, SpriteFactory, DIRECTIONS, DIR_ANGLES } from "./sprite-factory.js";
import { IsometricSystem, DepthSorter, TILE_W, TILE_H } from "./isometric.js";
import { getEnemyForLevel, getEnemiesForVillage, getBossForVillage, calculateEnemyPower } from "./enemies.js";

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

    // ==================== الملتيكاملة (WebSocket عبر NetworkSync) ====================
    this.netSync = null; // يُضبط من main.js بعد الإنشاء
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
    this._equippedWeapon = "";
    this._weaponStarLevel = 1;
    this._weaponGemLevel = 1;
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
    this.miniMapSize = 100;
    this.miniMapMargin = 8;

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
    this._onBRKillFeed = null;
    this._onCashEarned = null;
    this._events = null; // مرجع لـ EventManager
    this._onPvPWin = null;
    this._onPvPLose = null;
    this._onPvPReturn = null;
    this._onDropCollected = null;
    this._onSelfStatsChanged = null;
  }

  _preloadImages() {
    const keys = [
      "leader-player", "avatar-player", "soldier-player",
      "leader-enemy", "soldier-enemy", "bandit-br",
      "monster-1", "monster-2", "monster-3",
    ];
    for (const key of keys) {
      const img = new Image();
      img.onload = () => this.images.set(key, img);
      img.onerror = () => {}; // silent → fallback shapes
      img.src = ImageResolver ? ImageResolver.src(key) : ("assets/images/" + key + ".png");
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
    const theirMaxHp = tgt.maxHp || 120;
    const theirCurHp = Math.max(0, tgt._hp ?? theirMaxHp);

    const myEffective = Math.floor(myPower * Math.max(0, myCurHp / myMaxHp));
    const theirEffective = Math.floor(theirPower * Math.max(0, theirCurHp / theirMaxHp));

    const myStats = this.computePvPStats();
    const enemyStats = this.estimateEnemyStats(tgt);
    const lootBase = Math.max(10, Math.floor(theirPower * 0.08));
    const lootAmount = Math.min(this.sessionStats.coinsEarned || 0, lootBase);

    if (won) {
      let reward = Math.max(10, Math.floor(theirPower * 0.05));
      let goldReward = Math.floor(reward * 0.2);
      if (this._events) {
        const pvpMult = this._events.getMult("mult_pvp");
        if (pvpMult > 1) { reward = Math.floor(reward * pvpMult); goldReward = Math.floor(goldReward * pvpMult); }
      }

      const stolenLoot = Math.min(lootBase, tgt._sessionCoins || 0);
      if (this.economy) {
        this.economy.addRaw("cash", reward + stolenLoot);
        this.economy.addRaw("gold", goldReward);
      }

      this.worldFx.push({
        x: this.leader.x, y: this.leader.y,
        text: `⚔️ انتصرت على ${tgt.username}! +${reward + stolenLoot} 💵 +${goldReward} 🪙`,
        color: "#4cd964", life: 2.5, maxLife: 2.5
      });
      if (this.store) {
        this.store.set('notification', {
          text: `⚔️ انتصرت على ${tgt.username}! +${reward + stolenLoot} 💵`,
          t: Date.now()
        });
      }
      if (this._onPvPWin) this._onPvPWin();
      this.sessionStats.pvpWins++;
    } else {
      this.worldFx.push({
        x: this.leader.x, y: this.leader.y,
        text: `💥 هُزمت أمام ${tgt.username}!`,
        color: "#ff4444", life: 2.5, maxLife: 2.5
      });
      this.leader.hp = 0;

      const actualLoot = Math.min(lootBase, this.sessionStats.coinsEarned || 0);
      if (actualLoot > 0) {
        if (this.economy) this.economy.addRaw("cash", -actualLoot);
        this.sessionStats.coinsEarned -= actualLoot;
      }

      const newPower = Math.max(500, Math.floor(myPower * 0.9));
      if (this.economy) this.economy.power = newPower;

      this._pvpDefeatShown = true;
      this._showPvPDefeat(
        tgt.username,
        theirPower,
        actualLoot,
        Math.floor(myPower * 0.1),
        enemyStats.maxHp,
        enemyStats.damage
      );
      if (this._onPvPLose) this._onPvPLose();
    }

    if (this.netSync) {
      this.netSync.send({
        type: "pvp_result",
        target: tgt.username,
        won,
        myPower: myEffective,
        loot: won ? 0 : lootAmount,
        winnerReward: won ? Math.max(10, Math.floor(theirPower * 0.05)) : 0,
      });
    }

    const newArmyPower = this.economy ? Math.max(500, Math.floor((this.economy.power || 5000))) : 5000;
    try {
      fetch(`${this.apiBase}/api/players/${encodeURIComponent(this.username)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
    const trainingLevel = e?.trainingLevel || 1;
    const prestigeLevel = e?.prestigeLevel || 0;
    const armyPower = e?.power || 5000;
    const armyYardLevel = e?.armyYardLevel || 1;

    const baseHP = 120;
    const baseDMG = 12;

    const armyYardHpBonus = armyYardLevel * 6;
    const maxHp = baseHP
      + playerLevel * 2
      + unitLevel * 3
      + trainingLevel * 2
      + prestigeLevel * 5
      + armyYardHpBonus;

    const weaponStats = computeWeaponDamage({
      equippedWeapon: this._equippedWeapon || "",
      weapons: this.army?.weapons || [],
    });

    let totalDamage = baseDMG
      + Math.floor(armyPower / 10)
      + playerLevel
      + unitLevel * 2
      + prestigeLevel * 3
      + weaponStats.weaponDamage;

    if (this._upgradeTree) {
      totalDamage += this._upgradeTree.getEffect("army") || 0;
    }
    if (this._allianceManager) {
      totalDamage += this._allianceManager.damageBonus || 0;
    }

    const knowledgeBonuses = computeKnowledgeBonuses({
      knowledgeLevel: e?.knowledgeLevel || 1,
      knowledgeType: e?.knowledgeType || "economic",
    });

    const defenseBuffPercent = knowledgeBonuses.defensePercent;
    const moveSpeedBuffPercent = knowledgeBonuses.moveSpeedPercent;

    return { maxHp, totalDamage, weaponStats, defenseBuffPercent, moveSpeedBuffPercent };
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
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const dist = 20 + Math.random() * 25;
      this.armyUnits.push({
        x: this.leader.x + Math.cos(a) * dist,
        y: this.leader.y + Math.sin(a) * dist,
        speed: 135 + Math.random() * 10,
        radius: 10,
        hp: 40,
        maxHp: 40,
        baseDmg: 5,
        dmgBonus: 0,
        defBonus: 0,
        attackCD: 0,
        path: null,
        pathIdx: 0,
        fighting: null,
        facing: 1
      });
    }
  }

  start() {
    if (this.running) return;
    this.running = true;

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

    // عوائق الصحراء
    markObstacle(420, 380, 95);
    markObstacle(780, 520, 70);
    markObstacle(1150, 290, 110);
    markObstacle(1420, 680, 85);
    markObstacle(1680, 410, 65);
    markObstacle(1950, 850, 120);
    markObstacle(620, 920, 75);
    markObstacle(980, 1150, 90);
    markObstacle(1350, 1320, 55);
    markObstacle(1720, 1080, 100);
    markObstacle(2100, 1450, 80);
    markObstacle(450, 1550, 70);
    markObstacle(890, 1680, 95);
    markObstacle(1280, 1820, 65);
    markObstacle(1600, 1590, 85);

    // مصفوفة عوائق الصخور الظاهرة في الخريطة
    this.MAP_OBSTACLES = [
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

    this.spawnMonsters();

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

  // ==================== الوحوش ====================
  spawnMonsters() {
    // لا نعيد توليد الوحوش في وضع الحملة أو إذا وصلت وحوش السيرفر
    if (this._campaignMode || this._monstersSynced) return;
    this.monsters = [];
    for (let i = 0; i < 12; i++) {
      let x, y;
      do {
        x = 150 + Math.random() * (this.W - 300);
        y = 150 + Math.random() * (this.H - 300);
      } while (this.isInSafeZone(x, y));
      this.monsters.push(this.createMonster(i, x, y));
    }
  }

  spawnCampaignMonsters(villageId, includeBoss = false) {
    this.monsters = [];
    const enemies = getEnemiesForVillage(villageId);
    const count = 6 + Math.floor(Math.random() * 4); // 6-9 enemies
    for (let i = 0; i < count; i++) {
      let x, y;
      do {
        x = 200 + Math.random() * (this.W - 400);
        y = 200 + Math.random() * (this.H - 400);
      } while (this.isInSafeZone(x, y));
      const enemy = enemies[Math.floor(Math.random() * enemies.length)];
      this.monsters.push(this.createMonster(i, x, y, enemy));
    }
    if (includeBoss) {
      const boss = getBossForVillage(villageId);
      if (boss) {
        let x, y;
        do {
          x = this.W / 2 + (Math.random() - 0.5) * 400;
          y = this.H / 2 + (Math.random() - 0.5) * 400;
        } while (this.isInSafeZone(x, y));
        this.monsters.push(this.createMonster('boss', x, y, boss));
      }
    }
  }

  createMonster(id, spawnX, spawnY, enemyOverride = null) {
    const playerLevel = this.economy?.level || 1;
    const enemy = enemyOverride || getEnemyForLevel(playerLevel);
    const scaled = calculateEnemyPower(enemy, playerLevel);
    return {
      id,
      enemyId: enemy.id,
      name: enemy.name,
      color: enemy.color,
      radius: enemy.radius,
      hp: scaled.hp,
      maxHp: scaled.hp,
      damage: scaled.damage,
      rewardMoney: scaled.reward.cash || 5,
      rewardGold: scaled.reward.gold || 1,
      imageKey: this._getMonsterImageKey(enemy.id),
      x: spawnX,
      y: spawnY,
      spawnX,
      spawnY,
      alive: true,
      facing: 1,
      attackCD: 0,
      respawnTimer: 0,
    };
  }

  _getMonsterImageKey(enemyId) {
    if (enemyId.includes("wolf") || enemyId.includes("scorpion") || enemyId.includes("thief")) return "monster-1";
    if (enemyId.includes("ghost") || enemyId.includes("shadow") || enemyId.includes("sorcerer")) return "monster-2";
    if (enemyId.includes("dragon") || enemyId.includes("boss") || enemyId.includes("eagle")) return "monster-3";
    return "monster-1";
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
    this.worldFx.push({ x: drop.x, y: drop.y, text: `+${drop.money} 💵`, color: "#FFD700", life: 0.8, maxLife: 0.8 });
    this.drops.splice(index, 1);
    if (this._onDropCollected) this._onDropCollected();
  }

  onTap(wx, wy) {
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
    this._hidePvPMenu();
    this._startPvPAttack(target);
  }

  _onPvPInspect() {
    const target = this._pvpTarget;
    if (!target) return;
    const popup = document.getElementById("pvp-inspect-popup");
    const nameEl = document.getElementById("pvp-inspect-name");
    const powerEl = document.getElementById("pvp-inspect-power");
    const killsEl = document.getElementById("pvp-inspect-kills");
    const coinsEl = document.getElementById("pvp-inspect-coins");
    if (popup && nameEl) {
      nameEl.textContent = target.username || "—";
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
    this._cancelPvPAttack();
    this._pvpDefeatShown = false;
    document.getElementById("pvp-defeat-modal")?.classList.add("hidden");
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
    this._showWipeScreen(lost, killed);
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
    this.checkWipe();
    if (this.mode === "battle_royale") this.updateBR(dt);

    ctx.save();
    ctx.translate(-cam.x, -cam.y);

    // ── رسم الأرضية (isometric tiles أو flat) ──
    if (this._isometricEnabled && this._iso._generated) {
      this._iso.drawTiles(ctx);
    } else if (this.mapImage) {
      ctx.drawImage(this.mapImage, 0, 0, this.W, this.H);
    } else {
      ctx.fillStyle = "#c2a06e";
      ctx.fillRect(0, 0, this.W, this.H);
    }

    this.drawSandParticles(ctx);
    this.drawPathLine(ctx, cam);
    this.drawBRZone(ctx);

    // ── رسم الكائنات مع Depth Sorting ──
    this._drawEntitiesSorted(ctx);

    this.drawPvPParticles(ctx);
    this.drawWorldFx(ctx, cam);
    this.drawMiniMap(ctx, cam);

    ctx.restore();

    this.drawArmyHUD(dt, ctx);
    this.drawPvPMenu(ctx, cam);
    this.drawBRUI(ctx, cam);
  }

  /**
   * رسم جميع الكائنات مع ترتيب العمق (2.5D depth sorting).
   * الكائنات التي يبلغ عمقها (x+y) أقل تُرسم أولاً (خلف).
   */
  _drawEntitiesSorted(ctx) {
    const ds = this._depthSorter;
    ds.clear();

    // إضافة الوحوش
    for (const m of this.monsters) {
      if (!m.alive) continue;
      ds.add(m.x, m.y, (c) => this._drawMonsterEntity(c, m));
    }

    // إضافة الـ drops
    for (const d of this.drops) {
      if (d.collected) continue;
      ds.add(d.x, d.y, (c) => this._drawDropEntity(c, d));
    }

    // إضافة الجنود
    for (const u of this.armyUnits) {
      ds.add(u.x, u.y, (c) => this._drawArmyEntity(c, u));
    }

    // إضافة اللاعبين الآخرين
    for (const [, p] of this.otherPlayers) {
      ds.add(p.x, p.y, (c) => this._drawOtherPlayerEntity(c, p));
    }

    // إضافة قطاع الطرق (BR)
    if (this.mode === "battle_royale") {
      for (const b of this.bandits) {
        if (!b.alive) continue;
        ds.add(b.x, b.y, (c) => this._drawBanditEntity(c, b));
      }
    }

    // إضافة القائد (دائماً في الأعلى)
    ds.add(this.leader.x, this.leader.y + 1000, (c) => this.drawHero(c));

    ds.drawAll(ctx);
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
      spriteFactory.draw(ctx, spriteType, 0, 0, dir, this._spriteFrame, 1.2, flipX);
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
      spriteFactory.draw(ctx, "soldier", 0, 0, dir, this._spriteFrame, 1, u.facing < 0);
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
        spriteFactory.draw(ctx, "soldier", 0, 0, "S", this._spriteFrame, 0.7, p.facing < 0);
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
      spriteFactory.draw(ctx, "leader", 0, 0, p.facing >= 0 ? "E" : "W", this._spriteFrame, 1, p.facing < 0);
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
      spriteFactory.draw(ctx, "bandit", 0, 0, "S", this._spriteFrame, 1, b.facing < 0);
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
   * رسم drop
   */
  _drawDropEntity(ctx, d) {
    ctx.save();
    ctx.translate(d.x, d.y);

    // Glow effect
    ctx.shadowColor = "#f1c40f";
    ctx.shadowBlur = 8;
    ctx.fillStyle = "#f1c40f";
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

    // Money text
    ctx.fillStyle = "#fff";
    ctx.font = "bold 10px Cairo";
    ctx.textAlign = "center";
    ctx.fillText("+" + d.money, 0, -14);
    ctx.restore();
  }

  updatePvPCombat(dt) {
    if (this._pvpResultSent) return;
    const target = this._pvpAttackTarget;
    if (!target) return;

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

      const myDmg = myStats.totalDamage;
      const theirDmg = enemyStats.damage;

      target._hp = (target._hp ?? enemyStats.maxHp) - myDmg;
      this.leader.hp -= theirDmg * 0.6;

      if (target._hp <= 0) target._hp = 0;
      if (this.leader.hp <= 0) this.leader.hp = 0;

      this.worldFx.push({
        x: (this.leader.x + target.x) / 2,
        y: (this.leader.y + target.y) / 2 - 20,
        text: `💥 -${myDmg}`,
        color: "#ff6b35",
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
        h.x += (dx / dist) * h.speed * dt;
        h.y += (dy / dist) * h.speed * dt;
      } else {
        h.attackCD -= dt;
        if (h.attackCD <= 0) {
          const totalDmg = h.baseDmg + h.upgradeDmg;
          this.damageMonster(h.fighting, totalDmg);
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
      h.x += (dx / dist) * h.speed * dt;
      h.y += (dy / dist) * h.speed * dt;
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
      if (Math.hypot(d.x - this.leader.x, d.y - this.leader.y) < 40 || this.armyUnits.some(u => Math.hypot(d.x - u.x, d.y - u.y) < 30)) {
        this.collectDrop(i);
      }
    }
    const h = this.leader;
    const history = h._posHistory;
    const len = history.length;
    const time = Date.now();

    for (let i = 0; i < this.armyUnits.length; i++) {
      const unit = this.armyUnits[i];

      // ── اشتباك مع الوحوش (بدون تغيير) ──
      if (unit.fighting && unit.fighting.alive) {
        const dx = unit.fighting.x - unit.x;
        const dy = unit.fighting.y - unit.y;
        const dist = Math.hypot(dx, dy);

        if (dist > 25) {
          unit.facing = dx >= 0 ? 1 : -1;
          unit.x += (dx / dist) * unit.speed * dt;
          unit.y += (dy / dist) * unit.speed * dt;
        } else {
          unit.attackCD -= dt;
          if (unit.attackCD <= 0) {
            this.damageMonster(unit.fighting, unit.baseDmg + unit.dmgBonus);
            unit.attackCD = 0.6;
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

      // نطاق الرؤية (Chase range)
      const CHASE_RANGE = 300;

      if (minDist < CHASE_RANGE) {
        // ===== مطاردة سلسة (Chase) =====
        if (minDist < 30) {
          m.attackCD -= dt;
          if (m.attackCD <= 0) {
            if (target === this.leader) {
              this.damageHero(m.damage);
            } else {
              target.hp = Math.max(0, target.hp - m.damage);
            }
            m.attackCD = 1.2;
          }
          // تباطؤ تدريجي عند الاقتراب (حركة ناعمة حول الهدف)
          m._patrolTarget = null;
          m._idleTimer = 0;
        } else {
          // سير باتجاه الهدف مع سموث
          const speed = 35 + (300 - minDist) / 300 * 20; // أسرع كلما اقترب
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

  damageMonster(monster, dmg) {
    if (!monster || !monster.alive) return;
    monster.hp -= dmg;
    if (monster.hp <= 0) {
      if (this._onMonsterKilled) this._onMonsterKilled();
      monster.alive = false;
      monster.respawnTimer = 25;
      const reward = monster.rewardMoney || 10;
      const goldReward = monster.rewardGold || Math.floor(reward * 0.3);
      this.sessionStats.kills++;
      this.sessionStats.coinsEarned += reward;
      if (this.netSync) this.netSync.send({ type: "monster_killed", id: monster.id });
      this.createDrop(monster.x, monster.y, reward);
      if (this.economy) {
        this.economy.addRaw("cash", reward);
        this.economy.addRaw("gold", goldReward);
        if (this._onCashEarned) this._onCashEarned(reward);
        this.worldFx.push({ x: monster.x, y: monster.y, text: `+${reward} 💵 +${goldReward} 🪙`, color: "#FFD700", life: 1.5, maxLife: 1.5 });
        fetch(`${this.apiBase}/api/players/${encodeURIComponent(this.username)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cash: this.economy.cash,
            gems: this.economy.gems,
            gold: this.economy.gold,
            hammers: this.economy.hammers,
            scrolls: this.economy.scrolls,
            army_power: this.economy.power,
            unitLevel: this.army?.unitLevel || 1,
            weapons: this.army?.weapons?.map(w => ({ id: w.id, starLevel: w.starLevel || 1, gemLevel: w.gemLevel || 1 })) || [],
            buildings: this.economy?.buildings || {},
            research: this.economy?.research || {},
            last_active: Date.now()
          })
        }).catch(() => {});
      }
    }
  }

  damageHero(dmg) {
    this.leader.hp = Math.max(0, this.leader.hp - dmg);
  }

  createDrop(x, y, money) {
    this.drops.push({ x, y, money, life: 25 });
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

  // ==================== الرسم ====================
  drawHero(ctx) {
    const l = this.leader;
    const useSprites = this._isometricEnabled && spriteFactory.isReady;

    ctx.save();
    ctx.translate(l.x, l.y);

    // ظل
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath();
    ctx.ellipse(0, l.radius * 0.6, l.radius * 0.8, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Glow للسلاح إذا كان 2★+
    if (this._weaponStarLevel >= 2) {
      drawWeaponGlow(ctx, 0, 0, this._weaponStarLevel, l.radius, this._glowTime || 0);
    }

    if (useSprites) {
      // تحديد الاتجاه من الحركة
      let dx = 0, dy = 0;
      if (l.fighting) {
        dx = l.fighting.x - l.x;
        dy = l.fighting.y - l.y;
      } else if (l.path && l.pathIdx < l.path.length) {
        dx = l.path[l.pathIdx].x - l.x;
        dy = l.path[l.pathIdx].y - l.y;
      }
      const dir = SpriteFactory.vectorToDirection(dx, dy);
      spriteFactory.draw(ctx, "leader", 0, 0, dir, this._spriteFrame, 1.3, l.facing < 0);
    } else {
      // Fallback: الكود الأصلي
      ctx.scale(l.facing || 1, 1);
      this._drawSprite(ctx, "leader-player", "#2c1810", l.radius);
      ctx.scale(1 / (l.facing || 1), 1);

      // تاج ذهبي
      ctx.fillStyle = "#f5d76e";
      ctx.fillRect(-6, -l.radius - 8, 12, 8);
    }

    // HP bar
    const hp = l.hp / l.maxHp;
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(-l.radius, -l.radius - 18, l.radius * 2, 4);
    ctx.fillStyle = hp > 0.5 ? "#4cd964" : "#ff4444";
    ctx.fillRect(-l.radius, -l.radius - 18, l.radius * 2 * hp, 4);

    ctx.restore();

    if (this._weaponStarLevel >= 1) {
      drawWeaponStarIcons(ctx, l.x, l.y - l.radius - 28, this._weaponStarLevel, 8);
    }
  }

  drawArmy(ctx) {
    for (const u of this.armyUnits) {
      ctx.save();
      ctx.translate(u.x, u.y);

      // ظل
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.beginPath();
      ctx.ellipse(0, u.radius * 0.6, u.radius * 0.7, 3, 0, 0, Math.PI * 2);
      ctx.fill();

      // قلب الاتجاه
      ctx.scale(u.facing || 1, 1);
      this._drawSprite(ctx, "soldier-player", "#3d2b1f", u.radius);
      ctx.scale(1 / (u.facing || 1), 1);

      const hp = u.hp / u.maxHp;
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(-u.radius, -u.radius - 10, u.radius * 2, 3);
      ctx.fillStyle = hp > 0.5 ? "#4cd964" : "#ffaa00";
      ctx.fillRect(-u.radius, -u.radius - 10, u.radius * 2 * hp, 3);

      ctx.restore();
    }
  }

  drawMonsters(ctx) {
    for (const m of this.monsters) {
      if (!m.alive) continue;
      ctx.save();
      ctx.translate(m.x, m.y);

      // ظل
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.beginPath();
      ctx.ellipse(0, m.radius * 0.5, m.radius * 0.7, 3, 0, 0, Math.PI * 2);
      ctx.fill();

      // قلب الاتجاه
      ctx.scale(m.facing || 1, 1);
      this._drawSprite(ctx, m.imageKey, m.color, m.radius);
      ctx.scale(1 / (m.facing || 1), 1);

      const hp = m.hp / m.maxHp;
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(-m.radius, -m.radius - 12, m.radius * 2, 4);
      ctx.fillStyle = hp > 0.5 ? "#4cd964" : "#ff4444";
      ctx.fillRect(-m.radius, -m.radius - 12, m.radius * 2 * hp, 4);

      ctx.fillStyle = "#fff";
      ctx.font = "bold 11px Cairo, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(m.name, 0, -m.radius - 18);

      ctx.restore();
    }
  }

  drawDrops(ctx) {
    for (const d of this.drops) {
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.fillStyle = "#f1c40f";
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = "bold 10px Cairo";
      ctx.textAlign = "center";
      ctx.fillText("+" + d.money, 0, -14);
      ctx.restore();
    }
  }

  drawProjectiles(ctx) {
    ctx.fillStyle = "#e74c3c";
    for (const p of this.projectiles) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawWorldFx(ctx, cam) {
    for (const fx of this.worldFx) {
      const alpha = fx.life / fx.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = fx.color;
      ctx.font = "bold 14px Cairo, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(fx.text, fx.x, fx.y - (1 - alpha) * 20);
      ctx.globalAlpha = 1;
    }
  }

  drawMiniMap(ctx, cam) {
    const size = this.miniMapSize;
    const m = this.miniMapMargin;
    const sx = ctx.canvas.width / (window.devicePixelRatio || 1) - size - m;
    const sy = m + 30;

    ctx.save();
    ctx.translate(0, 0);

    // خلفية
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(sx, sy, size, size);
    ctx.strokeStyle = "rgba(255,215,0,0.3)";
    ctx.lineWidth = 1;
    ctx.strokeRect(sx, sy, size, size);

    const scale = size / this.W;

    // رسم الوحوش
    for (const mon of this.monsters) {
      if (!mon.alive) continue;
      ctx.fillStyle = mon.color;
      ctx.fillRect(sx + mon.x * scale - 1, sy + mon.y * scale - 1, 3, 3);
    }

    // رسم لاعبين آخرين
    for (const [, p] of this.otherPlayers) {
      ctx.fillStyle = p.color || "#3a5a8a";
      ctx.fillRect(sx + p.x * scale - 1, sy + p.y * scale - 1, 3, 3);
    }

    // رسم القائد
    ctx.fillStyle = "#FFD700";
    ctx.beginPath();
    ctx.arc(sx + this.leader.x * scale, sy + this.leader.y * scale, 3, 0, Math.PI * 2);
    ctx.fill();

    // نافذة الكاميرا
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 1;
    ctx.strokeRect(
      sx + cam.x * scale, sy + cam.y * scale,
      cam.w * scale, cam.h * scale
    );

    ctx.restore();
  }

  // ==================== Battle Royale Methods ====================
  initBR(mapSize, matchDuration) {
    this.mode = "battle_royale";
    this.brMapSize = mapSize || 2000;
    this.matchDuration = matchDuration || 600;
    this.W = this.brMapSize;
    this.H = this.brMapSize;
    this.zone = {
      x: this.brMapSize / 2,
      y: this.brMapSize / 2,
      radius: this.brMapSize * 0.45,
      minRadius: 100,
      nextShrink: 30,
    };
    this.bandits = [];
    this.killFeed = [];
    this.brKills = 0;
    this.matchStarted = false;
    this.matchEnded = false;
    this.matchTimer = this.matchDuration;
    // إعادة تعيين موقع اللاعب
    if (this.leader) {
      this.leader.x = this.brMapSize / 2 + (Math.random() - 0.5) * this.brMapSize * 0.3;
      this.leader.y = this.brMapSize / 2 + (Math.random() - 0.5) * this.brMapSize * 0.3;
      this.leader.hp = 120;
      this.leader.maxHp = 120;
      this.leader.fighting = null;
      this.leader.path = null;
    }
  }

  startBRMatch() {
    if (this.mode !== "battle_royale") return;
    this.matchStarted = true;
    this.matchEnded = false;
    this.matchTimer = this.matchDuration;
    this.zone.nextShrink = 30;
    this.brKills = 0;
    this.bandits = [];
    this.killFeed = [];
    // إظهار عناصر واجهة BR
    document.getElementById("br-timer")?.classList.remove("hidden");
    document.getElementById("br-players")?.classList.remove("hidden");
    document.getElementById("br-kills")?.classList.remove("hidden");
    document.getElementById("br-kill-feed")?.classList.remove("hidden");
    // توزيع عشوائي للاعبين
    const spawnPoints = this._genBRSpawnPoints();
    if (this.leader && spawnPoints.length > 0) {
      const sp = spawnPoints[0];
      this.leader.x = sp.x;
      this.leader.y = sp.y;
      this.leader.hp = 120;
      this.leader.maxHp = 120;
    }
    this.netSync.send({ type: "br_match_start", mapSize: this.brMapSize, matchDuration: this.matchDuration });
    if (this.store) this.store.set('notification', { text: "🚀 بدأت المعركة الملكية! كن آخر من يبقى!", t: Date.now() });
  }

  updateBR(dt) {
    if (!this.matchStarted || this.matchEnded) return;
    // عداد المباراة
    this.matchTimer -= dt;
    if (this.matchTimer <= 0) {
      this._endBRMatch("timeout");
      return;
    }
    // تصغير المنطقة
    this.zone.nextShrink -= dt;
    if (this.zone.nextShrink <= 0) {
      this.zone.nextShrink = 30;
      this.zone.radius = Math.max(this.zone.minRadius, this.zone.radius - 80);
      this.netSync.send({ type: "br_zone_shrink", radius: this.zone.radius, centerX: this.zone.x, centerY: this.zone.y });
      if (this.store) this.store.set('notification', { text: "⚠️ المنطقة تتصغر! تحرك إلى الداخل!", t: Date.now() });
    }
    // ضرر للاعب خارج المنطقة
    if (this.leader) {
      const dist = Math.hypot(this.leader.x - this.zone.x, this.leader.y - this.zone.y);
      if (dist > this.zone.radius) {
        this.leader.hp -= 5 * dt;
        if (this.leader.hp <= 0) {
          this.leader.hp = 0;
          this._eliminatePlayer(this.username, "zone");
        }
      }
    }
    // تحديث قطاع الطرق
    this._updateBRBandits(dt);
    // تحديث DOM
    this._updateBRDom(dt);
    // التحقق من الفائز
    if (this._onBRKillFeed) this._onBRKillFeed(this.killFeed);
  }

  _updateBRDom(dt) {
    // تحديث مؤقت DOM + kill feed timer
    const timerEl = document.getElementById("br-timer");
    if (timerEl) {
      const timer = Math.max(0, Math.ceil(this.matchTimer));
      const min = String(Math.floor(timer / 60)).padStart(2, "0");
      const sec = String(timer % 60).padStart(2, "0");
      timerEl.textContent = `${min}:${sec}`;
      timerEl.classList.toggle("warning", timer < 60);
    }
    const killsEl = document.getElementById("br-kill-count");
    if (killsEl) killsEl.textContent = this.brKills;
    // تحديث kill feed timer
    for (let i = this.killFeed.length - 1; i >= 0; i--) {
      this.killFeed[i].time -= dt;
      if (this.killFeed[i].time <= 0) this.killFeed.splice(i, 1);
    }
  }

  _genBRSpawnPoints() {
    const count = Math.max(4, this.brAlivePlayers.length || 4);
    const pts = [];
    const angleStep = (Math.PI * 2) / count;
    const spawnRadius = this.brMapSize * 0.35;
    for (let i = 0; i < count; i++) {
      pts.push({
        x: this.brMapSize / 2 + Math.cos(angleStep * i + Math.random() * 0.3) * spawnRadius + (Math.random() - 0.5) * 100,
        y: this.brMapSize / 2 + Math.sin(angleStep * i + Math.random() * 0.3) * spawnRadius + (Math.random() - 0.5) * 100,
      });
    }
    return pts;
  }

  spawnBandit() {
    const edge = Math.floor(Math.random() * 4);
    let x, y;
    const m = 50;
    if (edge === 0) { x = Math.random() * this.W; y = m; }
    else if (edge === 1) { x = this.W - m; y = Math.random() * this.H; }
    else if (edge === 2) { x = Math.random() * this.W; y = this.H - m; }
    else { x = m; y = Math.random() * this.H; }
    const lvl = this.economy ? Math.max(1, this.economy.level) : 1;
    const bandit = {
      id: `bandit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      x, y, spawnX: x, spawnY: y,
      hp: 40 + lvl * 3, maxHp: 40 + lvl * 3,
      damage: 10 + lvl * 2, speed: 70 + Math.random() * 30,
      alive: true, facing: 1, attackTimer: 0,
      radius: 14, color: "#4a4a3a",
      patrolTarget: null, targetId: null,
    };
    this.bandits.push(bandit);
    this.netSync.send({ type: "br_bandit_spawn", bandit });
    return bandit;
  }

  _updateBRBandits(dt) {
    if (this.bandits.length < 3 && this.matchStarted) {
      // الحفاظ على 3+ bandits في الخريطة
      this.spawnBandit();
    }
    for (let i = this.bandits.length - 1; i >= 0; i--) {
      const b = this.bandits[i];
      if (!b.alive) { this.bandits.splice(i, 1); continue; }
      // البحث عن أقرب لاعب
      let nearest = null;
      let minDist = 500;
      for (const [, p] of this.otherPlayers) {
        const d = Math.hypot(p.x - b.x, p.y - b.y);
        if (d < minDist && p.username !== this.username) { minDist = d; nearest = p; }
      }
      if (this.leader) {
        const d = Math.hypot(this.leader.x - b.x, this.leader.y - b.y);
        if (d < minDist) { minDist = d; nearest = { ...this.leader, isLeader: true }; }
      }
      if (nearest && minDist < 400) {
        const dx = nearest.x - b.x;
        const dy = nearest.y - b.y;
        const d = Math.hypot(dx, dy);
        b.facing = dx >= 0 ? 1 : -1;
        if (d > 25) {
          const spd = b.speed * (nearest.isLeader ? 1 : 1.2);
          b.x += (dx / d) * spd * dt;
          b.y += (dy / d) * spd * dt;
        } else {
          b.attackTimer -= dt;
          if (b.attackTimer <= 0) {
            b.attackTimer = 1.0;
            if (nearest.isLeader) {
              this.leader.hp -= b.damage;
              if (this.leader.hp <= 0) this._eliminatePlayer(this.username, "bandit");
            }
          }
        }
      } else {
        if (!b.patrolTarget || Math.hypot(b.x - b.patrolTarget.x, b.y - b.patrolTarget.y) < 20) {
          b.patrolTarget = { x: b.x + (Math.random() - 0.5) * 400, y: b.y + (Math.random() - 0.5) * 400 };
          b.patrolTarget.x = Math.max(50, Math.min(this.W - 50, b.patrolTarget.x));
          b.patrolTarget.y = Math.max(50, Math.min(this.H - 50, b.patrolTarget.y));
        }
        const dx = b.patrolTarget.x - b.x;
        const dy = b.patrolTarget.y - b.y;
        const d = Math.hypot(dx, dy);
        if (d > 5) { b.x += (dx / d) * b.speed * 0.4 * dt; b.y += (dy / d) * b.speed * 0.4 * dt; }
      }
    }
  }

  _eliminatePlayer(playerId, by) {
    if (!this.matchStarted) return;
    const isMe = playerId === this.username;
    const killedByMe = by === this.username;
    if (killedByMe) this.brKills++;
    const msg = isMe ? `💀 ${by} قتلك!` : `💀 ${playerId} قُتل بواسطة ${by}`;
    this.killFeed.push({ text: msg, time: 3 });
    if (this.store) this.store.set('notification', { text: msg, t: Date.now() });
    this.netSync.send({ type: "br_player_eliminated", playerId, by });
    this._checkBRWinner();
  }

  _checkBRWinner() {
    if (!this.matchStarted) return;
    let aliveCount = 0;
    for (const [, p] of this.otherPlayers) {
      if (p.username !== this.username && p.br_alive !== false) aliveCount++;
    }
    if (aliveCount <= 0 && this.leader && this.leader.hp > 0) {
      this._endBRMatch("winner");
    }
  }

  _endBRMatch(reason) {
    if (this.matchEnded) return;
    this.matchEnded = true;
    this.matchStarted = false;
    const isWinner = reason === "winner" || (reason === "last" && this.leader && this.leader.hp > 0);
    if (this._onBRMatchEnd) this._onBRMatchEnd({ winner: isWinner, kills: this.brKills, reason });
    this.netSync.send({ type: "br_match_end", winner: isWinner ? this.username : null, kills: this.brKills });
  }

  drawBRZone(ctx) {
    if (this.mode !== "battle_royale") return;
    ctx.save();
    // تعتيم خارج المنطقة
    ctx.beginPath();
    ctx.rect(0, 0, this.W, this.H);
    ctx.arc(this.zone.x, this.zone.y, this.zone.radius, 0, Math.PI * 2, true);
    ctx.fillStyle = "rgba(180, 40, 40, 0.35)";
    ctx.fill();
    // حدود المنطقة
    ctx.beginPath();
    ctx.arc(this.zone.x, this.zone.y, this.zone.radius, 0, Math.PI * 2);
    ctx.strokeStyle = this.zone.radius <= 200 ? "#ff4444" : "rgba(255, 100, 100, 0.6)";
    ctx.lineWidth = 3;
    if (this.zone.radius <= 200) ctx.setLineDash([8, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  drawBRBandits(ctx) {
    for (const b of this.bandits) {
      if (!b.alive) continue;
      ctx.save();
      ctx.translate(b.x, b.y);
      // ظل (قبل القلب)
      ctx.fillStyle = "rgba(0,0,0,0.2)";
      ctx.beginPath(); ctx.ellipse(0, 12, 16, 5, 0, 0, Math.PI * 2); ctx.fill();
      // قلب الاتجاه
      ctx.scale(b.facing || 1, 1);

      const banditImg = this.images.get("bandit-br");
      if (banditImg) {
        // صورة كاملة لقطاع الطرق
        ctx.drawImage(banditImg, -14, -20, 28, 40);
      } else {
        // رسم تفصيلي يدوي — جسد + رأس + عصابة + سلاح
        ctx.fillStyle = "#4a4a3a";
        ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#8a7a5a";
        ctx.beginPath(); ctx.arc(0, -14, 7, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#222";
        ctx.fillRect(-8, -16, 16, 3);
        ctx.strokeStyle = "#666"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(15, -2); ctx.lineTo(25, -12); ctx.stroke();
      }
      // شريط صحة
      const hpPct = b.hp / b.maxHp;
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(-14, -22, 28, 3);
      ctx.fillStyle = "#ff6600";
      ctx.fillRect(-14, -22, 28 * hpPct, 3);
      ctx.restore();
    }
  }

  drawBRUI(ctx, cam) {
    if (this.mode !== "battle_royale") return;
    ctx.save();
    ctx.translate(0, 0);
    // مؤقت المباراة (أعلى وسط)
    const timer = Math.max(0, Math.ceil(this.matchTimer));
    const min = String(Math.floor(timer / 60)).padStart(2, "0");
    const sec = String(timer % 60).padStart(2, "0");
    const timerText = `${min}:${sec}`;
    ctx.font = "bold 22px Cairo, monospace";
    ctx.textAlign = "center";
    ctx.fillStyle = timer < 60 ? "#ff4444" : "#FFD700";
    ctx.shadowColor = "rgba(0,0,0,0.8)";
    ctx.shadowBlur = 8;
    ctx.fillText(timerText, ctx.canvas.width / 2 / (window.devicePixelRatio || 1), 50);
    ctx.shadowBlur = 0;
    // عدد اللاعبين (أعلى يسار)
    ctx.textAlign = "left";
    ctx.font = "bold 14px Cairo, sans-serif";
    ctx.fillStyle = "#fdf6e3";
    ctx.fillText(`👥 ${this.otherPlayers.size + 1}`, 12, 30);
    // القتلى (أعلى يمين)
    ctx.textAlign = "right";
    ctx.fillStyle = "#ff6b6b";
    const w = ctx.canvas.width / (window.devicePixelRatio || 1);
    ctx.fillText(`⚔️ ${this.brKills}`, w - 12, 30);
    ctx.restore();
  }

  enterWorldMap() {
    const canvas = document.getElementById("gameCanvas");
    if (canvas) canvas.classList.remove("hidden");
    if (!this.running) this.start();
  }

  async exitWorldMap() {
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
    }
    this.stop();
    const canvas = document.getElementById("gameCanvas");
    if (canvas) canvas.classList.add("hidden");
    if (this.onExit) this.onExit();
    if (this.store) this.store.set('players', []);
  }
}