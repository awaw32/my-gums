import { aStar, simplifyPath } from "./pathfinding.js";

export function injectInteractionMethods(WorldMap) {
  WorldMap.prototype.findDropAt = function (x, y) {
    for (let i = this.drops.length - 1; i >= 0; i--) {
      if (Math.hypot(this.drops[i].x - x, this.drops[i].y - y) < 30) return i;
    }
    return -1;
  };

  WorldMap.prototype.collectDrop = function (index) {
    if (index < 0 || index >= this.drops.length) return;
    const drop = this.drops[index];
    if (!drop || drop.collected) return;
    drop.collected = true;
    const money = drop.money || 0;
    const gold = drop.gold || 0;
    if (this._activeMode && this._activeMode.modeName === "extraction" && gold > 0) {
      const bagMult = 1 + ((this._activeMode._currentUpgrades?.bagSize || 1) - 1) * 0.1;
      const goldToCarry = Math.floor(gold * bagMult);
      this._activeMode._carryingGold = Math.min(
        this._activeMode._carryingGold + goldToCarry,
        this._activeMode._getMaxBag()
      );
      this.worldFx.push({
        x: drop.x, y: drop.y,
        text: `🪙 +${goldToCarry} (${this._activeMode._carryingGold}/${this._activeMode._getMaxBag()})`,
        color: "#FFD700", life: 0.8, maxLife: 0.8
      });
      if (this._onSelfStatsChanged) this._onSelfStatsChanged();
      if (money > 0 && this.economy) {
        this.economy.addRaw("cash", money);
        this.sessionStats.coinsEarned += money;
        if (this._onCashEarned) this._onCashEarned(money);
      }
    } else {
      if (this.economy) {
        if (money > 0) this.economy.addRaw("cash", money);
        if (gold > 0) this.economy.addRaw("gold", gold);
        if (money > 0 && this._onCashEarned) this._onCashEarned(money);
      }
      this.sessionStats.coinsEarned += money;
      this.worldFx.push({ x: drop.x, y: drop.y, text: `+${money} 💵${gold > 0 ? ` +${gold} 🪙` : ''}`, color: "#FFD700", life: 0.8, maxLife: 0.8 });
    }
    this.drops.splice(index, 1);
    if (this._onDropCollected) this._onDropCollected();
  };

  WorldMap.prototype.findTreasureChestAt = function (x, y) {
    for (let i = this.treasureChests.length - 1; i >= 0; i--) {
      const c = this.treasureChests[i];
      if (!c.opened && Math.hypot(c.x - x, c.y - y) < 40) return i;
    }
    return -1;
  };

  WorldMap.prototype.openTreasureChest = function (index) {
    if (index < 0 || index >= this.treasureChests.length) return;
    const chest = this.treasureChests[index];
    if (!chest || chest.opened) return;
    chest.opened = true;
    chest.respawnTimer = 90; // يعود بعد 90 ثانية
    const { artifacts, cash, gold, desertGem } = chest.reward;
    if (this.economy) {
      if (artifacts > 0) this.economy.addRaw('artifacts', artifacts);
      if (cash > 0) this.economy.addRaw('cash', cash);
      if (gold > 0) this.economy.addRaw('gold', gold);
      if (desertGem > 0) this.economy.addRaw('desertGem', desertGem);
    }
    const gemText = desertGem > 0 ? ` 💠x${desertGem}` : '';
    this.worldFx.push({
      x: chest.x, y: chest.y,
      text: `🎁 ${artifacts} 🏺 +${cash} 💵 +${gold} 🪙${gemText}`,
      color: "#ffd700", life: 2.0, maxLife: 2.0
    });
    if (this._onTreasureOpened) this._onTreasureOpened(chest.reward);
  };

  WorldMap.prototype.onTap = function (wx, wy) {
    // 🎁 فتح صندوق كنز إذا نقر عليه
    const chestIdx = this.findTreasureChestAt(wx, wy);
    if (chestIdx >= 0) {
      this.openTreasureChest(chestIdx);
      this._hidePvPMenu();
      return;
    }

    const dropIdx = this.findDropAt(wx, wy);
    if (dropIdx >= 0) {
      this.collectDrop(dropIdx);
      this._hidePvPMenu();
      return;
    }

    const monster = this.findMonsterAt(wx, wy);
    if (monster && monster.alive) {
      this.engageMonster(monster);
      this._hidePvPMenu();
      return;
    }

    const otherPlayer = this.findOtherPlayerAt(wx, wy);
    if (otherPlayer) {
      if (this._pvpFledTarget && this._pvpFledTarget.username === otherPlayer.username) {
        this._hidePvPMenu();
        this._startPvPPursuit(otherPlayer);
        return;
      }
      this._showPvPMenu(otherPlayer);
      return;
    }

    this._hidePvPMenu();
    this._cancelPvPAttack();

    this.leader.fighting = null;
    this.armyUnits.forEach(u => u.fighting = null);

    const path = aStar(this.leader.x, this.leader.y, wx, wy, this.W, this.H);
    this.leader.path = simplifyPath(path);
    this.leader.pathIdx = 0;
    this._moveTargetX = wx;
    this._moveTargetY = wy;
    this.leader.fighting = null;
    this.armyUnits.forEach(u => { u.fighting = null; });

    if (this.netSync) this.netSync.sendWSUpdate();
  };

  WorldMap.prototype.movePlayerTo = function (x, y) {
    if (!this.leader) return;
    this.leader.fighting = null;
    this.armyUnits.forEach(u => u.fighting = null);
    const path = aStar(this.leader.x, this.leader.y, x, y, this.W, this.H);
    this.leader.path = simplifyPath(path);
    this.leader.pathIdx = 0;
    this._moveTargetX = x;
    this._moveTargetY = y;
    if (this.netSync) this.netSync.sendWSUpdate();
  };
}
