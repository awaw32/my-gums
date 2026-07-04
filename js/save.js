const SAVE_KEY = "wick_save";

export function saveGame(economy, village, army) {
  const data = {
    resources: { ...economy.resources },
    multiplier: economy.multiplier,
    level: economy.level,
    xp: economy.xp,
    xpToNext: economy.xpToNext,
    currentVillageId: village.currentVillageId,
    unitLevel: army.unitLevel,
    unitPowerBase: army.unitPowerBase,
    weapons: army.weapons.map(w => ({ id: w.id, level: w.level, upgradeLevel: w.upgradeLevel, starLevel: w.starLevel || 1, gemLevel: w.gemLevel || 1 })),
    buildings: village.buildings.map(b => ({
      id: b.id, level: b.level, state: b.state,
      constructTimer: b.constructTimer,
      productionAccum: b.productionAccum,
    })),
    timestamp: Date.now(),
  };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn("[Save] localStorage full or unavailable");
  }
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

    if (data.currentVillageId && data.currentVillageId !== village.currentVillageId) {
      village.initVillage(data.currentVillageId);
    }

    army.unitLevel = data.unitLevel ?? 1;
    if (data.unitPowerBase !== undefined) army.unitPowerBase = data.unitPowerBase;
    if (data.weapons) {
      for (const wd of data.weapons) {
        const w = army.weapons.find(ww => ww.id === wd.id);
        if (w) {
          w.level = wd.level || 0;
          w.upgradeLevel = wd.upgradeLevel ?? (wd.level > 0 ? wd.level * 8 : 0);
          if (wd.starLevel) w.starLevel = wd.starLevel;
          if (wd.gemLevel) w.gemLevel = wd.gemLevel;
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
  localStorage.removeItem(SAVE_KEY);
}
