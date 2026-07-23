"use strict";

/**
 * server/logic/cosmetics-shop.js
 * ============================================================================
 * 🎨 متجر المظاهر — Cosmetics Shop (بصري بحت، ممنوع بيع قوة)
 * كل عنصر هنا زخرفي 100% — لا يزيد ضرراً ولا يمنح ذهباً ولا يفتح أي ميزة
 * لعب. السيرفر هو المصدر الوحيد للأسعار (لا يُقرأ أي سعر من العميل) ويخصم
 * gems فقط من memStore، بنفس نمط auction-manager.js's placeBid.
 * ============================================================================
 */

const COSMETIC_ITEMS = {
  // 🗡️ مظاهر سيوف — بصري فقط، لا تغيّر الضرر أو المدى
  sword_black: { id: "sword_black", category: "sword", name: "جلد السيف الأسود", icon: "🗡️", price: 40, color: "#1a1a1a" },
  sword_gold: { id: "sword_gold", category: "sword", name: "جلد السيف الذهبي", icon: "🗡️", price: 80, color: "#FFD700" },
  // 🐫 مظاهر جمال — تظهر في ملفك الشخصي فقط
  camel_white: { id: "camel_white", category: "camel", name: "جمل أبيض", icon: "🐪", price: 30, color: "#f5f5f5" },
  camel_black: { id: "camel_black", category: "camel", name: "جمل أسود", icon: "🐪", price: 30, color: "#2c2c2c" },
  // 👑 ألقاب ملوّنة وإطارات — تظهر بجانب اسمك للجميع
  title_ruby: { id: "title_ruby", category: "title", name: "لقب ياقوتي", icon: "👑", price: 60, color: "#e74c3c" },
  title_emerald: { id: "title_emerald", category: "title", name: "لقب زمرّدي", icon: "👑", price: 60, color: "#2ecc71" },
  title_sapphire: { id: "title_sapphire", category: "title", name: "لقب ياقوت أزرق", icon: "👑", price: 60, color: "#3498db" },
};

function createCosmeticsShop(deps) {
  const { memStore, getDefaultPlayer, markDirty } = deps;

  function getCatalog() {
    return Object.values(COSMETIC_ITEMS);
  }

  function getPlayerCosmetics(username) {
    const pData = memStore.get(username) || getDefaultPlayer(username);
    return pData.cosmetics || { swordSkin: "", camelSkin: "", titleColor: "", owned: [] };
  }

  /** شراء وهمي (mock) — لا بوابة دفع حقيقية، يخصم gems فقط، سيرفر-موثوق بالكامل */
  function purchase(username, itemId) {
    const item = COSMETIC_ITEMS[itemId];
    if (!item) return { ok: false, reason: "unknown_item" };

    const pData = memStore.get(username) || getDefaultPlayer(username);
    const cosmetics = pData.cosmetics || { swordSkin: "", camelSkin: "", titleColor: "", owned: [] };
    if (cosmetics.owned.includes(itemId)) return { ok: false, reason: "already_owned" };
    if ((pData.gems || 0) < item.price) return { ok: false, reason: "insufficient_gems" };

    pData.gems -= item.price;
    cosmetics.owned.push(itemId);
    pData.cosmetics = cosmetics;
    memStore.set(username, pData);
    markDirty(username);

    return { ok: true, item, gemsRemaining: pData.gems };
  }

  /** تجهيز مظهر مملوك بالفعل — لا تكلفة، فقط تبديل العرض */
  function equip(username, itemId) {
    const item = COSMETIC_ITEMS[itemId];
    if (!item) return { ok: false, reason: "unknown_item" };

    const pData = memStore.get(username) || getDefaultPlayer(username);
    const cosmetics = pData.cosmetics || { swordSkin: "", camelSkin: "", titleColor: "", owned: [] };
    if (!cosmetics.owned.includes(itemId)) return { ok: false, reason: "not_owned" };

    if (item.category === "sword") cosmetics.swordSkin = itemId;
    else if (item.category === "camel") cosmetics.camelSkin = itemId;
    else if (item.category === "title") cosmetics.titleColor = itemId;

    pData.cosmetics = cosmetics;
    memStore.set(username, pData);
    markDirty(username);

    return { ok: true, cosmetics };
  }

  return { getCatalog, getPlayerCosmetics, purchase, equip };
}

module.exports = { createCosmeticsShop, COSMETIC_ITEMS };
