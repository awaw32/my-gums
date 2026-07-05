"use strict";
function makeRateLimiter({ maxPerSec = 30 } = {}) {
  let windowStart = 0;
  let count = 0;
  return () => {
    const now = Date.now();
    if (now - windowStart > 1000) {
      windowStart = now;
      count = 0;
    }
    count++;
    return count <= maxPerSec;
  };
}

module.exports = { makeRateLimiter };
