import { describe, it, expect, beforeEach } from 'vitest';
import { createAllianceManager } from '../server/logic/allianceManager.js';

// 🛡️ يستخدم createAllianceManager الحقيقي من server/logic/allianceManager.js
// (وليس محاكاة منفصلة) — تبعيات الحفظ (saveAlliance/getAlliance/...) هنا هي
// نُسخ بسيطة في الذاكرة (وليست SQLite/Mongo الحقيقية، التي تُختبر بشكل منفصل
// في tests/alliance-persistence.test.js)، لكن كل منطق العضوية/الرتب/الصلاحيات
// يعمل هنا فعلياً كما سيعمل في الإنتاج.

const TRIBAL_RANKS = [
  { id: "shaykh",  name: "شيخ القبيلة", icon: "⚜️", authority: 3 },
  { id: "warrior", name: "محارب",       icon: "🗡️", authority: 2 },
  { id: "member",  name: "عضو",         icon: "🤝", authority: 1 },
  { id: "novice",  name: "مستجِدّ",     icon: "🏜️", authority: 0 },
];
function getRank(rankId) {
  return TRIBAL_RANKS.find(r => r.id === rankId) || TRIBAL_RANKS[3];
}

function createTestEnv() {
  const worldClients = new Map();
  const memStore = new Map();
  const allianceStore = new Map();
  let idCounter = 0;

  function getDefaultPlayer(username) {
    return { username, gold: 0, army_power: 5000, allianceId: "" };
  }

  function createAllianceRecord(name, banner, createdBy) {
    idCounter++;
    return {
      id: "alliance_test_" + idCounter,
      name: String(name).trim().slice(0, 30),
      banner: typeof banner === "string" && banner.length <= 4 ? banner : "🏕️",
      level: 0,
      treasury: 0,
      createdAt: Date.now(),
      createdBy,
      members: [{ username: createdBy, rank: "shaykh", contribution: 0, joinedAt: Date.now() }],
      pendingRequests: [],
    };
  }

  async function saveAlliance(record) {
    allianceStore.set(record.id, record);
  }
  function getAlliance(id) { return allianceStore.get(id) || null; }
  function nameTaken(name) {
    const q = String(name).trim().toLowerCase();
    return Array.from(allianceStore.values()).some(a => a.name.toLowerCase() === q);
  }
  function getAllianceIdByName(name) {
    const q = String(name).trim().toLowerCase();
    const found = Array.from(allianceStore.values()).find(a => a.name.toLowerCase() === q);
    return found ? found.id : null;
  }
  function searchAlliancesByName(query, limit = 20) {
    const q = String(query).trim().toLowerCase();
    if (!q) return [];
    return Array.from(allianceStore.values()).filter(a => a.name.toLowerCase().includes(q)).slice(0, limit);
  }
  async function deleteAlliance(id) { allianceStore.delete(id); }

  function markDirty() {}

  const manager = createAllianceManager({
    worldClients, memStore, markDirty, getDefaultPlayer,
    TRIBAL_RANKS, getRank, createAllianceRecord, saveAlliance, getAlliance,
    getAllianceIdByName, nameTaken, searchAlliancesByName, deleteAlliance,
  });

  return { worldClients, memStore, allianceStore, manager };
}

function addClient(worldClients, memStore, username, armyPower, gold = 0) {
  worldClients.set(username, { username, army_power: armyPower, ws: { readyState: 1, send: () => {} } });
  memStore.set(username, { username, gold, army_power: armyPower, allianceId: "" });
}

describe('🏜️ نظام التحالف الحقيقي (server/logic/allianceManager.js)', () => {
  let worldClients, memStore, allianceStore, manager;

  beforeEach(() => {
    ({ worldClients, memStore, allianceStore, manager } = createTestEnv());
  });

  describe('الإنشاء والبحث', () => {
    it('ينشئ تحالفاً جديداً ويجعل المُنشئ شيخاً', async () => {
      addClient(worldClients, memStore, "founder1", 1000);
      const result = await manager.create("founder1", "قبيلة الصحراء", "🏜️");
      expect(result.ok).toBe(true);
      expect(result.alliance.members).toHaveLength(1);
      expect(result.alliance.members[0].username).toBe("founder1");
      expect(result.alliance.members[0].rank).toBe("shaykh");
      expect(memStore.get("founder1").allianceId).toBe(result.allianceId);
    });

    it('يرفض إنشاء تحالف لاعب منضم بالفعل لتحالف آخر', async () => {
      addClient(worldClients, memStore, "p1", 1000);
      await manager.create("p1", "التحالف الأول");
      const result2 = await manager.create("p1", "التحالف الثاني");
      expect(result2.ok).toBe(false);
      expect(result2.reason).toBe("already_in_alliance");
    });

    it('يرفض اسماً مكرراً (منع تصادم لاعبين بنفس الاسم)', async () => {
      addClient(worldClients, memStore, "p1", 1000);
      addClient(worldClients, memStore, "p2", 1000);
      await manager.create("p1", "قبيلة الصحراء");
      const result2 = await manager.create("p2", "قبيلة الصحراء");
      expect(result2.ok).toBe(false);
      expect(result2.reason).toBe("name_taken");
    });

    it('البحث يعيد قوة القبيلة الحقيقية المجمّعة من worldClients', async () => {
      addClient(worldClients, memStore, "p1", 3000);
      const created = await manager.create("p1", "قبيلة القوة");
      const results = manager.search("قبيلة القوة");
      expect(results).toHaveLength(1);
      expect(results[0].tribePower).toBe(3000);
      expect(results[0].id).toBe(created.allianceId);
    });
  });

  describe('طلب الانضمام والموافقة', () => {
    it('طلب انضمام صحيح يظهر في pendingRequests', async () => {
      addClient(worldClients, memStore, "shaykh1", 1000);
      addClient(worldClients, memStore, "newbie1", 500);
      const created = await manager.create("shaykh1", "قبيلة الترحيب");
      const reqResult = await manager.requestJoin("newbie1", created.allianceId);
      expect(reqResult.ok).toBe(true);
      const alliance = manager.summarize(manager.getMyAlliance("shaykh1"));
      expect(alliance.pendingRequests).toHaveLength(1);
      expect(alliance.pendingRequests[0].username).toBe("newbie1");
    });

    it('يرفض طلب انضمام مكرر من نفس اللاعب', async () => {
      addClient(worldClients, memStore, "shaykh1", 1000);
      addClient(worldClients, memStore, "newbie1", 500);
      const created = await manager.create("shaykh1", "قبيلة الترحيب");
      await manager.requestJoin("newbie1", created.allianceId);
      const result2 = await manager.requestJoin("newbie1", created.allianceId);
      expect(result2.ok).toBe(false);
      expect(result2.reason).toBe("request_already_pending");
    });

    it('الشيخ يوافق على الطلب فيصبح اللاعب عضواً حقيقياً برتبة مستجِدّ', async () => {
      addClient(worldClients, memStore, "shaykh1", 1000);
      addClient(worldClients, memStore, "newbie1", 500);
      const created = await manager.create("shaykh1", "قبيلة الترحيب");
      await manager.requestJoin("newbie1", created.allianceId);
      const approveResult = await manager.respondToRequest("shaykh1", created.allianceId, "newbie1", true);
      expect(approveResult.ok).toBe(true);

      const alliance = manager.getMyAlliance("newbie1");
      expect(alliance).toBeTruthy();
      expect(alliance.id).toBe(created.allianceId);
      const member = alliance.members.find(m => m.username === "newbie1");
      expect(member.rank).toBe("novice");
      expect(memStore.get("newbie1").allianceId).toBe(created.allianceId);
    });

    it('عضو عادي (غير شيخ) لا يستطيع الموافقة على طلبات الانضمام', async () => {
      addClient(worldClients, memStore, "shaykh1", 1000);
      addClient(worldClients, memStore, "warrior1", 800);
      addClient(worldClients, memStore, "newbie1", 500);
      const created = await manager.create("shaykh1", "قبيلة الصرامة");
      await manager.requestJoin("warrior1", created.allianceId);
      await manager.respondToRequest("shaykh1", created.allianceId, "warrior1", true);
      await manager.requestJoin("newbie1", created.allianceId);

      const rejected = await manager.respondToRequest("warrior1", created.allianceId, "newbie1", true);
      expect(rejected.ok).toBe(false);
      expect(rejected.reason).toBe("not_authorized");
    });

    it('رفض الطلب يزيله من القائمة بلا ضم', async () => {
      addClient(worldClients, memStore, "shaykh1", 1000);
      addClient(worldClients, memStore, "newbie1", 500);
      const created = await manager.create("shaykh1", "قبيلة الرفض");
      await manager.requestJoin("newbie1", created.allianceId);
      const result = await manager.respondToRequest("shaykh1", created.allianceId, "newbie1", false);
      expect(result.ok).toBe(true);
      expect(memStore.get("newbie1").allianceId).toBe("");
      const alliance = manager.getMyAlliance("shaykh1");
      expect(alliance.pendingRequests).toHaveLength(0);
      expect(alliance.members).toHaveLength(1);
    });

    it('لا يمكن الانضمام لتحالف ثانٍ أثناء وجود عضوية حالية', async () => {
      addClient(worldClients, memStore, "shaykh1", 1000);
      addClient(worldClients, memStore, "shaykh2", 1000);
      addClient(worldClients, memStore, "p1", 500);
      const alliance1 = await manager.create("shaykh1", "التحالف الأول");
      const alliance2 = await manager.create("shaykh2", "التحالف الثاني");
      await manager.requestJoin("p1", alliance1.allianceId);
      await manager.respondToRequest("shaykh1", alliance1.allianceId, "p1", true);

      const result2 = await manager.requestJoin("p1", alliance2.allianceId);
      expect(result2.ok).toBe(false);
      expect(result2.reason).toBe("already_in_alliance");
    });
  });

  describe('الرتب والطرد والمغادرة', () => {
    async function setupAllianceWithMember() {
      addClient(worldClients, memStore, "shaykh1", 1000);
      addClient(worldClients, memStore, "member1", 500);
      const created = await manager.create("shaykh1", "قبيلة الاختبار");
      await manager.requestJoin("member1", created.allianceId);
      await manager.respondToRequest("shaykh1", created.allianceId, "member1", true);
      return created;
    }

    it('الشيخ يستطيع ترقية عضو', async () => {
      const created = await setupAllianceWithMember();
      const result = await manager.changeRank("shaykh1", created.allianceId, "member1", "promote");
      expect(result.ok).toBe(true);
      const alliance = manager.getMyAlliance("member1");
      const m = alliance.members.find(mm => mm.username === "member1");
      expect(m.rank).toBe("member");
    });

    it('عضو عادي لا يستطيع ترقية نفسه', async () => {
      const created = await setupAllianceWithMember();
      const result = await manager.changeRank("member1", created.allianceId, "member1", "promote");
      expect(result.ok).toBe(false);
      expect(result.reason).toBe("not_authorized");
    });

    it('الشيخ يستطيع طرد عضو', async () => {
      const created = await setupAllianceWithMember();
      const result = await manager.kick("shaykh1", created.allianceId, "member1");
      expect(result.ok).toBe(true);
      expect(memStore.get("member1").allianceId).toBe("");
      const alliance = manager.getMyAlliance("shaykh1");
      expect(alliance.members).toHaveLength(1);
    });

    it('لا يمكن طرد النفس (يجب استخدام المغادرة)', async () => {
      const created = await setupAllianceWithMember();
      const result = await manager.kick("shaykh1", created.allianceId, "shaykh1");
      expect(result.ok).toBe(false);
      expect(result.reason).toBe("use_leave_instead");
    });

    it('عضو يغادر التحالف بنفسه', async () => {
      const created = await setupAllianceWithMember();
      const result = await manager.leave("member1");
      expect(result.ok).toBe(true);
      expect(memStore.get("member1").allianceId).toBe("");
      const alliance = manager.getMyAlliance("shaykh1");
      expect(alliance.members).toHaveLength(1);
    });

    it('عندما يغادر الشيخ الوحيد، يُرقّى عضو آخر تلقائياً ليصبح شيخاً', async () => {
      const created = await setupAllianceWithMember();
      await manager.leave("shaykh1");
      const alliance = manager.getMyAlliance("member1");
      expect(alliance).toBeTruthy();
      const newShaykh = alliance.members.find(m => m.username === "member1");
      expect(newShaykh.rank).toBe("shaykh");
    });

    it('آخر عضو يغادر يحذف التحالف بالكامل', async () => {
      addClient(worldClients, memStore, "solo1", 1000);
      const created = await manager.create("solo1", "قبيلة الوحيد");
      const result = await manager.leave("solo1");
      expect(result.ok).toBe(true);
      expect(allianceStore.has(created.allianceId)).toBe(false);
      expect(memStore.get("solo1").allianceId).toBe("");
    });
  });

  describe('الخزينة والترقية', () => {
    it('المساهمة تخصم الذهب من اللاعب وتضيفه لخزينة القبيلة', async () => {
      addClient(worldClients, memStore, "shaykh1", 1000, 500);
      const created = await manager.create("shaykh1", "قبيلة الخزينة");
      const result = await manager.contribute("shaykh1", created.allianceId, 200);
      expect(result.ok).toBe(true);
      expect(result.treasury).toBe(200);
      expect(memStore.get("shaykh1").gold).toBe(300);
    });

    it('يرفض المساهمة بذهب أكثر مما يملكه اللاعب', async () => {
      addClient(worldClients, memStore, "shaykh1", 1000, 50);
      const created = await manager.create("shaykh1", "قبيلة الفقر");
      const result = await manager.contribute("shaykh1", created.allianceId, 200);
      expect(result.ok).toBe(false);
      expect(result.reason).toBe("insufficient_gold");
      expect(memStore.get("shaykh1").gold).toBe(50); // لم يُخصم شيء
    });

    it('ترقية القبيلة من الخزينة أولاً إن كانت كافية', async () => {
      addClient(worldClients, memStore, "shaykh1", 1000, 500);
      const created = await manager.create("shaykh1", "قبيلة الترقية");
      await manager.contribute("shaykh1", created.allianceId, 150);
      const result = await manager.upgrade("shaykh1", created.allianceId, true);
      expect(result.ok).toBe(true);
      expect(result.level).toBe(1);
      const alliance = manager.getMyAlliance("shaykh1");
      expect(alliance.treasury).toBe(50); // 150 - 100 (تكلفة المستوى 1)
    });

    it('عضو عادي لا يستطيع ترقية القبيلة', async () => {
      addClient(worldClients, memStore, "shaykh1", 1000);
      addClient(worldClients, memStore, "member1", 500);
      const created = await manager.create("shaykh1", "قبيلة الصرامة");
      await manager.requestJoin("member1", created.allianceId);
      await manager.respondToRequest("shaykh1", created.allianceId, "member1", true);
      const result = await manager.upgrade("member1", created.allianceId, true);
      expect(result.ok).toBe(false);
      expect(result.reason).toBe("not_authorized");
    });
  });

  describe('getTribePower — أمنية العضوية', () => {
    it('تجمع قوة كل الأعضاء المتصلين فقط بعد موافقة حقيقية', async () => {
      addClient(worldClients, memStore, "shaykh1", 3000);
      addClient(worldClients, memStore, "member1", 7000);
      addClient(worldClients, memStore, "outsider1", 999999); // لا علاقة له بهذا التحالف
      const created = await manager.create("shaykh1", "قبيلة القوة الحقيقية");
      await manager.requestJoin("member1", created.allianceId);
      await manager.respondToRequest("shaykh1", created.allianceId, "member1", true);

      const power = manager.getTribePower(created.allianceId);
      expect(power).toBe(10000); // 3000 + 7000، وليس 999999 (outsider1 خارج العضوية تماماً)
    });

    it('طلب انضمام معلَّق (غير موافَق عليه) لا يُحتسب في القوة', async () => {
      addClient(worldClients, memStore, "shaykh1", 3000);
      addClient(worldClients, memStore, "pending1", 999999);
      const created = await manager.create("shaykh1", "قبيلة الانتظار");
      await manager.requestJoin("pending1", created.allianceId);

      const power = manager.getTribePower(created.allianceId);
      expect(power).toBe(3000); // pending1 لم يُقبَل بعد
    });
  });

  describe('handleMessage — واجهة WebSocket', () => {
    it('alliance_create عبر handleMessage', async () => {
      addClient(worldClients, memStore, "p1", 1000);
      const result = await manager.handleMessage({ type: "alliance_create", name: "قبيلة الرسائل" }, "p1", null);
      expect(result.ok).toBe(true);
      expect(result.allianceId).toBeTruthy();
    });

    it('alliance_get_mine يعيد null لمن لا ينتمي لأي تحالف', async () => {
      addClient(worldClients, memStore, "loner1", 1000);
      const result = await manager.handleMessage({ type: "alliance_get_mine" }, "loner1", null);
      expect(result.alliance).toBeNull();
    });

    it('يرفض أي رسالة alliance_* بلا مصادقة (username فارغ)', async () => {
      const result = await manager.handleMessage({ type: "alliance_create", name: "X" }, null, null);
      expect(result.ok).toBe(false);
      expect(result.reason).toBe("auth_required");
    });
  });
});
