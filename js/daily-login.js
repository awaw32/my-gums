const DAILY_REWARDS = [
  { day: 1, icon: "🪙", label: "100 ذهب", reward: { gold: 100 } },
  { day: 2, icon: "💵", label: "500 مال", reward: { cash: 500 } },
  { day: 3, icon: "💎", label: "10 جواهر", reward: { gems: 10 } },
  { day: 4, icon: "🪙", label: "250 ذهب", reward: { gold: 250 } },
  { day: 5, icon: "🌾", label: "200 طعام", reward: { food: 200 } },
  { day: 6, icon: "💵", label: "1000 مال", reward: { cash: 1000 } },
  { day: 7, icon: "👑", label: "50 جواهر + 500 ذهب", reward: { gems: 50, gold: 500 } },
];

// 🏅 مكافآت السلسلة — تُمنح مرة واحدة عند بلوغ كل معلم
const STREAK_MILESTONES = [
  { streak: 7,  gems: 100, label: "أسبوع كامل!" },
  { streak: 14, gems: 250, label: "أسبوعان متتاليان!" },
  { streak: 30, gems: 600, label: "شهر كامل — أسطوري!" },
  { streak: 60, gems: 1500, label: "60 يوماً — لا يُصدَّق!" },
];

export class DailyLoginManager {
  constructor(economy) {
    this.economy = economy;
    this.currentDay = 0;
    this.lastClaimDate = "";
    this.streak = 0;
    this.claimedMilestones = [];
    this._onClaim = null;
    this._onMilestone = null;
  }

  get rewards() { return DAILY_REWARDS; }
  get milestones() { return STREAK_MILESTONES; }

  /** نسبة مكافأة السلسلة الإضافية: +5% لكل يوم متتالٍ، بحد أقصى +100% */
  get streakBonusPercent() {
    return Math.min(100, this.streak * 5);
  }

  /** المعلم القادم غير المستلَم (للعرض في الواجهة) */
  get nextMilestone() {
    return STREAK_MILESTONES.find(m => !this.claimedMilestones.includes(m.streak)) || null;
  }

  checkDaily() {
    const today = new Date().toDateString();
    if (this.lastClaimDate === today) return false;
    if (this.lastClaimDate) {
      const last = new Date(this.lastClaimDate);
      const now = new Date(today);
      const diffDays = Math.floor((now - last) / (1000 * 60 * 60 * 24));
      if (diffDays > 1) {
        // انكسرت السلسلة — تبدأ الدورة من جديد (هذا ما يجعل السلسلة ذات قيمة)
        this.streak = 0;
        this.currentDay = 0;
      }
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
    // مضاعف السلسلة: كل يوم متتالٍ يزيد المكافأة 5% (حتى الضعف)
    const mult = 1 + this.streakBonusPercent / 100;
    if (reward.reward.gold) eco.addRaw("gold", Math.floor(reward.reward.gold * mult));
    if (reward.reward.cash) eco.addRaw("cash", Math.floor(reward.reward.cash * mult));
    if (reward.reward.gems) eco.addRaw("gems", Math.floor(reward.reward.gems * mult));
    if (reward.reward.food) eco.addRaw("food", Math.floor(reward.reward.food * mult));
    // معالم السلسلة — جوائز جواهر ضخمة لمرة واحدة
    const milestone = STREAK_MILESTONES.find(
      m => this.streak >= m.streak && !this.claimedMilestones.includes(m.streak)
    );
    if (milestone) {
      this.claimedMilestones.push(milestone.streak);
      eco.addRaw("gems", milestone.gems);
      if (this._onMilestone) this._onMilestone(milestone);
    }
    if (this._onClaim) this._onClaim(this.currentDay, reward);
    return true;
  }

  getState() {
    const today = new Date().toDateString();
    const canClaim = this.lastClaimDate !== today;
    return {
      currentDay: this.currentDay,
      streak: this.streak,
      streakBonusPercent: this.streakBonusPercent,
      nextMilestone: this.nextMilestone,
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
    this.claimedMilestones = saved.claimedMilestones || [];
  }

  getSaveData() {
    return { currentDay: this.currentDay, lastClaimDate: this.lastClaimDate, streak: this.streak, claimedMilestones: this.claimedMilestones };
  }
}
