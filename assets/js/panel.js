/* ═══════════════════════════════════════════════════
   STARSHOP — panel.js
   کنترل پنل مدیریت فروشگاه:
   • داشبورد: کارت‌های آمار + نمودار (Chart.js) + آخرین سفارش‌ها
   • سفارش‌ها: جستجو/فیلتر + تأیید/رد با دلیل/تحویل/حذف (همگام با textdb و تلگرام)
   • مشتریان: استخراج از سفارش‌ها (تعداد خرید + مبلغ تحویل‌شده)
   • بایگانی فیش‌های ارسالی به ربات تلگرام (getFile زنده)
   • اتصال و تنظیمات: getMe، تأخیر دیتابیس، تغییر رمز، گوش‌دهی ربات
   رمز و نشست: مشترک با admin.html (ss_admin_hash / ss_admin_ok)
   ═══════════════════════════════════════════════════ */
(() => {
'use strict';

const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

/* ── ابزار ── */
const CFG = window.SS_CONFIG || {};
const C2C = CFG.card2card || {};
const TG = CFG.orderNotify || {};
const STORE = C2C.store || '';
const DEF_HASH = C2C.adminPasswordHash || '';
const PSTORE = 'https://textdb.dev/api/data/starshop-ph-7vq3nz52';

const FA = '۰۱۲۳۴۵۶۷۸۹';
const toFa = n => String(n).replace(/\d/g, d => FA[d]);
const money = n => toFa(Number(n || 0).toLocaleString('en-US')).replace(/,/g, '٬');
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const when = ts => { const d = new Date(ts || Date.now()); return toFa(d.toLocaleDateString('fa-IR')) + ' ' + toFa(d.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })); };
let toastT = null;
const toast = m => { const el = $('#toast'); el.textContent = m; el.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), 2600); };
async function sha256(txt) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(txt));
  return Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('');
}
const currentHash = () => localStorage.getItem('ss_admin_hash') || DEF_HASH;
const norm = s => String(s || '').replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/\s+/g, ' ').trim();

/* ── دیتابیس سفارش‌ها ── */
let lastOk = false;
async function dbRead() {
  if (!STORE) return { orders: [] };
  try {
    const r = await fetch(STORE + '?_=' + Date.now(), { cache: 'no-store' });
    const j = JSON.parse(await r.text());
    lastOk = true;
    return { orders: Array.isArray(j.orders) ? j.orders : [] };
  } catch (e) { lastOk = false; return { orders: [] }; }
}
async function dbWrite(orders) {
  const arr = orders.slice(0, 30);
  for (let i = 8; i < arr.length; i++) if (arr[i] && arr[i].img) arr[i].img = null;
  await fetch(STORE, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ orders: arr }) });
}
async function tgSendText(text) {
  if (!TG.bot || !TG.chat) return;
  try {
    await fetch('https://api.telegram.org/bot' + TG.bot + '/sendMessage', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TG.chat, text: String(text).slice(0, 3500) })
    });
  } catch (e) { /* بی‌صدا */ }
}

/* ── وضعیت‌ها ── */
const ST_FA = { pending: 'در انتظار تأیید', review: 'بررسی دستی', approved: 'تأیید شده ✓', delivered: 'تحویل شد 📦', rejected: 'رد شده ✗' };
const ST_CLS = { pending: 'pending', review: 'review', approved: 'approved', delivered: 'delivered', rejected: 'rejected' };
const ST_COLOR = { pending: '#e0a12f', review: '#4e8cff', approved: '#12ad63', delivered: '#7c5cff', rejected: '#e05252' };

/* ── گیت رمز ── */
async function tryLogin() {
  const v = $('#gPass').value;
  if (!v) return;
  const h = await sha256(v);
  if (h === currentHash()) {
    sessionStorage.setItem('ss_admin_ok', '1');
    $('#gate').style.display = 'none';
    boot();
  } else {
    $('#gErr').textContent = 'رمز اشتباه است!';
    $('#gPass').value = '';
  }
}
$('#gBtn').addEventListener('click', tryLogin);
$('#gPass').addEventListener('keydown', e => { if (e.key === 'Enter') tryLogin(); });
$('#btnPw').addEventListener('click', async () => {
  const np = prompt('رمز جدید پنل را وارد کنید (حداقل ۶ کاراکتر):');
  if (!np || np.length < 6) { if (np !== null) toast('رمز کوتاه است'); return; }
  localStorage.setItem('ss_admin_hash', await sha256(np));
  toast('رمز عوض شد ✓ (فقط روی این مرورگر)');
});
$('#btnLogout').addEventListener('click', () => {
  sessionStorage.removeItem('ss_admin_ok');
  location.reload();
});

/* ── مسیریابی ── */
const V_TITLES = { dash: 'داشبورد', orders: 'مدیریت سفارش‌ها', customers: 'مشتریان', photos: 'بایگانی فیش‌ها', settings: 'اتصال و تنظیمات' };
let VIEW = 'dash';
function show(v) {
  if (!V_TITLES[v]) v = 'dash';
  VIEW = v;
  $$('.view').forEach(el => el.classList.toggle('act', el.dataset.view === v));
  $$('.nav-it').forEach(el => el.classList.toggle('act', el.dataset.v === v));
  $('#vTitle').textContent = V_TITLES[v];
  history.replaceState(null, '', '#' + v);
  $('#side').classList.remove('open'); $('#backdrop').classList.remove('show');
  renderView();
}
function renderView() {
  if (VIEW === 'dash') renderDash();
  else if (VIEW === 'orders') renderOrders();
  else if (VIEW === 'customers') renderCustomers();
  else if (VIEW === 'photos') renderPhotos();
  else if (VIEW === 'settings') renderConn();
}
$('#nav').addEventListener('click', e => { const it = e.target.closest('.nav-it'); if (it) show(it.dataset.v); });
$('#burger').addEventListener('click', () => { $('#side').classList.toggle('open'); $('#backdrop').classList.toggle('show'); });
$('#backdrop').addEventListener('click', () => { $('#side').classList.remove('open'); $('#backdrop').classList.remove('show'); });

/* ── داده ── */
let ORDERS = [], PHOTOS = [];
let ordFilter = 'all', ordQuery = '';
let chBar = null, chDonut = null;

async function loadAll(silent) {
  const db = await dbRead();
  ORDERS = db.orders || [];
  try {
    const r = await fetch(PSTORE + '?_=' + Date.now(), { cache: 'no-store' });
    const j = JSON.parse(await r.text());
    PHOTOS = Array.isArray(j.photos) ? j.photos : [];
  } catch (e) { PHOTOS = []; }
  renderPendingBadge();
  renderView();
  $('#liveDot').classList.toggle('off', !lastOk);
  $('#liveTxt').textContent = lastOk ? 'آنلاین' : 'قطع اتصال دیتابیس';
}

function renderPendingBadge() {
  const n = ORDERS.filter(o => o.status === 'pending' || o.status === 'review').length;
  const b = $('#navPending');
  b.style.display = n ? '' : 'none';
  b.textContent = toFa(n);
  const p = $('#navPhotos');
  p.style.display = PHOTOS.length ? '' : 'none';
  p.textContent = toFa(PHOTOS.length);
}

/* ── داشبورد ── */
function sumStat(list, sts) { return list.filter(o => sts.includes(o.status)).reduce((s, o) => s + (Number(o.totalToman) || 0), 0); }
function renderDash() {
  const total = ORDERS.length;
  const pend = ORDERS.filter(o => o.status === 'pending' || o.status === 'review').length;
  const appr = ORDERS.filter(o => o.status === 'approved').length;
  const delv = ORDERS.filter(o => o.status === 'delivered').length;
  const rej = ORDERS.filter(o => o.status === 'rejected').length;
  const rev = sumStat(ORDERS, ['approved', 'delivered']);
  $('#statCards').innerHTML = [
    ['b', '🛍️', toFa(total), 'کل سفارش‌ها'],
    ['w', '⏳', toFa(pend), 'در انتظار بررسی'],
    ['g', '✅', toFa(appr), 'تأیید شده'],
    ['p', '📦', toFa(delv), 'تحویل شده'],
    ['r', '✗', toFa(rej), 'رد شده'],
    ['g', '💰', money(rev), 'درآمد تأییدشده (تومان)']
  ].map(([c, ic, n, l]) => `<div class="scard"><div class="ic ${c}">${ic}</div><div><div class="num">${n}</div><div class="lbl">${l}</div></div></div>`).join('');

  /* نمودار میله‌ای ۱۴ روز */
  if (window.Chart) {
    const days = [];
    for (let i = 13; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); days.push(d); }
    const labels = days.map(d => toFa(d.toLocaleDateString('fa-IR', { day: '2-digit', month: '2-digit' })));
    const counts = days.map(d => ORDERS.filter(o => { const od = new Date(o.createdAt || o.updatedAt || 0); return od.getFullYear() === d.getFullYear() && od.getMonth() === d.getMonth() && od.getDate() === d.getDate(); }).length);
    const ctx = $('#chBar');
    if (chBar) chBar.destroy();
    chBar = new Chart(ctx, {
      type: 'bar',
      data: { labels, datasets: [{ data: counts, backgroundColor: 'rgba(78,140,255,.55)', hoverBackgroundColor: '#4e8cff', borderRadius: 6, maxBarThickness: 26 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false }, ticks: { color: '#8b93a7', font: { size: 10, family: 'Vazirmatn' } } }, y: { beginAtZero: true, ticks: { stepSize: 1, color: '#8b93a7', font: { family: 'Vazirmatn' } }, grid: { color: 'rgba(255,255,255,.06)' } } } }
    });
    /* نمودار دونات وضعیت‌ها */
    const order = ['pending', 'review', 'approved', 'delivered', 'rejected'];
    const vals = order.map(s => ORDERS.filter(o => o.status === s).length);
    const dctx = $('#chDonut');
    if (chDonut) chDonut.destroy();
    chDonut = new Chart(dctx, {
      type: 'doughnut',
      data: { labels: order.map(s => ST_FA[s]), datasets: [{ data: vals, backgroundColor: order.map(s => ST_COLOR[s]), borderColor: '#101827', borderWidth: 3 }] },
      options: { responsive: true, maintainAspectRatio: false, cutout: '62%', plugins: { legend: { display: false } } }
    });
    $('#donutLegend').innerHTML = order.map((s, i) => `<span><i style="background:${ST_COLOR[s]}"></i>${ST_FA[s]} (${toFa(vals[i])})</span>`).join('');
  }

  /* آخرین ۵ سفارش */
  const sorted = ORDERS.slice().sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0)).slice(0, 5);
  $('#recentTbl').innerHTML = sorted.length ? tableHtml(sorted, { compact: true }) : '<div class="empty">هنوز سفارشی ثبت نشده است.</div>';
}

/* ── جدول سفارش ── */
function aiSummary(o) {
  const cs = (o.ai && o.ai.checks) || [];
  if (!cs.length) return '<span class="mut">—</span>';
  const ok = cs.filter(c => c.state === 'ok').length, bad = cs.filter(c => c.state === 'bad').length, warn = cs.filter(c => c.state !== 'ok' && c.state !== 'bad').length;
  return `<span style="color:var(--ok)">✓${toFa(ok)}</span> <span style="color:var(--bad)">✗${toFa(bad)}</span> <span style="color:var(--warn)">⚠${toFa(warn)}</span>`;
}
function actionsHtml(o, compact) {
  const a = [];
  if (o.status !== 'approved' && o.status !== 'delivered') a.push(`<button class="btn btn-g" data-approve="${esc(o.code)}">✅ تأیید</button>`);
  if (o.status === 'approved') a.push(`<button class="btn btn-p" data-deliver="${esc(o.code)}">📦 تحویل شد</button>`);
  if (o.status !== 'rejected') a.push(`<button class="btn btn-r" data-reject="${esc(o.code)}">❌ رد</button>`);
  if (!compact) a.push(`<button class="btn btn-o" data-del="${esc(o.code)}">🗑</button>`);
  return a.join('');
}
function tableHtml(list, opt) {
  opt = opt || {};
  const rows = list.map(o => {
    const items = (o.items || []).map(i => esc(i.title) + (i.qty > 1 ? ' ×' + toFa(i.qty) : '')).join(' + ') || '—';
    return `<tr>
      <td class="td-code">${esc(o.code)}</td>
      <td><span class="badge ${ST_CLS[o.status] || 'pending'}">${ST_FA[o.status] || esc(o.status)}</span></td>
      <td>${esc(o.name || '—')}<br><span class="mut" dir="ltr" style="font-size:11.5px">${esc(o.phone || '')}</span></td>
      <td style="max-width:210px">${items}</td>
      <td class="td-amt">${money(o.totalToman)}<span class="mut" style="font-size:10.5px"> ت</span></td>
      <td>${aiSummary(o)}</td>
      ${opt.compact ? '' : `<td class="td-date">${when(o.updatedAt || o.createdAt)}${o.ref ? '<br><span class="mut" dir="ltr">' + esc(o.ref) + '</span>' : ''}</td>`}
      <td>${o.img && !opt.compact ? `<button class="btn btn-o" data-img="${esc(o.img)}">🧾 فیش</button>` : '<span class="mut">—</span>'}</td>
      ${opt.compact ? '' : `<td><div class="acts">${actionsHtml(o)}</div></td>`}
    </tr>`;
  }).join('');
  const cols = ['کد', 'وضعیت', 'مشتری', 'اقلام', 'مبلغ', 'بررسی AI'].concat(opt.compact ? [] : ['زمان', 'فیش', 'عملیات']);
  return `<table><thead><tr>${cols.map(c => `<th>${c}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>`;
}

/* ── فیلترها ── */
function renderFilters() {
  const box = $('#ordFilters');
  const defs = [['all', 'همه'], ['pending', 'در انتظار'], ['review', 'بررسی دستی'], ['approved', 'تأیید شده'], ['delivered', 'تحویل شده'], ['rejected', 'رد شده']];
  const chips = defs.map(([k, l]) => {
    const n = k === 'all' ? ORDERS.length : ORDERS.filter(o => o.status === k).length;
    return `<button class="fchip ${ordFilter === k ? 'act' : ''}" data-f="${k}">${l}<span class="n">${toFa(n)}</span></button>`;
  }).join('');
  box.querySelectorAll('.fchip').forEach(x => x.remove());
  box.insertAdjacentHTML('beforeend', chips);
}
$('#ordFilters').addEventListener('click', e => {
  const c = e.target.closest('.fchip');
  if (!c) return;
  ordFilter = c.dataset.f;
  renderFilters(); renderOrders();
});
$('#ordSearch').addEventListener('input', e => { ordQuery = norm(e.target.value).toLowerCase(); renderOrders(); });

function renderOrders() {
  renderFilters();
  let list = ORDERS;
  if (ordFilter !== 'all') list = list.filter(o => o.status === ordFilter);
  if (ordQuery) list = list.filter(o => norm([o.code, o.name, o.phone, o.ref].join(' ')).toLowerCase().includes(ordQuery));
  const rank = s => s === 'review' ? 0 : s === 'pending' ? 1 : s === 'rejected' ? 2 : s === 'delivered' ? 4 : 3;
  list = list.slice().sort((a, b) => rank(a.status) - rank(b.status) || (b.updatedAt || 0) - (a.updatedAt || 0));
  $('#ordersTbl').innerHTML = list.length ? tableHtml(list) : '<div class="empty">سفارشی با این فیلتر پیدا نشد.</div>';
}

/* ── مشتریان ── */
function renderCustomers() {
  const map = new Map();
  for (const o of ORDERS) {
    const key = norm(o.phone || o.name || '?');
    if (key === '?') continue;
    const c = map.get(key) || { name: o.name || '—', phone: o.phone || '', count: 0, spent: 0, last: 0 };
    c.count++;
    if (o.status === 'delivered' || o.status === 'approved') c.spent += Number(o.totalToman) || 0;
    c.last = Math.max(c.last, o.createdAt || o.updatedAt || 0);
    if (o.name) c.name = o.name;
    map.set(key, c);
  }
  const list = Array.from(map.values()).sort((a, b) => b.last - a.last);
  $('#custTbl').innerHTML = list.length ? `<table><thead><tr><th>مشتری</th><th>شماره تماس</th><th>تعداد سفارش</th><th>مجموع خرید (تأییدشده)</th><th>آخرین سفارش</th></tr></thead><tbody>${list.map(c => `<tr>
    <td>${esc(c.name)}</td><td dir="ltr" style="text-align:right">${esc(c.phone || '—')}</td>
    <td><b>${toFa(c.count)}</b></td><td class="td-amt">${money(c.spent)}</td><td class="td-date">${when(c.last)}</td>
  </tr>`).join('')}</tbody></table>` : '<div class="empty">هنوز مشتری‌ای از سفارش‌ها شناسایی نشده است.</div>';
}

/* ── بایگانی فیش‌ها ── */
async function tgPhotoUrl(fid) {
  if (!TG.bot) return null;
  try {
    const r = await fetch('https://api.telegram.org/bot' + TG.bot + '/getFile?file_id=' + encodeURIComponent(fid));
    const j = await r.json();
    if (!j.ok || !j.result || !j.result.file_path) return null;
    return 'https://api.telegram.org/file/bot' + TG.bot + '/' + j.result.file_path;
  } catch (e) { return null; }
}
async function renderPhotos() {
  const grid = $('#phGrid');
  if (!PHOTOS.length) { grid.innerHTML = '<div class="empty">هنوز عکسی به ربات تلگرام ارسال نشده است.</div>'; return; }
  grid.innerHTML = PHOTOS.map(p => `<div class="ph-card" data-fid="${esc(p.fid || '')}"><img alt="فیش" src=""><div class="ph-meta"><b>${esc(p.cap || 'بدون توضیح')}</b>${when(p.ts)}</div></div>`).join('');
  for (const card of grid.querySelectorAll('.ph-card')) {
    const url = await tgPhotoUrl(card.dataset.fid);
    const img = card.querySelector('img');
    if (url) { img.src = url; img.addEventListener('click', () => openImg(url)); }
    else { card.querySelector('img').outerHTML = '<div class="empty" style="padding:60px 8px">تصویر منقضی شده<br><small>از تلگرام ببینید</small></div>'; }
  }
}
function openImg(src) { $('#imgModalImg').src = src; $('#imgModal').classList.add('show'); }
$('#imgModal').addEventListener('click', () => $('#imgModal').classList.remove('show'));

/* ── اتصال و تنظیمات ── */
async function renderConn() {
  const rows = [];
  rows.push(['دیتابیس سفارش‌ها (textdb.dev)', lastOk ? '<span class="st-ok">✓ متصل</span>' : '<span class="st-bad">✗ قطع</span>', '<b>' + esc((STORE || '').replace('https://textdb.dev/api/data/', '')) + '</b>']);
  if (TG.bot && TG.chat) {
    let me = null;
    try { const r = await fetch('https://api.telegram.org/bot' + TG.bot + '/getMe'); const j = await r.json(); me = j.ok ? j.result : null; } catch (e) {}
    rows.push(['ربات تلگرام', me ? '<span class="st-ok">✓ متصل — @' + esc(me.username) + '</span>' : '<span class="st-bad">✗ پاسخ نداد</span>', 'اطلاع‌رسانی سفارش + گوش‌دهی دستورات']);
  } else rows.push(['ربات تلگرام', '<span class="st-bad">✗ تنظیم نشده</span>', 'config.js → orderNotify']);
  rows.push(['درگاه کارت به کارت', C2C.enabled ? '<span class="st-ok">✓ فعال</span>' : '<span class="st-bad">✗ غیرفعال</span>', esc(C2C.bank || '') + ' — ' + esc(C2C.holder || '')]);
  $('#connRows').innerHTML = rows.map(([t, s, d]) => `<div class="set-row"><div><div class="t">${t}</div><div class="d">${d}</div></div><div>${s}</div></div>`).join('');
}

/* ── اکشن‌های سفارش ── */
document.body.addEventListener('click', async e => {
  const ap = e.target.closest('[data-approve]');
  const dv = e.target.closest('[data-deliver]');
  const rj = e.target.closest('[data-reject]');
  const dl = e.target.closest('[data-del]');
  const im = e.target.closest('[data-img]');
  if (im) return openImg(im.dataset.img);
  if (ap) return setStatus(ap.dataset.approve, 'approved', null);
  if (dv) return setStatus(dv.dataset.deliver, 'delivered', null);
  if (rj) {
    const reason = prompt('دلیل رد فیش (برای نمایش به کاربر):');
    if (reason === null) return;
    return setStatus(rj.dataset.reject, 'rejected', reason || 'فیش تأیید نشد');
  }
  if (dl) {
    if (!confirm('این سفارش از دیتابیس حذف شود؟')) return;
    ORDERS = ORDERS.filter(o => o.code !== dl.dataset.del);
    await dbWrite(ORDERS);
    renderPendingBadge();
    if (VIEW === 'orders') renderOrders(); else if (VIEW === 'dash') renderDash();
    toast('حذف شد');
  }
});
async function setStatus(code, status, reason) {
  const o = ORDERS.find(x => x.code === code);
  if (!o) return;
  o.status = status; o.reason = reason; o.updatedAt = Date.now();
  await dbWrite(ORDERS);
  if (VIEW === 'orders') renderOrders(); else if (VIEW === 'dash') renderDash();
  renderPendingBadge();
  tgSendText(status === 'approved' ? '✅ سفارش ' + code + ' تأیید شد — وضعیت در سایت برای کاربر به‌روز شد.'
    : status === 'delivered' ? '📦 سفارش ' + code + ' تحویل شد — در صفحه «وضعیت سفارش‌ها» کاربر نمایش داده می‌شود.'
    : '❌ سفارش ' + code + ' رد شد' + (reason ? '؛ دلیل: ' + reason : '') + '.');
  toast(status === 'approved' ? 'تأیید شد ✓ کاربر می‌بیند' : status === 'delivered' ? 'تحویل شد 📦 کاربر می‌بیند' : 'رد شد — کاربر دلیل را می‌بیند');
}

/* ── گوش‌دهی ربات ── */
let OFFSET = 0, botT = null;
async function stashTgPhoto(fileId, cap) {
  let photos = [];
  try { const r = await fetch(PSTORE + '?_=' + Date.now(), { cache: 'no-store' }); const jx = JSON.parse(await r.text()); if (Array.isArray(jx.photos)) photos = jx.photos; } catch (e) {}
  photos.unshift({ id: 'P' + Date.now().toString(36), fid: fileId, cap: String(cap || '').slice(0, 200), ts: Date.now() });
  await fetch(PSTORE, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ photos: photos.slice(0, 20) }) });
}
async function botTick() {
  if (!TG.bot || !TG.chat) return;
  try {
    const u = 'https://api.telegram.org/bot' + TG.bot + '/getUpdates?timeout=0&limit=20' + (OFFSET ? '&offset=' + OFFSET : '') + '&allowed_updates=' + encodeURIComponent(JSON.stringify(['message']));
    const r = await fetch(u);
    const j = await r.json();
    for (const up of (j.result || [])) {
      OFFSET = Math.max(OFFSET, up.update_id + 1);
      const m = up.message;
      if (!m || String(m.chat.id) !== String(TG.chat)) continue;
      if (m.photo && m.photo.length) {
        try { await stashTgPhoto(m.photo[m.photo.length - 1].file_id, m.caption || ''); toast('📸 عکس از تلگرام بایگانی شد'); } catch (e) {}
        continue;
      }
      if (!m.text) continue;
      const mt = norm(m.text);
      const mm = mt.match(/^\/?(تایید|taeed|ok|approve)\s+([a-z0-9\-]+)\s*$/i) ||
                 mt.match(/^\/?(تحویل|tahvil|deliver)\s+([a-z0-9\-]+)\s*$/i) ||
                 mt.match(/^\/?(رد|ردشد|reject|rad)\s+([a-z0-9\-]+)\s*([\s\S]*)$/i);
      if (!mm) continue;
      const code = mm[2].toUpperCase();
      if (mm[1].match(/تایید|taeed|ok|approve/i)) await setStatus(code, 'approved', null);
      else if (mm[1].match(/تحویل|tahvil|deliver/i)) await setStatus(code, 'delivered', null);
      else await setStatus(code, 'rejected', (mm[3] || '').trim() || 'فیش تأیید نشد');
      toast('از ربات: سفارش ' + code + ' به‌روزرسانی شد');
    }
  } catch (e) { /* بی‌صدا */ }
}
$('#botListen').addEventListener('change', e => {
  if (e.target.checked) { botT = setInterval(botTick, 4000); toast('گوش‌دهی به ربات روشن شد'); }
  else { clearInterval(botT); botT = null; }
});

/* ── تازه‌سازی خودکار ── */
let refreshLeft = 15, refT = null;
$('#btnRefresh').addEventListener('click', () => { refreshLeft = 15; loadAll(); toast('به‌روزرسانی شد'); });
function startAuto() {
  clearInterval(refT);
  refT = setInterval(() => {
    refreshLeft--;
    if (refreshLeft <= 0) { refreshLeft = 15; loadAll(true); }
  }, 1000);
}

/* ── شروع ── */
function boot() {
  show((location.hash || '#dash').replace('#', ''));
  loadAll();
  startAuto();
}
if (sessionStorage.getItem('ss_admin_ok') === '1') { $('#gate').style.display = 'none'; boot(); }
else $('#gPass').focus();
})();
