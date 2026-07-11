export class ExtractionMode {
  constructor(world) {
    this.world = world;
    this.modeName = "extraction";
    this._carryingGold = 0;
    this._carryingMax = 500;
    this._depositZone = null;
    this._depositRadius = 60;
    this._peacefulRadius = 80;
    this._totalDeposited = 0;
    this._extractionTimer = 0;
    this._extractionTimeLimit = 300; // 5 min
    this._extractionActive = true;
    this._extractionKills = 0;
    this._currentUpgrades = {
      bagSize: 1,
      speed: 1,
      depositReward: 1,
    };
    this._upgradeCosts = {
      bagSize: (l) => 100 * l,
      speed: (l) => 150 * l,
      depositReward: (l) => 200 * l,
    };
    this._extractionLevel = 1;
    this._extractionXp = 0;
    this._extractionXpToNext = 100;
  }

  init() {
    const w = this.world;
    w.mode = "extraction";
    w._pvpDisabled = true;
    w._campaignMode = false;
    w.W = 2400;
    w.H = 2400;

    this._carryingGold = 0;
    this._totalDeposited = 0;
    this._extractionKills = 0;
    this._extractionTimer = this._extractionTimeLimit;
    this._extractionActive = true;

    w.leader.x = w.W / 2;
    w.leader.y = w.H / 2;
    w.leader.hp = w.leader.maxHp;
    w.leader.path = null;

    w.monsters = [];
    w.drops = [];
    w.treasureChests = [];
    w.armyUnits = [];
    w.initArmyUnits(8);

    this._spawnExtractionMonsters();
    this._placeDepositZone();

    this.worldFx_before = w.worldFx;
  }

  _spawnExtractionMonsters() {
    const w = this.world;
    const count = 15 + Math.floor(Math.random() * 10);
    for (let i = 0; i < count; i++) {
      let x, y;
      do {
        x = 150 + Math.random() * (w.W - 300);
        y = 150 + Math.random() * (w.H - 300);
      } while (w.isInSafeZone(x, y));
      const monster = w.createMonster(i, x, y);
      monster._peaceful = true;
      monster.rewardMoney = 15 + Math.floor(Math.random() * 20);
      monster.rewardGold = 5 + Math.floor(Math.random() * 10);
      w.monsters.push(monster);
    }
  }

  _placeDepositZone() {
    const w = this.world;
    let x, y;
    do {
      x = 100 + Math.random() * (w.W - 200);
      y = 100 + Math.random() * (w.H - 200);
    } while (Math.hypot(x - w.W / 2, y - w.H / 2) < 400);
    this._depositZone = { x, y, radius: this._depositRadius };
    this._updateDepositZoneVisual();
  }

  _updateDepositZoneVisual() {
    const z = this._depositZone;
    if (z) {
      this.world.worldFx.push({
        x: z.x, y: z.y - 30,
        text: "📍 نقطة التسليم",
        color: "#4cd964", life: 3, maxLife: 3
      });
    }
  }

  update(dt) {
    if (!this._extractionActive) return;
    const w = this.world;

    this._extractionTimer -= dt;
    if (this._extractionTimer <= 0) {
      this._extractionActive = false;
      if (this._totalDeposited > 0) {
        const bonus = Math.floor(this._totalDeposited * 0.2);
        w.sessionStats.coinsEarned += bonus;
        w.worldFx.push({ x: w.leader.x, y: w.leader.y, text: `⏰ انتهى الوقت! مكافأة: +${bonus} 💵`, color: "#FFD700", life: 3, maxLife: 3 });
      }
      return;
    }

    // تقليل السرعة حسب الوزن
    const weight = this._carryingGold / this._getMaxBag();
    const speedMult = Math.max(0.4, 1 - weight * 0.6);
    w.leader.speed = 140 * speedMult;

    // تحديث الوحوش المسالمة
    for (const m of w.monsters) {
      if (!m.alive) continue;
      const dist = Math.hypot(m.x - w.leader.x, m.y - w.leader.y);
      if (dist < this._peacefulRadius) {
        m._peaceful = false;
        w.worldFx.push({ x: m.x, y: m.y - 15, text: "⚠️", color: "#ff6b6b", life: 0.5, maxLife: 0.5 });
      } else if (dist > this._peacefulRadius * 2) {
        m._peaceful = true;
      }
    }

    // فحص الوصول لنقطة التسليم
    if (this._depositZone && this._carryingGold > 0) {
      const dz = this._depositZone;
      const dist = Math.hypot(w.leader.x - dz.x, w.leader.y - dz.y);
      if (dist < dz.radius) {
        this._depositGold();
      }
    }

    // إظهار مؤشر لنقطة التسليم إذا بعيدة
    if (this._depositZone && this._carryingGold > 0) {
      const dz = this._depositZone;
      const dist = Math.hypot(w.leader.x - dz.x, w.leader.y - dz.y);
      if (dist > 300) {
        const angle = Math.atan2(dz.y - w.leader.y, dz.x - w.leader.x);
        const indicatorX = w.leader.x + Math.cos(angle) * 80;
        const indicatorY = w.leader.y + Math.sin(angle) * 80;
        if (Math.random() < 0.05) {
          w.worldFx.push({ x: indicatorX, y: indicatorY, text: "📍", color: "#4cd964", life: 0.8, maxLife: 0.8 });
        }
      }
    }
  }

  _depositGold() {
    if (this._carryingGold <= 0) return;
    const w = this.world;
    const rewardMult = 1 + (this._currentUpgrades.depositReward - 1) * 0.25;
    const deposited = Math.floor(this._carryingGold * rewardMult);
    this._totalDeposited += deposited;
    if (w.economy) {
      w.economy.addRaw("gold", deposited);
      const xpGain = Math.floor(deposited * 0.5);
      w.economy.addXp(xpGain);
      this._extractionXp += xpGain;
    }
    w.worldFx.push({ x: w.leader.x, y: w.leader.y, text: `✅ سلمت ${deposited} 🪙!`, color: "#4cd964", life: 2, maxLife: 2 });
    w.sessionStats.coinsEarned += deposited;
    this._carryingGold = 0;
    if (w._onSelfStatsChanged) w._onSelfStatsChanged();

    // نقطة تسليم جديدة
    this._placeDepositZone();

    // زيادة المستوى
    this._checkLevelUp();
  }

  _checkLevelUp() {
    if (this._extractionXp >= this._extractionXpToNext) {
      this._extractionXp -= this._extractionXpToNext;
      this._extractionLevel++;
      this._extractionXpToNext = Math.floor(100 * Math.pow(1.3, this._extractionLevel - 1));
      this.world.worldFx.push({
        x: this.world.leader.x, y: this.world.leader.y - 30,
        text: `⬆️ مستوى الاستخراج ${this._extractionLevel}!`,
        color: "#FFD700", life: 2.5, maxLife: 2.5
      });
    }
  }

  onMonsterKilled(monster) {
    if (!this._extractionActive) return;
    this._extractionKills++;
    if (this.world._onSelfStatsChanged) this.world._onSelfStatsChanged();
    this.world.worldFx.push({
      x: monster.x, y: monster.y - 20,
      text: `💀 قتل!`,
      color: "#ff6b6b", life: 1, maxLife: 1
    });
  }

  onWipe() {
    if (this._carryingGold > 0) {
      const lost = this._carryingGold;
      this._carryingGold = 0;
      this.world.worldFx.push({
        x: this.world.leader.x, y: this.world.leader.y,
        text: `💀 فقدت ${lost} 🪙 محمولة!`,
        color: "#ff4444", life: 2, maxLife: 2
      });
    }
  }

  _getMaxBag() {
    return this._carryingMax + (this._currentUpgrades.bagSize - 1) * 100;
  }

  getUpgradeCost(type) {
    const fn = this._upgradeCosts[type];
    if (!fn) return 0;
    return fn(this._currentUpgrades[type] || 1);
  }

  performUpgrade(type) {
    const cost = this.getUpgradeCost(type);
    const w = this.world;
    if (!w.economy || w.economy.gold < cost) return false;
    w.economy.addRaw("gold", -cost);
    this._currentUpgrades[type] = (this._currentUpgrades[type] || 1) + 1;
    w.worldFx.push({
      x: w.leader.x, y: w.leader.y - 20,
      text: `⬆️ تم ترقية ${type === 'bagSize' ? 'حقيبة' : type === 'speed' ? 'سرعة' : 'مكافأة'}!`,
      color: "#4cd964", life: 1.5, maxLife: 1.5
    });
    return true;
  }

  drawUI(ctx) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const dpr = window.devicePixelRatio || 1;
    ctx.scale(dpr, dpr);
    const cw = ctx.canvas.width / dpr;

    // شريط الحالة أعلى اليمين
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    const panelW = 220;
    ctx.fillRect(cw - panelW - 8, 8, panelW, 110);

    ctx.fillStyle = "#FFD700";
    ctx.font = "bold 13px Cairo, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(`🪙 ${this._carryingGold}/${this._getMaxBag()}`, cw - 14, 28);

    ctx.fillStyle = "#4cd964";
    ctx.font = "bold 11px Cairo, sans-serif";
    ctx.fillText(`✅ المسلَّم: ${this._totalDeposited}`, cw - 14, 48);

    ctx.fillStyle = "#ff6b6b";
    const mins = Math.floor(this._extractionTimer / 60);
    const secs = Math.floor(this._extractionTimer % 60);
    ctx.fillText(`⏱ ${mins}:${secs.toString().padStart(2, '0')}`, cw - 14, 68);

    ctx.fillStyle = "#a29bfe";
    ctx.fillText(`📦 الحقيبة Lv.${this._currentUpgrades.bagSize}`, cw - 14, 88);

    ctx.fillStyle = "#fdcb6e";
    ctx.fillText(`🏆 المستوى ${this._extractionLevel}`, cw - 14, 108);

    // شريط XP للاستخراج (تحت شريط الذهب)
    const xpW = 200;
    const xpH = 6;
    const xpX = cw - panelW - 8 + 10;
    const xpY = 118;
    const xpRatio = this._extractionXp / this._extractionXpToNext;
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(xpX, xpY, xpW, xpH);
    ctx.fillStyle = "#a29bfe";
    ctx.fillRect(xpX, xpY, xpW * Math.min(1, xpRatio), xpH);

    ctx.restore();
  }

  exit() {
    const w = this.world;
    w.mode = "campaign";
    w._pvpDisabled = false;
    w.leader.speed = 140;
    this._carryingGold = 0;
  }
}
