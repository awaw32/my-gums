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
      this._spawnHordeMonster(i);
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
    monster._aggressiveRange = 500;
    monster.rewardMoney = 5 + this._wave * 2;
    monster.rewardGold = 2 + this._wave;
    monster.radius = Math.max(8, monster.radius * 0.85);
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

    // فحص إذا انتهت الموجة (كل الوحوش ماتت)
    if (this._monstersAlive === 0 && this._wave < 30) {
      this._nextWave();
    }

    // فحص الخسارة
    if (this._monstersAlive >= this._maxMonsters && w.leader.hp <= 0) {
      this._endHorde();
    }

    // إذا القائد مات أو كل الجنود ماتوا
    if (w.leader.hp <= 0 && !this._hordeOver) {
      this._endHorde();
    }
  }

  _nextWave() {
    const w = this.world;
    this._wave++;
    const spawnCount = this._initialCount + this._wave * 2;
    const startIdx = w.monsters.length;
    for (let i = 0; i < spawnCount; i++) {
      const m = this._spawnHordeMonster(startIdx + i);
      w.monsters.push(m);
    }
    this._monstersAlive = spawnCount;
    w.worldFx.push({
      x: w.leader.x, y: w.leader.y - 30,
      text: `🌊 الموجة ${this._wave}! (${spawnCount} وحش)`,
      color: "#ff6b6b", life: 2.5, maxLife: 2.5
    });
  }

  onMonsterKilled(monster) {
    if (!this._hordeActive || this._hordeOver) return;
    const w = this.world;
    this._hordeKills++;
    this._hordeScore += 10 + this._wave * 2;

    // تضاعف: كل وحش يموت يظهر 2 مكانه
    const doubleCount = 2;
    const startIdx = w.monsters.length;
    for (let i = 0; i < doubleCount; i++) {
      if (w.monsters.length >= this._maxMonsters) break;
      const m = this._spawnHordeMonster(startIdx + i);
      m.x = monster.x + (Math.random() - 0.5) * 60;
      m.y = monster.y + (Math.random() - 0.5) * 60;
      m.hp = Math.floor(monster.maxHp * 0.7);
      m.maxHp = m.hp;
      m.radius = Math.max(6, monster.radius * 0.9);
      m._hordeScale = 0.9;
      w.monsters.push(m);
    }

    // XP ومكافآت
    if (w.economy) {
      const xpGain = 5 + this._wave;
      w.economy.addXp(xpGain);
    }
  }

  _endHorde() {
    if (this._hordeOver) return;
    this._hordeOver = true;
    this._hordeActive = false;
    const w = this.world;
    const bonus = Math.floor(this._hordeScore * 0.1 + this._wave * 20 + this._hordeKills * 5);
    if (w.economy) {
      w.economy.addRaw("gold", bonus);
      w.economy.addXp(Math.floor(this._hordeScore * 0.5));
    }
    w.worldFx.push({
      x: w.leader.x, y: w.leader.y - 30,
      text: `🏆 انتهت الحشد! الموجة ${this._wave} | ${this._hordeKills} قتلى | مكافأة ${bonus} 🪙`,
      color: "#FFD700", life: 4, maxLife: 4
    });
    w.sessionStats.coinsEarned += bonus;
  }

  onWipe() {
    this._endHorde();
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
    ctx.fillRect(cw - panelW - 8, 8, panelW, 100);

    ctx.fillStyle = "#ff6b6b";
    ctx.font = "bold 14px Cairo, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(`🌊 الموجة ${this._wave}`, cw - 14, 28);

    ctx.fillStyle = "#fdcb6e";
    ctx.font = "bold 12px Cairo, sans-serif";
    ctx.fillText(`⚔️ ${this._hordeKills} قتلى`, cw - 14, 48);

    ctx.fillStyle = "#ff9ff3";
    ctx.fillText(`👹 ${this._monstersAlive} وحش حي`, cw - 14, 68);

    ctx.fillStyle = "#4cd964";
    const mins = Math.floor(this._survivalTime / 60);
    const secs = Math.floor(this._survivalTime % 60);
    ctx.fillText(`⏱ ${mins}:${secs.toString().padStart(2, '0')}`, cw - 14, 88);

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
    this._hordeActive = false;
    this._hordeOver = false;
  }
}
