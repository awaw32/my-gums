import { getBossPhaseConfig, updateBossEnrage } from "./combat/epic-bosses.js";

export function injectUpdateMethods(WorldMap) {
  WorldMap.prototype.update = function (dt, ctx, cam) {
    this._glowTime = (this._glowTime || 0) + dt;

    if (this._invulnerableTimer > 0) {
      this._invulnerableTimer -= dt;
      if (this._invulnerableTimer <= 0) this._invulnerableTimer = 0;
    }

    // ── تحديث إطار الأنيميشن ──
    this._spriteFrameTimer += dt;
    if (this._spriteFrameTimer >= this._spriteFrameInterval) {
      this._spriteFrameTimer -= this._spriteFrameInterval;
      this._spriteFrame = (this._spriteFrame + 1) % 4;
    }

    this.updateLeader(dt);
    this.updateArmy(dt);
    this.updateMonstersAI(dt);
    this.updateOtherPlayers(dt);
    this.updateProjectiles(dt);
    this.updateFx(dt);
    this.updateSandParticles(dt);
    this.updatePvPParticles(dt);
    this.checkCombatProximity();
    this.updatePvPCombat(dt);
    this._updateComboTimer(dt);
    this._updatePoisonEffects(dt);

    // ── تحديث قدرات الأسلحة + تطبيق DOT على الوحوش ──
    if (this._weaponAbilities) {
      this._weaponAbilities.update(dt);
      // تطبيق الضرر المستمر (DOT) على الوحوش
      for (const m of this.monsters) {
        if (!m.alive) continue;
        const dotDmg = this._weaponAbilities.getDotDamage(m.id);
        if (dotDmg > 0) {
          m.hp -= dotDmg;
          this.worldFx.push({ x: m.x, y: m.y - 10, text: `-${Math.floor(dotDmg)}`, color: "#af52de", life: 0.5, maxLife: 0.5 });
          if (m.hp <= 0) {
            m.hp = 0;
            m.alive = false;
            m.respawnTimer = 25;
            if (this._onMonsterKilled) this._onMonsterKilled();
            if (this._activeMode) this._activeMode.onMonsterKilled(m);
            this.sessionStats.kills++;
            this.createDrop(m.x, m.y, m.rewardMoney ?? 10, m.rewardGold ?? 5);
            this.worldFx.push({ x: m.x, y: m.y, text: `💀 ${m.name}`, color: "#FFD700", life: 1.5, maxLife: 1.5 });
          }
        }
        // تطبيق التأثيرات (stun/slow) على الوحوش
        const mods = this._weaponAbilities.getDamageModifiers(m.id);
        if (mods.stunned) {
          m._stunTimer = (m._stunTimer || 0) + dt;
        }
        if (mods.speedMultiplier < 1) {
          m._slowMult = mods.speedMultiplier;
        } else {
          m._slowMult = 1;
        }
      }
    }

    // تحديث timers القدرات
    if (this._sandstormTimer > 0) {
      this._sandstormTimer -= dt;
      if (this._sandstormTimer <= 0) this._sandstormActive = false;
    }
    if (this._stompSlowTimer > 0) this._stompSlowTimer -= dt;

    // تحديث enrage timer للزعماء
    for (const m of this.monsters) {
      if (m.isBoss && m.alive) {
        const bossConfig = getBossPhaseConfig(m.enemyId || "");
        if (bossConfig) updateBossEnrage(this, m, bossConfig, dt);
      }
      if (m._summoned && m._lifetime !== undefined) {
        m._lifetime -= dt;
        if (m._lifetime <= 0) {
          m.alive = false;
          this.worldFx.push({ x: m.x, y: m.y, text: "💨 تلاشى!", color: "#888", life: 1, maxLife: 1 });
        }
      }
    }

    // تحديث telegraphs
    if (this._telegraphs) {
      for (let i = this._telegraphs.length - 1; i >= 0; i--) {
        this._telegraphs[i].life -= dt;
        if (this._telegraphs[i].life <= 0) this._telegraphs.splice(i, 1);
      }
    }

    this.checkWipe();
    // 🎁 إعادة ظهور صناديق الكنز بعد فتحها
    for (const c of this.treasureChests) {
      if (c.opened) {
        c.respawnTimer -= dt;
        if (c.respawnTimer <= 0) {
          c.opened = false;
          // اختيار موقع جديد عشوائي
          let nx, ny;
          do {
            nx = 150 + Math.random() * (this.W - 300);
            ny = 150 + Math.random() * (this.H - 300);
          } while (this.isInSafeZone(nx, ny));
          c.x = nx;
          c.y = ny;
          const levelScale = 1 + ((this.economy?.level || 1) - 1) * 0.15;
          c.reward = {
            artifacts: Math.max(1, Math.floor((1 + Math.random() * 3) * levelScale)),
            cash: Math.floor((50 + Math.random() * 200) * levelScale),
            gold: Math.floor((10 + Math.random() * 50) * levelScale),
            desertGem: Math.random() < 0.15 ? 1 : 0,
          };
        }
      }
    }
    if (this.mode === "battle_royale") this.updateBR(dt);
    if (this._activeMode) this._activeMode.update(dt);

    // 🛡️ منع الكاميرا من الخروج عن حدود الخريطة الحالية إلى فراغ (تختلف الحدود حسب النمط)
    if (typeof cam.clamp === "function") cam.clamp(this.W, this.H);

    ctx.save();
    ctx.translate(-cam.x, -cam.y);

    // ── رسم الأرضية (isometric tiles أو flat) ──
    if (this._activeMode && this._activeMode.modeName === "cave") {
      this._activeMode.drawBackground(ctx);
    } else if (this._isometricEnabled && this._iso._generated) {
      this._iso.drawTiles(ctx);
    } else if (this.mapImage) {
      ctx.drawImage(this.mapImage, 0, 0, this.W, this.H);
    } else {
      ctx.fillStyle = "#c2a06e";
      ctx.fillRect(0, 0, this.W, this.H);
    }

    this.drawSandParticles(ctx);
    this.drawMapObstacles(ctx);
    this.drawPathLine(ctx, cam);
    this.drawBRZone(ctx);

    // ── رسم الكائنات مع Depth Sorting ──
    this._drawEntitiesSorted(ctx);

    this.drawPvPParticles(ctx);
    if (this._activeMode && this._activeMode.modeName === "cave") {
      this._activeMode.drawDarkness(ctx);
    }
    this._drawTelegraphs(ctx);
    this.drawWorldFx(ctx);
    // 🗺️ الخريطة المصغّرة الآن عنصر DOM واحد فقط (#mini-map) بدل نسختين متزاحمتين

    ctx.restore();

    this.drawArmyHUD(dt, ctx);
    this.drawPvPMenu(ctx, cam);
    // 🛡️ واجهة BR (المؤقت/اللاعبون/القتلى) عنصر DOM واحد فقط (#br-timer/#br-players/#br-kills) — لا نسخة مكررة على الـ canvas
    if (this._activeMode) this._activeMode.drawUI(ctx);
  };
}
