"use strict";

// ═══════════════════════════════════════════════════════════════════
//  🎯 قائمة أهداف PvP المقترحة — يقترح خصوماً مناسبين لقوة اللاعب
//  بدل البحث العشوائي في الخريطة المفتوحة. يعيد استخدام آلية الملاحقة
//  والهجوم الموجودة أصلاً (_startPvPPursuit) بلا أي منطق قتال جديد.
// ═══════════════════════════════════════════════════════════════════

export function openPvPTargetsPanel(world) {
  closePvPTargetsPanel();
  const overlay = document.createElement("div");
  overlay.id = "pvp-targets-overlay";
  overlay.className = "party-overlay"; // نعيد استخدام نفس طابع نافذة الحزب
  overlay.innerHTML = buildContent(world);
  document.body.appendChild(overlay);
  wireEvents(overlay, world);
}

export function closePvPTargetsPanel() {
  document.getElementById("pvp-targets-overlay")?.remove();
}

function getSuggestedTargets(world) {
  const myPower = world.economy?.power || world.leader?.army_power || 5000;
  const myName = world.username;
  const list = [];
  for (const [name, p] of world.otherPlayers) {
    if (name === myName) continue;
    if (p.br_alive === false) continue; // لا تقترح لاعباً "ميتاً" في BR
    list.push(p);
  }
  list.sort((a, b) => Math.abs((a.army_power || 0) - myPower) - Math.abs((b.army_power || 0) - myPower));
  return list.slice(0, 8);
}

function powerBadge(theirPower, myPower) {
  const ratio = theirPower / Math.max(1, myPower);
  if (ratio < 0.85) return { label: "أضعف منك", cls: "pvpt-easy" };
  if (ratio > 1.15) return { label: "أقوى منك", cls: "pvpt-hard" };
  return { label: "مماثل", cls: "pvpt-even" };
}

function buildContent(world) {
  const myPower = world.economy?.power || world.leader?.army_power || 5000;
  const targets = getSuggestedTargets(world);
  const rows = targets.length
    ? targets.map(t => {
        const badge = powerBadge(t.army_power || 0, myPower);
        const dist = world.leader ? Math.round(Math.hypot(t.x - world.leader.x, t.y - world.leader.y)) : 0;
        return `
          <div class="pvpt-row" data-username="${t.username}">
            <div class="pvpt-info">
              <div class="pvpt-name">🧙 ${t.username}</div>
              <div class="pvpt-meta">👊 ${Math.round(t.army_power || 0)} <span class="pvpt-badge ${badge.cls}">${badge.label}</span></div>
              <div class="pvpt-dist">📍 يبعد ${dist}م</div>
            </div>
            <button class="pvpt-attack-btn" data-username="${t.username}">🎯 هاجم</button>
          </div>`;
      }).join("")
    : `<div class="pvpt-empty">لا يوجد لاعبون متصلون حالياً — عد لاحقاً!</div>`;

  return `
    <div class="party-card">
      <button class="party-close" id="pvpt-close-btn">✕</button>
      <div class="party-icon">🎯</div>
      <h2 class="party-title">أهداف مقترحة</h2>
      <p class="pvpt-sub">خصوم بقوة مقاربة لقوتك — اختر واحداً وسيسير بطلك نحوه تلقائياً</p>
      <div class="pvpt-list">${rows}</div>
    </div>
  `;
}

function wireEvents(overlay, world) {
  overlay.querySelector("#pvpt-close-btn")?.addEventListener("click", closePvPTargetsPanel);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) closePvPTargetsPanel(); });

  overlay.querySelectorAll(".pvpt-attack-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const username = btn.dataset.username;
      const target = world.otherPlayers.get(username);
      if (!target) return;
      closePvPTargetsPanel();
      if (world._pvpDisabled) {
        world.store?.set("notification", { text: "❌ الهجوم معطّل في هذا النمط", t: Date.now() });
        return;
      }
      world._hidePvPMenu?.();
      world._startPvPPursuit(target);
      world.store?.set("notification", { text: `🏃 يتجه بطلك نحو ${username}...`, t: Date.now() });
    });
  });
}
