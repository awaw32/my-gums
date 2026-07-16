export function injectLootMethods(WorldMap) {
  WorldMap.prototype.spawnTreasureChests = function () {
    if (this._activeMode) return;
    this.treasureChests = [];
    const chestCount = 6 + Math.floor(Math.random() * 4); // 6-9 صناديق
    const playerLevel = this.economy?.level || 1;
    const levelScale = 1 + (playerLevel - 1) * 0.15; // كل مستوى +15%
    for (let i = 0; i < chestCount; i++) {
      let x, y;
      do {
        x = 150 + Math.random() * (this.W - 300);
        y = 150 + Math.random() * (this.H - 300);
      } while (this.isInSafeZone(x, y) || this._isNearOtherChest(x, y, i));
      this.treasureChests.push({
        id: `chest_${i}_${Date.now()}`,
        x, y,
        opened: false,
        respawnTimer: 0,
        reward: {
          artifacts: Math.max(1, Math.floor((1 + Math.random() * 3) * levelScale)),
          cash: Math.floor((50 + Math.random() * 200) * levelScale),
          gold: Math.floor((10 + Math.random() * 50) * levelScale),
          desertGem: Math.random() < 0.15 ? 1 : 0,
        },
      });
    }
  };

  WorldMap.prototype._isNearOtherChest = function (x, y, currentIndex) {
    for (let i = 0; i < currentIndex; i++) {
      if (Math.hypot(this.treasureChests[i].x - x, this.treasureChests[i].y - y) < 150) return true;
    }
    return false;
  };
}
