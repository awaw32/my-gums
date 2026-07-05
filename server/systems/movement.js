"use strict";
const MOVE_SPEED = 4;

function stepRoom(room) {
  room.players.forEach((p) => {
    if (p.vx || p.vy) {
      const len = Math.hypot(p.vx, p.vy);
      if (len > 1) { p.vx /= len; p.vy /= len; }
      p.x += p.vx * MOVE_SPEED;
      p.y += p.vy * MOVE_SPEED;
      p.x = Math.max(0, Math.min(3200, p.x));
      p.y = Math.max(0, Math.min(3200, p.y));
    }
  });
}

module.exports = { stepRoom };
