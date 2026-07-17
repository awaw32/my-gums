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
