import { showModeResultScreen } from "../ui/context-menu.js";

export class ExtractionMode {
  // Extraction mode constants:
  // Map: 2400x2400, monster spawn margin 150px, deposit zone min distance 400px
  // Monsters: 15-24 count, reward 15-34 cash + 5-14 gold, peaceful
  // Deposit zone radius 60px, safe zone radius 80px
  // Time limit: 360s (6 min), max carry: 500 gold
  // Upgrades: bagSize 80/lvl, speed 120/lvl, depositReward 160/lvl
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
    this._extractionTimeLimit = 360; // 6 دقائق (وقت كافٍ للاستخراج)
    this._extractionActive = true;
    this._extractionKills = 0;
    this._currentUpgrades = {
      bagSize: 1,
      speed: 1,
      depositReward: 1,
    };
    this._upgradeCosts = {
      bagSize: (l) => 80 * l,      // أرخص قليلاً
      speed: (l) => 120 * l,
      depositReward: (l) => 160 * l,
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
      // إضافة مؤشر مرئي دائم للمنطقة
      this._depositZonePulse = 0;
      this.world.worldFx.push({
        x: z.x, y: z.y - 30,
        text: "📍 نقطة التسليم",
        color: "#4cd964", life: 4, maxLife: 4
      });
    }
  }

  // رسم نقطة التسليم على الخريطة
  drawDepositZone(ctx) {
    const z = this._depositZone;
    if (!z) return;
    const time = Date.now() * 0.002;
    this._depositZonePulse = (this._depositZonePulse || 0) + 0.02;

    ctx.save();
    ctx.translate(z.x, z.y);

    // دائرة خارجية متوهجة
    const pulse = 0.6 + Math.sin(time) * 0.3;
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, z.radius);
    grad.addColorStop(0, `rgba(76, 217, 100, ${pulse * 0.3})`);
    grad.addColorStop(0.5, `rgba(76, 217, 100, ${pulse * 0.15})`);
    grad.addColorStop(1, `rgba(76, 217, 100, 0)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, z.radius, 0, Math.PI * 2);
    ctx.fill();

    // دائرة الحدود
    ctx.strokeStyle = `rgba(76, 217, 100, ${pulse * 0.7})`;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.arc(0, 0, z.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // أيقونة العلم في المنتصف
    ctx.fillStyle = `rgba(76, 217, 100, ${0.7 + Math.sin(time * 1.5) * 0.3})`;
    ctx.font = "24px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("📍", 0, 0);

    // علامة المسار (للإشارة للاعب إلى وجود نقطة تسليم)
    const w = this.world;
    const dist = Math.hypot(w.leader.x - z.x, w.leader.y - z.y);
    if (dist > 200) {
      ctx.strokeStyle = `rgba(76, 217, 100, ${0.2 + Math.sin(time * 2) * 0.1})`;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 8]);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      const angle = Math.atan2(w.leader.y - z.y, w.leader.x - z.x);
      ctx.lineTo(Math.cos(angle) * z.radius * 0.6, Math.sin(angle) * z.radius * 0.6);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.restore();
  }

  update(dt) {
    if (!this._extractionActive) return;
    const w = this.world;

    this._extractionTimer -= dt;
    if (this._extractionTimer <= 0) {
      this._extractionActive = false;
      const bonus = this._totalDeposited > 0 ? Math.floor(this._totalDeposited * 0.2) : 0;
      if (bonus > 0) {
        w.sessionStats.coinsEarned += bonus;
        w.worldFx.push({ x: w.leader.x, y: w.leader.y, text: `⏰ انتهى الوقت! مكافأة: +${bonus} 💵`, color: "#FFD700", life: 3, maxLife: 3 });
      }
      if (typeof document !== "undefined") {
        showModeResultScreen(w, {
          won: this._totalDeposited > 0,
          icon: "⏰",
          title: this._totalDeposited > 0 ? "انتهى الوقت — استخراج ناجح!" : "انتهى الوقت بلا استخراج",
          stats: [
            { label: "إجمالي المُسلَّم", value: `${this._totalDeposited} 🪙` },
            { label: "عدد القتلى", value: this._extractionKills },
            { label: "المستوى", value: this._extractionLevel },
          ],
          rewardLine: bonus > 0 ? `+${bonus} 💵 مكافأة إتمام` : undefined,
        });
      }
      return;
    }

    // تقليل السرعة حسب الوزن — مع تعويض جزئي من ترقية السرعة المشتراة
    const weight = this._carryingGold / this._getMaxBag();
    const speedMult = Math.max(0.4, 1 - weight * 0.6);
    w.leader.speed = this._getBaseSpeed() * speedMult;

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

    // تحديث نبض نقطة التسليم
    this._depositZonePulse = (this._depositZonePulse || 0) + dt;

    // سهم إرشادي لنقطة التسليم (مرسوم مباشرة)
    if (this._depositZone && this._carryingGold > 0) {
      const dz = this._depositZone;
      const dist = Math.hypot(w.leader.x - dz.x, w.leader.y - dz.y);
      if (dist > 200) {
        const angle = Math.atan2(dz.y - w.leader.y, dz.x - w.leader.x);
        const indicatorX = w.leader.x + Math.cos(angle) * 80;
        const indicatorY = w.leader.y + Math.sin(angle) * 80;
        if (Math.random() < 0.03) {
          w.worldFx.push({
            x: indicatorX, y: indicatorY,
            text: "📍", color: "#4cd964",
            life: 1.2, maxLife: 1.2
          });
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
    // تأثير تسليم احترافي
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        w.worldFx.push({
          x: w.leader.x + (Math.random() - 0.5) * 40,
          y: w.leader.y + (Math.random() - 0.5) * 40,
          text: "🪙", color: "#FFD700",
          life: 0.3 + Math.random() * 0.3, maxLife: 0.6
        });
      }, i * 100);
    }
    w.worldFx.push({ x: w.leader.x, y: w.leader.y, text: `✅ سلمت ${deposited} 🪙!`, color: "#4cd964", life: 2.5, maxLife: 2.5 });
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
    
    // 🟢 ملاحظة: الذهب يُضاف تلقائياً إلى المحمول عند التقاط الـ drop
    // (collectDrop في world.js يتعامل مع التحميل في نمط الاستخراج)
    // هذه الدالة تتعامل مع العدادات والتأثيرات فقط
    
    this.world.worldFx.push({
      x: monster.x, y: monster.y - 20,
      text: `💀 قتل!`,
      color: "#ff6b6b", life: 0.8, maxLife: 0.8
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

  /** 🏃 السرعة الأساسية قبل خصم الوزن — ترقية "السرعة" تزيدها فعلياً (كانت مشتراة بلا أي تأثير) */
  _getBaseSpeed() {
    return 140 + (this._currentUpgrades.speed - 1) * 12;
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
    // 🛡️ إزاحة رأسية بمقدار ارتفاع الشريط العلوي كي لا يُخفي الشريط أعلى اللوحة
    const oy = 62;

    // شريط الحالة أعلى اليسار (بمنأى عن لوحة اللاعبين/الخريطة المصغّرة على اليمين)
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    const panelW = 220;
    ctx.fillRect(8, 8 + oy, panelW, 110);

    ctx.fillStyle = "#FFD700";
    ctx.font = "bold 13px Cairo, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`🪙 ${this._carryingGold}/${this._getMaxBag()}`, 14, 28 + oy);

    ctx.fillStyle = "#4cd964";
    ctx.font = "bold 11px Cairo, sans-serif";
    ctx.fillText(`✅ المسلَّم: ${this._totalDeposited}`, 14, 48 + oy);

    ctx.fillStyle = "#ff6b6b";
    const mins = Math.floor(this._extractionTimer / 60);
    const secs = Math.floor(this._extractionTimer % 60);
    ctx.fillText(`⏱ ${mins}:${secs.toString().padStart(2, '0')}`, 14, 68 + oy);

    ctx.fillStyle = "#a29bfe";
    ctx.fillText(`📦 الحقيبة Lv.${this._currentUpgrades.bagSize}`, 14, 88 + oy);

    ctx.fillStyle = "#fdcb6e";
    ctx.fillText(`🏆 المستوى ${this._extractionLevel}`, 14, 108 + oy);

    // شريط XP للاستخراج (تحت شريط الذهب)
    const xpW = 200;
    const xpH = 6;
    const xpX = 18;
    const xpY = 118 + oy;
    const xpRatio = this._extractionXp / this._extractionXpToNext;
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(xpX, xpY, xpW, xpH);
    ctx.fillStyle = "#a29bfe";
    ctx.fillRect(xpX, xpY, xpW * Math.min(1, xpRatio), xpH);

    // شريط الوزن (تأثير الوزن على السرعة)
    const weightRatio = this._carryingGold / this._getMaxBag();
    if (weightRatio > 0.5) {
      ctx.fillStyle = `rgba(255, 107, 107, ${(weightRatio - 0.5) * 0.5})`;
      ctx.font = "bold 10px Cairo, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(`⚖️ ${Math.floor(weightRatio * 100)}%`, 14, 138 + oy);
    }

    ctx.restore();
  }

  exit() {
    const w = this.world;
    w.mode = "campaign";
    w._pvpDisabled = false;
    w.leader.speed = 140;
    w.monsters = [];
    w.drops = [];
    w.treasureChests = [];
    // حفظ الذهب الذي تم تسليمه قبل الخروج
    if (this._totalDeposited > 0 && w.economy) {
      w.economy.addRaw("gold", Math.floor(this._totalDeposited * 0.1));
    }
    this._carryingGold = 0;
    this._totalDeposited = 0;
    this._extractionActive = false;
  }

  /** حفظ تقدم نمط الاستخراج */
  getSaveData() {
    return {
      modeName: this.modeName,
      totalDeposited: this._totalDeposited,
      extractionLevel: this._extractionLevel,
      extractionXp: this._extractionXp,
      extractionKills: this._extractionKills,
      currentUpgrades: { ...this._currentUpgrades },
      extractionTimeLimit: this._extractionTimeLimit,
    };
  }

  /** استعادة تقدم نمط الاستخراج */
  loadState(data) {
    if (!data) return;
    this._totalDeposited = data.totalDeposited || 0;
    this._extractionLevel = data.extractionLevel || 1;
    this._extractionXp = data.extractionXp || 0;
    this._extractionKills = data.extractionKills || 0;
    if (data.currentUpgrades) {
      this._currentUpgrades = { ...this._currentUpgrades, ...data.currentUpgrades };
    }
    if (data.extractionTimeLimit) {
      this._extractionTimeLimit = data.extractionTimeLimit;
    }
  }
}
