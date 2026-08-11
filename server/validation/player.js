"use strict";

const { z } = require("zod");

const WeaponSchema = z.object({
  id: z.string(),
  level: z.number().int().min(0).max(100).optional(),
  upgradeLevel: z.number().int().min(0).optional(),
  starLevel: z.number().int().min(1).max(10).optional(),
  gemLevel: z.number().int().min(1).max(10).optional(),
  name: z.string().max(100).optional(),
  icon: z.string().max(10).optional(),
  rarity: z.string().max(20).optional(),
  damage: z.number().min(0).optional(),
  speed: z.number().min(0).optional(),
  range: z.number().min(0).optional(),
});

const PlayerSaveSchema = z.object({
  cash: z.number().min(0).max(1e15).optional(),
  gems: z.number().min(0).max(1e15).optional(),
  gold: z.number().min(0).max(1e15).optional(),
  hammers: z.number().min(0).max(1e15).optional(),
  scrolls: z.number().min(0).max(1e15).optional(),
  food: z.number().min(0).max(1e15).optional(),
  water: z.number().min(0).max(1e15).optional(),
  salt: z.number().min(0).max(1e15).optional(),
  leather: z.number().min(0).max(1e15).optional(),
  copper: z.number().min(0).max(1e15).optional(),
  herbs: z.number().min(0).max(1e15).optional(),
  artifacts: z.number().min(0).max(1e15).optional(),
  desertGem: z.number().min(0).max(1e15).optional(),
  army_power: z.number().min(0).max(1e15).optional(),
  x_position: z.number().min(0).max(10000).optional(),
  y_position: z.number().min(0).max(10000).optional(),
  kills: z.number().int().min(0).max(1e9).optional(),
  last_active: z.number().int().positive().optional(),
  unitLevel: z.number().int().min(1).max(1000).optional(),
  trainingLevel: z.number().int().min(1).max(1000).optional(),
  weapons: z.array(WeaponSchema).max(50).optional(),
  equippedWeapon: z.string().max(100).optional(),
  armyYardLevel: z.number().int().min(1).max(100).optional(),
  knowledgeLevel: z.number().int().min(1).max(100).optional(),
  knowledgeType: z.enum(["economic", "military"]).optional(),
  buildings: z.record(z.any()).optional(),
  research: z.record(z.any()).optional(),
  xp: z.number().min(0).optional(),
  level: z.number().int().min(1).max(200).optional(),
  allianceLevel: z.number().int().min(0).max(100).optional(),
  upgrades: z.record(z.any()).optional(),
  oases: z.array(z.record(z.any())).max(100).optional(),
  prestigeLevel: z.number().int().min(0).max(100).optional(),
  achievements: z.any().optional(),
  allianceMissions: z.any().optional(),
  dailyLogin: z.record(z.any()).optional(),
  inventory: z.record(z.any()).optional(),
  // 🛡️ events.js يحفظ الآن {events:[...], weekKey} (لدعم دوران الأحداث
  // الأسبوعي)، بعد أن كان مصفوفة مسطّحة قديماً — نقبل الشكلين لتفادي رفض
  // كل عملية حفظ لأي لاعب (كان هذا يسبب فشل saveToDB الصامت بالكامل).
  events: z.union([
    z.array(z.any()).max(50),
    z.object({ events: z.array(z.any()).max(50).optional(), weekKey: z.number().optional() }),
  ]).optional(),
  tutorial: z.record(z.any()).optional(),
  story: z.record(z.any()).optional(),
  brWins: z.number().int().min(0).optional(),
  brKills: z.number().int().min(0).optional(),
  landsState: z.record(z.any()).optional(),
  hero: z.record(z.any()).optional(),
  loadout: z.record(z.any()).optional(),
  market: z.record(z.any()).optional(),
  reputation: z.object({ score: z.number().int().min(-10000).max(10000) }).optional(),
  multiplier: z.number().min(0).max(1000).optional(),
  researchTree: z.record(z.any()).optional(),
  completedVillages: z.array(z.string()).max(50).optional(),
  currentChapter: z.number().int().min(1).max(100).optional(),
  legendaryItems: z.array(z.string()).max(50).optional(),
  lastFoodDecayCheck: z.number().int().min(0).optional(),
  isNewPlayer: z.boolean().optional(),
  cosmetics: z.object({
    swordSkin: z.string().max(30).optional(),
    camelSkin: z.string().max(30).optional(),
    titleColor: z.string().max(30).optional(),
    owned: z.array(z.string()).max(100).optional(),
  }).optional(),
  seasonPass: z.object({
    seasonKey: z.number().int().min(0).optional(),
    premiumUnlocked: z.boolean().optional(),
  }).optional(),
}).strict();

function sanitizePlayerData(data) {
  const result = PlayerSaveSchema.safeParse(data);
  if (!result.success) {
    const issues = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(", ");
    throw new Error(`Validation failed: ${issues}`);
  }
  return result.data;
}

// التحقق من معدل تغير الموارد — يمنع الغش بزيادة مفاجئة
const RESOURCE_NAMES = ["cash", "gems", "gold", "hammers", "scrolls", "food", "water", "salt", "leather", "copper", "herbs", "artifacts", "desertGem"];
const MAX_RESOURCE_GAIN_PER_SEC = {
  cash: 5000, gems: 100, gold: 2000, hammers: 500, scrolls: 500, food: 5000,
  water: 1000, salt: 500, leather: 300, copper: 200, herbs: 200,
  artifacts: 50, desertGem: 10,
};

function validateResourceDelta(existing, incoming) {
  // تخطي التحقق لأول حفظ (لاعب جديد — لا توجد بيانات سابقة)
  if (!existing.last_active) return { ok: true };
  const now = Date.now();
  const lastTime = existing.last_active;
  const elapsedSec = Math.max(1, (now - lastTime) / 1000);
  for (const res of RESOURCE_NAMES) {
    if (incoming[res] === undefined) continue;
    const oldVal = existing[res] || 0;
    const newVal = incoming[res];
    const gain = newVal - oldVal;
    if (gain <= 0) continue;
    const maxGain = MAX_RESOURCE_GAIN_PER_SEC[res] * elapsedSec * (elapsedSec > 300 ? 5 : 1.5);
    if (gain > maxGain) {
      return { ok: false, reason: `${res} gain ${Math.floor(gain)} exceeds max ${Math.floor(maxGain)} in ${Math.floor(elapsedSec)}s` };
    }
  }
  return { ok: true };
}

// ═══════════════════════════════════════════════════════════════════
//  🛡️ مكافحة الغش — Prestige (js/prestige.js) لا مسار WS له، يُحسب محلياً
//  بالكامل ثم يُحفَظ عبر /api/players مباشرة. دالة مشتركة بين validateWeapons
//  Change وvalidateProgressionChange لتفادي رفض حفظة Prestige شرعية (تُصفِّر
//  مستويات الأسلحة إلى 0 كجزء طبيعي من إعادة التعيين) مع بقاء الحماية ضد أي
//  prestigeLevel مزيَّف لا يرافقه بلوغ فعلي للمستوى الأقصى.
// ═══════════════════════════════════════════════════════════════════
const PLAYER_MAX_LEVEL = 110; // مطابق تماماً لـ economy.maxLevel في js/economy.js

function isValidPrestigeTransition(existing, incoming) {
  const existingPrestige = existing.prestigeLevel || 0;
  return (
    incoming.prestigeLevel === existingPrestige + 1 &&
    (existing.level || 1) >= PLAYER_MAX_LEVEL &&
    incoming.level === 1
  );
}

// ═══════════════════════════════════════════════════════════════════
//  🛡️ مكافحة الغش — التحقق من تغييرات مصفوفة الأسلحة (weapons)
//  المسار الشرعي الوحيد لترقية سلاح مملوك هو رسالة WS "weapon_upgrade"
//  (applyWeaponUpgrade في weaponUpgrade.js، محقّقة بالفعل). هذا التحقق
//  يمنع أي محاولة لتعديل مستوى سلاح موجود أو إضافة سلاح دون دفع ثمنه
//  عبر مسارات الحفظ العامة (/api/players و /api/upgrades) — باستثناء حفظة
//  Prestige شرعية حقيقية (isValidPrestigeTransition)، التي تُصفِّر كل مستويات
//  الأسلحة عمداً كجزء من إعادة التعيين الموثَّقة في js/prestige.js.
// ═══════════════════════════════════════════════════════════════════
function validateWeaponsChange(existing, incoming) {
  if (incoming.weapons === undefined) return { ok: true };
  const incomingWeapons = incoming.weapons;
  if (!Array.isArray(incomingWeapons)) return { ok: false, reason: "invalid weapons format" };

  const isPrestigeReset = incoming.prestigeLevel !== undefined && isValidPrestigeTransition(existing, incoming);

  const existingWeapons = existing.weapons || [];
  const existingById = new Map(existingWeapons.map(w => [w.id, w]));
  const incomingIds = new Set();

  let newWeapon = null;
  for (const w of incomingWeapons) {
    if (!w || typeof w.id !== "string") return { ok: false, reason: "invalid weapon entry" };
    if (incomingIds.has(w.id)) return { ok: false, reason: "duplicate weapon id" };
    incomingIds.add(w.id);
    const old = existingById.get(w.id);
    if (!old) {
      if (newWeapon) return { ok: false, reason: "multiple new weapons in one save" };
      newWeapon = w;
      continue;
    }
    if (isPrestigeReset) continue; // 🛡️ إعادة تعيين Prestige شرعية — تخطَّ فحص تغيير المستوى لهذا السلاح
    // سلاح مملوك مسبقاً — يُمنع تغيير مستواه هنا؛ الترقية فقط عبر weapon_upgrade
    if ((w.level || 0) !== (old.level || 0) ||
        (w.starLevel || 1) !== (old.starLevel || 1) ||
        (w.gemLevel || 1) !== (old.gemLevel || 1) ||
        (w.upgradeLevel || 0) !== (old.upgradeLevel || 0)) {
      return { ok: false, reason: `weapon ${w.id} level change rejected — use weapon_upgrade` };
    }
  }

  // لا يجوز حذف سلاح مملوك من المصفوفة
  for (const id of existingById.keys()) {
    if (!incomingIds.has(id)) return { ok: false, reason: `weapon ${id} removed` };
  }

  if (newWeapon) {
    const { WEAPON_DEFS } = require("../db/databaseHelper");
    const def = WEAPON_DEFS.find(d => d.id === newWeapon.id);
    if (!def) return { ok: false, reason: "unknown weapon id" };
    if ((newWeapon.level || 0) > 1 || (newWeapon.starLevel || 1) > 1 ||
        (newWeapon.gemLevel || 1) > 1 || (newWeapon.upgradeLevel || 0) > 1) {
      return { ok: false, reason: "new weapon must start at level 1" };
    }
    // 🛡️ requireLevel يُقاس بمستوى مبنى "خيمة القائد" (landsState.b1.level) — هذا
    // بالضبط ما يتحقق منه العميل قبل إظهار زر الشراء (js/ui/ui-promotion.js:
    // houseLevel = this._landsState?.['b1']?.level)، وما يُرسَل فعلياً في كل
    // حفظ عبر حقل landsState. كان هذا الشرط يستخدم مستوى خبرة اللاعب
    // (economy.level) خطأً — قيمة لا علاقة لها بشرط العميل إطلاقاً — فيرفض
    // الخادم شراء أي سلاح requireLevel>1 بصمت رغم أن العميل يسمح بالشراء.
    const houseLevel = Math.max(1, (existing.landsState?.b1?.level) || 1);
    if (houseLevel < def.requireLevel) return { ok: false, reason: "house level too low for this weapon" };
    const oldCash = existing.cash || 0;
    const newCash = incoming.cash !== undefined ? incoming.cash : oldCash;
    const cashSpent = oldCash - newCash;
    if (cashSpent < def.cashPrice - 0.01) {
      return { ok: false, reason: "insufficient cash decrease for weapon purchase" };
    }
  }

  return { ok: true };
}

// ═══════════════════════════════════════════════════════════════════
//  🛡️ مكافحة الغش — التحقق من السيطرة على الواحات (oases)
//  js/oasis-manager.js لا مسار WS له إطلاقاً — capture() تُحسب بالكامل محلياً
//  (قوة + خصم ذهب) ثم تُحفَظ عبر /api/players مباشرة (captured:true). عميل
//  خبيث يستطيع إرسال captured:true لكل الواحات المعادية (حتى 3000 قوة مطلوبة
//  واقعياً) بلا دفع الذهب فعلياً ولا امتلاك القوة الحقيقية — دخل إضافي حتى
//  ~500/ثانية إضافية بلا أي تكلفة، لا يُكتشف بسقف معدل الموارد العام لأنه
//  يبدو كدخل طبيعي مرتفع. الجدول أدناه مطابق حرفياً لـ OASIS_DATA في
//  js/oasis-manager.js.
// ═══════════════════════════════════════════════════════════════════
const OASIS_CAPTURE_DATA = {
  1: { status: "free", capturePower: 0, cost: 0 },
  2: { status: "hostile", capturePower: 200, cost: 200 },
  3: { status: "hostile", capturePower: 500, cost: 300 },
  4: { status: "hostile", capturePower: 1200, cost: 400 },
  5: { status: "hostile", capturePower: 3000, cost: 500 },
};

function validateOasesChange(existing, incoming) {
  if (incoming.oases === undefined) return { ok: true };
  if (!Array.isArray(incoming.oases)) return { ok: false, reason: "invalid oases format" };

  const existingById = new Map((existing.oases || []).map(o => [o.id, o]));
  const newlyCaptured = [];
  for (const o of incoming.oases) {
    if (!o || typeof o.id !== "number") continue;
    const def = OASIS_CAPTURE_DATA[o.id];
    if (!def) continue; // id غير معروف — يُتجاهل بلا رفض الحفظة كاملة (توافقية)
    const wasCaptured = existingById.get(o.id)?.captured === true;
    if (o.captured === true && !wasCaptured && def.status === "hostile") {
      newlyCaptured.push({ id: o.id, def });
    }
  }
  if (newlyCaptured.length === 0) return { ok: true };

  const power = incoming.army_power !== undefined ? incoming.army_power : (existing.army_power || 0);
  const oldGold = existing.gold || 0;
  const newGold = incoming.gold !== undefined ? incoming.gold : oldGold;
  const goldSpent = oldGold - newGold;
  let requiredCost = 0;
  for (const { id, def } of newlyCaptured) {
    if (power < def.capturePower) {
      return { ok: false, reason: `oasis ${id} capture rejected — insufficient power` };
    }
    requiredCost += def.cost;
  }
  if (goldSpent < requiredCost - 0.01) {
    return { ok: false, reason: "insufficient gold decrease for oasis capture" };
  }
  return { ok: true };
}

// ═══════════════════════════════════════════════════════════════════
//  🛡️ مكافحة الغش — تغييرات landsState (مستويات مباني القرى/الأراضي)
//  js/village.js's VillageBuilding.upgrade() لا مسار WS له إطلاقاً — الترقية
//  تُحسب وتُطبَّق بالكامل محلياً (خصم موارد + زيادة level) ثم تُحفَظ مباشرة
//  عبر landsState. حقل level هنا يُستخدم لاحقاً كبوابة سيرفر حقيقية في 3
//  أماكن منفصلة: شراء أسلحة جديدة (requireLevel أعلاه)، ترقية نجوم الأسلحة
//  (server/logic/weaponUpgrade.js)، وسقف ترقية البحث (server/db/research.js)
//  — عميل خبيث يرسل landsState:{b1:{level:999}} بلا دفع أي تكلفة يفتح فوراً
//  كل الأسلحة وكل ترقيات النجوم وكل أبحاث اللعبة. لا يوجد جدول تكلفة مشترك
//  بين العميل (js/story.js، ESM) والخادم (CommonJS) للتحقق من التكلفة الدقيقة
//  المدفوعة لكل ترقية، لذا نطبّق سقفاً واقعياً (أعلى maxLevel عبر كل القرى
//  الخمس لكل مبنى = 30) ونمنع قفزة أكثر من مستوى واحد لكل حفظة كحد أدنى
//  للحماية العملية، تماشياً مع أسلوب isValidPrestigeTransition أعلاه.
// ═══════════════════════════════════════════════════════════════════
const LANDS_BUILDING_MAX_LEVEL = 30;

function validateLandsStateChange(existing, incoming) {
  if (incoming.landsState === undefined) return { ok: true };
  if (typeof incoming.landsState !== "object" || incoming.landsState === null || Array.isArray(incoming.landsState)) {
    return { ok: false, reason: "invalid landsState format" };
  }
  const existingLands = existing.landsState || {};
  for (const [buildingId, entry] of Object.entries(incoming.landsState)) {
    if (!entry || typeof entry !== "object") continue;
    const newLevel = entry.level;
    if (newLevel === undefined) continue;
    if (typeof newLevel !== "number" || !Number.isInteger(newLevel) || newLevel < 0) {
      return { ok: false, reason: `landsState.${buildingId}.level invalid` };
    }
    if (newLevel > LANDS_BUILDING_MAX_LEVEL) {
      return { ok: false, reason: `landsState.${buildingId}.level exceeds max` };
    }
    // 🛡️ +3 وليس +1: saveToDB يُستدعى فور كل economy.spend، لكن حفظات متعددة
    // متتابعة بسرعة (شبكة بطيئة/إعادة محاولة) قد تتجمّع قبل وصول الأولى فعلياً
    // — سقف صغير يمتص هذا بلا فتح ثغرة قفزة مستويات ضخمة دفعة واحدة.
    const oldLevel = existingLands[buildingId]?.level || 0;
    if (newLevel > oldLevel + 3) {
      return { ok: false, reason: `landsState.${buildingId}.level jump rejected` };
    }
  }
  return { ok: true };
}

// ═══════════════════════════════════════════════════════════════════
//  🛡️ مكافحة الغش — البطل (js/hero.js) لا مسار WS له إطلاقاً، يُحسب بالكامل
//  محلياً (hero.addXp من قتلات/بناء/ترقيات/فصول قصة/انتصارات PvP) ثم يُحفَظ
//  عبر /api/players مباشرة بحقل hero: z.record(z.any()) بلا أي تحقق سيرفري.
//  hero.level يُستهلَك فعلياً في damage/defense/powerContribution — قوة
//  قتالية حقيقية يحسمها الخادم. أي عميل خبيث يرسل hero.level مزيَّفاً
//  (hero:{level:50}) يحصل على ضرر/دفاع إضافيين حقيقيين فوراً بلا أي خبرة
//  مكتسبة فعلياً.
//
//  لا يوجد جدول خبرة مشترك بين العميل (ESM) والخادم (CommonJS) لإعادة حساب
//  المسار الدقيق، فنطبّق سقف قفزة واقعي بدلاً من ذلك: أقصى قفزة شرعية دفعة
//  واحدة (لاعب بمستوى بطل 1 يكمل الفصل 6 بمكافأة 5000 heroXp في حفظة واحدة)
//  محسوبة رياضياً = 12 مستوى. نسمح بـ20 (هامش أمان لخلط قتلات/PvP معها) —
//  يمنع القفزة الفورية للحد الأقصى (50) دفعة واحدة، تماشياً مع أسلوب
//  landsState أعلاه.
// ═══════════════════════════════════════════════════════════════════
const HERO_MAX_LEVEL = 50;
const HERO_MAX_LEVEL_JUMP_PER_SAVE = 20;

function validateHeroChange(existing, incoming) {
  if (incoming.hero === undefined) return { ok: true };
  if (typeof incoming.hero !== "object" || incoming.hero === null || Array.isArray(incoming.hero)) {
    return { ok: false, reason: "invalid hero format" };
  }
  const newLevel = incoming.hero.level;
  if (newLevel === undefined) return { ok: true };
  if (typeof newLevel !== "number" || !Number.isInteger(newLevel) || newLevel < 1) {
    return { ok: false, reason: "hero.level invalid" };
  }
  if (newLevel > HERO_MAX_LEVEL) {
    return { ok: false, reason: "hero.level exceeds max" };
  }
  const oldLevel = existing.hero?.level || 1;
  if (newLevel > oldLevel + HERO_MAX_LEVEL_JUMP_PER_SAVE) {
    return { ok: false, reason: "hero.level jump rejected" };
  }
  return { ok: true };
}

function validateEquippedWeapon(existing, incoming) {
  if (incoming.equippedWeapon === undefined) return { ok: true };
  if (incoming.equippedWeapon === "") return { ok: true };
  const weapons = incoming.weapons !== undefined ? incoming.weapons : (existing.weapons || []);
  const owned = (weapons || []).some(w => w.id === incoming.equippedWeapon);
  if (!owned) return { ok: false, reason: "cannot equip unowned weapon" };
  return { ok: true };
}

// ═══════════════════════════════════════════════════════════════════
//  🛡️ مكافحة الغش — منع ترقية مجانية لمستوى مخزن الجيش/المعرفة
//  المسار الشرعي الوحيد لترقيتهما هو رسائل WS "upgrade_army_yard"/
//  "upgrade_knowledge" (محقّقة بالفعل وتخصم التكلفة). أي تغيير لهذين
//  الحقلين عبر مسارات الحفظ العامة (/api/players و /api/upgrades) يُرفض.
// ═══════════════════════════════════════════════════════════════════
function validateProgressionChange(existing, incoming) {
  if (incoming.armyYardLevel !== undefined && incoming.armyYardLevel !== (existing.armyYardLevel || 1)) {
    return { ok: false, reason: "armyYardLevel change rejected — use upgrade_army_yard" };
  }
  if (incoming.knowledgeLevel !== undefined && incoming.knowledgeLevel !== (existing.knowledgeLevel || 1)) {
    return { ok: false, reason: "knowledgeLevel change rejected — use upgrade_knowledge" };
  }
  // 🛡️ Prestige (js/prestige.js) لا مسار WS له إطلاقاً — يُحسب ويُطبَّق بالكامل
  // محلياً (level→1، موارد ابتدائية، dmgMult/xpMult) ثم يُحفَظ مباشرة عبر
  // /api/players. prestigeLevel يُستهلَك فعلياً في computePlayerStats
  // (totalDamage += prestigeLevel*3، maxHp += prestigeLevel*5) — أي عميل خبيث
  // يرسل prestigeLevel مزيَّفاً يحصل على ضرر/صحة إضافيين حقيقيين في أي معركة
  // PvP يحسمها الخادم، بلا أي حاجة للوصول الفعلي للمستوى 110.
  const existingPrestige = existing.prestigeLevel || 0;
  if (incoming.prestigeLevel !== undefined && incoming.prestigeLevel !== existingPrestige) {
    if (!isValidPrestigeTransition(existing, incoming)) {
      return { ok: false, reason: "prestigeLevel change rejected — requires reaching max level once" };
    }
  }
  return { ok: true };
}

module.exports = { sanitizePlayerData, PlayerSaveSchema, validateResourceDelta, validateWeaponsChange, validateEquippedWeapon, validateProgressionChange, validateOasesChange, validateLandsStateChange, validateHeroChange, PLAYER_MAX_LEVEL, OASIS_CAPTURE_DATA, LANDS_BUILDING_MAX_LEVEL, HERO_MAX_LEVEL };
