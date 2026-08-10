"use strict";

const logger = require("../logger");

/**
 * server/logic/allianceManager.js
 * ============================================================================
 * 🏜️ محرك التحالف/القبيلة — Alliance Manager
 * يدير عضوية القبائل الحقيقية على مستوى الخادم:
 *   - البحث عن قبيلة بالاسم
 *   - إنشاء قبيلة جديدة
 *   - طلب الانضمام + موافقة/رفض الشيخ
 *   - الترقية/التنزيل/الطرد/المغادرة
 *   - المساهمة بالخزينة وترقية مستوى القبيلة
 * ============================================================================
 */

// نفس مستويات الأجراس المستخدمة سابقاً في js/alliance-manager.js (تكلفة ذهب تصاعدية)
const ALLIANCE_TIER_COSTS = [100, 200, 400, 800];
const MAX_ALLIANCE_LEVEL = ALLIANCE_TIER_COSTS.length;

// 🛡️ مطابقة تماماً لـ ALLIANCE_TIERS في js/alliance-manager.js — كانت هذه
// المكافآت (ضرر/دفاع/دخل) تُطبَّق محلياً على العميل فقط (قتال العالم المفتوح
// عبر world.js) بلا أي تطبيق أو تحقق سيرفري، فلا تؤثر إطلاقاً على PvP أو
// مكافآت قتل الوحوش التي يحسمها الخادم — عضوية تحالف قوي كانت وعداً بصرياً
// فقط. الفهرس مطابق لـ ALLIANCE_TIER_COSTS: alliance.level=1 → index 0.
const ALLIANCE_TIER_BONUSES = [
  { damageBonus: 2,  defenseBonus: 1, incomeMult: 1.1 },
  { damageBonus: 5,  defenseBonus: 2, incomeMult: 1.2 },
  { damageBonus: 10, defenseBonus: 4, incomeMult: 1.3 },
  { damageBonus: 20, defenseBonus: 8, incomeMult: 1.5 },
];

/**
 * 🛡️ مكافآت مستوى التحالف — دالة نقية (خارج المصنع) لتُستخدَم أيضاً من
 * formulas.js دون الحاجة لنسخة allianceManager الكاملة (المُنشأة بـ deps
 * وقت التشغيل فقط). getAlliance تُمرَّر كمعامل — نفس الدالة المُصدَّرة من
 * server/db/allianceHelper.js في كلا موضعي الاستخدام.
 * damageBonus/defenseBonus تراكميتان (مجموع كل الرُّتب حتى المستوى الحالي)،
 * incomeMult قيمة الرتبة الحالية فقط (وليست تراكمية) — بنفس منطق
 * js/alliance-manager.js تماماً (damageBonus/defenseBonus getters، incomeMult getter).
 */
function getAllianceBonuses(allianceId, getAlliance) {
  if (!allianceId || !getAlliance) return { damageBonus: 0, defenseBonus: 0, incomeMult: 1 };
  const alliance = getAlliance(allianceId);
  const level = alliance ? alliance.level : 0;
  if (!level || level <= 0) return { damageBonus: 0, defenseBonus: 0, incomeMult: 1 };
  let damageBonus = 0, defenseBonus = 0;
  for (let i = 0; i < level && i < ALLIANCE_TIER_BONUSES.length; i++) {
    damageBonus += ALLIANCE_TIER_BONUSES[i].damageBonus;
    defenseBonus += ALLIANCE_TIER_BONUSES[i].defenseBonus;
  }
  const incomeMult = ALLIANCE_TIER_BONUSES[Math.min(level, ALLIANCE_TIER_BONUSES.length) - 1].incomeMult;
  return { damageBonus, defenseBonus, incomeMult };
}

function createAllianceManager(deps) {
  const {
    worldClients, memStore, markDirty, getDefaultPlayer,
    TRIBAL_RANKS, getRank, createAllianceRecord, saveAlliance, getAlliance,
    getAllianceIdByName, nameTaken, searchAlliancesByName, escapeHtml,
  } = deps;

  // ==================== أدوات مساعدة ====================

  function getOnlineClient(username) {
    const c = worldClients.get(username);
    if (!c || c.ws.readyState !== 1) return null;
    return c;
  }

  function broadcastToMembers(alliance, message) {
    const msg = JSON.stringify(message);
    for (const m of alliance.members) {
      const c = getOnlineClient(m.username);
      if (c) c.ws.send(msg);
    }
  }

  function getMyAlliance(username) {
    const pData = memStore.get(username);
    if (!pData || !pData.allianceId) return null;
    return getAlliance(pData.allianceId);
  }

  function getMemberEntry(alliance, username) {
    return alliance.members.find(m => m.username === username) || null;
  }

  function getAuthority(alliance, username) {
    const m = getMemberEntry(alliance, username);
    return m ? getRank(m.rank).authority : -1;
  }

  function getTribePower(allianceId) {
    const alliance = getAlliance(allianceId);
    if (!alliance) return 0;
    let power = 0;
    for (const m of alliance.members) {
      const c = worldClients.get(m.username);
      if (c) power += c.army_power || 0;
    }
    return power;
  }

  // ملاحظة: getAllianceBonuses (الدالة النقية) مُعرَّفة على مستوى الوحدة أعلاه
  // لتُستخدَم أيضاً من formulas.js — هنا فقط نربطها بـ getAlliance من deps.
  function getMyAllianceBonuses(allianceId) {
    return getAllianceBonuses(allianceId, getAlliance);
  }

  function summarize(alliance) {
    if (!alliance) return null;
    return {
      id: alliance.id,
      name: alliance.name,
      banner: alliance.banner,
      level: alliance.level,
      treasury: alliance.treasury,
      memberCount: alliance.members.length,
      tribePower: getTribePower(alliance.id),
      members: alliance.members.map(m => ({
        username: m.username,
        rank: m.rank,
        contribution: m.contribution || 0,
        power: worldClients.get(m.username)?.army_power || 0,
        online: !!getOnlineClient(m.username),
        joinedAt: m.joinedAt,
      })),
      pendingRequests: alliance.pendingRequests.map(r => ({ username: r.username, requestedAt: r.requestedAt })),
    };
  }

  // ==================== البحث والإنشاء ====================

  function search(query) {
    const results = searchAlliancesByName(query, 20);
    return results.map(a => ({
      id: a.id, name: a.name, banner: a.banner, level: a.level,
      memberCount: a.members.length, tribePower: getTribePower(a.id),
    }));
  }

  async function create(username, name, banner) {
    const pData = memStore.get(username) || getDefaultPlayer(username);
    if (pData.allianceId) return { ok: false, reason: "already_in_alliance" };
    const clean = escapeHtml(String(name || "").trim().slice(0, 30));
    if (!clean) return { ok: false, reason: "invalid_name" };
    if (nameTaken(clean)) return { ok: false, reason: "name_taken" };

    const record = createAllianceRecord(clean, banner, username);
    await saveAlliance(record);

    pData.allianceId = record.id;
    memStore.set(username, pData);
    markDirty(username);

    return { ok: true, allianceId: record.id, alliance: summarize(record) };
  }

  // ==================== طلب الانضمام والموافقة ====================

  async function requestJoin(username, allianceId) {
    const pData = memStore.get(username) || getDefaultPlayer(username);
    if (pData.allianceId) return { ok: false, reason: "already_in_alliance" };
    const alliance = getAlliance(allianceId);
    if (!alliance) return { ok: false, reason: "alliance_not_found" };
    if (alliance.pendingRequests.some(r => r.username === username)) {
      return { ok: false, reason: "request_already_pending" };
    }
    alliance.pendingRequests.push({ username, requestedAt: Date.now() });
    await saveAlliance(alliance);

    // 🔔 أبلغ كل شيوخ القبيلة المتصلين حالياً
    const shaykhs = alliance.members.filter(m => getRank(m.rank).id === "shaykh");
    for (const s of shaykhs) {
      const c = getOnlineClient(s.username);
      if (c) c.ws.send(JSON.stringify({ type: "alliance_join_requested", allianceId, username, requestedAt: Date.now() }));
    }

    return { ok: true, allianceId };
  }

  async function respondToRequest(username, allianceId, targetUsername, approve) {
    const alliance = getAlliance(allianceId);
    if (!alliance) return { ok: false, reason: "alliance_not_found" };
    if (getAuthority(alliance, username) < 3) return { ok: false, reason: "not_authorized" };

    const idx = alliance.pendingRequests.findIndex(r => r.username === targetUsername);
    if (idx === -1) return { ok: false, reason: "request_not_found" };
    alliance.pendingRequests.splice(idx, 1);

    if (approve) {
      // 🛡️ العضو قد يكون طلب الانضمام لأكثر من قبيلة عبر عدة تبويبات — تحقق أنه ما زال بلا قبيلة
      const targetData = memStore.get(targetUsername) || getDefaultPlayer(targetUsername);
      if (targetData.allianceId) {
        await saveAlliance(alliance);
        return { ok: false, reason: "target_already_in_alliance" };
      }
      alliance.members.push({ username: targetUsername, rank: "novice", contribution: 0, joinedAt: Date.now() });
      targetData.allianceId = allianceId;
      memStore.set(targetUsername, targetData);
      markDirty(targetUsername);
    }

    await saveAlliance(alliance);

    const targetClient = getOnlineClient(targetUsername);
    if (targetClient) {
      targetClient.ws.send(JSON.stringify({
        type: approve ? "alliance_request_approved" : "alliance_request_rejected",
        allianceId,
      }));
    }
    if (approve) broadcastToMembers(alliance, { type: "alliance_roster_updated", alliance: summarize(alliance) });

    return { ok: true };
  }

  // ==================== الرتب والطرد والمغادرة ====================

  async function changeRank(username, allianceId, targetUsername, direction) {
    const alliance = getAlliance(allianceId);
    if (!alliance) return { ok: false, reason: "alliance_not_found" };
    if (getAuthority(alliance, username) < 3) return { ok: false, reason: "not_authorized" };
    const member = getMemberEntry(alliance, targetUsername);
    if (!member) return { ok: false, reason: "member_not_found" };

    const rankIds = TRIBAL_RANKS.map(r => r.id);
    const idx = rankIds.indexOf(member.rank);
    const nextIdx = direction === "promote" ? idx - 1 : idx + 1;
    if (nextIdx < 0 || nextIdx >= rankIds.length) return { ok: false, reason: "rank_limit" };
    member.rank = rankIds[nextIdx];

    await saveAlliance(alliance);
    broadcastToMembers(alliance, { type: "alliance_roster_updated", alliance: summarize(alliance) });
    return { ok: true };
  }

  async function kick(username, allianceId, targetUsername) {
    const alliance = getAlliance(allianceId);
    if (!alliance) return { ok: false, reason: "alliance_not_found" };
    if (username === targetUsername) return { ok: false, reason: "use_leave_instead" };
    if (getAuthority(alliance, username) < 3) return { ok: false, reason: "not_authorized" };
    const idx = alliance.members.findIndex(m => m.username === targetUsername);
    if (idx === -1) return { ok: false, reason: "member_not_found" };

    alliance.members.splice(idx, 1);
    await saveAlliance(alliance);

    const targetData = memStore.get(targetUsername);
    if (targetData) {
      targetData.allianceId = "";
      memStore.set(targetUsername, targetData);
      markDirty(targetUsername);
    }
    const targetClient = getOnlineClient(targetUsername);
    if (targetClient) targetClient.ws.send(JSON.stringify({ type: "alliance_kicked", allianceId }));

    broadcastToMembers(alliance, { type: "alliance_roster_updated", alliance: summarize(alliance) });
    return { ok: true };
  }

  async function leave(username) {
    const alliance = getMyAlliance(username);
    if (!alliance) return { ok: false, reason: "not_in_alliance" };

    const myAuthority = getAuthority(alliance, username);
    const otherMembers = alliance.members.filter(m => m.username !== username);

    if (myAuthority === 3 && otherMembers.length > 0) {
      // 🛡️ لا يجوز أن تبقى القبيلة بلا شيخ — رقِّ أقدم عضو "محارب" تلقائياً، وإلا أي عضو آخر
      const nextShaykh =
        otherMembers.filter(m => m.rank === "warrior").sort((a, b) => a.joinedAt - b.joinedAt)[0] ||
        otherMembers.sort((a, b) => a.joinedAt - b.joinedAt)[0];
      nextShaykh.rank = "shaykh";
    }

    alliance.members = otherMembers;
    const pData = memStore.get(username);
    if (pData) {
      pData.allianceId = "";
      memStore.set(username, pData);
      markDirty(username);
    }

    if (alliance.members.length === 0) {
      const { deleteAlliance } = deps;
      if (deleteAlliance) await deleteAlliance(alliance.id);
    } else {
      await saveAlliance(alliance);
      broadcastToMembers(alliance, { type: "alliance_roster_updated", alliance: summarize(alliance) });
    }

    return { ok: true };
  }

  // ==================== الخزينة والترقية ====================

  async function contribute(username, allianceId, amount) {
    const alliance = getAlliance(allianceId);
    if (!alliance) return { ok: false, reason: "alliance_not_found" };
    if (getAuthority(alliance, username) < 0) return { ok: false, reason: "not_authorized" };
    const amt = Math.floor(Number(amount) || 0);
    if (amt <= 0) return { ok: false, reason: "invalid_amount" };

    const pData = memStore.get(username) || getDefaultPlayer(username);
    if ((pData.gold || 0) < amt) return { ok: false, reason: "insufficient_gold" };

    pData.gold -= amt;
    memStore.set(username, pData);
    markDirty(username);

    alliance.treasury = (alliance.treasury || 0) + amt;
    const member = getMemberEntry(alliance, username);
    if (member) {
      member.contribution = (member.contribution || 0) + amt;
      // 🛡️ عدّاد مرات المساهمة (منفصل عن المبلغ التراكمي) — يغذّي مهمة تحالف
      // "مساعدة الحلفاء" في js/quests.js دون ثقة بأي قيمة يرسلها العميل.
      member.contributionCount = (member.contributionCount || 0) + 1;
    }
    await saveAlliance(alliance);

    broadcastToMembers(alliance, { type: "alliance_roster_updated", alliance: summarize(alliance) });
    return { ok: true, treasury: alliance.treasury, contributionCount: member?.contributionCount || 0 };
  }

  // ==================== مهام التحالف ====================

  // 🛡️ مطابق حرفياً لـ ALLIANCE_MISSIONS في js/quests.js. مهمة "مساعدة
  // الحلفاء" كانت بلا أي كود يزيد قيمتها إطلاقاً — عالقة دائماً عند 0/3
  // لكل لاعب ينضم لتحالف. الشرط الحقيقي هنا: المساهمة بالخزينة 3 مرات
  // (member.contributionCount، عدّاد سيرفري حقيقي وليس قيمة يرسلها العميل).
  const ALLIANCE_MISSION_REWARDS = {
    alliance_1: { gold: 300, alliancePoints: 50 },
  };
  const ALLIANCE_MISSION_TARGETS = {
    alliance_1: 3,
  };

  function getClaimedMissionsSet(pData) {
    if (!Array.isArray(pData.claimedAllianceMissions)) pData.claimedAllianceMissions = [];
    return pData.claimedAllianceMissions;
  }

  async function claimMission(username, missionId) {
    const reward = ALLIANCE_MISSION_REWARDS[missionId];
    const target = ALLIANCE_MISSION_TARGETS[missionId];
    if (!reward || !target) return { ok: false, reason: "unknown_mission" };

    const alliance = getMyAlliance(username);
    if (!alliance) return { ok: false, reason: "not_in_alliance" };
    const member = getMemberEntry(alliance, username);
    if (!member) return { ok: false, reason: "not_in_alliance" };
    if ((member.contributionCount || 0) < target) return { ok: false, reason: "progress_incomplete" };

    const pData = memStore.get(username) || getDefaultPlayer(username);
    const claimed = getClaimedMissionsSet(pData);
    if (claimed.includes(missionId)) return { ok: false, reason: "already_claimed" };

    for (const [res, amt] of Object.entries(reward)) {
      if (res === "alliancePoints") continue; // لا حقل موارد فعلي — نقاط تحالف زخرفية حالياً
      pData[res] = (pData[res] || 0) + amt;
    }
    claimed.push(missionId);
    pData.claimedAllianceMissions = claimed;
    memStore.set(username, pData);
    markDirty(username);

    return { ok: true, missionId, granted: reward };
  }

  async function upgrade(username, allianceId, useTreasuryFirst) {
    const alliance = getAlliance(allianceId);
    if (!alliance) return { ok: false, reason: "alliance_not_found" };
    if (getAuthority(alliance, username) < 3) return { ok: false, reason: "not_authorized" };
    if (alliance.level >= MAX_ALLIANCE_LEVEL) return { ok: false, reason: "max_level" };

    const cost = ALLIANCE_TIER_COSTS[alliance.level];
    if (useTreasuryFirst && (alliance.treasury || 0) >= cost) {
      alliance.treasury -= cost;
    } else {
      const pData = memStore.get(username) || getDefaultPlayer(username);
      if ((pData.gold || 0) < cost) return { ok: false, reason: "insufficient_gold" };
      pData.gold -= cost;
      memStore.set(username, pData);
      markDirty(username);
    }

    alliance.level += 1;
    await saveAlliance(alliance);
    broadcastToMembers(alliance, { type: "alliance_roster_updated", alliance: summarize(alliance) });
    return { ok: true, level: alliance.level };
  }

  // ==================== معالج الرسائل الواردة ====================

  async function handleMessage(msg, username, _ws) {
    switch (msg.type) {
      case "alliance_search": {
        return { results: search(msg.query || "") };
      }

      case "alliance_create": {
        if (!username) return { ok: false, reason: "auth_required" };
        return await create(username, msg.name, msg.banner);
      }

      case "alliance_request_join": {
        if (!username) return { ok: false, reason: "auth_required" };
        if (!msg.allianceId) return { ok: false, reason: "invalid_alliance" };
        return await requestJoin(username, msg.allianceId);
      }

      case "alliance_approve_request": {
        if (!username) return { ok: false, reason: "auth_required" };
        return await respondToRequest(username, msg.allianceId, msg.username, true);
      }

      case "alliance_reject_request": {
        if (!username) return { ok: false, reason: "auth_required" };
        return await respondToRequest(username, msg.allianceId, msg.username, false);
      }

      case "alliance_promote": {
        if (!username) return { ok: false, reason: "auth_required" };
        return await changeRank(username, msg.allianceId, msg.username, "promote");
      }

      case "alliance_demote": {
        if (!username) return { ok: false, reason: "auth_required" };
        return await changeRank(username, msg.allianceId, msg.username, "demote");
      }

      case "alliance_kick": {
        if (!username) return { ok: false, reason: "auth_required" };
        return await kick(username, msg.allianceId, msg.username);
      }

      case "alliance_leave": {
        if (!username) return { ok: false, reason: "auth_required" };
        return await leave(username);
      }

      case "alliance_contribute": {
        if (!username) return { ok: false, reason: "auth_required" };
        return await contribute(username, msg.allianceId, msg.amount);
      }

      case "alliance_upgrade": {
        if (!username) return { ok: false, reason: "auth_required" };
        return await upgrade(username, msg.allianceId, msg.useTreasuryFirst);
      }

      case "alliance_get_mine": {
        if (!username) return { ok: false, reason: "auth_required" };
        const alliance = getMyAlliance(username);
        return { alliance: summarize(alliance) };
      }

      case "alliance_claim_mission": {
        if (!username) return { ok: false, reason: "auth_required" };
        return await claimMission(username, msg.missionId);
      }

      default:
        return null;
    }
  }

  return {
    search,
    create,
    requestJoin,
    respondToRequest,
    changeRank,
    kick,
    leave,
    contribute,
    upgrade,
    claimMission,
    getMyAlliance,
    getTribePower,
    getAllianceBonuses: getMyAllianceBonuses,
    summarize,
    handleMessage,
    broadcastToMembers,
  };
}

module.exports = { createAllianceManager, ALLIANCE_TIER_COSTS, MAX_ALLIANCE_LEVEL, ALLIANCE_TIER_BONUSES, getAllianceBonuses };
