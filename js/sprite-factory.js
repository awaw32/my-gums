"use strict";

/**
 * SpriteFactory — Generates 8-direction animated character sprites procedurally.
 * Each character type has 8 directions × 4 animation frames.
 * Sprites are cached as offscreen canvases for performance.
 */

const DIRECTIONS = ["S", "SW", "W", "NW", "N", "NE", "E", "SE"];
const DIR_ANGLES = {
  S: Math.PI / 2, SW: Math.PI * 3 / 4, W: Math.PI,
  NW: Math.PI * 5 / 4, N: -Math.PI / 2, NE: -Math.PI / 4,
  E: 0, SE: Math.PI / 4
};
const BASE_SIZE = 48; // الحجم المنطقي الثابت على الشاشة — لا يتغير مهما زادت دقة التخزين الداخلية

// عدد الإطارات لكل حالة حركة — المشي يبقى بأربعة إطارات كما كان، والوقوف/الهجوم أخف
const ANIM_STATES = {
  walk: 4,
  idle: 2,
  attack: 2,
};

/**
 * يحسب انحناء الجسم (bobY) وتمايل الأطراف (walkSwing) لكل حالة حركة وإطار.
 * تبقى دوال الرسم لكل شخصية كما هي بلا تعديل — فقط قيم الدخل تختلف حسب الحالة،
 * فتنتج وضعية وقوف هادئة، مشي كامل التمايل، أو ضربة هجوم بلا الحاجة لمحرك أنيميشن جديد.
 */
function getAnimProfile(state, frame) {
  if (state === "idle") {
    // تنفّس خفيف فقط — بلا أي حركة أطراف
    return { bobY: Math.sin(frame * Math.PI) * 0.8, walkSwing: 0 };
  }
  if (state === "attack") {
    // استعداد (سحب للخلف) ثم ضربة/اندفاع للأمام — تُحرّك الذراع والسلاح عبر نفس معادلات الرسم الحالية
    return frame === 0
      ? { bobY: -1, walkSwing: -6 }
      : { bobY: 1, walkSwing: 9 };
  }
  // walk (الافتراضي) — نفس دورة المشي الأصلية بأربعة إطارات
  return { bobY: Math.sin(frame * Math.PI / 2) * 2, walkSwing: Math.sin(frame * Math.PI / 2) * 3 };
}

class SpriteFactory {
  constructor() {
    this._cache = new Map();
    this._ready = false;
  }

  get isReady() { return this._ready; }

  /**
   * Pre-generate all sprites for all types.
   * Call once at game start.
   */
  generateAll() {
    const types = [
      { id: "leader", config: LEADER_CONFIG },
      { id: "soldier", config: SOLDIER_CONFIG },
      { id: "wolf", config: WOLF_CONFIG },
      { id: "shadow", config: SHADOW_CONFIG },
      { id: "sandlord", config: SANDLORD_CONFIG },
      { id: "bandit", config: BANDIT_CONFIG },
    ];

    for (const { id, config } of types) {
      for (const dir of DIRECTIONS) {
        for (const state of Object.keys(ANIM_STATES)) {
          const frameCount = ANIM_STATES[state];
          for (let f = 0; f < frameCount; f++) {
            const key = `${id}_${dir}_${state}_${f}`;
            const canvas = this._generateFrame(id, config, dir, state, f);
            this._cache.set(key, canvas);
          }
        }
      }
    }
    this._ready = true;
  }

  /**
   * Get a cached sprite canvas.
   * @returns {HTMLCanvasElement}
   */
  get(type, direction, state, frame) {
    const dir = DIRECTIONS[direction] || DIRECTIONS[0];
    const st = ANIM_STATES[state] ? state : "walk";
    const fr = (frame | 0) % ANIM_STATES[st];
    return this._cache.get(`${type}_${dir}_${st}_${fr}`);
  }

  /**
   * Draw a sprite at position.
   */
  draw(ctx, type, x, y, direction, state, frame, scale = 1, flipX = false) {
    const canvas = this.get(type, direction, state, frame);
    if (!canvas) return false;
    // الحجم المعروض على الشاشة ثابت منطقياً بغض النظر عن دقة التخزين الداخلية للـ canvas
    // (المتصفح يُصغّر تلقائياً من الدقة العالية إلى حجم العرض — نتيجة أوضح من تكبير صورة صغيرة)
    const w = BASE_SIZE * scale;
    const h = BASE_SIZE * scale;
    ctx.save();
    if (flipX) {
      ctx.translate(x + w / 2, y - h / 2);
      ctx.scale(-1, 1);
    } else {
      ctx.translate(x - w / 2, y - h / 2);
    }
    ctx.drawImage(canvas, 0, 0, w, h);
    ctx.restore();
    return true;
  }

  /**
   * Convert dx/dy movement vector to direction name.
   */
  static vectorToDirection(dx, dy) {
    if (Math.abs(dx) < 0.1 && Math.abs(dy) < 0.1) return "S";
    const angle = Math.atan2(dy, dx);
    const deg = ((angle * 180 / Math.PI) + 360) % 360;
    const idx = Math.round(deg / 45) % 8;
    return DIRECTIONS[idx];
  }

  // ─── Internal: Generate a single frame ───────────────────
  _generateFrame(type, config, dir, state, frame) {
    // معامل تكبير الدقة الداخلية (Supersampling) — يجعل الشخصيات واضحة على شاشات
    // الجوال عالية الكثافة (DPR) بدل تخزينها بدقة 48px ثابتة دائماً كانت تبدو ضبابية
    // عند التكبير. لا حاجة لتعديل إحداثيات الرسم في كل دالة draw() لأن ctx.scale
    // يطبّق التكبير على كل عمليات الرسم اللاحقة تلقائياً.
    const dpr = Math.min(3, Math.max(2, (typeof window !== "undefined" && window.devicePixelRatio) || 1));
    const canvas = document.createElement("canvas");
    canvas.width = BASE_SIZE * dpr;
    canvas.height = BASE_SIZE * dpr;
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    ctx.translate(BASE_SIZE / 2, BASE_SIZE / 2);

    const { bobY, walkSwing } = getAnimProfile(state, frame);

    config.draw(ctx, dir, frame, bobY, walkSwing, BASE_SIZE);

    return canvas;
  }
}

// ─── Character Configs ──────────────────────────────────────

const LEADER_CONFIG = {
  draw(ctx, dir, frame, bobY, walkSwing, _size) {
    const isFront = dir === "S" || dir === "SE" || dir === "SW";
    const isLeft = dir === "W" || dir === "NW" || dir === "SW";
    const isRight = dir === "E" || dir === "NE" || dir === "SE";

    // Shadow
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.beginPath();
    ctx.ellipse(0, 16, 10, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Legs
    ctx.fillStyle = "#5a3a20";
    const legSpread = walkSwing;
    ctx.fillRect(-5 + legSpread * 0.5, 6 + bobY, 4, 10);
    ctx.fillRect(1 - legSpread * 0.5, 6 + bobY, 4, 10);

    // Body (tunic)
    ctx.fillStyle = "#8b5e3c";
    ctx.beginPath();
    ctx.roundRect(-8, -6 + bobY, 16, 14, 3);
    ctx.fill();

    // Belt
    ctx.fillStyle = "#d4a017";
    ctx.fillRect(-8, 4 + bobY, 16, 2);

    // Arms
    ctx.fillStyle = "#8b5e3c";
    const armAngle = walkSwing * 0.15;
    ctx.save();
    ctx.translate(-9, -1 + bobY);
    ctx.rotate(-armAngle);
    ctx.fillRect(-2, 0, 4, 10);
    ctx.restore();
    ctx.save();
    ctx.translate(9, -1 + bobY);
    ctx.rotate(armAngle);
    ctx.fillRect(-2, 0, 4, 10);
    ctx.restore();

    // Head
    ctx.fillStyle = "#d4a76a";
    ctx.beginPath();
    ctx.arc(0, -12 + bobY, 7, 0, Math.PI * 2);
    ctx.fill();

    // Eyes (front only)
    if (isFront) {
      ctx.fillStyle = "#1a1a1a";
      ctx.fillRect(-3, -13 + bobY, 2, 2);
      ctx.fillRect(1, -13 + bobY, 2, 2);
      // Smile
      ctx.strokeStyle = "#1a1a1a";
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.arc(0, -10 + bobY, 3, 0.2, Math.PI - 0.2);
      ctx.stroke();
    }

    // Headband
    ctx.fillStyle = "#c0392b";
    ctx.fillRect(-7, -16 + bobY, 14, 3);
    // Headband tail
    if (isLeft || dir === "S" || dir === "N") {
      ctx.fillStyle = "#c0392b";
      ctx.fillRect(5, -15 + bobY, 5, 2);
      ctx.fillRect(7, -13 + bobY, 4, 2);
    }

    // Crown (golden, on top)
    ctx.fillStyle = "#f5d76e";
    ctx.fillRect(-5, -20 + bobY, 10, 5);
    // Crown spikes
    ctx.fillStyle = "#f5d76e";
    for (let i = -2; i <= 2; i++) {
      ctx.fillRect(i * 2, -22 + bobY, 1.5, 3);
    }
    // Crown gem
    ctx.fillStyle = "#e74c3c";
    ctx.fillRect(-1, -19 + bobY, 2, 2);

    // Weapon (sword in right hand)
    if (isRight || isFront) {
      ctx.save();
      ctx.translate(12, 0 + bobY);
      ctx.rotate(0.3 + walkSwing * 0.05);
      // Blade
      ctx.fillStyle = "#bdc3c7";
      ctx.fillRect(-1, -14, 2.5, 12);
      // Guard
      ctx.fillStyle = "#d4a017";
      ctx.fillRect(-3, -2, 6, 2);
      // Handle
      ctx.fillStyle = "#5a3a20";
      ctx.fillRect(-1, 0, 2.5, 5);
      ctx.restore();
    } else if (isLeft) {
      ctx.save();
      ctx.translate(-12, 0 + bobY);
      ctx.rotate(-0.3 - walkSwing * 0.05);
      ctx.fillStyle = "#bdc3c7";
      ctx.fillRect(-1.5, -14, 2.5, 12);
      ctx.fillStyle = "#d4a017";
      ctx.fillRect(-3, -2, 6, 2);
      ctx.fillStyle = "#5a3a20";
      ctx.fillRect(-1.5, 0, 2.5, 5);
      ctx.restore();
    }
  }
};

const SOLDIER_CONFIG = {
  draw(ctx, dir, frame, bobY, walkSwing, _size) {
    const isFront = dir === "S" || dir === "SE" || dir === "SW";

    // Shadow
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    ctx.beginPath();
    ctx.ellipse(0, 16, 8, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Legs
    ctx.fillStyle = "#4a3520";
    const legSpread = walkSwing;
    ctx.fillRect(-4 + legSpread * 0.4, 5 + bobY, 3.5, 9);
    ctx.fillRect(0.5 - legSpread * 0.4, 5 + bobY, 3.5, 9);

    // Body
    ctx.fillStyle = "#6b4226";
    ctx.beginPath();
    ctx.roundRect(-7, -5 + bobY, 14, 12, 2);
    ctx.fill();

    // Armor plate
    ctx.fillStyle = "#8a7a5a";
    ctx.fillRect(-5, -3 + bobY, 10, 6);

    // Arms
    ctx.fillStyle = "#6b4226";
    ctx.save();
    ctx.translate(-8, 0 + bobY);
    ctx.rotate(-walkSwing * 0.12);
    ctx.fillRect(-2, 0, 3.5, 8);
    ctx.restore();
    ctx.save();
    ctx.translate(8, 0 + bobY);
    ctx.rotate(walkSwing * 0.12);
    ctx.fillRect(-1.5, 0, 3.5, 8);
    ctx.restore();

    // Head
    ctx.fillStyle = "#c9a06c";
    ctx.beginPath();
    ctx.arc(0, -10 + bobY, 6, 0, Math.PI * 2);
    ctx.fill();

    // Helmet
    ctx.fillStyle = "#7a6a4a";
    ctx.beginPath();
    ctx.arc(0, -12 + bobY, 7, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(-7, -12 + bobY, 14, 3);

    // Eyes
    if (isFront) {
      ctx.fillStyle = "#1a1a1a";
      ctx.fillRect(-2.5, -11 + bobY, 2, 1.5);
      ctx.fillRect(1, -11 + bobY, 2, 1.5);
    }

    // Spear
    ctx.save();
    ctx.translate(9, -2 + bobY);
    ctx.rotate(0.1);
    ctx.fillStyle = "#5a3a20";
    ctx.fillRect(-0.8, -18, 1.6, 22);
    // Spear tip
    ctx.fillStyle = "#bdc3c7";
    ctx.beginPath();
    ctx.moveTo(0, -22);
    ctx.lineTo(-2.5, -18);
    ctx.lineTo(2.5, -18);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
};

const WOLF_CONFIG = {
  draw(ctx, dir, frame, bobY, walkSwing, _size) {
    const isFront = dir === "S" || dir === "SE" || dir === "SW";
    const isSide = dir === "E" || dir === "W";

    // Shadow
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    ctx.beginPath();
    ctx.ellipse(0, 14, 10, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Legs
    ctx.fillStyle = "#6b4a2a";
    const ls = walkSwing * 0.6;
    ctx.fillRect(-6 + ls, 4 + bobY, 3, 8);
    ctx.fillRect(-1 - ls, 4 + bobY, 3, 8);
    ctx.fillRect(3 + ls, 4 + bobY, 3, 8);
    ctx.fillRect(7 - ls, 4 + bobY, 3, 8);

    // Body
    ctx.fillStyle = "#8a5a3a";
    ctx.beginPath();
    ctx.ellipse(0, 0 + bobY, 12, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Fur pattern
    ctx.fillStyle = "#a0704a";
    ctx.beginPath();
    ctx.ellipse(0, -2 + bobY, 8, 4, 0, 0, Math.PI);
    ctx.fill();

    // Head
    ctx.fillStyle = "#8a5a3a";
    ctx.beginPath();
    ctx.ellipse(0, -8 + bobY, 7, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Snout
    ctx.fillStyle = "#a0704a";
    ctx.beginPath();
    ctx.ellipse(isFront ? 0 : (isSide ? (dir === "E" ? 5 : -5) : 0),
      isFront ? -5 + bobY : -8 + bobY, 3, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Nose
    ctx.fillStyle = "#2a1a0a";
    ctx.beginPath();
    ctx.arc(isFront ? 0 : (isSide ? (dir === "E" ? 5 : -5) : 0),
      isFront ? -6 + bobY : -9 + bobY, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    if (isFront) {
      ctx.fillStyle = "#f5d76e";
      ctx.beginPath();
      ctx.arc(-3, -9 + bobY, 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(3, -9 + bobY, 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#1a1a1a";
      ctx.fillRect(-3.5, -9.5 + bobY, 1, 1);
      ctx.fillRect(2.5, -9.5 + bobY, 1, 1);
    }

    // Ears
    ctx.fillStyle = "#8a5a3a";
    ctx.beginPath();
    ctx.moveTo(-4, -12 + bobY);
    ctx.lineTo(-6, -18 + bobY);
    ctx.lineTo(-1, -13 + bobY);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(4, -12 + bobY);
    ctx.lineTo(6, -18 + bobY);
    ctx.lineTo(1, -13 + bobY);
    ctx.fill();
    // Inner ear
    ctx.fillStyle = "#d4a76a";
    ctx.beginPath();
    ctx.moveTo(-4, -13 + bobY);
    ctx.lineTo(-5, -16 + bobY);
    ctx.lineTo(-2, -13 + bobY);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(4, -13 + bobY);
    ctx.lineTo(5, -16 + bobY);
    ctx.lineTo(2, -13 + bobY);
    ctx.fill();

    // Tail
    ctx.fillStyle = "#8a5a3a";
    ctx.save();
    ctx.translate(0, 6 + bobY);
    ctx.rotate(Math.sin(frame * 0.8) * 0.3);
    ctx.beginPath();
    ctx.ellipse(0, 5, 3, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#a0704a";
    ctx.beginPath();
    ctx.ellipse(0, 8, 2, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
};

const SHADOW_CONFIG = {
  draw(ctx, dir, frame, bobY, walkSwing, _size) {
    const isFront = dir === "S" || dir === "SE" || dir === "SW";

    // Shadow
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    ctx.beginPath();
    ctx.ellipse(0, 16, 10, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Dark aura
    ctx.fillStyle = "rgba(30,10,30,0.15)";
    ctx.beginPath();
    ctx.arc(0, 0 + bobY, 18, 0, Math.PI * 2);
    ctx.fill();

    // Legs
    ctx.fillStyle = "#1a0a1a";
    const ls = walkSwing * 0.5;
    ctx.fillRect(-4 + ls, 5 + bobY, 3.5, 10);
    ctx.fillRect(0.5 - ls, 5 + bobY, 3.5, 10);

    // Body (dark cloak)
    ctx.fillStyle = "#2a1a2a";
    ctx.beginPath();
    ctx.roundRect(-9, -7 + bobY, 18, 14, 3);
    ctx.fill();

    // Cloak trim
    ctx.fillStyle = "#4a2a4a";
    ctx.fillRect(-9, 5 + bobY, 18, 2);

    // Hood
    ctx.fillStyle = "#2a1a2a";
    ctx.beginPath();
    ctx.arc(0, -12 + bobY, 8, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(-8, -12 + bobY, 16, 4);

    // Face (glowing eyes in darkness)
    if (isFront) {
      ctx.fillStyle = "#9b59b6";
      ctx.shadowColor = "#9b59b6";
      ctx.shadowBlur = 4;
      ctx.beginPath();
      ctx.arc(-3, -11 + bobY, 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(3, -11 + bobY, 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Dark energy wisps
    const t = frame * 0.5;
    ctx.strokeStyle = "rgba(100,50,120,0.4)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      const angle = t + i * Math.PI * 2 / 3;
      const r = 14 + Math.sin(t + i) * 2;
      ctx.beginPath();
      ctx.arc(Math.cos(angle) * r, Math.sin(angle) * r + bobY, 2, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Shadow blade
    ctx.save();
    ctx.translate(10, -2 + bobY);
    ctx.rotate(0.2);
    ctx.fillStyle = "#4a2a4a";
    ctx.fillRect(-1, -16, 2.5, 14);
    ctx.fillStyle = "#9b59b6";
    ctx.shadowColor = "#9b59b6";
    ctx.shadowBlur = 3;
    ctx.beginPath();
    ctx.moveTo(0.25, -20);
    ctx.lineTo(-2, -16);
    ctx.lineTo(2.5, -16);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();
  }
};

const SANDLORD_CONFIG = {
  draw(ctx, dir, frame, bobY, _walkSwing, _size) {
    const isFront = dir === "S" || dir === "SE" || dir === "SW";

    // Sand whirlwind base
    ctx.fillStyle = "rgba(200,150,50,0.2)";
    ctx.beginPath();
    ctx.arc(0, 8 + bobY, 16, 0, Math.PI * 2);
    ctx.fill();

    // Legs (robes)
    ctx.fillStyle = "#8b2020";
    ctx.fillRect(-5, 4 + bobY, 4, 10);
    ctx.fillRect(1, 4 + bobY, 4, 10);

    // Robe body
    ctx.fillStyle = "#c0392b";
    ctx.beginPath();
    ctx.moveTo(-10, -6 + bobY);
    ctx.lineTo(10, -6 + bobY);
    ctx.lineTo(12, 10 + bobY);
    ctx.lineTo(-12, 10 + bobY);
    ctx.closePath();
    ctx.fill();

    // Robe details
    ctx.fillStyle = "#962d22";
    ctx.fillRect(-1, -6 + bobY, 2, 16);

    // Gold trim
    ctx.fillStyle = "#d4a017";
    ctx.fillRect(-10, -6 + bobY, 20, 2);
    ctx.fillRect(-12, 8 + bobY, 24, 1.5);

    // Arms with magic
    ctx.fillStyle = "#c0392b";
    ctx.save();
    ctx.translate(-10, -1 + bobY);
    ctx.rotate(-0.4 + Math.sin(t(frame)) * 0.15);
    ctx.fillRect(-2, 0, 4, 10);
    ctx.restore();
    ctx.save();
    ctx.translate(10, -1 + bobY);
    ctx.rotate(0.4 - Math.sin(t(frame)) * 0.15);
    ctx.fillRect(-2, 0, 4, 10);
    ctx.restore();

    // Magic orbs in hands
    const glow = 0.5 + Math.sin(frame * 1.2) * 0.3;
    ctx.fillStyle = `rgba(231,76,60,${glow})`;
    ctx.shadowColor = "#e74c3c";
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(-12, 8 + bobY, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(12, 8 + bobY, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Head
    ctx.fillStyle = "#d4a76a";
    ctx.beginPath();
    ctx.arc(0, -12 + bobY, 7, 0, Math.PI * 2);
    ctx.fill();

    // Turban
    ctx.fillStyle = "#f5f5dc";
    ctx.beginPath();
    ctx.arc(0, -14 + bobY, 8, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(-8, -14 + bobY, 16, 4);
    // Turban wrap
    ctx.fillStyle = "#c0392b";
    ctx.fillRect(-6, -17 + bobY, 12, 2);

    // Eyes
    if (isFront) {
      ctx.fillStyle = "#e74c3c";
      ctx.shadowColor = "#e74c3c";
      ctx.shadowBlur = 2;
      ctx.fillRect(-3, -12 + bobY, 2, 2);
      ctx.fillRect(1, -12 + bobY, 2, 2);
      ctx.shadowBlur = 0;
    }

    // Floating sand particles
    for (let i = 0; i < 4; i++) {
      const a = frame * 0.7 + i * Math.PI / 2;
      const r = 12 + Math.sin(a) * 3;
      ctx.fillStyle = "rgba(210,170,100,0.5)";
      ctx.beginPath();
      ctx.arc(Math.cos(a) * r, Math.sin(a) * r - 2 + bobY, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
};

const BANDIT_CONFIG = {
  draw(ctx, dir, frame, bobY, walkSwing, _size) {
    const isFront = dir === "S" || dir === "SE" || dir === "SW";

    // Shadow
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    ctx.beginPath();
    ctx.ellipse(0, 16, 9, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Legs
    ctx.fillStyle = "#3a3a2a";
    const ls = walkSwing * 0.5;
    ctx.fillRect(-4 + ls, 5 + bobY, 3.5, 10);
    ctx.fillRect(0.5 - ls, 5 + bobY, 3.5, 10);

    // Body
    ctx.fillStyle = "#4a4a3a";
    ctx.beginPath();
    ctx.roundRect(-8, -5 + bobY, 16, 12, 2);
    ctx.fill();

    // Leather vest
    ctx.fillStyle = "#5a4a3a";
    ctx.fillRect(-6, -3 + bobY, 12, 8);

    // Arms
    ctx.fillStyle = "#4a4a3a";
    ctx.save();
    ctx.translate(-8, 0 + bobY);
    ctx.rotate(-walkSwing * 0.12);
    ctx.fillRect(-2, 0, 3.5, 8);
    ctx.restore();
    ctx.save();
    ctx.translate(8, 0 + bobY);
    ctx.rotate(walkSwing * 0.12);
    ctx.fillRect(-1.5, 0, 3.5, 8);
    ctx.restore();

    // Head
    ctx.fillStyle = "#c9a06c";
    ctx.beginPath();
    ctx.arc(0, -10 + bobY, 6, 0, Math.PI * 2);
    ctx.fill();

    // Bandana
    ctx.fillStyle = "#222";
    ctx.fillRect(-6, -14 + bobY, 12, 4);
    // Bandana knot
    ctx.fillRect(4, -12 + bobY, 5, 2);
    ctx.fillRect(6, -10 + bobY, 4, 2);

    // Eyes
    if (isFront) {
      ctx.fillStyle = "#fff";
      ctx.fillRect(-3, -11 + bobY, 2.5, 2);
      ctx.fillRect(0.5, -11 + bobY, 2.5, 2);
      ctx.fillStyle = "#1a1a1a";
      ctx.fillRect(-2, -10.5 + bobY, 1.5, 1.5);
      ctx.fillRect(1, -10.5 + bobY, 1.5, 1.5);
    }

    // Dagger
    ctx.save();
    ctx.translate(10, 2 + bobY);
    ctx.rotate(0.5);
    ctx.fillStyle = "#888";
    ctx.fillRect(-1, -10, 2, 8);
    ctx.fillStyle = "#5a3a20";
    ctx.fillRect(-1.5, -2, 3, 4);
    ctx.restore();
  }
};

function t(frame) { return frame * 0.8; }

// Singleton
const spriteFactory = new SpriteFactory();

export { SpriteFactory, spriteFactory, DIRECTIONS, DIR_ANGLES };
