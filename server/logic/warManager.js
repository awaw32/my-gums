"use strict";

const { sendPush } = require("../push");

/**
 * server/logic/warManager.js
 * ============================================================================
 * 🏜️ محرك الحرب القبلي — War Manager
 * يدير الحروب بين التحالفات (القبائل) على مستوى الخادم:
 *   - إعلان الحرب (declare)
 *   - تتبع الحالة (نشطة / هدنة / منتهية)
 *   - إرسال الجيوش (deploy_army)
 *   - حل المعارك القبلية (resolve_battle)
 *   - الغنائم والترتيب القبلي (loot & rankings)
 * ============================================================================
 */

const WAR_DURATION_MS   = 30 * 60 * 1000;  // 30 دقيقة لكل حرب
const WAR_COOLDOWN_MS    = 10 * 60 * 1000;  // 10 دقائق تبريد بين الحروب
const _TRUCE_DURATION_MS =  5 * 60 * 1000;   // 5 دقائق هدنة بعد الحرب
const MAX_ACTIVE_WARS    = 20;               // أقصى عدد حروب نشطة متزامنة
const LOOT_CAP_RATIO     = 0.12;             // 12% من قوة الخاسر كغنائم

/**
 * حالة حرب واحدة بين قبيلتين
 */
function createWarRecord(attackerAlliance, defenderAlliance, _stats) {
  return {
    id: `war_${Date.now()}_${Math.floor(Math.random() * 9999)}`,
    attacker: {                              // القبيلة المعتدية (الغازية)
      allianceId: attackerAlliance.allianceId || "",
      name:    attackerAlliance.name,
      leader:  attackerAlliance.leader,
      members: attackerAlliance.members || [],
      power:   attackerAlliance.power || 0,
      score:   0,                             // نقاط قتل المعارك
      coinPool: 0,                             // غنائم متراكمة
    },
    defender: {                              // القبيلة المدافعة
      allianceId: defenderAlliance.allianceId || "",
      name:    defenderAlliance.name,
      leader:  defenderAlliance.leader,
      members: defenderAlliance.members || [],
      power:   defenderAlliance.power || 0,
      score:   0,
      coinPool: 0,
    },
    status: "active",                          // active | truce | ended
    startedAt: Date.now(),
    endsAt:    Date.now() + WAR_DURATION_MS,
    battles:   [],                             // سجل المعارك الفردية
    log:       [],                             // سجل نصي مختصر
  };
}

/**
 * محرك الحرب الرئيسي
 */
function createWarManager(deps) {
  const { worldClients, broadcastChat, memStore, getMyAlliance, getTribePower: getAllianceTribePower } = deps;

  // الحروب النشطة: Map<warId, warRecord>
  const activeWars = new Map();
  // سجل الحروب المنتهية (آخر 100)
  const warHistory = [];
  // تبريدات القبائل: Map<allianceName, cooldownEndsAt>
  const allianceCooldowns = new Map();
  // ترتيب القبائل: Map<allianceName, {name, wins, losses, totalLoot, warCount}>
  const tribeRankings = new Map();

  // ==================== أدوات مساعدة ====================

  function getOnlineClient(username) {
    const c = worldClients.get(username);
    if (!c || c.ws.readyState !== 1) return null;
    return c;
  }

  function broadcastToTribe(members, message) {
    const msg = JSON.stringify(message);
    for (const member of members) {
      const c = getOnlineClient(member);
      if (c) c.ws.send(msg);
    }
  }

  // 🔔 إشعار Push لأعضاء القبيلة غير المتصلين (يُستخدم لتنبيه "تحالفك تحت هجوم")
  function pushToOfflineTribe(members, payload) {
    if (!memStore) return;
    for (const member of members) {
      if (getOnlineClient(member)) continue; // متصل بالفعل — لن يفوته شيء
      const sub = memStore.get(member)?.pushSubscription;
      if (sub) sendPush(sub, payload);
    }
  }

  function broadcastToAll(message) {
    if (broadcastChat) {
      broadcastChat(message);
    } else {
      const msg = JSON.stringify(message);
      worldClients.forEach((c) => {
        if (c.ws.readyState === 1) c.ws.send(msg);
      });
    }
  }

  function addLog(war, text) {
    war.log.push({ t: Date.now(), text });
    if (war.log.length > 50) war.log.shift();
  }

  // 🛡️ قوة القبيلة تُحسب دائماً عبر allianceManager الحقيقي (عضوية موافَق عليها
  // فعلياً من الشيخ) — وليس بمطابقة اسم يعلنه العميل عن نفسه، لمنع تصادم لاعبين
  // مختلفين يكتبان نفس الاسم ويظهران كفريق واحد بلا أي تحقق.
  function getTribePower(allianceId) {
    if (!getAllianceTribePower) return 0;
    return getAllianceTribePower(allianceId);
  }

  // ==================== إعلان الحرب ====================

  function declareWar(declarer, attackerInfo, defenderInfo, attackerAllianceId, defenderAllianceId) {
    // التحقق من التبريد — مفتاح التبريد الآن allianceId الحقيقي وليس اسماً قابلاً للتصادم
    const cooldownEnd = allianceCooldowns.get(attackerAllianceId) || 0;
    if (Date.now() < cooldownEnd) {
      return { ok: false, reason: "cooldown", endsAt: cooldownEnd };
    }

    // البحث عن حرب نشطة بين نفس القبيلتين
    for (const [, war] of activeWars) {
      if (war.status !== "active") continue;
      const samePair =
        (war.attacker.allianceId === attackerAllianceId && war.defender.allianceId === defenderAllianceId) ||
        (war.attacker.allianceId === defenderAllianceId && war.defender.allianceId === attackerAllianceId);
      if (samePair) {
        return { ok: false, reason: "already_at_war", warId: war.id };
      }
    }

    // حد أقصى للحروب النشطة
    if (activeWars.size >= MAX_ACTIVE_WARS) {
      return { ok: false, reason: "max_wars_reached" };
    }

    // لا يمكن الإعلان على نفس القبيلة
    if (attackerAllianceId && attackerAllianceId === defenderAllianceId) {
      return { ok: false, reason: "same_tribe" };
    }

    const war = createWarRecord(
      { ...attackerInfo, allianceId: attackerAllianceId },
      { ...defenderInfo, allianceId: defenderAllianceId },
      null
    );

    // 🛡️ القوة القبلية تُحسب دائماً من عضوية Alliance الحقيقية عبر allianceId —
    // لا نثق بقيمة العميل حتى كـ fallback (قد تُعيد getTribePower صفراً بأمان
    // إن كان الجميع غير متصل).
    war.attacker.power = getTribePower(attackerAllianceId);
    war.defender.power = getTribePower(defenderAllianceId);

    activeWars.set(war.id, war);
    addLog(war, `🗡️ ${attackerInfo.name} أعلنت الغزوة على ${defenderInfo.name}!`);

    // بث إعلان الحرب للقبيلتين وللعالم
    const warStartMsg = {
      type: "war_declared",
      warId: war.id,
      attacker: war.attacker.name,
      defender: war.defender.name,
      attackerPower: war.attacker.power,
      defenderPower: war.defender.power,
      endsAt: war.endsAt,
    };
    broadcastToTribe(war.attacker.members, warStartMsg);
    broadcastToTribe(war.defender.members, warStartMsg);
    // 🔔 تنبيه الأعضاء الغائبين في التحالف المُهاجَم — أهم إشعار استرجاع في اللعبة
    pushToOfflineTribe(war.defender.members, {
      title: "🗡️ تحالفك تحت الهجوم!",
      body: `${war.attacker.name} أعلنت الغزوة على ${war.defender.name} — عد للدفاع الآن!`,
      url: "/",
    });

    // إعلان عام في الدردشة
    broadcastToAll({
      type: "broadcast_chat",
      username: "⚜️ النظام",
      message: `⚔️ ${war.attacker.name} أعلنت الغزوة على ${war.defender.name}! تبدأ الحرب القبلية الآن!`,
    });

    return { ok: true, warId: war.id, war };
  }

  // ==================== إرسال الجيش ====================

  function deployArmy(leader, warId, armyCount, _armyPower, side) {
    const war = activeWars.get(warId);
    if (!war || war.status !== "active") {
      return { ok: false, reason: "war_not_active" };
    }

    // 🛡️ قوة الجيش تُقرأ من worldClients الموثوقة (memStore عند join) وليس من
    // رسالة العميل — تمنع تضخيم نقاط الحرب القبلية عبر قيم قوة وهمية.
    const leaderClient = worldClients.get(leader);
    const armyPower = leaderClient?.army_power || 0;

    // التحقق من القائد
    const mySide = side || (war.attacker.name === leader ? "attacker" : "defender");
    const enemySide = mySide === "attacker" ? "defender" : "attacker";

    // عدّ المشاركين في هذه الحرب
    war[mySide].score += Math.floor(armyPower * 0.01);
    war[mySide].power = getTribePower(war[mySide].name);

    addLog(war, `⚔️ ${leader} أرسل جيشاً بقوة ${armyPower} لدعم ${war[mySide].name}`);

    return {
      ok: true,
      warId: war.id,
      myScore: war[mySide].score,
      enemyScore: war[enemySide].score,
    };
  }

  // ==================== حل معركة فردية ====================

  function resolveBattle(warId, attackerName, _attackerPower, defenderName, _defenderPower) {
    const war = activeWars.get(warId);
    if (!war || war.status !== "active") {
      return { ok: false, reason: "war_not_active" };
    }

    // 🛡️ قوة اللاعبَين تُقرأ من worldClients الموثوقة (memStore عند join) وليس
    // من رسالة العميل — تمنع تلفيق نتائج معارك وغنائم عبر قيم قوة وهمية.
    const attackerClient = worldClients.get(attackerName);
    const defenderClient = worldClients.get(defenderName);
    if (!attackerClient || !defenderClient) {
      return { ok: false, reason: "player_not_found" };
    }
    const attackerPower = attackerClient.army_power || 0;
    const defenderPower = defenderClient.army_power || 0;

    // تحديد الفائز بناءً على القوة + عشوائية بسيطة (±15%)
    const variance = 0.15;
    const attRoll = attackerPower * (1 + (Math.random() - 0.5) * variance * 2);
    const defRoll = defenderPower * (1 + (Math.random() - 0.5) * variance * 2);
    const attackerWon = attRoll >= defRoll;

    // حساب الغنائم (من الخاسر للفائز)
    const loserPower = attackerWon ? defenderPower : attackerPower;
    const loot = Math.floor(Math.min(loserPower * LOOT_CAP_RATIO, 100000));
    const winnerName = attackerWon ? attackerName : defenderName;
    const loserName  = attackerWon ? defenderName : attackerName;

    // تحديث النقاط والغنائم
    // 🛡️ winnerName/loserName الآن اسم لاعب فردي (وليس اسم القبيلة) بعد إصلاح
    // قراءة القوة من worldClients — لذا نطابق ضد أعضاء الطرف (members) بدل اسم
    // القبيلة نفسه لتحديد أي جانب سجّل النقطة والغنيمة فعلياً.
    const winnerSide = (war.attacker.members || []).includes(winnerName) ? "attacker" :
                       (war.defender.members || []).includes(winnerName) ? "defender" : null;
    const _loserSide  = winnerSide === "attacker" ? "defender" : "attacker";

    if (winnerSide) {
      war[winnerSide].score += 1;
      war[winnerSide].coinPool += loot;
    }

    const battleRecord = {
      t: Date.now(),
      attacker: attackerName,
      defender: defenderName,
      attackerPower,
      defenderPower,
      winner: winnerName,
      loser: loserName,
      loot,
    };
    war.battles.push(battleRecord);
    if (war.battles.length > 30) war.battles.shift();

    addLog(war, `⚔️ ${winnerName} انتصر على ${loserName} وغنم ${loot} 🪙`);

    // بث نتيجة المعركة للقبيلتين
    const battleMsg = {
      type: "war_battle_result",
      warId: war.id,
      attacker: attackerName,
      defender: defenderName,
      winner: winnerName,
      loser: loserName,
      loot,
      attackerScore: war.attacker.score,
      defenderScore: war.defender.score,
    };
    broadcastToTribe(war.attacker.members, battleMsg);
    broadcastToTribe(war.defender.members, battleMsg);

    return { ok: true, ...battleRecord };
  }

  // ==================== إنهاء الحرب ====================

  function endWar(warId, reason) {
    const war = activeWars.get(warId);
    if (!war) return null;

    war.status = "ended";
    war.endedAt = Date.now();
    war.endReason = reason || "time_expired";

    // تحديد الفائز بناءً على النقاط
    let winner = null;
    let loser = null;
    if (war.attacker.score > war.defender.score) {
      winner = "attacker"; loser = "defender";
    } else if (war.defender.score > war.attacker.score) {
      winner = "defender"; loser = "attacker";
    }

    const result = {
      warId: war.id,
      winner: winner ? war[winner].name : "تعادل",
      loser:  loser ? war[loser].name : "تعادل",
      attackerScore: war.attacker.score,
      defenderScore: war.defender.score,
      winnerLoot: winner ? war[winner].coinPool : 0,
      loserLoot:  loser ? war[loser].coinPool : 0,
      battles: war.battles.length,
    };

    // تفعيل التبريد للقبيلتين (مفتاح allianceId الحقيقي)
    allianceCooldowns.set(war.attacker.allianceId, Date.now() + WAR_COOLDOWN_MS);
    allianceCooldowns.set(war.defender.allianceId, Date.now() + WAR_COOLDOWN_MS);

    // تحديث الترتيب القبلي
    _updateRankings(war, winner, loser);

    // نقل لأرشيف التاريخ
    warHistory.push({ ...result, log: war.log.slice(-10) });
    if (warHistory.length > 100) warHistory.shift();

    activeWars.delete(warId);

    // بث نتيجة الحرب للعالم
    const endMsg = {
      type: "war_ended",
      ...result,
    };
    broadcastToTribe(war.attacker.members, endMsg);
    broadcastToTribe(war.defender.members, endMsg);

    broadcastToAll({
      type: "broadcast_chat",
      username: "⚜️ النظام",
      message: winner
        ? `🏆 ${war[winner].name} انتصرت في الحرب القبلية ضد ${war[loser].name}! غنائم: ${war[winner].coinPool} 🪙`
        : `🤝 الحرب القبلية بين ${war.attacker.name} و ${war.defender.name} انتهت بالتعادل!`,
    });

    return result;
  }

  // ==================== الترتيب القبلي ====================

  function _updateRankings(war, winner, loser) {
    // القبيلة المعتدية
    _ensureRanking(war.attacker.name);
    _ensureRanking(war.defender.name);

    if (winner) {
      tribeRankings.get(war[winner].name).wins++;
      tribeRankings.get(war[winner].name).totalLoot += war[winner].coinPool || 0;
    }
    if (loser) {
      tribeRankings.get(war[loser].name).losses++;
    }

    tribeRankings.get(war.attacker.name).warCount++;
    tribeRankings.get(war.defender.name).warCount++;
  }

  function _ensureRanking(name) {
    if (!tribeRankings.has(name)) {
      tribeRankings.set(name, { name, wins: 0, losses: 0, totalLoot: 0, warCount: 0 });
    }
  }

  function getRankings() {
    return Array.from(tribeRankings.values())
      .sort((a, b) => b.wins - a.wins || b.totalLoot - a.totalLoot);
  }

  // ==================== استعلامات ====================

  function getActiveWars() {
    return Array.from(activeWars.values());
  }

  function getWarHistory() {
    return warHistory.slice(-20).reverse();
  }

  function getWarById(id) {
    return activeWars.get(id) || null;
  }

  // ==================== حلقة التحديث — إنهاء الحروب المنتهية الصلاحية ====================

  const warTickInterval = setInterval(() => {
    const now = Date.now();
    for (const [warId, war] of activeWars) {
      if (war.status === "active" && now >= war.endsAt) {
        endWar(warId, "time_expired");
      }
    }
  }, 10000); // كل 10 ثوانٍ

  // ==================== معالج الرسائل الواردة ====================

  function handleMessage(msg, username, _ws) {
    switch (msg.type) {
      case "war_declare": {
        if (!username) return { error: "auth_required" };
        if (!getMyAlliance) return { error: "alliance_system_unavailable" };
        // 🛡️ القبيلتان (اسم/أعضاء/شيخ) تُشتقّان بالكامل من سجلّ Alliance الحقيقي
        // على الخادم — العميل يرسل فقط allianceId المستهدف، وليس أي بيانات عضوية.
        const myAlliance = getMyAlliance(username);
        if (!myAlliance) return { error: "not_in_alliance" };
        const enemyAlliance = deps.getAlliance ? deps.getAlliance(msg.defenderAllianceId) : null;
        if (!enemyAlliance) return { error: "invalid_target_alliance" };

        const attackerInfo = {
          name: myAlliance.name,
          leader: username,
          members: myAlliance.members.map(m => m.username),
          power: 0,
        };
        const defenderInfo = {
          name: enemyAlliance.name,
          leader: enemyAlliance.createdBy,
          members: enemyAlliance.members.map(m => m.username),
          power: 0,
        };
        return declareWar(username, attackerInfo, defenderInfo, myAlliance.id, enemyAlliance.id);
      }

      case "war_deploy": {
        if (!username) return { error: "auth_required" };
        return deployArmy(username, msg.warId, msg.armyCount || 0, msg.armyPower || 0, msg.side);
      }

      case "war_resolve_battle": {
        if (!username) return { error: "auth_required" };
        return resolveBattle(msg.warId, msg.attackerName, msg.attackerPower, msg.defenderName, msg.defenderPower);
      }

      case "war_end": {
        if (!username) return { error: "auth_required" };
        return endWar(msg.warId, msg.reason);
      }

      case "war_get_active": {
        return { wars: getActiveWars().map(w => _summarizeWar(w)) };
      }

      case "war_get_history": {
        return { history: getWarHistory() };
      }

      case "war_get_rankings": {
        return { rankings: getRankings() };
      }

      default:
        return null;
    }
  }

  function _summarizeWar(war) {
    return {
      id: war.id,
      attacker: war.attacker.name,
      defender: war.defender.name,
      attackerScore: war.attacker.score,
      defenderScore: war.defender.score,
      attackerPower: war.attacker.power,
      defenderPower: war.defender.power,
      attackerLoot: war.attacker.coinPool,
      defenderLoot: war.defender.coinPool,
      status: war.status,
      endsAt: war.endsAt,
      battles: war.battles.slice(-5),
      log: war.log.slice(-10),
    };
  }

  return {
    declareWar,
    deployArmy,
    resolveBattle,
    endWar,
    getActiveWars,
    getWarHistory,
    getRankings,
    getWarById,
    handleMessage,
    warTickInterval,
  };
}

module.exports = { createWarManager, WAR_DURATION_MS, WAR_COOLDOWN_MS, LOOT_CAP_RATIO };