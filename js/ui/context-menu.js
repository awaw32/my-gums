"use strict";

export function showPvPMenu(worldMap, otherPlayer) {
  const menu = document.getElementById("pvp-context-menu");
  const attackBtn = document.getElementById("pvp-attack-btn");
  const inspectBtn = document.getElementById("pvp-inspect-btn");
  if (!menu || !attackBtn || !inspectBtn) return;
  worldMap._pvpTarget = otherPlayer;

  const cam = worldMap.engine?.camera;
  if (cam && cam.worldToScreen) {
    const sp = cam.worldToScreen(otherPlayer.x, otherPlayer.y);
    attackBtn.style.left = (sp.x - 60) + "px";
    attackBtn.style.top = (sp.y - 30) + "px";
    inspectBtn.style.left = (sp.x + 10) + "px";
    inspectBtn.style.top = (sp.y - 30) + "px";
  }
  menu.classList.remove("hidden");
}

export function hidePvPMenu(worldMap) {
  const menu = document.getElementById("pvp-context-menu");
  if (menu) menu.classList.add("hidden");
  worldMap._pvpTarget = null;
}

export function showPvPDefeat(worldMap, killerName, killerPower, lootTaken, powerLoss, _enemyMaxHp, _enemyDamage) {
  const modal = document.getElementById("pvp-defeat-modal");
  const killerEl = document.getElementById("pvp-defeat-killer");
  const powerEl = document.getElementById("pvp-defeat-power");
  const lootEl = document.getElementById("pvp-defeat-loot");
  const lossEl = document.getElementById("pvp-defeat-power-loss");
  if (!modal) return;
  if (killerEl) killerEl.textContent = killerName;
  if (powerEl) powerEl.textContent = `${killerPower} 👊`;
  if (lootEl) lootEl.textContent = `${lootTaken} 💵`;
  if (lossEl) lossEl.textContent = `${powerLoss} 👊`;

  // عد تنازلي 10 ثواني ثم العودة تلقائياً
  const countdownEl = document.getElementById("pvp-defeat-countdown");
  const returnBtn = document.getElementById("pvp-defeat-return-btn");
  let countdown = 10;
  if (countdownEl) countdownEl.textContent = countdown.toString();

  if (returnBtn) {
    returnBtn.textContent = `🗺️ العودة (${countdown})`;
  }

  modal.classList.remove("hidden");

  const oldBtn = returnBtn?._pvpCountdown;
  if (oldBtn) { clearInterval(oldBtn); }

  const timer = setInterval(() => {
    countdown--;
    if (countdownEl) countdownEl.textContent = countdown.toString();
    if (returnBtn) returnBtn.textContent = `🗺️ العودة (${countdown})`;
    if (countdown <= 0) {
      clearInterval(timer);
      modal.classList.add("hidden");
      if (worldMap._onPvPReturn) worldMap._onPvPReturn();
    }
  }, 1000);

  if (returnBtn) {
    returnBtn._pvpCountdown = timer;
    returnBtn.onclick = () => {
      clearInterval(timer);
      modal.classList.add("hidden");
      if (worldMap._onPvPReturn) worldMap._onPvPReturn();
    };
  }
}

/**
 * شاشة نتيجة مخصصة احترافية لأوضاع اللعب الخاصة (كهف/استخراج/حشد) —
 * تعرض إحصائيات ذات صلة بالنمط بدل الاعتماد على نص عائم يختفي خلال ثوانٍ.
 * opts: { won, icon, title, stats: [{label, value}], rewardLine }
 */
export function showModeResultScreen(worldMap, opts) {
  const existing = document.getElementById("mode-result-overlay");
  if (existing) existing.remove();
  const overlay = document.createElement("div");
  overlay.id = "mode-result-overlay";
  overlay.className = `mode-result-overlay ${opts.won ? "won" : "lost"}`;
  const statsHtml = (opts.stats || [])
    .map(s => `<div class="mr-stat"><span class="mr-stat-label">${s.label}</span><span class="mr-stat-value">${s.value}</span></div>`)
    .join("");
  overlay.innerHTML = `
    <div class="mr-icon">${opts.icon || (opts.won ? "🏆" : "💀")}</div>
    <div class="mr-title">${opts.title || (opts.won ? "انتصار!" : "انتهت المحاولة")}</div>
    <div class="mr-stats">${statsHtml}</div>
    ${opts.rewardLine ? `<div class="mr-reward">${opts.rewardLine}</div>` : ""}
    <button id="mode-result-close-btn" class="mr-btn">🗺️ العودة للخريطة</button>
    <button id="mode-result-exit-btn" class="mr-btn-secondary">🚪 الخروج للقائمة</button>
  `;
  document.body.appendChild(overlay);
  document.getElementById("mode-result-close-btn").onclick = () => overlay.remove();
  document.getElementById("mode-result-exit-btn").onclick = () => {
    overlay.remove();
    if (worldMap.onExit) worldMap.onExit();
  };
}

export function showWipeScreen(worldMap, lost, killed) {
  const existing = document.getElementById("wipe-overlay");
  if (existing) existing.remove();
  const overlay = document.createElement("div");
  overlay.id = "wipe-overlay";
  overlay.innerHTML = `
    <div class="wipe-icon">💀</div>
    <div class="wipe-title">هُزم جيشك بالكامل!</div>
    <div class="wipe-label">الغنائم التي خسرتها:</div>
    <div class="wipe-amount">${lost} 💵</div>
    <div class="wipe-sub">الوحوش المقتولة: ${killed}</div>
    <div class="wipe-power">قوتك: ${worldMap.economy ? worldMap.economy.power : 0} 👊</div>
    <button id="wipe-return-btn" class="wipe-btn">🗺️ العودة للخريطة</button>
    <button id="wipe-exit-btn" class="wipe-btn-secondary">🚪 الخروج للقائمة</button>
  `;
  document.body.appendChild(overlay);
  document.getElementById("wipe-return-btn").onclick = () => overlay.remove();
  document.getElementById("wipe-exit-btn").onclick = () => {
    overlay.remove();
    if (worldMap.onExit) worldMap.onExit();
  };
}
