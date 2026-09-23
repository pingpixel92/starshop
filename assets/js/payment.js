/* ═══════════════════════════════════════════════════
   STARSHOP — payment.js
   صفحه بازگشت از درگاه زیبال (payment.html?trackId=…):
   ۱) وریفای تراکنش با API زیبال (منبع حقیقت وضعیت پرداخت)
   ۲) نمایش رسید خرید سه‌زبانه
   ۳) اطلاع‌رسانی خودکار «خرید قطعی» به تلگرام مالک
   ۴) خالی‌کردن سبد و پاک‌کردن سفارش در انتظار
   ═══════════════════════════════════════════════════ */
(() => {
'use strict';

const $  = (s, c) => (c || document).querySelector(s);
const $$ = (s, c) => Array.from((c || document).querySelectorAll(s));

const t = k => (window.SSI18N ? window.SSI18N.t(k) : k);
const D = () => (window.SS_DATA && (window.SS_DATA[window.SS_LANG || 'fa'] || window.SS_DATA.fa)) || { meta: { numLocale: 'fa-IR' } };
const numFmt = n => { try { return Number(n).toLocaleString(D().meta.numLocale || 'fa-IR', { maximumFractionDigits: 0 }); } catch (e) { return String(n); } };
const dig = s => {
  const l = window.SS_LANG || 'fa';
  const map = l === 'fa' ? '۰۱۲۳۴۵۶۷۸۹' : l === 'ar' ? '٠١٢٣٤٥٦٧٨٩' : null;
  return map ? String(s == null ? '' : s).replace(/\d/g, d => map[d]) : String(s == null ? '' : s);
};
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const Z_API = 'https://gateway.zibal.ir/v1';
const merchant = () => (window.SS_CONFIG && window.SS_CONFIG.zibal && window.SS_CONFIG.zibal.merchant) || 'zibal';
const K_PENDING = 'ss_pending_order';

let result = null; /* آخرین نتیجه برای رندر مجدد هنگام تغییر زبان */

const readPending = () => { try { const v = JSON.parse(localStorage.getItem(K_PENDING)); return (v && typeof v === 'object') ? v : null; } catch (e) { return null; } };
const dropPending = () => { try { localStorage.removeItem(K_PENDING); } catch (e) {} };

/* ── ۱) وریفای تراکنش ── */
const verify = async trackId => {
  const res = await fetch(Z_API + '/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ merchant: merchant(), trackId: Number(trackId) || trackId })
  });
  return await res.json();
};

/* ── ۳) اطلاع‌رسانی خرید قطعی به تلگرام مالک (متن فارسی ثابت) ── */
const notifyOwner = (j, order) => {
  try {
    const trackId = String(j.trackId || '');
    const K = 'ss_ntf_paid_' + trackId;
    try { if (localStorage.getItem(K)) return; } catch (e) {}
    const toman = Math.round((+j.amount || (order ? order.amountRial : 0)) / 10);
    const L = [];
    L.push('— — — — —');
    L.push('💰 مبلغ پرداخت‌شده: ' + toman.toLocaleString('en-US') + ' تومان');
    L.push('🧾 کد سفارش: ' + (order && order.code ? order.code : (j.orderId || '—')));
    L.push('🆔 تراکنش زیبال: ' + (trackId || '—'));
    if (j.refNumber) L.push('🔎 کد پیگیری بانک: ' + j.refNumber);
    if (j.cardNumber) L.push('💳 کارت پرداخت‌کننده: ' + j.cardNumber);
    if (j.paidAt) L.push('🏦 زمان پرداخت: ' + j.paidAt);
    L.push('🔗 سایت: ' + location.origin + '/');
    const base = (order && order.text) ? order.text + '\n' : '⚠️ جزئیات اقلام سفارش در مرورگر خریدار یافت نشد (سفارش از دستگاه دیگری ثبت شده؟)\n';
    if (order && order.user && order.user.phone) L.push('👤 خریدار لاگین‌شده: ' + (order.user.name || 'بدون نام') + ' — ' + order.user.phone);
    if (window.SSNotify) window.SSNotify.order(base + L.join('\n'), 'paid_zibal');
    try { localStorage.setItem(K, '1'); } catch (e) {}
  } catch (e) { /* هرگز UI را نشکند */ }
};

/* ── رندر ── */
const row = (label, valueHtml) => `<div class="pz-row"><span>${esc(label)}</span><b>${valueHtml}</b></div>`;

const viewOk = j => {
  const order = j.__order || null;
  const toman = Math.round((+j.amount || (order ? order.amountRial : 0)) / 10);
  const items = order && Array.isArray(order.items) ? order.items : [];
  const itemsHtml = items.length ? `
    <div class="pz-sec"><h4>${esc(t('pz.items'))}</h4>
      <ul class="pz-items">${items.map(i => `<li><span>${esc(i.title)}</span><b>×${esc(dig(i.qty))}</b></li>`).join('')}</ul>
    </div>` : '';
  const tg = (window.SS_CONFIG && window.SS_CONFIG.telegram && window.SS_CONFIG.telegram.url) || '#';
  /* در وریفای دوباره (201) گاهی amount نمی‌آید — کادر مبلغ فقط وقتی نشان بده که مقدار هست */
  const amountBox = toman > 0 ? `<div class="pz-amount"><span>${esc(t('pz.amount'))}</span><b>${numFmt(toman)} ${esc(t('rates.toman'))}</b></div>` : '';
  return `
    <div class="pz-state">
      <div class="pz-badge ok"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg></div>
      <h1>${esc(t('pz.ok.title'))}</h1>
      <p>${esc(t('pz.ok.sub'))}</p>
    </div>
    ${amountBox}
    <div class="pz-rows">
      ${order && order.code ? row(t('pz.code'), esc(dig(order.code))) : ''}
      ${j.trackId ? row(t('pz.track'), esc(dig(j.trackId))) : ''}
      ${j.refNumber ? row(t('pz.ref'), esc(dig(j.refNumber))) : ''}
      ${j.cardNumber ? row(t('pz.card'), `<bdi dir="ltr">${esc(j.cardNumber)}</bdi>`) : ''}
      ${j.paidAt ? row(t('pz.date'), esc(dig(String(j.paidAt).split('.')[0].replace('T', ' · ')))) : ''}
    </div>
    ${itemsHtml}
    <div class="pz-actions">
      <a class="primary" href="./">${esc(t('pz.back'))}</a>
      <a class="ghost" href="${esc(tg)}" target="_blank" rel="noopener">${esc(t('pz.contact'))}</a>
    </div>`;
};

const viewFail = (j, kind) => {
  const kTitle = kind === 'net' ? 'pz.net.title' : kind === 'none' ? 'pz.none.title' : 'pz.fail.title';
  const kSub   = kind === 'net' ? 'pz.net.sub'   : kind === 'none' ? 'pz.none.sub'   : 'pz.fail.sub';
  const order = j && j.__order ? j.__order : readPending();
  let st = '';
  if (j && kind !== 'net' && kind !== 'none') {
    const s = +j.status || 0;
    const key = s === 3 ? 'pz.st.cancel' : (s === 1 || s === 2) ? 'pz.st.notpaid' : 'pz.st.err';
    if (s !== 0) st = `<p class="pz-st">${esc(t(key))}</p>`;
  }
  const icon = kind === 'none' ? 'info' : 'bad';
  const paths = {
    bad:  '<circle cx="12" cy="12" r="9.2"/><path d="M15 9l-6 6M9 9l6 6"/>',
    info: '<circle cx="12" cy="12" r="9.2"/><path d="M12 8h.01M11 12h1v4h1"/>'
  };
  const retryHtml = (kind !== 'none' && kind !== 'net' && j && j.trackId)
    ? `<button type="button" class="ghost" data-pz-retry>${esc(t('pz.retry'))}</button>` : '';
  const tg = (window.SS_CONFIG && window.SS_CONFIG.telegram && window.SS_CONFIG.telegram.url) || '#';
  return `
    <div class="pz-state">
      <div class="pz-badge ${icon}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[icon]}</svg></div>
      <h1>${esc(t(kTitle))}</h1>
      <p>${esc(t(kSub))}</p>
      ${st}
    </div>
    ${order && order.code ? `<div class="pz-rows">${row(t('pz.code'), esc(dig(order.code)))}${j && j.trackId ? row(t('pz.track'), esc(dig(j.trackId))) : ''}</div>` : ''}
    <div class="pz-actions">
      <a class="primary" href="./">${esc(t('pz.back'))}</a>
      ${retryHtml || `<a class="ghost" href="${esc(tg)}" target="_blank" rel="noopener">${esc(t('pz.contact'))}</a>`}
    </div>`;
};

const paint = () => {
  const body = $('#pzBody'); if (!body || !result) return;
  body.innerHTML = result.kind === 'ok' ? viewOk(result.j) : viewFail(result.j, result.kind);
  const r = $('[data-pz-retry]', body);
  if (r) r.addEventListener('click', run);
};

/* ── ۲) جریان اصلی: خواندن trackId از URL → وریفای → نمایش ──
   نکته زیبال: پاسخ verify معمولاً trackId ندارد (خودمان فرستادیم) → از URL برمی‌داریم؛
   result=201 همراه پیام «previously verifed» یعنی قبلاً وریفای موفق → موفق حساب می‌شود */
const isVerifed = j => !!j && (j.result === 100 || (j.result === 201 && /previo|verif/i.test(String(j.message || ''))));
const run = async () => {
  const body = $('#pzBody'), spin = $('#pzSpin');
  if (!body) return;
  const qs = new URLSearchParams(location.search);
  const trackId = qs.get('trackId');
  if (!trackId) { if (spin) spin.hidden = true; result = { kind: 'none', j: null }; paint(); return; }
  if (spin) spin.hidden = false;
  body.innerHTML = '';
  let j = null;
  try { j = await verify(trackId); } catch (e) { j = null; }
  if (spin) spin.hidden = true;
  if (isVerifed(j)) {
    j.trackId = j.trackId || trackId;
    const order = readPending();
    j.__order = order;
    result = { kind: 'ok', j };
    /* نوتیف فقط بار اول — اگر pending نبود یعنی رفرش صفحه است و قبلاً اطلاع داده شده */
    if (order) notifyOwner(j, order);
    if (order) {
      try { if (window.SSCart) window.SSCart.clear(); } catch (e) {}
      dropPending();
    }
    paint();
  } else if (j) {
    j.trackId = j.trackId || trackId;
    const s = +j.status || 0;
    result = { kind: (s === 3) ? 'cancel' : 'err', j };
    paint();
  } else {
    result = { kind: 'net', j: null };
    paint();
  }
};

/* ── زبان ── */
$$('[data-pz-lang]').forEach(b => b.addEventListener('click', () => {
  if (window.SSI18N) window.SSI18N.setLang(b.dataset.pzLang);
}));
document.addEventListener('ss:lang', () => {
  $$('[data-pz-lang]').forEach(b => b.classList.toggle('on', b.dataset.pzLang === (window.SS_LANG || 'fa')));
  paint();
});

/* ── شروع ── */
$$('[data-pz-lang]').forEach(b => b.classList.toggle('on', b.dataset.pzLang === (window.SS_LANG || 'fa')));
run();
})();
