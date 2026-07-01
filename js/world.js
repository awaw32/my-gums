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
  constructor(economy, username = "بطل الصحراء") {
    this.username = username;
    this.economy = economy;
    this.W = 2400;
    this.H = 2400;
    this.engine = null;
    this.running = false;
    this.N8N_WEBHOOK_URL = "https://n8n.d-king.online/webhook/1fe62b81-3e33-4d1c-a253-165f193f437e";

    // ==================== نظام الملتيكاملة (Multiplayer) ====================
    this.otherPlayers = new Map();
    this._mpInterval = null;
    this._posInterval = null;
    this._boundUnload = null;
    this.nearbyPlayer = null;
    this.combatCooldown = 0;
    this.attackRange = 60;
    this.onExit = null;

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
  }

  // ==================== 🔥 دالة إرسال الإشعار الجديدة 🔥 ====================
  async sendLoginNotification() {
    try {
      await fetch("https://n8n.d-king.online/webhook/1fe62b81-3e33-4d1c-a253-165f193f437e", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: this.username,
          event: "player_login",
          message: `🔥 تنبيه: دخل البطل ${this.username} إلى عالم اللعبة الآن!`,
          timestamp: new Date().toISOString()
        })
      });
      console.log("🚀 [n8n] تم إرسال إشعار دخول اللاعب بنجاح!");
    } catch (err) {
      console.warn("⚠️ فشل إرسال إشعار الدخول إلى n8n:", err.message);
    }
  }

  // ==================== نظام الملتيكاملة (Multiplayer Sync) ====================
  startMultiplayerSync() {
    if (this._mpInterval) return;
    this.fetchAllPlayers();
    this._mpInterval = setInterval(() => this.fetchAllPlayers(), 1500);
    this.sendPositionUpdate();
    this._posInterval = setInterval(() => this.sendPositionUpdate(), 1000);
    this._boundUnload = () => this.stopMultiplayerSync();
    window.addEventListener("beforeunload", this._boundUnload);
  }

  stopMultiplayerSync() {
    if (this._mpInterval) {
      clearInterval(this._mpInterval);
      this._mpInterval = null;
    }
    if (this._posInterval) {
      clearInterval(this._posInterval);
      this._posInterval = null;
    }
    if (this._boundUnload) {
      window.removeEventListener("beforeunload", this._boundUnload);
      this._boundUnload = null;
    }
  }

  async sendPositionUpdate() {
    if (!this.leader) return;
    try {
      await fetch(this.N8N_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: this.username,
          event: "player_autosave",
          cash: this.economy?.cash || 0,
          gems: this.economy?.gems || 0,
          gold: this.economy?.gold || 0,
          kingCoins: this.economy?.kingCoins || 0,
          hammers: this.economy?.hammers || 0,
          scrolls: this.economy?.scrolls || 0,
          horns: this.economy?.horns || 0,
          army_power: this.economy ? this.economy.power : 0,
          x_position: Math.floor(this.leader.x),
          y_position: Math.floor(this.leader.y),
          last_active: Date.now()
        })
      });
    } catch (err) {
      console.warn("⚠️ [MP] فشل تحديث الموقع:", err.message);
    }
  }

  async fetchAllPlayers() {
    try {
      const res = await fetch(this.N8N_WEBHOOK_URL + "?all=true&t=" + Date.now());
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data.players || [data].filter(Boolean));
      this.syncOtherPlayers(list);
    } catch (err) {
      console.warn("⚠️ [MP] فشل جلب اللاعبين:", err.message);
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
        existing.lastActive = lastActive;
      } else {
        this.otherPlayers.set(name, {
          username: name,
          x: x,
          y: y,
          targetX: x,
          targetY: y,
          radius: 16,
          army_power: p.army_power || 0,
          lastActive: lastActive,
          color: "#3a5a8a",
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
      const reward = Math.max(10, Math.floor(theirPower * 0.05));
      if (this.economy) this.economy.addRaw("cash", reward);
      this.worldFx.push({ x: target.x, y: target.y, text: `⚔️ انتصرت! +${reward} 💵`, color: "#4cd964", life: 2, maxLife: 2 });
    } else {
      this.worldFx.push({ x: target.x, y: target.y, text: "💥 هُزمت!", color: "#ff4444", life: 2, maxLife: 2 });
      if (this.leader) {
        this.leader.hp = Math.max(0, this.leader.hp - 20);
      }
    }

    try {
      await fetch(this.N8N_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: this.username,
          event: "pvp_attack",
          target: target.username,
          attacker_power: myPower,
          defender_power: theirPower,
          result: won ? "win" : "lose",
          timestamp: new Date().toISOString()
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

  drawOtherPlayers(ctx) {
    for (const [, p] of this.otherPlayers) {
      p.x += (p.targetX - p.x) * 0.1;
      p.y += (p.targetY - p.y) * 0.1;

      ctx.save();
      ctx.translate(p.x, p.y);

      ctx.fillStyle = p.color;
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
    this.monsters = [];
    for (let i = 0; i < 12; i++) {
      let x, y;
      do {
        x = 150 + Math.random() * (this.W - 300);
        y = 150 + Math.random() * (this.H - 300);
      } while (this.isInSafeZone(x, y));
      this.monsters.push(this.createMonster(x, y));
    }
  }

  createMonster(spawnX, spawnY) {
    const types = [
      { name: "ذئب صحراوي", color: "#8a5a3a", radius: 14, hp: 35, maxHp: 35, damage: 6, rewardMoney: 8 },
      { name: "محارب ظل", color: "#2a1a1a", radius: 18, hp: 65, maxHp: 65, damage: 13, rewardMoney: 18 },
      { name: "زعيم الرمال", color: "#c0392b", radius: 22, hp: 130, maxHp: 130, damage: 24, rewardMoney: 45 },
    ];
    const t = types[Math.floor(Math.random() * types.length)];
    return {
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
      return;
    }

    const otherPlayer = this.findOtherPlayerAt(wx, wy);
    if (otherPlayer) {
      this.attackPlayer(otherPlayer);
      return;
    }

    this.leader.path = aStar(this.leader.x, this.leader.y, wx, wy, this.W, this.H);
    this.leader.pathIdx = 0;
    this.leader.fighting = null;

    this.armyUnits.forEach(u => {
      u.path = aStar(u.x, u.y, wx + (Math.random() - 0.5) * 50, wy + (Math.random() - 0.5) * 50, this.W, this.H);
      u.pathIdx = 0;
      u.fighting = null;
    });
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

  update(dt, ctx, cam) {
    this.updateLeader(dt);
    this.updateArmy(dt);
    this.updateMonsters(dt);
    this.updateProjectiles(dt);
    this.updateFx(dt);
    this.checkCombatProximity();

    ctx.save();
    ctx.translate(-cam.x, -cam.y);

    if (this.mapImage) {
      ctx.drawImage(this.mapImage, 0, 0, this.W, this.H);
    } else {
      ctx.fillStyle = "#c2a06e";
      ctx.fillRect(0, 0, this.W, this.H);
    }

    this.drawMonsters(ctx);
    this.drawDrops(ctx);
    this.drawProjectiles(ctx);
    this.drawOtherPlayers(ctx);
    this.drawArmy(ctx);
    this.drawHero(ctx);
    this.drawWorldFx(ctx, cam);

    if (this.nearbyPlayer) {
      const sx = this.nearbyPlayer.x - cam.x;
      const sy = this.nearbyPlayer.y - cam.y;
      ctx.save();
      ctx.translate(0, 0);
      ctx.strokeStyle = "#ff4444";
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(sx - 30, sy - 50, 60, 70);
      ctx.setLineDash([]);
      ctx.fillStyle = "#ff4444";
      ctx.font = "bold 12px Cairo, sans-serif";
      ctx.textAlign = "center";
      const label = `⚔️ ${this.nearbyPlayer.username} (${this.nearbyPlayer.army_power || 0})`;
      ctx.fillText(label, sx, sy - 56);
      ctx.fillStyle = "#fff";
      ctx.font = "10px Cairo, sans-serif";
      ctx.fillText("👆 اضغط للهجوم", sx, sy + 42);
      ctx.restore();
    }

    ctx.restore();
  }

  updateLeader(dt) {
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
          this.damageMonster(h.fighting, h.baseDmg);
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
            this.damageMonster(unit.fighting, unit.baseDmg);
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

  updateMonsters(dt) {
    for (const m of this.monsters) {
      if (!m.alive) {
        m.respawnTimer -= dt;
        if (m.respawnTimer <= 0) this.respawnMonster(m);
        continue;
      }

      let target = this.leader;
      let minDist = Math.hypot(m.x - this.leader.x, m.y - this.leader.y);

      for (const u of this.armyUnits) {
        const d = Math.hypot(m.x - u.x, m.y - u.y);
        if (d < minDist) {
          minDist = d;
          target = u;
        }
      }

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
    }
  }

  damageMonster(monster, dmg) {
    if (!monster || !monster.alive) return;
    monster.hp -= dmg;
    if (monster.hp <= 0) {
      monster.alive = false;
      monster.respawnTimer = 25;
      const reward = monster.rewardMoney || 10;
      this.createDrop(monster.x, monster.y, reward);
      if (this.economy) {
        this.economy.addRaw("cash", reward);
        this.worldFx.push({ x: monster.x, y: monster.y, text: `+${reward} 💵`, color: "#FFD700", life: 1.5, maxLife: 1.5 });
        fetch(this.N8N_WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: this.username,
            event: "monster_kill",
            reward: reward,
            cash: this.economy.cash,
            gems: this.economy.gems,
            army_power: this.economy.power,
            last_active: Date.now()
          })
        }).catch(() => {});
      }
    }
  }

  damageHero(dmg) {
    this.leader.hp = Math.max(0, this.leader.hp - dmg);
    if (this.leader.hp <= 0) {
      this.leader.hp = this.leader.maxHp;
      this.leader.x = this.W / 2;
      this.leader.y = this.H / 2;
      this.leader.path = null;
    }
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

  enterWorldMap() {
    const canvas = document.getElementById("gameCanvas");
    if (canvas) canvas.classList.remove("hidden");
    if (!this.running) this.start();
  }

  exitWorldMap() {
    this.stop();
    const canvas = document.getElementById("gameCanvas");
    if (canvas) canvas.classList.add("hidden");
    if (this.onExit) this.onExit();
  }
}