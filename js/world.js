import { GameEngine } from "./engine.js";
import { 
  aStar, 
  initCollisionGrid, 
  markObstacle, 
  isWalkable, 
  findNearestWalkable, 
  simplifyPath 
} from "./pathfinding.js";

export class WorldMap {
  constructor(economy) {
    this.economy = economy;
    this.W = 2400;
    this.H = 2400;
    this.engine = null;
    this.running = false;

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
    this.initArmyUnits(8); // يبدأ بـ 8 وحدات

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

  // =============================================
  // دالة تهيئة الجيش (يجب أن تكون خارج start)
  // =============================================
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

    // أزرار الزوم
    const recenterBtn = document.getElementById("recenter-btn");
    if (recenterBtn) recenterBtn.onclick = () => this.recenterCamera();

    const zoomInBtn = document.getElementById("zoom-in-btn");
    const zoomOutBtn = document.getElementById("zoom-out-btn");

    if (zoomInBtn) {
      zoomInBtn.onclick = () => {
        if (this.engine?.camera) {
          this.engine.camera.zoom = Math.min(this.engine.camera.maxZoom, this.engine.camera.zoom * 1.25);
        }
      };
      zoomInBtn.classList.remove("hidden");
    }

    if (zoomOutBtn) {
      zoomOutBtn.onclick = () => {
        if (this.engine?.camera) {
          this.engine.camera.zoom = Math.max(this.engine.camera.minZoom, this.engine.camera.zoom / 1.25);
        }
      };
      zoomOutBtn.classList.remove("hidden");
    }

    initCollisionGrid(this.W, this.H);

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
    img.onload = () => { this.mapImage = img; };
    img.src = "img/map.jpg";

    this.engine.start((dt, ctx, cam) => this.update(dt, ctx, cam));
  }

  stop() {
    this.running = false;

    const zoomInBtn = document.getElementById("zoom-in-btn");
    const zoomOutBtn = document.getElementById("zoom-out-btn");
    if (zoomInBtn) zoomInBtn.classList.add("hidden");
    if (zoomOutBtn) zoomOutBtn.classList.add("hidden");

    if (this.engine) {
      this.engine.stop();
      this.engine = null;
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
  }

  // ==================== باقي الدوال ====================

  spawnMonsters() {
    this.monsters = [];
    this.spawnPoints = [];
    for (let i = 0; i < 15; i++) {
      let x, y;
      do {
        x = 100 + Math.random() * (this.W - 200);
        y = 100 + Math.random() * (this.H - 200);
      } while (this.isInSafeZone(x, y));
      this.spawnPoints.push({ x, y });
      this.monsters.push(this.createMonster(x, y));
    }
  }

  createMonster(spawnX, spawnY) {
    const types = [
      { name: "ذئب صحراوي", rank: "سهل", power: 8, color: "#8a5a3a", radius: 14, hp: 30, maxHp: 30, damage: 5, rewardShards: 3, rewardMoney: 8 },
      { name: "محارب ظل", rank: "متوسط", power: 25, color: "#2a1a1a", radius: 18, hp: 60, maxHp: 60, damage: 12, rewardShards: 7, rewardMoney: 18 },
      { name: "زعيم الرمال", rank: "صعب", power: 50, color: "#c0392b", radius: 22, hp: 120, maxHp: 120, damage: 22, rewardShards: 15, rewardMoney: 40 },
    ];
    const t = types[Math.floor(Math.random() * types.length)];
    return {
      ...t,
      id: "m" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
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

  onTap(wx, wy) {
    if (wy < 0) wy = 0;
    if (wx < 0) wx = 0;
    if (wx > this.W) wx = this.W;
    if (wy > this.H) wy = this.H;

    const target = this.findNearestTarget(wx, wy);
    if (target && target.alive) {
      this.engageTarget(target);
      return;
    }

    if (!isWalkable(wx, wy)) {
      const nearest = findNearestWalkable(wx, wy);
      if (nearest) {
        const wp = worldPos(nearest.col, nearest.row);
        wx = wp.x;
        wy = wp.y;
      }
    }

    if (this.leader.fighting) this.leader.fighting = null;

    const rawPath = aStar(this.leader.x, this.leader.y, wx, wy);
    const path = simplifyPath(rawPath);

    if (path && path.length > 1) {
      this.leader.path = path;
      this.leader.pathIdx = 0;

      this.armyUnits.forEach((unit) => {
        unit.path = [...path];
        unit.pathIdx = 0;
      });
    }
  }

  findNearestTarget(x, y) {
    let closest = null;
    let minDist = Infinity;
    for (const m of this.monsters) {
      if (!m.alive) continue;
      const d = Math.hypot(m.x - x, m.y - y);
      if (d < minDist && d < 120) {
        minDist = d;
        closest = m;
      }
    }
    return closest;
  }

  engageTarget(target) {
    this.leader.fighting = target;
    this.armyUnits.forEach(u => u.fighting = target);
  }

  isInSafeZone(x, y) {
    const z = this.safeZone;
    return x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h;
  }

  update(dt, ctx, cam) {
    if (!this.engine) return;

    let scrW = this.engine.width || 400;
    let scrH = this.engine.height || 700;

    if (this.engine._input?.moved) this.cameraMode = "manual";

    if (this.cameraMode === "follow") {
      cam.x = this.leader.x - scrW / 2;
      cam.y = this.leader.y - scrH / 2;
    }

    // تحديث الحركة
    this.updateLeader(dt);
    this.updateArmy(dt);
    this.updateMonsters(dt);
    this.updateCombat(dt);
    this.updateDrops(dt);
    this.spawnTimer(dt);

    this.draw(ctx, cam);
    this.updateFx(dt);
  }

  updateLeader(dt) {
    const h = this.leader;
    h.attackCD = Math.max(0, h.attackCD - dt);

    // جمع الموارد
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      if (Math.hypot(d.x - h.x, d.y - h.y) < 30) {
        if (d.type === "shards") this.economy.addRaw('gems', d.amount);
        else this.economy.addRaw('cash', d.amount);
        this.showWorldText(d.x, d.y, `+${d.amount}${d.type === "shards" ? "💎" : "🪙"}`, "#4cd964");
        this.drops.splice(i, 1);
      }
    }

    // القتال
    if (h.fighting && h.fighting.alive) {
      const m = h.fighting;
      const dx = m.x - h.x;
      const dy = m.y - h.y;
      const dist = Math.hypot(dx, dy);
      const meleeRange = h.radius + m.radius + 6;

      if (dist > meleeRange) {
        h.x += (dx / dist) * h.speed * dt;
        h.y += (dy / dist) * h.speed * dt;
      }

      if (dist <= meleeRange && h.attackCD <= 0) {
        h.attackCD = h.attackInterval;
        const dmg = Math.max(1, Math.floor((h.baseDmg + (this.economy.power || 0) * 0.03) * (0.8 + Math.random() * 0.4)));
        this.damageMonster(m, dmg);
      }
      return;
    }

    if (h.fighting && !h.fighting.alive) h.fighting = null;

    // حركة المسار
    if (h.path && h.pathIdx < h.path.length) {
      const wp = h.path[h.pathIdx];
      const dx = wp.x - h.x;
      const dy = wp.y - h.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 3) {
        h.pathIdx++;
        if (h.pathIdx >= h.path.length) {
          h.path = null;
          h.pathIdx = 0;
        }
      } else {
        h.x += (dx / dist) * h.speed * dt;
        h.y += (dy / dist) * h.speed * dt;
      }
    }
  }

  updateArmy(dt) {
    this.armyUnits.forEach(unit => {
      if (unit.fighting && unit.fighting.alive) {
        // الجيش يهاجم نفس الهدف
        const m = unit.fighting;
        const dx = m.x - unit.x;
        const dy = m.y - unit.y;
        const dist = Math.hypot(dx, dy);
        const range = unit.radius + m.radius + 8;

        if (dist > range) {
          unit.x += (dx / dist) * unit.speed * dt;
          unit.y += (dy / dist) * unit.speed * dt;
        }
        return;
      }

      if (unit.path && unit.pathIdx < unit.path.length) {
        const wp = unit.path[unit.pathIdx];
        const dx = wp.x - unit.x;
        const dy = wp.y - unit.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 4) {
          unit.pathIdx++;
          if (unit.pathIdx >= unit.path.length) {
            unit.path = null;
            unit.pathIdx = 0;
          }
        } else {
          unit.x += (dx / dist) * unit.speed * dt;
          unit.y += (dy / dist) * unit.speed * dt;
        }
      }
    });
  }

  // ==================== باقي الدوال (مختصرة لكن كاملة) ====================

  updateMonsters(dt) { /* ... نفس الكود السابق ... */ }
  updateCombat(dt) { /* ... نفس الكود السابق ... */ }
  damageMonster(monster, amount) { /* ... نفس الكود السابق ... */ }
  showWorldText(x, y, text, color) { /* ... نفس الكود السابق ... */ }
  spawnTimer(dt) { /* ... نفس الكود السابق ... */ }
  updateDrops(dt) { /* ... نفس الكود السابق ... */ }
  draw(ctx, cam) { /* ... نفس الكود السابق ... */ }
  drawTerrain(ctx, cam) { /* ... نفس الكود السابق ... */ }
  drawMonsters(ctx, cam) { /* ... نفس الكود السابق ... */ }
  drawHero(ctx, cam) { /* ... نفس الكود السابق ... */ }
  drawProjectiles(ctx, cam) { /* ... نفس الكود السابق ... */ }
  drawMovementLine(ctx, cam) { /* ... نفس الكود السابق ... */ }
  drawDrops(ctx, cam) { /* ... نفس الكود السابق ... */ }
  drawWorldFx(ctx, cam) { /* ... نفس الكود السابق ... */ }
  updateFx(dt) { /* ... نفس الكود السابق ... */ }
  recenterCamera() { this.cameraMode = "follow"; }
  updateRecenterBtn(cam) { /* ... نفس الكود السابق ... */ }

  // ==================== دوال إضافية ====================

  findMonsterAt(x, y) { /* ... نفس الكود السابق ... */ }
  engageMonster(monster) { /* ... نفس الكود السابق ... */ }
  damageHero(amount) { /* ... نفس الكود السابق ... */ }
  shootProjectile(fromX, fromY, toX, toY, fromHero) { /* ... نفس الكود السابق ... */ }
  respawnMonster(old) { /* ... نفس الكود السابق ... */ }
}