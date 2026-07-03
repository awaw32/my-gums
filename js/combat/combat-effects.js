"use strict";

export function drawPathLine(worldMap, ctx, cam) {
  const h = worldMap.leader;

  if (worldMap._pvpAttackTarget) {
    const t = worldMap._pvpAttackTarget;
    ctx.save();
    ctx.strokeStyle = "rgba(255,50,50,0.35)";
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(h.x, h.y);
    ctx.lineTo(t.x, t.y);
    ctx.stroke();
    ctx.setLineDash([]);
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

export function spawnPvPParticles(worldMap, x, y) {
  for (let i = 0; i < 3; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 40 + Math.random() * 80;
    const type = Math.random();
    worldMap._pvpParticles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 30,
      life: 0.6 + Math.random() * 0.4,
      maxLife: 1,
      r: 2 + Math.random() * 4,
      color: type < 0.4 ? "#d4a76a" : type < 0.7 ? "#ffdd44" : "rgba(200,200,200,0.6)",
    });
  }
}

export function updatePvPParticles(worldMap, dt) {
  const particles = worldMap._pvpParticles;
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 60 * dt;
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
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}
