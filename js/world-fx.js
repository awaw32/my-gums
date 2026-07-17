export function injectFxMethods(WorldMap) {
  WorldMap.prototype.updateSandParticles = function (dt) {
    for (const p of this.sandParticles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.x < 0 || p.x > this.W) p.vx *= -1;
      if (p.y < 0 || p.y > this.H) p.vy *= -1;
    }
  };

  /**
   * 🪨 يخزّن شكل كل صخرة (الظل + التدرّج + بقع التظليل) في canvas صغير مرة واحدة
   * بدل إعادة إنشاء التدرّجات وإعادة الرسم كل فريم — نفس أسلوب تخزين الـ sprites.
   */
  WorldMap.prototype._prerenderObstacleSprites = function () {
    if (!this.MAP_OBSTACLES) { this._obstacleSprites = []; return; }
    this._obstacleSprites = this.MAP_OBSTACLES.map((rock) => {
      const { r } = rock;
      const size = Math.ceil(r * 2.4);
      const cx = size / 2, cy = size / 2;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");

      // ظل أسفل الصخرة
      ctx.fillStyle = "rgba(0,0,0,0.18)";
      ctx.beginPath();
      ctx.ellipse(cx, cy + r * 0.55, r * 0.9, r * 0.32, 0, 0, Math.PI * 2);
      ctx.fill();

      const grad = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.1, cx, cy, r);
      grad.addColorStop(0, "#a8998a");
      grad.addColorStop(0.55, "#8a7a6a");
      grad.addColorStop(1, "#5c4d3f");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(cx, cy, r * 0.85, r * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();

      // بقع تظليل بسيطة لإحساس صخري خشن
      ctx.fillStyle = "rgba(0,0,0,0.12)";
      ctx.beginPath();
      ctx.ellipse(cx + r * 0.25, cy + r * 0.1, r * 0.3, r * 0.18, 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.10)";
      ctx.beginPath();
      ctx.ellipse(cx - r * 0.28, cy - r * 0.25, r * 0.22, r * 0.14, -0.3, 0, Math.PI * 2);
      ctx.fill();

      return { canvas, offsetX: cx, offsetY: cy };
    });
  };

  /** 🪨 رسم صخور/عوائق الخريطة كمعالم بصرية تطابق مناطق التصادم الفعلية (this.MAP_OBSTACLES) */
  WorldMap.prototype.drawMapObstacles = function (ctx) {
    if (!this.MAP_OBSTACLES) return;
    if (!this._obstacleSprites) this._prerenderObstacleSprites();
    for (let i = 0; i < this.MAP_OBSTACLES.length; i++) {
      const rock = this.MAP_OBSTACLES[i];
      const sprite = this._obstacleSprites[i];
      if (!sprite) continue;
      ctx.drawImage(sprite.canvas, rock.x - sprite.offsetX, rock.y - sprite.offsetY);
    }
  };

  WorldMap.prototype.drawSandParticles = function (ctx) {
    ctx.save();
    for (const p of this.sandParticles) {
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = "#d4a76a";
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  };
}
