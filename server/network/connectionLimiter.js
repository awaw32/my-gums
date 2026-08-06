"use strict";

/**
 * server/network/connectionLimiter.js
 * ============================================================================
 * 🛡️ حد أقصى لعدد اتصالات WebSocket المتزامنة من نفس عنوان IP
 * كان هناك حد 60 رسالة/ثانية لكل اتصال فردي فقط (worldHandler.js) لكن بلا أي
 * سقف على عدد الاتصالات نفسها من نفس IP — مهاجم يفتح عشرات الاتصالات (حسابات
 * ضيوف) من جهاز واحد يستطيع مضاعفة معدل الطلبات الكلي (شراء/مزايدات/رسائل
 * حرب) خطياً بعدد الاتصالات. هذا يفرض سقفاً معقولاً لكل IP.
 * ============================================================================
 */

const MAX_CONNECTIONS_PER_IP = 20;

function createConnectionLimiter({ maxPerIp = MAX_CONNECTIONS_PER_IP } = {}) {
  const counts = new Map(); // ip -> عدد الاتصالات المفتوحة حالياً

  /** يحاول حجز مقعد اتصال لهذا IP؛ يعيد false إن تجاوز الحد */
  function tryAcquire(ip) {
    const current = counts.get(ip) || 0;
    if (current >= maxPerIp) return false;
    counts.set(ip, current + 1);
    return true;
  }

  /** يُستدعى عند إغلاق الاتصال — يجب استدعاؤها مرة واحدة بالضبط لكل tryAcquire ناجح */
  function release(ip) {
    const current = counts.get(ip) || 0;
    if (current <= 1) counts.delete(ip);
    else counts.set(ip, current - 1);
  }

  return { tryAcquire, release, maxPerIp };
}

module.exports = { createConnectionLimiter, MAX_CONNECTIONS_PER_IP };
