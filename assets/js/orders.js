/* ═══════════════════════════════════════════════════
   STARSHOP — orders.js
   صفحه «وضعیت سفارش‌ها» برای کاربران ثبت‌نام‌شده:
   • سفارش‌های همان کاربر (تطبیق شماره موبایل حساب + کد سفارش‌های این دستگاه)
   • ادغام سفارش‌های محلی (سبد/تلگرام/بله) با دیتابیس زنده textdb (کارت به کارت)
   • تایم‌لاین مرحله‌به‌مرحله: ثبت → فیش/بررسی هوش مصنوعی → تأیید پشتیبانی → تحویل
   • پایش زنده هر ۱۵ ثانیه + جستجوی سفارش با کد (برای خرید از دستگاه دیگر)
   ═══════════════════════════════════════════════════ */
(() => {
'use strict';

const $ = s => document.querySelector(s);
const CFG = window.SS_CONFIG || {};
const C2C = CFG.card2card || {};
const STORE = C2C.store || '';

/* ── ابزار ── */
const FA = '۰۱۲۳۴۵۶۷۸۹';
const toFa = n => String(n).replace(/\d/g, d => FA[d]);
const money = n => n == null ? '—' : toFa(Number(n).toLocaleString('en-US')).replace(/,/g, '٬');
const escapeHtml = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const jsonRead = (k, fb) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? fb : v; } catch (e) { return fb; } };

/* ── تقویم جلالی (الگوریتم استاندارد jdf — هماهنگ با card2card.js) ── */
const pInt = Math.trunc;
function g2j(gy, gm, gd) {
  const gdm = [0,31,59,90,120,151,181,212,243,273,304,334];
  let jy = gy <= 1600 ? 0 : 979;
  gy -= gy <= 1600 ? 621 : 1600;
  const gy2 = gm > 2 ? gy + 1 : gy;
  let days = 365*gy + pInt((gy2+3)/4) - pInt((gy2+99)/100) + pInt((gy2+399)/400) - 80 + gd + gdm[gm-1];
  jy += 33 * pInt(days/12053); days %= 12053;
  jy += 4 * pInt(days/1461); days %= 1461;
  if (days > 365) { jy += pInt((days-1)/365); days = (days-1) % 365; }
  const jm = days < 186 ? 1 + pInt(days/31) : 7 + pInt((days-186)/30);
  const jd = 1 + (days < 186 ? days % 31 : (days-186) % 30);
  return [jy, jm, jd];
}
const jDate = ts => {
  if (!ts) return '—';
  const d = new Date(ts);
  const j = g2j(d.getFullYear(), d.getMonth() + 1, d.getDate());
  return toFa(j[0] + '/' + String(j[1]).padStart(2, '0') + '/' + String(j[2]).padStart(2, '0'));
};
const jTime = ts => {
  if (!ts) return '';
  const d = new Date(ts);
  return toFa(String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'));
};

/* ── toast ── */
let toastT = null;
const toast = m => {
  const el = $('#toast'); if (!el) return;
  el.textContent = m; el.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), 2800);
};
if (window.SSAuth && window.SSAuth.setToast) window.SSAuth.setToast(toast);

/* ── وضعیت‌ها ── */
const ST = {
  new:      { label: 'ثبت‌شده — در انتظار پرداخت',        ic: '🧾', pulse: false },
  sent:     { label: 'ارسال‌شده به پشتیبانی',              ic: '📨', pulse: false },
  pending:  { label: 'در انتظار تأیید فیش',                ic: '⏳', pulse: true  },
  review:   { label: 'در بررسی دستی پشتیبانی',             ic: '🔎', pulse: false },
  approved: { label: 'تأیید شد — در حال آماده‌سازی',       ic: '✅', pulse: false },
  delivered:{ label: 'تحویل داده شد',                      ic: '📦', pulse: false },
  rejected: { label: 'رد شد',                              ic: '❌', pulse: false }
};
const CH = { c2c: 'کارت به کارت', tg: 'تلگرام', bale: 'بله' };

/* ── حساب کاربر ── */
const session = () => window.SSAuth ? window.SSAuth.session() : null;
const uidOf = s => s ? String(s.phone || '').toLowerCase() : null;
const uidKey = uid => 'ss_orders:u:' + String(uid).replace(/[^a-z0-9_@.\-]/gi, '_');

/* ── جمع‌آوری سفارش‌های محلی ── */
function localCodesAndOrders() {
  const s = session(), uid = uidOf(s);
  const own = uid ? jsonRead(uidKey(uid), []) : [];
  const guest = jsonRead('ss_orders', []);
  const out = new Map();
  for (const o of own.concat(guest)) {
    if (!o || !o.code || out.has(o.code)) continue;
    out.set(o.code, o);
  }
  /* اسنپ‌شات‌های کارت به کارت (مبلغ/اقلام کامل) */
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || !k.startsWith('ss_c2c_order_')) continue;
    const snap = jsonRead(k, null);
    if (!snap || !snap.code || out.has(snap.code)) continue;
    out.set(snap.code, { code: snap.code, channel: 'c2c', ts: snap.createdAt, items: snap.items || [] });
  }
  return out;
}

const isMine = (rec, codes, uid) =>
  (uid && rec.phone && String(rec.phone).trim().toLowerCase() === uid) ||
  (rec.code && codes.has(rec.code));

/* ── ساخت لیست یکپارچه سفارش‌ها ── */
async function buildOrders(focusCode) {
  const s = session(), uid = uidOf(s);
  const locals = localCodesAndOrders();
  const merged = new Map();

  /* ۱) محلی */
  for (const o of locals.values()) {
    merged.set(o.code, {
      code: o.code,
      channel: o.channel || 'c2c',
      ts: o.ts || Date.now(),
      items: (o.items || []).map(i => ({ title: i.title, qty: i.qty })),
      totalToman: null, totalRial: null,
      status: (o.channel === 'tg' || o.channel === 'bale') ? 'sent' : 'new',
      reason: null, name: null, phone: null, ai: null, updatedAt: 0, mine: true
    });
  }
  /* تکمیل با اسنپ‌شات c2c (مبلغ و خریدار) + آخرین وضعیت ذخیره‌شده صفحه پرداخت */
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || !k.startsWith('ss_c2c_order_')) continue;
    const snap = jsonRead(k, null);
    if (!snap || !snap.code) continue;
    const ex = merged.get(snap.code);
    if (!ex) continue;
    if (snap.totalToman) ex.totalToman = snap.totalToman;
    if (snap.totalRial) ex.totalRial = snap.totalRial;
    if (snap.name) ex.name = snap.name;
    if (snap.phone) ex.phone = snap.phone;
    if (snap.items && snap.items.length) ex.items = snap.items.map(i => ({ title: i.title, qty: i.qty }));
    if (snap.createdAt) ex.ts = snap.createdAt;
    /* اگر دیتابیس زنده این سفارش را ندارد (پرuned شده)، آخرین وضعیت کش‌شده معتبر است */
    if (ex.status === 'new') {
      const cached = (() => { try { return localStorage.getItem('ss_c2c_status_' + snap.code); } catch (e) { return null; } })();
      if (cached && ST[cached]) ex.status = cached;
    }
  }

  /* ۲) دیتابیس زنده (فیش کارت به کارت) */
  if (STORE) {
    try {
      const r = await fetch(STORE + '?_=' + Date.now(), { cache: 'no-store' });
      const j = JSON.parse(await r.text());
      for (const rec of (Array.isArray(j.orders) ? j.orders : [])) {
        const mine = isMine(rec, locals, uid);
        if (!mine && rec.code !== focusCode) continue;
        const ex = merged.get(rec.code) || {
          code: rec.code, channel: rec.channel || 'c2c', ts: rec.createdAt || rec.updatedAt || Date.now(),
          items: [], totalToman: null, totalRial: null, status: 'pending',
          reason: null, name: null, phone: null, ai: null, updatedAt: 0, mine: false
        };
        ex.mine = ex.mine || mine;
        ex.status = rec.status || ex.status;
        ex.reason = rec.reason != null ? rec.reason : ex.reason;
        if (rec.name) ex.name = rec.name;
        if (rec.phone) ex.phone = rec.phone;
        if (rec.totalToman != null) ex.totalToman = rec.totalToman;
        if (rec.totalRial != null) ex.totalRial = rec.totalRial;
        if (rec.items && rec.items.length) ex.items = rec.items.map(i => ({ title: i.title, qty: i.qty }));
        if (rec.createdAt) ex.ts = rec.createdAt;
        ex.updatedAt = rec.updatedAt || 0;
        ex.ai = rec.ai || ex.ai;
        merged.set(rec.code, ex);
      }
    } catch (e) { /* آفلاین: همان محلی رندر می‌شود */ }
  }

  const arr = Array.from(merged.values());
  arr.sort((a, b) => (b.updatedAt || b.ts || 0) - (a.updatedAt || a.ts || 0));
  return arr;
}

/* ── تایم‌لاین کارت به کارت ── */
function timelineHTML(st, channel) {
  if (channel === 'tg' || channel === 'bale') return '';
  const done2 = ['pending','review','approved','delivered','rejected'].includes(st);
  const done3 = ['approved','delivered'].includes(st);
  const cur3 = ['pending','review'].includes(st);
  const done4 = st === 'delivered';
  const cur4 = st === 'approved';
  const steps = [
    { n: '۱', t: 'ثبت سفارش', cls: 'done' },
    { n: '۲', t: 'فیش و بررسی هوش مصنوعی', cls: done2 ? 'done' : (st === 'new' ? 'cur' : '') },
    { n: '۳', t: 'تأیید پشتیبانی', cls: done3 ? 'done' : (cur3 ? 'cur' : (st === 'rejected' ? '' : '')) },
    { n: '۴', t: 'تحویل سفارش', cls: done4 ? 'done' : (cur4 ? 'cur' : '') }
  ];
  const seg = i => {
    if (i === steps.length - 1) return '';
    const linked = steps[i].cls === 'done' && steps[i + 1].cls === 'done';
    return `<div class="tl-line${linked ? ' done' : ''}"></div>`;
  };
  return `<div class="ord-tl">` + steps.map((s, i) =>
    `<div class="tl-st ${s.cls}"><div class="tl-ic">${s.cls === 'done' ? '✓' : s.n}</div><span>${s.t}</span></div>` + seg(i)
  ).join('') + `</div>`;
}

/* ── رندر یک کارت ── */
function cardHTML(o, focused) {
  const st = ST[o.status] ? o.status : 'pending';
  const meta = ST[st];
  const items = (o.items || []).map(i =>
    `<li><span>${escapeHtml(i.title)}</span><b>×${toFa(i.qty || 1)}</b></li>`
  ).join('') || '<li><span>—</span></li>';
  const amt = o.totalToman != null
    ? `<span>💰 <b>${money(o.totalToman)} تومان</b>${o.totalRial != null ? ` <span style="opacity:.7">(${money(o.totalRial)} ریال)</span>` : ''}</span>`
    : '';
  const who = (o.name || o.phone)
    ? `<span>👤 <b>${escapeHtml(o.name || '—')}</b>${o.phone ? ` — <b dir="ltr">${escapeHtml(o.phone)}</b>` : ''}</span>`
    : '';
  const dt = `<span>📅 <b>${jDate(o.ts)}</b>${o.updatedAt ? ` <span style="opacity:.7">ساعت ${jTime(o.updatedAt || o.ts)}</span>` : ''}</span>`;

  let extra = '';
  if (st === 'rejected') {
    extra = `<div class="ord-reason">دلیل رد: ${escapeHtml(o.reason || 'فیش تأیید نشد')} — می‌توانید فیش درست را دوباره آپلود کنید.<a href="card2card.html">آپلود فیش جدید</a></div>`;
  } else if (st === 'approved') {
    extra = `<div class="ord-okbox">پرداخت شما تأیید شد و سفارش در حال آماده‌سازی است — نتیجه از طریق پشتیبانی به شما اعلام می‌شود.</div>`;
  } else if (st === 'delivered') {
    extra = `<div class="ord-okbox"><b>این سفارش تحویل داده شد ✓</b> از اعتماد شما سپاسگزاریم.</div>`;
  } else if (st === 'sent') {
    extra = `<div class="ord-note">این سفارش از طریق ${CH[o.channel] || 'پیام‌رسان'} ثبت شده؛ جزئیات و پیگیری در همان گفتگو انجام می‌شود. برای پیگیری دقیق‌تر با پشتیبانی در تماس باشید.</div>`;
  } else if (st === 'new') {
    extra = `<div class="ord-note">سفارش ثبت شده اما هنوز فیش پرداختی دریافت نشده — برای پرداخت و آپلود فیش به <a href="card2card.html?order=${encodeURIComponent(o.code)}" style="color:var(--brand);font-weight:800">صفحه پرداخت کارت به کارت</a> بروید.</div>`;
  } else if (st === 'pending' || st === 'review') {
    extra = `<div class="ord-note">فیش شما دریافت شده و در صف بررسی پشتیبانی است؛ به‌محض تأیید، وضعیت همین‌جا تغییر می‌کند.</div>`;
  }

  return `<article class="ord-card${focused ? ' focus-code' : ''}" id="oc-${escapeHtml(o.code)}">
    <div class="ord-card-head">
      <span class="ord-code" dir="ltr">${escapeHtml(o.code)}</span>
      <span class="ord-ch">${CH[o.channel] || 'سفارش'}</span>
      ${o.mine ? '' : '<span class="ord-ch">نتیجه جستجو</span>'}
      <span class="push"></span>
      <span class="ord-badge ${st}"><span class="dot${meta.pulse ? ' pulse' : ''}"></span>${meta.ic} ${meta.label}</span>
    </div>
    <div class="ord-meta">${dt}${amt}${who}</div>
    <ul class="ord-items">${items}</ul>
    ${timelineHTML(st, o.channel)}
    ${extra}
  </article>`;
}

/* ── رندر کلی ── */
let ORDERS = [];
let focusCode = '';

function render() {
  const list = $('#list');
  const result = $('#lookupResult');
  const s = session();
  /* نتایج جستجو برای کاربر واردنشده، در پنل جستجو رندر می‌شود */
  if (result) {
    const found = !s ? ORDERS.filter(o => o.code === focusCode) : [];
    result.innerHTML = found.map(o => cardHTML(o, true)).join('');
  }
  const n = ORDERS.length;
  const active = ORDERS.filter(o => ['new','sent','pending','review'].includes(o.status)).length;
  const ok = ORDERS.filter(o => ['approved','delivered'].includes(o.status)).length;
  const rej = ORDERS.filter(o => o.status === 'rejected').length;
  $('#stats').innerHTML =
    `<span class="chip">کل: <b>${toFa(n)}</b></span>` +
    `<span class="chip">در جریان: <b>${toFa(active)}</b></span>` +
    `<span class="chip">تأیید/تحویل: <b>${toFa(ok)}</b></span>` +
    `<span class="chip">ردشده: <b>${toFa(rej)}</b></span>`;
  if (!s) { list.innerHTML = ''; return; }
  if (!n) {
    list.innerHTML = `<div class="ord-empty">
      <div class="e-ic">🛍</div>
      <b>هنوز سفارشی ثبت نکرده‌اید</b>
      <p>پس از اولین خرید، سفارش و وضعیتش همین‌جا نمایش داده می‌شود.<br>اگر قبلاً با دستگاه دیگری خرید کرده‌اید، کد سفارش را در کادر جستجو وارد کنید.</p>
    </div>`;
    return;
  }
  list.innerHTML = ORDERS.map(o => cardHTML(o, o.code === focusCode)).join('');
}

async function refresh(silent) {
  const next = await buildOrders(focusCode);
  const changed = JSON.stringify(next.map(o => [o.code, o.status, o.reason])) !== JSON.stringify(ORDERS.map(o => [o.code, o.status, o.reason]));
  ORDERS = next;
  render();
  $('#lastCheck').textContent = 'آخرین بررسی وضعیت: ' + jDate(Date.now()) + ' — ساعت ' + jTime(Date.now());
  if (changed && !silent && ORDERS.length) { /* بدون اسپم؛ فقط بازرندر */ }
  return changed;
}

/* ── گیت ورود ── */
function renderGate() {
  const s = session();
  $('#gate').hidden = !!s;
  $('#app').hidden = !s;
  if (s && !ORDERS.length) refresh(true);
}

/* ── مودال ورود ── */
const openAuth = () => { if (window.SSAuth) window.SSAuth.open(); };
document.addEventListener('click', e => {
  const cm = e.target.closest('[data-close-modal]');
  if (cm) { window.SSUI.closeModal(cm.closest('.modal')); return; }
});
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  const m = document.querySelector('.modal:not([hidden])');
  if (m) window.SSUI.closeModal(m);
});

/* ── رویدادها ── */
$('#btnGateLogin').addEventListener('click', openAuth);
$('#btnRefresh').addEventListener('click', () => { refresh(false); toast('به‌روزرسانی شد'); });
$('#btnLookup').addEventListener('click', async () => {
  const v = String($('#lookupInput').value || '').trim().toUpperCase();
  if (!v) { toast('کد سفارش را وارد کنید'); return; }
  focusCode = v;
  await refresh(true);
  if (!ORDERS.some(o => o.code === v)) { toast('سفارشی با کد ' + v + ' پیدا نشد'); focusCode = ''; render(); return; }
  toast('سفارش پیدا شد ✓');
  const el = document.getElementById('oc-' + v);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
});
$('#lookupInput').addEventListener('keydown', e => { if (e.key === 'Enter') $('#btnLookup').click(); });
$('#lookupInput').addEventListener('input', e => { e.target.value = e.target.value.replace(/\s+/g, ''); });

/* ورود/خروج → گیت + لیست تازه + پاک‌کردن نتیجه جستجو */
document.addEventListener('ss:auth', () => { ORDERS = []; focusCode = ''; const lr = $('#lookupResult'); if (lr) lr.innerHTML = ''; renderGate(); if (session()) refresh(true); });

/* ── پایش زنده ── */
let pollT = null;
function startPoll() {
  if (pollT || !STORE) return;
  pollT = setInterval(() => { if (session() || focusCode) refresh(true); }, 15000);
}

/* ── شروع ── */
renderGate();
render();
startPoll();
})();
