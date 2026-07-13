const SAVE_KEY = "wick_save";
const SAVE_VERSION = 4; // ارتفع الإصدار لدعم الشنطة (Loadout)

let _saveTimer = null;

function _getLoadoutManager() {
  return typeof window !== "undefined" && window._loadoutManager;
}

export function saveGame(economy, village, army) {
  const sm = typeof window !== "undefined" && window._storyManager;
  const w = typeof window !== "undefined" && window._world;
  
  // حفظ تقدم الأنماط من الكائنات الحية
  let modeData = {};
  if (w && w._activeMode && typeof w._activeMode.getSaveData === 'function') {
    modeData = {
      currentMode: w._activeMode.modeName,
      extraction: w._activeMode.modeName === 'extraction' ? w._activeMode.getSaveData() : undefined,
      horde: w._activeMode.modeName === 'horde' ? w._activeMode.getSaveData() : undefined,
      cave: w._activeMode.modeName === 'cave' ? w._activeMode.getSaveData() : undefined,
    };
  }
  
  // حفظ بيانات الشنطة
  const loadoutMgr = _getLoadoutManager();
  const loadoutData = loadoutMgr ? loadoutMgr.getSaveData() : {};
  
  const data = {
    _version: SAVE_VERSION,
    resources: { ...economy.resources },
    multiplier: economy.multiplier,
    level: economy.level,
    xp: economy.xp,
    xpToNext: economy.xpToNext,
    currentVillageId: village.currentVillageId,
    completedVillages: village.completedVillages,
    currentChapter: village.currentChapter,
    unitLevel: army.unitLevel,
    trainingLevel: army.trainingLevel,
    unitPowerBase: army.unitPowerBase,
    weapons: army.weapons.map(w => ({
      id: w.id, level: w.level, upgradeLevel: w.upgradeLevel,
      starLevel: w.starLevel || 1, gemLevel: w.gemLevel || 1, owned: w.owned,
    })),
    buildings: village.buildings.map(b => ({
      id: b.id, level: b.level, state: b.state,
      constructTimer: b.constructTimer,
      productionAccum: b.productionAccum,
    })),
    storyState: sm ? sm.getSaveData() : undefined,
    modeData: modeData,
    loadout: loadoutData, // 🆕 حفظ بيانات الشنطة
    timestamp: Date.now(),
  };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    console.warn("[Save] localStorage full or unavailable");
  }
}

export function persistGameSession(economy, village, army) {
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => {
    saveGame(economy, village, army);
    _saveTimer = null;
  }, 300);
}

export function loadGame(economy, village, army) {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return { lastSave: 0 };
    const data = JSON.parse(raw);

    if (data.resources) {
      for (const k of Object.keys(economy.resources)) {
        if (data.resources[k] !== undefined) economy.resources[k] = data.resources[k];
      }
    }
    if (data.multiplier !== undefined) economy.multiplier = data.multiplier;
    if (data.level !== undefined) economy.level = data.level;
    if (data.xp !== undefined) economy.xp = data.xp;
    if (data.xpToNext !== undefined) economy.xpToNext = data.xpToNext;

    const lastSave = data.timestamp || 0;
    if (lastSave > 0 && data.buildings) {
      const elapsed = (Date.now() - lastSave) / 1000;
      const maxOffline = 4 * 3600;
      const seconds = Math.min(elapsed, maxOffline);
      let totalFood = 0, totalCash = 0, totalGold = 0;
      for (const bd of data.buildings) {
        if (bd.state === "built" && bd.level > 0) {
          const rate = 1 + bd.level * 0.5;
          totalFood += rate * seconds * 0.1;
          totalCash += rate * seconds * 0.05;
          totalGold += rate * seconds * 0.02;
        }
      }
      if (totalFood > 0) economy.resources.food = (economy.resources.food || 0) + Math.floor(totalFood);
      if (totalCash > 0) economy.resources.cash = (economy.resources.cash || 0) + Math.floor(totalCash);
      if (totalGold > 0) economy.resources.gold = (economy.resources.gold || 0) + Math.floor(totalGold);
    }

    if (data.storyState && typeof window !== "undefined" && window._storyManager) {
      window._storyManager.loadState(data.storyState);
    }
    // استعادة بيانات الشنطة
    if (data.loadout) {
      const loadoutMgr = _getLoadoutManager();
      if (loadoutMgr) loadoutMgr.loadState(data.loadout);
    }
    if (data.currentVillageId && data.currentVillageId !== village.currentVillageId) {
      village.initVillage(data.currentVillageId);
    }
    if (data.completedVillages) village.completedVillages = data.completedVillages;
    if (data.currentChapter) village.currentChapter = data.currentChapter;

    army.unitLevel = data.unitLevel ?? 1;
    army.trainingLevel = data.trainingLevel ?? 1;
    if (data.unitPowerBase !== undefined) army.unitPowerBase = data.unitPowerBase;
    if (data.weapons) {
      for (const wd of data.weapons) {
        const w = army.weapons.find(ww => ww.id === wd.id);
        if (w) {
          w.level = wd.level || 0;
          w.upgradeLevel = wd.upgradeLevel ?? (wd.level > 0 ? wd.level * 8 : 0);
          if (wd.starLevel) w.starLevel = wd.starLevel;
          if (wd.gemLevel) w.gemLevel = wd.gemLevel;
          w.owned = !!(wd.owned || w.upgradeLevel > 0);
        }
      }
    }

    if (data.buildings) {
      for (const bd of data.buildings) {
        const b = village.buildings.find(bb => bb.id === bd.id);
        if (b) {
          b.level = bd.level ?? 0;
          b.state = bd.state || "locked";
          b.constructTimer = bd.constructTimer ?? 0;
          b.productionAccum = bd.productionAccum ?? 0;
        }
      }
    }

    return { lastSave: data.timestamp || 0 };
  } catch (e) {
    console.warn("[Save] Failed to load:", e);
    return { lastSave: 0 };
  }
}

export function clearSave() {
  if (_saveTimer) clearTimeout(_saveTimer);
  localStorage.removeItem(SAVE_KEY);
}
