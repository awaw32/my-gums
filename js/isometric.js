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
   */
  _preRenderTiles() {
    const canvas = document.createElement("canvas");
    canvas.width = this.mapW;
    canvas.height = this.mapH;
    const ctx = canvas.getContext("2d");

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
   * Draw a single isometric tile (diamond shape).
   */
  _drawIsoTile(ctx, col, row, colors) {
    const { x, y } = this.isoToScreen(col * TILE_W, row * TILE_H);
    const hw = TILE_W / 2;
    const hh = TILE_H / 2;
    const depth = 6;

    // Top face
    ctx.fillStyle = colors.top;
    ctx.beginPath();
    ctx.moveTo(x, y - hh);
    ctx.lineTo(x + hw, y);
    ctx.lineTo(x, y + hh);
    ctx.lineTo(x - hw, y);
    ctx.closePath();
    ctx.fill();

    // Left face (side)
    ctx.fillStyle = colors.left;
    ctx.beginPath();
    ctx.moveTo(x - hw, y);
    ctx.lineTo(x, y + hh);
    ctx.lineTo(x, y + hh + depth);
    ctx.lineTo(x - hw, y + depth);
    ctx.closePath();
    ctx.fill();

    // Right face (side)
    ctx.fillStyle = colors.right;
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
      ctx.drawImage(this._tileCanvas, 0, 0);
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
    const col = Math.floor(wx / TILE_W);
    const row = Math.floor(wy / TILE_H);
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
