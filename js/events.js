const EVENT_TEMPLATES = [
  { id: "gold_rush", title: "🏆 انهيار الذهب", desc: "الذهب من الوحوش ×2", type: "mult_gold", value: 2, duration: 3600, icon: "🪙" },
  { id: "xp_boost", title: "⚡ تضاعف الخبرة", desc: "XP ×2 من كل المصادر", type: "mult_xp", value: 2, duration: 3600, icon: "⭐" },
  { id: "power_week", title: "💪 أسبوع القوة", desc: "قوة الجيش +50%", type: "mult_power", value: 1.5, duration: 86400, icon: "🔥" },
  { id: "pvp_tournament", title: "⚔️ بطولة PvP", desc: "مكافآت PvP ×3", type: "mult_pvp", value: 3, duration: 7200, icon: "🏟️" },
  { id: "oasis_bonus", title: "🌴 ازدهار الواحات", desc: "دخل الواحات ×3", type: "mult_oasis", value: 3, duration: 3600, icon: "🌴" },
  { id: "camel_race", title: "🐪 سباق الإبل", desc: "قوة الجيش ×2 لمدة 24 ساعة!", type: "mult_power", value: 2, duration: 86400, icon: "🐪" },
];

export class EventManager {
  constructor() {
    this.events = EVENT_TEMPLATES.map(e => ({ ...e, active: false, remaining: 0 }));
    this._onEventStart = null;
    this._onEventEnd = null;
    this._weekKey = 0;
  }

  /**
   * 🔥 حدث الأسبوع — دوران حتمي محسوب من رقم الأسبوع (نفس الحدث لجميع اللاعبين
   * في نفس الأسبوع تلقائياً بلا حاجة لسيرفر). يُستدعى مرة عند بدء اللعبة.
   * يعيد الحدث النشط الجديد إن بدأ لتوّه، أو null إن كان مستمراً من جلسة سابقة.
   */
  ensureWeeklyEvent() {
    const nowWeek = Math.floor(Date.now() / (7 * 24 * 3600 * 1000));
    if (this._weekKey === nowWeek) return null; // مُفعَّل بالفعل هذا الأسبوع
    // أوقف حدث الأسبوع الماضي إن كان لا يزال نشطاً محلياً
    const prevWeekly = this.events.find(e => e._isWeekly && e.active);
    if (prevWeekly) this.stopEvent(prevWeekly.id);
    this._weekKey = nowWeek;
    const pick = EVENT_TEMPLATES[nowWeek % EVENT_TEMPLATES.length];
    const e = this.events.find(x => x.id === pick.id);
    if (!e) return null;
    e._isWeekly = true;
    e.active = true;
    // ينتهي مع نهاية الأسبوع التقويمي الحالي (وليس بعد duration الثابتة)
    e.remaining = (nowWeek + 1) * 7 * 24 * 3600 * 1000 / 1000 - Date.now() / 1000;
    if (this._onEventStart) this._onEventStart(e);
    return e;
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
    const list = Array.isArray(saved) ? saved : (saved.events || []);
    for (const s of list) {
      const e = this.events.find(x => x.id === s.id);
      if (e) {
        e.active = s.active || false;
        e.remaining = s.remaining || 0;
      }
    }
    this._weekKey = (!Array.isArray(saved) && saved.weekKey) || 0;
  }

  getSaveData() {
    return {
      events: this.events.map(e => ({ id: e.id, active: e.active, remaining: e.remaining })),
      weekKey: this._weekKey,
    };
  }
}
