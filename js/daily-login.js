const DAILY_REWARDS = [
  { day: 1, icon: "🪙", label: "100 ذهب", reward: { gold: 100 } },
  { day: 2, icon: "💵", label: "500 مال", reward: { cash: 500 } },
  { day: 3, icon: "💎", label: "10 جواهر", reward: { gems: 10 } },
  { day: 4, icon: "🪙", label: "250 ذهب", reward: { gold: 250 } },
  { day: 5, icon: "🌾", label: "200 طعام", reward: { food: 200 } },
  { day: 6, icon: "💵", label: "1000 مال", reward: { cash: 1000 } },
  { day: 7, icon: "👑", label: "50 جواهر + 500 ذهب", reward: { gems: 50, gold: 500 } },
];

export class DailyLoginManager {
  constructor(economy) {
    this.economy = economy;
    this.currentDay = 0;
    this.lastClaimDate = "";
    this.streak = 0;
    this._onClaim = null;
  }

  get rewards() { return DAILY_REWARDS; }

  checkDaily() {
    const today = new Date().toDateString();
    if (this.lastClaimDate === today) return false;
    if (this.lastClaimDate) {
      const last = new Date(this.lastClaimDate);
      const now = new Date(today);
      const diffDays = Math.floor((now - last) / (1000 * 60 * 60 * 24));
      if (diffDays > 1) this.streak = 0;
    }
    return true;
  }

  claim() {
    if (!this.checkDaily()) return false;
    const today = new Date().toDateString();
    this.lastClaimDate = today;
    this.currentDay = (this.currentDay % 7) + 1;
    this.streak++;
    const reward = DAILY_REWARDS[this.currentDay - 1];
    const eco = this.economy;
    if (reward.reward.gold) eco.addRaw("gold", reward.reward.gold);
    if (reward.reward.cash) eco.addRaw("cash", reward.reward.cash);
    if (reward.reward.gems) eco.addRaw("gems", reward.reward.gems);
    if (reward.reward.food) eco.addRaw("food", reward.reward.food);
    if (this._onClaim) this._onClaim(this.currentDay, reward);
    return true;
  }

  getState() {
    const today = new Date().toDateString();
    const canClaim = this.lastClaimDate !== today;
    return {
      currentDay: this.currentDay,
      streak: this.streak,
      canClaim,
      lastClaimDate: this.lastClaimDate,
      today,
      rewards: DAILY_REWARDS,
    };
  }

  loadState(saved) {
    if (!saved) return;
    this.currentDay = saved.currentDay || 0;
    this.lastClaimDate = saved.lastClaimDate || "";
    this.streak = saved.streak || 0;
  }

  getSaveData() {
    return { currentDay: this.currentDay, lastClaimDate: this.lastClaimDate, streak: this.streak };
  }
}
