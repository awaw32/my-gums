import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// 🛡️ قبل هذا الإصلاح: إن لم يضبط المشغّل ADMIN_KEY في بيئة الإنتاج (وهو فارغ
// افتراضياً في .env.example)، كانت /metrics تصبح عامة بالكامل بلا أي مصادقة —
// تكشف latency/tick drift/حالة التشغيل لأي زائر. الإصلاح: fail closed (404)
// في الإنتاج بلا ADMIN_KEY، بدل fail open (السماح للجميع).

function makeReqRes(url, headers = {}) {
  const req = { url, method: 'GET', headers, socket: { remoteAddress: '127.0.0.1' } };
  const res = {
    statusCode: null,
    headers: {},
    body: '',
    writeHead(code, h) { this.statusCode = code; Object.assign(this.headers, h || {}); },
    setHeader(k, v) { this.headers[k] = v; },
    end(body) { this.body = body || ''; },
  };
  return { req, res };
}

describe('🔒 حماية /metrics (server/routes/api.js)', () => {
  const ORIGINAL_ENV = { ...process.env };

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  async function callMetrics(headers = {}) {
    // 🛡️ api.js وconfig.js من نوع CommonJS — require() الحقيقي يخزّن النتيجة
    // بمعزل عن أي حيلة إعادة استيراد ESM. يجب مسح require.cache يدوياً حتى
    // تُعاد قراءة process.env (NODE_ENV/ADMIN_KEY/JWT_SECRET) من جديد كل مرة.
    const path = await import('node:path');
    for (const rel of ['../server/config.js', '../server/routes/api.js', '../server/network/auth.js']) {
      const resolved = path.default.resolve(__dirname, rel);
      delete require.cache[resolved];
    }
    const { createApiRoutes } = require('../server/routes/api.js');
    const handleApiRequest = createApiRoutes({
      databaseHelper: {}, memStore: new Map(), Player: {}, getDefaultPlayer: () => ({}),
      markDirty: () => {}, BUILDING_DEFS: {}, TICK_MS: 50, claimReward: () => ({}), analytics: null,
    });
    const { req, res } = makeReqRes('/metrics', headers);
    await handleApiRequest(req, res);
    return res;
  }

  it('يرفض /metrics بالكامل (404) في الإنتاج عند غياب ADMIN_KEY — fail closed', async () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'test-secret-for-production-mode';
    delete process.env.ADMIN_KEY;
    process.env.ENABLE_METRICS = 'true';
    const res = await callMetrics();
    expect(res.statusCode).toBe(404);
  });

  it('يسمح بالوصول في التطوير بلا ADMIN_KEY (سلوك محلي غير حساس)', async () => {
    process.env.NODE_ENV = 'development';
    delete process.env.ADMIN_KEY;
    process.env.ENABLE_METRICS = 'true';
    const res = await callMetrics();
    expect(res.statusCode).toBe(200);
  });

  it('يرفض (401) طلباً بلا Authorization صحيح عندما يكون ADMIN_KEY مضبوطاً', async () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'test-secret-for-production-mode';
    process.env.ADMIN_KEY = 'secret123';
    process.env.ENABLE_METRICS = 'true';
    const res = await callMetrics();
    expect(res.statusCode).toBe(401);
  });

  it('يسمح بالوصول بمفتاح Authorization صحيح حتى في الإنتاج', async () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'test-secret-for-production-mode';
    process.env.ADMIN_KEY = 'secret123';
    process.env.ENABLE_METRICS = 'true';
    const res = await callMetrics({ authorization: 'Bearer secret123' });
    expect(res.statusCode).toBe(200);
  });
});
