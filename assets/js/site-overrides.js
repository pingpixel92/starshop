/* ═══════════════════════════════════════════════════
   STARSHOP — site-overrides.js
   ⚠️ این فایل توسط پنل مدیریت (admin.html) تولید می‌شود.
   تنظیمات دلخواه مدیر را روی SS_CONFIG و SS_DATA «روی‌نویسی» می‌کند
   بدون اینکه فایل‌های اصلی دست بخورند (الگوی امن مثل دیتابیس وردپرس).
   بخش JSON بین دو نشانگر START/END توسط پنل به‌روزرسانی می‌شود؛
   موتور ادغام پایین دستکاری نکنید.
   ═══════════════════════════════════════════════════ */
window.SS_OVERRIDES = /* SS_OVERRIDES_JSON_START */{}/* SS_OVERRIDES_JSON_END */;

;(() => {
'use strict';
const O = window.SS_OVERRIDES || {};
if (!O || typeof O !== 'object') return;

/* ادغام عمیق: آبجکت‌ها ترکیب، آرایه‌ها و مقادیر ساده جایگزین */
const deep = (t, s) => {
  for (const k in s) {
    if (!Object.prototype.hasOwnProperty.call(s, k)) continue;
    const v = s[k];
    if (v && typeof v === 'object' && !Array.isArray(v) && t[k] && typeof t[k] === 'object' && !Array.isArray(t[k])) deep(t[k], v);
    else t[k] = v;
  }
  return t;
};

/* ۱) ادغام تنظیمات (محصولات، قیمت‌ها، تماس، درگاه‌ها…) */
if (O.config && window.SS_CONFIG) deep(window.SS_CONFIG, O.config);

/* ۲) ادغام متن‌های سه‌زبانه (fa/en/ar) */
if (O.data && window.SS_DATA) {
  for (const lang in O.data) {
    if (window.SS_DATA[lang]) deep(window.SS_DATA[lang], O.data[lang]);
    else window.SS_DATA[lang] = O.data[lang];
  }
}

/* ۳) افزونه‌ها — پنهان‌کردن سکشن‌های سایت (سکشن‌ها در index.html استاتیک‌اند) */
window.SS_FLAGS = O.flags || {};
const hide = (O.flags && O.flags.hideSections) || [];
const kill = id => {
  const el = document.getElementById(id);
  if (el) { el.style.display = 'none'; el.setAttribute('data-flag-hidden', '1'); }
  document.querySelectorAll('a[href="#' + id + '"]').forEach(a => {
    const box = a.closest('li') || a.closest('div') || a;
    box.style.display = 'none';
  });
};
if (hide.length) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => hide.forEach(kill));
  else hide.forEach(kill);
}
})();
