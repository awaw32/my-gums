const EVENT_TEMPLATES = [
  { id: "gold_rush", title: "🏆 انهيار الذهب", desc: "الذهب من الوحوش ×2", type: "mult_gold", value: 2, duration: 3600, icon: "🪙" },
  { id: "xp_boost", title: "⚡ تضاعف الخبرة", desc: "XP ×2 من كل المصادر", type: "mult_xp", value: 2, duration: 3600, icon: "⭐" },
  { id: "power_week", title: "💪 أسبوع القوة", desc: "قوة الجيش +50%", type: "mult_power", value: 1.5, duration: 86400, icon: "🔥" },
  { id: "pvp_tournament", title: "⚔️ بطولة PvP", desc: "مكافآت PvP ×3", type: "mult_pvp", value: 3, duration: 7200, icon: "🏟️" },
  { id: "oasis_bonus", title: "🌴 ازدهار الواحات", desc: "دخل الواحات ×3", type: "mult_oasis", value: 3, duration: 3600, icon: "🌴" },
  { id: "camel_race", title: "🐪 سباق الإبل", desc: "سباق الإبل — جوائز ضخمة!", type: "camel_race", value: 1, duration: 86400, icon: "🐪" },
];

export class EventManager {
  constructor() {
    this.events = EVENT_TEMPLATES.map(e => ({ ...e, active: false, remaining: 0 }));
    this._onEventStart = null;
    this._onEventEnd = null;
  }

  getAll() { return this.events; }

  getActiveEvents() { return this.events.filter(e => e.active); }

  getMult(type) {
    let mult = 1;
    for (const e of this.events) {
      if (e.active && e.type === type) mult *= e.value;
    }
    return mult;
  }

  startEvent(eventId) {
    const e = this.events.find(x => x.id === eventId);
    if (!e || e.active) return false;
    e.active = true;
    e.remaining = e.duration;
    if (this._onEventStart) this._onEventStart(e);
    return true;
  }

  stopEvent(eventId) {
    const e = this.events.find(x => x.id === eventId);
    if (!e || !e.active) return false;
    e.active = false;
    e.remaining = 0;
    if (this._onEventEnd) this._onEventEnd(e);
    return true;
  }

  update(dt) {
    for (const e of this.events) {
      if (!e.active) continue;
      e.remaining -= dt;
      if (e.remaining <= 0) this.stopEvent(e.id);
    }
  }

  getState() {
    return this.events.map(e => ({ id: e.id, title: e.title, desc: e.desc, icon: e.icon, active: e.active, remaining: e.remaining, type: e.type, value: e.value }));
  }

  loadState(saved) {
    if (!saved) return;
    for (const s of saved) {
      const e = this.events.find(x => x.id === s.id);
      if (e) {
        e.active = s.active || false;
        e.remaining = s.remaining || 0;
      }
    }
  }

  getSaveData() {
    return this.events.map(e => ({ id: e.id, active: e.active, remaining: e.remaining }));
  }
}
