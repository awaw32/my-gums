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
    }
  }
}
