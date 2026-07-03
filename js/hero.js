function getHeroXpForLevel(level) {
  if (level <= 0) return 100;
  return Math.floor(120 * Math.pow(1.18, level - 1));
}

export class GameHero {
  constructor() {
    this.level = 1;
    this.maxLevel = 50;
    this.xp = 0;
    this.xpToNext = getHeroXpForLevel(1);
    this.hp = 120;
    this.maxHp = 120;
    this.baseDmg = 12;
    this.baseDef = 0;
    this.abilities = {
      heal: { unlocked: false, levelReq: 5, cooldown: 0, maxCooldown: 30, active: false },
      powerStrike: { unlocked: false, levelReq: 10, cooldown: 0, maxCooldown: 20, active: false },
      shield: { unlocked: false, levelReq: 15, cooldown: 0, maxCooldown: 25, active: false, timer: 0 },
      rally: { unlocked: false, levelReq: 20, cooldown: 0, maxCooldown: 35, active: false, timer: 0 },
    };
    this._onLevelUp = null;
    this._onAbilityUnlock = null;
    this._onAbilityUsed = null;
  }

  get damage() {
    let dmg = this.baseDmg + Math.floor(this.level * 1.5);
    if (this.abilities.powerStrike.active) dmg = Math.floor(dmg * 1.8);
    return dmg;
  }

  get defense() {
    let def = this.baseDef + Math.floor(this.level * 0.8);
    if (this.abilities.shield.active) def += 15;
    return def;
  }

  get powerContribution() {
    return Math.floor(this.level * 3 + this.damage * 0.5 + this.defense * 0.3);
  }

  addXp(amount) {
    this.xp += amount;
    let leveled = false;
    while (this.xp >= this.xpToNext && this.level < this.maxLevel) {
      this.xp -= this.xpToNext;
      this.level++;
      this.xpToNext = getHeroXpForLevel(this.level);
      this._checkUnlocks();
      leveled = true;
    }
    if (leveled && this._onLevelUp) {
      this._onLevelUp(this.level);
    }
  }

  _checkUnlocks() {
    for (const [key, ab] of Object.entries(this.abilities)) {
      if (!ab.unlocked && this.level >= ab.levelReq) {
        ab.unlocked = true;
        if (this._onAbilityUnlock) this._onAbilityUnlock(key, ab);
      }
    }
  }

  useAbility(key) {
    const ab = this.abilities[key];
    if (!ab || !ab.unlocked || ab.cooldown > 0) return false;
    ab.cooldown = ab.maxCooldown;
    ab.active = true;
    if (this._onAbilityUsed) this._onAbilityUsed(key, ab);
    if (key === 'heal') {
      this.hp = Math.min(this.maxHp, this.hp + Math.floor(this.maxHp * 0.4));
    } else if (key === 'shield') {
      ab.timer = 8;
    } else if (key === 'rally') {
      ab.timer = 10;
    }
    return true;
  }

  tick(dt) {
    for (const ab of Object.values(this.abilities)) {
      if (ab.cooldown > 0) {
        ab.cooldown = Math.max(0, ab.cooldown - dt);
      }
      if (ab.timer !== undefined && ab.timer > 0) {
        ab.timer -= dt;
        if (ab.timer <= 0) {
          ab.timer = 0;
          ab.active = false;
        }
      }
    }
    if (this.abilities.heal && this.abilities.heal.active) {
      this.abilities.heal.active = false;
    }
  }

  takeDamage(dmg) {
    const mitigated = Math.max(1, dmg - this.defense);
    this.hp = Math.max(0, this.hp - mitigated);
    return mitigated;
  }

  heal(amount) {
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  revive() {
    this.hp = this.maxHp;
  }

  getSaveData() {
    return {
      level: this.level,
      xp: this.xp,
      xpToNext: this.xpToNext,
      hp: this.hp,
      maxHp: this.maxHp,
      abilities: Object.fromEntries(
        Object.entries(this.abilities).map(([k, v]) => [k, {
          unlocked: v.unlocked,
          cooldown: 0,
        }])
      ),
    };
  }

  loadState(data) {
    if (!data) return;
    this.level = data.level || 1;
    this.xp = data.xp || 0;
    this.xpToNext = data.xpToNext || getHeroXpForLevel(this.level);
    this.hp = data.hp || this.maxHp;
    this.maxHp = data.maxHp || 120;
    if (data.abilities) {
      for (const [k, v] of Object.entries(data.abilities)) {
        if (this.abilities[k]) {
          this.abilities[k].unlocked = v.unlocked || false;
          this.abilities[k].cooldown = 0;
        }
      }
    }
    this._checkUnlocks();
  }
}