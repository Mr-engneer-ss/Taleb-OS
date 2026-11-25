/* STUDENT OS — Service Worker
 * - تخزين مسبق لكل ملفات التطبيق (Precache) بمسارات نسبية، فيعمل داخل أي مسار فرعي (GitHub Pages).
 * - استراتيجية: الملفات المخزنة أولًا (Cache First) داخل نسخة مرقّمة؛ لا خلط بين ملفات قديمة وجديدة.
 * - التحديث الآمن: عند تغيّر أي ملف يتغيّر VERSION (يولَّده scripts/build-sw.mjs) فتُنزَّل نسخة جديدة بكاملها
 *   في ذاكرة مستقلة، ولا تُفعَّل إلا بعد موافقة المستخدم (رسالة SKIP_WAITING).
 * لا تعدّل الأسطر بين العلامتين يدويًا: شغّل  node scripts/build-sw.mjs  بعد أي تعديل على الملفات.
 */

/*VERSION_START*/const VERSION = 'bd25282d1e21';/*VERSION_END*/
/*PRECACHE_START*/const PRECACHE = [
  "./",
  "assets/icons/apple-touch-icon.png",
  "assets/icons/favicon-32.png",
  "assets/icons/icon-192.png",
  "assets/icons/icon-512.png",
  "assets/icons/icon-maskable-192.png",
  "assets/icons/icon-maskable-512.png",
  "assets/icons/icon.svg",
  "css/components.css",
  "css/responsive.css",
  "css/style.css",
  "index.html",
  "js/ai/client.js",
  "js/ai/prompts.js",
  "js/ai/providers.js",
  "js/app.js",
  "js/assistant.js",
  "js/boot.js",
  "js/config.js",
  "js/curriculum.js",
  "js/dashboard.js",
  "js/focus.js",
  "js/lib/charts.js",
  "js/lib/dates.js",
  "js/lib/db.js",
  "js/lib/html.js",
  "js/lib/icons.js",
  "js/lib/markdown.js",
  "js/lib/mathexpr.js",
  "js/lib/metrics.js",
  "js/lib/pwa.js",
  "js/lib/schema.js",
  "js/lib/subjects.js",
  "js/lib/theme.js",
  "js/lib/timer.js",
  "js/lib/toolkit.js",
  "js/lib/ui.js",
  "js/library.js",
  "js/more.js",
  "js/planner.js",
  "js/router.js",
  "js/settings.js",
  "js/storage.js",
  "js/toolbox.js",
  "js/tools/calculator.js",
  "js/tools/code-lab.js",
  "js/tools/json-tool.js",
  "js/tools/password-tool.js",
  "js/tools/text-counter.js",
  "js/tools/text-tools.js",
  "js/tools/unit-converter.js",
  "manifest.json",
  "offline.html",
];/*PRECACHE_END*/

const CACHE_PREFIX = 'studentos-';
const CACHE_NAME = `${CACHE_PREFIX}${VERSION}`;
const scopeUrl = (p) => new URL(p, self.registration.scope).href;

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // addAll ذرّي: إن فشل ملف واحد يفشل التثبيت كله ويبقى الإصدار القديم يعمل
    await cache.addAll(PRECACHE.map((p) => new Request(scopeUrl(p), { cache: 'reload' })));
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith(CACHE_PREFIX) && k !== CACHE_NAME).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // لا نعترض طلبات خارجية (مثل خدمة المساعد)

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);

    if (req.mode === 'navigate') {
      const page = await cache.match(scopeUrl('index.html'));
      if (page) return page;
      try { return await fetch(req); } catch { /* تابع للاحتياطي */ }
      return (await cache.match(scopeUrl('offline.html'))) || Response.error();
    }

    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try {
      const res = await fetch(req);
      return res;
    } catch {
      if (req.destination === 'document') return (await cache.match(scopeUrl('offline.html'))) || Response.error();
      return Response.error();
    }
  })());
});
