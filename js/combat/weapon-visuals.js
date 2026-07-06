"use strict";

export const WEAPON_ICONS = {
  w1: '🗡️',
  w2: '🏹',
  w3: '🔱',
  w4: '⚔️',
  w5: '🔥',
  w6: '⚒️',
};

/**
 * رسم تأثير بصري خاص بكل سلاح حول القائد
 */
export function drawWeaponSpecialEffect(ctx, weaponId, x, y, starLevel, time) {
  const lvl = Math.min(starLevel, 5);
  const intensity = 0.3 + lvl * 0.14;

  switch (weaponId) {
    // ====== w1: سيف بدوي — بريق بسيط (sparkle dots) ======
    case 'w1': {
      ctx.save();
      ctx.translate(x, y);
      for (let i = 0; i < 4 + lvl; i++) {
        const angle = (i / (4 + lvl)) * Math.PI * 2 + time * 1.5;
        const dist = 14 + Math.sin(time * 2 + i) * 4;
        const sx = Math.cos(angle) * dist;
        const sy = Math.sin(angle) * dist - 8;
        const alpha = (0.3 + 0.3 * Math.sin(time * 3 + i * 2)) * intensity;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = "#fff8dc";
        ctx.shadowColor = "#ffd700";
        ctx.shadowBlur = 4;
        ctx.beginPath();
        ctx.arc(sx, sy, 1.5 + Math.sin(time * 4 + i) * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
      ctx.restore();
      break;
    }

    // ====== w2: قوس طويل — رياح (wind swirl) ======
    case 'w2': {
      ctx.save();
      ctx.translate(x, y - 6);
      ctx.globalAlpha = 0.25 * intensity;
      ctx.strokeStyle = "#a8d8ea";
      ctx.lineWidth = 1.5;
      ctx.shadowColor = "#a8d8ea";
      ctx.shadowBlur = 6;
      for (let i = 0; i < 3 + lvl; i++) {
        const baseAngle = time * 1.2 + i * 2.1;
        const r = 14 + i * 3;
        ctx.beginPath();
        for (let a = 0; a < Math.PI * 1.5; a += 0.15) {
          const rx = Math.cos(baseAngle + a) * r * 0.6;
          const ry = Math.sin(baseAngle + a) * r * 0.3 - a * 2;
          if (a === 0) ctx.moveTo(rx, ry);
          else ctx.lineTo(rx, ry);
        }
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
      ctx.restore();
      break;
    }

    // ====== w3: رمح حديدي — وميض حاد (sharp flash rays) ======
    case 'w3': {
      ctx.save();
      ctx.translate(x, y);
      const flash = Math.sin(time * 5) * 0.5 + 0.5;
      ctx.globalAlpha = flash * 0.4 * intensity;
      ctx.strokeStyle = "#c0c0c0";
      ctx.lineWidth = 2;
      ctx.shadowColor = "#ffffff";
      ctx.shadowBlur = 8;
      for (let i = 0; i < 6 + lvl * 2; i++) {
        const angle = (i / (6 + lvl * 2)) * Math.PI * 2 + time * 0.5;
        const len = 8 + lvl * 2 + Math.sin(time * 6 + i) * 3;
        ctx.beginPath();
        ctx.moveTo(Math.cos(angle) * 8, Math.sin(angle) * 8 - 6);
        ctx.lineTo(Math.cos(angle) * (8 + len), Math.sin(angle) * (8 + len) - 6);
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
      ctx.restore();
      break;
    }

    // ====== w4: سيف دمشقي — توهج ذهبي فاخر (golden glow + particles) ======
    case 'w4': {
      ctx.save();
      ctx.translate(x, y);
      // هالة ذهبية كبيرة
      const pulse = 1 + 0.08 * Math.sin(time * 2);
      ctx.globalAlpha = 0.2 * intensity * pulse;
      ctx.shadowColor = "#ffd700";
      ctx.shadowBlur = 30 * pulse;
      ctx.fillStyle = "rgba(255,215,0,0.1)";
      ctx.beginPath();
      ctx.arc(0, -4, 16 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      // جسيمات ذهبية صاعدة
      for (let i = 0; i < 3 + lvl; i++) {
        const px = Math.sin(time * 0.8 + i * 1.7) * 12;
        const py = -10 - (time * 20 + i * 15) % 30;
        const alpha = 0.4 + 0.3 * Math.sin(time * 2 + i);
        ctx.globalAlpha = alpha * intensity;
        ctx.fillStyle = "#ffd700";
        ctx.shadowColor = "#ffd700";
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(px, py, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
      ctx.restore();
      break;
    }

    // ====== w5: قوس ناري — شعلة (flame particles rising) ======
    case 'w5': {
      ctx.save();
      ctx.translate(x, y);
      const flicker = 0.8 + 0.2 * Math.sin(time * 8);
      for (let i = 0; i < 5 + lvl * 2; i++) {
        const seed = i * 13.7;
        const px = Math.sin(time * 2 + seed) * (6 + lvl * 1.5);
        const py = -6 - ((time * 15 + seed * 3) % 22);
        const size = 1.5 + Math.sin(time * 5 + seed) * 1 + lvl * 0.3;
        const alpha = (0.3 + 0.3 * (1 - py / -30)) * intensity * flicker;
        ctx.globalAlpha = alpha;
        const gradient = ctx.createRadialGradient(px, py, 0, px, py, size);
        gradient.addColorStop(0, "#fff8dc");
        gradient.addColorStop(0.3, "#ff6b35");
        gradient.addColorStop(0.7, "#ff4444");
        gradient.addColorStop(1, "rgba(255,0,0,0)");
        ctx.fillStyle = gradient;
        ctx.shadowColor = "#ff4400";
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(px, py, size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
      ctx.restore();
      break;
    }

    // ====== w6: فأس معركة — اهتزاز أرضي (ground crack + shake) ======
    case 'w6': {
      ctx.save();
      ctx.translate(x, y);
      // تشققات أرضية على الجانبين
      const shakeAmt = Math.sin(time * 12) * 2;
      ctx.globalAlpha = 0.4 * intensity;
      ctx.strokeStyle = "#8B4513";
      ctx.lineWidth = 2;
      ctx.shadowColor = "#8B4513";
      ctx.shadowBlur = 4;
      for (let i = 0; i < 3 + lvl; i++) {
        const side = i % 2 === 0 ? 1 : -1;
        const bx = side * (10 + i * 2) + shakeAmt;
        const by = 4 + i * 3;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + side * (5 + Math.sin(time * 3 + i) * 3), by + 4 + Math.sin(time * 4 + i) * 2);
        ctx.stroke();
        // شظية صغيرة تطير
        const sx = bx + side * (3 + Math.sin(time * 5 + i * 2) * 2);
        const sy = by - 2 - (time * 20 + i * 10) % 12;
        ctx.globalAlpha = (0.3 + 0.2 * Math.sin(time * 3 + i)) * intensity;
        ctx.fillStyle = "#a08060";
        ctx.beginPath();
        ctx.arc(sx, sy, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
      // نبضة قوية تحت الأيقونة
      const shockPulse = Math.sin(time * 4) * 0.5 + 0.5;
      ctx.globalAlpha = 0.25 * shockPulse * intensity;
      ctx.strokeStyle = "#d4a76a";
      ctx.lineWidth = 2;
      ctx.shadowColor = "#d4a76a";
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.ellipse(0, 8 + shakeAmt * 0.3, 12 + shockPulse * 6, 3 + shockPulse * 2, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
      ctx.restore();
      break;
    }

    default:
      break;
  }
}

export function drawWeaponOnHero(ctx, weaponId, x, y, radius, starLevel, time) {
  const icon = WEAPON_ICONS[weaponId];
  if (!icon) return;
  const floatY = Math.sin(time * 2) * 3;
  const size = 14 + Math.min(starLevel, 5) * 2;
  const yOff = -radius - 4 + floatY;
  ctx.save();
  ctx.translate(x, y);

  // ظل خفيف تحت الأيقونة
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.beginPath();
  ctx.ellipse(0, yOff + size * 0.4, size * 0.35, 2, 0, 0, Math.PI * 2);
  ctx.fill();

  // توهج خلف الأيقونة حسب نوع السلاح
  const glowColors = {
    w1: "rgba(255,255,200,0.6)",
    w2: "rgba(168,216,234,0.5)",
    w3: "rgba(200,200,255,0.6)",
    w4: "rgba(255,215,0,0.8)",
    w5: "rgba(255,100,50,0.7)",
    w6: "rgba(180,100,50,0.6)",
  };
  ctx.shadowColor = glowColors[weaponId] || "rgba(255,215,0,0.6)";
  ctx.shadowBlur = 14;
  ctx.font = `${size}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(icon, 0, yOff);
  ctx.shadowBlur = 0;

  ctx.restore();

  // رسم التأثير البصري الخاص بالسلاح
  drawWeaponSpecialEffect(ctx, weaponId, x, y, starLevel, time);
}

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
    ctx.fillText("\u2605", startX + i * gap + s / 2, y);
  }
  ctx.shadowBlur = 0;
  ctx.restore();
}
