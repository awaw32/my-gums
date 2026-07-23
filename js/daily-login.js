// 🏛️ مجلس الشيوخ — مكافآت العودة اليومية بسلسلة 1-7 أيام + حكمة الصحراء
const DAILY_REWARDS = [
  { day: 1, icon: "🪙", label: "100 ذهب", reward: { gold: 100 }, wisdom: "من غزا الصحراء صباحاً، عاد بغنيمة قبل الظهر." },
  { day: 2, icon: "💵", label: "500 مال", reward: { cash: 500 }, wisdom: "الصبر مفتاح الفرج، والقافلة الصابرة تصل." },
  { day: 3, icon: "💎", label: "10 جواهر", reward: { gems: 10 }, wisdom: "يا شيخ، الجوهرة النادرة لا تُمنح إلا لمن ثبت." },
  { day: 4, icon: "🪙", label: "250 ذهب", reward: { gold: 250 }, wisdom: "أربعة أيام من الوفاء تبني سمعة تدوم عمراً." },
  { day: 5, icon: "🌾", label: "200 طعام", reward: { food: 200 }, wisdom: "من خزّن طعامه في الرخاء، نجا في الشدة." },
  { day: 6, icon: "💵", label: "1000 مال", reward: { cash: 1000 }, wisdom: "هلا والله، اقتربت من صندوق مجلس الشيوخ الأسطوري!" },
  { day: 7, icon: "👑", label: "صندوق أسطوري (50 جوهرة + 500 ذهب + لقب الوفي)", reward: { gems: 50, gold: 500 }, wisdom: "من ثبت أسبوعاً كاملاً، نال لقب 'الوفي' وشرف مجلس الشيوخ.", isLegendaryChest: true },
];

// 🏅 مكافآت السلسلة — تُمنح مرة واحدة عند بلوغ كل معلم
const STREAK_MILESTONES = [
  { streak: 7,  gems: 100, label: "أسبوع كامل!" },
  { streak: 14, gems: 250, label: "أسبوعان متتاليان!" },
  { streak: 30, gems: 600, label: "شهر كامل — أسطوري!" },
  { streak: 60, gems: 1500, label: "60 يوماً — لا يُصدَّق!" },
];

const LOYAL_TITLE = "الوفي";

export class DailyLoginManager {
  constructor(economy) {
    this.economy = economy;
    this.currentDay = 0;
    this.lastClaimDate = "";
    this.streak = 0;
    this.claimedMilestones = [];
    this.loyalTitleEarned = false;
    this._onClaim = null;
    this._onMilestone = null;
    this._onLoyalTitleLost = null;
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

  get loyalTitle() { return LOYAL_TITLE; }

  checkDaily() {
    const today = new Date().toDateString();
    if (this.lastClaimDate === today) return false;
    if (this.lastClaimDate) {
      const last = new Date(this.lastClaimDate);
      const now = new Date(today);
      const diffDays = Math.floor((now - last) / (1000 * 60 * 60 * 24));
      if (diffDays > 1) {
        // 🏛️ قُطع يوم — السلسلة تعود ليوم واحد فقط، ويُفقد لقب "الوفي" إن كان مكتسباً
        this.streak = 1;
        this.currentDay = 0;
        if (this.loyalTitleEarned) {
          this.loyalTitleEarned = false;
          if (this._onLoyalTitleLost) this._onLoyalTitleLost();
        }
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
    if (reward.isLegendaryChest) {
      this.loyalTitleEarned = true;
    }
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
      loyalTitleEarned: this.loyalTitleEarned,
      loyalTitle: LOYAL_TITLE,
    };
  }

  loadState(saved) {
    if (!saved) return;
    this.currentDay = saved.currentDay || 0;
    this.lastClaimDate = saved.lastClaimDate || "";
    this.streak = saved.streak || 0;
    this.claimedMilestones = saved.claimedMilestones || [];
    this.loyalTitleEarned = saved.loyalTitleEarned || false;
  }

  getSaveData() {
    return {
      currentDay: this.currentDay,
      lastClaimDate: this.lastClaimDate,
      streak: this.streak,
      claimedMilestones: this.claimedMilestones,
      loyalTitleEarned: this.loyalTitleEarned,
    };
  }
}
