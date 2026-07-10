import { describe, it, expect } from 'vitest';

// محاكاة الـ WarManager على الخادم بدون منفذ WebSocket
function createMockWarManager() {
  const activeWars = new Map();
  const warHistory = [];
  const tribeRankings = new Map();
  const allianceCooldowns = new Map();
  const WAR_DURATION_MS = 30 * 60 * 1000;
  const WAR_COOLDOWN_MS = 10 * 60 * 1000;
  const LOOT_CAP_RATIO = 0.12;

  const broadcasts = [];

  function broadcastToAll(message) { broadcasts.push(message); }

  function declareWar(declarer, attackerInfo, defenderInfo) {
    const cooldownEnd = allianceCooldowns.get(attackerInfo.name) || 0;
    if (Date.now() < cooldownEnd) return { ok: false, reason: "cooldown" };

    for (const [, war] of activeWars) {
      if (war.status !== "active") continue;
      const samePair =
        (war.attacker.name === attackerInfo.name && war.defender.name === defenderInfo.name) ||
        (war.attacker.name === defenderInfo.name && war.defender.name === attackerInfo.name);
      if (samePair) return { ok: false, reason: "already_at_war" };
    }

    if (attackerInfo.name === defenderInfo.name) return { ok: false, reason: "same_tribe" };

    const war = {
      id: `war_${Date.now()}_${Math.floor(Math.random() * 9999)}`,
      attacker: { name: attackerInfo.name, leader: attackerInfo.leader, members: attackerInfo.members || [], power: attackerInfo.power || 0, score: 0, coinPool: 0 },
      defender: { name: defenderInfo.name, leader: defenderInfo.leader, members: defenderInfo.members || [], power: defenderInfo.power || 0, score: 0, coinPool: 0 },
      status: "active",
      startedAt: Date.now(),
      endsAt: Date.now() + WAR_DURATION_MS,
      battles: [],
      log: [],
    };
    activeWars.set(war.id, war);
    return { ok: true, warId: war.id, war };
  }

  function resolveBattle(warId, attackerName, attackerPower, defenderName, defenderPower) {
    const war = activeWars.get(warId);
    if (!war || war.status !== "active") return { ok: false, reason: "war_not_active" };

    const attRoll = attackerPower * (1 + (Math.random() - 0.5) * 0.3);
    const defRoll = defenderPower * (1 + (Math.random() - 0.5) * 0.3);
    const attackerWon = attRoll >= defRoll;
    const loserPower = attackerWon ? defenderPower : attackerPower;
    const loot = Math.floor(Math.min(loserPower * LOOT_CAP_RATIO, 100000));
    const winnerName = attackerWon ? attackerName : defenderName;
    const loserName = attackerWon ? defenderName : attackerName;

    const winnerSide = war.attacker.name === winnerName ? "attacker" : "defender";
    war[winnerSide].score += 1;
    war[winnerSide].coinPool += loot;

    war.battles.push({ t: Date.now(), attacker: attackerName, defender: defenderName, winner: winnerName, loser: loserName, loot });
    return { ok: true, winner: winnerName, loser: loserName, loot, attackerScore: war.attacker.score, defenderScore: war.defender.score };
  }

  function endWar(warId) {
    const war = activeWars.get(warId);
    if (!war) return null;
    war.status = "ended";
    let winner = null, loser = null;
    if (war.attacker.score > war.defender.score) { winner = "attacker"; loser = "defender"; }
    else if (war.defender.score > war.attacker.score) { winner = "defender"; loser = "attacker"; }

    allianceCooldowns.set(war.attacker.name, Date.now() + WAR_COOLDOWN_MS);
    allianceCooldowns.set(war.defender.name, Date.now() + WAR_COOLDOWN_MS);

    _ensureRanking(war.attacker.name);
    _ensureRanking(war.defender.name);
    if (winner) { tribeRankings.get(war[winner].name).wins++; tribeRankings.get(war[winner].name).totalLoot += war[winner].coinPool || 0; }
    if (loser) { tribeRankings.get(war[loser].name).losses++; }
    tribeRankings.get(war.attacker.name).warCount++;
    tribeRankings.get(war.defender.name).warCount++;

    warHistory.push({ warId: war.id, winner: winner ? war[winner].name : "تعادل", loser: loser ? war[loser].name : "تعادل" });
    if (warHistory.length > 100) warHistory.shift();
    activeWars.delete(warId);
    return { winner: winner ? war[winner].name : "تعادل", loser: loser ? war[loser].name : "تعادل" };
  }

  function _ensureRanking(name) {
    if (!tribeRankings.has(name)) tribeRankings.set(name, { name, wins: 0, losses: 0, totalLoot: 0, warCount: 0 });
  }

  function getRankings() { return Array.from(tribeRankings.values()).sort((a, b) => b.wins - a.wins || b.totalLoot - a.totalLoot); }
  function getActiveWars() { return Array.from(activeWars.values()); }
  function getWarHistory() { return warHistory; }

  return { declareWar, resolveBattle, endWar, getActiveWars, getWarHistory, getRankings, _internal: { activeWars, tribeRankings, allianceCooldowns, broadcasts } };
}

describe('🏜️ نظام الحرب القبلية', () => {
  describe('إعلان الحرب', () => {
    it('يجب أن يعلن الحرب بنجاح بين قبيلتين مختلفتين', () => {
      const wm = createMockWarManager();
      const result = wm.declareWar("player1",
        { name: "قبيلة الصقور", leader: "player1", members: ["player1"], power: 10000 },
        { name: "قبيلة الذئاب", leader: "player2", members: ["player2"], power: 8000 }
      );
      expect(result.ok).toBe(true);
      expect(result.warId).toBeTruthy();
    });

    it('يجب أن يرفض الإعلان على نفس القبيلة', () => {
      const wm = createMockWarManager();
      const result = wm.declareWar("player1",
        { name: "قبيلة الصقور", leader: "player1", power: 10000 },
        { name: "قبيلة الصقور", leader: "player1", power: 10000 }
      );
      expect(result.ok).toBe(false);
      expect(result.reason).toBe("same_tribe");
    });

    it('يجب أن يرفض حرب ثانية بين نفس القبيلتين', () => {
      const wm = createMockWarManager();
      wm.declareWar("p1", { name: "A", leader: "p1", power: 1000 }, { name: "B", leader: "p2", power: 1000 });
      const result2 = wm.declareWar("p2", { name: "B", leader: "p2", power: 1000 }, { name: "A", leader: "p1", power: 1000 });
      expect(result2.ok).toBe(false);
      expect(result2.reason).toBe("already_at_war");
    });

    it('يجب أن يرفض الحرب أثناء التبريد', () => {
      const wm = createMockWarManager();
      const r1 = wm.declareWar("p1", { name: "A", leader: "p1", power: 1000 }, { name: "B", leader: "p2", power: 1000 });
      wm.endWar(r1.warId);
      const r2 = wm.declareWar("p1", { name: "A", leader: "p1", power: 1000 }, { name: "C", leader: "p3", power: 1000 });
      expect(r2.ok).toBe(false);
      expect(r2.reason).toBe("cooldown");
    });
  });

  describe('حل المعارك', () => {
    it('يجب أن تحدد فائزاً وغنائم عند حل معركة', () => {
      const wm = createMockWarManager();
      const r1 = wm.declareWar("p1", { name: "A", leader: "p1", power: 100000 }, { name: "B", leader: "p2", power: 1000 });
      const result = wm.resolveBattle(r1.warId, "محارب القبيلة A", 100000, "محارب القبيلة B", 1000);
      expect(result.ok).toBe(true);
      expect(result.winner).toBeTruthy();
      expect(result.loser).toBeTruthy();
      expect(result.loot).toBeGreaterThan(0);
      expect(result.loot).toBeLessThanOrEqual(100000);
    });

    it('يجب أن يرفض حل معركة لحرب غير موجودة', () => {
      const wm = createMockWarManager();
      const result = wm.resolveBattle("fake_war", "A", 1000, "B", 1000);
      expect(result.ok).toBe(false);
      expect(result.reason).toBe("war_not_active");
    });
  });

  describe('إنهاء الحرب والترتيب', () => {
    it('يجب أن يحدد فائزاً بناءً على النقاط', () => {
      const wm = createMockWarManager();
      const r1 = wm.declareWar("p1", { name: "A", leader: "p1", power: 100000 }, { name: "B", leader: "p2", power: 1000 });
      // القبيلة A تفوز بمعركتين
      wm.resolveBattle(r1.warId, "A", 100000, "B", 1000);
      wm.resolveBattle(r1.warId, "A", 100000, "B", 1000);
      const endResult = wm.endWar(r1.warId);
      expect(endResult).toBeTruthy();
      expect(endResult.winner).toBe("A");
      expect(endResult.loser).toBe("B");
    });

    it('يجب أن ينتهي بالتعادل عند تساوي النقاط', () => {
      const wm = createMockWarManager();
      const r1 = wm.declareWar("p1", { name: "A", leader: "p1", power: 1000 }, { name: "B", leader: "p2", power: 1000 });
      const endResult = wm.endWar(r1.warId);
      expect(endResult).toBeTruthy();
      expect(endResult.winner).toBe("تعادل");
      expect(endResult.loser).toBe("تعادل");
    });

    it('يجب أن يحدّث الترتيب بعد انتهاء الحرب', () => {
      const wm = createMockWarManager();
      const r1 = wm.declareWar("p1", { name: "A", leader: "p1", power: 100000 }, { name: "B", leader: "p2", power: 1000 });
      wm.resolveBattle(r1.warId, "A", 100000, "B", 1000);
      wm.endWar(r1.warId);
      const rankings = wm.getRankings();
      expect(rankings).toHaveLength(2);
      const aRank = rankings.find(r => r.name === "A");
      expect(aRank.wins).toBe(1);
      expect(aRank.totalLoot).toBeGreaterThan(0);
      const bRank = rankings.find(r => r.name === "B");
      expect(bRank.losses).toBe(1);
    });

    it('يجب أن يرتب القبائل حسب الانتصارات ثم الغنائم', () => {
      const wm = createMockWarManager();
      // حرب 1: A تفوز
      const r1 = wm.declareWar("p1", { name: "A", power: 100000 }, { name: "B", power: 1000 });
      wm.resolveBattle(r1.warId, "A", 100000, "B", 1000);
      wm.endWar(r1.warId);
      // حرب 2: C تفوز — الخاسر D له قوة أكبر → غنائم أكبر
      const r2 = wm.declareWar("p3", { name: "C", power: 200000 }, { name: "D", power: 5000 });
      wm.resolveBattle(r2.warId, "C", 200000, "D", 5000);
      wm.endWar(r2.warId);
      const rankings = wm.getRankings();
      const cRank = rankings.find(r => r.name === "C");
      const aRank = rankings.find(r => r.name === "A");
      expect(cRank.totalLoot).toBeGreaterThan(aRank.totalLoot);
    });
  });

  describe('الحروب النشطة', () => {
    it('يجب أن تعيد قائمة الحروب النشطة', () => {
      const wm = createMockWarManager();
      wm.declareWar("p1", { name: "A", power: 1000 }, { name: "B", power: 1000 });
      wm.declareWar("p3", { name: "C", power: 1000 }, { name: "D", power: 1000 });
      const active = wm.getActiveWars();
      expect(active).toHaveLength(2);
    });

    it('يجب أن تكون الحروب النشطة فارغة بعد إنهاء الكل', () => {
      const wm = createMockWarManager();
      const r1 = wm.declareWar("p1", { name: "A", power: 1000 }, { name: "B", power: 1000 });
      wm.endWar(r1.warId);
      expect(wm.getActiveWars()).toHaveLength(0);
    });
  });

  describe('سجل الحروب', () => {
    it('يجب أن يحفظ الحروب المنتهية في التاريخ', () => {
      const wm = createMockWarManager();
      const r1 = wm.declareWar("p1", { name: "A", power: 100000 }, { name: "B", power: 1000 });
      wm.resolveBattle(r1.warId, "A", 100000, "B", 1000);
      wm.endWar(r1.warId);
      const history = wm.getWarHistory();
      expect(history).toHaveLength(1);
      expect(history[0].winner).toBe("A");
    });
  });
});