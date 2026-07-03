"use strict";

export const WEAPON_GLOW_COLORS = {
  1: { aura: "rgba(255,255,255,0.15)", pulse: "#ffffff" },
  2: { aura: "rgba(0,200,255,0.2)",   pulse: "#00ccff" },
  3: { aura: "rgba(100,0,255,0.25)",  pulse: "#8a2be2" },
  4: { aura: "rgba(255,200,0,0.3)",   pulse: "#ffd700" },
  5: { aura: "rgba(255,50,50,0.4)",   pulse: "#ff4444" },
};

export function getGlowColor(starLevel) {
  return WEAPON_GLOW_COLORS[starLevel] || WEAPON_GLOW_COLORS[1];
}

export function drawWeaponGlow(ctx, x, y, starLevel, radius, time) {
  const glow = getGlowColor(starLevel);
  if (!glow) return;
  const pulse = 1 + 0.1 * Math.sin(time * 3 + x * 0.01);
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha = 0.3 * pulse;
  ctx.shadowColor = glow.pulse;
  ctx.shadowBlur = radius * 2 * pulse;
  ctx.fillStyle = glow.aura;
  ctx.beginPath();
  ctx.arc(0, 0, radius * 1.8 * pulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  for (let i = 0; i < starLevel; i++) {
    const angle = (i / starLevel) * Math.PI * 2 + time * 2;
    const sx = Math.cos(angle) * radius * 1.5;
    const sy = Math.sin(angle) * radius * 1.5;
    ctx.fillStyle = glow.pulse;
    ctx.globalAlpha = (0.4 + 0.3 * Math.sin(time * 5 + i)) * pulse;
    ctx.beginPath();
    ctx.arc(sx, sy, 3 + starLevel, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function drawWeaponStarIcons(ctx, x, y, starLevel, size) {
  const s = size || 10;
  const gap = s + 4;
  const total = starLevel || 1;
  const startX = x - (total * gap) / 2;
  ctx.save();
  ctx.font = `${s}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let i = 0; i < total; i++) {
    ctx.fillStyle = "#ffd700";
    ctx.shadowColor = "#ffd700";
    ctx.shadowBlur = 4;
    ctx.fillText("★", startX + i * gap + s / 2, y);
  }
  ctx.shadowBlur = 0;
  ctx.restore();
}
