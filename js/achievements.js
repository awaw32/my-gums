const ACHIEVEMENTS = [
  { id: "first_kill", title: "الدم الأول", desc: "اقتل أول وحش", icon: "🗡️", target: 1, type: "kills", reward: { gold: 50 } },
  { id: "kill_10", title: "صائاد", desc: "اقتل 10 وحوش", icon: "🏹", target: 10, type: "kills", reward: { gold: 100, gems: 5 } },
  { id: "kill_50", title: "صياد محترف", desc: "اقتل 50 وحشاً", icon: "⚔️", target: 50, type: "kills", reward: { gold: 300, gems: 15 } },
  { id: "kill_100", title: "سفاح الصحراء", desc: "اقتل 100 وحش", icon: "💀", target: 100, type: "kills", reward: { gold: 600, gems: 30 } },
  { id: "kill_500", title: "أسطورة الصيد", desc: "اقتل 500 وحش", icon: "👑", target: 500, type: "kills", reward: { gold: 2000, gems: 100 } },
  { id: "kill_1000", title: "إله الصحراء", desc: "اقتل 1000 وحش", icon: "🔥", target: 1000, type: "kills", reward: { gold: 5000, gems: 250 } },
  { id: "build_1", title: "بداية البناء", desc: "ابنِ أول مبنى", icon: "🏠", target: 1, type: "builds", reward: { cash: 200 } },
  { id: "build_10", title: "مقاول", desc: "ابنِ 10 مباني", icon: "🏗️", target: 10, type: "builds", reward: { cash: 1000, gold: 200 } },
  { id: "build_50", title: "مهندس الصحراء", desc: "ابنِ 50 مبنى", icon: "🏰", target: 50, type: "builds", reward: { cash: 5000, gold: 800 } },
  { id: "upgrade_10", title: "مطور", desc: "طوّر 10 مستويات مباني", icon: "⬆️", target: 10, type: "upgrades", reward: { gold: 150 } },
  { id: "upgrade_50", title: "مطور محترف", desc: "طوّر 50 مستوى مباني", icon: "📈", target: 50, type: "upgrades", reward: { gold: 500, gems: 25 } },
  { id: "upgrade_200", title: "مطور أسطوري", desc: "طوّر 200 مستوى مباني", icon: "🏛️", target: 200, type: "upgrades", reward: { gold: 2000, gems: 100 } },
  { id: "weapon_1", title: "جامع أسلحة", desc: "ارفع سلاحاً للمستوى 10", icon: "🗡️", target: 10, type: "weapon_max", reward: { gold: 100 } },
  { id: "weapon_3", title: "تاجر سلاح", desc: "ارفع سلاحاً للمستوى 25", icon: "⚒️", target: 25, type: "weapon_max", reward: { gold: 400, gems: 20 } },
  { id: "weapon_5", title: "صانع أسلحة أسطوري", desc: "ارفع سلاحاً للمستوى 50", icon: "⚔️", target: 50, type: "weapon_max", reward: { gold: 1500, gems: 75 } },
  { id: "army_10", title: "قائد جيش", desc: "ارفع الجيش للمستوى 10", icon: "🪖", target: 10, type: "army_level", reward: { gold: 200 } },
  { id: "army_25", title: "جنرال", desc: "ارفع الجيش للمستوى 25", icon: "🎖️", target: 25, type: "army_level", reward: { gold: 600, gems: 30 } },
  { id: "army_50", title: "مارشال", desc: "ارفع الجيش للمستوى 50", icon: "🏅", target: 50, type: "army_level", reward: { gold: 2000, gems: 100 } },
  { id: "army_100", title: "القائد الأعلى", desc: "ارفع الجيش للمستوى 100", icon: "👑", target: 100, type: "army_level", reward: { gold: 5000, gems: 250 } },
  { id: "pvp_1", title: "أول انتصار", desc: "اربح أول معركة PvP", icon: "⚔️", target: 1, type: "pvp_wins", reward: { gold: 100, gems: 5 } },
  { id: "pvp_10", title: "مقاتل", desc: "اربح 10 معارك PvP", icon: "🛡️", target: 10, type: "pvp_wins", reward: { gold: 500, gems: 25 } },
  { id: "pvp_50", title: "بطل الساحة", desc: "اربح 50 معركة PvP", icon: "🏆", target: 50, type: "pvp_wins", reward: { gold: 2000, gems: 100 } },
  { id: "coins_1k", title: "جامع المال", desc: "اجمع 1,000 💵", icon: "💰", target: 1000, type: "cash_earned", reward: { gold: 50 } },
  { id: "coins_100k", title: "تاجر", desc: "اجمع 100,000 💵", icon: "💎", target: 100000, type: "cash_earned", reward: { gold: 200, gems: 10 } },
  { id: "coins_1m", title: "مليونير", desc: "اجمع 1,000,000 💵", icon: "🤑", target: 1000000, type: "cash_earned", reward: { gold: 1000, gems: 50 } },
  { id: "coins_1b", title: "بليونير", desc: "اجمع 1,000,000,000 💵", icon: "💲", target: 1000000000, type: "cash_earned", reward: { gold: 5000, gems: 250 } },
  { id: "gold_1k", title: "جامع الذهب", desc: "اجمع 1,000 🪙", icon: "🪙", target: 1000, type: "gold_earned", reward: { gems: 10 } },
  { id: "gold_100k", title: "ثري", desc: "اجمع 100,000 🪙", icon: "👑", target: 100000, type: "gold_earned", reward: { gems: 50 } },
  { id: "oasis_2", title: "مستكشف", desc: "سيطر على واحتين", icon: "🌴", target: 2, type: "oases", reward: { gold: 200 } },
  { id: "oasis_4", title: "فاتح", desc: "سيطر على 4 واحات", icon: "🗺️", target: 4, type: "oases", reward: { gold: 600, gems: 30 } },
  { id: "oasis_5", title: "سلطان الصحراء", desc: "سيطر على كل الواحات", icon: "👑", target: 5, type: "oases", reward: { gold: 2000, gems: 100 } },
  { id: "alliance_1", title: "متحد", desc: "طوّر التحالف للمستوى 1", icon: "🤝", target: 1, type: "alliance_level", reward: { gold: 100 } },
  { id: "alliance_4", title: "إمبراطور", desc: "طوّر التحالف للمستوى 4", icon: "🏰", target: 4, type: "alliance_level", reward: { gold: 1000, gems: 50 } },
  { id: "dmg_upgrade", title: "مقاتل", desc: "طوّر الضرر لأقصى مستوى", icon: "⚔️", target: 4, type: "upgrade_damage", reward: { gold: 300, gems: 15 } },
  { id: "def_upgrade", title: "حصن", desc: "طوّر الدفاع لأقصى مستوى", icon: "🛡️", target: 4, type: "upgrade_defense", reward: { gold: 300, gems: 15 } },
  { id: "cap_upgrade", title: "مخزني", desc: "طوّر السعة لأقصى مستوى", icon: "📦", target: 4, type: "upgrade_capacity", reward: { gold: 300, gems: 15 } },
  { id: "spd_upgrade", title: "الريح", desc: "طوّر السرعة لأقصى مستوى", icon: "💨", target: 4, type: "upgrade_speed", reward: { gold: 300, gems: 15 } },
  { id: "prestige_1", title: "إعادة ميلاد", desc: "افعل Prestige أول مرة", icon: "🔄", target: 1, type: "prestige", reward: { gems: 200 } },
  { id: "prestige_3", title: "عاشوراء", desc: "افعل Prestige 3 مرات", icon: "🔥", target: 3, type: "prestige", reward: { gems: 500 } },
  { id: "level_10", title: "متطور", desc: "اصل للمستوى 10", icon: "⭐", target: 10, type: "player_level", reward: { gold: 200, gems: 10 } },
  { id: "level_25", title: "مخضرم", desc: "اصل للمستوى 25", icon: "🌟", target: 25, type: "player_level", reward: { gold: 500, gems: 25 } },
  { id: "level_50", title: "أسطورة", desc: "اصل للمستوى 50", icon: "💫", target: 50, type: "player_level", reward: { gold: 1500, gems: 75 } },
  { id: "level_75", title: "خرافة", desc: "اصل للمستوى 75", icon: "✨", target: 75, type: "player_level", reward: { gold: 3000, gems: 150 } },
  { id: "level_110", title: "الأعلى", desc: "اصل للمستوى 110", icon: "👑", target: 110, type: "player_level", reward: { gold: 10000, gems: 500 } },
  { id: "login_3", title: "منتظم", desc: "سجل دخول 3 أيام", icon: "📅", target: 3, type: "login_days", reward: { gold: 100 } },
  { id: "login_7", title: "مدمن", desc: "سجل دخول 7 أيام", icon: "🔥", target: 7, type: "login_days", reward: { gold: 500, gems: 25 } },
  { id: "login_30", title: "وفي", desc: "سجل دخول 30 يوماً", icon: "💎", target: 30, type: "login_days", reward: { gold: 2000, gems: 100 } },
  { id: "power_1k", title: "بداية القوة", desc: "قوتك تصل 1,000", icon: "💪", target: 1000, type: "power", reward: { gold: 100 } },
  { id: "power_10k", title: "قوي", desc: "قوتك تصل 10,000", icon: "💪", target: 10000, type: "power", reward: { gold: 300, gems: 15 } },
  { id: "power_100k", title: "جبار", desc: "قوتك تصل 100,000", icon: "🔥", target: 100000, type: "power", reward: { gold: 1000, gems: 50 } },
  { id: "power_1m", title: "عملاق", desc: "قوتك تصل 1,000,000", icon: "💥", target: 1000000, type: "power", reward: { gold: 5000, gems: 250 } },
  { id: "craft_1", title: "صانع", desc: "اصنع أول قطعة", icon: "🔨", target: 1, type: "crafts", reward: { gold: 100 } },
  { id: "craft_10", title: "حرفي", desc: "اصنع 10 قطع", icon: "⚒️", target: 10, type: "crafts", reward: { gold: 300, gems: 15 } },
  { id: "chat_1", title: "ثرثار", desc: "أرسل أول رسالة", icon: "💬", target: 1, type: "chat_messages", reward: { gold: 50 } },
  { id: "story_3", title: "راوي", desc: "شاهد 3 مشاهد قصصية", icon: "📖", target: 3, type: "story_scenes", reward: { gold: 100, gems: 5 } },
  { id: "story_9", title: "قاص", desc: "شاهد 9 مشاهد قصصية", icon: "📚", target: 9, type: "story_scenes", reward: { gold: 500, gems: 25 } },
  { id: "story_15", title: "مؤرخ الصحراء", desc: "شاهد كل مشاهد القصة", icon: "👑", target: 15, type: "story_scenes", reward: { gold: 2000, gems: 100 } },
];

export class AchievementManager {
  constructor(economy) {
    this.economy = economy;
    this.achievements = ACHIEVEMENTS.map(a => ({ ...a, completed: false, claimed: false, progress: 0 }));
    this.listeners = [];
    this._onUnlock = null;
  }

  getAll() { return this.achievements; }

  getCompletedCount() { return this.achievements.filter(a => a.completed && a.claimed).length; }

  getProgress(type) {
    let total = 0;
    for (const a of this.achievements) total += a.completed ? 1 : 0;
    return total;
  }

  updateProgress(type, amount = 1) {
    for (const a of this.achievements) {
      if (a.completed || a.type !== type) continue;
      a.progress += amount;
      if (a.progress >= a.target) {
        a.completed = true;
        if (this._onUnlock) this._onUnlock(a);
      }
    }
  }

  claim(id) {
    const a = this.achievements.find(x => x.id === id);
    if (!a || !a.completed || a.claimed) return false;
    a.claimed = true;
    const eco = this.economy;
    if (a.reward.gold) eco.addRaw("gold", a.reward.gold);
    if (a.reward.gems) eco.addRaw("gems", a.reward.gems);
    if (a.reward.cash) eco.addRaw("cash", a.reward.cash);
    return true;
  }

  loadState(saved) {
    if (!saved) return;
    for (const s of saved) {
      const a = this.achievements.find(x => x.id === s.id);
      if (a) {
        a.completed = s.completed || false;
        a.claimed = s.claimed || false;
        a.progress = s.progress || 0;
      }
    }
  }

  getSaveData() {
    return this.achievements.map(a => ({ id: a.id, completed: a.completed, claimed: a.claimed, progress: a.progress }));
  }
}
