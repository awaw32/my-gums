import { describe, it, expect, beforeEach } from 'vitest';
import { createWarManager } from '../server/logic/warManager.js';

// 🛡️ يستخدم createWarManager الحقيقي من server/logic/warManager.js (وليس محاكاة
// منفصلة) — يضمن أن هذه الاختبارات تعكس فعلياً السلوك الحي على الخادم، بما في
// ذلك قراءة قوة اللاعبين من worldClients الموثوقة بدل رسالة العميل (مكافحة الغش).
function createTestEnv() {
  const worldClients = new Map();
  // 🏜️ محاكاة بسيطة لخريطة allianceId -> [أعضاء]، تُستخدم فقط لحساب getTribePower
  // في هذه الاختبارات — التحقق الفعلي من allianceManager.js الحقيقي يقع في
  // tests/alliance-manager.test.js المنفصل.
  const allianceMembers = new Map(); // allianceId -> [usernames]
  function getTribePower(allianceId) {
    const members = allianceMembers.get(allianceId) || [];
    let power = 0;
    for (const u of members) power += worldClients.get(u)?.army_power || 0;
    return power;
  }
  return { worldClients, allianceMembers, getTribePower };
}

function addClient(worldClients, username, armyPower) {
  worldClients.set(username, {
    username,
    army_power: armyPower,
    ws: { readyState: 1, send: () => {} },
  });
}

describe('🏜️ نظام الحرب القبلية (server/logic/warManager.js الحقيقي)', () => {
  let worldClients, allianceMembers, getTribePower, wm;

  beforeEach(() => {
    ({ worldClients, allianceMembers, getTribePower } = createTestEnv());
    wm = createWarManager({ worldClients, broadcastChat: null, memStore: new Map(), getTribePower });
  });

  describe('إعلان الحرب', () => {
    it('يجب أن يعلن الحرب بنجاح بين قبيلتين مختلفتين', () => {
      const result = wm.declareWar("player1",
        { name: "قبيلة الصقور", leader: "player1", members: ["player1"], power: 10000 },
        { name: "قبيلة الذئاب", leader: "player2", members: ["player2"], power: 8000 },
        "alliance_hawks", "alliance_wolves"
      );
      expect(result.ok).toBe(true);
      expect(result.warId).toBeTruthy();
    });

    it('يجب أن يرفض الإعلان على نفس القبيلة', () => {
      const result = wm.declareWar("player1",
        { name: "قبيلة الصقور", leader: "player1", power: 10000 },
        { name: "قبيلة الصقور", leader: "player1", power: 10000 },
        "alliance_hawks", "alliance_hawks"
      );
      expect(result.ok).toBe(false);
      expect(result.reason).toBe("same_tribe");
    });

    it('يجب أن يرفض حرب ثانية بين نفس القبيلتين', () => {
      wm.declareWar("p1", { name: "A", leader: "p1", power: 1000 }, { name: "B", leader: "p2", power: 1000 }, "alliance_a", "alliance_b");
      const result2 = wm.declareWar("p2", { name: "B", leader: "p2", power: 1000 }, { name: "A", leader: "p1", power: 1000 }, "alliance_b", "alliance_a");
      expect(result2.ok).toBe(false);
      expect(result2.reason).toBe("already_at_war");
    });

    it('يجب أن يرفض الحرب أثناء التبريد', () => {
      const r1 = wm.declareWar("p1", { name: "A", leader: "p1", power: 1000 }, { name: "B", leader: "p2", power: 1000 }, "alliance_a", "alliance_b");
      wm.endWar(r1.warId);
      const r2 = wm.declareWar("p1", { name: "A", leader: "p1", power: 1000 }, { name: "C", leader: "p3", power: 1000 }, "alliance_a", "alliance_c");
      expect(r2.ok).toBe(false);
      expect(r2.reason).toBe("cooldown");
    });

    it('يجب أن تُحسب قوة القبيلة من worldClients الموثوقة وليس من رسالة العميل', () => {
      addClient(worldClients, "p1", 3000);
      addClient(worldClients, "p2", 7000);
      allianceMembers.set("alliance_test", ["p1", "p2"]);
      const result = wm.declareWar("p1",
        { name: "قبيلة الاختبار", leader: "p1", members: ["p1", "p2"], power: 999999999 }, // مزيفة
        { name: "قبيلة أخرى", leader: "p3", members: ["p3"], power: 1 }, // مزيفة
        "alliance_test", "alliance_other"
      );
      expect(result.ok).toBe(true);
      // القوة الحقيقية: 3000+7000=10000 من عضوية alliance_test الفعلية، وليس القيمة المزيفة 999999999
      expect(result.war.attacker.power).toBe(10000);
      // alliance_other بلا أعضاء مسجَّلين هنا → صفر بأمان
      expect(result.war.defender.power).toBe(0);
    });
  });

  describe('حل المعارك', () => {
    it('يجب أن تحدد فائزاً وغنائم عند حل معركة بين لاعبَين حقيقيَّين', () => {
      addClient(worldClients, "warriorA", 100000);
      addClient(worldClients, "warriorB", 1000);
      const r1 = wm.declareWar("warriorA", { name: "A", leader: "warriorA", power: 100000 }, { name: "B", leader: "warriorB", power: 1000 });
      const result = wm.resolveBattle(r1.warId, "warriorA", 999999 /* مزيفة، يجب تجاهلها */, "warriorB", 1 /* مزيفة */);
      expect(result.ok).toBe(true);
      expect(result.winner).toBeTruthy();
      expect(result.loser).toBeTruthy();
      expect(result.loot).toBeGreaterThan(0);
      expect(result.loot).toBeLessThanOrEqual(100000);
      // القوة الحقيقية لـ warriorA (100000) أكبر بكثير من warriorB (1000) — يجب أن يفوز غالباً
      expect(result.attackerPower).toBe(100000);
      expect(result.defenderPower).toBe(1000);
    });

    it('يجب أن يرفض حل معركة لحرب غير موجودة', () => {
      const result = wm.resolveBattle("fake_war", "A", 1000, "B", 1000);
      expect(result.ok).toBe(false);
      expect(result.reason).toBe("war_not_active");
    });

    it('يجب أن يرفض حل معركة للاعبين غير متصلين (worldClients)', () => {
      const r1 = wm.declareWar("p1", { name: "A", leader: "p1", power: 1000 }, { name: "B", leader: "p2", power: 1000 });
      const result = wm.resolveBattle(r1.warId, "p1_not_connected", 1000, "p2_not_connected", 1000);
      expect(result.ok).toBe(false);
      expect(result.reason).toBe("player_not_found");
    });
  });

  describe('إنهاء الحرب والترتيب', () => {
    it('يجب أن يحدد فائزاً بناءً على النقاط', () => {
      addClient(worldClients, "warriorA", 100000);
      addClient(worldClients, "warriorB", 1000);
      const r1 = wm.declareWar("warriorA", { name: "A", leader: "warriorA", members: ["warriorA"], power: 100000 }, { name: "B", leader: "warriorB", members: ["warriorB"], power: 1000 });
      // القبيلة A تفوز بمعركتين (قوة warriorA الحقيقية أكبر بكثير)
      wm.resolveBattle(r1.warId, "warriorA", 100000, "warriorB", 1000);
      wm.resolveBattle(r1.warId, "warriorA", 100000, "warriorB", 1000);
      const endResult = wm.endWar(r1.warId);
      expect(endResult).toBeTruthy();
      expect(endResult.winner).toBe("A");
      expect(endResult.loser).toBe("B");
    });

    it('يجب أن ينتهي بالتعادل عند تساوي النقاط', () => {
      const r1 = wm.declareWar("p1", { name: "A", leader: "p1", power: 1000 }, { name: "B", leader: "p2", power: 1000 });
      const endResult = wm.endWar(r1.warId);
      expect(endResult).toBeTruthy();
      expect(endResult.winner).toBe("تعادل");
      expect(endResult.loser).toBe("تعادل");
    });

    it('يجب أن يحدّث الترتيب بعد انتهاء الحرب', () => {
      addClient(worldClients, "warriorA", 100000);
      addClient(worldClients, "warriorB", 1000);
      const r1 = wm.declareWar("warriorA", { name: "A", leader: "warriorA", members: ["warriorA"], power: 100000 }, { name: "B", leader: "warriorB", members: ["warriorB"], power: 1000 });
      wm.resolveBattle(r1.warId, "warriorA", 100000, "warriorB", 1000);
      wm.endWar(r1.warId);
      const rankings = wm.getRankings();
      expect(rankings.length).toBeGreaterThanOrEqual(2);
      const aRank = rankings.find(r => r.name === "A");
      expect(aRank.wins).toBe(1);
      expect(aRank.totalLoot).toBeGreaterThan(0);
      const bRank = rankings.find(r => r.name === "B");
      expect(bRank.losses).toBe(1);
    });

    it('يجب أن يرتب القبائل حسب الانتصارات ثم الغنائم', () => {
      addClient(worldClients, "wA", 100000);
      addClient(worldClients, "wB", 1000);
      addClient(worldClients, "wC", 200000);
      addClient(worldClients, "wD", 5000);
      // حرب 1: A تفوز
      const r1 = wm.declareWar("wA", { name: "A", leader: "wA", members: ["wA"], power: 100000 }, { name: "B", leader: "wB", members: ["wB"], power: 1000 });
      wm.resolveBattle(r1.warId, "wA", 100000, "wB", 1000);
      wm.endWar(r1.warId);
      // حرب 2: C تفوز — الخاسر D له قوة أكبر → غنائم أكبر
      const r2 = wm.declareWar("wC", { name: "C", leader: "wC", members: ["wC"], power: 200000 }, { name: "D", leader: "wD", members: ["wD"], power: 5000 });
      wm.resolveBattle(r2.warId, "wC", 200000, "wD", 5000);
      wm.endWar(r2.warId);
      const rankings = wm.getRankings();
      const cRank = rankings.find(r => r.name === "C");
      const aRank = rankings.find(r => r.name === "A");
      expect(cRank.totalLoot).toBeGreaterThan(aRank.totalLoot);
    });
  });

  describe('الحروب النشطة', () => {
    it('يجب أن تعيد قائمة الحروب النشطة', () => {
      wm.declareWar("p1", { name: "A", leader: "p1", power: 1000 }, { name: "B", leader: "p2", power: 1000 });
      wm.declareWar("p3", { name: "C", leader: "p3", power: 1000 }, { name: "D", leader: "p4", power: 1000 });
      const active = wm.getActiveWars();
      expect(active).toHaveLength(2);
    });

    it('يجب أن تكون الحروب النشطة فارغة بعد إنهاء الكل', () => {
      const r1 = wm.declareWar("p1", { name: "A", leader: "p1", power: 1000 }, { name: "B", leader: "p2", power: 1000 });
      wm.endWar(r1.warId);
      expect(wm.getActiveWars()).toHaveLength(0);
    });
  });

  describe('سجل الحروب', () => {
    it('يجب أن يحفظ الحروب المنتهية في التاريخ', () => {
      addClient(worldClients, "warriorA", 100000);
      addClient(worldClients, "warriorB", 1000);
      const r1 = wm.declareWar("warriorA", { name: "A", leader: "warriorA", members: ["warriorA"], power: 100000 }, { name: "B", leader: "warriorB", members: ["warriorB"], power: 1000 });
      wm.resolveBattle(r1.warId, "warriorA", 100000, "warriorB", 1000);
      wm.endWar(r1.warId);
      const history = wm.getWarHistory();
      expect(history).toHaveLength(1);
      expect(history[0].winner).toBe("A");
    });
  });

  describe('🛡️ مكافحة الغش — قوة الحرب من worldClients فقط', () => {
    it('deployArmy يستخدم قوة اللاعب الحقيقية وليس القيمة المُرسلة', () => {
      addClient(worldClients, "leader1", 1500);
      const r1 = wm.declareWar("leader1", { name: "A", leader: "leader1", power: 1500 }, { name: "B", leader: "p2", power: 1000 });
      const result = wm.handleMessage(
        { type: "war_deploy", warId: r1.warId, armyCount: 8, armyPower: 999999999, side: "attacker" },
        "leader1",
        null
      );
      // 1500 * 0.01 = 15 نقطة فقط، وليس شيئاً متعلقاً بـ999999999
      expect(result.myScore).toBe(15);
    });

    it('resolveBattle عبر handleMessage يتجاهل القوة المزيفة في الرسالة تماماً', () => {
      addClient(worldClients, "weak1", 500);
      addClient(worldClients, "strong1", 999999);
      const r1 = wm.declareWar("weak1", { name: "A", leader: "weak1", power: 500 }, { name: "B", leader: "strong1", power: 999999 });
      let attackerWins = 0;
      const trials = 15;
      for (let i = 0; i < trials; i++) {
        const result = wm.handleMessage(
          { type: "war_resolve_battle", warId: r1.warId, attackerName: "weak1", attackerPower: 999999999, defenderName: "strong1", defenderPower: 1 },
          "weak1",
          null
        );
        if (result.winner === "weak1") attackerWins++;
      }
      // اللاعب الضعيف فعلياً (500) لا يجب أن يفوز رغم ادّعائه قوة مزيفة ضخمة
      expect(attackerWins).toBeLessThan(trials * 0.3);
    });
  });
});
