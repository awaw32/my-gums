import { aStar, simplifyPath } from "./pathfinding.js";
import { drawPathLine } from "./combat/combat-effects.js";
import { showPvPMenu, hidePvPMenu } from "./ui/context-menu.js";

export function injectPvPMenuMethods(WorldMap) {
  WorldMap.prototype._startPvPPursuit = function (target) {
    this._isPvPEngaged = false;
    this._pvpResultSent = false;
    this._pvpDamageCD = 0;
    this._pvpAttackTarget = target;
    this._pvpFledTarget = null;

    const path = aStar(this.leader.x, this.leader.y, target.x, target.y, this.W, this.H);
    this.leader.path = simplifyPath(path);
    this.leader.pathIdx = 0;
    this._moveTargetX = target.x;
    this._moveTargetY = target.y;
  };

  WorldMap.prototype._showPvPMenu = function (otherPlayer) {
    if (this._pvpDisabled) return;
    showPvPMenu(this, otherPlayer);
  };

  WorldMap.prototype._hidePvPMenu = function () {
    hidePvPMenu(this);
  };

  WorldMap.prototype._onPvPAttack = function () {
    const target = this._pvpTarget;
    if (!target) return;
    if (this._pvpDisabled) return;
    // حماية لمدة 30 ثانية بعد الموت
    if (this._pvpProtectionTimer > 0) {
      const secs = Math.ceil(this._pvpProtectionTimer);
      this.worldFx.push({
        x: this.leader.x, y: this.leader.y,
        text: `🛡️ أنت محمي لمدة ${secs}ث`,
        color: "#4cd964", life: 2, maxLife: 2
      });
      return;
    }
    this._hidePvPMenu();
    this._startPvPAttack(target);
  };

  WorldMap.prototype._onPvPInspect = function () {
    const target = this._pvpTarget;
    if (!target) return;
    const popup = document.getElementById("pvp-inspect-popup");
    const nameEl = document.getElementById("pvp-inspect-name");
    const repEl = document.getElementById("pvp-inspect-rep");
    const powerEl = document.getElementById("pvp-inspect-power");
    const killsEl = document.getElementById("pvp-inspect-kills");
    const coinsEl = document.getElementById("pvp-inspect-coins");
    if (popup && nameEl) {
      nameEl.textContent = target.username || "—";
      if (repEl) repEl.textContent = `${target.repIcon || "😐"} ${target.repTitle || "محايد"}`;
      const est = this.estimateEnemyStats(target);
      if (powerEl) powerEl.textContent = `${target.army_power || 0} 👊 (DMG: ${est.damage} | HP: ${est.maxHp})`;
      if (killsEl) killsEl.textContent = target.kills || 0;
      if (coinsEl) coinsEl.textContent = target.coinsEarned || 0;
      popup.classList.remove("hidden");
    }
  };

  WorldMap.prototype._startPvPAttack = function (target) {
    const myStats = this.computePvPStats();
    this.leader.maxHp = myStats.maxHp;
    if (this.leader.hp > this.leader.maxHp) this.leader.hp = this.leader.maxHp;

    target._hp = null;
    this._pvpAttackTarget = target;
    this._isPvPEngaged = false;
    this._pvpDamageCD = 0;
    this._pvpResultSent = false;
    this._pvpFledTarget = null;
    this._pvpParticles = [];

    const path = aStar(this.leader.x, this.leader.y, target.x, target.y, this.W, this.H);
    this.leader.path = simplifyPath(path);
    this.leader.pathIdx = 0;
    this._moveTargetX = target.x;
    this._moveTargetY = target.y;
  };

  WorldMap.prototype._cancelPvPAttack = function () {
    this._pvpAttackTarget = null;
    this._isPvPEngaged = false;
    this._pvpDamageCD = 0;
    this._pvpResultSent = false;
    this._pvpFledTarget = null;
    this._pvpParticles = [];
  };

  WorldMap.prototype.findMonsterAt = function (x, y) {
    let closest = null;
    let minDist = 120;
    for (const m of this.monsters) {
      if (!m.alive) continue;
      const d = Math.hypot(m.x - x, m.y - y);
      if (d < minDist) {
        minDist = d;
        closest = m;
      }
    }
    return closest;
  };

  WorldMap.prototype.engageMonster = function (monster) {
    this.leader.fighting = monster;
    this.armyUnits.forEach(u => u.fighting = monster);
  };

  WorldMap.prototype.drawPathLine = function (ctx, cam) {
    drawPathLine(this, ctx, cam);
  };
}
