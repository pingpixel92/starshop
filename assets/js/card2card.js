/* ═══════════════════════════════════════════════════
   STARSHOP — card2card.js
   درگاه کارت به کارت + هوش مصنوعی بررسی اصالت فیش:
   ۱) OCR دو-زبانه (فارسی + انگلیسی) با Tesseract
   ۲) تطبیق مبلغ (تومان/ریال)، کارت مقصد، وضعیت موفقیت
   ۳) شماره پیگیری، تاریخ فیش، تشخیص فیش تکراری (دشت‌برد تصویر + شماره پیگیری)
   ۴) قبول → ثبت در دیتابیس سبک + ارسال خودکار عکس فیش به ربات تلگرام مالک
   ۵) پایش زنده وضعیت: تایید پشتیبانی → پیام سبز «سفارش در حال آماده‌سازی است»
   ═══════════════════════════════════════════════════ */
(() => {
'use strict';

const $ = s => document.querySelector(s);
const CFG = window.SS_CONFIG || {};
const C2C = CFG.card2card || {};
const TG  = CFG.orderNotify || {};
const STORE = C2C.store || '';
const CARD  = String(C2C.cardNumber || '6104331188928551').replace(/\D/g, '');
const HOLDER = C2C.holder || 'مجید احمدوند';
const BANK   = C2C.bank || 'بانک ملت';
const CARD_LAST4 = CARD.slice(-4);
const CARD_FIRST6 = CARD.slice(0, 6);

/* ── ابزارهای عمومی ── */
const FA = '۰۱۲۳۴۵۶۷۸۹', AR = '٠١٢٣٤٥٦٧٨٩';
const toFa = n => String(n).replace(/\d/g, d => FA[d]);
const norm = s => String(s || '')
  .replace(/[۰-۹]/g, d => FA.indexOf(d))
  .replace(/[٠-٩]/g, d => AR.indexOf(d))
  .replace(/ي/g, 'ی').replace(/ك/g, 'ک')
  .replace(/[\u200c\u200f\u200e]/g, ' ')
  .replace(/\s+/g, ' ');
const escapeHtml = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = n => toFa(Number(n).toLocaleString('en-US')).replace(/,/g, '٬');
const esc2 = escapeHtml;

let toastT = null;
const toast = m => {
  const el = $('#toast'); if (!el) return;
  el.textContent = m; el.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), 2800);
};

/* ── تقویم جلالی (الگوریتم استاندارد jdf) ── */
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
function j2g(jy, jm, jd) {
  let gy = jy <= 979 ? 621 : 1600;
  jy -= jy <= 979 ? 0 : 979;
  let days = 365*jy + pInt(jy/33)*8 + pInt((jy%33+3)/4) + 78 + jd + (jm < 7 ? (jm-1)*31 : (jm-7)*30 + 186);
  gy += 400 * pInt(days/146097); days %= 146097;
  if (days > 36524) { gy += 100 * pInt(--days/36524); days %= 36524; if (days >= 365) days++; }
  gy += 4 * pInt(days/1461); days %= 1461;
  if (days > 365) { gy += pInt((days-1)/365); days = (days-1) % 365; }
  let gd = days + 1;
  const leap = (gy%4 === 0 && gy%100 !== 0) || gy%400 === 0;
  const sal = [0,31,leap?29:28,31,30,31,30,31,31,30,31,30,31];
  let gm; for (gm = 0; gm < 13 && gd > sal[gm]; gm++) gd -= sal[gm];
  return [gy, gm, gd];
}
const utc = (y, m, d) => Date.UTC(y, m - 1, d);
function tehranNow() { try { return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tehran' })); } catch (e) { return new Date(); } }

/* ── دیتابیس سبک (textdb.dev) ── */
async function dbRead() {
  if (!STORE) return { orders: [] };
  try {
    const r = await fetch(STORE + '?_=' + Date.now(), { cache: 'no-store' });
    const txt = await r.text();
    const j = JSON.parse(txt);
    return { orders: Array.isArray(j.orders) ? j.orders : [] };
  } catch (e) { return { orders: [] }; }
}
async function dbWrite(orders) {
  await fetch(STORE, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ orders }) });
}
function pruneOrders(list) {
  const arr = list.slice(0, 30);
  for (let i = 8; i < arr.length; i++) if (arr[i] && arr[i].img) arr[i].img = null;
  return arr;
}

/* ── تلگرام ── */
async function tgSendPhoto(blob, caption, kb) {
  if (!TG.bot || !TG.chat || !blob) return false;
  try {
    const fd = new FormData();
    fd.append('chat_id', TG.chat);
    fd.append('photo', blob, 'receipt.jpg');
    fd.append('caption', caption.slice(0, 1000));
    fd.append('parse_mode', 'HTML');
    if (kb) fd.append('reply_markup', JSON.stringify(kb));
    const r = await fetch('https://api.telegram.org/bot' + TG.bot + '/sendPhoto', { method: 'POST', body: fd });
    if (r.ok) return true;
    throw new Error('cors/no-cors fallback');
  } catch (e) {
    try { /* فال‌بک no-cors: ارسال می‌شود ولی پاسخ خوانده نمی‌شود */
      const fd2 = new FormData();
      fd2.append('chat_id', TG.chat);
      fd2.append('photo', blob, 'receipt.jpg');
      fd2.append('caption', caption.slice(0, 1000));
      fd2.append('parse_mode', 'HTML');
      if (kb) fd2.append('reply_markup', JSON.stringify(kb));
      fetch('https://api.telegram.org/bot' + TG.bot + '/sendPhoto', { method: 'POST', body: fd2, mode: 'no-cors', keepalive: true }).catch(() => {});
      return true;
    } catch (e2) { return false; }
  }
}
async function tgSendText(text) {
  if (!TG.bot || !TG.chat) return;
  try {
    await fetch('https://api.telegram.org/bot' + TG.bot + '/sendMessage', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TG.chat, text: String(text).slice(0, 3800), disable_web_page_preview: true })
    });
  } catch (e) {
    try { fetch('https://api.telegram.org/bot' + TG.bot + '/sendMessage', { method: 'POST', mode: 'no-cors', keepalive: true, body: new URLSearchParams({ chat_id: TG.chat, text: String(text).slice(0, 3800) }) }).catch(() => {}); } catch (e2) {}
  }
}

/* ── وضعیت سفارش ── */
const qs = new URLSearchParams(location.search);
let ORDER = null;
const code0 = qs.get('order');
if (code0) { try { ORDER = JSON.parse(localStorage.getItem('ss_c2c_order_' + code0) || 'null'); } catch (e) {} }
const CODE = (ORDER && ORDER.code) || ('C2C-' + Date.now().toString(36).toUpperCase().slice(-5) + Math.floor(Math.random() * 36).toString(36).toUpperCase());

/* حالت دستی: سفارش سبد پیدا نشد → کاربر مبلغ را دستی وارد می‌کند */
let manualTotal = 0;
if (!ORDER) $('#manualBox').hidden = false;

/* ── رندر خلاصه سفارش ── */
function renderOrder() {
  const box = $('#orderBody');
  if (ORDER) {
    const items = (ORDER.items || []).map(i =>
      `<div class="o-row"><span>${esc2(i.title)}${i.qty > 1 ? ' ×' + toFa(i.qty) : ''}</span></div>`
    ).join('');
    box.innerHTML = items +
      `<div class="o-row"><span>کد سفارش</span><b dir="ltr">${esc2(CODE)}</b></div>` +
      (ORDER.name || ORDER.phone ? `<div class="o-row"><span>خریدار</span><b>${esc2(ORDER.name || '')} ${ORDER.phone ? '— ' + toFa(ORDER.phone) : ''}</b></div>` : '') +
      `<div class="o-total"><span>مبلغ قابل پرداخت: <b>${money(ORDER.totalToman)} تومان</b></span><span class="rial">معادل ${money(ORDER.totalRial)} ریال</span></div>`;
  } else {
    box.innerHTML = `<div class="o-row"><span>کد سفارش (خودکار)</span><b dir="ltr">${esc2(CODE)}</b></div>
      <p style="font-size:13px;color:var(--muted);margin:8px 0 0">سفارش سبد خرید روی این دستگاه پیدا نشد — مبلغ واریزی را دستی وارد کنید و فیش را آپلود کنید.</p>`;
  }
}

/* ── کپی‌ها ── */
const copyText = async (txt, label) => {
  try { await navigator.clipboard.writeText(txt); toast(label + ' کپی شد ✓'); }
  catch (e) {
    try {
      const ta = document.createElement('textarea');
      ta.value = txt; ta.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); ta.remove(); toast(label + ' کپی شد ✓');
    } catch (e2) { toast('کپی ممکن نشد؛ دستی کپی کنید'); }
  }
};
document.addEventListener('click', e => {
  const b = e.target.closest('[data-copy]'); if (!b) return;
  const kind = b.dataset.copy;
  if (kind === 'card') copyText(CARD, 'شماره کارت');
  else if (kind === 'holder') copyText(HOLDER, 'نام صاحب کارت');
  else if (kind === 'amount') copyText(String(currentTotalToman()), 'مبلغ (تومان)');
});
const currentTotalToman = () => ORDER ? ORDER.totalToman : manualTotal;

/* ── آپلود تصویر ── */
const drop = $('#drop'), fileIn = $('#file');
let lastFile = null, lastBigDataUrl = null, lastBlob = null, lastSmallBase64 = null, lastHash = '', lastW = 0, lastH = 0;
drop.addEventListener('click', () => fileIn.click());
drop.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') fileIn.click(); });
['dragover', 'dragenter'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
drop.addEventListener('drop', e => { const f = e.dataTransfer.files && e.dataTransfer.files[0]; if (f) acceptFile(f); });
fileIn.addEventListener('change', () => { if (fileIn.files && fileIn.files[0]) acceptFile(fileIn.files[0]); });
window.addEventListener('paste', e => {
  const its = (e.clipboardData || {}).items || [];
  for (const it of its) if (it.type && it.type.startsWith('image/')) { const f = it.getAsFile(); if (f) { acceptFile(f); e.preventDefault(); } break; }
});

async function acceptFile(file) {
  if (!file.type || !file.type.startsWith('image/')) { toast('فقط فایل تصویری (JPG/PNG) قبول است'); return; }
  if (file.size > 15 * 1024 * 1024) { toast('حجم تصویر زیاد است (حداکثر ۱۵MB)'); return; }
  lastFile = file;
  try {
    const img = await loadBitmap(file);
    lastW = img.width || img.naturalWidth; lastH = img.height || img.naturalHeight;
    const mk = (maxW, q, type) => new Promise(res => {
      const sc = Math.min(1, maxW / lastW);
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(lastW * sc)); c.height = Math.max(1, Math.round(lastH * sc));
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      if (type === 'url') res(c.toDataURL('image/jpeg', 0.9));
      else c.toBlob(b => res(b), 'image/jpeg', q);
    });
    lastBigDataUrl = await mk(1400, 0, 'url');
    lastBlob = await mk(1100, 0.82);
    /* نسخه سبک برای ذخیره در دیتابیس (پنل ادمین) */
    const smallDataUrl = await new Promise(res => {
      const sc = Math.min(1, 820 / lastW);
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(lastW * sc)); c.height = Math.max(1, Math.round(lastH * sc));
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      res(c.toDataURL('image/jpeg', 0.68));
    });
    lastSmallBase64 = smallDataUrl;
    lastHash = dhash(img);
    $('#pvImg').src = lastBigDataUrl;
    $('#pvMeta').textContent = `${toFa(lastW)}×${toFa(lastH)} — ${(file.size / 1024).toFixed(0)} کیلوبایت`;
    $('#preview').style.display = 'block';
    $('#btnCheck').disabled = false;
    $('#aiResult').style.display = 'none';
    toast('فیش آماده است؛ دکمه بررسی هوش مصنوعی را بزنید');
  } catch (e) {
    toast('خواندن تصویر ممکن نشد؛ فایل دیگری امتحان کنید');
  }
}
async function loadBitmap(file) {
  if (window.createImageBitmap) { try { return await createImageBitmap(file); } catch (e) {} }
  return new Promise((res, rej) => {
    const u = URL.createObjectURL(file);
    const im = new Image();
    im.onload = () => { res(im); };
    im.onerror = rej;
    im.src = u;
  });
}
function dhash(img) {
  const c = document.createElement('canvas'); c.width = 9; c.height = 8;
  const x = c.getContext('2d'); x.drawImage(img, 0, 0, 9, 8);
  let d; try { d = x.getImageData(0, 0, 9, 8).data; } catch (e) { return '0'; }
  const g = [];
  for (let i = 0; i < 72; i++) g.push(0.299 * d[i*4] + 0.587 * d[i*4+1] + 0.114 * d[i*4+2]);
  let bits = 0n, k = 0;
  for (let y = 0; y < 8; y++) for (let xx = 0; xx < 8; xx++) { if (g[y*9+xx] > g[y*9+xx+1]) bits |= (1n << BigInt(k)); k++; }
  return bits.toString(16).padStart(16, '0');
}
function hamming(a, b) {
  if (!a || !b || a.length !== 16 || b.length !== 16) return 99;
  let n = 0;
  for (let i = 0; i < 16; i++) { let x = parseInt(a[i], 16) ^ parseInt(b[i], 16); while (x) { n += x & 1; x >>= 1; } }
  return n;
}

/* ── مراحل رابط ── */
const steps = ['#st1', '#st2', '#st3', '#st4'];
const prog = (i, pct) => {
  steps.forEach((s, ix) => {
    const el = $(s); el.classList.toggle('done', ix < i); el.classList.toggle('on', ix === i);
  });
  $('#aiBar').style.width = Math.round(pct) + '%';
};
const progShow = v => { $('#aiProg').style.display = v ? 'block' : 'none'; if (v) { $('#aiBar').style.width = '0%'; steps.forEach(s => $(s).classList.remove('on', 'done')); } };

/* ── استخراج اعداد ── */
function extractNums(t) {
  const merged = t.replace(/\d[\d\s_\-.,،]{5,}\d/g, m => m.replace(/[\s_\-.,،]/g, ''));
  const out = [];
  for (const m of merged.match(/\d{3,}/g) || []) {
    const n = parseInt(m, 10);
    if (!isFinite(n)) continue;
    const L = String(n).length;
    if (L === 16) continue;                     /* شماره کارت */
    if (L > 17) continue;                       /* شبا/شناسه‌های بلند */
    if (L === 11 && /^09/.test(m)) continue;    /* موبایل */
    if (n >= 1000) out.push(n);
  }
  return out;
}
function cardOk(t) {
  const flat = t.replace(/[^\d\*]/g, '');
  if (flat.includes(CARD)) return true;
  if (flat.includes(CARD_FIRST6) && flat.includes(CARD_LAST4)) return true;
  return false;
}
function findRef(t, nums, totalToman, totalRial) {
  let m = t.match(/(?:کد|شماره)\s*پیگیری\s*[:：]?\s*(\d{5,})/) ||
          t.match(/(?:شماره|کد)\s*مرجع\s*[:：]?\s*(\d{5,})/) ||
          t.match(/پیگیری\s*[:：]?\s*(\d{5,})/) ||
          t.match(/(?:tracking|reference|ref)\s*(?:code|no|number)?\s*[:#]?\s*(\d{5,})/i);
  if (m) return m[1];
  const c = nums.find(n => String(n).length >= 8 && String(n).length !== 16 && n !== totalToman && n !== totalRial);
  return c ? String(c) : null;
}
function dateCheck(t) {
  const now = tehranNow();
  const gNow = [now.getFullYear(), now.getMonth() + 1, now.getDate()];
  const diffs = [];
  for (const raw of t.match(/1[34]\d{2}\s*[\/\-.،]\s*\d{1,2}\s*[\/\-.،]\s*\d{1,2}/g) || []) {
    const p = raw.split(/\D+/).filter(Boolean).map(Number);
    if (p.length === 3 && p[1] >= 1 && p[1] <= 12 && p[2] >= 1 && p[2] <= 31) {
      try { const g = j2g(p[0], p[1], p[2]); diffs.push(Math.round((utc(g[0], g[1], g[2]) - utc(gNow[0], gNow[1], gNow[2])) / 86400000)); } catch (e) {}
    }
  }
  for (const raw of t.match(/20\d{2}\s*[\/\-.]\s*\d{1,2}\s*[\/\-.]\s*\d{1,2}/g) || []) {
    const p = raw.split(/\D+/).filter(Boolean).map(Number);
    if (p.length === 3 && p[1] >= 1 && p[1] <= 12 && p[2] >= 1 && p[2] <= 31) {
      diffs.push(Math.round((utc(p[0], p[1], p[2]) - utc(gNow[0], gNow[1], gNow[2])) / 86400000));
    }
  }
  if (!diffs.length) return { state: 'soft', msg: 'تاریخ در فیش دیده نشد (مانع قبول نیست)' };
  const ok = diffs.some(d => d >= -1 && d <= 3);
  if (ok) return { state: 'ok', msg: 'تاریخ فیش معتبر است' };
  return { state: 'bad', msg: 'تاریخ فیش قدیمی یا نامعتبر است' };
}

/* ── مغز هوش مصنوعی: بررسی اصالت فیش ── */
async function runAI() {
  if (!lastBigDataUrl) return;
  if (!ORDER && (!manualTotal || manualTotal < 5000)) { toast('ابتدا مبلغ واریزی (تومان) را در بخش مشخصات سفارش وارد کنید'); $('#mAmount').focus(); return; }
  const btn = $('#btnCheck'); btn.disabled = true;
  $('#aiResult').style.display = 'none';
  progShow(true);

  /* مرحله ۱: آماده‌سازی */
  prog(0, 8);
  await new Promise(r => setTimeout(r, 350));

  /* مرحله ۲: OCR */
  prog(1, 15);
  let text = '', ocrLang = 'fas+eng';
  try {
    if (!window.Tesseract) throw new Error('no-tesseract');
    try {
      const w = await Tesseract.createWorker(ocrLang, 1, {
        logger: m => { if (m.status === 'recognizing text') prog(1, 15 + (m.progress || 0) * 45); }
      });
      const r = await w.recognize(lastBigDataUrl);
      await w.terminate();
      text = (r && r.data && r.data.text) || '';
    } catch (e1) {
      ocrLang = 'eng';
      const w = await Tesseract.createWorker('eng', 1, {
        logger: m => { if (m.status === 'recognizing text') prog(1, 15 + (m.progress || 0) * 45); }
      });
      const r = await w.recognize(lastBigDataUrl);
      await w.terminate();
      text = (r && r.data && r.data.text) || '';
    }
  } catch (e) {
    progShow(false); btn.disabled = false;
    verdict(false, [{ k: 'OCR', state: 'bad', msg: 'موتور متن‌خوان بارگذاری نشد؛ اتصال اینترنت را چک کنید و دوباره امتحان کنید' }]);
    return;
  }
  const t = norm(text);

  /* مرحله ۳: استخراج */
  prog(2, 68);
  await new Promise(r => setTimeout(r, 300));
  const totalToman = currentTotalToman();
  const totalRial = totalToman * 10;
  const nums = extractNums(t);
  const ref = findRef(t, nums, totalToman, totalRial);

  /* مرحله ۴: قواعد اصالت */
  prog(3, 78);
  const db = await dbRead();
  const known = (db.orders || []).filter(o => o.code !== CODE);
  const seen = getSeen();
  const checks = [];

  /* ۱) مبلغ */
  const amtRial = nums.some(n => n === totalRial), amtToman = nums.some(n => n === totalToman);
  checks.push(amtRial || amtToman
    ? { k: 'مبلغ تراکنش', state: 'ok', msg: `مبلغ فیش دقیقاً مطابق سفارش است (${money(totalToman)} تومان)` }
    : { k: 'مبلغ تراکنش', state: 'bad', msg: `مبلغ ${money(totalToman)} تومان (${money(totalRial)} ریال) در فیش پیدا نشد — مبلغ واریزی با سفارش یکسان نیست` });

  /* ۲) کارت مقصد */
  checks.push(cardOk(t)
    ? { k: 'کارت مقصد', state: 'ok', msg: `واریز به کارت ${toFa(CARD.slice(0, 4))}…${toFa(CARD_LAST4)} (${HOLDER})` }
    : { k: 'کارت مقصد', state: 'bad', msg: 'کارت مقصد در فیش با کارت فروشنده یکسان نیست — فیش واریز به کارت دیگری است' });

  /* ۳) وضعیت تراکنش */
  const hasOk = /موفق|انجام\s*(?:شد|شده)|پرداخت\s*(?:شد|شده)|با\s*موفقیت|successful|success/i.test(t);
  const hasBad = /ناموفق|انصراف|لغو\s*(?:شد|شده)|رد\s*شد|اشکال|خطا|failed|error|declined/i.test(t);
  if (hasBad) checks.push({ k: 'وضعیت تراکنش', state: 'bad', msg: 'فیش نشان می‌دهد تراکنش موفق نبوده (ناموفق/لغو/خطا)' });
  else if (hasOk) checks.push({ k: 'وضعیت تراکنش', state: 'ok', msg: 'تراکنش با موفقیت انجام شده' });
  else if (ocrLang === 'eng') checks.push({ k: 'وضعیت تراکنش', state: 'soft', msg: 'متن فارسی فیش خوانده نشد؛ وضعیت در بررسی پشتیبانی چک می‌شود' });
  else checks.push({ k: 'وضعیت تراکنش', state: 'bad', msg: 'عبارت «موفق» در فیش دیده نشد — اسکرین‌شات صفحه نتیجه تراکنش را آپلود کنید' });

  /* ۴) شماره پیگیری */
  checks.push(ref && ref.length >= 5
    ? { k: 'شماره پیگیری/مرجع', state: 'ok', msg: 'یافت شد: ' + toFa(ref) }
    : { k: 'شماره پیگیری/مرجع', state: 'bad', msg: 'شماره پیگیری معتبری در فیش پیدا نشد' });

  /* ۵) تاریخ */
  const dc = dateCheck(t);
  checks.push({ k: 'تاریخ فیش', state: dc.state, msg: dc.msg });

  /* ۶) تکراری‌نبودن (ضد فیش تقلبی) */
  const refDup = ref && (known.some(o => o.ref === ref) || seen.refs.includes(ref));
  const hashDup = lastHash !== '0' && (known.some(o => o.imgHash && hamming(o.imgHash, lastHash) <= 6) || seen.hashes.some(h => hamming(h, lastHash) <= 6));
  checks.push(!refDup && !hashDup
    ? { k: 'اصالت (یکتا بودن)', state: 'ok', msg: 'این فیش قبلاً ثبت نشده و منحصربه‌فرد است' }
    : { k: 'اصالت (یکتا بودن)', state: 'bad', msg: refDup ? 'این شماره پیگیری قبلاً استفاده شده!' : 'این تصویر قبلاً آپلود شده! فیش واقعی و جدید آپلود کنید' });

  /* ۷) کیفیت تصویر */
  const qualityOk = lastW >= 420 && lastFile.size >= 18000;
  checks.push(qualityOk
    ? { k: 'کیفیت تصویر', state: 'ok', msg: 'تصویر واضح و قابل بررسی است' }
    : { k: 'کیفیت تصویر', state: 'bad', msg: 'تصویر خیلی کوچک/کم‌کیفیت است؛ اسکرین‌شات واضح‌تری از فیش بگیرید' });

  const hardBad = checks.some(c => c.state === 'bad');
  progShow(false);
  verdict(!hardBad, checks, { ref, hash: lastHash, ocrLang, totalToman, totalRial });
  btn.disabled = false;
}

function getSeen() {
  try { const v = JSON.parse(localStorage.getItem('ss_c2c_seen') || '{}'); return { refs: v.refs || [], hashes: v.hashes || [] }; }
  catch (e) { return { refs: [], hashes: [] }; }
}
function rememberSeen(ref, hash) {
  try {
    const s = getSeen();
    if (ref) { s.refs.unshift(ref); s.refs = s.refs.slice(0, 30); }
    if (hash && hash !== '0') { s.hashes.unshift(hash); s.hashes = s.hashes.slice(0, 30); }
    localStorage.setItem('ss_c2c_seen', JSON.stringify(s));
  } catch (e) {}
}

/* ── رندر نتیجه ── */
let lastPass = false, lastCtx = null, failCount = 0;
function verdict(pass, checks, ctx) {
  lastPass = pass; lastCtx = ctx;
  window.__lastChecks = checks;
  const box = $('#aiResult'); box.style.display = 'block';
  $('#chkList').innerHTML = checks.map(c => {
    const ic = c.state === 'ok' ? '✅' : c.state === 'bad' ? '❌' : '⚠️';
    return `<li class="${c.state}"><span class="ci">${ic}</span><span><b>${esc2(c.k)}:</b> ${esc2(c.msg)}</span></li>`;
  }).join('');
  const v = $('#verdict');
  v.className = 'c2c-verdict ' + (pass ? 'pass' : 'fail');
  v.innerHTML = pass
    ? '🎉 فیش شما تأیید شد! حالا برای ارسال به پشتیبانی، دکمه زیر را بزنید.'
    : '❌ فیش تأیید نشد — موارد قرمز بالا را اصلاح کنید و فیش درست را آپلود کنید.';
  $('#btnSubmit').style.display = pass ? 'inline-flex' : 'none';
  $('#btnManualReview').style.display = (!pass && failCount >= 1) ? 'inline-flex' : 'none';
  $('#btnRetry').style.display = pass ? 'none' : 'inline-flex';
  if (!pass) failCount++;
}

/* ── ثبت نهایی: دیتابیس + تلگرام ── */
async function submitReceipt(manualReview) {
  const pass = manualReview ? false : lastPass;
  const btn = manualReview ? $('#btnManualReview') : $('#btnSubmit');
  btn.disabled = true; btn.textContent = '⏳ در حال ارسال…';
  try {
    const totalToman = currentTotalToman();
    const totalRial = totalToman * 10;
    const name = ORDER ? (ORDER.name || '') : ($('#mName').value || '').trim();
    const phone = ORDER ? (ORDER.phone || '') : ($('#mPhone').value || '').trim();
    const desc = ORDER ? '' : ($('#mDesc').value || '').trim();
    const items = ORDER ? (ORDER.items || []).map(i => ({ title: i.title, qty: i.qty })) : [{ title: desc || 'سفارش کارت به کارت', qty: 1 }];
    if (!ORDER && (!manualTotal || manualTotal < 5000)) { toast('مبلغ واریزی را در بخش مشخصات سفارش وارد کنید'); btn.disabled = false; btn.textContent = '📤 ثبت و ارسال به پشتیبانی'; return; }

    const rec = {
      code: CODE, channel: 'c2c',
      createdAt: ORDER ? ORDER.createdAt : Date.now(),
      updatedAt: Date.now(),
      name, phone, desc,
      items, totalToman, totalRial,
      ref: (lastCtx && lastCtx.ref) || '',
      imgHash: (lastCtx && lastCtx.hash) || '',
      img: (lastSmallBase64 && lastSmallBase64.length <= 330000) ? lastSmallBase64 : null,
      ai: {
        pass,
        lang: (lastCtx && lastCtx.ocrLang) || '',
        checks: (window.__lastChecks || []).map(c => ({ k: c.k, state: c.state }))
      },
      status: manualReview ? 'review' : 'pending',
      reason: null
    };

    /* ثبت در دیتابیس سبک */
    if (STORE) {
      const db = await dbRead();
      const orders = Array.isArray(db.orders) ? db.orders : [];
      const ix = orders.findIndex(o => o.code === CODE);
      if (ix >= 0) orders[ix] = rec; else orders.unshift(rec);
      try { await dbWrite(pruneOrders(orders)); } catch (e) { toast('ثبت در دیتابیس ناموفق بود؛ دوباره تلاش کنید'); btn.disabled = false; btn.textContent = '📤 ثبت و ارسال به پشتیبانی'; return; }
    }

    /* ارسال خودکار فیش به ربات تلگرام مالک */
    const chk = (window.__lastChecks || []);
    const okIcons = chk.length ? chk.map(c => c.state === 'ok' ? '✅' : c.state === 'bad' ? '❌' : '⚠️').join(' ') : '';
    const cap =
      '💳 <b>فیش کارت به کارت — استار شاپ</b>\n' +
      'کد: <code>' + esc2(CODE) + '</code>\n' +
      'نام: ' + esc2(name || '—') + ' | موبایل: ' + esc2(phone || '—') + '\n' +
      '🧾 اقلام: ' + esc2(items.map(i => i.title + (i.qty > 1 ? '×' + i.qty : '')).join(' + ').slice(0, 160)) + '\n' +
      '💰 مبلغ: <b>' + money(totalToman) + ' تومان</b> (' + money(totalRial) + ' ریال)\n' +
      '🏦 مقصد: ' + esc2(BANK) + ' — کارت ' + toFa(CARD_LAST4) + ' به نام ' + esc2(HOLDER) + '\n' +
      '🤖 هوش مصنوعی: ' + (manualReview ? '⚠️ <b>نیازمند بررسی دستی</b>' : pass ? '✅ <b>تأیید خودکار</b>' : '—') + '\n' +
      (okIcons ? 'بررسی‌ها: ' + okIcons + '\n' : '') +
      (rec.ref ? 'شماره پیگیری: <code>' + esc2(rec.ref) + '</code>\n' : '') +
      '— — —\nتأیید: <code>/تایید ' + esc2(CODE) + '</code>\nرد: <code>/رد ' + esc2(CODE) + ' دلیل</code>';
    const kb = { inline_keyboard: [[{ text: '✅ بازکردن پنل تأیید', url: location.origin + '/admin.html#' + esc2(CODE) }]] };
    const sent = await tgSendPhoto(lastBlob, cap, kb);
    if (!sent) tgSendText(cap);

    rememberSeen(rec.ref, rec.imgHash);

    /* وضعیت: در انتظار تأیید */
    $('#statusPanel').hidden = false;
    renderStatus(rec.status, null);
    try { localStorage.setItem('ss_c2c_status_' + CODE, rec.status); } catch (e) {}
    startPoll();
    $('#aiResult').style.display = 'none';
    toast('فیش ارسال شد ✓ در انتظار تأیید پشتیبانی');
    $('#statusPanel').scrollIntoView({ behavior: 'smooth', block: 'center' });
  } catch (e) {
    toast('خطای غیرمنتظره در ارسال؛ دوباره تلاش کنید');
  }
  btn.disabled = false; btn.textContent = manualReview ? '🙋 ارسال برای بررسی دستی پشتیبانی' : '📤 ثبت و ارسال به پشتیبانی';
}

/* ── پایش زنده وضعیت ── */
let pollT = null;
function startPoll() {
  if (pollT) clearInterval(pollT);
  const tick = async () => {
    if (!STORE) return;
    try {
      const db = await dbRead();
      const rec = (db.orders || []).find(o => o.code === CODE);
      if (rec) {
        renderStatus(rec.status, rec.reason);
        try { localStorage.setItem('ss_c2c_status_' + CODE, rec.status); } catch (e) {}
        if (rec.status === 'approved' || rec.status === 'rejected') { clearInterval(pollT); pollT = null; }
      }
      $('#lastCheck').textContent = 'آخرین بررسی وضعیت: ' + new Date().toLocaleTimeString('fa-IR');
    } catch (e) {}
  };
  tick();
  pollT = setInterval(tick, 12000);
}
function renderStatus(status, reason) {
  $('#statusPanel').hidden = false;
  ['stPending', 'stReview', 'stApproved', 'stRejected'].forEach(id => $('#' + id).classList.remove('show'));
  if (status === 'approved') { $('#stApproved').classList.add('show'); $('#apCode').textContent = CODE; }
  else if (status === 'rejected') {
    $('#stRejected').classList.add('show');
    $('#rejReason').textContent = reason ? ('دلیل: ' + reason + ' — می‌توانید فیش درست را دوباره آپلود کنید.') : 'می‌توانید فیش درست را دوباره آپلود کنید.';
  } else if (status === 'review') { $('#stReview').classList.add('show'); }
  else { $('#stPending').classList.add('show'); }
}

/* ── رویدادها ── */
$('#btnCheck').addEventListener('click', runAI);
$('#btnSubmit').addEventListener('click', () => submitReceipt(false));
$('#btnManualReview').addEventListener('click', () => submitReceipt(true));
$('#btnRetry').addEventListener('click', () => { $('#aiResult').style.display = 'none'; fileIn.click(); });
$('#btnReUpload').addEventListener('click', () => { $('#aiResult').style.display = 'none'; fileIn.click(); });
$('#mAmount').addEventListener('input', e => {
  const v = norm(e.target.value).replace(/[^\d]/g, '');
  e.target.value = v;
  manualTotal = parseInt(v || '0', 10);
});

/* ── شروع ── */
renderOrder();
/* اگر سفارش قبلاً ثبت شده (بازگشت به صفحه) وضعیت را نشان بده */
(async () => {
  if (!STORE) return;
  try {
    const db = await dbRead();
    const rec = (db.orders || []).find(o => o.code === CODE);
    if (rec && rec.status) { renderStatus(rec.status, rec.reason); if (rec.status !== 'approved' && rec.status !== 'rejected') startPoll(); }
    else if (ORDER) { /* سفارش جدید: هنوز فیشی ثبت نشده */ }
  } catch (e) {}
})();
})();
