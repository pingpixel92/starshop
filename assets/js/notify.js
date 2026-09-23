/* ═══════════════════════════════════════════════════
   STARSHOP — notify.js
   اطلاع‌رسانی خودکار سفارش‌ها به چت تلگرام مالک:
   هر بار کاربر سبد خرید را با تلگرام/بله نهایی کند یا فرم سفارش
   را ثبت کند، متن کامل سفارش (اقلام، نام، شماره، تاریخ) به‌صورت
   خودکار به ربات مالک ارسال می‌شود — حتی اگر کاربر پیام را
   خودش نفرستد، سفارش از دست نمی‌رود.
   تنظیمات: config.js → orderNotify (برای خاموش‌کردن enabled:false)
   ═══════════════════════════════════════════════════ */
(() => {
'use strict';

const CFG = () => {
  const C = window.SS_CONFIG || {};
  /* orderNotify اختصاصی؛ اگر نبود از visitorLog ارث ببرد */
  const o = C.orderNotify || {};
  const v = C.visitorLog || {};
  return {
    enabled: o.enabled !== false && v.enabled !== false,
    bot: o.bot || v.bot || '',
    chat: o.chat || v.chat || ''
  };
};

/* ── ارسال به تلگرام (no-cors = بدون پیش‌درآمد و بدون خطای CORS) ── */
const send = text => {
  const c = CFG();
  if (!c.enabled || !c.bot || !c.chat) return;
  try {
    const body = new URLSearchParams({
      chat_id: c.chat,
      text: String(text).slice(0, 3800),
      disable_web_page_preview: 'true'
    });
    fetch('https://api.telegram.org/bot' + c.bot + '/sendMessage',
      { method: 'POST', body, keepalive: true, mode: 'no-cors' }).catch(() => {});
  } catch (e) { /* هرگز UI را نشکند */ }
};

/* ── ضد اسپم: همان متن در بازه ۶۰ ثانیه دوباره نفرست (دابل‌کلیک/تغییر کانال) ── */
const K_LAST = 'ss_order_ntf';
let lastHash = '', lastTs = 0;
try {
  lastHash = sessionStorage.getItem(K_LAST + ':h') || '';
  lastTs = +sessionStorage.getItem(K_LAST + ':t') || 0;
} catch (e) {}

const TAGS = {
  cart_tg:   '🛒 <b>سفارش از سبد خرید — پرداخت تلگرام</b>',
  cart_bale: '🛒 <b>سفارش از سبد خرید — پرداخت بله</b>',
  form:      '📝 <b>درخواست جدید از فرم سفارش</b>'
};

/* public API: channel ∈ cart_tg | cart_bale | form */
const order = (text, channel) => {
  try {
    const tag = TAGS[channel] || '🛒 سفارش جدید — استارشاپ';
    const full = tag + '\n' + String(text || '');
    /* هش سبک برای ددوپ */
    let h = 0;
    for (let i = 0; i < full.length; i++) { h = (h * 31 + full.charCodeAt(i)) | 0; }
    h = String(h);
    if (h === lastHash && Date.now() - lastTs < 60000) return;
    lastHash = h;
    lastTs = Date.now();
    try { sessionStorage.setItem(K_LAST + ':h', h); sessionStorage.setItem(K_LAST + ':t', String(lastTs)); } catch (e) {}
    send(full);
  } catch (e) { /* هرگز UI را نشکند */ }
};

window.SSNotify = { order, send };
})();
