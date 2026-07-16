import { drawWeaponGlow, drawWeaponStarIcons, drawWeaponOnHero } from "./combat/weapon-visuals.js";
import { spriteFactory, SpriteFactory } from "./sprite-factory.js";

export function injectRenderMethods(WorldMap) {
  WorldMap.prototype.syncWeaponVisuals = function () {
    const weapons = this.army?.weapons || [];
    const equipped = weapons.find(w => w.id === this._equippedWeapon);
    if (equipped && equipped.owned) {
      this._weaponStarLevel = equipped.level || 1;
      this._weaponGemLevel = equipped.gemLevel || 1;
    } else {
      this._weaponStarLevel = 0;
      this._weaponGemLevel = 0;
    }
  };

  WorldMap.prototype.drawHero = function (ctx) {
    const l = this.leader;
    const useSprites = this._isometricEnabled && spriteFactory.isReady;

    ctx.save();
    ctx.translate(l.x, l.y);

    // ظل
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath();
    ctx.ellipse(0, l.radius * 0.6, l.radius * 0.8, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Glow للسلاح إذا كان 2★+
    if (this._weaponStarLevel >= 2) {
      drawWeaponGlow(ctx, 0, 0, this._weaponStarLevel, l.radius, this._glowTime || 0);
    }

    if (useSprites) {
      // تحديد الاتجاه من الحركة
      let dx = 0, dy = 0;
      if (l.fighting) {
        dx = l.fighting.x - l.x;
        dy = l.fighting.y - l.y;
      } else if (l.path && l.pathIdx < l.path.length) {
        dx = l.path[l.pathIdx].x - l.x;
        dy = l.path[l.pathIdx].y - l.y;
      }
      const dir = SpriteFactory.vectorToDirection(dx, dy);
      const animState = this._getAnimState(l, !!l.fighting);
      spriteFactory.draw(ctx, "leader", 0, 0, dir, animState, this._spriteFrame, 1.3, l.facing < 0);
    } else {
      // Fallback: الكود الأصلي
      ctx.scale(l.facing || 1, 1);
      this._drawSprite(ctx, "leader-player", "#2c1810", l.radius);
      ctx.scale(1 / (l.facing || 1), 1);

      // تاج ذهبي
      ctx.fillStyle = "#f5d76e";
      ctx.fillRect(-6, -l.radius - 8, 12, 8);
    }

    // Rage glow عندما HP < 30%
    const hpRatio = l.hp / l.maxHp;
    if (hpRatio < 0.3 && l.fighting) {
      const ragePulse = 0.3 + 0.2 * Math.sin(Date.now() * 0.008);
      ctx.save();
      ctx.shadowColor = "#ff0000";
      ctx.shadowBlur = 20 * ragePulse;
      ctx.fillStyle = `rgba(255,0,0,${ragePulse * 0.15})`;
      ctx.beginPath();
      ctx.arc(0, 0, l.radius * 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // HP bar
    const hp = l.hp / l.maxHp;
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(-l.radius, -l.radius - 18, l.radius * 2, 4);
    ctx.fillStyle = hp > 0.5 ? "#4cd964" : "#ff4444";
    ctx.fillRect(-l.radius, -l.radius - 18, l.radius * 2 * hp, 4);

    ctx.restore();

    // 🗡️ رسم السلاح المجهز فوق القائد (مع حركة عائمة)
    if (this._equippedWeapon) {
      drawWeaponOnHero(ctx, this._equippedWeapon, l.x, l.y, l.radius, this._weaponStarLevel || 1, this._glowTime || 0);
    }

    if (this._weaponStarLevel >= 1) {
      drawWeaponStarIcons(ctx, l.x, l.y - l.radius - 28, this._weaponStarLevel, 8);
    }
  };

  WorldMap.prototype.drawArmy = function (ctx) {
    for (const u of this.armyUnits) {
      ctx.save();
      ctx.translate(u.x, u.y);

      // ظل
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.beginPath();
      ctx.ellipse(0, u.radius * 0.6, u.radius * 0.7, 3, 0, 0, Math.PI * 2);
      ctx.fill();

      // قلب الاتجاه
      ctx.scale(u.facing || 1, 1);
      this._drawSprite(ctx, "soldier-player", "#3d2b1f", u.radius);
      ctx.scale(1 / (u.facing || 1), 1);

      const hp = u.hp / u.maxHp;
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(-u.radius, -u.radius - 10, u.radius * 2, 3);
      ctx.fillStyle = hp > 0.5 ? "#4cd964" : "#ffaa00";
      ctx.fillRect(-u.radius, -u.radius - 10, u.radius * 2 * hp, 3);

      ctx.restore();
    }
  };

  WorldMap.prototype.drawMonsters = function (ctx) {
    for (const m of this.monsters) {
      if (!m.alive) continue;
      ctx.save();
      ctx.translate(m.x, m.y);

      // ظل
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.beginPath();
      ctx.ellipse(0, m.radius * 0.5, m.radius * 0.7, 3, 0, 0, Math.PI * 2);
      ctx.fill();

      // قلب الاتجاه
      ctx.scale(m.facing || 1, 1);
      this._drawSprite(ctx, m.imageKey, m.color, m.radius);
      ctx.scale(1 / (m.facing || 1), 1);

      const hp = m.hp / m.maxHp;
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(-m.radius, -m.radius - 12, m.radius * 2, 4);
      ctx.fillStyle = hp > 0.5 ? "#4cd964" : "#ff4444";
      ctx.fillRect(-m.radius, -m.radius - 12, m.radius * 2 * hp, 4);

      ctx.fillStyle = "#fff";
      ctx.font = "bold 11px Cairo, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(m.name, 0, -m.radius - 18);

      ctx.restore();
    }
  };

  WorldMap.prototype.drawDrops = function (ctx) {
    for (const d of this.drops) {
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.fillStyle = "#f1c40f";
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = "bold 10px Cairo";
      ctx.textAlign = "center";
      ctx.fillText("+" + d.money, 0, -14);
      ctx.restore();
    }
  };

  WorldMap.prototype.drawProjectiles = function (ctx) {
    ctx.fillStyle = "#e74c3c";
    for (const p of this.projectiles) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  WorldMap.prototype.drawWorldFx = function (ctx) {
    for (const fx of this.worldFx) {
      const alpha = fx.life / fx.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = fx.color;
      ctx.font = "bold 14px Cairo, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(fx.text, fx.x, fx.y - (1 - alpha) * 20);
      ctx.globalAlpha = 1;
    }
  };
}
