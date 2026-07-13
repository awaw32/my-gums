"use strict";

/**
 * =============================================================================
 *  🏜️ GameEngine v2 — Desert Kingdom RTS
 * =============================================================================
 *  Core engine class. Handles:
 *  - Canvas setup & resize (Retina-ready)
 *  - 60 FPS game loop with deltaTime
 *  - Camera system with zoom + viewport culling
 *  - Pointer input (one-finger drag=pan, tap=command)
 *  - Pinch-to-zoom (two-finger)
 *  - n8n event integration
 * =============================================================================
 */

class GameEngine {
  /**
   * @param {string|HTMLCanvasElement} canvasEl
   * @param {string} [n8nWebhookUrl=""]
   */
  constructor(canvasEl, n8nWebhookUrl = "") {
    // ─── Canvas ───────────────────────────────────────────────
    this.canvas = typeof canvasEl === "string"
      ? document.getElementById(canvasEl)
      : canvasEl;
    if (!this.canvas) throw new Error(`[GameEngine] Canvas not found: ${canvasEl}`);
    this.ctx = this.canvas.getContext("2d");
    if (!this.ctx) throw new Error("[GameEngine] 2D context unavailable");

    // ─── Dimensions & pixel ratio ──────────────────────────────
    this.width       = 0;
    this.height      = 0;
    this.pixelRatio  = 1;

    // ─── Camera ────────────────────────────────────────────────
    this.camera = {
      x: 0, y: 0,      // world-space offset (top-left)
      w: 0, h: 0,      // viewport size in screen pixels
      zoom: 1,          // 1=normal, 2=zoomed in, 0.5=zoomed out
      minZoom: 0.35,
      maxZoom: 2,
      isometric: false,  // 2.5D isometric mode

      /** Center camera on world coordinate */
      lookAt: (wx, wy) => {
        if (this.camera.isometric) {
          // Isometric: convert world to iso screen coords
          const isoX = (wx - wy) * 0.5;
          const isoY = (wx + wy) * 0.25;
          this.camera.x = isoX - this.camera.w * 0.5;
          this.camera.y = isoY - this.camera.h * 0.5;
        } else {
          this.camera.x = wx - this.camera.w * 0.5;
          this.camera.y = wy - this.camera.h * 0.5;
        }
      },

      /** Clamp camera inside world bounds */
      clamp: (maxW, maxH) => {
        const c = this.camera;
        c.x = Math.max(0, Math.min(c.x, Math.max(0, maxW - c.w)));
        c.y = Math.max(0, Math.min(c.y, Math.max(0, maxH - c.h)));
      },

      /** Is (wx, wy) with margin visible on screen? (accounts for zoom) */
      visible: (wx, wy, margin = 0) => {
        const c = this.camera;
        let sx, sy;
        if (c.isometric) {
          const isoX = (wx - wy) * 0.5;
          const isoY = (wx + wy) * 0.25;
          const cx = c.w / 2, cy = c.h / 2;
          sx = cx + (isoX - c.x - cx) * c.zoom;
          sy = cy + (isoY - c.y - cy) * c.zoom;
        } else {
          const cx = c.w / 2, cy = c.h / 2;
          sx = cx + (wx - c.x - cx) * c.zoom;
          sy = cy + (wy - c.y - cy) * c.zoom;
        }
        const m = margin * c.zoom;
        return sx > -m && sy > -m &&
               sx < c.w + m && sy < c.h + m;
      },

      /** Screen coords → World coords */
      screenToWorld: (sx, sy) => {
        const c = this.camera;
        const cx = c.w / 2, cy = c.h / 2;
        const wx = c.x + cx + (sx - cx) / c.zoom;
        const wy = c.y + cy + (sy - cy) / c.zoom;
        if (c.isometric) {
          // Inverse isometric transform
          return {
            x: wx + wy * 2,
            y: wy * 2 - wx
          };
        }
        return { x: wx, y: wy };
      },

      /** World coords → Screen coords */
      worldToScreen: (wx, wy) => {
        const c = this.camera;
        const cx = c.w / 2, cy = c.h / 2;
        if (c.isometric) {
          const isoX = (wx - wy) * 0.5;
          const isoY = (wx + wy) * 0.25;
          return {
            x: cx + (isoX - c.x - cx) * c.zoom,
            y: cy + (isoY - c.y - cy) * c.zoom,
          };
        }
        return {
          x: cx + (wx - c.x - cx) * c.zoom,
          y: cy + (wy - c.y - cy) * c.zoom,
        };
      },

      /** Return visible viewport rect in world coords */
      viewport: () => {
        const c = this.camera;
        const cx = c.w / 2, cy = c.h / 2;
        const halfW = (c.w / 2) / c.zoom;
        const halfH = (c.h / 2) / c.zoom;
        return {
          x: c.x + cx - halfW, y: c.y + cy - halfH,
          w: halfW * 2, h: halfH * 2,
        };
      },
    };

    // ─── Screen Shake ───────────────────────────────────────────
    this._shakeDuration = 0;
    this._shakeIntensity = 0;
    this._shakeTimer = 0;
    this._shakeOffsetX = 0;
    this._shakeOffsetY = 0;

    // ─── Timing ─────────────────────────────────────────────────
    this.lastTime   = performance.now();
    this.deltaTime  = 0;
    this.fps        = 60;
    this.frameCount = 0;
    this.fpsTimer   = 0;
    this.running    = false;
    this.animId     = 0;

    // ─── Input (single pointer) ─────────────────────────────────
    this._input = {
      down: false, id: null,
      sx: 0, sy: 0, lx: 0, ly: 0,
      moved: false, threshold: 8,
    };

    // ─── Multi-touch state ────────────────────────────────────
    this._touchPoints = new Map();
    this._pinch = { active: false, dist: 0, startZoom: 1 };

    // ─── n8n ────────────────────────────────────────────────────
    this.n8nUrl    = n8nWebhookUrl;
    this.playerId  = "pl_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

    // ─── Callbacks ──────────────────────────────────────────────
    this._onUpdate = null;   // fn(dt, ctx, camera)
    this._onTap    = null;   // fn(worldX, worldY)
    this._onDrag   = null;   // fn(dx, dy)

    // ─── Bind events ────────────────────────────────────────────
    this._boundResize = () => this.resize();
    this._bindPointerEvents();
    window.addEventListener("resize",            this._boundResize);
    window.addEventListener("orientationchange", this._boundResize);

    this.resize();
    this._sendEvent("engine_init");
  }

  resize() {
    if (!this.canvas) return;
    this.pixelRatio = Math.max(1, window.devicePixelRatio || 1);
    this.width  = window.innerWidth;
    this.height = window.innerHeight;
    this.canvas.width  = Math.floor(this.width  * this.pixelRatio);
    this.canvas.height = Math.floor(this.height * this.pixelRatio);
    this.canvas.style.width  = this.width + "px";
    this.canvas.style.height = this.height + "px";
    this.camera.w = this.width;
    this.camera.h = this.height;
    this.ctx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
  }

  start(updateFn) {
    if (this.running) return;
    this._onUpdate = updateFn;
    this.running   = true;
    this.lastTime  = performance.now();
    this._loop(performance.now());
    this._sendEvent("engine_start");
  }

  stop() {
    this.running = false;
    if (this.animId) { cancelAnimationFrame(this.animId); this.animId = 0; }
    if (this._boundResize) {
      window.removeEventListener("resize",            this._boundResize);
      window.removeEventListener("orientationchange", this._boundResize);
    }
    if (this.canvas) {
      this._unbindPointerEvents();
    }
    this._sendEvent("engine_stop");
  }

  _loop(now) {
    if (!this.running) return;
    this.deltaTime = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;

    this.frameCount++;
    this.fpsTimer += this.deltaTime;
    if (this.fpsTimer >= 1) {
      this.fps = this.frameCount;
      this.frameCount = 0;
      this.fpsTimer -= 1;
    }

    // ── Screen Shake ──
    if (this._shakeTimer > 0) {
      this._shakeTimer -= this.deltaTime;
      const progress = this._shakeTimer / this._shakeDuration;
      const intensity = this._shakeIntensity * progress;
      this._shakeOffsetX = (Math.random() - 0.5) * 2 * intensity;
      this._shakeOffsetY = (Math.random() - 0.5) * 2 * intensity;
    } else {
      this._shakeOffsetX = 0;
      this._shakeOffsetY = 0;
    }

    this.ctx.clearRect(0, 0, this.width, this.height);

    const cam = this.camera;
    const cx = cam.w / 2, cy = cam.h / 2;
    this.ctx.save();
    this.ctx.translate(cx + this._shakeOffsetX, cy + this._shakeOffsetY);
    this.ctx.scale(cam.zoom, cam.zoom);
    this.ctx.translate(-cx, -cy);

    if (this._onUpdate) {
      this._onUpdate(this.deltaTime, this.ctx, this.camera);
    }

    this.ctx.restore();
    this.animId = requestAnimationFrame((t) => this._loop(t));
  }

  _bindPointerEvents() {
    const c = this.canvas;
    if (!c) return;
    this._boundPD = (e) => this._onPointerDown(e);
    this._boundPM = (e) => this._onPointerMove(e);
    this._boundPU = (e) => this._onPointerUp(e);
    this._boundPC = (e) => this._onPointerCancel(e);
    c.addEventListener("pointerdown",   this._boundPD);
    c.addEventListener("pointermove",   this._boundPM);
    c.addEventListener("pointerup",     this._boundPU);
    c.addEventListener("pointercancel", this._boundPC);
    c.addEventListener("lostpointercapture", this._boundPC);
  }

  _unbindPointerEvents() {
    if (!this.canvas) return;
    this.canvas.removeEventListener("pointerdown",   this._boundPD);
    this.canvas.removeEventListener("pointermove",   this._boundPM);
    this.canvas.removeEventListener("pointerup",     this._boundPU);
    this.canvas.removeEventListener("pointercancel", this._boundPC);
    this.canvas.removeEventListener("lostpointercapture", this._boundPC);
  }

  _onPointerDown(e) {
    if (!this.running) return;

    const r = this.canvas.getBoundingClientRect();
    const px = e.clientX - r.left;
    const py = e.clientY - r.top;
    this._touchPoints.set(e.pointerId, { x: px, y: py });

    if (this._touchPoints.size === 2) {
      const pts = Array.from(this._touchPoints.values());
      this._pinch.active = true;
      this._pinch.dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      this._pinch.startZoom = this.camera.zoom;
      if (this._input.down) {
        this.canvas.releasePointerCapture(this._input.id);
      }
      this._input.down = false;
      return;
    }

    if (this._pinch.active) return;

    this.canvas.setPointerCapture(e.pointerId);
    this.canvas.classList.add("dragging");
    const inp = this._input;
    inp.down = true;
    inp.id   = e.pointerId;
    inp.sx   = px;
    inp.sy   = py;
    inp.lx   = px;
    inp.ly   = py;
    inp.moved = false;
  }

  _onPointerMove(e) {
    const r = this.canvas.getBoundingClientRect();
    const cx = e.clientX - r.left;
    const cy = e.clientY - r.top;
    this._touchPoints.set(e.pointerId, { x: cx, y: cy });

    if (this._pinch.active && this._touchPoints.size === 2) {
      const pts = Array.from(this._touchPoints.values());
      const curDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (this._pinch.dist > 0) {
        const newZoom = Math.max(this.camera.minZoom,
          Math.min(this.camera.maxZoom,
            this._pinch.startZoom * (curDist / this._pinch.dist)));
        this.camera.zoom = newZoom;
      }
      return;
    }

    const inp = this._input;
    if (!inp.down || inp.id !== e.pointerId) return;
    const dx = cx - inp.lx;
    const dy = cy - inp.ly;
    const tot = Math.hypot(cx - inp.sx, cy - inp.sy);

    if (tot > inp.threshold) inp.moved = true;

    if (inp.moved) {
      this.camera.x -= dx;
      this.camera.y -= dy;
      if (this._onDrag) this._onDrag(dx, dy);
    }

    inp.lx = cx;
    inp.ly = cy;
  }

  _onPointerUp(e) {
    this._touchPoints.delete(e.pointerId);

    if (this._pinch.active && this._touchPoints.size < 2) {
      this._pinch.active = false;
    }
    if (this._pinch.active) return;

    const inp = this._input;
    if (!inp.down || inp.id !== e.pointerId) return;
    this.canvas.classList.remove("dragging");

    if (!inp.moved && this._onTap) {
      const world = this.camera.screenToWorld(inp.sx, inp.sy);
      this._onTap(world.x, world.y);
    }

    inp.down = false;
    inp.id   = null;
    inp.moved = false;
  }

  _onPointerCancel(_e) {
    this.canvas.classList.remove("dragging");
    this._input.down = false;
    this._input.id   = null;
    this._input.moved = false;
    this._touchPoints.clear();
    this._pinch.active = false;
  }

  onTap(cb)  { this._onTap = cb; }
  onDrag(cb) { this._onDrag = cb; }

  zoomBy(factor) {
    const z = this.camera.zoom * factor;
    this.camera.zoom = Math.max(this.camera.minZoom, Math.min(this.camera.maxZoom, z));
  }

  shake(intensity, duration) {
    this._shakeIntensity = intensity;
    this._shakeDuration = duration;
    this._shakeTimer = duration;
  }
  setZoom(level) {
    this.camera.zoom = Math.max(this.camera.minZoom, Math.min(this.camera.maxZoom, level));
  }

  setTargetFPS(fps) {
    // يُستخدم لتوفير الطاقة عند تصغير التبويب (visibilitychange)
    // ذلك بإيقاف/تقليل دقة الحلقة الرئيسية
    this._targetFPS = Math.max(1, Math.min(120, fps));
    if (fps < 10) {
      // عند التصغير: إيقاف الحلقة مؤقتاً
      this.running = false;
      if (this.animId) { cancelAnimationFrame(this.animId); this.animId = 0; }
    } else if (!this.running && this._onUpdate) {
      // عند العودة: إعادة تشغيل الحلقة
      this.running = true;
      this.lastTime = performance.now();
      this._loop(performance.now());
    }
  }

  async _sendEvent(eventName, payload = {}) {
    if (!this.n8nUrl) return null;
    try {
      const res = await fetch(this.n8nUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: eventName,
          playerId: this.playerId,
          timestamp: Date.now(),
          ...payload,
        }),
      });
      return await res.json();
    } catch (e) {
      console.warn(`[n8n] ${eventName}:`, e.message);
      return null;
    }
  }
}

export { GameEngine };