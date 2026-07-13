const CACHE_VERSION = 'v4';
const CACHE_NAME = `desert-kingdom-${CACHE_VERSION}`;

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/sw.js',
  '/lands.html',
  '/config/images.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await Promise.allSettled(
        STATIC_ASSETS.map(async (url) => {
          try { await cache.add(url); }
          catch (e) { console.warn('[SW] skip', url, e.message); }
        })
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    ).then(() => self.clients.claim())
  );
});

function isStaticAsset(pathname) {
  return /\.(css|js|png|jpg|jpeg|gif|svg|ico|woff2?|ttf|eot|json)$/.test(pathname);
}

function isHTML(pathname) {
  return pathname.endsWith('.html') || pathname === '/';
}

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

async function fontHandler(req) {
  try {
    const cache = await caches.open('fonts-v1');
    const hit = await cache.match(req);
    if (hit) return hit;
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch (e) {
    return new Response('', { status: 200, headers: { 'Content-Type': 'text/css' } });
  }
}

const OFFLINE_HTML = `<html dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ملك الصحراء</title><style>body{background:#FFF8F0;display:flex;align-items:center;justify-content:center;height:100vh;font-family:Cairo,sans-serif;direction:rtl;text-align:center;padding:20px}div{max-width:400px}h2{color:#C0392B;font-size:1.5rem}p{color:#7D6B5A;font-size:1rem;line-height:1.6}button{background:#C0392B;color:#fff;border:0;padding:12px 24px;border-radius:12px;font-size:1rem;font-weight:700;cursor:pointer;margin-top:16px}</style></head><body><div><h2>🚫 لا يوجد اتصال</h2><p>عذراً، اللعبة تحتاج اتصال بالإنترنت للعب. حاول مرة أخرى لاحقاً.</p><button onclick="window.location.reload()">إعادة المحاولة</button></div></body></html>`;

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/ws/')) {
    return;
  }

  if (url.pathname === '/version' || url.pathname === '/health') {
    event.respondWith(fetch(event.request));
    return;
  }

  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(fontHandler(event.request));
    return;
  }

  if (isStaticAsset(url.pathname)) {
    event.respondWith(staleWhileRevalidate(event.request));
    return;
  }

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

  event.respondWith(networkFirst(event.request));
});
