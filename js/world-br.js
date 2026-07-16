// ==================== Battle Royale Methods ====================
// BR constants: map size 2000px, zone starts at 45% of map, min zone 100px,
// shrink every 30s, extraction zone radius 70px, spawn margin 120px
export function injectBRMethods(WorldMap) {
  WorldMap.prototype.initBR = function (mapSize, matchDuration) {
    this.mode = "battle_royale";
    this.brMapSize = mapSize || 2000;
    this.matchDuration = matchDuration || 600;
    this.W = this.brMapSize;
    this.H = this.brMapSize;
    this.zone = {
      x: this.brMapSize / 2,
      y: this.brMapSize / 2,
      radius: this.brMapSize * 0.45,
      minRadius: 100,
      nextShrink: 30,
    };
    this.monsters = [];
    this.drops = [];
    this.treasureChests = [];
    this.bandits = [];
    this.killFeed = [];
    this.brKills = 0;
    this.matchStarted = false;
    this.matchEnded = false;
    this.matchTimer = this.matchDuration;
    this._brNearExtraction = false;
    this._brExtractionCooldown = 0;
    // إعادة تعيين موقع اللاعب
    if (this.leader) {
      this.leader.x = this.brMapSize / 2 + (Math.random() - 0.5) * this.brMapSize * 0.3;
      this.leader.y = this.brMapSize / 2 + (Math.random() - 0.5) * this.brMapSize * 0.3;
      this.leader.hp = 120;
      this.leader.maxHp = 120;
      this.leader.fighting = null;
      this.leader.path = null;
    }
    this._placeBRExtractionZone();
  };

  WorldMap.prototype._placeBRExtractionZone = function () {
    const edge = Math.floor(Math.random() * 4);
    const margin = 120;
    let x, y;
    if (edge === 0) { x = this.brMapSize / 2 + (Math.random() - 0.5) * this.brMapSize * 0.5; y = margin; }
    else if (edge === 1) { x = this.brMapSize - margin; y = this.brMapSize / 2 + (Math.random() - 0.5) * this.brMapSize * 0.5; }
    else if (edge === 2) { x = this.brMapSize / 2 + (Math.random() - 0.5) * this.brMapSize * 0.5; y = this.brMapSize - margin; }
    else { x = margin; y = this.brMapSize / 2 + (Math.random() - 0.5) * this.brMapSize * 0.5; }
    this.brExtractionZone = { x, y, radius: 70 };
  };

  WorldMap.prototype.startBRMatch = function () {
    if (this.mode !== "battle_royale") return;
    this.matchStarted = true;
    this.matchEnded = false;
    this.matchTimer = this.matchDuration;
    this.zone.nextShrink = 30;
    this.brKills = 0;
    this.bandits = [];
    this.killFeed = [];
    // إظهار عناصر واجهة BR
    document.getElementById("br-timer")?.classList.remove("hidden");
    document.getElementById("br-players")?.classList.remove("hidden");
    document.getElementById("br-kills")?.classList.remove("hidden");
    document.getElementById("br-kill-feed")?.classList.remove("hidden");
    // توزيع عشوائي للاعبين
    const spawnPoints = this._genBRSpawnPoints();
    if (this.leader && spawnPoints.length > 0) {
      const sp = spawnPoints[0];
      this.leader.x = sp.x;
      this.leader.y = sp.y;
      this.leader.hp = 120;
      this.leader.maxHp = 120;
    }
    this._sendWS({ type: "br_match_start", mapSize: this.brMapSize, matchDuration: this.matchDuration });
    if (this.store) this.store.set('notification', { text: "🚀 بدأت المعركة الملكية! كن آخر من يبقى!", t: Date.now() });
  };

  WorldMap.prototype.updateBR = function (dt) {
    if (!this.matchStarted || this.matchEnded) return;
    // عداد المباراة
    this.matchTimer -= dt;
    if (this.matchTimer <= 0) {
      this._endBRMatch("timeout");
      return;
    }
    // تصغير المنطقة
    this.zone.nextShrink -= dt;
    if (this.zone.nextShrink <= 0) {
      this.zone.nextShrink = 30;
      this.zone.radius = Math.max(this.zone.minRadius, this.zone.radius - 80);
      this._sendWS({ type: "br_zone_shrink", radius: this.zone.radius, centerX: this.zone.x, centerY: this.zone.y });
      if (this.store) this.store.set('notification', { text: "⚠️ المنطقة تتصغر! تحرك إلى الداخل!", t: Date.now() });
    }
    // ضرر للاعب خارج المنطقة
    if (this.leader) {
      const dist = Math.hypot(this.leader.x - this.zone.x, this.leader.y - this.zone.y);
      if (dist > this.zone.radius) {
        this.damageHero(5 * dt);
        if (this.leader.hp <= 0) {
          this.leader.hp = 0;
          this._eliminatePlayer(this.username, "zone");
        }
      }
    }
    // تحديث قطاع الطرق
    this._updateBRBandits(dt);
    // التحقق من نقطة الإخلاء
    this._brExtractionCooldown = Math.max(0, this._brExtractionCooldown - dt);
    if (this.brExtractionZone && this.leader && !this.matchEnded) {
      const dist = Math.hypot(this.leader.x - this.brExtractionZone.x, this.leader.y - this.brExtractionZone.y);
      const wasNear = this._brNearExtraction;
      this._brNearExtraction = dist < this.brExtractionZone.radius;
      if (this._brNearExtraction && !wasNear) {
        if (this.store) this.store.set('notification', { text: "🚁 أنت في منطقة الإخلاء! اضغط زر الإخلاء للخروج بالمال", t: Date.now() });
      }
    }
    // إظهار/إخفاء زر الإخلاء
    const evacBtn = document.getElementById("br-evacuate-btn");
    if (evacBtn) evacBtn.classList.toggle("hidden", !this._brNearExtraction || this.matchEnded);
    // تحديث DOM
    this._updateBRDom(dt);
    // التحقق من الفائز
    if (this._onBRKillFeed) this._onBRKillFeed(this.killFeed);
  };

  WorldMap.prototype._doBRExtraction = function () {
    if (this.matchEnded || !this._brNearExtraction) return;
    if (this._brExtractionCooldown > 0) return;
    this._brExtractionCooldown = 3;
    this.matchEnded = true;
    this.matchStarted = false;
    const kills = this.brKills;
    const bonusGems = 50 + kills * 25;
    const bonusGold = 100 + kills * 30;
    if (this.economy) {
      this.economy.addRaw("gems", bonusGems);
      this.economy.addRaw("gold", bonusGold);
    }
    if (this._onBRMatchEnd) {
      this._onBRMatchEnd({ winner: true, kills, reason: "extraction", bonusGems, bonusGold });
    }
    this._sendWS({ type: "br_match_end", winner: this.username, kills, reason: "extraction" });
    if (this.store) {
      this.store.set('notification', {
        text: `🚁 إخلاء ناجح! +${bonusGems} 💎 +${bonusGold} 🪙 مع ${kills} قتل!`,
        t: Date.now()
      });
    }
  };

  WorldMap.prototype._updateBRDom = function (dt) {
    // تحديث مؤقت DOM + kill feed timer
    const timerEl = document.getElementById("br-timer");
    if (timerEl) {
      const timer = Math.max(0, Math.ceil(this.matchTimer));
      const min = String(Math.floor(timer / 60)).padStart(2, "0");
      const sec = String(timer % 60).padStart(2, "0");
      timerEl.textContent = `${min}:${sec}`;
      timerEl.classList.toggle("warning", timer < 60);
    }
    const killsEl = document.getElementById("br-kill-count");
    if (killsEl) killsEl.textContent = this.brKills;
    // تحديث kill feed timer
    for (let i = this.killFeed.length - 1; i >= 0; i--) {
      this.killFeed[i].time -= dt;
      if (this.killFeed[i].time <= 0) this.killFeed.splice(i, 1);
    }
  };

  WorldMap.prototype._genBRSpawnPoints = function () {
    const count = Math.max(4, this.brAlivePlayers.length || 4);
    const pts = [];
    const angleStep = (Math.PI * 2) / count;
    const spawnRadius = this.brMapSize * 0.35;
    for (let i = 0; i < count; i++) {
      pts.push({
        x: this.brMapSize / 2 + Math.cos(angleStep * i + Math.random() * 0.3) * spawnRadius + (Math.random() - 0.5) * 100,
        y: this.brMapSize / 2 + Math.sin(angleStep * i + Math.random() * 0.3) * spawnRadius + (Math.random() - 0.5) * 100,
      });
    }
    return pts;
  };

  // BR bandit stats: base hp 40, hp per level 3, base dmg 10, dmg per level 2,
  // base speed 70-100, edge spawn margin 50px, min bandits on map 3, aggro range 400px,
  // chase range 25px, attack cooldown 1.0s, xp reward 15
  WorldMap.prototype.spawnBandit = function () {
    const edge = Math.floor(Math.random() * 4);
    let x, y;
    const m = 50;
    if (edge === 0) { x = Math.random() * this.W; y = m; }
    else if (edge === 1) { x = this.W - m; y = Math.random() * this.H; }
    else if (edge === 2) { x = Math.random() * this.W; y = this.H - m; }
    else { x = m; y = Math.random() * this.H; }
    const lvl = this.economy ? Math.max(1, this.economy.level) : 1;
    const bandit = {
      id: `bandit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      x, y, spawnX: x, spawnY: y,
      hp: 40 + lvl * 3, maxHp: 40 + lvl * 3,
      damage: 10 + lvl * 2, speed: 70 + Math.random() * 30,
      alive: true, facing: 1, attackTimer: 0,
      radius: 14, color: "#4a4a3a",
      patrolTarget: null, targetId: null,
      _isBandit: true,
    };
    this.bandits.push(bandit);
    this._sendWS({ type: "br_bandit_spawn", bandit });
    return bandit;
  };

  WorldMap.prototype._updateBRBandits = function (dt) {
    if (this.bandits.length < 3 && this.matchStarted) {
      // الحفاظ على 3+ bandits في الخريطة
      this.spawnBandit();
    }
    for (let i = this.bandits.length - 1; i >= 0; i--) {
      const b = this.bandits[i];
      if (!b.alive) { this.bandits.splice(i, 1); continue; }
      // البحث عن أقرب لاعب
      let nearest = null;
      let minDist = 500;
      for (const [, p] of this.otherPlayers) {
        const d = Math.hypot(p.x - b.x, p.y - b.y);
        if (d < minDist && p.username !== this.username) { minDist = d; nearest = p; }
      }
      if (this.leader) {
        const d = Math.hypot(this.leader.x - b.x, this.leader.y - b.y);
        if (d < minDist) { minDist = d; nearest = { ...this.leader, isLeader: true }; }
      }
      if (nearest && minDist < 400) {
        const dx = nearest.x - b.x;
        const dy = nearest.y - b.y;
        const d = Math.hypot(dx, dy);
        b.facing = dx >= 0 ? 1 : -1;
        if (d > 25) {
          const spd = b.speed * (nearest.isLeader ? 1 : 1.2);
          b.x += (dx / d) * spd * dt;
          b.y += (dy / d) * spd * dt;
        } else {
          b.attackTimer -= dt;
          if (b.attackTimer <= 0) {
            b.attackTimer = 1.0;
            if (nearest.isLeader) {
              this.damageHero(b.damage);
              if (this.leader.hp <= 0) this._eliminatePlayer(this.username, "bandit");
            }
          }
        }
      } else {
        if (!b.patrolTarget || Math.hypot(b.x - b.patrolTarget.x, b.y - b.patrolTarget.y) < 20) {
          b.patrolTarget = { x: b.x + (Math.random() - 0.5) * 400, y: b.y + (Math.random() - 0.5) * 400 };
          b.patrolTarget.x = Math.max(50, Math.min(this.W - 50, b.patrolTarget.x));
          b.patrolTarget.y = Math.max(50, Math.min(this.H - 50, b.patrolTarget.y));
        }
        const dx = b.patrolTarget.x - b.x;
        const dy = b.patrolTarget.y - b.y;
        const d = Math.hypot(dx, dy);
        if (d > 5) { b.x += (dx / d) * b.speed * 0.4 * dt; b.y += (dy / d) * b.speed * 0.4 * dt; }
      }
    }
  };

  WorldMap.prototype._eliminatePlayer = function (playerId, by) {
    if (!this.matchStarted) return;
    const isMe = playerId === this.username;
    const killedByMe = by === this.username;
    if (killedByMe) this.brKills++;
    const msg = isMe ? `💀 ${by} قتلك!` : `💀 ${playerId} قُتل بواسطة ${by}`;
    this.killFeed.push({ text: msg, time: 3 });
    if (this.store) this.store.set('notification', { text: msg, t: Date.now() });
    this._sendWS({ type: "br_player_eliminated", playerId, by });
    this._checkBRWinner();
  };

  WorldMap.prototype._checkBRWinner = function () {
    if (!this.matchStarted) return;
    let aliveCount = 0;
    for (const [, p] of this.otherPlayers) {
      if (p.username !== this.username && p.br_alive !== false) aliveCount++;
    }
    if (aliveCount <= 0 && this.leader && this.leader.hp > 0) {
      this._endBRMatch("winner");
    }
  };

  WorldMap.prototype._endBRMatch = function (reason) {
    if (this.matchEnded) return;
    this.matchEnded = true;
    this.matchStarted = false;
    const isWinner = reason === "winner" || (reason === "last" && this.leader && this.leader.hp > 0);
    if (this._onBRMatchEnd) this._onBRMatchEnd({ winner: isWinner, kills: this.brKills, reason });
    this._sendWS({ type: "br_match_end", winner: isWinner ? this.username : null, kills: this.brKills });
  };

  WorldMap.prototype.drawBRZone = function (ctx) {
    if (this.mode !== "battle_royale") return;
    ctx.save();
    // تعتيم خارج المنطقة
    ctx.beginPath();
    ctx.rect(0, 0, this.W, this.H);
    ctx.arc(this.zone.x, this.zone.y, this.zone.radius, 0, Math.PI * 2, true);
    ctx.fillStyle = "rgba(180, 40, 40, 0.35)";
    ctx.fill();
    // حدود المنطقة
    ctx.beginPath();
    ctx.arc(this.zone.x, this.zone.y, this.zone.radius, 0, Math.PI * 2);
    ctx.strokeStyle = this.zone.radius <= 200 ? "#ff4444" : "rgba(255, 100, 100, 0.6)";
    ctx.lineWidth = 3;
    if (this.zone.radius <= 200) ctx.setLineDash([8, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
    // رسم نقطة الإخلاء (هليكوبتر)
    if (this.brExtractionZone) {
      const ez = this.brExtractionZone;
      ctx.save();
      // دائرة خضراء متوهجة
      const pulse = 0.7 + 0.3 * Math.sin(Date.now() / 500);
      ctx.beginPath();
      ctx.arc(ez.x, ez.y, ez.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(76, 217, 100, ${0.15 * pulse})`;
      ctx.fill();
      ctx.strokeStyle = `rgba(76, 217, 100, ${0.6 * pulse})`;
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
      // أيقونة المروحية
      ctx.font = "24px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("🚁", ez.x, ez.y - 26);
      // نص نقطة الأمان
      ctx.font = "bold 13px Cairo, sans-serif";
      ctx.fillStyle = "#4cd964";
      ctx.shadowColor = "rgba(0,0,0,0.8)";
      ctx.shadowBlur = 4;
      ctx.fillText("نقطة الأمان", ez.x, ez.y + ez.radius + 18);
      ctx.shadowBlur = 0;
      ctx.restore();
    }
  };

  WorldMap.prototype.drawBRBandits = function (ctx) {
    for (const b of this.bandits) {
      if (!b.alive) continue;
      ctx.save();
      ctx.translate(b.x, b.y);
      // ظل (قبل القلب)
      ctx.fillStyle = "rgba(0,0,0,0.2)";
      ctx.beginPath(); ctx.ellipse(0, 12, 16, 5, 0, 0, Math.PI * 2); ctx.fill();
      // قلب الاتجاه
      ctx.scale(b.facing || 1, 1);

      const banditImg = this.images.get("bandit-br");
      if (banditImg) {
        // صورة كاملة لقطاع الطرق
        ctx.drawImage(banditImg, -14, -20, 28, 40);
      } else {
        // رسم تفصيلي يدوي — جسد + رأس + عصابة + سلاح
        ctx.fillStyle = "#4a4a3a";
        ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#8a7a5a";
        ctx.beginPath(); ctx.arc(0, -14, 7, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#222";
        ctx.fillRect(-8, -16, 16, 3);
        ctx.strokeStyle = "#666"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(15, -2); ctx.lineTo(25, -12); ctx.stroke();
      }
      // شريط صحة
      const hpPct = b.hp / b.maxHp;
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(-14, -22, 28, 3);
      ctx.fillStyle = "#ff6600";
      ctx.fillRect(-14, -22, 28 * hpPct, 3);
      ctx.restore();
    }
  };
}
