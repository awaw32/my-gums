export class AudioManager {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.musicGain = null;
    this.sfxGain = null;
    this._initOnInteraction = () => this._init();
    document.addEventListener("pointerdown", this._initOnInteraction, { once: true });
    document.addEventListener("keydown", this._initOnInteraction, { once: true });
  }

  _init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.3;
      this.musicGain.connect(this.ctx.destination);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.5;
      this.sfxGain.connect(this.ctx.destination);
    } catch (e) {
      console.warn("[Audio] Web Audio API unavailable");
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.sfxGain) this.sfxGain.gain.value = this.muted ? 0 : 0.5;
    if (this.musicGain) this.musicGain.gain.value = this.muted ? 0 : 0.3;
  }

  _ensure() { if (!this.ctx) this._init(); }

  _playTone(freq, duration, type, gainNode) {
    this._ensure();
    if (!this.ctx || !gainNode) return;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = type || "square";
    osc.frequency.value = freq;
    env.gain.setValueAtTime(0.3, this.ctx.currentTime);
    env.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    osc.connect(env);
    env.connect(gainNode);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  sfxSword() {
    this._playTone(200 + Math.random() * 100, 0.08, "square", this.sfxGain);
  }

  sfxHit() {
    this._playTone(100, 0.15, "sawtooth", this.sfxGain);
  }

  sfxVictory() {
    this._ensure();
    if (!this.ctx || !this.sfxGain) return;
    [400, 500, 600].forEach((f, i) => {
      setTimeout(() => this._playTone(f, 0.2, "sine", this.sfxGain), i * 100);
    });
  }

  sfxClick() {
    this._playTone(800, 0.05, "square", this.sfxGain);
  }

  sfxBuild() {
    this._playTone(300, 0.3, "triangle", this.sfxGain);
  }

  sfxCollect() {
    this._ensure();
    if (!this.ctx || !this.sfxGain) return;
    [600, 800].forEach((f, i) => {
      setTimeout(() => this._playTone(f, 0.1, "sine", this.sfxGain), i * 60);
    });
  }

  sfxLevelup() {
    this._ensure();
    if (!this.ctx || !this.sfxGain) return;
    [300, 400, 500, 600].forEach((f, i) => {
      setTimeout(() => this._playTone(f, 0.15, "sine", this.sfxGain), i * 80);
    });
  }

  sfxCoin() {
    this.sfxCollect();
  }

  sfxUpgrade() {
    this._ensure();
    if (!this.ctx || !this.sfxGain) return;
    [500, 700, 900].forEach((f, i) => {
      setTimeout(() => this._playTone(f, 0.15, "sine", this.sfxGain), i * 80);
    });
  }

  sfxHeal() {
    this._ensure();
    if (!this.ctx || !this.sfxGain) return;
    [400, 500, 600, 700].forEach((f, i) => {
      setTimeout(() => this._playTone(f, 0.12, "sine", this.sfxGain), i * 60);
    });
  }

  sfxBuy() {
    this._ensure();
    if (!this.ctx || !this.sfxGain) return;
    [300, 500].forEach((f, i) => {
      setTimeout(() => this._playTone(f, 0.1, "square", this.sfxGain), i * 70);
    });
  }

  sfxAbility() {
    this._ensure();
    if (!this.ctx || !this.sfxGain) return;
    [600, 800, 1000, 1200].forEach((f, i) => {
      setTimeout(() => this._playTone(f, 0.1, "sine", this.sfxGain), i * 50);
    });
  }

  sfxError() {
    this._ensure();
    if (!this.ctx || !this.sfxGain) return;
    [200, 150].forEach((f, i) => {
      setTimeout(() => this._playTone(f, 0.15, "sawtooth", this.sfxGain), i * 100);
    });
  }

  sfxHeroLevelup() {
    this._ensure();
    if (!this.ctx || !this.sfxGain) return;
    [400, 500, 600, 700, 800].forEach((f, i) => {
      setTimeout(() => this._playTone(f, 0.15, "sine", this.sfxGain), i * 70);
    });
  }

  sfxOffline() {
    this._ensure();
    if (!this.ctx || !this.sfxGain) return;
    [300, 400, 500].forEach((f, i) => {
      setTimeout(() => this._playTone(f, 0.2, "triangle", this.sfxGain), i * 120);
    });
  }

  // ========== Weapon-specific sounds (oscillator synthesis) ==========

  /**
   * Play a frequency sweep (for swoosh/shing effects)
   */
  _playSweep(startFreq, endFreq, duration, type, gainNode) {
    this._ensure();
    if (!this.ctx || !gainNode) return;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = type || "sine";
    osc.frequency.setValueAtTime(startFreq, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(endFreq, this.ctx.currentTime + duration);
    env.gain.setValueAtTime(0.25, this.ctx.currentTime);
    env.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    osc.connect(env);
    env.connect(gainNode);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  /**
   * Play multiple tones simultaneously (for chord-like sounds)
   */
  _playChord(freqs, duration, type, gainNode) {
    this._ensure();
    if (!this.ctx || !gainNode) return;
    for (const f of freqs) {
      const osc = this.ctx.createOscillator();
      const env = this.ctx.createGain();
      osc.type = type || "sine";
      osc.frequency.value = f;
      const vol = 0.2 / freqs.length;
      env.gain.setValueAtTime(vol, this.ctx.currentTime);
      env.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
      osc.connect(env);
      env.connect(gainNode);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    }
  }

  /**
   * 🗡️ سيف بدوي — swoosh خفيف سريع
   */
  sfxWeaponSwordSwoosh() {
    this._playSweep(400, 800, 0.06, "sine", this.sfxGain);
  }

  /**
   * 🗡️ سيف بدوي — equip (click خفيف)
   */
  sfxWeaponSwordEquip() {
    this._playTone(500, 0.05, "sine", this.sfxGain);
  }

  /**
   * 🏹 قوس طويل — twang (وتر)
   */
  sfxWeaponBowTwang() {
    this._playTone(600, 0.08, "sine", this.sfxGain);
  }

  /**
   * 🏹 قوس طويل — equip (سحب الوتر)
   */
  sfxWeaponBowEquip() {
    this._playSweep(700, 500, 0.06, "sine", this.sfxGain);
  }

  /**
   * 🔱 رمح حديدي — clank (ارتطام معدن)
   */
  sfxWeaponSpearClank() {
    this._playChord([150, 225, 300], 0.1, "square", this.sfxGain);
  }

  /**
   * 🔱 رمح حديدي — equip (نقر معدن)
   */
  sfxWeaponSpearEquip() {
    this._playTone(300, 0.08, "square", this.sfxGain);
  }

  /**
   * ⚔️ سيف دمشقي — shing (صليل حاد)
   */
  sfxWeaponDamascusShing() {
    this._playSweep(1000, 2000, 0.12, "sine", this.sfxGain);
    setTimeout(() => this._playTone(1800, 0.06, "sine", this.sfxGain), 80);
  }

  /**
   * ⚔️ سيف دمشقي — equip (صليل فاخر)
   */
  sfxWeaponDamascusEquip() {
    this._playSweep(900, 1200, 0.1, "sine", this.sfxGain);
  }

  /**
   * 🔥 قوس ناري — sizzle (اشتعال)
   */
  sfxWeaponFireSizzle() {
    this._playChord([200, 400, 600], 0.15, "sawtooth", this.sfxGain);
    setTimeout(() => this._playChord([300, 500], 0.1, "sawtooth", this.sfxGain), 80);
  }

  /**
   * 🔥 قوس ناري — equip (إشعال)
   */
  sfxWeaponFireEquip() {
    this._playSweep(600, 400, 0.12, "sawtooth", this.sfxGain);
  }

  /**
   * ⚒️ فأس معركة — thud (ارتطام ثقيل)
   */
  sfxWeaponAxeThud() {
    this._playTone(80, 0.2, "sawtooth", this.sfxGain);
    setTimeout(() => this._playTone(60, 0.15, "square", this.sfxGain), 50);
  }

  /**
   * ⚒️ فأس معركة — equip (وقع ثقيل)
   */
  sfxWeaponAxeEquip() {
    this._playTone(200, 0.15, "square", this.sfxGain);
  }

  playWeaponSound(weaponId, type) {
    const soundMap = {
      w1: { attack: 'sfxWeaponSwordSwoosh', equip: 'sfxWeaponSwordEquip' },
      w2: { attack: 'sfxWeaponBowTwang', equip: 'sfxWeaponBowEquip' },
      w3: { attack: 'sfxWeaponSpearClank', equip: 'sfxWeaponSpearEquip' },
      w4: { attack: 'sfxWeaponDamascusShing', equip: 'sfxWeaponDamascusEquip' },
      w5: { attack: 'sfxWeaponFireSizzle', equip: 'sfxWeaponFireEquip' },
      w6: { attack: 'sfxWeaponAxeThud', equip: 'sfxWeaponAxeEquip' },
    };
    const sound = soundMap[weaponId]?.[type];
    if (sound && this[sound]) {
      this[sound]();
    } else {
      // Fallback to generic sounds
      if (type === 'attack') this.sfxSword();
      else if (type === 'equip') this.sfxClick();
    }
  }

  playSound(type) {
    switch (type) {
      case 'kill': this.sfxSword(); break;
      case 'collect': this.sfxCoin(); break;
      case 'levelup': this.sfxLevelup(); break;
      case 'hit': this.sfxHit(); break;
      case 'pvp_win': this.sfxVictory(); break;
      case 'click': this.sfxClick(); break;
      case 'build': this.sfxBuild(); break;
      case 'upgrade': this.sfxUpgrade(); break;
      case 'heal': this.sfxHeal(); break;
      case 'buy': this.sfxBuy(); break;
      case 'ability': this.sfxAbility(); break;
      case 'error': this.sfxError(); break;
      case 'hero_levelup': this.sfxHeroLevelup(); break;
      case 'offline': this.sfxOffline(); break;
      case 'treasure': this.sfxTreasureOpen(); break;
    }
  }

  sfxTreasureOpen() {
    this._ensure();
    if (!this.ctx || !this.sfxGain) return;
    [500, 600, 800, 1000].forEach((f, i) => {
      setTimeout(() => {
        const osc = this.ctx.createOscillator();
        const env = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = f;
        env.gain.setValueAtTime(0.2, this.ctx.currentTime);
        env.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.15);
        osc.connect(env);
        env.connect(this.sfxGain);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.15);
      }, i * 70);
    });
  }
}
