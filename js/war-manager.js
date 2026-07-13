/**
 * js/war-manager.js
 * ============================================================================
 * 🏜️ مدير الحرب القبلي — War Manager (Client)
 * يدير الحروب بين التحالفات (القبائل) على مستوى العميل:
 *   - إرسال إعلانات الحرب وإرسال الجيوش
 *   - استقبال نتائج المعارك وعرضها
 *   - عرض الحروب الجارية والترتيب القبلي
 *   - التكامل مع AllianceManager و GameArmy
 * ============================================================================
 */

export class WarManager {
  constructor(allianceManager, economy, army, netSync) {
    this.alliance = allianceManager;
    this.economy  = economy;
    this.army     = army;
    this.netSync = netSync;

    // الحروب الجارية
    this.activeWars = [];
    // ترتيب القبائل
    this.rankings   = [];
    // آخر نتيجة معركة
    this.lastBattleResult = null;
    // آخر نتيجة حرب كاملة
    this.lastWarResult = null;

    // callbacks
    this.onWarDeclared  = null;
    this.onBattleResult = null;
    this.onWarEnded     = null;
    this.onWarsUpdated  = null;
    this.onRankingsUpdated = null;

    // علامة التحميل
    this._initialized = false;
    this._warCooldown = 0;
  }

  // ==================== ربط مع NetworkSync ====================
  attachToWorld(world) {
    world._onWarEvent = (eventType, msg) => this._handleWarEvent(eventType, msg);
    world._onWarResponse = (requestType, msg) => this._handleWarResponse(requestType, msg);
  }

  // ==================== إرسال الأوامر عبر WebSocket ====================

  _send(msg) {
    if (!this.netSync) return;
    const ws = this.netSync._ws;
    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify(msg));
      return true;
    }
    return false;
  }

  declareWar(defenderName, defenderPower) {
    const myTribe = this._getMyTribeInfo();
    if (!myTribe) return false;
    return this._send({
      type: "war_declare",
      attackerName:    myTribe.name,
      attackerMembers: [this.netSync?.username],
      attackerPower:   myTribe.power,
      defenderName:    defenderName,
      defenderPower:   defenderPower || 0,
    });
  }

  deployArmy(warId, armyCount, armyPower, side) {
    if (!warId) return false;
    return this._send({
      type: "war_deploy",
      warId,
      armyCount,
      armyPower,
      side,
    });
  }

  resolveBattle(warId, attackerName, attackerPower, defenderName, defenderPower) {
    if (!warId) return false;
    return this._send({
      type: "war_resolve_battle",
      warId,
      attackerName,
      attackerPower,
      defenderName,
      defenderPower,
    });
  }

  requestActiveWars() {
    return this._send({ type: "war_get_active" });
  }

  requestHistory() {
    return this._send({ type: "war_get_history" });
  }

  requestRankings() {
    return this._send({ type: "war_get_rankings" });
  }

  // ==================== استقبال الأحداث ====================

  _handleWarEvent(eventType, msg) {
    switch (eventType) {
      case "war_declared":
        if (this.onWarDeclared) this.onWarDeclared(msg);
        break;
      case "war_battle_result":
        this.lastBattleResult = msg;
        if (this.onBattleResult) this.onBattleResult(msg);
        break;
      case "war_ended":
        this.lastWarResult = msg;
        if (this.onWarEnded) this.onWarEnded(msg);
        break;
    }
  }

  _handleWarResponse(requestType, msg) {
    switch (requestType) {
      case "war_declare":
        if (msg.ok) {
          this.requestActiveWars();
        }
        break;
      case "war_get_active":
        if (msg.wars) {
          this.activeWars = msg.wars;
          if (this.onWarsUpdated) this.onWarsUpdated(this.activeWars);
        }
        break;
      case "war_get_history":
        if (msg.history) {
          this.warHistory = msg.history;
          if (this.onWarsUpdated) this.onWarsUpdated(this.activeWars, msg.history);
        }
        break;
      case "war_get_rankings":
        if (msg.rankings) {
          this.rankings = msg.rankings;
          if (this.onRankingsUpdated) this.onRankingsUpdated(this.rankings);
        }
        break;
    }
  }

  // ==================== أدوات مساعدة ====================

  _getMyTribeInfo() {
    if (!this.alliance || this.alliance.level === 0) return null;
    const tiers = ["", "قبيلة", "عشيرة", "قبيلة عظمى", "إمبراطورية"];
    const _tierName = tiers[this.alliance.level] || "قبيلة";
    const armyPower = this.army ? this.army.totalArmyPower : 0;
    return {
      name:  `عشيرة ${this.netSync?.username || "المحارب"}`,
      power: armyPower + this.alliance.damageBonus + this.alliance.defenseBonus,
      level: this.alliance.level,
    };
  }

  get myTribePower() {
    if (!this.army) return 0;
    return this.army.totalArmyPower;
  }

  get hasActiveWar() {
    return this.activeWars.length > 0;
  }

  getMySide(war) {
    if (!war) return null;
    const me = this.netSync?.username || "";
    if (war.attacker === me || war.attacker?.includes(me)) return "attacker";
    if (war.defender === me || war.defender?.includes(me)) return "defender";
    return null;
  }

  // ==================== التحميل الأولي ====================

  init() {
    if (this._initialized) return;
    this._initialized = true;
    this.requestActiveWars();
    this.requestRankings();
  }

  // ==================== التحديث الدوري ====================

  tick(dt) {
    // تحديث الـ cooldowns لو موجودة
    if (this._warCooldown > 0) {
      this._warCooldown -= dt;
      if (this._warCooldown < 0) this._warCooldown = 0;
    }
  }
}