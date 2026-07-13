const ALLIANCE_TIERS = [
  { level: 1, name: "قبيلة", cost: 100, damageBonus: 2, defenseBonus: 1, incomeMult: 1.1 },
  { level: 2, name: "عشيرة", cost: 200, damageBonus: 5, defenseBonus: 2, incomeMult: 1.2 },
  { level: 3, name: "قبيلة عظمى", cost: 400, damageBonus: 10, defenseBonus: 4, incomeMult: 1.3 },
  { level: 4, name: "إمبراطورية", cost: 800, damageBonus: 20, defenseBonus: 8, incomeMult: 1.5 },
];

// 🎯 غارات التحالف: مستويات مختلفة من الغارات التعاونية
const ALLIANCE_RAIDS = [
  { level: 1, name: "غارة الواحة", bossId: "wadi_boss", powerReq: 5000, reward: { cash: 5000, gold: 500, gems: 50 } },
  { level: 2, name: "غارة الأطلال", bossId: "palace_boss", powerReq: 15000, reward: { cash: 20000, gold: 2000, gems: 150 } },
  { level: 3, name: "غارة الجبل", bossId: "mountain_boss", powerReq: 50000, reward: { cash: 75000, gold: 7500, gems: 500, artifacts: 10 } },
  { level: 4, name: "غارة العرش", bossId: "final_boss", powerReq: 200000, reward: { cash: 250000, gold: 25000, gems: 1500, artifacts: 50, desertGem: 3 } },
];

export { ALLIANCE_RAIDS };

export class AllianceManager {
  constructor(economy) {
    this.economy = economy;
    this.level = 0;
    this._onChanged = null;
    this._raidCooldown = 0; // تايمر الغارة بالثواني
    this._raidActive = false;
    this._raidBoss = null;
    this._onRaidStateChange = null;

    // 🏜️ نظام القبيلة الجماعي
    this._tribeName = "";
    this._tribeBanner = "🏕️";
    this._members = [];          // [{name, rank, contribution, power}]
    this._treasury = 0;          // صندوق القبيلة (ذهب جماعي)
    this._myName = "";           // اسم اللاعب الحالي (يُضبط من main.js)
  }

  setMyName(name) { this._myName = name; this.addMember(name, "shaykh"); }

  get currentTier() {
    return ALLIANCE_TIERS[this.level] || null;
  }

  get maxLevel() {
    return ALLIANCE_TIERS.length;
  }

  get nextTier() {
    return ALLIANCE_TIERS[this.level + 1] || null;
  }

  get upgradeCost() {
    const t = ALLIANCE_TIERS[this.level];
    return t ? t.cost : 0;
  }

  get damageBonus() {
    let total = 0;
    for (let i = 0; i < this.level; i++) total += ALLIANCE_TIERS[i].damageBonus;
    return total;
  }

  get defenseBonus() {
    let total = 0;
    for (let i = 0; i < this.level; i++) total += ALLIANCE_TIERS[i].defenseBonus;
    return total;
  }

  get incomeMult() {
    if (this.level === 0) return 1;
    return ALLIANCE_TIERS[this.level - 1].incomeMult;
  }

  get tierName() {
    if (this.level === 0) return "—";
    return ALLIANCE_TIERS[this.level - 1].name;
  }

  canUpgrade() {
    if (this.level >= this.maxLevel) return false;
    const cost = this.upgradeCost;
    return this.economy.canAfford("gold", cost);
  }

  upgrade() {
    if (this.level >= this.maxLevel) return false;
    const cost = this.upgradeCost;
    if (!this.economy.spend("gold", cost)) return false;
    this.level++;
    if (this._onChanged) this._onChanged(this.level);
    return true;
  }

  getState() {
    return {
      level: this.level,
      tierName: this.tierName,
      tribeName: this.tribeName,
      tribeBanner: this.tribeBanner,
      damageBonus: this.damageBonus,
      defenseBonus: this.defenseBonus,
      incomeMult: this.incomeMult,
      upgradeCost: this.upgradeCost,
      maxLevel: this.maxLevel,
      canUpgrade: this.canUpgrade(),
      treasury: this.treasury,
      memberCount: this.getMemberCount(),
      tribePower: this.tribePower,
      myRank: this.getMyRank(),
      members: this.members.map(m => ({ name: m.name, rank: m.rank, contribution: m.contribution, power: m.power })),
    };
  }

  loadState(level) {
    if (typeof level === "number" && level >= 0 && level <= this.maxLevel) {
      this.level = level;
    }
  }

  // ==================== 🏜️ نظام القبيلة الجماعي ====================

  get tribeName()  { return this._tribeName  || ""; }
  get tribeBanner(){ return this._tribeBanner || "🏕️"; }
  get members()    { return this._members     || []; }
  get treasury()   { return this._treasury    || 0; }

  setTribeName(name) {
    if (typeof name !== "string") return false;
    const clean = name.trim().slice(0, 30);
    if (!clean) return false;
    this._tribeName = clean;
    if (this._onChanged) this._onChanged(this.level);
    return true;
  }

  setTribeBanner(emoji) {
    if (typeof emoji !== "string" || emoji.length > 4) return false;
    this._tribeBanner = emoji;
    if (this._onChanged) this._onChanged(this.level);
    return true;
  }

  // مساهمة في صندوق القبيلة — تُسحب من الذهب
  contribute(amount) {
    if (!this._treasury) this._treasury = 0;
    amount = Math.floor(amount);
    if (amount <= 0) return false;
    if (!this.economy.spend("gold", amount)) return false;
    this._treasury += amount;
    if (this._onChanged) this._onChanged(this.level);
    return true;
  }

  upgradeFromTreasury(useTreasuryFirst = true) {
    if (this.level >= this.maxLevel) return false;
    const cost = this.upgradeCost;
    if (useTreasuryFirst && this.treasury >= cost) {
      this._treasury -= cost;
      this.level++;
      if (this._onChanged) this._onChanged(this.level);
      return true;
    }
    // fallback: ادفع من ذهبك الشخصي
    return this.upgrade();
  }

  // ==================== نظام الأعضاء والرتب ====================

  get TRIBAL_RANKS() {
    return [
      { id: "shaykh",   name: "شيخ القبيلة", icon: "⚜️", authority: 3 },
      { id: "warrior",  name: "محارب",       icon: "🗡️", authority: 2 },
      { id: "member",   name: "عضو",         icon: "🤝",           authority: 1 },
      { id: "novice",   name: "مستجِدّ",     icon: "🏜️",           authority: 0 },
    ];
  }

  getRank(rankId) {
    return this.TRIBAL_RANKS.find(r => r.id === rankId) || this.TRIBAL_RANKS[3];
  }

  getMyRank() {
    const me = this.members.find(m => m.name === this._myName);
    return me ? this.getRank(me.rank) : null;
  }

  addMember(name, rank = "novice") {
    if (!this._members) this._members = [];
    if (this._members.find(m => m.name === name)) return false;
    this._members.push({ name, rank, contribution: 0, power: 0, joinedAt: Date.now() });
    if (this._onChanged) this._onChanged(this.level);
    return true;
  }

  removeMember(name) {
    if (!this._members) return false;
    const before = this._members.length;
    this._members = this._members.filter(m => m.name !== name);
    if (this._members.length !== before) {
      if (this._onChanged) this._onChanged(this.level);
      return true;
    }
    return false;
  }

  promoteMember(name) {
    const m = this._members.find(m => m.name === name);
    if (!m) return false;
    const rankIds = this.TRIBAL_RANKS.map(r => r.id);
    const idx = rankIds.indexOf(m.rank);
    if (idx <= 0) return false;           // لا ترقية فوق شيخ القبيلة
    m.rank = rankIds[idx - 1];            // نرقّيه لمستوى أعلى
    if (this._onChanged) this._onChanged(this.level);
    return true;
  }

  demoteMember(name) {
    const m = this._members.find(m => m.name === name);
    if (!m) return false;
    const rankIds = this.TRIBAL_RANKS.map(r => r.id);
    const idx = rankIds.indexOf(m.rank);
    if (idx >= rankIds.length - 1) return false;
    m.rank = rankIds[idx + 1];
    if (this._onChanged) this._onChanged(this.level);
    return true;
  }

  getMemberCount() { return this._members ? this._members.length : 0; }

  getTotalMemberPower() {
    return (this._members || []).reduce((sum, m) => sum + (m.power || 0), 0);
  }

  // ربط القبيلة بنظام الحرب — اجمع القوة القبلية الإجمالية
  get tribePower() {
    const myPower = this.economy ? this.economy.power || 0 : 0;
    return myPower + this.getTotalMemberPower();
  }

  // ==================== 🎯 نظام غارات التحالف ====================

  get availableRaids() {
    return ALLIANCE_RAIDS.filter(r => r.level <= this.level + 1 && this.economy.power >= r.powerReq);
  }

  get nextRaid() {
    if (this.level === 0) return null;
    return ALLIANCE_RAIDS.find(r => r.level <= this.level && r.level > 0) || null;
  }

  startRaid(raidIndex) {
    if (this._raidActive) return false;
    if (this._raidCooldown > 0) return false;
    const raid = ALLIANCE_RAIDS[raidIndex];
    if (!raid) return false;
    if (raid.level > this.level + 1) return false;
    if (this.economy.power < raid.powerReq) return false;

    this._raidActive = true;
    this._raidBoss = {
      name: raid.name,
      hp: raid.powerReq * 2,
      maxHp: raid.powerReq * 2,
      damage: Math.floor(raid.powerReq * 0.01),
      alive: true,
      raidIndex,
    };
    if (this._onRaidStateChange) this._onRaidStateChange(this._raidBoss);
    return true;
  }

  get raidCooldown() {
    return this._raidCooldown;
  }

  get isRaidActive() {
    return this._raidActive;
  }

  dealRaidDamage() {
    if (!this._raidActive || !this._raidBoss || !this._raidBoss.alive) return 0;
    const dmg = Math.floor(this.economy.power * 0.02) + this.damageBonus;
    this._raidBoss.hp -= dmg;
    if (this._raidBoss.hp <= 0) {
      this._raidBoss.hp = 0;
      this._raidBoss.alive = false;
      this._completeRaid();
    }
    if (this._onRaidStateChange) this._onRaidStateChange(this._raidBoss);
    return dmg;
  }

  _completeRaid() {
    const raid = ALLIANCE_RAIDS[this._raidBoss.raidIndex];
    if (!raid) return;
    // منح المكافآت
    const rewards = raid.reward;
    for (const [res, amt] of Object.entries(rewards)) {
      if (res === 'artifacts' && this.economy.resources.artifacts !== undefined) {
        this.economy.addRaw('artifacts', amt);
      } else if (res === 'desertGem' && this.economy.resources.desertGem !== undefined) {
        this.economy.addRaw('desertGem', amt);
      } else if (this.economy.resources[res] !== undefined) {
        this.economy.addRaw(res, amt);
      }
    }
    this._raidActive = false;
    this._raidCooldown = 3600; // 1 ساعة تبريد
    this._raidBoss = null;
    if (this._onRaidStateChange) this._onRaidStateChange(null);
    if (this._onChanged) this._onChanged(this.level);
  }

  tickRaidCooldown(dt) {
    if (this._raidCooldown > 0) {
      this._raidCooldown -= dt;
      if (this._raidCooldown < 0) this._raidCooldown = 0;
    }
  }

  cancelRaid() {
    this._raidActive = false;
    this._raidBoss = null;
    this._raidCooldown = 300; // 5 دقائق تبريد للإلغاء
    if (this._onRaidStateChange) this._onRaidStateChange(null);
  }
}
