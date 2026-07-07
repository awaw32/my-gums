"use strict";

const { WORLD_W, WORLD_H } = require("../config");
const MAX_SPEED_PX_PER_TICK = 15;
const MAX_SPEED_PER_UPDATE_5S = 750;
const WORLD_W2 = WORLD_W / 2;
const WORLD_H2 = WORLD_H / 2;

function clampPosition(x, y) {
  return {
    x: Math.max(-WORLD_W2 + 16, Math.min(WORLD_W2 - 16, x)),
    y: Math.max(-WORLD_H2 + 16, Math.min(WORLD_H2 - 16, y)),
  };
}

function validatePosition(newX, newY, lastX, lastY, timeDeltaMs) {
  if (typeof newX !== "number" || typeof newY !== "number" || !isFinite(newX) || !isFinite(newY)) {
    return { valid: false, reason: "invalid coordinates" };
  }
  const dx = newX - lastX;
  const dy = newY - lastY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const maxDist = timeDeltaMs > 0
    ? Math.min(MAX_SPEED_PER_UPDATE_5S, (timeDeltaMs / 1000) * MAX_SPEED_PX_PER_TICK * 20)
    : MAX_SPEED_PER_UPDATE_5S;
  if (dist > maxDist) {
    return { valid: false, reason: `movement too fast: ${Math.round(dist)} > ${Math.round(maxDist)}` };
  }
  return { valid: true, clamped: clampPosition(newX, newY) };
}

module.exports = { validatePosition, clampPosition, MAX_SPEED_PER_UPDATE_5S };
