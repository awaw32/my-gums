/**
 * 🏜️ ملك الصحراء — Service Worker
 * يساعد على:
 * 1. تخزين الملفات مؤقتاً للتحميل السريع
 * 2. تشغيل اللعبة حتى لو ضعف النت
 * 3. تحديث تلقائي عند تغيير الإصدار
 */

const CACHE_VERSION = 'v3';
const CACHE_NAME = `desert-kingdom-${CACHE_VERSION}`;

// الملفات الثابتة — لا تتغير إلا عند التحديث
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
  '/js/war-manager.js',
  '/js/notification-manager.js',
  '/js/oasis-manager.js',
  '/js/upgrade-tree.js',
  '/js/game-store.js',
  '/js/asset-manager.js',
  '/js/sprite-factory.js',
  '/js/isometric.js',
  '/js/pathfinding.js',
  '/js/enemies.js',
  '/js/combat/combat-effects.js',
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
  self.clients.claim();
});

// فلترة الملفات حسب النوع
function isStaticAsset(pathname) {
  return /\.(css|js|png|jpg|jpeg|gif|svg|ico|woff2?|ttf|eot|json)$/.test(pathname);
}

function isHTML(pathname) {
  return pathname.endsWith('.html') || pathname === '/';
}

// استراتيجية: Stale-While-Revalidate للملفات الثابتة
// — يعرض الكاش فوراً ثم يحدّث في الخلفية
function staleWhileRevalidate(request) {
  return caches.open(CACHE_NAME).then((cache) => {
    return cache.match(request).then((cached) => {
      const fetchPromise = fetch(request).then((response) => {
        if (response.ok) {
          cache.put(request, response.clone());
        }
        return response;
      }).catch(() => cached);

      return cached || fetchPromise;
    });
  });
}

// استراتيجية: Network First مع Offline fallback
function networkFirst(request) {
  return fetch(request).then((response) => {
    if (response.ok) {
      const clone = response.clone();
      caches.open(CACHE_NAME).then((cache) => {
        cache.put(request, clone);
      });
    }
    return response;
  }).catch(() => {
    return caches.match(request).then((cached) => {
      if (cached) return cached;
      return new Response('Offline', { status: 503 });
    });
  });
}

// الصفحة الافتراضية عند عدم الاتصال
const OFFLINE_HTML = `<html dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ملك الصحراء</title><style>body{background:#FFF8F0;display:flex;align-items:center;justify-content:center;height:100vh;font-family:Cairo,sans-serif;direction:rtl;text-align:center;padding:20px}div{max-width:400px}h2{color:#C0392B;font-size:1.5rem}p{color:#7D6B5A;font-size:1rem;line-height:1.6}button{background:#C0392B;color:#fff;border:0;padding:12px 24px;border-radius:12px;font-size:1rem;font-weight:700;cursor:pointer;margin-top:16px}</style></head><body><div><h2>🚫 لا يوجد اتصال</h2><p>عذراً، اللعبة تحتاج اتصال بالإنترنت للعب. حاول مرة أخرى لاحقاً.</p><button onclick="window.location.reload()">إعادة المحاولة</button></div></body></html>`;

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // تجاهل طلبات API و WebSocket
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/ws/')) {
    return;
  }

  // تجاهل طلبات التحقق من الإصدار والصحة
  if (url.pathname === '/version' || url.pathname === '/health') {
    event.respondWith(fetch(event.request));
    return;
  }

  // الملفات الثابتة (CSS, JS, صور) — Stale-While-Revalidate
  if (isStaticAsset(url.pathname)) {
    event.respondWith(staleWhileRevalidate(event.request));
    return;
  }

  // HTML — Network First مع Offline fallback
  if (isHTML(url.pathname)) {
    event.respondWith(
      fetch(event.request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone);
          });
        }
        return response;
      }).catch(() => {
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          return new Response(OFFLINE_HTML, {
            headers: { 'Content-Type': 'text/html; charset=utf-8' }
          });
        });
      })
    );
    return;
  }

  // الباقي — Network First
  event.respondWith(networkFirst(event.request));
});
