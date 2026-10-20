/* ═══════════════════════════════════════════════════
   STARSHOP — visitor-log.js
   ثبت بازدیدکننده‌ها برای مالک فروشگاه:
   هر بازدید یک پیام فشرده به چت تلگرام مالک می‌فرستد:
   شناسه دستگاه، شماره بازدید، دستگاه/مرورگر، زبان/منطقه،
   منبع ورود (referrer/UTM)، صفحه ورود، و اگر لاگین باشد شماره تلفن.
   + شمارنده کل سایت: هر ورود (با همان فاصله زمانی) در textdb +۱ می‌شود
   و عدد کل در همان پیام تلگرام می‌آید (👥 کل بازدیدکننده‌ها).
   محدودسازی: حداقل فاصله minGapMs بین دو پیام از هر دستگاه
   تنظیمات: config.js → visitorLog (enabled/bot/chat/minGapMs/store)
   ═══════════════════════════════════════════════════ */
(() => {
'use strict';

const CFG = () => (window.SS_CONFIG && window.SS_CONFIG.visitorLog) || {};
if (!CFG().enabled) return;

const K_VID = 'ss_vid', K_CNT = 'ss_visits', K_SENT = 'ss_vlog_ts', K_LOGIN = 'ss_vlog_login';

/* ── شناسه پایدار بازدیدکننده (بدون کوکی، محلی) ── */
const uuid = () => {
  let hex = '';
  try {
    const b = new Uint8Array(8);
    crypto.getRandomValues(b);
    b.forEach(x => { hex += x.toString(16).padStart(2, '0'); });
  } catch (e) {
    for (let i = 0; i < 16; i++) hex += Math.floor(Math.random() * 16).toString(16);
  }
  return 'v' + hex;
};
let vid = 'anon', visits = 1;
try {
  vid = localStorage.getItem(K_VID) || (localStorage.setItem(K_VID, uuid()), localStorage.getItem(K_VID)) || uuid();
  visits = (+localStorage.getItem(K_CNT) || 0) + 1;
  localStorage.setItem(K_CNT, String(visits));
} catch (e) { /* حالت خصوصی مرورگر */ }

/* ── جمع‌آوری اطلاعات (بدون PII اضافه) ── */
const deviceInfo = () => {
  const ua = navigator.userAgent || '';
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
  const os = /Android/i.test(ua) ? 'Android'
    : /iPhone|iPad|iPod/i.test(ua) ? 'iOS'
    : /Windows/i.test(ua) ? 'Windows'
    : /Mac OS/i.test(ua) ? 'Mac'
    : /Linux/i.test(ua) ? 'Linux' : '?';
  const br = /Edg\//.test(ua) ? 'Edge'
    : /OPR\//.test(ua) ? 'Opera'
    : /SamsungBrowser/.test(ua) ? 'Samsung Internet'
    : /Firefox\//.test(ua) ? 'Firefox'
    : /Chrome\//.test(ua) ? 'Chrome'
    : /Safari\//.test(ua) ? 'Safari' : 'Other';
  return (mobile ? '📱 ' : '💻 ') + os + ' · ' + br;
};
const refSource = () => {
  try {
    if (!document.referrer) return 'مستقیم / Direct';
    return new URL(document.referrer).hostname || 'مستقیم / Direct';
  } catch (e) { return 'مستقیم / Direct'; }
};
const utmTags = () => {
  try {
    const p = new URLSearchParams(location.search);
    const hits = ['utm_source', 'utm_medium', 'utm_campaign', 'ref'].map(k => p.get(k)).filter(Boolean);
    return hits.join(' / ');
  } catch (e) { return ''; }
};
const stamp = () => {
  const d = new Date(), pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/* ── ارسال به تلگرام (no-cors = بدون پیش‌درآمد و بدون خطای CORS) ── */
const send = text => {
  const c = CFG();
  if (!c.bot || !c.chat) return;
  try {
    const body = new URLSearchParams({ chat_id: c.chat, text: String(text).slice(0, 3500) });
    fetch('https://api.telegram.org/bot' + c.bot + '/sendMessage',
      { method: 'POST', body, keepalive: true, mode: 'no-cors' }).catch(() => {});
  } catch (e) { /* هرگز UI را نشکند */ }
};
const userPhone = () => {
  try {
    const p = window.SSAuth && window.SSAuth.profile && window.SSAuth.profile();
    return (p && p.phone) ? p.phone : '';
  } catch (e) { return ''; }
};

const reportVisit = total => {
  const utm = utmTags();
  const phone = userPhone();
  const faDig = n => (window.SS_LANG === 'en') ? String(n) : String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
  const lines = [
    '🔔 بازدید جدید — استارشاپ',
    '🆔 ' + vid + ' · بازدید شماره ' + visits + (visits === 1 ? ' (اولین بار!)' : ''),
    total > 0 ? '👥 کل بازدیدکننده‌های سایت: ' + faDig(total) : '',
    deviceInfo(),
    '🌐 ' + (navigator.language || '?') + ' · ' + ((Intl.DateTimeFormat().resolvedOptions() || {}).timeZone || '?'),
    '🔗 ' + refSource() + (utm ? ' («' + utm + '»)' : ''),
    '📄 ' + location.pathname + location.search,
    phone ? '👤 کاربر لاگین: ' + phone : '',
    '🕐 ' + stamp()
  ].filter(Boolean);
  send(lines.join('\n'));
};

/* ── شمارنده کل سایت (textdb): خواندن، +۱، نوشتن — هرگز UI را نمی‌شکند ── */
const todayTehran = () => {
  const d = new Date(Date.now() + 12600000); /* UTC+3:30 */
  const pad = n => String(n).padStart(2, '0');
  return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
};
const bumpGlobal = async () => {
  const st = CFG().store;
  if (!st) return -1;
  try {
    const r = await fetch(st + '?_=' + Date.now(), { cache: 'no-store' });
    const doc = JSON.parse((await r.text()) || '{}');
    const t = todayTehran();
    const total = (+doc.total || 0) + 1;
    const body = JSON.stringify({
      total: total,
      today: t,
      todayCount: doc.today === t ? (+doc.todayCount || 0) + 1 : 1,
      updatedAt: Date.now()
    });
    await fetch(st, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body, keepalive: true });
    return total;
  } catch (e) { return -1; }
};

/* ── throttle: یک پیام به‌ازای هر ~۳۰ دقیقه از هر دستگاه ── */
const gap = (+CFG().minGapMs) || 1800000;
let last = 0;
try { last = +localStorage.getItem(K_SENT) || 0; } catch (e) {}
if (!last || Date.now() - last > gap) {
  try { localStorage.setItem(K_SENT, String(Date.now())); } catch (e) {}
  /* پخش تصادفی ورود — زیر ترافیک سنگین همه با هم فشار نمی‌آورند؛
     اول شمارنده کل سایت +۱، بعد پیام تلگرام با عدد جدید */
  setTimeout(() => {
    bumpGlobal().then(total => {
      try { reportVisit(total); } catch (e) {}
    }).catch(() => { try { reportVisit(-1); } catch (e) {} });
  }, 1200 + Math.floor(Math.random() * 2500));
}

/* ── ورود/ثبت‌نام کاربر (شماره واقعی = لید طلایی) — حداکثر روزی یک پیام ── */
document.addEventListener('ss:auth', () => {
  const phone = userPhone();
  if (!phone) return;
  let lastLogin = 0;
  try { lastLogin = +localStorage.getItem(K_LOGIN) || 0; } catch (e) {}
  if (Date.now() - lastLogin < 20 * 3600 * 1000) return;
  try { localStorage.setItem(K_LOGIN, String(Date.now())); } catch (e) {}
  send('👤 ورود کاربر — استارشاپ\n📱 ' + phone + '\n🆔 ' + vid + ' · بازدید ' + visits + '\n🕐 ' + stamp());
});
})();
