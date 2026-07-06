/**
 * 🏜️ ملك الصحراء — Service Worker
 * يساعد على:
 * 1. تخزين الملفات مؤقتاً للتحميل السريع
 * 2. تشغيل اللعبة حتى لو ضعف النت
 * 3. تحديث تلقائي عند تغيير الإصدار
 */

const CACHE_NAME = 'desert-kingdom-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/lands.html',
  '/manifest.json',
  '/css/style.css',
  '/config/images.js',
  '/js/main.js',
  '/js/ui.js',
  '/js/ui/ui-core.js',
  '/js/ui/ui-gameplay.js',
  '/js/ui/ui-promotion.js',
  '/js/ui/context-menu.js',
  '/js/ui/world-upgrades.js',
  '/js/economy.js',
  '/js/army.js',
  '/js/village.js',
  '/js/world.js',
  '/js/engine.js',
  '/js/save.js',
  '/js/network.js',
  '/js/network-sync.js',
  '/js/hero.js',
  '/js/story-manager.js',
  '/js/story.js',
  '/js/quests.js',
  '/js/achievements.js',
  '/js/prestige.js',
  '/js/inventory.js',
  '/js/events.js',
  '/js/daily-login.js',
  '/js/tutorial.js',
  '/js/audio.js',
  '/js/alliance-manager.js',
  '/js/oasis-manager.js',
  '/js/upgrade-tree.js',
  '/js/game-store.js',
  '/js/asset-manager.js',
  '/js/sprite-factory.js',
  '/js/isometric.js',
  '/js/pathfinding.js',
  '/js/enemies.js',
  '/js/weapons.js',
  '/js/br-mode.js',
  '/js/combat/combat-effects.js',
  '/js/combat/knowledge-system.js',
  '/js/combat/troop-visuals.js',
  '/js/combat/weapon-system.js',
  '/js/combat/weapon-visuals.js'
];

// التثبيت — تخزين كل الملفات الأساسية
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  // تفعيل فوراً بدون انتظار
  self.skipWaiting();
});

// التفعيل — حذف الكاش القديم
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  // السيطرة على كل الصفحات المفتوحة فوراً
  self.clients.claim();
});

// استراتيجية: الشبكة أولاً مع fallback للكاش (للملفات الرئيسية)
// والكاش أولاً للملفات الثابتة
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // تجاهل طلبات API و WebSocket
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/ws/')) {
    return;
  }

  // تجاهل طلبات التحقق من الإصدار
  if (url.pathname === '/version' || url.pathname === '/health') {
    event.respondWith(fetch(event.request));
    return;
  }

  // استراتيجية الكاش أولاً للملفات الثابتة
  event.respondWith(
    caches.match(event.request).then((cached) => {
      // إذا كان الملف موجوداً في الكاش — ارجع منه
      if (cached) {
        // ومع ذلك حاول تحديثه في الخلفية
        fetch(event.request).then((response) => {
          if (response.ok) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, response);
            });
          }
        }).catch(() => {});
        return cached;
      }

      // إذا الملف مش موجود — حمله من الشبكة  
      return fetch(event.request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone);
          });
        }
        return response;
      }).catch(() => {
        // إذا الشبكة مش موجودة والمحتوى مش مخبأ — أرجع رسالة خطأ
        if (url.pathname.endsWith('.html')) {
          return new Response(
            '<html dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ملك الصحراء</title><style>body{background:#FFF8F0;display:flex;align-items:center;justify-content:center;height:100vh;font-family:Cairo,sans-serif;direction:rtl;text-align:center;padding:20px}div{max-width:400px}h2{color:#C0392B;font-size:1.5rem}p{color:#7D6B5A;font-size:1rem;line-height:1.6}button{background:#C0392B;color:#fff;border:0;padding:12px 24px;border-radius:12px;font-size:1rem;font-weight:700;cursor:pointer;margin-top:16px}</style></head><body><div><h2>🚫 لا يوجد اتصال</h2><p>عذراً، اللعبة تحتاج اتصال بالإنترنت للعب. حاول مرة أخرى لاحقاً.</p><button onclick="window.location.reload()">إعادة المحاولة</button></div></body></html>',
            { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
          );
        }
        return new Response('Offline', { status: 503 });
      });
    })
  );
});
