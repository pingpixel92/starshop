/* ═══════════════════════════════════════════════════
   STARSHOP — img-guard.js
   مقاوم‌سازی تصاویر روی اینترنت ناپایدار (ایران ↔ Fastly):
   ۱) هر تصویری که خطا داد → ۲ بار تلاش مجدد با کش‌باستر
   ۲) بعد → میرور jsDelivr (مسیر شبکه‌ای کاملاً متفاوت از گیت‌هاب)
   ۳) آخرش → کاشی گرادیانی تمیز به‌جای آیکون «عکس خراب»
   بدون وابستگی؛ error در فاز capture → تصاویر داینامیک هم پوشش داده می‌شوند
   ═══════════════════════════════════════════════════ */
(() => {
'use strict';

const MIRROR = 'https://cdn.jsdelivr.net/gh/pingpixel92/starshop@main/';
const MAX = 3; /* ۰ و ۱: تلاش مجدد مبدا، ۲: میرور jsDelivr، ۳: فال‌بک نهایی */
const tries = new WeakMap();

function dead(img) {
  if (img.classList.contains('img-dead')) return;
  img.classList.add('img-dead');
  img.removeAttribute('srcset');
  img.removeAttribute('src');
}

function attempt(img, step) {
  const clean = (img.dataset.origSrc || '').split('?')[0].replace(/^\//, '');
  if (!clean) { dead(img); return; }
  if (step < 2) {
    /* تلاش مجدد از همان مبدا — روی شبکه پرلاست اغلب بار دوم/سوم جواب می‌دهد */
    setTimeout(() => { img.src = clean + '?retry=' + step; }, 400 * (step + 1));
  } else if (step === 2) {
    /* میرور: همان فایل از ریپو گیت‌هاب از طریق jsDelivr */
    img.src = MIRROR + clean;
  } else {
    dead(img);
  }
}

function arm(img) {
  const s = img.getAttribute('src');
  if (!s || s.startsWith('data:') || s.startsWith('blob:')) return false;
  if (img.dataset.origSrc) return true; /* قبلاً مسلح شده */
  img.dataset.origSrc = s;
  return true;
}

function fail(e) {
  const img = e.target;
  if (!(img instanceof HTMLImageElement)) return;
  if (!arm(img)) return;
  const n = tries.get(img) || 0;
  if (n >= MAX) { dead(img); return; }
  tries.set(img, n + 1);
  attempt(img, n);
}

/* اسکرین: تصاویری که قبل از نصب گارد خراب شده بودند */
function sweep() {
  document.querySelectorAll('img').forEach(img => {
    if (img.classList.contains('img-dead')) return;
    if (img.dataset.origSrc) {
      /* مسلح است ولی هنوز کامل نشده و src فعلی ندارد → دوباره تلاش کن */
      if (img.complete && img.naturalWidth === 0 && !img.getAttribute('src')) attempt(img, tries.get(img) || 0);
      return;
    }
    if (img.complete && img.naturalWidth === 0 && arm(img)) {
      tries.set(img, 1);
      attempt(img, 0);
    }
  });
}

document.addEventListener('error', fail, true);
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => setTimeout(sweep, 300));
} else {
  setTimeout(sweep, 300);
}
window.addEventListener('load', () => setTimeout(sweep, 1500));
})();
