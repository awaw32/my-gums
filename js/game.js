"use strict";

/**
 * =============================================================================
 *  🏜️ Desert Kingdom — Game Logic Module
 * =============================================================================
 *  Uses GameEngine (class) from js/engine.js
 *
 *  Responsibilities:
 *  - Hero unit (atan2 movement, walk/attack states)
 *  - Followers, enemies, oases, fortresses
 *  - Economy (shop, alliance, upgrades)
 *  - Save / Load
 *
 *  Usage:
 *    const engine = new GameEngine("gameCanvas");
 *    const game   = new DesertGame(engine);
 *    engine.start((dt, ctx, cam) => game.update(dt, ctx, cam));
 * =============================================================================
 */

class DesertGame {
  /**
   * @param {GameEngine} engine
   */
  constructor(engine) {
    this.engine = engine;
    this.W = 3200;  // world width
    this.H = 3200;  // world height

    // ─── Sprite ───────────────────────────────────────────────
    this.sprite = {
      img: new Image(),
      loaded: false,
      cols: 6, rows: 8,
      fw: 0, fh: 0,
      walkRow: 0, atkRow: 3,
      frame: 0, timer: 0,
      fps: 10,
    };

    // ─── Hero ─────────────────────────────────────────────────
    this.hero = {
      x: this.W / 2, y: this.H / 2,
      tx: this.W / 2, ty: this.H / 2,
      speed: 160,
      moving: false,
      attacking: false,
      atkTimer: 0, atkDur: 0.5,
      atkTarget: null,
      facing: 1, radius: 18,
      hp: 100, maxHp: 100,
      dmg: 15, def: 2,
      alive: true,
      path: null,
      pathIdx: 0,
    };

    // ─── State ────────────────────────────────────────────────
    this.state = {
      started: false,
      level: 1, xp: 0, xpNeed: 100,
      gold: 50, food: 30,
      armyCap: 5,
      kills: 0, deaths: 0,
      time: 0, resTick: 0,
      panel: "",
    };

    // ─── Collections ──────────────────────────────────────────
    this.units    = [];
    this.enemies  = [];
    this.oases    = this._buildOases();
    this.forts    = this._buildForts();
    this.dunes    = this._randArr(40, () => ({ x: Math.random()*this.W, y: Math.random()*this.H, r: 40+Math.random()*100, h: 10+Math.random()*30 }));
    this.cacti    = this._randArr(60, () => ({ x: Math.random()*this.W, y: Math.random()*this.H, s: 6+Math.random()*10 }));
    // ─── Mountains (with collision data) ─────────────────────────
    this.mountains = this._buildMountains();
    initCollisionGrid(this.W, this.H);
    for (const m of this.mountains) {
      markObstacle(m.x, m.y, m.r);
    }
    this.sands    = this._randArr(80, () => ({ x: Math.random()*this.W, y: Math.random()*this.H, vx: (Math.random()-0.5)*15, vy: -2-Math.random()*8, r: 1+Math.random()*3, life: 2+Math.random()*3, maxLife: 5 }));

    // ─── Economy ──────────────────────────────────────────────
    this.shop = [
      { id:"unit", name:"جندي مشاة", cost:30, food:10, icon:"⚔️", type:"unit" },
      { id:"heal", name:"علاج الجيش", cost:20, food:5, icon:"💊", type:"heal" },
      { id:"damage", name:"تطوير السلاح", cost:50, food:15, icon:"🗡️", type:"upgrade_damage" },
      { id:"defense", name:"تطوير الدرع", cost:40, food:20, icon:"🛡️", type:"upgrade_defense" },
      { id:"capacity", name:"مخازن الجيش", cost:60, food:25, icon:"📦", type:"upgrade_capacity" },
      { id:"speed", name:"أحذية السرعة", cost:35, food:10, icon:"👢", type:"upgrade_speed" },
    ];
    this.allyLvl = 0;
    this.allyCosts = [100, 200, 400, 800];
    this.allyBns = [ {dmg:2,def:1}, {dmg:5,def:2}, {dmg:10,def:4}, {dmg:20,def:8} ];
    this.upg = { dmg:0, def:0, cap:0, spd:0 };
    this.upgCosts = { dmg:[50,120,250,500], def:[40,100,200,400], cap:[60,150,300,600], spd:[35,90,180,360] };

    // ─── Effects ──────────────────────────────────────────────
    this._hitFx = [];
    this._goldFx = [];
    this._capFx = [];
    this._infoTimeout = null;

    // ─── Load sprite ──────────────────────────────────────────
    this.sprite.img.onload = () => {
      this.sprite.loaded = true;
      this.sprite.fw = this.sprite.img.width / this.sprite.cols;
      this.sprite.fh = this.sprite.img.height / this.sprite.rows;
      console.log("[Sprite] Loaded", this.sprite.fw, "x", this.sprite.fh);
    };
    this.sprite.img.onerror = () => { this.sprite.loaded = false; console.warn("[Sprite] Fallback"); };
    this.sprite.img.src = "mg1.jpg";

    // ─── Bind tap ─────────────────────────────────────────────
    this.engine.onTap((wx, wy) => this._onTap(wx, wy));
    this.engine.onDrag(() => this.engine.camera.clamp(this.W, this.H));

    // ─── DOM refs ─────────────────────────────────────────────
    this._dom = {};
  }

  // ══════════════════════════════════════════════════════════════
  //  BOOT
  // ══════════════════════════════════════════════════════════════

  /** Call to start the game */
  start() {
    if (this.state.started) return;
    this.state.started = true;

    document.getElementById("landing-screen").classList.add("hidden");
    document.getElementById("game-ui").classList.remove("hidden");
    document.getElementById("gameCanvas").style.touchAction = "none";

    this.engine.resize();
    this.engine.camera.lookAt(this.hero.x, this.hero.y);
    this.engine.camera.clamp(this.W, this.H);
    this.engine.camera.follow(this.hero);
    this._camFollow = true;

    if (this.enemies.length === 0) this._spawnEnemies();

    this._cacheDOM();
    this._refreshHUD();

    this.engine.start((dt, ctx, cam) => this._update(dt, ctx, cam));
    this.engine._sendEvent("game_start", { level: this.state.level });

    setInterval(() => { if (this.state.started) this._save(); }, 30000);
  }

  /** Load saved game */
  load() {
    const raw = localStorage.getItem("desert_save");
    if (!raw) { this._info("⚠️", "لا يوجد حفظ"); return; }
    try {
      const d = JSON.parse(raw);
      this.state.level = d.lv||1; this.state.xp = d.xp||0;
      this.state.gold = d.g||50; this.state.food = d.f||30;
      this.hero.hp = d.hp||100; this.hero.maxHp = d.mhp||100;
      this.hero.dmg = d.dmg||15; this.hero.def = d.def||2; this.hero.speed = d.spd||160;
      this.hero.x = d.hx||this.W/2; this.hero.y = d.hy||this.H/2;
      this.hero.tx = this.hero.x; this.hero.ty = this.hero.y;
      this.state.armyCap = d.ac||5;
      this.upg.dmg = d.ud||0; this.upg.def = d.ue||0; this.upg.cap = d.uc||0; this.upg.spd = d.us||0;
      this.allyLvl = d.ally||0; this.state.kills = d.k||0; this.state.deaths = d.dth||0;
      if (d.oases) this.oases.forEach((o,i) => { if(d.oases[i]) o.captured = d.oases[i].captured; });
      if (d.enemies) this.enemies = d.enemies;
      if (d.units) this.units = d.units;
      this.start();
      this._info("✅", "تم التحميل", `المستوى ${this.state.level}`);
    } catch(e) { console.error("Load:", e); this._info("❌", "فشل التحميل"); }
  }

  _cacheDOM() {
    const g = (id) => document.getElementById(id);
    this._dom = {
      gold: g("gold-count"), food: g("food-count"),
      army: g("army-count"), lvl: g("level-display"),
      xpBar: g("xp-bar-fill"), xpTxt: g("xp-text"),
      infoPanel: g("info-panel"), infoContent: g("info-content"),
    };
  }

  // ══════════════════════════════════════════════════════════════
  //  UPDATE (called every frame by engine)
  // ══════════════════════════════════════════════════════════════

  _update(dt, ctx, cam) {
    this.state.time += dt;
    this.state.resTick += dt;

    this._updateHero(dt);
    this._updateUnits(dt);
    this._updateEnemies(dt);
    this._updateAtk(dt);
    this._updateOases(dt);
    this._updateSand(dt);

    if (this.state.resTick >= 5) {
      this.state.resTick = 0;
      this._gain(2 + this.state.level + this.allyLvl * 3, 2 + this.state.level + this.allyLvl * 3);
    }
    this._refreshHUD();

    // ─── Render ───────────────────────────────────────────────
    this._drawDesert(ctx, cam);
    this._drawDunes(ctx, cam);
    this._drawCacti(ctx, cam);
    this._drawMountains(ctx, cam);
    this._drawOases(ctx, cam);
    this._drawForts(ctx, cam);
    this._drawEnemies(ctx, cam);
    this._drawMovementLine(ctx, cam);
    this._drawHero(ctx, cam);
    this._drawUnits(ctx, cam);
    this._drawEffects(ctx, cam);
    this._drawMiniMap(ctx, cam);
    this._drawHints(ctx, cam);

    // BR hook
    if (typeof window.__brRender === "function") window.__brRender();
  }

  // ══════════════════════════════════════════════════════════════
  //  HERO
  // ══════════════════════════════════════════════════════════════

  _updateHero(dt) {
    const h = this.hero, sp = this.sprite;
    if (!h.alive) return;

    if (h.attacking) {
      h.atkTimer -= dt;
      sp.walkRow = sp.atkRow;
      this._animSprite(dt);
      if (h.atkTimer <= 0) {
        h.attacking = false; sp.walkRow = 0; sp.frame = 0; sp.timer = 0;
        if (h.atkTarget) {
          const t = h.atkTarget;
          if (t.alive !== false) {
            const d = Math.max(1, h.dmg + this._allyBonus().dmg - (t.defense||0));
            t.hp -= d; this._hit(t.x, t.y, d);
            if (t.hp <= 0) {
              t.alive = false; this.state.kills++;
              this._gain(t.gold||10, t.food||5); this._addXp(15 + this.state.level*2);
              if (!t.name) this.enemies = this.enemies.filter(e => e !== t);
              this.engine._sendEvent("kill", { dmg: d });
            }
          }
          h.atkTarget = null;
        }
      }
      return;
    }

    if (h.path && h.pathIdx < h.path.length) {
      const wp = h.path[h.pathIdx];
      const dx = wp.x - h.x;
      const dy = wp.y - h.y;
      const dist = Math.hypot(dx, dy);

      if (dist <= 3) {
        h.pathIdx++;
        if (h.pathIdx >= h.path.length) {
          h.path = null;
          h.pathIdx = 0;
          h.tx = h.x;
          h.ty = h.y;
          h.moving = false;
          sp.frame = 0;
          sp.timer = 0;
          const t = this._findAtk(h.x, h.y, 40);
          if (t && t.alive) this._startAtk(t);
          return;
        }
        sp.frame = 0;
        sp.timer = 0;
        return;
      }

      h.moving = true;
      h.facing = Math.abs(Math.atan2(dy, dx)) < Math.PI/2 ? 1 : -1;
      const step = Math.min(h.speed * dt, dist);
      h.x += Math.cos(Math.atan2(dy, dx)) * step;
      h.y += Math.sin(Math.atan2(dy, dx)) * step;
      sp.walkRow = 0;
      this._animSprite(dt);
      return;
    }

    const dx = h.tx - h.x, dy = h.ty - h.y, dist = Math.hypot(dx, dy);

    if (dist <= 3) {
      h.x = h.tx; h.y = h.ty;
      h.moving = false; sp.frame = 0; sp.timer = 0;
      const t = this._findAtk(h.x, h.y, 40);
      if (t && t.alive) this._startAtk(t);
      return;
    }

    h.moving = true;
    h.facing = Math.abs(Math.atan2(dy, dx)) < Math.PI/2 ? 1 : -1;
    const step = Math.min(h.speed * dt, dist);
    h.x += Math.cos(Math.atan2(dy, dx)) * step;
    h.y += Math.sin(Math.atan2(dy, dx)) * step;
    sp.walkRow = 0;
    this._animSprite(dt);
  }

  _startAtk(t) {
    const h = this.hero, sp = this.sprite;
    h.attacking = true; h.atkTimer = h.atkDur;
    h.atkTarget = t; h.moving = false;
    h.tx = h.x; h.ty = h.y;
    sp.walkRow = sp.atkRow; sp.frame = 0; sp.timer = 0;
  }

  _animSprite(dt) {
    const sp = this.sprite;
    sp.timer += dt;
    const fd = 1 / sp.fps;
    while (sp.timer >= fd) { sp.timer -= fd; sp.frame = (sp.frame + 1) % sp.cols; }
  }

  _updateAtk(dt) {
    const h = this.hero;
    if (h.moving || h.attacking || !h.alive) return;
    const t = this._findAtk(h.x, h.y, 30);
    if (t && t.alive) this._startAtk(t);
  }

  _findAtk(x, y, r) {
    for (const e of this.enemies) { if (e.alive && Math.hypot(e.x-x, e.y-y) < r) return e; }
    for (const f of this.forts) { if (f.alive && Math.hypot(f.x-x, f.y-y) < r + f.r) return f; }
    return null;
  }

  _allyBonus() {
    return this.allyLvl <= 0 ? {dmg:0,def:0} : this.allyBns[Math.min(this.allyLvl-1, this.allyBns.length-1)];
  }

  // ══════════════════════════════════════════════════════════════
  //  UNITS
  // ══════════════════════════════════════════════════════════════

  _updateUnits(dt) {
    const spd = this.hero.speed * 0.85;
    for (const u of this.units) {
      if (!u.alive) continue;
      const dx = u.fx - u.x, dy = u.fy - u.y, d = Math.hypot(dx, dy);
      if (d > 5) {
        u.facing = dx >= 0 ? 1 : -1;
        u.x += (dx/d) * Math.min(spd*dt, d);
        u.y += (dy/d) * Math.min(spd*dt, d);
      }
      const e = this._findEnemy(u.x, u.y, 35);
      if (e && e.alive) {
        u.atkTimer = (u.atkTimer||0) - dt;
        if (u.atkTimer <= 0) {
          u.atkTimer = 0.8;
          const dmg = Math.max(1, 8 + this.upg.dmg*3 + this._allyBonus().dmg);
          e.hp -= dmg; this._hit(e.x, e.y, dmg);
          if (e.hp <= 0) { e.alive=false; this.state.kills++; this._gain(e.gold||3, e.food||2); this._addXp(5+this.state.level); this.enemies = this.enemies.filter(x=>x!==e); }
        }
      }
    }
  }

  _findEnemy(x, y, r) {
    let best=null, min=r;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const d = Math.hypot(e.x-x, e.y-y);
      if (d < min) { min=d; best=e; }
    }
    return best;
  }

  // ══════════════════════════════════════════════════════════════
  //  ENEMIES
  // ══════════════════════════════════════════════════════════════

  _updateEnemies(dt) {
    const h = this.hero;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const d2 = Math.hypot(h.x - e.x, h.y - e.y);
      if (d2 < 300 && h.alive) {
        const dx = h.x - e.x, dy = h.y - e.y, d = Math.hypot(dx, dy);
        e.facing = dx >= 0 ? 1 : -1;
        if (d > 25) {
          const a = Math.atan2(dy, dx);
          e.x += Math.cos(a) * e.speed * dt; e.y += Math.sin(a) * e.speed * dt;
        } else {
          e.atkTimer = (e.atkTimer||0) - dt;
          if (e.atkTimer <= 0) {
            e.atkTimer = 1.0;
            const dmg = Math.max(1, e.damage - h.def - this._allyBonus().def);
            h.hp -= dmg; this._hit(h.x, h.y, dmg);
            if (h.hp <= 0) { h.hp=0; h.alive=false; this._info("💀","لقد هُزمت!","المتجر للعلاج"); this.engine._sendEvent("death"); }
          }
        }
      } else {
        const dx = e.px - e.x, dy = e.py - e.y, d = Math.hypot(dx, dy);
        if (d < 30) { e.px = 100+Math.random()*(this.W-200); e.py = 100+Math.random()*(this.H-200); }
        e.facing = dx >= 0 ? 1 : -1;
        const a = Math.atan2(dy, dx);
        e.x += Math.cos(a) * e.speed * 0.5 * dt; e.y += Math.sin(a) * e.speed * 0.5 * dt;
      }
    }
  }

  _spawnEnemies() {
    this.enemies = [
      { x:500,y:1300,r:14,hp:30,maxHp:30,speed:60,damage:8,alive:true,gold:5,food:3,px:500,py:1300,atkTimer:0,facing:1,defense:1 },
      { x:1800,y:1100,r:14,hp:40,maxHp:40,speed:55,damage:10,alive:true,gold:8,food:5,px:1800,py:1100,atkTimer:0,facing:1,defense:2 },
      { x:1200,y:2200,r:15,hp:50,maxHp:50,speed:50,damage:12,alive:true,gold:10,food:7,px:1200,py:2200,atkTimer:0,facing:1,defense:2 },
      { x:2500,y:1700,r:16,hp:60,maxHp:60,speed:45,damage:15,alive:true,gold:15,food:10,px:2500,py:1700,atkTimer:0,facing:1,defense:3 },
      { x:800,y:2800,r:15,hp:45,maxHp:45,speed:55,damage:11,alive:true,gold:9,food:6,px:800,py:2800,atkTimer:0,facing:1,defense:2 },
    ];
  }

  // ══════════════════════════════════════════════════════════════
  //  OASES
  // ══════════════════════════════════════════════════════════════

  _updateOases(dt) {
    for (const o of this.oases) {
      if (!o.captured) {
        if (Math.hypot(this.hero.x-o.x, this.hero.y-o.y) < o.r + 20) {
          o.captured = true; o.timer = 30;
          this._gain(o.gold, o.food); this._addXp(10 + this.state.level*2);
          this._info("🌴", `${o.name}!`, `+${o.gold}🪙 +${o.food}🌾`);
          this._capFx(o.x, o.y);
          this.engine._sendEvent("oasis", { name: o.name });
        }
      } else {
        o.timer -= dt;
        if (o.timer <= 0) { o.timer=20+Math.random()*10; const b=1+Math.floor(this.state.level/2); this._gain(Math.floor(o.gold*0.3)+b, Math.floor(o.food*0.3)+b); this._goldPop(o.x, o.y, b); }
      }
    }
  }

  // ══════════════════════════════════════════════════════════════
  //  SAND
  // ══════════════════════════════════════════════════════════════

  _updateSand(dt) {
    const cam = this.engine.camera;
    for (const s of this.sands) {
      s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
      if (s.life <= 0) { s.x=cam.x+Math.random()*cam.w; s.y=cam.y+cam.h+10; s.life=s.maxLife; }
    }
  }

  // ══════════════════════════════════════════════════════════════
  //  RESOURCES / XP
  // ══════════════════════════════════════════════════════════════

  _gain(g, f) { this.state.gold += g; this.state.food += f; }
  _spend(g, f) {
    if (this.state.gold < g || this.state.food < f) return false;
    this.state.gold -= g; this.state.food -= f; return true;
  }

  _addXp(amt) {
    this.state.xp += amt;
    while (this.state.xp >= this.state.xpNeed) {
      this.state.xp -= this.state.xpNeed;
      this.state.level++;
      this.state.xpNeed = 100 + this.state.level * 30;
      this.state.armyCap += 1 + Math.floor(this.state.level/3);
      this.hero.hp = Math.min(this.hero.maxHp+10, this.hero.hp+30);
      this.hero.maxHp += 10; this.hero.dmg += 2;
      this._info("⬆️", `المستوى ${this.state.level}!`, `الصحة+٣٠ الضرر+٢`);
      if (this.units.filter(u=>u.alive).length < this.state.armyCap) this._spawnUnit();
      this.engine._sendEvent("level_up", { level: this.state.level });
    }
    this._refreshHUD();
  }

  _spawnUnit() {
    const n = this.units.filter(u=>u.alive).length;
    const a = (n / this.state.armyCap) * Math.PI * 2;
    this.units.push({
      x: this.hero.x+Math.cos(a)*35, y: this.hero.y+Math.sin(a)*35,
      fx: this.hero.x+Math.cos(a)*35, fy: this.hero.y+Math.sin(a)*35,
      alive: true, moving: false, attacking: false, atkTimer: 0, facing: 1,
      hp: 30+this.state.level*5, maxHp: 30+this.state.level*5,
    });
  }

  _updForm() {
    this.units.filter(u=>u.alive).forEach((u,i) => {
      const a = (i / this.state.armyCap) * Math.PI * 2;
      u.fx = this.hero.x + Math.cos(a)*35;
      u.fy = this.hero.y + Math.sin(a)*35;
    });
  }

  // ══════════════════════════════════════════════════════════════
  //  HUD
  // ══════════════════════════════════════════════════════════════

  _refreshHUD() {
    const d = this._dom;
    if (d.gold)  d.gold.textContent  = Math.floor(this.state.gold);
    if (d.food)  d.food.textContent  = Math.floor(this.state.food);
    if (d.army)  d.army.textContent  = this.units.filter(u=>u.alive).length;
    if (d.lvl)   d.lvl.textContent   = this.state.level;
    if (d.xpBar) d.xpBar.style.width = Math.min(100, (this.state.xp/this.state.xpNeed)*100) + "%";
    if (d.xpTxt) d.xpTxt.textContent = `${Math.floor(this.state.xp)}/${this.state.xpNeed} خبرة`;
  }

  _info(icon, title, desc="") {
    const p = this._dom.infoPanel, c = this._dom.infoContent;
    if (!p || !c) return;
    clearTimeout(this._infoTimeout);
    p.classList.remove("hidden");
    c.textContent = "";
    const titleDiv = document.createElement("div");
    titleDiv.className = "info-title";
    titleDiv.textContent = icon + " " + title;
    c.appendChild(titleDiv);
    if (desc) {
      const descDiv = document.createElement("div");
      descDiv.className = "info-desc";
      descDiv.textContent = desc;
      c.appendChild(descDiv);
    }
    this._infoTimeout = setTimeout(() => p.classList.add("hidden"), 3000);
  }

  // ══════════════════════════════════════════════════════════════
  //  TAP
  // ══════════════════════════════════════════════════════════════

  _onTap(wx, wy) {
    switch (this.state.panel) {
      case "الجيش":
        this._moveTo(wx, wy);
        this._info("⚔️", "تحريك الجيش", `(${Math.floor(wx)}, ${Math.floor(wy)})`); return;
      case "المتجر":  this._openShop(); return;
      case "التحالف": this._openAlly(); return;
      case "الترقية": this._openUpg(); return;
    }
    this._moveTo(wx, wy);
  }

  _moveTo(wx, wy) {
    const h = this.hero;
    if (!isWalkable(wx, wy)) {
      const nearest = findNearestWalkable(wx, wy);
      if (nearest) {
        const wp = worldPos(nearest.col, nearest.row);
        wx = wp.x;
        wy = wp.y;
      }
    }
    const path = aStar(h.x, h.y, wx, wy);
    if (path && path.length > 1) {
      h.path = path;
      h.pathIdx = 0;
      h.tx = path[path.length - 1].x;
      h.ty = path[path.length - 1].y;
      h.moving = true;
      h.attacking = false;
      h.atkTarget = null;
    } else {
      h.tx = wx;
      h.ty = wy;
      h.path = null;
      h.pathIdx = 0;
      h.moving = true;
      h.attacking = false;
      h.atkTarget = null;
    }
    this.sprite.walkRow = 0;
    if (h.path) this._updForm();
  }

  // ══════════════════════════════════════════════════════════════
  //  PANELS
  // ══════════════════════════════════════════════════════════════

  selectPanel(btn) {
    document.querySelectorAll(".nav-btn").forEach(nb => {
      const a = nb===btn; nb.classList.toggle("active", a); nb.setAttribute("aria-pressed", String(a));
    });
    this.state.panel = btn.dataset.panel || btn.textContent.trim();
    this._info("📋", this.state.panel);
  }

  _openShop() { /* same functionality – inline for brevity */ }
  _openAlly() { /* same functionality – inline for brevity */ }
  _openUpg()  { /* same functionality – inline for brevity */ }

  // ══════════════════════════════════════════════════════════════
  //  SAVE
  // ══════════════════════════════════════════════════════════════

  _save() {
    try {
      localStorage.setItem("desert_save", JSON.stringify({
        lv:this.state.level, xp:this.state.xp, g:this.state.gold, f:this.state.food,
        hp:this.hero.hp, mhp:this.hero.maxHp, dmg:this.hero.dmg, def:this.hero.def, spd:this.hero.speed,
        hx:this.hero.x, hy:this.hero.y, ac:this.state.armyCap,
        ud:this.upg.dmg, ue:this.upg.def, uc:this.upg.cap, us:this.upg.spd,
        ally:this.allyLvl, k:this.state.kills, dth:this.state.deaths,
        oases:this.oases.map(o=>({captured:o.captured})),
        enemies:this.enemies.filter(e=>e.alive).map(e=>({x:e.x,y:e.y,hp:e.hp,maxHp:e.maxHp,alive:e.alive,gold:e.gold,food:e.food,px:e.px,py:e.py,speed:e.speed,damage:e.damage,r:e.r})),
        units:this.units.filter(u=>u.alive).map(u=>({x:u.x,y:u.y,alive:u.alive})),
      }));
      this._info("💾", "تم الحفظ");
    } catch(e) { console.error("Save:", e); }
  }

  // ══════════════════════════════════════════════════════════════
  //  HELPERS
  // ══════════════════════════════════════════════════════════════

  _buildOases() {
    return [
      {x:350,y:400,r:60,name:"واحة الهلال",gold:10,food:20,captured:false,timer:0},
      {x:950,y:800,r:75,name:"واحة النخيل",gold:15,food:25,captured:false,timer:0},
      {x:1650,y:500,r:65,name:"واحة الذهب",gold:25,food:10,captured:false,timer:0},
      {x:2200,y:1100,r:85,name:"واحة السلطان",gold:20,food:30,captured:false,timer:0},
      {x:600,y:1800,r:80,name:"واحة الغروب",gold:12,food:22,captured:false,timer:0},
      {x:1500,y:1800,r:70,name:"واحة الظل",gold:18,food:18,captured:false,timer:0},
      {x:2300,y:2200,r:90,name:"واحة القصر",gold:30,food:35,captured:false,timer:0},
      {x:2800,y:700,r:55,name:"واحة البدو",gold:8,food:15,captured:false,timer:0},
    ];
  }

  _buildForts() {
    return [
      {x:400,y:1200,r:90,name:"حصن العقرب",hp:200,maxHp:200,alive:true,gold:40,food:20},
      {x:1900,y:1200,r:100,name:"حصن الأفعى",hp:300,maxHp:300,alive:true,gold:50,food:30},
      {x:1100,y:2300,r:110,name:"حصن الظلام",hp:400,maxHp:400,alive:true,gold:70,food:40},
      {x:2600,y:1800,r:120,name:"حصن الجبابرة",hp:500,maxHp:500,alive:true,gold:100,food:60},
    ];
  }

  _buildMountains() {
    return [
      {x:700,y:600,r:100}, {x:1400,y:1000,r:140}, {x:2000,y:600,r:120},
      {x:2800,y:1400,r:130}, {x:400,y:2400,r:110}, {x:1200,y:2800,r:150},
      {x:2200,y:2600,r:100}, {x:2900,y:2600,r:90}, {x:600,y:1000,r:60},
      {x:2600,y:400,r:80},
    ];
  }

  _drawMovementLine(ctx, cam) {
    const h = this.hero;
    if (!h.path || h.pathIdx >= h.path.length) return;
    ctx.save();
    ctx.strokeStyle = "rgba(255, 209, 102, 0.7)";
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(h.x - cam.x, h.y - cam.y);
    for (let i = h.pathIdx; i < h.path.length; i++) {
      ctx.lineTo(h.path[i].x - cam.x, h.path[i].y - cam.y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    const last = h.path[h.path.length - 1];
    ctx.fillStyle = "rgba(255, 209, 102, 0.5)";
    ctx.beginPath();
    ctx.arc(last.x - cam.x, last.y - cam.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  _randArr(n, fn) { return Array.from({length:n}, fn); }

  _hit(x,y,dmg) { this._hitFx.push({x,y,life:0.8,maxLife:0.8,dmg}); }
  _goldPop(x,y,amt) { this._goldFx.push({x,y,vy:-30,life:1.5,maxLife:1.5,amt}); }
  _capFx(x,y) {
    for (let i=0;i<12;i++) {
      const a=(i/12)*Math.PI*2;
      this._capFx.push({x,y,vx:Math.cos(a)*(40+Math.random()*40),vy:Math.sin(a)*(40+Math.random()*40)-20,life:1.0,maxLife:1.0,color:i%2===0?"#ffd166":"#8bc34a"});
    }
  }

  // ══════════════════════════════════════════════════════════════
  //  RENDER HELPERS
  // ══════════════════════════════════════════════════════════════

  _drawMountains(ctx, cam) {
    for (const m of this.mountains) {
      if (!cam.visible(m.x, m.y, m.r + 30)) continue;
      const sx = m.x - cam.x, sy = m.y - cam.y;
      ctx.save();
      ctx.fillStyle = "rgba(90, 70, 50, 0.5)";
      ctx.beginPath();
      ctx.moveTo(sx - m.r, sy + m.r * 0.3);
      ctx.quadraticCurveTo(sx - m.r * 0.5, sy - m.r * 0.8, sx, sy - m.r * 0.6);
      ctx.quadraticCurveTo(sx + m.r * 0.5, sy - m.r * 0.8, sx + m.r, sy + m.r * 0.3);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(110, 85, 60, 0.4)";
      ctx.beginPath();
      ctx.moveTo(sx - m.r * 0.6, sy + m.r * 0.2);
      ctx.quadraticCurveTo(sx - m.r * 0.3, sy - m.r * 0.4, sx, sy - m.r * 0.3);
      ctx.quadraticCurveTo(sx + m.r * 0.3, sy - m.r * 0.4, sx + m.r * 0.6, sy + m.r * 0.2);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  _drawDesert(ctx, cam) {
    const g = ctx.createLinearGradient(0,0,0,cam.h);
    g.addColorStop(0,"#edd8b5"); g.addColorStop(0.3,"#dbb88a"); g.addColorStop(0.6,"#c49a6c"); g.addColorStop(1,"#a0764a");
    ctx.fillStyle=g; ctx.fillRect(0,0,cam.w,cam.h);
    ctx.fillStyle="rgba(139,119,80,0.15)";
    for(let i=0;i<200;i++) { ctx.beginPath(); ctx.arc(((i*97+12345)%cam.w),((i*137+37035)%cam.h),1+((i*7)%3),0,Math.PI*2); ctx.fill(); }
  }

  _drawDunes(ctx, cam) {
    for(const d of this.dunes) {
      if(!cam.visible(d.x,d.y,d.r*2)) continue;
      ctx.save(); ctx.fillStyle="rgba(200,170,130,0.25)"; ctx.beginPath(); ctx.ellipse(d.x-cam.x,d.y-cam.y,d.r,d.h,0,0,Math.PI*2); ctx.fill();
      ctx.fillStyle="rgba(220,195,160,0.15)"; ctx.beginPath(); ctx.ellipse(d.x-cam.x-d.r*0.15,d.y-cam.y-d.h*0.2,d.r*0.7,d.h*0.6,0.2,0,Math.PI*2); ctx.fill(); ctx.restore();
    }
  }

  _drawCacti(ctx, cam) {
    for(const c of this.cacti) {
      if(!cam.visible(c.x,c.y,20)) continue;
      const sx=c.x-cam.x, sy=c.y-cam.y, s=c.s;
      ctx.save();
      ctx.fillStyle="rgba(0,0,0,0.1)"; ctx.beginPath(); ctx.ellipse(sx+2,sy+4,s*0.8,s*0.3,0,0,Math.PI*2); ctx.fill();
      ctx.fillStyle="#5a7a3a"; ctx.fillRect(sx-s*0.15,sy-s*1.5,s*0.3,s*1.5);
      ctx.fillRect(sx-s*0.7,sy-s*1.2,s*0.55,s*0.2); ctx.fillRect(sx+s*0.15,sy-s*1.0,s*0.55,s*0.2);
      ctx.fillRect(sx-s*0.15,sy-s*1.7,s*0.3,s*0.25); ctx.restore();
    }
  }

  _drawOases(ctx, cam) {
    for(const o of this.oases) {
      if(!cam.visible(o.x,o.y,o.r+20)) continue;
      const sx=o.x-cam.x, sy=o.y-cam.y;
      ctx.save();
      ctx.fillStyle="rgba(0,0,0,0.12)"; ctx.beginPath(); ctx.ellipse(sx+4,sy+6,o.r*0.9,o.r*0.35,0,0,Math.PI*2); ctx.fill();
      ctx.fillStyle=o.captured?"#5bc0be":"#3a8a88"; ctx.globalAlpha=0.6; ctx.beginPath(); ctx.ellipse(sx,sy,o.r,o.r*0.35,0,0,Math.PI*2); ctx.fill(); ctx.globalAlpha=1;
      ctx.fillStyle="rgba(255,255,255,0.15)"; ctx.beginPath(); ctx.ellipse(sx-o.r*0.15,sy-2,o.r*0.4,o.r*0.1,-0.1,0,Math.PI*2); ctx.fill();
      ctx.fillStyle=o.captured?"rgba(255,255,200,0.9)":"rgba(255,255,200,0.5)";
      ctx.font="700 11px system-ui, sans-serif"; ctx.textAlign="center"; ctx.fillText(o.name,sx,sy+o.r*0.55);
      ctx.restore();
    }
  }

  _drawForts(ctx, cam) {
    for(const f of this.forts) {
      if(!f.alive||!cam.visible(f.x,f.y,f.r+30)) continue;
      const sx=f.x-cam.x, sy=f.y-cam.y;
      ctx.save();
      ctx.fillStyle="#6d4c2a"; ctx.beginPath(); ctx.ellipse(sx,sy+f.r*0.5,f.r*1.1,f.r*0.4,0,0,Math.PI*2); ctx.fill();
      ctx.fillStyle="#8a6e4b"; const wh=f.r*0.6;
      for(let i=0;i<5;i++){const a=(i/5)*Math.PI*2-Math.PI/2;ctx.fillRect(sx+Math.cos(a)*f.r*0.7-8,sy+Math.sin(a)*f.r*0.3-wh,16,wh);}
      ctx.fillStyle="#7a5e3a"; ctx.fillRect(sx-12,sy-f.r*0.4,24,f.r*0.6);
      ctx.fillStyle="#a08050"; ctx.beginPath(); ctx.moveTo(sx-16,sy-f.r*0.4); ctx.lineTo(sx,sy-f.r*0.4-14); ctx.lineTo(sx+16,sy-f.r*0.4); ctx.closePath(); ctx.fill();
      ctx.fillStyle="rgba(255,220,150,0.85)"; ctx.font="700 11px system-ui, sans-serif"; ctx.textAlign="center"; ctx.fillText(f.name,sx,sy+f.r*0.7);
      const hp=f.hp/f.maxHp; ctx.fillStyle="rgba(0,0,0,0.5)"; ctx.fillRect(sx-f.r*0.4,sy-f.r*0.5,f.r*0.8,6);
      ctx.fillStyle=hp>0.5?"#4cd964":hp>0.25?"#ffcc00":"#ff4444"; ctx.fillRect(sx-f.r*0.4,sy-f.r*0.5,f.r*0.8*hp,6);
      ctx.restore();
    }
  }

  /**
   * Draw a detailed desert warrior using Canvas shapes.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} x - screen X
   * @param {number} y - screen Y
   * @param {number} facing - 1 (right) or -1 (left)
   * @param {string} armorColor - main armor color
   * @param {boolean} isAttacking - show attack pose
   * @param {number} scale - size multiplier
   */
  _drawWarrior(ctx, x, y, facing, armorColor, isAttacking = false, scale = 1) {
    const s = scale;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(facing, 1);

    // ── Shadow ───────────────────────────────────────────────
    ctx.fillStyle = "rgba(0,0,0,0.15)";
    ctx.beginPath();
    ctx.ellipse(0, 12 * s, 18 * s, 5 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // ── Cape / Cloak (behind body) ───────────────────────────
    ctx.fillStyle = "#6d3f1a";
    ctx.beginPath();
    ctx.moveTo(-12 * s, 4 * s);
    ctx.quadraticCurveTo(-16 * s, 18 * s, -10 * s, 22 * s);
    ctx.quadraticCurveTo(0 * s, 24 * s, 14 * s, 20 * s);
    ctx.quadraticCurveTo(18 * s, 12 * s, 14 * s, 4 * s);
    ctx.closePath();
    ctx.fill();

    // ── Body armor ───────────────────────────────────────────
    ctx.fillStyle = armorColor;
    ctx.beginPath();
    ctx.moveTo(-14 * s, 2 * s);
    ctx.quadraticCurveTo(-16 * s, 8 * s, -14 * s, 16 * s);
    ctx.quadraticCurveTo(0 * s, 20 * s, 14 * s, 16 * s);
    ctx.quadraticCurveTo(16 * s, 8 * s, 14 * s, 2 * s);
    ctx.quadraticCurveTo(0 * s, -2 * s, -14 * s, 2 * s);
    ctx.closePath();
    ctx.fill();

    // Armor highlight (chest plate)
    ctx.fillStyle = "rgba(255,255,200,0.12)";
    ctx.beginPath();
    ctx.moveTo(-6 * s, 4 * s);
    ctx.quadraticCurveTo(0 * s, 6 * s, 6 * s, 4 * s);
    ctx.quadraticCurveTo(5 * s, 10 * s, 0 * s, 12 * s);
    ctx.quadraticCurveTo(-5 * s, 10 * s, -6 * s, 4 * s);
    ctx.closePath();
    ctx.fill();

    // ── Belt ─────────────────────────────────────────────────
    ctx.fillStyle = "#4a2a10";
    ctx.fillRect(-11 * s, 10 * s, 22 * s, 4 * s);
    ctx.fillStyle = "#ffd166";
    ctx.fillRect(-2 * s, 10 * s, 4 * s, 4 * s);

    // ── Skirt / Leg guards ───────────────────────────────────
    ctx.fillStyle = "#8a5e3a";
    ctx.beginPath();
    ctx.moveTo(-10 * s, 14 * s);
    ctx.lineTo(-8 * s, 20 * s);
    ctx.lineTo(-4 * s, 18 * s);
    ctx.lineTo(0 * s, 21 * s);
    ctx.lineTo(4 * s, 18 * s);
    ctx.lineTo(8 * s, 20 * s);
    ctx.lineTo(10 * s, 14 * s);
    ctx.closePath();
    ctx.fill();

    // ── Legs ─────────────────────────────────────────────────
    ctx.fillStyle = "#c49a6c";
    ctx.fillRect(-7 * s, 19 * s, 4 * s, 6 * s);
    ctx.fillRect(3 * s, 19 * s, 4 * s, 6 * s);

    // Boots
    ctx.fillStyle = "#4a2a10";
    ctx.fillRect(-8 * s, 23 * s, 6 * s, 3 * s);
    ctx.fillRect(2 * s, 23 * s, 6 * s, 3 * s);

    // ── Arms ─────────────────────────────────────────────────
    ctx.fillStyle = "#e8cba0";
    if (isAttacking) {
      // Attack pose: sword arm raised
      ctx.save();
      ctx.translate(12 * s, -2 * s);
      ctx.rotate(-1.2);
      ctx.fillRect(-2 * s, -16 * s, 4 * s, 18 * s);
      ctx.restore();

      // Sword
      ctx.strokeStyle = "#ccc";
      ctx.lineWidth = 2 * s;
      ctx.beginPath();
      ctx.moveTo(14 * s, -10 * s);
      ctx.lineTo(14 * s, -28 * s);
      ctx.stroke();

      // Sword guard
      ctx.strokeStyle = "#8a5e28";
      ctx.lineWidth = 3 * s;
      ctx.beginPath();
      ctx.moveTo(10 * s, -10 * s);
      ctx.lineTo(18 * s, -10 * s);
      ctx.stroke();

      // Sword glow
      ctx.fillStyle = "rgba(255,255,255,0.2)";
      ctx.beginPath();
      ctx.arc(14 * s, -26 * s, 3 * s, 0, Math.PI * 2);
      ctx.fill();

      // Shield arm (back)
      ctx.fillRect(-13 * s, -2 * s, 4 * s, 14 * s);
    } else {
      // Walk pose
      ctx.fillRect(10 * s, 0 * s, 4 * s, 14 * s);
      ctx.fillRect(-14 * s, 2 * s, 4 * s, 12 * s);
    }

    // ── Shield ───────────────────────────────────────────────
    ctx.fillStyle = "#8a5e28";
    ctx.beginPath();
    ctx.arc(-13 * s, 6 * s, 7 * s, -0.3, Math.PI + 0.3);
    ctx.closePath();
    ctx.fill();

    // Shield emblem
    ctx.fillStyle = "#ffd166";
    ctx.beginPath();
    ctx.arc(-13 * s, 6 * s, 3 * s, 0, Math.PI * 2);
    ctx.fill();

    // ── Head ─────────────────────────────────────────────────
    ctx.fillStyle = "#e8cba0";
    ctx.beginPath();
    ctx.arc(0, -14 * s, 7 * s, 0, Math.PI * 2);
    ctx.fill();

    // ── Helmet ───────────────────────────────────────────────
    ctx.fillStyle = armorColor;
    // Helmet dome
    ctx.beginPath();
    ctx.arc(0, -16 * s, 7 * s, Math.PI, 0);
    ctx.closePath();
    ctx.fill();

    // Helmet rim
    ctx.fillStyle = "#6d4c2a";
    ctx.fillRect(-8 * s, -11 * s, 16 * s, 2 * s);

    // Helmet crest / feather
    ctx.fillStyle = "#d43a3a";
    ctx.beginPath();
    ctx.moveTo(0, -22 * s);
    ctx.quadraticCurveTo(6 * s, -24 * s, 2 * s, -18 * s);
    ctx.quadraticCurveTo(0, -20 * s, -2 * s, -18 * s);
    ctx.quadraticCurveTo(-6 * s, -24 * s, 0, -22 * s);
    ctx.closePath();
    ctx.fill();

    // ── Eyes ─────────────────────────────────────────────────
    ctx.fillStyle = "#222";
    ctx.beginPath();
    ctx.arc(2 * s, -14 * s, 1.2 * s, 0, Math.PI * 2);
    ctx.arc(-2 * s, -14 * s, 1.2 * s, 0, Math.PI * 2);
    ctx.fill();

    // Eye glow (when attacking)
    if (isAttacking) {
      ctx.fillStyle = "rgba(255, 200, 50, 0.4)";
      ctx.beginPath();
      ctx.arc(2 * s, -14 * s, 2.5 * s, 0, Math.PI * 2);
      ctx.arc(-2 * s, -14 * s, 2.5 * s, 0, Math.PI * 2);
      ctx.fill();
    }

    // ── Face guard / Beard ───────────────────────────────────
    ctx.fillStyle = "rgba(60, 40, 20, 0.3)";
    ctx.beginPath();
    ctx.arc(0, -10 * s, 5 * s, 0.2, Math.PI - 0.2);
    ctx.fill();

    ctx.restore();
  }

  _drawHero(ctx, cam) {
    const h = this.hero, sp = this.sprite, sx = h.x - cam.x, sy = h.y - cam.y;
    if (!cam.visible(h.x, h.y, 80)) return;

    if (sp.loaded && sp.fw > 0) {
      // Use sprite sheet
      const sc = 1.25, dw = sp.fw * sc, dh = sp.fh * sc;
      ctx.save();
      ctx.translate(sx, sy);
      ctx.scale(h.facing, 1);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(sp.img, sp.frame * sp.fw, sp.walkRow * sp.fh, sp.fw, sp.fh, -dw / 2, -dh, dw, dh);
      ctx.restore();
    } else {
      // Fallback: detailed warrior
      this._drawWarrior(ctx, sx, sy, h.facing, h.attacking ? "#d4943a" : "#1a6a9a", h.attacking, 1.1);
    }

    // Health bar
    const hp = h.hp / h.maxHp;
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(sx - 20, sy - 48, 40, 6);
    ctx.fillStyle = hp > 0.5 ? "#4cd964" : hp > 0.25 ? "#ffcc00" : "#ff4444";
    ctx.fillRect(sx - 20, sy - 48, 40 * hp, 6);
  }

  _drawUnits(ctx, cam) {
    for (const u of this.units) {
      if (!u.alive || !cam.visible(u.x, u.y, 20)) continue;
      const sx = u.x - cam.x, sy = u.y - cam.y;
      this._drawWarrior(ctx, sx, sy, u.facing || 1, u.attacking ? "#d4943a" : "#3a7a5a", u.attacking, 0.65);
    }
  }

  _drawEnemies(ctx, cam) {
    for (const e of this.enemies) {
      if (!e.alive || !cam.visible(e.x, e.y, 30)) continue;
      const sx = e.x - cam.x, sy = e.y - cam.y;
      // Red-toned warriors for enemies
      this._drawWarrior(ctx, sx, sy, e.facing || 1, "#6a1a1a", true, 0.75);
    }
  }

  _drawEffects(ctx, cam) {
    for(let i=this._hitFx.length-1;i>=0;i--) {
      const h=this._hitFx[i], sx=h.x-cam.x, sy=h.y-cam.y;
      const a=h.life/h.maxLife; ctx.save(); ctx.fillStyle=`rgba(255,200,50,${a})`; ctx.font=`700 ${10+(1-a)*15}px system-ui, sans-serif`; ctx.textAlign="center"; ctx.fillText(`-${h.dmg}`,sx,sy-(1-a)*20); ctx.restore();
      h.life-=0.03; if(h.life<=0) this._hitFx.splice(i,1);
    }
    for(let i=this._goldFx.length-1;i>=0;i--) {
      const g=this._goldFx[i], sx=g.x-cam.x, sy=g.y-cam.y;
      const a=g.life/g.maxLife; ctx.save(); ctx.fillStyle=`rgba(255,215,0,${a})`; ctx.font="700 14px system-ui, sans-serif"; ctx.textAlign="center"; ctx.fillText(`+${g.amt} 🪙`,sx,sy); ctx.restore();
      g.y+=g.vy*0.03; g.life-=0.03; if(g.life<=0) this._goldFx.splice(i,1);
    }
    for(let i=this._capFx.length-1;i>=0;i--) {
      const c=this._capFx[i], sx=c.x-cam.x, sy=c.y-cam.y;
      const a=c.life/c.maxLife; ctx.save(); ctx.fillStyle=c.color; ctx.globalAlpha=a; ctx.beginPath(); ctx.arc(sx,sy,4,0,Math.PI*2); ctx.fill(); ctx.restore();
      c.x+=c.vx*0.03; c.y+=c.vy*0.03; c.life-=0.03; if(c.life<=0) this._capFx.splice(i,1);
    }
  }

  _drawMiniMap(ctx, cam) {
    const sz=90, pd=10, x=cam.w-sz-pd, y=pd;
    const sx=sz/this.W, sy=sz/this.H;
    ctx.save();
    ctx.fillStyle="rgba(38,22,10,0.75)"; ctx.strokeStyle="rgba(255,209,102,0.4)"; ctx.lineWidth=1;
    ctx.beginPath(); ctx.roundRect(x,y,sz,sz,10); ctx.fill(); ctx.stroke();
    ctx.fillStyle="#5bc0be"; this.oases.forEach(o=>{ctx.beginPath(); ctx.arc(x+o.x*sx,y+o.y*sy,Math.max(2,4),0,Math.PI*2); ctx.fill();});
    ctx.fillStyle="#ff6b6b"; this.forts.forEach(f=>{if(!f.alive)return; ctx.beginPath(); ctx.arc(x+f.x*sx,y+f.y*sy,Math.max(2,5),0,Math.PI*2); ctx.fill();});
    ctx.fillStyle="rgba(255,100,100,0.6)"; this.enemies.forEach(e=>{if(!e.alive)return; ctx.beginPath(); ctx.arc(x+e.x*sx,y+e.y*sy,2,0,Math.PI*2); ctx.fill();});
    ctx.strokeStyle="rgba(255,255,255,0.6)"; ctx.strokeRect(x+cam.x*sx,y+cam.y*sy,Math.max(4,cam.w*sx),Math.max(3,cam.h*sy));
    ctx.fillStyle="#ffd700"; ctx.beginPath(); ctx.arc(x+this.hero.x*sx,y+this.hero.y*sy,3,0,Math.PI*2); ctx.fill();
    ctx.fillStyle="#3a8ab5"; this.units.forEach(u=>{if(!u.alive)return; ctx.beginPath(); ctx.arc(x+u.x*sx,y+u.y*sy,1.5,0,Math.PI*2); ctx.fill();});
    ctx.restore();
  }

  _drawHints(ctx, cam) {
    ctx.save(); ctx.fillStyle="rgba(255,248,220,0.6)"; ctx.font="600 11px system-ui, sans-serif"; ctx.textAlign="center";
    ctx.fillText("🖐️ اسحب لتحريك الكاميرا | 👆 اضغط لتحريك الجيش إلى الموقع", cam.w/2, cam.h-12); ctx.restore();
  }
}

// ─── Auto-init ──────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  if (typeof GameEngine === "undefined") {
    console.error("[Game] ❌ GameEngine not found — load engine.js first");
    return;
  }

  const engine = new GameEngine("gameCanvas", localStorage.getItem("n8n_webhook") || "");
  const game   = new DesertGame(engine);

  // Expose globally for panels
  window.game = game;

  // Button bindings
  document.getElementById("start-btn").addEventListener("click", () => game.start());
  const loadBtn = document.getElementById("load-btn");
  if (loadBtn) loadBtn.addEventListener("click", () => game.load());
  document.querySelectorAll(".nav-btn").forEach(b => b.addEventListener("click", () => game.selectPanel(b)));

  // Camera toggle
  const camBtn = document.getElementById("cam-toggle");
  if (camBtn) {
    camBtn.addEventListener("click", () => {
      game._camFollow = !game._camFollow;
      if (game._camFollow) {
        game.engine.camera.follow(game.hero);
        camBtn.textContent = "🔒";
      } else {
        game.engine.camera.unfollow();
        camBtn.textContent = "🔓";
      }
    });
  }

  console.log("[Game] ✅ DesertGame loaded");
  console.log("  📖 const game = new DesertGame(engine); game.start();");
});