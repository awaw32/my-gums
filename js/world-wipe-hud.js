import { showWipeScreen } from "./ui/context-menu.js";

export function injectWipeHudMethods(WorldMap) {
  WorldMap.prototype.checkWipe = function () {
    if (this.mode === "battle_royale") return;
    if (this.leader.hp <= 0 && this._pvpDefeatShown) return;
    if (this.leader.hp <= 0) {
      this._wipeFlag = true;
    }
    if (this._wipeFlag) {
      this._wipeFlag = false;
      this.onWipe();
    }
  };

  WorldMap.prototype.onWipe = function () {
    this._invulnerableTimer = 3;
    // 🛡️ إذا كان النمط النشط ينهي "جولته" بالموت (مثل الحشد) ويعرض شاشة نتيجة خاصة به،
    // نتجنب ازدواج شاشة الهزيمة العامة فوقها. الأنماط الأخرى (كهف/استخراج) تستمر جولتها
    // بعد الموت فتبقى شاشة الهزيمة العامة مناسبة لها كما هي.
    let modeHandledScreen = false;
    if (this._activeMode && typeof this._activeMode.onWipe === 'function') {
      modeHandledScreen = this._activeMode.onWipe() === true;
    }
    this._cancelPvPAttack();
    this._pvpDefeatShown = false;
    const pvpModal = document.getElementById("pvp-defeat-modal");
    if (pvpModal) {
      pvpModal.classList.add("hidden");
      const returnBtn = document.getElementById("pvp-defeat-return-btn");
      if (returnBtn && returnBtn._pvpCountdown) { clearInterval(returnBtn._pvpCountdown); returnBtn._pvpCountdown = null; }
    }
    const lost = this.sessionStats.coinsEarned;
    const killed = this.sessionStats.kills;
    if (this.economy && lost > 0) {
      this.economy.addRaw("cash", -lost);
      this.economy.addXp(-Math.floor(killed * 5));
      if (this.netSync) this.netSync.sendPositionUpdate();
    }
    // 💀 خوف الخسارة — إذا مات اللاعب خارج الواحة، يُخصم -15% ذهب و-50% ماء
    // فعلياً على الخادم (سيرفر-موثوق)، وينشأ صندوق (death_crate) مكان الموت
    // يظهر للجميع 3 دقائق. لا يُطبَّق أي خصم هنا على العميل مباشرة — فقط إشعار.
    if (!this.isInSafeZone(this.leader.x, this.leader.y)) {
      this._sendWS({ type: "player_died", x: this.leader.x, y: this.leader.y });
      if (this.store) this.store.set('notification', { text: "😱 سقطت أمتعتك! عد قبل 3 دقائق!", t: Date.now() });
    }
    this.sessionStats = { kills: 0, coinsEarned: 0, pvpWins: 0, upgradesToday: 0 };
    this.leader.hp = this.leader.maxHp;
    this.leader.x = this.W / 2;
    this.leader.y = this.H / 2;
    this.leader.path = null;
    this.initArmyUnits(8);
    if (!modeHandledScreen) this._showWipeScreen(lost, killed);
    if (this.store) this.store.set('notification', { text: `💀 هُزمت! خسرت ${lost} 💵`, t: Date.now() });
    if (this._onWipe) this._onWipe(lost, killed);
  };

  WorldMap.prototype._showWipeScreen = function (lost, killed) {
    showWipeScreen(this, lost, killed);
  };

  WorldMap.prototype.drawArmyHUD = function (dt, ctx) {
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
  };

  // 🏜️ عند انخفاض العطش (<20) يظهر تغبيش خفيف على أطراف الشاشة (دوار من العطش)
  // بدل فلتر blur حقيقي (مكلف على أجهزة الجوال الضعيفة) — نستخدم تدرجاً شفافاً.
  WorldMap.prototype.drawDehydrationVignette = function (ctx) {
    if (!this.economy || this.economy.thirst >= 20) return;
    const intensity = 1 - this.economy.thirst / 20; // 0 عند 20، 1 عند 0
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const dpr = window.devicePixelRatio || 1;
    ctx.scale(dpr, dpr);
    const cw = ctx.canvas.width / dpr;
    const ch = ctx.canvas.height / dpr;
    const grad = ctx.createRadialGradient(cw / 2, ch / 2, ch * 0.25, cw / 2, ch / 2, ch * 0.7);
    grad.addColorStop(0, "rgba(120,80,20,0)");
    grad.addColorStop(1, `rgba(120,80,20,${0.55 * intensity})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, cw, ch);
    ctx.restore();
  };

  /**
   * 🏜️ عاصفة رملية عالمية — تعتيم بني شفاف (رؤية -70%) فوق الشاشة بالكامل،
   * تختلف عن drawDehydrationVignette (تدرج شعاعي محلي حول اللاعب) بأنها تغطية
   * مسطحة كاملة الشاشة تعكس حالة عالمية يبثّها السيرفر لكل اللاعبين معاً.
   */
  WorldMap.prototype.drawSandstormOverlay = function (ctx) {
    if (!this._globalSandstormActive) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const dpr = window.devicePixelRatio || 1;
    ctx.scale(dpr, dpr);
    const cw = ctx.canvas.width / dpr;
    const ch = ctx.canvas.height / dpr;
    ctx.fillStyle = "rgba(120, 90, 40, 0.5)";
    ctx.fillRect(0, 0, cw, ch);
    ctx.restore();
  };

  WorldMap.prototype.drawPvPMenu = function (ctx, cam) {
    const target = this._pvpTarget;
    if (!target) return;
    const sx = target.x - cam.x;
    const sy = target.y - cam.y;
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(sx - 38, sy - 48, 76, 22);
    ctx.fillStyle = "#FFD700";
    ctx.font = "bold 9px Cairo, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`👤 ${target.username}`, sx, sy - 34);
    ctx.restore();
  };
}
