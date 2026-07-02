export const OASIS_DATA = [
  { id: 1, name: "واحة البداية", icon: "🌴", status: "free", capturePower: 0, income: 5 },
  { id: 2, name: "واحة النخيل", icon: "🌵", status: "hostile", capturePower: 200, income: 15 },
  { id: 3, name: "واحة الكنز", icon: "💎", status: "hostile", capturePower: 500, income: 35 },
  { id: 4, name: "واحة الأساطير", icon: "🏺", status: "hostile", capturePower: 1200, income: 80 },
  { id: 5, name: "واحة الفراعنة", icon: "👑", status: "hostile", capturePower: 3000, income: 200 },
];

export class OasisManager {
  constructor(economy) {
    this.economy = economy;
    this.oases = OASIS_DATA.map(o => ({ ...o, captured: o.status === "free" }));
    this._onOasesChanged = null;
    this._events = null; // مرجع لـ EventManager
    this._accGold = 0;
    this._payoutInterval = 15; // كل 15 ثانية
  }

  get totalIncome() {
    return this.oases.reduce((sum, o) => o.captured ? sum + o.income : sum, 0);
  }

  get capturedCount() {
    return this.oases.filter(o => o.captured).length;
  }

  canCapture(oasisId) {
    const o = this.oases.find(o => o.id === oasisId);
    if (!o || o.captured) return false;
    if (o.status === "free") return true;
    // يتطلب قوة + ذهب لفتح الواحة
    if (this.economy.power < o.capturePower) return false;
    const cost = o.id * 100; // 100, 200, 300, 400 ذهب حسب الواحة
    return this.economy.gold >= cost;
  }

  capture(oasisId) {
    const o = this.oases.find(o => o.id === oasisId);
    if (!o || o.captured) return false;
    if (o.status === "free") {
      o.captured = true;
      this.economy.addXp(50);
      if (this._onOasesChanged) this._onOasesChanged(this.getState());
      return true;
    }
    if (this.economy.power < o.capturePower) return false;
    const cost = o.id * 100;
    if (this.economy.gold < cost) return false;
    this.economy.gold -= cost;
    o.captured = true;
    this.economy.addXp(50);
    if (this._onOasesChanged) this._onOasesChanged(this.getState());
    return true;
  }

  tick(dt) {
    let income = this.totalIncome;
    if (income > 0) {
      if (this._events) {
        const mult = this._events.getMult("mult_oasis");
        if (mult > 1) income *= mult;
      }
      this._accGold += income * dt;
      if (this._accGold >= 1) {
        const payout = Math.floor(this._accGold);
        this.economy.addRaw("gold", payout);
        this._accGold -= payout;
      }
    }
  }

  getState() {
    return this.oases.map(o => ({ id: o.id, name: o.name, icon: o.icon, captured: o.captured, capturePower: o.capturePower, income: o.income }));
  }

  loadState(saved) {
    if (!saved || !Array.isArray(saved)) return;
    for (const s of saved) {
      const o = this.oases.find(o => o.id === s.id);
      if (o) o.captured = s.captured;
    }
  }
}
