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

export function showPvPDefeat(worldMap, killerName, killerPower, lootTaken, powerLoss, enemyMaxHp, enemyDamage) {
  const modal = document.getElementById("pvp-defeat-modal");
  const killerEl = document.getElementById("pvp-defeat-killer");
  const powerEl = document.getElementById("pvp-defeat-power");
  const lootEl = document.getElementById("pvp-defeat-loot");
  const lossEl = document.getElementById("pvp-defeat-power-loss");
  if (!modal) return;
  if (killerEl) killerEl.textContent = killerName;
  if (powerEl) powerEl.textContent = `${killerPower} 👊 (DMG: ${enemyDamage || '?'} | HP: ${enemyMaxHp || '?'})`;
  if (lootEl) lootEl.textContent = `${lootTaken} 💵`;
  if (lossEl) lossEl.textContent = `${powerLoss} 👊`;
  modal.classList.remove("hidden");
}

export function showWipeScreen(worldMap, lost, killed) {
  const existing = document.getElementById("wipe-overlay");
  if (existing) existing.remove();
  const overlay = document.createElement("div");
  overlay.id = "wipe-overlay";
  overlay.style.cssText = `
    position: fixed; inset: 0; z-index: 9999;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    background: rgba(0,0,0,0.88);
    direction: rtl; text-align: center;
    padding: 20px; box-sizing: border-box;
  `;
  overlay.innerHTML = `
    <div style="font-size:3rem;margin-bottom:8px;">💀</div>
    <div style="color:#ff4444;font-size:1.1rem;font-weight:700;margin-bottom:12px;">هُزم جيشك بالكامل!</div>
    <div style="color:var(--gold);font-size:0.85rem;margin-bottom:6px;">الغنائم التي خسرتها:</div>
    <div style="color:#fff;font-size:1.5rem;font-weight:700;margin-bottom:4px;">${lost} 💵</div>
    <div style="color:var(--beige-dark);font-size:0.7rem;margin-bottom:16px;">الوحوش المقتولة: ${killed}</div>
    <div style="color:#ff6b6b;font-size:0.85rem;margin-bottom:16px;">قوتك: ${worldMap.economy ? worldMap.economy.power : 0} 👊</div>
    <button id="wipe-return-btn" style="
      padding: 12px 32px; font-size:1rem; font-weight:700;
      background:linear-gradient(180deg,#3a8ab5,#1a5a7a); color:#fff; border:none; border-radius:12px;
      cursor:pointer; touch-action:manipulation; margin-bottom:8px; width:200px;
    ">🗺️ العودة للخريطة</button>
    <button id="wipe-exit-btn" style="
      padding: 12px 32px; font-size:1rem; font-weight:700;
      background:linear-gradient(180deg,#8a2020,#5a1010); color:#fff; border:none; border-radius:12px;
      cursor:pointer; touch-action:manipulation; width:200px;
    ">🚪 الخروج للقائمة</button>
  `;
  document.body.appendChild(overlay);
  document.getElementById("wipe-return-btn").onclick = () => overlay.remove();
  document.getElementById("wipe-exit-btn").onclick = () => {
    overlay.remove();
    if (worldMap.onExit) worldMap.onExit();
  };
}
