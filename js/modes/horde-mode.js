export class HordeMode {
  constructor(world) {
    this.world = world;
    this.modeName = "horde";
    this._wave = 0;
    this._hordeKills = 0;
    this._survivalTime = 0;
    this._monstersAlive = 0;
    this._maxMonsters = 60;
    this._spawnTimer = 0;
    this._spawnInterval = 8;
    this._hordeActive = false;
    this._hordeOver = false;
    this._hordeScore = 0;
    this._initialCount = 8;
    this._hordeAggroRange = 500;
    this._waveDelayTimer = 0;
    this._waveDelayDuration = 2; // ثانيتين بين الموجات
    this._maxWave = 20; // 20 موجة للفوز (توازن أفضل)
    this._totalSpawned = 0;
  }

  init() {
    const w = this.world;
    w.mode = "horde";
    w._pvpDisabled = false;
    w._campaignMode = false;
    w.W = 2400;
    w.H = 2400;

    this._wave = 0;
    this._hordeKills = 0;
    this._survivalTime = 0;
    this._monstersAlive = 0;
    this._spawnTimer = 0;
    this._hordeActive = true;
    this._hordeOver = false;
    this._hordeScore = 0;

    w.leader.x = w.W / 2;
    w.leader.y = w.H / 2;
    w.leader.hp = w.leader.maxHp;
    w.leader.path = null;

    w.monsters = [];
    w.drops = [];
    w.treasureChests = [];
    w.armyUnits = [];
    w.initArmyUnits(8);

    this._spawnInitialHorde();
  }

  _spawnInitialHorde() {
    const w = this.world;
    for (let i = 0; i < this._initialCount; i++) {
      const m = this._spawnHordeMonster(i);
      w.monsters.push(m);
    }
    this._wave = 1;
    this._monstersAlive = this._initialCount;
    w.worldFx.push({
      x: w.leader.x, y: w.leader.y - 30,
      text: `🌊 الموجة ${this._wave}!`,
      color: "#ff6b6b", life: 2, maxLife: 2
    });
  }

  _spawnHordeMonster(id) {
    const w = this.world;
    let x, y;
    const angle = Math.random() * Math.PI * 2;
    const dist = 400 + Math.random() * 300;
    x = w.leader.x + Math.cos(angle) * dist;
    y = w.leader.y + Math.sin(angle) * dist;
    x = Math.max(50, Math.min(w.W - 50, x));
    y = Math.max(50, Math.min(w.H - 50, y));

    const monster = w.createMonster(id, x, y);
    monster._hordeMode = true;
    monster._hordeScale = 1;
    monster._aggressiveRange = this._hordeAggroRange;
    monster.rewardMoney = 5 + this._wave * 2;
    monster.rewardGold = 2 + this._wave;
    monster.radius = Math.max(8, monster.radius * 0.85);
    // وحوش الموجات المتأخرة أقوى
    if (this._wave > 5) {
      const waveMult = 1 + (this._wave - 5) * 0.05;
      monster.hp = Math.floor(monster.hp * waveMult);
      monster.maxHp = monster.hp;
      monster.damage = Math.floor(monster.damage * waveMult);
    }
    return monster;
  }

  update(dt) {
    if (!this._hordeActive || this._hordeOver) return;
    const w = this.world;

    this._survivalTime += dt;

    // تحديث حالة الوحوش العدوانية
    this._monstersAlive = 0;
    for (const m of w.monsters) {
      if (!m.alive) continue;
      this._monstersAlive++;
    }

    // تأخير بين الموجات (وقت للراحة وجمع الغنائم)
    if (this._waveDelayTimer > 0) {
      this._waveDelayTimer -= dt;
      if (this._waveDelayTimer <= 0) {
        this._nextWave();
      }
      return;
    }

    // فحص إذا انتهت الموجة (كل الوحوش ماتت)
    if (this._monstersAlive === 0 && this._wave < this._maxWave) {
      // بدء تأخير قبل الموجة التالية
      this._waveDelayTimer = this._waveDelayDuration;
      w.worldFx.push({
        x: w.leader.x, y: w.leader.y - 30,
        text: `⏳ الموجة ${this._wave} اكتملت! الموجة التالية بعد ${this._waveDelayDuration}ث`,
        color: "#4cd964", life: 2, maxLife: 2
      });
      return;
    }

    // فوز — أكملنا كل الموجات
    if (this._wave >= this._maxWave && this._monstersAlive === 0) {
      this._endHorde(true);
      return;
    }

    // فحص الخسارة
    if (w.leader.hp <= 0 && !this._hordeOver) {
      this._endHorde(false);
    }
  }

  _nextWave() {
    const w = this.world;
    this._wave++;
    
    // حساب عدد الوحوش — يزيد تدريجياً
    const spawnCount = Math.min(
      this._initialCount + Math.floor(this._wave * 1.5),
      this._maxMonsters
    );
    
    const startIdx = w.monsters.length;
    for (let i = 0; i < spawnCount; i++) {
      const m = this._spawnHordeMonster(startIdx + i);
      w.monsters.push(m);
    }
    this._monstersAlive = spawnCount;
    this._totalSpawned += spawnCount;
    
    // تأثير وصول الموجة
    if (this.world && this.world.engine) this.world.engine.shake(6, 0.2);
    
    w.worldFx.push({
      x: w.leader.x, y: w.leader.y - 30,
      text: `🌊 الموجة ${this._wave}/${this._maxWave}! (${spawnCount} وحش)`,
      color: "#ff6b6b", life: 3, maxLife: 3
    });
  }

  onMonsterKilled(monster) {
    if (!this._hordeActive || this._hordeOver) return;
    const w = this.world;
    this._hordeKills++;
    this._hordeScore += 10 + this._wave * 2;

    // إزالة التضاعف الأسي — بدلاً من ذلك نضيف نقاط ومكافآت أكثر
    // الوحوش الجديدة تأتي فقط مع الموجة الجديدة

    // XP ومكافآت إضافية
    if (w.economy) {
      const xpGain = 5 + this._wave;
      w.economy.addXp(xpGain);
    }
    
    // تأثير كومبو كل 5 قتلى
    if (this._hordeKills % 5 === 0) {
      w.worldFx.push({
        x: monster.x, y: monster.y - 30,
        text: `🔥 ${this._hordeKills} قتلى! كومبو!`,
        color: "#ff6b6b", life: 1.5, maxLife: 1.5
      });
    }
  }

  _endHorde(won = false) {
    if (this._hordeOver) return;
    this._hordeOver = true;
    this._hordeActive = false;
    const w = this.world;
    
    let bonus;
    if (won) {
      bonus = Math.floor(this._hordeScore * 0.2 + this._wave * 30 + this._hordeKills * 10 + 500);
    } else {
      bonus = Math.floor(this._hordeScore * 0.1 + this._wave * 20 + this._hordeKills * 5);
    }
    
    if (w.economy) {
      w.economy.addRaw("gold", bonus);
      w.economy.addXp(Math.floor(this._hordeScore * 0.5));
    }
    
    const resultText = won ? '🎉' : '💀';
    const resultMsg = won 
      ? `🎉 انتصرت في الحشد! كل ${this._maxWave} موجة` 
      : `💀 انتهت الحشد! وصلت للموجة ${this._wave}`;
    
    w.worldFx.push({
      x: w.leader.x, y: w.leader.y - 30,
      text: `${resultMsg} | ${this._hordeKills} قتلى | مكافأة ${bonus} 🪙`,
      color: "#FFD700", life: 4, maxLife: 4
    });
    w.sessionStats.coinsEarned += bonus;
  }

  onWipe() {
    this._endHorde(false);
  }

  drawUI(ctx) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const dpr = window.devicePixelRatio || 1;
    ctx.scale(dpr, dpr);
    const cw = ctx.canvas.width / dpr;

    // لوحة الحالة (أعلى يسار)
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    const panelW = 200;
    const panelH = this._hordeActive ? 130 : 100;
    ctx.fillRect(cw - panelW - 8, 8, panelW, panelH);

    ctx.fillStyle = "#ff6b6b";
    ctx.font = "bold 14px Cairo, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(`🌊 الموجة ${this._wave}/${this._maxWave}`, cw - 14, 28);

    ctx.fillStyle = "#fdcb6e";
    ctx.font = "bold 12px Cairo, sans-serif";
    ctx.fillText(`⚔️ ${this._hordeKills} قتلى`, cw - 14, 48);

    ctx.fillStyle = "#ff9ff3";
    ctx.fillText(`👹 ${this._monstersAlive} حي`, cw - 14, 68);

    ctx.fillStyle = "#4cd964";
    const mins = Math.floor(this._survivalTime / 60);
    const secs = Math.floor(this._survivalTime % 60);
    ctx.fillText(`⏱ ${mins}:${secs.toString().padStart(2, '0')}`, cw - 14, 88);

    // شريط تقدم الموجات
    if (this._hordeActive) {
      const waveProgress = this._wave / this._maxWave;
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(cw - panelW - 8 + 10, 94, panelW - 20, 4);
      ctx.fillStyle = "#ff6b6b";
      ctx.fillRect(cw - panelW - 8 + 10, 94, (panelW - 20) * Math.min(1, waveProgress), 4);
      
      // عدد الوحوش المتبقية في هذه الموجة
      ctx.fillStyle = "#fdcb6e";
      ctx.font = "bold 10px Cairo, sans-serif";
      if (this._waveDelayTimer > 0) {
        ctx.fillText(`⏳ الموجة التالية بعد ${Math.ceil(this._waveDelayTimer)}ث`, cw - 14, 114);
      } else {
        ctx.fillText(`🏆 اكمال ${this._maxWave} موجة للفوز`, cw - 14, 114);
      }
    }

    // شريط XP
    ctx.fillStyle = "#f39c12";
    ctx.font = "bold 10px Cairo, sans-serif";
    ctx.fillText(`🏆 ${this._hordeScore} نقطة`, cw - 14, panelH + 24);

    // تحذير إذا عدد الوحوش كبير
    if (this._monstersAlive > 30) {
      ctx.fillStyle = "rgba(255,0,0,0.7)";
      ctx.font = "bold 16px Cairo, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`⚠️ ${this._monstersAlive} وحش!`, cw / 2, 60);
    }

    ctx.restore();
  }

  exit() {
    const w = this.world;
    w.mode = "campaign";
    w._pvpDisabled = false;
    w.monsters = [];
    w.drops = [];
    w.treasureChests = [];
    this._hordeActive = false;
    this._hordeOver = false;
  }

  /** حفظ تقدم نمط الحشد */
  getSaveData() {
    return {
      modeName: this.modeName,
      wave: this._wave,
      hordeKills: this._hordeKills,
      survivalTime: this._survivalTime,
      hordeScore: this._hordeScore,
      totalSpawned: this._totalSpawned,
    };
  }

  /** استعادة تقدم نمط الحشد */
  loadState(data) {
    if (!data) return;
    this._wave = data.wave || 0;
    this._hordeKills = data.hordeKills || 0;
    this._survivalTime = data.survivalTime || 0;
    this._hordeScore = data.hordeScore || 0;
    this._totalSpawned = data.totalSpawned || 0;
  }
}
