"use strict";

const REP_TITLES = [
  { min: -10000, max: -5001, name: "منبوذ", icon: "💀" },
  { min: -5000,  max: -1001, name: "مكروه", icon: "☠️" },
  { min: -1000,  max: -101,  name: "سيئ السمعة", icon: "👎" },
  { min: -100,   max: 100,   name: "محايد", icon: "😐" },
  { min: 101,    max: 1000,  name: "حسن السمعة", icon: "👍" },
  { min: 1001,   max: 5000,  name: "موثوق", icon: "⭐" },
  { min: 5001,   max: 10000, name: "أسطورة", icon: "👑" },
];

export class ReputationManager {
  constructor() {
    this.score = 0;
    this._events = [];
  }

  getLevel() {
    return REP_TITLES.findIndex(t => this.score >= t.min && this.score <= t.max);
  }

  getTitle() {
    return REP_TITLES.find(t => this.score >= t.min && this.score <= t.max) || REP_TITLES[3];
  }

  get tradeModifier() {
    if (this.score >= 0) return 1 + (this.score / 10000) * 0.1;
    return 1 + (this.score / 10000) * 0.2;
  }

  get raidDamageBonus() {
    return Math.max(0, Math.floor(this.score / 1000) * 5);
  }

  get incomeBonus() {
    return Math.floor(this.score / 500) * 0.3;
  }

  addScore(amount, reason) {
    const oldTitle = this.getTitle().name;
    this.score = Math.max(-10000, Math.min(10000, this.score + amount));
    const newTitle = this.getTitle().name;
    this._events.push({ amount, reason, time: Date.now() });
    if (this._events.length > 50) this._events.shift();
    return { changed: oldTitle !== newTitle, oldTitle, newTitle, score: this.score };
  }

  getRecentEvents(count = 10) {
    return this._events.slice(-count).reverse();
  }

  getSaveData() {
    return { score: this.score };
  }

  loadState(data) {
    if (data && typeof data.score === "number") this.score = data.score;
  }
}
