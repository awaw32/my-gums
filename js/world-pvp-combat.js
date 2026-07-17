import { computePvPDamage } from "./combat-engine.js";
import { spawnPvPParticles, updatePvPParticles, drawPvPParticles, spawnHitEffect } from "./combat/combat-effects.js";

export function injectPvPCombatMethods(WorldMap) {
  WorldMap.prototype.updatePvPCombat = function (dt) {
    if (this._pvpResultSent) return;
    const target = this._pvpAttackTarget;
    if (!target) return;

    // درع المبتدئين — حماية من PvP لأول دقيقتين
    if (this._newbieShieldTimer > 0) {
      this._newbieShieldTimer -= dt;
      if (this._newbieShieldTimer > 0) {
        this.worldFx.push({ x: this.leader.x, y: this.leader.y - 30, text: "🛡️ أنت محمي!", color: "#4a90d9", life: 0.3, maxLife: 0.3 });
        this._pvpResultSent = true;
        this._isPvPEngaged = false;
        this._pvpAttackTarget = null;
        if (this.store) this.store.set('notification', { text: "🛡️ درع المبتدئين يحميك! عد بعد دقيقتين.", t: Date.now() });
        return;
      }
    }

    const dist = Math.hypot(this.leader.x - target.x, this.leader.y - target.y);
    const inRange = dist <= this.engagementRadius;

    // ── Engagement check ──
    if (inRange) {
      this._isPvPEngaged = true;
    }

    if (!this._isPvPEngaged) return;

    // ── Escape detection (check ALL units every 0.5s) ──
    this._pvpEscapeCheckTimer += dt;
    if (this._pvpEscapeCheckTimer >= 0.5) {
      this._pvpEscapeCheckTimer = 0;
      if (this._checkPvPEscape(target)) {
        this._onPvPEscape(target);
        return;
      }
    }

    // ── Particles ──
    this.spawnPvPParticles(
      (this.leader.x + target.x) / 2 + (Math.random() - 0.5) * 30,
      (this.leader.y + target.y) / 2 + (Math.random() - 0.5) * 30
    );

    // ── Damage tick ──
    this._pvpDamageCD -= dt;
    if (this._pvpDamageCD <= 0) {
      this._pvpDamageCD = this._pvpDamageInterval;

      const myStats = this.computePvPStats();
      const enemyStats = this.estimateEnemyStats(target);
      const crit = this._rollCrit();

      const myDmg = computePvPDamage(myStats.totalDamage, crit, myStats.weaponStats.weaponDamage);
      const theirDmg = enemyStats.damage;

      target._hp = (target._hp ?? enemyStats.maxHp) - myDmg;
      this.damageHero(theirDmg * 0.6);

      if (target._hp <= 0) target._hp = 0;
      if (this.leader.hp <= 0) this.leader.hp = 0;

      // تأثيرات مرئية
      const midX = (this.leader.x + target.x) / 2;
      const midY = (this.leader.y + target.y) / 2 - 20;
      spawnHitEffect(this, midX, midY, crit.isCrit, this._equippedWeapon);
      if (this.engine) {
        this.engine.shake(crit.isCrit ? 8 : 3, 0.08);
      }

      const dmgText = crit.isCrit ? `💥 CRIT ${myDmg}!` : `-${myDmg}`;
      this.worldFx.push({
        x: midX,
        y: midY,
        text: dmgText,
        color: crit.isCrit ? "#ffd700" : "#ff6b35",
        life: 0.8, maxLife: 0.8
      });

      if (this.leader.hp <= 0 || target._hp <= 0) {
        this._pvpResultSent = true;
        this.resolvePvP(target, target._hp <= 0);
        return;
      }
    }
  };

  WorldMap.prototype._checkPvPEscape = function (target) {
    if (!target) return true;
    const leaderIn = Math.hypot(this.leader.x - target.x, this.leader.y - target.y) <= this.engagementRadius;
    if (leaderIn) return false;
    for (const u of this.armyUnits) {
      if (u.hp > 0 && Math.hypot(u.x - target.x, u.y - target.y) <= this.engagementRadius) {
        return false;
      }
    }
    return true;
  };

  WorldMap.prototype._onPvPEscape = function (target) {
    this._isPvPEngaged = false;
    this._pvpAttackTarget = null;
    this._pvpFledTarget = target;
    this._pvpDamageCD = 0;

    this.leader.path = null;
    this.leader.fighting = null;
    this.armyUnits.forEach(u => { u.fighting = null; });

    this.worldFx.push({
      x: this.leader.x, y: this.leader.y,
      text: "🛑 انسحاب! الجيش في الانتظار",
      color: "#ffaa00",
      life: 1.5, maxLife: 1.5
    });

    if (this.store) {
      this.store.set('notification', {
        text: `🛑 انسحبت من المعركة ضد ${target.username} — اضغط عليه للمطاردة`,
        t: Date.now()
      });
    }
  };

  // ==================== PvP Combat Particles ====================

  WorldMap.prototype.spawnPvPParticles = function (x, y) {
    spawnPvPParticles(this, x, y);
  };

  WorldMap.prototype.updatePvPParticles = function (dt) {
    updatePvPParticles(this, dt);
  };

  WorldMap.prototype.drawPvPParticles = function (ctx) {
    drawPvPParticles(this, ctx);
  };
}
