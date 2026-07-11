import { calculateEnemyPower } from "../enemies.js";

export class CaveMode {
  constructor(world) {
    this.world = world;
    this.modeName = "cave";
    this._caveLevel = 1;
    this._caveDepth = 1;
    this._rareItemsCollected = 0;
    this._caveEntrances = [];
    this._lavaPools = [];
    this._tunnelLinks = [];
    this._darknessAlpha = 0;
    this._torchRadius = 120;
    this._exploredRooms = new Set();
    this._currentRoom = "entrance";
    this._caveExit = null;
    this._caveActive = false;
    this._caveMonstersKilled = 0;
    this._caveScore = 0;

    this._caveEnemies = [
      { id: "cave_fire_wolf", name: "ذئب النار", icon: "🐺🔥", hp: 80, damage: 14, color: "#ff6b35", radius: 14, speed: 110, level: 5, reward: { cash: 20, gold: 8 } },
      { id: "cave_lava_scorpion", name: "عقرب الحمم", icon: "🦂🌋", hp: 120, damage: 20, color: "#e74c3c", radius: 13, speed: 95, level: 8, reward: { cash: 35, gold: 12 } },
      { id: "cave_dark_spirit", name: "روح الظلام", icon: "👻🌑", hp: 60, damage: 18, color: "#2c3e50", radius: 11, speed: 130, level: 6, reward: { cash: 25, gold: 10 } },
      { id: "cave_magma_golem", name: "غول الماغما", icon: "🗿🔥", hp: 200, damage: 30, color: "#c0392b", radius: 22, speed: 60, level: 12, reward: { cash: 60, gold: 20 } },
      { id: "cave_fire_drake", name: "ثعبان النار", icon: "🐉🔥", hp: 350, damage: 45, color: "#d35400", radius: 20, speed: 85, level: 15, reward: { cash: 100, gold: 35 }, isBoss: true },
    ];
  }

  init() {
    const w = this.world;
    w.mode = "cave";
    w._pvpDisabled = true;
    w._campaignMode = false;
    w.W = 2400;
    w.H = 2400;

    this._caveLevel = 1;
    this._caveDepth = 1;
    this._rareItemsCollected = 0;
    this._caveMonstersKilled = 0;
    this._caveScore = 0;
    this._caveActive = true;
    this._exploredRooms = new Set(["entrance"]);
    this._currentRoom = "entrance";

    w.leader.x = w.W / 2;
    w.leader.y = w.H - 200;
    w.leader.hp = w.leader.maxHp;
    w.leader.path = null;

    w.monsters = [];
    w.drops = [];
    w.treasureChests = [];
    w.armyUnits = [];
    w.initArmyUnits(8);

    this._generateCaveTerrain();
    this._spawnCaveMonsters();
    this._placeCaveTreasures();
    this._createCaveExit();
    w.worldFx.push({
      x: w.leader.x, y: w.leader.y - 30,
      text: "🕯️ دخلت الكهف! استكشف واجمع الكنوز!",
      color: "#f39c12", life: 3, maxLife: 3
    });
  }

  _generateCaveTerrain() {
    const w = this.world;
    this._lavaPools = [];
    this._caveEntrances = [];
    this._tunnelLinks = [];

    // برك حمم
    for (let i = 0; i < 6; i++) {
      this._lavaPools.push({
        x: 200 + Math.random() * (w.W - 400),
        y: 200 + Math.random() * (w.H - 400),
        radius: 30 + Math.random() * 60,
        pulse: Math.random() * Math.PI * 2
      });
    }

    // أنفاق (warp points)
    const tunnelPairs = [
      [{ x: 300, y: 300 }, { x: w.W - 300, y: w.H - 300 }],
      [{ x: w.W - 200, y: 400 }, { x: 400, y: w.H - 400 }],
      [{ x: w.W / 2, y: 200 }, { x: w.W / 2, y: w.H - 200 }],
    ];
    for (const [a, b] of tunnelPairs) {
      this._tunnelLinks.push({ entrance: a, exit: b });
      this._caveEntrances.push(a);
    }
  }

  _spawnCaveMonsters() {
    const w = this.world;
    const count = 10 + this._caveDepth * 3;
    for (let i = 0; i < count; i++) {
      let x, y;
      do {
        x = 100 + Math.random() * (w.W - 200);
        y = 100 + Math.random() * (w.H - 200);
      } while (this._isNearLava(x, y) || this._isNearEntrance(x, y));
      const enemyDef = this._caveEnemies[Math.floor(Math.random() * (this._caveEnemies.length - 1))]; // exclude boss from random
      const scaled = calculateEnemyPower(enemyDef, this._caveDepth * 5);
      const monster = w.createMonster(i, x, y, enemyDef);
      monster.hp = scaled.hp;
      monster.maxHp = scaled.hp;
      monster.damage = scaled.damage;
      monster.rewardMoney = scaled.reward.cash;
      monster.rewardGold = scaled.reward.gold;
      monster._caveMonster = true;
      monster._glowColor = enemyDef.color;
      w.monsters.push(monster);
    }
    // Boss في العمق
    if (this._caveDepth >= 2 && Math.random() < 0.3 + this._caveDepth * 0.05) {
      const bossDef = this._caveEnemies[this._caveEnemies.length - 1];
      const scaled = calculateEnemyPower(bossDef, this._caveDepth * 7);
      const boss = w.createMonster('cave_boss', w.W / 2 + 200, w.H / 2, bossDef);
      boss.hp = scaled.hp;
      boss.maxHp = scaled.hp;
      boss.damage = scaled.damage;
      boss.rewardMoney = scaled.reward.cash * 3;
      boss.rewardGold = scaled.reward.gold * 3;
      boss.isBoss = true;
      boss.radius = bossDef.radius * 1.2;
      boss._caveMonster = true;
      boss._glowColor = bossDef.color;
      w.monsters.push(boss);
      w.worldFx.push({
        x: boss.x, y: boss.y - 20,
        text: `🔥 ${bossDef.name} يظهر!`,
        color: "#e74c3c", life: 3, maxLife: 3
      });
    }
  }

  _placeCaveTreasures() {
    const w = this.world;
    // صناديق كنز كهفية
    for (let i = 0; i < 3 + this._caveDepth; i++) {
      let x, y;
      do {
        x = 150 + Math.random() * (w.W - 300);
        y = 150 + Math.random() * (w.H - 300);
      } while (this._isNearLava(x, y));
      w.treasureChests.push({
        x, y,
        opened: false,
        respawnTimer: 60,
        reward: {
          artifacts: Math.floor((1 + Math.random() * 4) * this._caveDepth),
          cash: Math.floor((80 + Math.random() * 200) * this._caveDepth),
          gold: Math.floor((20 + Math.random() * 60) * this._caveDepth),
          desertGem: Math.random() < 0.1 * this._caveDepth ? 1 : 0,
          rareItem: Math.random() < 0.05 ? true : false,
        }
      });
    }
  }

  _createCaveExit() {
    this._caveExit = { x: this.world.W / 2, y: this.world.H - 100 };
  }

  _isNearLava(x, y) {
    for (const p of this._lavaPools) {
      if (Math.hypot(p.x - x, p.y - y) < p.radius + 50) return true;
    }
    return false;
  }

  _isNearEntrance(x, y) {
    for (const e of this._tunnelLinks) {
      if (Math.hypot(e.entrance.x - x, e.entrance.y - y) < 80) return true;
      if (Math.hypot(e.exit.x - x, e.exit.y - y) < 80) return true;
    }
    if (this._caveExit && Math.hypot(this._caveExit.x - x, this._caveExit.y - y) < 80) return true;
    return false;
  }

  update(dt) {
    if (!this._caveActive) return;
    const w = this.world;

    // تحديث الظلام
    this._darknessAlpha = Math.min(0.55, 0.3 + this._caveDepth * 0.05 + 0.2);

    // نبض برك الحمم
    for (const p of this._lavaPools) {
      p.pulse += dt * 2;
    }

    // فحص tunnels
    for (const link of this._tunnelLinks) {
      const dist = Math.hypot(w.leader.x - link.entrance.x, w.leader.y - link.entrance.y);
      if (dist < 40) {
        if (!this._tunnelCooldown || this._tunnelCooldown <= 0) {
          w.leader.x = link.exit.x;
          w.leader.y = link.exit.y;
          w.leader.path = null;
          w.worldFx.push({
            x: w.leader.x, y: w.leader.y - 20,
            text: "🕳️ نفق سري!",
            color: "#9b59b6", life: 1.5, maxLife: 1.5
          });
          this._tunnelCooldown = 2;
        }
      }
    }
    this._tunnelCooldown = (this._tunnelCooldown || 0) - dt;

    // ضرر برك الحمم
    for (const p of this._lavaPools) {
      const dist = Math.hypot(w.leader.x - p.x, w.leader.y - p.y);
      if (dist < p.radius) {
        w.damageHero(8 * dt);
        if (Math.random() < 0.1) {
          w.worldFx.push({
            x: w.leader.x + (Math.random() - 0.5) * 20,
            y: w.leader.y + (Math.random() - 0.5) * 20,
            text: "🔥", color: "#ff6b35", life: 0.5, maxLife: 0.5
          });
        }
      }
    }

    // فحص الخروج من الكهف
    if (this._caveExit) {
      const dist = Math.hypot(w.leader.x - this._caveExit.x, w.leader.y - this._caveExit.y);
      if (dist < 50 && this._rareItemsCollected > 0) {
        this._exitCave();
      }
    }

    // glow للوحوش الكهفية عند الرسم (سيتم رسمه في drawUI)
  }

  onMonsterKilled(monster) {
    if (!monster._caveMonster) return;
    const w = this.world;
    this._caveMonstersKilled++;
    this._caveScore += 10 + this._caveDepth * 5;

    // كنز نادر من وحوش الكهف
    if (Math.random() < 0.15) {
      const rareItem = `💎 جوهرة الكهف النادرة!`;
      this._rareItemsCollected++;
      w.worldFx.push({
        x: monster.x, y: monster.y - 25,
        text: rareItem,
        color: "#9b59b6", life: 2, maxLife: 2
      });
    }
  }

  _exitCave() {
    if (!this._caveActive) return;
    const w = this.world;
    const bonus = Math.floor(this._caveScore * 0.2 + this._rareItemsCollected * 50 + this._caveDepth * 30);
    if (w.economy) {
      w.economy.addRaw("gold", bonus);
      w.economy.addXp(Math.floor(this._caveScore * 0.3));
    }
    w.worldFx.push({
      x: w.leader.x, y: w.leader.y - 30,
      text: `🚪 خرجت من الكهف! مكافأة: ${bonus} 🪙 | جوهرات نادرة: ${this._rareItemsCollected} 💎`,
      color: "#FFD700", life: 3, maxLife: 3
    });
    this._caveActive = false;
    w.sessionStats.coinsEarned += bonus;
  }

  drawBackground(ctx) {
    // رسم أرضية الكهف (داكنة مع برك حمم)
    const w = this.world;
    ctx.fillStyle = "#1a1a2e";
    ctx.fillRect(0, 0, w.W, w.H);

    // برك الحمم
    for (const p of this._lavaPools) {
      const glow = 0.6 + Math.sin(p.pulse) * 0.3;
      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius);
      grad.addColorStop(0, `rgba(255, 107, 53, ${glow})`);
      grad.addColorStop(0.5, `rgba(192, 57, 43, ${glow * 0.7})`);
      grad.addColorStop(1, `rgba(26, 26, 46, 0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();

      // قلب الحمم
      ctx.fillStyle = `rgba(255, 165, 0, ${0.3 + Math.sin(p.pulse * 1.5) * 0.2})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }

    // نقاط الأنفاق
    for (const link of this._tunnelLinks) {
      ctx.fillStyle = "rgba(155, 89, 182, 0.4)";
      ctx.beginPath();
      ctx.arc(link.entrance.x, link.entrance.y, 25, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(155, 89, 182, 0.6)";
      ctx.font = "18px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("🕳️", link.entrance.x, link.entrance.y + 6);
    }
  }

  drawDarkness(ctx) {
    // ظلام حول اللاعب
    const w = this.world;
    const grad = ctx.createRadialGradient(
      w.leader.x, w.leader.y, this._torchRadius,
      w.leader.x, w.leader.y, this._torchRadius * 2.5
    );
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(1, `rgba(0,0,0,${this._darknessAlpha})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w.W, w.H);
  }

  drawUI(ctx) {
    const w = this.world;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const dpr = window.devicePixelRatio || 1;
    ctx.scale(dpr, dpr);
    const cw = ctx.canvas.width / dpr;

    // لوحة الكهف (أعلى يسار)
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(8, 8, 200, 85);

    ctx.fillStyle = "#f39c12";
    ctx.font = "bold 13px Cairo, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`🕯️ العمق ${this._caveDepth}`, 14, 28);

    ctx.fillStyle = "#e74c3c";
    ctx.font = "bold 11px Cairo, sans-serif";
    ctx.fillText(`⚔️ ${this._caveMonstersKilled} قتلى`, 14, 48);

    ctx.fillStyle = "#9b59b6";
    ctx.fillText(`💎 كنوز نادرة: ${this._rareItemsCollected}`, 14, 68);

    ctx.fillStyle = "#fdcb6e";
    ctx.fillText(`🏆 ${this._caveScore} نقطة`, 14, 88);

    // إرشاد الخروج
    if (this._caveExit && this._rareItemsCollected > 0) {
      const dist = Math.hypot(w.leader.x - this._caveExit.x, w.leader.y - this._caveExit.y);
      if (dist > 100) {
        ctx.fillStyle = "rgba(46, 204, 113, 0.7)";
        ctx.font = "bold 10px Cairo, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("🚪 اذهب للخروج (أسفل الخريطة)", cw / 2, 30);
      } else {
        ctx.fillStyle = "rgba(46, 204, 113, 0.9)";
        ctx.font = "bold 12px Cairo, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("🚪 اختر الخروج!", cw / 2, 30);
      }
    }

    ctx.restore();
  }

  exit() {
    const w = this.world;
    w.mode = "campaign";
    w._pvpDisabled = false;
    this._caveActive = false;
  }
}
