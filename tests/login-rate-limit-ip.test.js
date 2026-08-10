import { describe, it, expect, afterEach } from 'vitest';

// 🛡️ قبل هذا الإصلاح: IP المستخدم في rate limiting لتسجيل الدخول كان يُقرأ
// دائماً من X-Forwarded-For إن وُجد، بلا أي شرط. إن كان الخادم مكشوفاً مباشرة
// (بدون reverse proxy يُصفّي هذا الهيدر)، يستطيع أي زائر إرسال قيمة عشوائية
// مختلفة لهذا الهيدر مع كل طلب ليحصل على حد "5 محاولات/دقيقة" جديد كل مرة —
// يُبطل الحماية من brute-force بالكامل. الإصلاح: TRUST_PROXY=false (افتراضي)
// يتجاهل الهيدر تماماً ويعتمد على عنوان socket الحقيقي فقط.
//
// ملاحظة تصميم الاختبار: فحص حد rate limit في api.js يحدث بشكل متزامن تماماً
// (writeHead/end مباشرة) قبل أي قراءة لجسم الطلب — فلا حاجة لانتظار أي حدث
// غير متزامن للتحقق من رفض 429. لا نستخدم أي setTimeout/queueMicrotask هنا
// عمداً لتفادي اختبار هش (flaky) يعتمد على التوقيت.

function makeReqRes(url, { headers = {}, remoteAddress = '203.0.113.5' } = {}) {
  const req = {
    url, method: 'POST', headers,
    socket: { remoteAddress },
    on() { return this; }, // لا حاجة لمعالجة جسم الطلب — القرار يُتخذ قبل قراءته
  };
  const res = {
    statusCode: null, headers: {}, body: '',
    writeHead(code, h) { this.statusCode = code; Object.assign(this.headers, h || {}); },
    setHeader(k, v) { this.headers[k] = v; },
    end(body) { this.body = body || ''; },
  };
  return { req, res };
}

describe('🔒 حماية rate limit لتسجيل الدخول ضد تزوير X-Forwarded-For', () => {
  const ORIGINAL_ENV = { ...process.env };

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  function makeHandler() {
    // 🛡️ api.js وconfig.js من نوع CommonJS — require() الحقيقي في Node يخزّن
    // النتيجة مؤقتاً بمعزل عن أي إعادة استيراد ESM. يجب مسح require.cache
    // يدوياً حتى تُعاد قراءة process.env.TRUST_PROXY من جديد في كل اختبار.
    const path = require('node:path');
    const configPath = path.resolve(__dirname, '../server/config.js');
    const apiPath = path.resolve(__dirname, '../server/routes/api.js');
    const metricsPath = path.resolve(__dirname, '../server/metrics.js');
    delete require.cache[configPath];
    delete require.cache[apiPath];
    delete require.cache[metricsPath];
    const { createApiRoutes } = require('../server/routes/api.js');
    return createApiRoutes({
      databaseHelper: {}, memStore: new Map(), Player: {}, getDefaultPlayer: () => ({}),
      markDirty: () => {}, BUILDING_DEFS: {}, TICK_MS: 50, claimReward: () => ({}), analytics: null,
    });
  }

  function attemptLogin(handleApiRequest, forwardedFor) {
    const headers = forwardedFor ? { 'x-forwarded-for': forwardedFor } : {};
    const { req, res } = makeReqRes('/api/auth/login', { headers, remoteAddress: '203.0.113.5' });
    // لا ننتظر النتيجة المُرجَعة (Promise) — قرار rate limit متزامن ومتاح فوراً
    // في res.statusCode بمجرد هذا الاستدعاء، قبل أي معالجة غير متزامنة لاحقة
    handleApiRequest(req, res);
    return res;
  }

  it('بلا TRUST_PROXY: تزوير X-Forwarded-For لا يتفادى حد المحاولات (نفس socket IP دائماً)', () => {
    delete process.env.TRUST_PROXY;
    const handleApiRequest = makeHandler();
    // 5 محاولات بهويات X-Forwarded-For مختلفة تماماً في كل مرة
    for (let i = 0; i < 5; i++) {
      attemptLogin(handleApiRequest, `10.0.0.${i}`);
    }
    // المحاولة السادسة يجب أن تُرفض بـ429 لأن الخادم يعتمد على socket IP الثابت
    const res = attemptLogin(handleApiRequest, '10.0.0.99');
    expect(res.statusCode).toBe(429);
  });

  it('مع TRUST_PROXY=true: كل X-Forwarded-For مختلف يُعامل كـ IP منفصل (سلوك متوقع خلف بروكسي حقيقي)', () => {
    process.env.TRUST_PROXY = 'true';
    const handleApiRequest = makeHandler();
    for (let i = 0; i < 5; i++) {
      attemptLogin(handleApiRequest, `10.0.0.${i}`);
    }
    // كل IP مختلف — لا واحد منهم تجاوز حده الخاص (5 كل واحد استُخدم مرة واحدة)
    const res = attemptLogin(handleApiRequest, '10.0.0.200');
    expect(res.statusCode).not.toBe(429);
  });
});
