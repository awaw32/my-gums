import { getVisualTroopCount, getTroopFormation } from "./combat/troop-visuals.js";
import { drawWeaponGlow, drawWeaponStarIcons } from "./combat/weapon-visuals.js";
import { spriteFactory, SpriteFactory } from "./sprite-factory.js";

export function injectEntitiesMethods(WorldMap) {
  WorldMap.prototype._drawTelegraphs = function (ctx) {
    if (!this._telegraphs || this._telegraphs.length === 0) return;
    ctx.save();
    for (const t of this._telegraphs) {
      const alpha = Math.min(1, t.life / (t.maxLife || 1));
      ctx.globalAlpha = alpha * 0.35;
      if (t.w && t.h) {
        ctx.fillStyle = t.color || "#ff444466";
        ctx.fillRect(t.x, t.y, t.w, t.h);
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.globalAlpha = alpha * 0.7;
        ctx.strokeRect(t.x, t.y, t.w, t.h);
      } else if (t.radius) {
        ctx.beginPath();
        ctx.arc(t.x, t.y, t.radius, 0, Math.PI * 2);
        ctx.fillStyle = t.color || "#ff444466";
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.globalAlpha = alpha * 0.7;
        ctx.stroke();
      }
    }
    ctx.restore();
  };

  /**
   * 🖼️ حجب الكيانات خارج نطاق رؤية الكاميرا (Frustum Culling) — شبكة أمان أداء
   * تستخدم camera.visible() الموجودة أصلاً في المحرك، بلا أي تغيير بصري.
   */
  WorldMap.prototype._isEntityVisible = function (x, y, margin = 150) {
    const visible = this.engine?.camera?.visible;
    if (typeof visible !== "function") return true; // بيئة بلا كاميرا (اختبارات مثلاً) — لا حجب
    return visible(x, y, margin);
  };

  /**
   * رسم جميع الكائنات مع ترتيب العمق (2.5D depth sorting).
   * الكائنات التي يبلغ عمقها (x+y) أقل تُرسم أولاً (خلف).
   */
  WorldMap.prototype._drawEntitiesSorted = function (ctx) {
    const ds = this._depthSorter;
    ds.clear();

    // إضافة الوحوش
    for (const m of this.monsters) {
      if (!m.alive) continue;
      if (!this._isEntityVisible(m.x, m.y, m.radius + 60)) continue;
      ds.add(m.x, m.y, (c) => this._drawMonsterEntity(c, m));
    }

    // إضافة الـ drops
    for (const d of this.drops) {
      if (d.collected) continue;
      if (!this._isEntityVisible(d.x, d.y)) continue;
      ds.add(d.x, d.y, (c) => this._drawDropEntity(c, d));
    }

    // 🎁 إضافة صناديق الكنز
    for (const c of this.treasureChests) {
      if (c.opened) continue;
      if (!this._isEntityVisible(c.x, c.y)) continue;
      ds.add(c.x, c.y, (c2) => this._drawTreasureChestEntity(c2, c));
    }

    // إضافة الجنود
    for (const u of this.armyUnits) {
      if (!this._isEntityVisible(u.x, u.y, u.radius + 60)) continue;
      ds.add(u.x, u.y, (c) => this._drawArmyEntity(c, u));
    }

    // إضافة اللاعبين الآخرين
    for (const [, p] of this.otherPlayers) {
      if (!this._isEntityVisible(p.x, p.y, (p.radius || 20) + 100)) continue;
      ds.add(p.x, p.y, (c) => this._drawOtherPlayerEntity(c, p));
    }

    // إضافة قطاع الطرق (BR)
    if (this.mode === "battle_royale") {
      for (const b of this.bandits) {
        if (!b.alive) continue;
        if (!this._isEntityVisible(b.x, b.y, 80)) continue;
        ds.add(b.x, b.y, (c) => this._drawBanditEntity(c, b));
      }
    }

    // إضافة القائد (دائماً في الأعلى — بلا حجب، يبقى ظاهراً دوماً)
    ds.add(this.leader.x, this.leader.y + 1000, (c) => this.drawHero(c));

    ds.drawAll(ctx);
  };

  /**
   * 🎬 يحدّد حالة حركة الكيان (وقوف/مشي/هجوم) اعتماداً على معطيات موجودة أصلاً —
   * بلا حاجة لتتبّع حالة جديدة معقّدة. يُستخدم مع كل استدعاءات spriteFactory.draw.
   */
  WorldMap.prototype._getAnimState = function (entity, isFighting) {
    if (isFighting) return "attack";
    const px = entity._animPrevX, py = entity._animPrevY;
    entity._animPrevX = entity.x;
    entity._animPrevY = entity.y;
    if (px === undefined) return "idle";
    const moved = Math.hypot(entity.x - px, entity.y - py) > 0.15;
    return moved ? "walk" : "idle";
  };

  /**
   * رسم وحش واحد
   */
  WorldMap.prototype._drawMonsterEntity = function (ctx, m) {
    const useSprites = this._isometricEnabled && spriteFactory.isReady;
    const dir = SpriteFactory.vectorToDirection(
      m._chaseTarget ? m._chaseTarget.x - m.x : (m._patrolTarget ? m._patrolTarget.x - m.x : 0),
      m._chaseTarget ? m._chaseTarget.y - m.y : (m._patrolTarget ? m._patrolTarget.y - m.y : 0)
    );

    ctx.save();
    ctx.translate(m.x, m.y);

    // ظل
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath();
    ctx.ellipse(0, m.radius * 0.5, m.radius * 0.7, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // رسم الشخصية
    if (useSprites) {
      const flipX = m.facing < 0;
      const spriteType = m.imageKey === "monster-1" ? "wolf" :
                          m.imageKey === "monster-2" ? "shadow" : "sandlord";
      const isAttacking = !!(m._chaseTarget && Math.hypot(m.x - m._chaseTarget.x, m.y - m._chaseTarget.y) < 30);
      const animState = this._getAnimState(m, isAttacking);
      spriteFactory.draw(ctx, spriteType, 0, 0, dir, animState, this._spriteFrame, 1.2, flipX);
    } else {
      ctx.scale(m.facing || 1, 1);
      this._drawSprite(ctx, m.imageKey, m.color, m.radius);
      ctx.scale(1 / (m.facing || 1), 1);
    }

    // HP bar
    const hp = m.hp / m.maxHp;
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(-m.radius, -m.radius - 12, m.radius * 2, 4);
    ctx.fillStyle = hp > 0.5 ? "#4cd964" : "#ff4444";
    ctx.fillRect(-m.radius, -m.radius - 12, m.radius * 2 * hp, 4);

    // Name
    ctx.fillStyle = "#fff";
    ctx.font = "bold 11px Cairo, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(m.name, 0, -m.radius - 18);

    ctx.restore();
  };

  /**
   * رسم جندي واحد
   */
  WorldMap.prototype._drawArmyEntity = function (ctx, u) {
    const useSprites = this._isometricEnabled && spriteFactory.isReady;

    ctx.save();
    ctx.translate(u.x, u.y);

    // ظل
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath();
    ctx.ellipse(0, u.radius * 0.6, u.radius * 0.7, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    if (useSprites) {
      const dir = SpriteFactory.vectorToDirection(
        u.fighting ? (u.fighting.x - u.x) : 0,
        u.fighting ? (u.fighting.y - u.y) : 0
      );
      const animState = this._getAnimState(u, !!u.fighting);
      spriteFactory.draw(ctx, "soldier", 0, 0, dir, animState, this._spriteFrame, 1, u.facing < 0);
    } else {
      ctx.scale(u.facing || 1, 1);
      this._drawSprite(ctx, "soldier-player", "#3d2b1f", u.radius);
      ctx.scale(1 / (u.facing || 1), 1);
    }

    // HP bar
    const hp = u.hp / u.maxHp;
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(-u.radius, -u.radius - 10, u.radius * 2, 3);
    ctx.fillStyle = hp > 0.5 ? "#4cd964" : "#ffaa00";
    ctx.fillRect(-u.radius, -u.radius - 10, u.radius * 2 * hp, 3);

    ctx.restore();
  };

  /**
   * رسم لاعب آخر
   */
  WorldMap.prototype._drawOtherPlayerEntity = function (ctx, p) {
    const useSprites = this._isometricEnabled && spriteFactory.isReady;
    // 🎬 نحسب حالة الحركة مرة واحدة للاعب الآخر ونشاركها مع جنوده الشبحيين
    // (يتحركون معاً أصلاً)، لتفادي تضارب تتبّع "آخر موضع" عند استدعائها مرتين
    const animState = this._getAnimState(p, false);

    // جيش اللاعب الآخر
    const armyPower = p.army_power || 0;
    const armyCount = getVisualTroopCount(armyPower);
    for (let i = 0; i < armyCount; i++) {
      const pos = getTroopFormation(i, armyCount);
      ctx.save();
      ctx.translate(p.x + pos.ox, p.y + pos.oy);
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.beginPath();
      ctx.ellipse(0, 5, 6, 2, 0, 0, Math.PI * 2);
      ctx.fill();
      if (useSprites) {
        spriteFactory.draw(ctx, "soldier", 0, 0, "S", animState, this._spriteFrame, 0.7, p.facing < 0);
      } else {
        ctx.scale(p.facing || 1, 1);
        this._drawSprite(ctx, "soldier-enemy", p.color + "99", 8);
      }
      ctx.restore();
    }

    ctx.save();
    ctx.translate(p.x, p.y);

    // ظل
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath();
    ctx.ellipse(0, p.radius * 0.5, p.radius * 0.7, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    if (useSprites) {
      spriteFactory.draw(ctx, "leader", 0, 0, p.facing >= 0 ? "E" : "W", animState, this._spriteFrame, 1, p.facing < 0);
    } else {
      ctx.scale(p.facing || 1, 1);
      this._drawSprite(ctx, "leader-enemy", p.color, p.radius);
    }

    ctx.restore();

    // الاسم
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 11px Cairo, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(p.username, 0, -p.radius - 10);
    ctx.restore();

    // HP bar
    const hp = p.hp ?? p._hp ?? 120;
    const maxHp = p.maxHp ?? 120;
    const hpRatio = Math.max(0, Math.min(1, hp / maxHp));
    const barW = p.radius * 2 + 4;
    ctx.save();
    ctx.translate(p.x, p.y - p.radius - 20);
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(-barW / 2, 0, barW, 4);
    ctx.fillStyle = hpRatio > 0.5 ? "#4cd964" : hpRatio > 0.25 ? "#ffaa00" : "#ff4444";
    ctx.fillRect(-barW / 2, 0, barW * hpRatio, 4);
    ctx.restore();

    // Power display
    const effective = Math.floor((p.army_power || 0) * Math.max(0, Math.min(1, hp / maxHp)));
    ctx.save();
    ctx.translate(p.x, p.y - p.radius - 32);
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.fillRect(-28, 0, 56, 10);
    ctx.fillStyle = "#ffcc00";
    ctx.font = "bold 8px monospace";
    ctx.textAlign = "center";
    ctx.fillText(effective.toLocaleString(), 0, 8);
    ctx.restore();

    // Weapon glow
    const wStar = p.weaponStarLevel || 1;
    if (wStar >= 2) {
      drawWeaponGlow(ctx, p.x, p.y, wStar, p.radius, this._glowTime || 0);
    }
    if (wStar >= 1) {
      drawWeaponStarIcons(ctx, p.x, p.y - p.radius - 44, wStar, 8);
    }
  };

  /**
   * رسم قاطع طريق (BR)
   */
  WorldMap.prototype._drawBanditEntity = function (ctx, b) {
    const useSprites = this._isometricEnabled && spriteFactory.isReady;

    ctx.save();
    ctx.translate(b.x, b.y);

    ctx.fillStyle = "rgba(0,0,0,0.2)";
    ctx.beginPath();
    ctx.ellipse(0, 12, 16, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    if (useSprites) {
      const animState = this._getAnimState(b, false);
      spriteFactory.draw(ctx, "bandit", 0, 0, "S", animState, this._spriteFrame, 1, b.facing < 0);
    } else {
      ctx.scale(b.facing || 1, 1);
      const banditImg = this.images.get("bandit-br");
      if (banditImg) {
        ctx.drawImage(banditImg, -14, -20, 28, 40);
      } else {
        ctx.fillStyle = "#4a4a3a";
        ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#8a7a5a";
        ctx.beginPath(); ctx.arc(0, -14, 7, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#222";
        ctx.fillRect(-8, -16, 16, 3);
        ctx.strokeStyle = "#666"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(15, -2); ctx.lineTo(25, -12); ctx.stroke();
      }
    }

    // HP bar
    const hpPct = b.hp / b.maxHp;
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(-14, -22, 28, 3);
    ctx.fillStyle = "#ff6600";
    ctx.fillRect(-14, -22, 28 * hpPct, 3);
    ctx.restore();
  };

  /**
   * رسم صندوق كنز 🎁
   */
  WorldMap.prototype._drawTreasureChestEntity = function (ctx, c) {
    const time = Date.now() * 0.003;
    const bobY = Math.sin(time + c.x * 0.01) * 3;
    const pulse = Math.sin(time * 1.5) * 0.15 + 0.85;

    ctx.save();
    ctx.translate(c.x, c.y + bobY);

    // 🟤 توهج ذهبي خلف الصندوق
    ctx.shadowColor = "#ffd700";
    ctx.shadowBlur = 18 * pulse;

    // جسم الصندوق
    ctx.fillStyle = "#8B4513";
    ctx.beginPath();
    ctx.roundRect(-12, -10, 24, 18, 3);
    ctx.fill();

    // غطاء الصندوق
    ctx.fillStyle = "#A0522D";
    ctx.beginPath();
    ctx.roundRect(-13, -12, 26, 6, 2);
    ctx.fill();

    // إبزيم ذهبي
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#FFD700";
    ctx.beginPath();
    ctx.arc(0, -2, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#DAA520";
    ctx.beginPath();
    ctx.arc(0, -2, 2, 0, Math.PI * 2);
    ctx.fill();

    // علامة استفهام فوق الصندوق
    ctx.fillStyle = "rgba(255,215,0," + (0.5 + Math.sin(time * 2) * 0.3) + ")";
    ctx.font = "bold 12px Cairo, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText("❓", 0, -14);

    ctx.restore();
  };

  /**
   * رسم drop
   */
  WorldMap.prototype._drawDropEntity = function (ctx, d) {
    ctx.save();
    ctx.translate(d.x, d.y);

    // Glow effect
    ctx.shadowColor = "#f1c40f";
    ctx.shadowBlur = 8;
    ctx.fillStyle = d.gold > 0 ? "#FFD700" : "#f1c40f";
    ctx.beginPath();
    const bobY = Math.sin(Date.now() * 0.003 + d.x) * 2;
    ctx.arc(0, bobY - 4, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Inner highlight
    ctx.fillStyle = "#fff8dc";
    ctx.beginPath();
    ctx.arc(-2, bobY - 6, 3, 0, Math.PI * 2);
    ctx.fill();

    // Label
    ctx.fillStyle = "#fff";
    ctx.font = "bold 10px Cairo";
    ctx.textAlign = "center";
    if (d.gold > 0 && d.money <= 0) {
      ctx.fillText("🪙", 0, -14);
    } else if (d.gold > 0) {
      ctx.fillText("+" + d.money + " 💵🪙", 0, -14);
    } else {
      ctx.fillText("+" + d.money, 0, -14);
    }
    ctx.restore();
  };
}
