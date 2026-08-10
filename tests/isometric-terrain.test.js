import { describe, it, expect, beforeAll } from 'vitest';
import { IsometricSystem, TILE_ROCK, TILE_OASIS, TILE_WATER, TILE_ROWS, TILE_COLS } from '../js/isometric.js';

// 🛡️ قبل هذا الإصلاح: توليد الخريطة أصبح يعتمد على ضوضاء قيمة (value noise)
// بدل عتبة عشوائية بسيطة لتحسين شكل التضاريس (تكتلات طبيعية بدل بقع
// متناثرة). لكن وجود الواحة نفسها كان مشروطاً بتجاوز قيمة الضوضاء عند مركز
// الخريطة عتبة معينة — بعض قيم seed (وseed = Date.now() % 10000 يتغيّر مع كل
// جلسة لعب فعلية) كانت تُنتج خريطة بلا أي واحة أو ماء إطلاقاً (~22.5% من
// البذور المفحوصة). الإصلاح: نصف قطر الواحة يتأرجح بالضوضاء لحواف طبيعية،
// لكن وجودها نفسه غير مشروط بعتبة — مضمونة دائماً بصرف النظر عن seed.

function makeCanvasStub() {
  global.document = {
    createElement: () => ({
      getContext: () => ({
        translate() {}, createLinearGradient() { return { addColorStop() {} }; },
        fillRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, quadraticCurveTo() {},
        closePath() {}, fill() {}, stroke() {}, ellipse() {}, drawImage() {},
      }),
      width: 0, height: 0,
    }),
  };
}

function countTileType(iso, type) {
  let count = 0;
  for (const row of iso.tileMap) for (const t of row) if (t === type) count++;
  return count;
}

describe('🏜️ توليد تضاريس الخريطة (js/isometric.js)', () => {
  beforeAll(() => {
    makeCanvasStub();
  });

  it('يضمن وجود واحة أو بركة ماء دائماً بصرف النظر عن seed (فحص شامل)', () => {
    for (let seed = 0; seed < 10000; seed += 7) {
      const iso = new IsometricSystem(2400, 2400);
      iso.generateTileMap(seed);
      const oasisOrWater = countTileType(iso, TILE_OASIS) + countTileType(iso, TILE_WATER);
      expect(oasisOrWater, `seed=${seed} أنتج خريطة بلا واحة/ماء`).toBeGreaterThan(0);
    }
  });

  it('منطقة الإطلاق وسط الخريطة خالية من الصخور دائماً (كل المستويات قابلة للحركة عند البداية)', () => {
    const cr = Math.floor(TILE_ROWS / 2);
    const cc = Math.floor(TILE_COLS / 2);
    for (const seed of [1, 42, 999, 5000, 9999, 123456, 7777]) {
      const iso = new IsometricSystem(2400, 2400);
      iso.generateTileMap(seed);
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          expect(iso.tileMap[cr + dr][cc + dc], `seed=${seed} عند (${cr + dr},${cc + dc})`).not.toBe(TILE_ROCK);
        }
      }
    }
  });

  it('الواحة تبقى قريبة من مركز الخريطة (لا تظهر عشوائياً في الأطراف)', () => {
    const iso = new IsometricSystem(2400, 2400);
    iso.generateTileMap(4242);
    for (let r = 0; r < TILE_ROWS; r++) {
      for (let c = 0; c < TILE_COLS; c++) {
        if (iso.tileMap[r][c] === TILE_OASIS || iso.tileMap[r][c] === TILE_WATER) {
          const cx = c / TILE_COLS, cy = r / TILE_ROWS;
          const distCenter = Math.hypot(cx - 0.5, cy - 0.5) * 2;
          expect(distCenter, `بلاطة واحة/ماء بعيدة جداً عن المركز عند (${r},${c})`).toBeLessThan(0.3);
        }
      }
    }
  });

  it('isTileWalkable يرفض المشي على الصخور والماء لكن يسمح بالرمل والواحة', () => {
    const iso = new IsometricSystem(2400, 2400);
    iso.generateTileMap(4242);
    let foundRock = false, foundWater = false;
    for (let r = 0; r < TILE_ROWS && (!foundRock || !foundWater); r++) {
      for (let c = 0; c < TILE_COLS; c++) {
        const t = iso.tileMap[r][c];
        const wx = c * (iso._tileW || 64);
        const wy = r * (iso._tileH || 32);
        if (t === TILE_ROCK && !foundRock) {
          expect(iso.isTileWalkable(wx, wy)).toBe(false);
          foundRock = true;
        }
        if (t === TILE_WATER && !foundWater) {
          expect(iso.isTileWalkable(wx, wy)).toBe(false);
          foundWater = true;
        }
      }
    }
    expect(foundRock, 'لم يُعثر على أي بلاطة صخر للفحص').toBe(true);
    expect(foundWater, 'لم يُعثر على أي بلاطة ماء للفحص').toBe(true);
  });

  it('توليد الخريطة حتمي بالكامل لنفس seed (لا عشوائية غير محسوبة)', () => {
    const iso1 = new IsometricSystem(2400, 2400);
    iso1.generateTileMap(777);
    const iso2 = new IsometricSystem(2400, 2400);
    iso2.generateTileMap(777);
    expect(iso1.tileMap).toEqual(iso2.tileMap);
  });

  it('توليد خريطتين بـ seed مختلف ينتج تخطيطاً مختلفاً (التنويع بين الجلسات يعمل فعلاً)', () => {
    const iso1 = new IsometricSystem(2400, 2400);
    iso1.generateTileMap(1);
    const iso2 = new IsometricSystem(2400, 2400);
    iso2.generateTileMap(2);
    expect(iso1.tileMap).not.toEqual(iso2.tileMap);
  });
});
