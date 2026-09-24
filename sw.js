/* ═══════════════════════════════════════════════════
   STARSHOP — sw.js  (Service Worker)
   مقاوم‌سازی برای ترافیک بالا:
   • استاتیک (css/js/img/font با ?v= نسخه‌دار) → کش اول = سرعت پرش‌ظرفیت + کم‌فشار روی سرور
   • ناوبری (index.html) → شبکه اول، فال‌بک کش = سایت آفلاین هم بالا می‌آید
   • APIهای زنده (تلگرام/نرخ‌ها/گوگل) → هرگز کش نمی‌شوند
   نسخه کش باید با ?v= سایت هماهنگ بماند.
   ═══════════════════════════════════════════════════ */
'use strict';

const VER = '20260940';
const CACHE = 'starshop-' + VER;

/* میزبان‌هایی که هرگز نباید کش شوند (داده زنده) */
const NEVER = [
  /(^|\.)telegram\.org$/i, /(^|\.)jina\.ai$/i, /(^|\.)codetabs\.com$/i,
  /(^|\.)allorigins\.win$/i, /(^|\.)tgju\.org$/i, /(^|\.)er-api\.com$/i,
  /(^|\.)gold-api\.com$/i, /(^|\.)google\.com$/i, /(^|\.)textdb\.dev$/i,
  /(^|\.)projectnaptha\.com$/i, /(^|\.)tesseract\.projectnaptha\.com$/i
];
/* CDNهای خارجی قابل‌کش (پاسخ opaque هم کش می‌شود) */
const CACHABLE_CDN = /(^|\.)jsdelivr\.net$/i;

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    try {
      const c = await caches.open(CACHE);
      await c.addAll(['./']); /* پوسته سایت برای فال‌بک آفلاین */
    } catch (err) { /* نصب نباید شکست بخورد */ }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (req.headers.has('range')) return;

  let url;
  try { url = new URL(req.url); } catch (err) { return; }
  if (NEVER.some(re => re.test(url.hostname))) return; /* مستقیم به شبکه */

  /* ── ناوبری صفحات: شبکه اول، فال‌بک کش ── */
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        try {
          const c = await caches.open(CACHE);
          c.put('./', fresh.clone());
        } catch (err) {}
        return fresh;
      } catch (err) {
        try {
          const c = await caches.open(CACHE);
          return (await c.match('./')) || (await c.match(req)) || Response.error();
        } catch (err2) { return Response.error(); }
      }
    })());
    return;
  }

  /* ── استاتیک: کش اول (URLها نسخه‌دار هستند) + پرکردن کش در پس‌زمینه ── */
  e.respondWith((async () => {
    try {
      const c = await caches.open(CACHE);
      const hit = await c.match(req);
      if (hit) return hit;
      const fresh = await fetch(req);
      const cacheable = (fresh && fresh.ok) || (fresh && fresh.type === 'opaque');
      if (cacheable && (url.origin === self.location.origin || CACHABLE_CDN.test(url.hostname))) {
        try { c.put(req, fresh.clone()); } catch (err) {}
      }
      return fresh;
    } catch (err) {
      try {
        const c = await caches.open(CACHE);
        const hit2 = await c.match(req);
        if (hit2) return hit2;
      } catch (err2) {}
      return Response.error();
    }
  })());
});
