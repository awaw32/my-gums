// ═══════════════════════════════════════════════════════════════════
//  👥 واجهة الحزب — "العب مع صديق"
//  إنشاء حزب بكود، انضمام بكود، مشاركة عبر واتساب/نسخ
//  تعتمد على نظام الحزب في world-party.js + worldHandler.js
// ═══════════════════════════════════════════════════════════════════

let _storeUnsub = null;

export function openPartyModal(world) {
  closePartyModal();
  const overlay = document.createElement("div");
  overlay.id = "party-overlay";
  overlay.className = "party-overlay";
  overlay.innerHTML = buildContent(world);
  document.body.appendChild(overlay);
  wireEvents(overlay, world);

  // تحديث تفاعلي عند وصول كود الحزب من السيرفر
  if (world.store) {
    _storeUnsub = world.store.on("partyCode", () => {
      const el = document.getElementById("party-overlay");
      if (el) {
        el.innerHTML = buildContent(world);
        wireEvents(el, world);
      }
    });
  }
}

export function closePartyModal() {
  if (_storeUnsub) { _storeUnsub(); _storeUnsub = null; }
  document.getElementById("party-overlay")?.remove();
}

function buildContent(world) {
  const code = world.partyCode;
  const connected = world.netSync && world.netSync.isConnected;
  const codeSection = code
    ? `
      <div class="party-code-box">
        <div class="party-code-label">كود حزبك — شاركه مع أصدقائك:</div>
        <div class="party-code-value" id="party-code-value">${code}</div>
        <div class="party-share-row">
          <button class="party-share-btn party-wa-btn" id="party-share-wa">💬 شارك عبر واتساب</button>
          <button class="party-share-btn" id="party-copy-code">📋 نسخ الكود</button>
        </div>
        <div class="party-hint">أي صديق يُدخل هذا الكود ينضم لحزبك — وتلعبون معركة ملكية وحشد معاً في مباراة خاصة بكم! 🔥</div>
      </div>`
    : `
      <button class="party-main-btn" id="party-create-btn2" ${connected ? "" : "disabled"}>➕ إنشاء حزب جديد</button>
      ${connected ? "" : '<div class="party-hint">⚠️ تحتاج اتصالاً بالخادم — ادخل الخريطة أولاً</div>'}`;

  return `
    <div class="party-card">
      <button class="party-close" id="party-close-btn">✕</button>
      <div class="party-icon">👥</div>
      <h2 class="party-title">العب مع أصدقائك</h2>
      ${codeSection}
      <div class="party-divider">أو انضم لحزب صديق</div>
      <div class="party-join-row">
        <input type="text" id="party-join-input2" class="party-join-input" placeholder="أدخل الكود..." maxlength="6" autocomplete="off">
        <button class="party-main-btn party-join-btn2" id="party-join-btn2" ${connected ? "" : "disabled"}>انضمام</button>
      </div>
    </div>
  `;
}

function wireEvents(overlay, world) {
  overlay.querySelector("#party-close-btn")?.addEventListener("click", closePartyModal);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) closePartyModal(); });

  overlay.querySelector("#party-create-btn2")?.addEventListener("click", (e) => {
    e.target.disabled = true;
    e.target.textContent = "⏳ جاري الإنشاء...";
    world.createParty?.();
  });

  overlay.querySelector("#party-join-btn2")?.addEventListener("click", () => {
    const input = overlay.querySelector("#party-join-input2");
    const code = (input?.value || "").trim().toUpperCase();
    if (code.length >= 4) world.joinParty?.(code);
  });

  overlay.querySelector("#party-share-wa")?.addEventListener("click", () => {
    const code = world.partyCode;
    if (!code) return;
    const text = encodeURIComponent(
      `🏜️ تعال العب معي "ملك الصحراء"!\n👥 كود الحزب: ${code}\n🎮 ${window.location.origin}`
    );
    window.open(`https://wa.me/?text=${text}`, "_blank");
  });

  overlay.querySelector("#party-copy-code")?.addEventListener("click", (e) => {
    const code = world.partyCode;
    if (!code) return;
    navigator.clipboard?.writeText(code).then(() => {
      e.target.textContent = "✅ نُسخ!";
      setTimeout(() => { e.target.textContent = "📋 نسخ الكود"; }, 1500);
    }).catch(() => {});
  });
}
