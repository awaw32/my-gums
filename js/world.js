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
  constructor(economy) {
    this.economy = economy;
    this.W = 2400;
    this.H = 2400;
    this.engine = null;
    this.running = false;

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

  // ==================== دالة تهيئة الجيش (مُصلحة) ====================
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

    // === تهيئة الجيش هنا (بعد تعريف الدالة) ===
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

  // ==================== باقي الدوال (مختصرة للتوضيح) ====================
  // (سأعطيك النسخة الكاملة إذا أردت، لكن هذه النسخة تحتوي على الإصلاح الأساسي)

  spawnMonsters() { /* ... */ }
  createMonster(spawnX, spawnY) { /* ... */ }
  onTap(wx, wy) { /* ... */ }
  update(dt, ctx, cam) { /* ... */ }
  // ... باقي الدوال كما في النسخة السابقة

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
}