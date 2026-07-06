"use strict";

export function drawPathLine(worldMap, ctx, _cam) {
  const h = worldMap.leader;

  if (worldMap._pvpAttackTarget) {
    const t = worldMap._pvpAttackTarget;
    ctx.save();
    ctx.strokeStyle = "rgba(255,50,50,0.5)";
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(h.x, h.y);
    ctx.lineTo(t.x, t.y);
    ctx.stroke();
    ctx.setLineDash([]);

    // خط متقطع متحرك (نبض)
    const pulse = 0.5 + 0.5 * Math.sin(Date.now() * 0.005);
    ctx.strokeStyle = `rgba(255,200,50,${pulse * 0.3})`;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(h.x, h.y);
    ctx.lineTo(t.x, t.y);
    ctx.stroke();
    ctx.restore();
    return;
  }

  if (h.path && h.pathIdx < h.path.length && worldMap._moveTargetX != null) {
    ctx.save();
    ctx.strokeStyle = "rgba(80,220,100,0.25)";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(h.x, h.y);
    ctx.lineTo(worldMap._moveTargetX, worldMap._moveTargetY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }
}

// ==================== جزيئات الضربات ====================

export function spawnHitEffect(worldMap, x, y, isCrit, _weaponId) {
  const count = isCrit ? 8 : 3;
  const speedMul = isCrit ? 2 : 1;
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = (40 + Math.random() * 80) * speedMul;
    worldMap._pvpParticles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 30,
      life: isCrit ? 0.6 + Math.random() * 0.4 : 0.3 + Math.random() * 0.2,
      maxLife: isCrit ? 1 : 0.5,
      r: isCrit ? 2 + Math.random() * 3 : 1 + Math.random() * 2,
      color: isCrit ? (Math.random() < 0.5 ? "#ffd700" : "#fff8dc") : (Math.random() < 0.3 ? "#ff4444" : "#d4a76a"),
      gravity: isCrit ? 80 : 40,
      spark: isCrit,
    });
  }
  // sparks اضافية للـ Crit
  if (isCrit) {
    for (let i = 0; i < 5; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI;
      const speed = 100 + Math.random() * 150;
      worldMap._pvpParticles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.3 + Math.random() * 0.2,
        maxLife: 0.5,
        r: 1 + Math.random() * 1.5,
        color: "#ffffff",
        gravity: 200,
        spark: true,
      });
    }
  }
}

export function spawnMonsterDeathEffect(worldMap, monster) {
  const count = 12;
  const isBoss = monster.isBoss;
  const total = isBoss ? 30 : count;
  for (let i = 0; i < total; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = isBoss ? 60 + Math.random() * 200 : 30 + Math.random() * 100;
    const colors = isBoss
      ? ["#ffd700", "#ff6b35", "#ff4444", "#fff8dc"]
      : ["#d4a76a", "#c0392b", "#e67e22"];
    worldMap._pvpParticles.push({
      x: monster.x, y: monster.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 50,
      life: 0.8 + Math.random() * 0.6,
      maxLife: 1.4,
      r: isBoss ? 3 + Math.random() * 6 : 2 + Math.random() * 3,
      color: colors[Math.floor(Math.random() * colors.length)],
      gravity: 100,
      spark: isBoss,
    });
  }
}

export function spawnComboEffect(worldMap, x, y, comboCount) {
  const text = comboCount >= 5 ? `🔥 COMBO x${comboCount}!` : `⚡ x${comboCount}`;
  const color = comboCount >= 5 ? "#ff4444" : comboCount >= 3 ? "#ffaa00" : "#4cd964";
  const size = Math.min(comboCount, 10) * 2 + 14;
  worldMap.worldFx.push({
    x, y,
    text,
    color,
    life: 1.5,
    maxLife: 1.5,
    size,
    isCombo: true,
  });
}

export function spawnXpBurst(worldMap, x, y, amount) {
  for (let i = 0; i < 4; i++) {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.8;
    const speed = 30 + Math.random() * 40;
    worldMap._pvpParticles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.6 + Math.random() * 0.3,
      maxLife: 0.9,
      r: 2 + Math.random() * 2,
      color: "#a855f7",
      gravity: -20,
      spark: false,
    });
  }
  worldMap.worldFx.push({
    x, y,
    text: `✨ +${amount} XP`,
    color: "#a855f7",
    life: 1.2,
    maxLife: 1.2,
  });
}

// ==================== PvP legacy functions ====================

export function spawnPvPParticles(worldMap, x, y) {
  for (let i = 0; i < 2; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 30 + Math.random() * 60;
    worldMap._pvpParticles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 20,
      life: 0.4 + Math.random() * 0.3,
      maxLife: 0.7,
      r: 1 + Math.random() * 2,
      color: Math.random() < 0.5 ? "#d4a76a" : "#ffdd44",
      gravity: 50,
      spark: false,
    });
  }
}

export function updatePvPParticles(worldMap, dt) {
  const particles = worldMap._pvpParticles;
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += (p.gravity || 50) * dt;
    p.life -= dt;
    if (p.life <= 0) {
      particles.splice(i, 1);
    }
  }
}

export function drawPvPParticles(worldMap, ctx) {
  const particles = worldMap._pvpParticles;
  if (!particles.length) return;
  ctx.save();
  for (const p of particles) {
    const alpha = Math.max(0, p.life / p.maxLife);
    ctx.globalAlpha = alpha;
    if (p.spark) {
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 6;
    }
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * alpha, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
  ctx.restore();
}
