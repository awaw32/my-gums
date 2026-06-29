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
 *
 *  Usage:
 *    const engine = new GameEngine("gameCanvas");
 *    engine.start((dt, ctx, cam) => { /* update + render *\/ });
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

      /** Center camera on world coordinate */
      lookAt: (wx, wy) => {
        this.camera.x = wx - this.camera.w * 0.5;
        this.camera.y = wy - this.camera.h * 0.5;
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
        const cx = c.w / 2, cy = c.h / 2;
        const sx = cx + (wx - c.x - cx) * c.zoom;
        const sy = cy + (wy - c.y - cy) * c.zoom;
        const m = margin * c.zoom;
        return sx > -m && sy > -m &&
               sx < c.w + m && sy < c.h + m;
      },

      /** Screen coords → World coords */
      screenToWorld: (sx, sy) => {
        const c = this.camera;
        const cx = c.w / 2, cy = c.h / 2;
        return {
          x: c.x + cx + (sx - cx) / c.zoom,
          y: c.y + cy + (sy - cy) / c.zoom,
        };
      },

      /** World coords → Screen coords */
      worldToScreen: (wx, wy) => {
        const c = this.camera;
        const cx = c.w / 2, cy = c.h / 2;
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
    this._bindPointerEvents();
    window.addEventListener("resize",            () => this.resize());
    window.addEventListener("orientationchange", () => this.resize());

    this.resize();
    this._sendEvent("engine_init");
  }

  // ═══════════════════════════════════════════════════════════════
  //  RESIZE
  // ═══════════════════════════════════════════════════════════════

  resize() {
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

  // ═══════════════════════════════════════════════════════════════
  //  GAME LOOP
  // ═══════════════════════════════════════════════════════════════

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

    // Clear screen
    this.ctx.clearRect(0, 0, this.width, this.height);

    // Apply zoom (centered on screen center, doesn't affect camera positioning)
    const cam = this.camera;
    const cx = cam.w / 2, cy = cam.h / 2;
    this.ctx.save();
    this.ctx.translate(cx, cy);
    this.ctx.scale(cam.zoom, cam.zoom);
    this.ctx.translate(-cx, -cy);

    if (this._onUpdate) {
      this._onUpdate(this.deltaTime, this.ctx, this.camera);
    }

    this.ctx.restore();

    this.animId = requestAnimationFrame((t) => this._loop(t));
  }

  // ═══════════════════════════════════════════════════════════════
  //  INPUT
  // ═══════════════════════════════════════════════════════════════

  _bindPointerEvents() {
    const c = this.canvas;
    c.addEventListener("pointerdown",   (e) => this._onPointerDown(e));
    c.addEventListener("pointermove",   (e) => this._onPointerMove(e));
    c.addEventListener("pointerup",     (e) => this._onPointerUp(e));
    c.addEventListener("pointercancel", (e) => this._onPointerCancel(e));
    c.addEventListener("lostpointercapture", (e) => this._onPointerCancel(e));
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

    // ── Pinch zoom ────────────────────────────────────────────
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

    // ── Single drag ────────────────────────────────────────────
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

  _onPointerCancel(e) {
    this.canvas.classList.remove("dragging");
    this._input.down = false;
    this._input.id   = null;
    this._input.moved = false;
    this._touchPoints.clear();
    this._pinch.active = false;
  }

  /**
   * Register tap callback
   * @param {fn(worldX, worldY)} cb
   */
  onTap(cb)  { this._onTap = cb; }

  /**
   * Register drag callback
   * @param {fn(dx, dy)} cb
   */
  onDrag(cb) { this._onDrag = cb; }

  zoomBy(factor) {
    const z = this.camera.zoom * factor;
    this.camera.zoom = Math.max(this.camera.minZoom, Math.min(this.camera.maxZoom, z));
  }
  setZoom(level) {
    this.camera.zoom = Math.max(this.camera.minZoom, Math.min(this.camera.maxZoom, level));
  }

  // ═══════════════════════════════════════════════════════════════
  //  n8n
  // ═══════════════════════════════════════════════════════════════

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