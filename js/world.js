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

    // ==================== نظام الملتيكاملة (WebSocket) ====================
    this.otherPlayers = new Map();
    this._ws = null;
    this._wsReconnectTimer = null;
    this._posInterval = null;
    this._boundUnload = null;
    this.nearbyPlayer = null;
    this.combatCooldown = 0;
    this.attackRange = 60;
    this.onExit = null;
    this.sessionStats = { kills: 0, coinsEarned: 0 };
    this._onPlayersChanged = null;
    this._onNotification = null;
    this._monstersSynced = false;
    this._pvpTarget = null;
    this._wipeFlag = false;
    this._allianceManager = null;
    this._upgradeTree = null;

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
      isLeader: true
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
    this._onBRMatchEnd = null;
    this._onBRKillFeed = null;
    this._onChatMessage = null;
    this._onCashEarned = null;
    this._events = null; // مرجع لـ EventManager
    this._onPvPWin = null;
    this._onPvPLose = null;
    this._onDropCollected = null;
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

  async sendLoginNotification() {
    try {
      await fetch(`${this.apiBase}/api/players/${encodeURIComponent(this.username)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: this.username,
          x_position: Math.floor(this.leader.x),
          y_position: Math.floor(this.leader.y),
          army_power: this.economy ? this.economy.power : 0,
          last_active: Date.now()
        })
      });
      console.log("🚀 [API] إشعار دخول اللاعب!");
    } catch (err) {
      console.warn("⚠️ [API] فشل إشعار الدخول:", err.message);
    }
  }

  // ==================== WebSocket — ملتيكاملة فورية ====================
  startMultiplayerSync() {
    if (this._ws) return;
    this._connectWS();
    this.sendWSUpdate();
    this.sendPositionUpdate();
    // WS update كل 100ms للحركة الفورية
    this._wsInterval = setInterval(() => this.sendWSUpdate(), 100);
    // HTTP save كل 5 ثوانٍ للحفظ في قاعدة البيانات
    this._posInterval = setInterval(() => this.sendPositionUpdate(), 5000);
    this._boundUnload = () => this.stopMultiplayerSync();
    window.addEventListener("beforeunload", this._boundUnload);
  }

  stopMultiplayerSync() {
    if (this._wsInterval) {
      clearInterval(this._wsInterval);
      this._wsInterval = null;
    }
    if (this._posInterval) {
      clearInterval(this._posInterval);
      this._posInterval = null;
    }
    if (this._wsReconnectTimer) {
      clearTimeout(this._wsReconnectTimer);
      this._wsReconnectTimer = null;
    }
    if (this._ws) {
      this._ws.onclose = null;
      this._ws.onmessage = null;
      this._ws.onerror = null;
      try { this._ws.close(); } catch {}
      this._ws = null;
    }
    if (this._boundUnload) {
      window.removeEventListener("beforeunload", this._boundUnload);
      this._boundUnload = null;
    }
  }

  _connectWS() {
    if (this._ws) return;
    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    const base = this.apiBase ? this.apiBase.replace(/^http/, "ws") : `${protocol}//${location.host}`;
    const url = `${base}/ws/world`;
    this._ws = new WebSocket(url);

    this._ws.onopen = () => {
      console.log("[WS] متصل بالخادم ✅");
      this._sendWS({
        type: "join", username: this.username,
        x_position: Math.floor(this.leader?.x || 1200),
        y_position: Math.floor(this.leader?.y || 1200),
        army_power: this.economy ? this.economy.power : 0,
        kills: this.sessionStats.kills,
        coinsEarned: this.sessionStats.coinsEarned,
        unitLevel: this.army?.unitLevel || 1,
        armyAlive: this.armyUnits.filter(u => u.hp > 0).length
      });
    };

    this._ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === "world_players") {
          this.syncOtherPlayers(msg.list || []);
          if (this._onPlayersChanged) this._onPlayersChanged(msg.list || []);
        } else if (msg.type === "world_monsters") {
          this.syncMonsters(msg.list || []);
        } else if (msg.type === "monster_killed") {
          const mon = this.monsters.find(m => m.id === msg.id);
          if (mon && mon.alive) { mon.alive = false; mon.hp = 0; mon.respawnTimer = 25; }
        } else if (msg.type === "pvp_notify") {
          if (this._onNotification) this._onNotification(`⚔️ ${msg.attacker} هاجمك بقوة ${msg.power}!`);
        } else if (msg.type === "player_joined") {
          if (this._onNotification) this._onNotification(`👋 ${msg.username} دخل إلى الصحراء`);
        } else if (msg.type === "player_left") {
          if (this._onNotification) this._onNotification(`🚪 ${msg.username} خرج من الصحراء`);
        } else if (msg.type === "broadcast_chat") {
          if (this._onChatMessage) this._onChatMessage(msg.username, msg.message);
        } else if (msg.type === "br_zone_shrink") {
          if (this.mode === "battle_royale") {
            this.zone.radius = msg.radius;
            this.zone.x = msg.centerX;
            this.zone.y = msg.centerY;
          }
        } else if (msg.type === "br_bandit_spawn") {
          if (this.mode === "battle_royale" && msg.bandit) {
            this.bandits.push(msg.bandit);
          }
        } else if (msg.type === "br_player_eliminated") {
          if (this._onNotification) this._onNotification(`💀 ${msg.playerId} قُتل بواسطة ${msg.by}`);
        } else if (msg.type === "br_match_end") {
          if (this.mode === "battle_royale") {
            this.matchEnded = true;
            this.matchStarted = false;
            if (this._onBRMatchEnd) this._onBRMatchEnd(msg);
          }
        }
      } catch {}
    };

    this._ws.onclose = () => {
      console.warn("[WS] قطع الاتصال، إعادة محاولة...");
      this._ws = null;
      this._wsReconnectTimer = setTimeout(() => this._connectWS(), 2000);
    };

    this._ws.onerror = () => {};
  }

  _sendWS(data) {
    if (this._ws && this._ws.readyState === WebSocket.OPEN) {
      this._ws.send(JSON.stringify(data));
    }
  }

  sendWSUpdate() {
    if (!this.leader || !this._ws || this._ws.readyState !== WebSocket.OPEN) return;
    const update = {
      type: "update",
      x_position: Math.floor(this.leader.x),
      y_position: Math.floor(this.leader.y),
      army_power: this.economy ? this.economy.power : 0,
      kills: this.sessionStats.kills,
      coinsEarned: this.sessionStats.coinsEarned,
      unitLevel: this.army?.unitLevel || 1,
      armyAlive: this.armyUnits.filter(u => u.hp > 0).length
    };
    if (this.mode === "battle_royale") {
      update.br_hp = this.leader.hp;
      update.br_alive = this.leader.hp > 0;
      update.br_kills = this.brKills;
    }
    this._sendWS(update);
  }

  sendPositionUpdate() {
    if (!this.leader) return;
    fetch(`${this.apiBase}/api/players/${encodeURIComponent(this.username)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cash: this.economy?.cash || 0,
        gems: this.economy?.gems || 0,
        gold: this.economy?.gold || 0,
        kingCoins: this.economy?.kingCoins || 0,
        hammers: this.economy?.hammers || 0,
        scrolls: this.economy?.scrolls || 0,
        horns: this.economy?.horns || 0,
        army_power: this.economy ? this.economy.power : 0,
        unitLevel: this.army?.unitLevel || 1,
        weapons: this.army?.weapons?.map(w => ({ id: w.id, level: w.level })) || [],
        x_position: Math.floor(this.leader.x),
        y_position: Math.floor(this.leader.y),
        last_active: Date.now()
      })
    }).catch(() => {});
  }

  syncMonsters(serverMonsters) {
    if (!serverMonsters || serverMonsters.length === 0) return;
    this._monstersSynced = true;
    const newIds = new Set();
    for (const sm of serverMonsters) {
      newIds.add(sm.id);
      const local = this.monsters.find(m => m.id === sm.id);
      if (local) {
        // لا نغير موقع الوحوش أثناء القتال — نستخدم lerp سلس
        if (!local._targetX) { local._targetX = local.x; local._targetY = local.y; }
        local._targetX = sm.x;
        local._targetY = sm.y;
        local.hp = sm.hp;
        local.maxHp = sm.maxHp;
        if (local.alive && !sm.alive) {
          local.alive = false;
          local.respawnTimer = sm.respawnTimer || 25;
        } else if (!local.alive && sm.alive) {
          local.alive = true;
          local.hp = sm.hp;
          local.respawnTimer = 0;
        }
      } else {
        this.monsters.push({
          ...sm,
          facing: 1, attackCD: 0,
          _targetX: sm.x, _targetY: sm.y,
          respawnTimer: sm.alive ? 0 : (sm.respawnTimer || 25)
        });
      }
    }
    // إزالة الوحوش التي لم تعد موجودة عند السيرفر
    for (let i = this.monsters.length - 1; i >= 0; i--) {
      if (!newIds.has(this.monsters[i].id)) {
        this.monsters.splice(i, 1);
      }
    }
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

  syncOtherPlayers(players) {
    const now = Date.now();
    const activeUsernames = new Set();

    for (const p of players) {
      const name = p.username;
      if (!name || name === this.username) continue;

      const lastActive = p.last_active ? new Date(p.last_active).getTime() : 0;
      if (now - lastActive > 10000) continue;

      activeUsernames.add(name);
      const x = p.x_position ?? this.W / 2 + (Math.random() - 0.5) * 400;
      const y = p.y_position ?? this.H / 2 + (Math.random() - 0.5) * 400;

      if (this.otherPlayers.has(name)) {
        const existing = this.otherPlayers.get(name);
        existing.targetX = x;
        existing.targetY = y;
        existing.army_power = p.army_power || 0;
        existing.unitLevel = p.unitLevel || 1;
        existing.armyAlive = p.armyAlive ?? 8;
        existing.lastActive = lastActive;
        existing.br_hp = p.br_hp ?? existing.br_hp;
        existing.br_alive = p.br_alive ?? existing.br_alive;
      } else {
        this.otherPlayers.set(name, {
          username: name,
          x: x, y: y,
          targetX: x, targetY: y,
          radius: 16,
          army_power: p.army_power || 0,
          unitLevel: p.unitLevel || 1,
          armyAlive: p.armyAlive ?? 8,
          lastActive: lastActive,
          color: p.color || "#3a5a8a",
          br_hp: p.br_hp ?? 120,
          br_alive: p.br_alive ?? true,
        });
      }
    }

    for (const [name, player] of this.otherPlayers) {
      if (!activeUsernames.has(name)) {
        this.otherPlayers.delete(name);
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

  async attackPlayer(target) {
    if (this.combatCooldown > 0) return;
    this.combatCooldown = 3;

    const myPower = this.economy ? this.economy.power : 0;
    const theirPower = target.army_power || 0;
    const won = myPower >= theirPower * 0.9;

    if (won) {
      let reward = Math.max(10, Math.floor(theirPower * 0.05));
      let goldReward = Math.floor(reward * 0.2);
      if (this._events) {
        const pvpMult = this._events.getMult("mult_pvp");
        if (pvpMult > 1) { reward = Math.floor(reward * pvpMult); goldReward = Math.floor(goldReward * pvpMult); }
      }
      if (this.economy) {
        this.economy.addRaw("cash", reward);
        this.economy.addRaw("gold", goldReward);
      }
      this.worldFx.push({ x: target.x, y: target.y, text: `⚔️ انتصرت! +${reward} 💵 +${goldReward} 🪙`, color: "#4cd964", life: 2, maxLife: 2 });
      if (this._onPvPWin) this._onPvPWin();
    } else {
      this.worldFx.push({ x: target.x, y: target.y, text: "💥 هُزمت!", color: "#ff4444", life: 2, maxLife: 2 });
      if (this.leader) {
        this.leader.hp = Math.max(0, this.leader.hp - 20);
      }
      if (this._onPvPLose) this._onPvPLose();
    }

    if (this._ws && this._ws.readyState === WebSocket.OPEN) {
      this._sendWS({ type: "pvp_attack", target: target.username, myPower: this.economy ? this.economy.power : 0 });
    }

    try {
      await fetch(`${this.apiBase}/api/players/${encodeURIComponent(this.username)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cash: this.economy?.cash || 0,
          gems: this.economy?.gems || 0,
          gold: this.economy?.gold || 0,
          kingCoins: this.economy?.kingCoins || 0,
          hammers: this.economy?.hammers || 0,
          scrolls: this.economy?.scrolls || 0,
          horns: this.economy?.horns || 0,
          army_power: this.economy ? this.economy.power : 0,
          unitLevel: this.army?.unitLevel || 1,
          weapons: this.army?.weapons?.map(w => ({ id: w.id, level: w.level })) || [],
          last_active: Date.now()
        })
      });
    } catch (err) { console.warn("⚠️ [MP] فشل إرسال نتيجة الهجوم:", err.message); }
  }

  checkCombatProximity() {
    this.combatCooldown = Math.max(0, this.combatCooldown - 0.016);
    this.nearbyPlayer = null;

    let closest = null;
    let minDist = this.attackRange;
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
      // مع updates كل 100ms، lerp بسرعة 10× الثانية يعطي حركة سلسة
      const lerp = Math.min(1, dt * 10);
      p.x += (p.targetX - p.x) * lerp;
      p.y += (p.targetY - p.y) * lerp;
    }
  }

  drawOtherPlayers(ctx) {
    for (const [, p] of this.otherPlayers) {
      const armyCount = Math.min(p.armyAlive || 8, 8);
      const col = p.color;

      ctx.save();
      ctx.translate(p.x, p.y);

      // رسم جيش اللاعب الآخر
      for (let i = 0; i < armyCount; i++) {
        const ux = -30 - (i % 4) * 18;
        const uy = 20 + Math.floor(i / 4) * 22;
        ctx.fillStyle = col + "99";
        ctx.beginPath();
        ctx.arc(ux, uy, 8, 0, Math.PI * 2);
        ctx.fill();
      }

      // رسم القائد
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "rgba(255,255,255,0.3)";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = "#fff";
      ctx.font = "bold 11px Cairo, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(p.username, 0, -p.radius - 10);

      ctx.restore();
    }
  }

  // ==================== تهيئة الجيش ====================
  initArmyUnits(count) {
    this.armyUnits = [];
    for (let i = 0; i < count; i++) {
      this.armyUnits.push({
        x: this.leader.x - 30 - (i % 4) * 18,
        y: this.leader.y + 20 + Math.floor(i / 4) * 22,
        speed: 135 + Math.random() * 10,
        radius: 10,
        hp: 40,
        maxHp: 40,
        baseDmg: 5,
        dmgBonus: 0,
        defBonus: 0,
        attackCD: 0,
        offsetX: -30 - (i % 4) * 18,
        offsetY: 20 + Math.floor(i / 4) * 22,
        path: null,
        pathIdx: 0,
        fighting: null
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

    this.spawnMonsters();

    const img = new Image();
    img.onload = () => { 
      this.mapImage = img; 
      this.sendLoginNotification();
    };
    img.src = "img/map.jpg";

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
    // إذا وصلت وحوش السيرفر لا نعيد التوليد
    if (this._monstersSynced) return;
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

  createMonster(id, spawnX, spawnY) {
    const types = [
      { name: "ذئب صحراوي", color: "#8a5a3a", radius: 14, hp: 35, maxHp: 35, damage: 6, rewardMoney: 8 },
      { name: "محارب ظل", color: "#2a1a1a", radius: 18, hp: 65, maxHp: 65, damage: 13, rewardMoney: 18 },
      { name: "زعيم الرمال", color: "#c0392b", radius: 22, hp: 130, maxHp: 130, damage: 24, rewardMoney: 45 },
    ];
    const t = types[Math.floor(Math.random() * types.length)];
    return {
      id,
      ...t,
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
      return;
    }

    const monster = this.findMonsterAt(wx, wy);
    if (monster && monster.alive) {
      this.engageMonster(monster);
      this._pvpTarget = null;
      return;
    }

    const otherPlayer = this.findOtherPlayerAt(wx, wy);
    if (otherPlayer) {
      if (this._pvpTarget && this._pvpTarget.username === otherPlayer.username) {
        this._pvpTarget = null;
        this.attackPlayer(otherPlayer);
      } else {
        this._pvpTarget = otherPlayer;
      }
      return;
    }
    this._pvpTarget = null;

    // إلغاء القتال عند التحرك
    this.leader.fighting = null;
    this.armyUnits.forEach(u => u.fighting = null);

    this.leader.path = simplifyPath(aStar(this.leader.x, this.leader.y, wx, wy, this.W, this.H));
    this.leader.pathIdx = 0;
    this.leader.fighting = null;

    this.armyUnits.forEach(u => {
      u.path = simplifyPath(aStar(u.x, u.y, wx + (Math.random() - 0.5) * 50, wy + (Math.random() - 0.5) * 50, this.W, this.H));
      u.pathIdx = 0;
      u.fighting = null;
    });

    this.sendWSUpdate();
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
    const h = this.leader;
    if (!h.path || h.pathIdx >= h.path.length) return;
    ctx.save();
    ctx.strokeStyle = "rgba(255,215,0,0.25)";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(h.x, h.y);
    for (let i = h.pathIdx; i < h.path.length; i++) {
      ctx.lineTo(h.path[i].x, h.path[i].y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  checkWipe() {
    if (this.mode === "battle_royale") return;
    if (this.leader.hp <= 0) {
      this._wipeFlag = true;
    }
    if (this._wipeFlag) {
      this._wipeFlag = false;
      this.onWipe();
    }
  }

  onWipe() {
    const lost = this.sessionStats.coinsEarned;
    const killed = this.sessionStats.kills;
    if (this.economy && lost > 0) {
      this.economy.addRaw("cash", -lost);
      this.economy.addXp(-Math.floor(killed * 5));
      this.sendPositionUpdate();
    }
    this.sessionStats = { kills: 0, coinsEarned: 0 };
    this.leader.hp = this.leader.maxHp;
    this.leader.x = this.W / 2;
    this.leader.y = this.H / 2;
    this.leader.path = null;
    this.initArmyUnits(8);
    // عرض شاشة الخسارة
    this._showWipeScreen(lost, killed);
    if (this._onNotification) this._onNotification(`💀 هُزمت! خسرت ${lost} 💵`);
    if (this._onWipe) this._onWipe(lost, killed);
  }

  _showWipeScreen(lost, killed) {
    // إزالة أي شاشة خسارة سابقة
    const existing = document.getElementById("wipe-overlay");
    if (existing) existing.remove();
    const overlay = document.createElement("div");
    overlay.id = "wipe-overlay";
    overlay.style.cssText = `
      position: fixed; inset: 0; z-index: 9999;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      background: rgba(0,0,0,0.85);
      direction: rtl; text-align: center;
      padding: 20px; box-sizing: border-box;
    `;
    overlay.innerHTML = `
      <div style="font-size:3rem;margin-bottom:8px;">💀</div>
      <div style="color:#ff4444;font-size:1.1rem;font-weight:700;margin-bottom:12px;">هُزم جيشك!</div>
      <div style="color:var(--gold);font-size:0.85rem;margin-bottom:6px;">الغنائم التي خسرتها:</div>
      <div style="color:#fff;font-size:1.5rem;font-weight:700;margin-bottom:4px;">${lost} 💵</div>
      <div style="color:var(--beige-dark);font-size:0.7rem;margin-bottom:16px;">الوحوش المقتولة: ${killed}</div>
      <button id="wipe-dismiss-btn" style="
        padding: 12px 32px; font-size:1rem; font-weight:700;
        background:var(--gold); color:var(--dark); border:none; border-radius:12px;
        cursor:pointer; touch-action:manipulation;
      ">✅ حسناً</button>
    `;
    document.body.appendChild(overlay);
    document.getElementById("wipe-dismiss-btn").onclick = () => overlay.remove();
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
    ctx.fillStyle = "rgba(0,0,0,0.75)";
    ctx.fillRect(sx - 40, sy - 65, 80, 28);
    ctx.fillStyle = "#FFD700";
    ctx.font = "bold 10px Cairo, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`🔍 ${target.username}`, sx, sy - 47);
    ctx.fillStyle = "rgba(0,0,0,0.75)";
    ctx.fillRect(sx - 40, sy + 30, 80, 30);
    ctx.fillStyle = "#fff";
    ctx.font = "10px Cairo, sans-serif";
    ctx.fillText(`👊 ${target.army_power || 0} | ⚔️ ${target.kills || 0}`, sx, sy + 50);
    ctx.fillStyle = "#ff4444";
    ctx.font = "bold 10px Cairo, sans-serif";
    ctx.fillText(`🗡️ اضغط مرة أخرى للهجوم`, sx, sy - 70);
    ctx.restore();
  }

  update(dt, ctx, cam) {
    this.updateLeader(dt);
    this.updateArmy(dt);
    this.updateMonstersAI(dt);
    this.updateOtherPlayers(dt);
    this.updateProjectiles(dt);
    this.updateFx(dt);
    this.updateSandParticles(dt);
    this.checkCombatProximity();
    this.checkWipe();
    if (this.mode === "battle_royale") this.updateBR(dt);

    ctx.save();
    ctx.translate(-cam.x, -cam.y);

    if (this.mapImage) {
      ctx.drawImage(this.mapImage, 0, 0, this.W, this.H);
    } else {
      ctx.fillStyle = "#c2a06e";
      ctx.fillRect(0, 0, this.W, this.H);
    }

    this.drawSandParticles(ctx);
    this.drawPathLine(ctx, cam);
    this.drawBRZone(ctx);
    this.drawMonsters(ctx);
    this.drawDrops(ctx);
    this.drawProjectiles(ctx);
    this.drawOtherPlayers(ctx);
    this.drawBRBandits(ctx);
    this.drawArmy(ctx);
    this.drawHero(ctx);
    this.drawWorldFx(ctx, cam);
    this.drawMiniMap(ctx, cam);

    ctx.restore();

    this.drawArmyHUD(dt, ctx);
    this.drawPvPMenu(ctx, cam);
    this.drawBRUI(ctx, cam);
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

  _syncBonuses() {
    let dmgBonus = 0, defBonus = 0;
    if (this._allianceManager) {
      dmgBonus = this._allianceManager.damageBonus;
      defBonus = this._allianceManager.defenseBonus;
    }
    if (this._upgradeTree) {
      dmgBonus += this._upgradeTree.getEffect("damage");
      defBonus += this._upgradeTree.getEffect("defense");
    }
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

    if (!h.path || h.pathIdx >= h.path.length) return;

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
    for (const unit of this.armyUnits) {
      if (unit.fighting && unit.fighting.alive) {
        const dx = unit.fighting.x - unit.x;
        const dy = unit.fighting.y - unit.y;
        const dist = Math.hypot(dx, dy);

        if (dist > 25) {
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

      if (!unit.path || unit.pathIdx >= unit.path.length) continue;

      const target = unit.path[unit.pathIdx];
      const dx = target.x - unit.x;
      const dy = target.y - unit.y;
      const dist = Math.hypot(dx, dy);

      if (dist < 6) {
        unit.pathIdx++;
      } else {
        unit.x += (dx / dist) * unit.speed * dt;
        unit.y += (dy / dist) * unit.speed * dt;
      }
    }
  }

  updateMonstersAI(dt) {
    // إذا السيرفر متصل، نسحب مواقع الوحوش من السيرفر (حركة سلسة)
    if (this._ws && this._ws.readyState === WebSocket.OPEN) {
      this._lerpMonsterPositions(dt);
    }
    for (const m of this.monsters) {
      if (!m.alive) {
        m.respawnTimer -= dt;
        if (m.respawnTimer <= 0) this.respawnMonster(m);
        continue;
      }

      // إذا السيرفر متصل — لا نحرك الوحوش محلياً (السيرفر هو المسؤول)
      if (this._ws && this._ws.readyState === WebSocket.OPEN) continue;

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
        // مطاردة (Chase)
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
        } else {
          const dx = target.x - m.x;
          const dy = target.y - m.y;
          const dist = Math.hypot(dx, dy);
          m.x += (dx / dist) * 35 * dt;
          m.y += (dy / dist) * 35 * dt;
        }
      } else {
        // دورية (Patrol) — التحرك العشوائي (بديل محلي فقط)
        if (!m._patrolTarget || Math.hypot(m.x - m._patrolTarget.x, m.y - m._patrolTarget.y) < 20) {
          m._patrolTarget = {
            x: m.spawnX + (Math.random() - 0.5) * 200,
            y: m.spawnY + (Math.random() - 0.5) * 200,
          };
        }
        const dx = m._patrolTarget.x - m.x;
        const dy = m._patrolTarget.y - m.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 5) {
          m.x += (dx / dist) * 20 * dt;
          m.y += (dy / dist) * 20 * dt;
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
      this.sessionStats.kills++;
      this.sessionStats.coinsEarned += reward;
      this._sendWS({ type: "monster_killed", id: monster.id });
      this.createDrop(monster.x, monster.y, reward);
      if (this.economy) {
        this.economy.addRaw("cash", reward);
        this.economy.addRaw("gold", Math.floor(reward * 0.3));
        if (this._onCashEarned) this._onCashEarned(reward);
        this.worldFx.push({ x: monster.x, y: monster.y, text: `+${reward} 💵 +${Math.floor(reward * 0.3)} 🪙`, color: "#FFD700", life: 1.5, maxLife: 1.5 });
        fetch(`${this.apiBase}/api/players/${encodeURIComponent(this.username)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cash: this.economy.cash,
            gems: this.economy.gems,
            gold: this.economy.gold,
            kingCoins: this.economy.kingCoins,
            hammers: this.economy.hammers,
            scrolls: this.economy.scrolls,
            horns: this.economy.horns,
            army_power: this.economy.power,
            unitLevel: this.army?.unitLevel || 1,
            weapons: this.army?.weapons?.map(w => ({ id: w.id, level: w.level })) || [],
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
    ctx.save();
    ctx.translate(this.leader.x, this.leader.y);

    ctx.fillStyle = "#2c1810";
    ctx.beginPath();
    ctx.arc(0, 0, this.leader.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#f5d76e";
    ctx.fillRect(-6, -this.leader.radius - 8, 12, 8);

    const hp = this.leader.hp / this.leader.maxHp;
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(-this.leader.radius, -this.leader.radius - 18, this.leader.radius * 2, 4);
    ctx.fillStyle = hp > 0.5 ? "#4cd964" : "#ff4444";
    ctx.fillRect(-this.leader.radius, -this.leader.radius - 18, this.leader.radius * 2 * hp, 4);

    ctx.restore();
  }

  drawArmy(ctx) {
    for (const u of this.armyUnits) {
      ctx.save();
      ctx.translate(u.x, u.y);

      ctx.fillStyle = "#3d2b1f";
      ctx.beginPath();
      ctx.arc(0, 0, u.radius, 0, Math.PI * 2);
      ctx.fill();

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

      ctx.fillStyle = m.color;
      ctx.beginPath();
      ctx.arc(0, 0, m.radius, 0, Math.PI * 2);
      ctx.fill();

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
    this._sendWS({ type: "br_match_start", mapSize: this.brMapSize, matchDuration: this.matchDuration });
    if (this._onNotification) this._onNotification("🚀 بدأت المعركة الملكية! كن آخر من يبقى!");
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
      this._sendWS({ type: "br_zone_shrink", radius: this.zone.radius, centerX: this.zone.x, centerY: this.zone.y });
      if (this._onNotification) this._onNotification("⚠️ المنطقة تتصغر! تحرك إلى الداخل!");
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
    this._sendWS({ type: "br_bandit_spawn", bandit });
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
    if (this._onNotification) this._onNotification(msg);
    this._sendWS({ type: "br_player_eliminated", playerId, by });
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
    this._sendWS({ type: "br_match_end", winner: isWinner ? this.username : null, kills: this.brKills });
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
      ctx.scale(b.facing || 1, 1);
      // ظل
      ctx.fillStyle = "rgba(0,0,0,0.12)";
      ctx.beginPath(); ctx.ellipse(0, 12, 16, 5, 0, 0, Math.PI * 2); ctx.fill();
      // جسد
      ctx.fillStyle = "#4a4a3a";
      ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2); ctx.fill();
      // رأس
      ctx.fillStyle = "#8a7a5a";
      ctx.beginPath(); ctx.arc(0, -14, 7, 0, Math.PI * 2); ctx.fill();
      // عصابة عين
      ctx.fillStyle = "#222";
      ctx.fillRect(-8, -16, 16, 3);
      // سلاح
      ctx.strokeStyle = "#666"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(15, -2); ctx.lineTo(25, -12); ctx.stroke();
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
    this.sendWSUpdate();
    await this.sendPositionUpdate();
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
    if (this._onPlayersChanged) this._onPlayersChanged([]);
  }
}