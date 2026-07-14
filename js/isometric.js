"use strict";

/**
 * Isometric — 45° isometric projection, tile-based ground, and depth sorting.
 *
 * Converts between world (flat 2D) and screen (isometric 45°) coordinates.
 * Provides tile rendering and depth-sorted entity drawing.
 */

const TILE_W = 64;
const TILE_H = 32;
const TILE_ROWS = 48;
const TILE_COLS = 48;
const WORLD_W = TILE_COLS * TILE_W;
const WORLD_H = TILE_ROWS * TILE_H;

// Tile types
const TILE_SAND = 0;
const TILE_ROCK = 1;
const TILE_OASIS = 2;
const TILE_PATH = 3;
const TILE_DARK_SAND = 4;

/**
 * Tile pattern colors (top face of isometric tile).
 */
const TILE_COLORS = {
  [TILE_SAND]:      { top: "#e8d5a3", left: "#c4a96a", right: "#d4bf82" },
  [TILE_DARK_SAND]: { top: "#d4bf82", left: "#b09860", right: "#c4a96a" },
  [TILE_ROCK]:      { top: "#8a8070", left: "#6a6050", right: "#7a7060" },
  [TILE_OASIS]:     { top: "#5a9a6a", left: "#3a7a4a", right: "#4a8a5a" },
  [TILE_PATH]:      { top: "#c9b07a", left: "#a99060", right: "#b9a06a" },
};

/** يُغمّق/يُفتّح لوناً سداسياً بنسبة amt (-1..1) — لبناء تدرّجات وتفاوتات الأرضية */
function shadeHexColor(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 0xff, g = (n >> 8) & 0xff, b = n & 0xff;
  if (amt >= 0) {
    r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt;
  } else {
    r *= 1 + amt; g *= 1 + amt; b *= 1 + amt;
  }
  const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
  return `rgb(${clamp(r)},${clamp(g)},${clamp(b)})`;
}

/** قيمة عشوائية ثابتة (0..1) حسب إحداثيات البلاطة — تكسر التكرار البصري المسطّح بلا تكلفة أداء أثناء اللعب */
function tileVariance(col, row) {
  return ((col * 928371 + row * 614897 + 7) % 97) / 97;
}

class IsometricSystem {
  constructor(mapW = WORLD_W, mapH = WORLD_H) {
    this.mapW = mapW;
    this.mapH = mapH;
    this.tileMap = null;
    this._tileCanvas = null;
    this._tileCtx = null;
    this._generated = false;
  }

  /**
   * Generate a procedural tile map.
   */
  generateTileMap(seed = 42) {
    // 🗺️ اضبط حجم الترابيع بحيث يغطي مسقطها الإيزومتري (isoToScreen) كامل مساحة
    // الخريطة (mapW×mapH) دون قص أو فراغات — كانت الشبكة الثابتة 48×48 بحجم 64×32
    // تنتج مسقطاً أصغر بكثير من مساحة الخريطة الفعلية، ما يترك أكثر من نصفها فارغاً.
    const refCornerY = ((TILE_COLS - 1) * TILE_W + (TILE_ROWS - 1) * TILE_H) * 0.25;
    const refCornerXSpan = (TILE_COLS - 1) * TILE_W * 0.5 + (TILE_ROWS - 1) * TILE_H * 0.5;
    const scaleY = (this.mapH * 1.15) / Math.max(1, refCornerY);
    const scaleX = (this.mapW * 1.15) / Math.max(1, refCornerXSpan);
    const scale = Math.max(1, scaleY, scaleX);
    this._tileW = TILE_W * scale;
    this._tileH = TILE_H * scale;

    this.tileMap = [];
    const rng = this._mulberry32(seed);

    for (let r = 0; r < TILE_ROWS; r++) {
      this.tileMap[r] = [];
      for (let c = 0; c < TILE_COLS; c++) {
        const noise = rng();
        const cx = c / TILE_COLS;
        const cy = r / TILE_ROWS;
        const distCenter = Math.hypot(cx - 0.5, cy - 0.5) * 2;

        if (distCenter < 0.15 && noise < 0.6) {
          this.tileMap[r][c] = TILE_OASIS;
        } else if (noise < 0.06) {
          this.tileMap[r][c] = TILE_ROCK;
        } else if (noise < 0.15) {
          this.tileMap[r][c] = TILE_DARK_SAND;
        } else if (noise < 0.2 && distCenter < 0.6) {
          this.tileMap[r][c] = TILE_PATH;
        } else {
          this.tileMap[r][c] = TILE_SAND;
        }
      }
    }

    // Ensure center area is clear (spawn zone)
    const cr = Math.floor(TILE_ROWS / 2);
    const cc = Math.floor(TILE_COLS / 2);
    for (let dr = -2; dr <= 2; dr++) {
      for (let dc = -2; dc <= 2; dc++) {
        const r = cr + dr;
        const c = cc + dc;
        if (r >= 0 && r < TILE_ROWS && c >= 0 && c < TILE_COLS) {
          if (this.tileMap[r][c] === TILE_ROCK) {
            this.tileMap[r][c] = TILE_SAND;
          }
        }
      }
    }

    this._generated = true;
    this._preRenderTiles();
  }

  /**
   * Pre-render the tile map to an offscreen canvas for performance.
   * The canvas is sized to the actual projected bounding box of the tile
   * grid (not mapW×mapH directly) and offset so no tile is clipped by a
   * negative coordinate — see generateTileMap() for the scale rationale.
   */
  _preRenderTiles() {
    const tileW = this._tileW || TILE_W;
    const tileH = this._tileH || TILE_H;
    const hw = tileW / 2, hh = tileH / 2, depth = Math.max(6, tileH * 0.2);

    // احسب حدود الإسقاط الفعلية لأركان الشبكة الأربعة لتفادي أي قص
    const corners = [
      this.isoToScreen(0, 0),
      this.isoToScreen((TILE_COLS - 1) * tileW, 0),
      this.isoToScreen(0, (TILE_ROWS - 1) * tileH),
      this.isoToScreen((TILE_COLS - 1) * tileW, (TILE_ROWS - 1) * tileH),
    ];
    const minX = Math.min(...corners.map(c => c.x)) - hw;
    const maxX = Math.max(...corners.map(c => c.x)) + hw;
    const minY = Math.min(...corners.map(c => c.y)) - hh;
    const maxY = Math.max(...corners.map(c => c.y)) + hh + depth;

    this._tileDrawOffsetX = minX;
    this._tileDrawOffsetY = minY;

    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(maxX - minX);
    canvas.height = Math.ceil(maxY - minY);
    const ctx = canvas.getContext("2d");
    ctx.translate(-minX, -minY);

    for (let r = 0; r < TILE_ROWS; r++) {
      for (let c = 0; c < TILE_COLS; c++) {
        const type = this.tileMap[r][c];
        const colors = TILE_COLORS[type] || TILE_COLORS[TILE_SAND];
        this._drawIsoTile(ctx, c, r, colors);
      }
    }

    this._tileCanvas = canvas;
  }

  /**
   * Draw a single isometric tile (diamond shape) — مرة واحدة فقط عند التوليد
   * (_preRenderTiles)، لذا تحمل تدرّجات وتفاصيل إضافية بلا أي تكلفة أثناء اللعب.
   */
  _drawIsoTile(ctx, col, row, colors) {
    const tileW = this._tileW || TILE_W;
    const tileH = this._tileH || TILE_H;
    const { x, y } = this.isoToScreen(col * tileW, row * tileH);
    const hw = tileW / 2;
    const hh = tileH / 2;
    const depth = Math.max(6, tileH * 0.2);
    const variance = tileVariance(col, row);

    // الوجه العلوي — تدرّج خفيف (إضاءة من أعلى-اليسار) بدل تلوين مسطّح بالكامل
    const grad = ctx.createLinearGradient(x - hw, y - hh, x + hw, y + hh);
    grad.addColorStop(0, shadeHexColor(colors.top, 0.10 + variance * 0.04));
    grad.addColorStop(0.55, colors.top);
    grad.addColorStop(1, shadeHexColor(colors.top, -0.08 - variance * 0.04));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(x, y - hh);
    ctx.lineTo(x + hw, y);
    ctx.lineTo(x, y + hh);
    ctx.lineTo(x - hw, y);
    ctx.closePath();
    ctx.fill();

    // حدّ رفيع لإبراز حواف البلاطة — إحساس أعمق بالمنظور الإيزومتري
    ctx.strokeStyle = "rgba(0,0,0,0.06)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // بقع رملية خفيفة (نسيج) — تكسر التكرار البصري المسطّح لأرضية الصحراء
    if (variance > 0.55) {
      const speckleCount = 2 + Math.floor(variance * 3);
      ctx.fillStyle = shadeHexColor(colors.top, -0.14);
      ctx.globalAlpha = 0.25;
      for (let i = 0; i < speckleCount; i++) {
        const sv = tileVariance(col * 13 + i, row * 7 + i);
        const sx = x + (sv - 0.5) * hw * 1.2;
        const sy = y + (tileVariance(row * 11 + i, col * 5 + i) - 0.5) * hh * 1.2;
        ctx.beginPath();
        ctx.ellipse(sx, sy, hw * 0.05, hh * 0.05, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // Left face (side)
    ctx.fillStyle = shadeHexColor(colors.left, -variance * 0.06);
    ctx.beginPath();
    ctx.moveTo(x - hw, y);
    ctx.lineTo(x, y + hh);
    ctx.lineTo(x, y + hh + depth);
    ctx.lineTo(x - hw, y + depth);
    ctx.closePath();
    ctx.fill();

    // Right face (side)
    ctx.fillStyle = shadeHexColor(colors.right, -variance * 0.06);
    ctx.beginPath();
    ctx.moveTo(x + hw, y);
    ctx.lineTo(x, y + hh);
    ctx.lineTo(x, y + hh + depth);
    ctx.lineTo(x + hw, y + depth);
    ctx.closePath();
    ctx.fill();
  }

  /**
   * Draw pre-rendered tile map.
   */
  drawTiles(ctx) {
    if (this._tileCanvas) {
      ctx.drawImage(this._tileCanvas, this._tileDrawOffsetX || 0, this._tileDrawOffsetY || 0);
    }
  }

  /**
   * Draw individual tiles (for real-time updates if needed).
   */
  drawTilesDirect(ctx) {
    for (let r = 0; r < TILE_ROWS; r++) {
      for (let c = 0; c < TILE_COLS; c++) {
        const type = this.tileMap[r][c];
        const colors = TILE_COLORS[type] || TILE_COLORS[TILE_SAND];
        this._drawIsoTile(ctx, c, r, colors);
      }
    }
  }

  /**
   * Convert world (flat 2D) coordinates to isometric screen coordinates.
   */
  isoToScreen(wx, wy) {
    return {
      x: (wx - wy) * 0.5,
      y: (wx + wy) * 0.25
    };
  }

  /**
   * Convert isometric screen coordinates back to world (flat 2D) coordinates.
   */
  screenToIso(sx, sy) {
    return {
      x: sx + sy * 2,
      y: sy * 2 - sx
    };
  }

  /**
   * Get tile at world position.
   */
  getTileAt(wx, wy) {
    if (!this.tileMap) return TILE_SAND;
    const col = Math.floor(wx / (this._tileW || TILE_W));
    const row = Math.floor(wy / (this._tileH || TILE_H));
    if (row < 0 || row >= TILE_ROWS || col < 0 || col >= TILE_COLS) return TILE_SAND;
    return this.tileMap[row][col];
  }

  /**
   * Is a tile walkable?
   */
  isTileWalkable(wx, wy) {
    return this.getTileAt(wx, wy) !== TILE_ROCK;
  }

  /**
   * Get depth sort value for isometric rendering (Y-based).
   * Entities with higher Y are drawn later (in front).
   */
  getDepth(wx, wy) {
    return wx + wy;
  }

  /**
   * Simple seeded RNG (mulberry32).
   */
  _mulberry32(a) {
    return function() {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
}

/**
 * DepthSorter — Manages drawing order for entities.
 */
class DepthSorter {
  constructor() {
    this._entities = [];
  }

  /**
   * Add an entity to be sorted.
   * @param {number} x - world X
   * @param {number} y - world Y
   * @param {function} drawFn - function to call for drawing
   */
  add(x, y, drawFn) {
    this._entities.push({ x, y, drawFn, depth: x + y });
  }

  /**
   * Draw all entities sorted by depth.
   */
  drawAll(ctx) {
    this._entities.sort((a, b) => a.depth - b.depth);
    for (const e of this._entities) {
      ctx.save();
      e.drawFn(ctx);
      ctx.restore();
    }
    this._entities.length = 0;
  }

  clear() {
    this._entities.length = 0;
  }
}

export { IsometricSystem, DepthSorter, TILE_W, TILE_H, TILE_ROWS, TILE_COLS, WORLD_W, WORLD_H, TILE_SAND, TILE_ROCK, TILE_OASIS, TILE_PATH, TILE_DARK_SAND, TILE_COLORS };
