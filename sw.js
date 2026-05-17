/* GoldMark Service Worker
 * Strategy:
 *   - index.html / admin.html  → Network-first (ได้ update เสมอ), cache เป็น fallback
 *   - CDN assets (React, fonts) → Cache-first (URL มี version อยู่แล้ว)
 *   - Supabase / HSH API       → Network-only (ไม่ cache ข้อมูลสด)
 */

const CACHE = 'goldmark-v1';

const CDN_PREFIXES = [
  'https://fonts.googleapis.com',
  'https://fonts.gstatic.com',
  'https://unpkg.com',
  'https://cdn.jsdelivr.net',
];

const SKIP_CACHE_HOSTS = [
  'supabase.co',
  'huasengheng.com',
];

/* ── Install: precache หน้าหลัก ── */
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(['/', '/index.html']))
  );
  self.skipWaiting();
});

/* ── Activate: ลบ cache เวอร์ชันเก่า ── */
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

/* ── Fetch ── */
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);

  /* API calls: ส่งต่อ network ตรงๆ ไม่แตะ cache */
  if (SKIP_CACHE_HOSTS.some(h => url.hostname.includes(h))) return;

  /* CDN assets: Cache-first (เร็ว, ไม่ต้องโหลดซ้ำทุกครั้ง) */
  if (CDN_PREFIXES.some(p => e.request.url.startsWith(p))) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(res => {
          if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()));
          return res;
        });
      })
    );
    return;
  }

  /* หน้า HTML / assets ของเรา: Network-first → ได้ update ทุกครั้ง */
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        return res;
      })
      .catch(() => caches.match(e.request))  /* offline fallback */
  );
});
