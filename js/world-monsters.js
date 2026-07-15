import { getEnemyForLevel, getEnemiesForVillage, getBossForVillage, calculateEnemyPower } from "./enemies.js";

export function injectMonstersMethods(WorldMap) {
  WorldMap.prototype.spawnMonsters = function () {
    // لا نعيد توليد الوحوش في وضع الحملة أو إذا وصلت وحوش السيرفر أو في أوضاع خاصة
    if (this._campaignMode || this._monstersSynced || this._activeMode) return;
    this.monsters = [];
    for (let i = 0; i < 12; i++) {
      let x, y;
      do {
        x = 150 + Math.random() * (this.W - 300);
        y = 150 + Math.random() * (this.H - 300);
      } while (this.isInSafeZone(x, y));
      this.monsters.push(this.createMonster(i, x, y));
    }
  };

  WorldMap.prototype.spawnCampaignMonsters = function (villageId, includeBoss = false) {
    this.monsters = [];
    const enemies = getEnemiesForVillage(villageId);
    const count = 6 + Math.floor(Math.random() * 4); // 6-9 enemies
    for (let i = 0; i < count; i++) {
      let x, y;
      do {
        x = 200 + Math.random() * (this.W - 400);
        y = 200 + Math.random() * (this.H - 400);
      } while (this.isInSafeZone(x, y));
      const enemy = enemies[Math.floor(Math.random() * enemies.length)];
      this.monsters.push(this.createMonster(i, x, y, enemy));
    }
    if (includeBoss) {
      const boss = getBossForVillage(villageId);
      if (boss) {
        let x, y;
        do {
          x = this.W / 2 + (Math.random() - 0.5) * 400;
          y = this.H / 2 + (Math.random() - 0.5) * 400;
        } while (this.isInSafeZone(x, y));
        this.monsters.push(this.createMonster('boss', x, y, boss));
      }
    }
  };

  WorldMap.prototype.createMonster = function (id, spawnX, spawnY, enemyOverride = null) {
    const playerLevel = this.economy?.level || 1;
    const enemy = enemyOverride || getEnemyForLevel(playerLevel);
    const scaled = calculateEnemyPower(enemy, playerLevel);
    return {
      id,
      enemyId: enemy.id,
      name: enemy.name,
      color: enemy.color,
      radius: enemy.radius,
      hp: scaled.hp,
      maxHp: scaled.hp,
      damage: scaled.damage,
      rewardMoney: scaled.reward.cash || 5,
      rewardGold: scaled.reward.gold || 1,
      imageKey: this._getMonsterImageKey(enemy.id),
      x: spawnX,
      y: spawnY,
      spawnX,
      spawnY,
      alive: true,
      facing: 1,
      attackCD: 0,
      respawnTimer: 0,
      ability: enemy.ability || null,
      isBoss: enemy.isBoss || false,
      _shieldTimer: 0,
      _phaseTimer: 0,
      _phases: enemy.isBoss ? [
        { threshold: 0.5, triggered: false, message: "💢 المرحلة الثانية!", enrage: { damageMult: 1.4 } },
        { threshold: 0.25, triggered: false, message: "🔥 المرحلة الثالثة — جنون!", enrage: { damageMult: 1.8 } },
      ] : null,
    };
  };

  WorldMap.prototype._getMonsterImageKey = function (enemyId) {
    if (enemyId.includes("scorpion_elite")) return "scorpion-elite";
    if (enemyId.includes("sand_dragon")) return "sand-dragon";
    if (enemyId.includes("giant_sand")) return "giant-sand";
    if (enemyId.includes("mystic_mage")) return "mystic-mage";
    if (enemyId.includes("thief_assassin")) return "thief-assassin";
    if (enemyId.includes("wolf") || enemyId.includes("scorpion") || enemyId.includes("thief")) return "monster-1";
    if (enemyId.includes("ghost") || enemyId.includes("shadow") || enemyId.includes("sorcerer")) return "monster-2";
    if (enemyId.includes("dragon") || enemyId.includes("boss") || enemyId.includes("eagle")) return "monster-3";
    return "monster-1";
  };
}
