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

// 🏛️ رحلة الشيخ — مكافآت المسار المميز الموازية لكل يوم في السلسلة (30 يوماً/موسم)
// كلها زخرفية أو موارد عادية — لا قوة قتالية إطلاقاً، فقط مضاعف زخرفي للقب الوفي
const PREMIUM_TRACK_REWARDS = [
  { day: 1, icon: "📦", label: "صندوق إضافي صغير", reward: { gold: 50 } },
  { day: 2, icon: "📦", label: "صندوق إضافي", reward: { cash: 200 } },
  { day: 3, icon: "📜", label: "حكمة نادرة", wisdom: "من ملك رحلة الشيخ، عرف أسرار الصحراء التي لا تُقال لعامة الناس." },
  { day: 4, icon: "📦", label: "صندوق إضافي", reward: { gold: 100 } },
  { day: 5, icon: "📦", label: "صندوق إضافي", reward: { food: 100 } },
  { day: 6, icon: "📜", label: "حكمة نادرة", wisdom: "يا شيخ الشيوخ، رحلتك المميزة تليق بمن ثبت." },
  { day: 7, icon: "👑", label: "صندوق مميز أسطوري + مضاعف زخرفي للقب الوفي", reward: { gold: 200 }, loyalTitleDecoration: "✨" },
];
const SEASON_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 يوماً — نفس مدة الموسم على الخادم
const PREMIUM_UNLOCK_COST_GEMS = 100;

export class DailyLoginManager {
  constructor(economy, netSync = null) {
    this.economy = economy;
    this.netSync = netSync;
    this.currentDay = 0;
    this.lastClaimDate = "";
    this.streak = 0;
    this.claimedMilestones = [];
    this.loyalTitleEarned = false;
    this._onClaim = null;
    this._onMilestone = null;
    this._onLoyalTitleLost = null;
    // 🛡️ طلب استلام معلّق بانتظار رد الخادم — يمنع نقر متكرر يرسل طلبات مكررة
    this._pendingClaim = false;
    // 🏛️ رحلة الشيخ — حالة المسار المميز (الفتح نفسه سيرفر-موثوق عبر season_pass_unlock)
    this.seasonKey = 0;
    this.premiumUnlocked = false;
    this._onPremiumUnlocked = null;
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
  get premiumRewards() { return PREMIUM_TRACK_REWARDS; }

  /** مفتاح الموسم الحالي (محلياً — للعرض فقط؛ الخادم هو المصدر الموثوق للفتح) */
  get currentSeasonKey() {
    return Math.floor(Date.now() / SEASON_DURATION_MS);
  }

  /** يُستدعى عند استقبال season_pass_state من الخادم عند الاتصال */
  syncSeasonState(seasonKey, premiumUnlocked) {
    if (this.seasonKey !== seasonKey) {
      // موسم جديد — يعاد ضبط حالة الفتح المحلية لتطابق الخادم دائماً
      this.seasonKey = seasonKey;
      this.premiumUnlocked = premiumUnlocked;
    } else {
      this.premiumUnlocked = premiumUnlocked;
    }
  }

  /** يُستدعى بعد رد season_pass_unlock_response الناجح من الخادم فقط */
  confirmPremiumUnlocked(seasonKey) {
    this.seasonKey = seasonKey;
    this.premiumUnlocked = true;
    if (this._onPremiumUnlocked) this._onPremiumUnlocked();
  }

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

  /** يرسل طلب استلام للخادم — الموارد لا تُطبَّق هنا إطلاقاً، فقط بعد تأكيد
   *  الخادم عبر _handleClaimResponse. كان هذا محسوباً بالكامل محلياً من قبل،
   *  ما يعني أن أي تلاعب بحالة العميل (localStorage) يمنح موارد غير محدودة
   *  يومياً دون أي رصد سيرفري — أصبح الآن lastClaimDate/streak/الموارد كلها
   *  تُقرأ وتُكتب حصراً على الخادم (memStore.dailyLogin). */
  claim() {
    if (this._pendingClaim) return false;
    if (!this.checkDaily()) return false;
    if (!this.netSync || !this.netSync.isConnected) return false;
    this._pendingClaim = true;
    this.netSync.send({ type: "daily_login_claim" });
    return true;
  }

  /** يُستدعى من handleNetMessage عند وصول daily_login_claim_response */
  _handleClaimResponse(msg) {
    this._pendingClaim = false;
    if (!msg.ok) return;
    // ✅ تأكيد الخادم وصل — الموارد أُضيفت فعلياً هناك؛ نطبّق النتيجة محلياً فقط للعرض
    this.lastClaimDate = new Date().toDateString();
    this.currentDay = msg.currentDay;
    this.streak = msg.streak;
    if (msg.loyalTitleLost && this._onLoyalTitleLost) this._onLoyalTitleLost();
    this.loyalTitleEarned = !!msg.loyalTitleEarned;

    const eco = this.economy;
    const granted = msg.granted || {};
    for (const [res, amount] of Object.entries(granted)) {
      eco.addRaw(res, amount);
    }
    const reward = DAILY_REWARDS[this.currentDay - 1];

    if (msg.milestone) {
      this.claimedMilestones.push(msg.milestone.streak);
      if (this._onMilestone) this._onMilestone(msg.milestone);
    }
    // 🏛️ المسار المميز يبقى زخرفياً بحتاً (لا موارد حسّاسة) — يُمنح محلياً فقط
    // إن كان مفتوحاً فعلياً لهذا الموسم (الفتح نفسه مؤكَّد سيرفرياً مسبقاً)
    let premiumReward = null;
    if (this.premiumUnlocked && this.seasonKey === this.currentSeasonKey) {
      const mult = 1 + this.streakBonusPercent / 100;
      premiumReward = PREMIUM_TRACK_REWARDS[this.currentDay - 1];
      if (premiumReward.reward?.gold) eco.addRaw("gold", Math.floor(premiumReward.reward.gold * mult));
      if (premiumReward.reward?.cash) eco.addRaw("cash", Math.floor(premiumReward.reward.cash * mult));
      if (premiumReward.reward?.food) eco.addRaw("food", Math.floor(premiumReward.reward.food * mult));
    }
    if (this._onClaim) this._onClaim(this.currentDay, reward, premiumReward);
  }

  /** يُستدعى عند الاتصال إن كان للخادم حالة محفوظة (lastClaimDate/streak) —
   *  تطابق سيرفرية دائماً، تتجاوز أي حالة محلية قديمة (localStorage) */
  syncServerState(state) {
    if (!state) return;
    this.currentDay = state.currentDay || 0;
    this.lastClaimDate = state.lastClaimDate || "";
    this.streak = state.streak || 0;
    this.claimedMilestones = state.claimedMilestones || [];
    this.loyalTitleEarned = !!state.loyalTitleEarned;
  }

  getState() {
    const today = new Date().toDateString();
    const canClaim = this.lastClaimDate !== today;
    const seasonActive = this.seasonKey === this.currentSeasonKey && this.premiumUnlocked;
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
      premiumRewards: PREMIUM_TRACK_REWARDS,
      premiumUnlocked: seasonActive,
      premiumUnlockCostGems: PREMIUM_UNLOCK_COST_GEMS,
      seasonKey: this.currentSeasonKey,
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
