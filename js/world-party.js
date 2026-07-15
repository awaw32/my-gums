export function injectPartyMethods(WorldMap) {
  WorldMap.prototype.createParty = function () {
    this._sendWS({ type: "party_create" });
  };

  WorldMap.prototype.joinParty = function (code) {
    this._sendWS({ type: "party_join", partyCode: code });
  };

  WorldMap.prototype._onPartyCreated = function (code) {
    this.partyCode = code;
    if (this.store) this.store.set('notification', { text: `🎉 تم إنشاء الحزب — الكود: ${code}`, t: Date.now() });
    if (this.store) this.store.set('partyCode', code);
  };

  WorldMap.prototype._onPartyMemberJoined = function (username, code) {
    this.partyCode = code;
    if (this.store) {
      this.store.set('partyCode', code);
      this.store.set('notification', { text: `👥 ${username} انضم إلى الحزب!`, t: Date.now() });
    }
  };

  WorldMap.prototype._onPartyJoinFailed = function (reason) {
    if (this.store) this.store.set('notification', { text: `❌ ${reason || 'تعذر الانضمام للحزب'}`, t: Date.now() });
  };
}
