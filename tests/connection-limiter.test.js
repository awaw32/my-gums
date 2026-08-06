import { describe, it, expect } from 'vitest';
import { createConnectionLimiter } from '../server/network/connectionLimiter.js';

// 🛡️ قبل هذا الملف: لا حد أقصى على عدد اتصالات WebSocket المتزامنة من نفس
// IP — مهاجم يفتح عشرات الاتصالات (حسابات ضيوف) من جهاز واحد يستطيع مضاعفة
// معدل الطلبات الكلي (شراء/مزايدات/رسائل حرب) خطياً بعدد الاتصالات.

describe('🛡️ حد اتصالات WebSocket لكل IP (server/network/connectionLimiter.js)', () => {
  it('يسمح بالاتصالات ضمن الحد الأقصى', () => {
    const limiter = createConnectionLimiter({ maxPerIp: 3 });
    expect(limiter.tryAcquire('1.2.3.4')).toBe(true);
    expect(limiter.tryAcquire('1.2.3.4')).toBe(true);
    expect(limiter.tryAcquire('1.2.3.4')).toBe(true);
  });

  it('يرفض الاتصال الرابع من نفس IP بعد بلوغ الحد', () => {
    const limiter = createConnectionLimiter({ maxPerIp: 3 });
    limiter.tryAcquire('1.2.3.4');
    limiter.tryAcquire('1.2.3.4');
    limiter.tryAcquire('1.2.3.4');
    expect(limiter.tryAcquire('1.2.3.4')).toBe(false);
  });

  it('لا يخلط الحدود بين عناوين IP مختلفة', () => {
    const limiter = createConnectionLimiter({ maxPerIp: 2 });
    limiter.tryAcquire('1.1.1.1');
    limiter.tryAcquire('1.1.1.1');
    expect(limiter.tryAcquire('2.2.2.2')).toBe(true);
  });

  it('يفرج عن المقعد عند release ويسمح باتصال جديد بعدها', () => {
    const limiter = createConnectionLimiter({ maxPerIp: 1 });
    expect(limiter.tryAcquire('1.2.3.4')).toBe(true);
    expect(limiter.tryAcquire('1.2.3.4')).toBe(false);
    limiter.release('1.2.3.4');
    expect(limiter.tryAcquire('1.2.3.4')).toBe(true);
  });

  it('release لا يسبب عداداً سالباً عند استدعائه أكثر من مرة', () => {
    const limiter = createConnectionLimiter({ maxPerIp: 2 });
    limiter.tryAcquire('1.2.3.4');
    limiter.release('1.2.3.4');
    limiter.release('1.2.3.4'); // استدعاء زائد — يجب ألا يكسر شيئاً
    expect(limiter.tryAcquire('1.2.3.4')).toBe(true);
    expect(limiter.tryAcquire('1.2.3.4')).toBe(true);
    expect(limiter.tryAcquire('1.2.3.4')).toBe(false);
  });
});
