"use strict";

/**
 * محرك السينماتيك والحوارات الدرامية
 */

import { CINEMATIC_INTRO, VICTORY_MESSAGES, STORY_EFFECTS, getStoryDialogue } from './story-cinematic.js';

export class CinematicEngine {
  constructor(container) {
    this.container = container;
    this.isPlaying = false;
    this.queue = [];
    this.currentOverlay = null;
    this._resolvePlay = null;
  }

  async playIntro() {
    const played = localStorage.getItem("cinematic_intro_played");
    if (played) return;
    localStorage.setItem("cinematic_intro_played", "true");

    this.isPlaying = true;
    for (const scene of CINEMATIC_INTRO.scenes) {
      await this._showScene(scene);
      await this._wait(scene.duration);
      await this._fadeOut(500);
    }
    this.isPlaying = false;
  }

  async playDialogue(villageId, sceneType) {
    const dialogues = getStoryDialogue(villageId, sceneType);
    if (dialogues.length === 0) return;

    this.isPlaying = true;
    for (const line of dialogues) {
      await this._showDialogue(line);
      await this._wait(Math.max(2500, line.text.length * 50));
      await this._fadeOutDialogue(300);
    }
    this.isPlaying = false;
  }

  async playVictory(villageId) {
    const msg = VICTORY_MESSAGES[villageId];
    if (!msg) return;

    this.isPlaying = true;
    await this._showVictory(msg);
    if (msg.effect && STORY_EFFECTS[msg.effect]) {
      this._triggerEffect(STORY_EFFECTS[msg.effect]);
    }
    await this._wait(4000);
    await this._fadeOut(800);
    this.isPlaying = false;
  }

  _showScene(scene) {
    return new Promise((resolve) => {
      this._removeOverlay();
      const overlay = document.createElement("div");
      overlay.className = "cinematic-overlay";
      overlay.style.cssText = `
        position: fixed; inset: 0; z-index: 10001;
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        background: ${scene.bg || "linear-gradient(135deg, #0a0a2a 0%, #1a1a4a 50%, #2a2a6a 100%)"};
        opacity: 0; transition: opacity 0.8s ease;
        font-family: 'Cairo', sans-serif;
      `;
      const icon = scene.isTitle ? `
        <div style="font-size: 5em; margin-bottom: 20px; animation: cinematic-float 2s ease-in-out infinite;">${scene.icon}</div>
        <h1 style="color: #ffd700; font-size: 2.2em; text-shadow: 0 0 30px rgba(255,215,0,0.5); margin: 0;">${scene.text}</h1>
      ` : `
        <div style="font-size: 4em; margin-bottom: 30px; animation: cinematic-float 3s ease-in-out infinite;">${scene.icon}</div>
        <p style="color: #e4e4e4; font-size: 1.4em; text-align: center; max-width: 600px; line-height: 1.8; text-shadow: 0 2px 10px rgba(0,0,0,0.5);">${scene.text}</p>
      `;
      overlay.innerHTML = icon;
      this.container.appendChild(overlay);
      this.currentOverlay = overlay;
      requestAnimationFrame(() => { overlay.style.opacity = "1"; });
      if (scene.effect) this._triggerEffect(STORY_EFFECTS[scene.effect]);
      setTimeout(resolve, 100);
    });
  }

  _showDialogue(line) {
    return new Promise((resolve) => {
      this._removeOverlay();
      const overlay = document.createElement("div");
      overlay.className = "cinematic-dialogue";
      overlay.style.cssText = `
        position: fixed; inset: 0; z-index: 10001;
        display: flex; flex-direction: column; align-items: center; justify-content: flex-end;
        background: rgba(0,0,0,0.7); opacity: 0; transition: opacity 0.3s ease;
        font-family: 'Cairo', sans-serif; padding-bottom: 60px;
      `;
      overlay.innerHTML = `
        <div class="dialogue-box" style="
          background: linear-gradient(135deg, #1a1a2e 0%, #2a2a4e 100%);
          border: 2px solid #ffd700; border-radius: 16px;
          padding: 30px 40px; max-width: 700px; width: 90%;
          box-shadow: 0 10px 40px rgba(255,215,0,0.2);
          transform: translateY(20px); transition: transform 0.3s ease;
        ">
          <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 15px;">
            <span style="font-size: 2.5em;">${line.icon}</span>
            <span style="color: #ffd700; font-size: 1.2em; font-weight: bold;">${line.speaker}</span>
          </div>
          <p style="color: #e4e4e4; font-size: 1.1em; line-height: 1.8; margin: 0;">${line.text}</p>
          <div style="text-align: left; margin-top: 15px;">
            <span style="color: #7f8c8d; font-size: 0.8em;">انقر للمتابعة...</span>
          </div>
        </div>
      `;
      this.container.appendChild(overlay);
      this.currentOverlay = overlay;
      requestAnimationFrame(() => {
        overlay.style.opacity = "1";
        const box = overlay.querySelector(".dialogue-box");
        if (box) box.style.transform = "translateY(0)";
      });
      if (line.effect) this._triggerEffect(STORY_EFFECTS[line.effect]);
      overlay.addEventListener("click", () => {
        this._fadeOutDialogue(200).then(resolve);
      }, { once: true });
      setTimeout(() => {
        overlay.addEventListener("click", () => {
          this._fadeOutDialogue(200).then(resolve);
        }, { once: true });
      }, 1500);
    });
  }

  _showVictory(msg) {
    return new Promise((resolve) => {
      this._removeOverlay();
      const overlay = document.createElement("div");
      overlay.className = "cinematic-victory";
      overlay.style.cssText = `
        position: fixed; inset: 0; z-index: 10001;
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        background: linear-gradient(135deg, #1a0a00 0%, #3a1a00 50%, #5a2a00 100%);
        opacity: 0; transition: opacity 0.5s ease;
        font-family: 'Cairo', sans-serif;
      `;
      overlay.innerHTML = `
        <div style="font-size: 5em; margin-bottom: 20px; animation: cinematic-float 2s ease-in-out infinite;">${msg.icon}</div>
        <h1 style="color: #ffd700; font-size: 2em; text-shadow: 0 0 30px rgba(255,215,0,0.5); margin: 0;">${msg.title}</h1>
        <p style="color: #e4e4e4; font-size: 1.2em; text-align: center; max-width: 500px; margin-top: 15px; line-height: 1.6;">${msg.text}</p>
      `;
      this.container.appendChild(overlay);
      this.currentOverlay = overlay;
      requestAnimationFrame(() => { overlay.style.opacity = "1"; });
      setTimeout(resolve, 200);
    });
  }

  _fadeOut(duration) {
    return new Promise((resolve) => {
      if (!this.currentOverlay) { resolve(); return; }
      this.currentOverlay.style.transition = `opacity ${duration}ms ease`;
      this.currentOverlay.style.opacity = "0";
      setTimeout(() => { this._removeOverlay(); resolve(); }, duration);
    });
  }

  _fadeOutDialogue(duration) {
    return new Promise((resolve) => {
      if (!this.currentOverlay) { resolve(); return; }
      this.currentOverlay.style.transition = `opacity ${duration}ms ease`;
      this.currentOverlay.style.opacity = "0";
      const box = this.currentOverlay.querySelector(".dialogue-box");
      if (box) box.style.transform = "translateY(20px)";
      setTimeout(() => { this._removeOverlay(); resolve(); }, duration);
    });
  }

  _removeOverlay() {
    if (this.currentOverlay) {
      this.currentOverlay.remove();
      this.currentOverlay = null;
    }
  }

  _triggerEffect(effect) {
    if (!effect) return;
    if (effect.type === "screen-shake") this._screenShake(effect);
    if (effect.type === "particles") this._spawnParticles(effect);
    if (effect.type === "glow") this._addGlow(effect);
    if (effect.type === "darken") this._darken(effect);
    if (effect.type === "confetti") this._spawnConfetti(effect);
    if (effect.type === "fireworks") this._spawnFireworks(effect);
  }

  _screenShake(effect) {
    document.body.style.animation = `shake ${effect.duration}ms ease-in-out`;
    setTimeout(() => { document.body.style.animation = ""; }, effect.duration);
  }

  _spawnParticles(effect) {
    const canvas = document.createElement("canvas");
    canvas.style.cssText = `position: fixed; inset: 0; z-index: 10002; pointer-events: none;`;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    this.container.appendChild(canvas);
    const ctx = canvas.getContext("2d");
    const particles = [];
    for (let i = 0; i < (effect.count || 20); i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 4,
        vy: (Math.random() - 0.5) * 4,
        size: 2 + Math.random() * 4,
        alpha: 0.5 + Math.random() * 0.5
      });
    }
    const start = performance.now();
    const animate = (now) => {
      const elapsed = now - start;
      if (elapsed > (effect.duration || 1000)) { canvas.remove(); return; }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= 0.005;
        if (p.alpha <= 0) continue;
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = effect.color || "#ffffff";
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }

  _spawnConfetti(effect) {
    const canvas = document.createElement("canvas");
    canvas.style.cssText = `position: fixed; inset: 0; z-index: 10002; pointer-events: none;`;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    this.container.appendChild(canvas);
    const ctx = canvas.getContext("2d");
    const colors = ["#ffd700", "#ff6b6b", "#4ecdc4", "#45b7d1", "#96ceb4", "#ff9ff3"];
    const pieces = [];
    for (let i = 0; i < (effect.count || 50); i++) {
      pieces.push({
        x: Math.random() * canvas.width,
        y: -20 - Math.random() * 100,
        vx: (Math.random() - 0.5) * 6,
        vy: 2 + Math.random() * 4,
        rotation: Math.random() * 360,
        rotSpeed: (Math.random() - 0.5) * 10,
        size: 4 + Math.random() * 6,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 1
      });
    }
    const start = performance.now();
    const animate = (now) => {
      const elapsed = now - start;
      if (elapsed > (effect.duration || 2000)) { canvas.remove(); return; }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of pieces) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.1;
        p.rotation += p.rotSpeed;
        p.alpha -= 0.003;
        if (p.alpha <= 0) continue;
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx.restore();
      }
      requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }

  _spawnFireworks(effect) {
    const canvas = document.createElement("canvas");
    canvas.style.cssText = `position: fixed; inset: 0; z-index: 10002; pointer-events: none;`;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    this.container.appendChild(canvas);
    const ctx = canvas.getContext("2d");
    const fireworks = [];
    const colors = ["#ffd700", "#ff6b6b", "#4ecdc4", "#ff9ff3", "#00ff00"];
    const createFirework = () => ({
      x: 100 + Math.random() * (canvas.width - 200),
      y: canvas.height,
      targetY: 100 + Math.random() * (canvas.height * 0.4),
      vy: -8,
      exploded: false,
      particles: [],
      color: colors[Math.floor(Math.random() * colors.length)]
    });
    for (let i = 0; i < (effect.count || 5); i++) {
      setTimeout(() => fireworks.push(createFirework()), i * 500);
    }
    const start = performance.now();
    const animate = (now) => {
      const elapsed = now - start;
      if (elapsed > (effect.duration || 3000)) { canvas.remove(); return; }
      ctx.fillStyle = "rgba(0,0,0,0.1)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      for (let i = fireworks.length - 1; i >= 0; i--) {
        const fw = fireworks[i];
        if (!fw.exploded) {
          fw.y += fw.vy;
          ctx.fillStyle = fw.color;
          ctx.beginPath();
          ctx.arc(fw.x, fw.y, 3, 0, Math.PI * 2);
          ctx.fill();
          if (fw.y <= fw.targetY) {
            fw.exploded = true;
            for (let j = 0; j < 30; j++) {
              const angle = (Math.PI * 2 * j) / 30;
              const speed = 2 + Math.random() * 4;
              fw.particles.push({
                x: fw.x, y: fw.y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                alpha: 1
              });
            }
          }
        } else {
          let allDead = true;
          for (const p of fw.particles) {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.05;
            p.alpha -= 0.015;
            if (p.alpha > 0) {
              allDead = false;
              ctx.globalAlpha = p.alpha;
              ctx.fillStyle = fw.color;
              ctx.beginPath();
              ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
              ctx.fill();
            }
          }
          ctx.globalAlpha = 1;
          if (allDead) fireworks.splice(i, 1);
        }
      }
      requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }

  _addGlow(effect) {
    const glow = document.createElement("div");
    glow.style.cssText = `
      position: fixed; inset: 0; z-index: 10000; pointer-events: none;
      background: radial-gradient(circle at center, ${effect.color || "#ffd700"}33 0%, transparent 70%);
      opacity: 0; transition: opacity 0.5s ease;
    `;
    this.container.appendChild(glow);
    requestAnimationFrame(() => { glow.style.opacity = "1"; });
    setTimeout(() => {
      glow.style.opacity = "0";
      setTimeout(() => glow.remove(), 500);
    }, effect.duration || 800);
  }

  _darken(effect) {
    const dark = document.createElement("div");
    dark.style.cssText = `
      position: fixed; inset: 0; z-index: 10000; pointer-events: none;
      background: rgba(0,0,0,0.6); opacity: 0; transition: opacity 0.5s ease;
    `;
    this.container.appendChild(dark);
    requestAnimationFrame(() => { dark.style.opacity = "1"; });
    setTimeout(() => {
      dark.style.opacity = "0";
      setTimeout(() => dark.remove(), 500);
    }, effect.duration || 1500);
  }

  _wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
