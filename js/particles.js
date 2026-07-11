export function spawnParticle(x, y, emoji) {
  const container = document.getElementById("particle-container");
  if (!container) return;
  const el = document.createElement("div");
  el.className = "particle";
  el.textContent = emoji;
  el.style.left = x + "px";
  el.style.top = y + "px";
  el.style.animationDuration = (0.8 + Math.random() * 0.6) + "s";
  container.appendChild(el);
  setTimeout(() => el.remove(), 1500);
}

export function spawnGoldBurst(x, y, count = 5) {
  for (let i = 0; i < count; i++) {
    setTimeout(() => spawnParticle(x + (Math.random() - 0.5) * 40, y + (Math.random() - 0.5) * 20, "🪙"), i * 80);
  }
}

export function spawnLevelUp(x, y) {
  spawnParticle(x - 10, y - 10, "⭐");
  spawnParticle(x + 10, y - 10, "⬆️");
}

export function spawnXpGain(x, y) {
  spawnParticle(x, y, "✨");
}
