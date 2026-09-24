/* ═══════════════════════════════════════════════════
   STARSHOP — admin.js
   پنل تأیید سفارش‌های کارت به کارت:
   • لیست سفارش‌ها از دیتابیس سبک (textdb.dev) — فیش + نتیجه هوش مصنوعی
   • تأیید/رد (با ذکر دلیل) → ذخیره → کاربر همان لحظه در صفحه پرداخت می‌بیند
   • گوش‌دهی به دستورات ربات: /تایید <کد> و /رد <کد> دلیل در چت ربات
   رمز پیش‌فرض: starshop92 (قابل تغییر در config.js یا از همین پنل)
   ═══════════════════════════════════════════════════ */
(() => {
'use strict';

const $ = s => document.querySelector(s);
const CFG = window.SS_CONFIG || {};
const C2C = CFG.card2card || {};
const TG = CFG.orderNotify || {};
const STORE = C2C.store || '';
const DEF_HASH = C2C.adminPasswordHash || '';

/* ── ابزار ── */
const FA = '۰۱۲۳۴۵۶۷۸۹';
const toFa = n => String(n).replace(/\d/g, d => FA[d]);
const money = n => toFa(Number(n || 0).toLocaleString('en-US')).replace(/,/g, '٬');
const escapeHtml = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const esc2 = escapeHtml;
let toastT = null;
const toast = m => { const el = $('#admToast'); el.textContent = m; el.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), 2600); };
async function sha256(txt) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(txt));
  return Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('');
}
const currentHash = () => localStorage.getItem('ss_admin_hash') || DEF_HASH;

/* ── دیتابیس ── */
async function dbRead() {
  if (!STORE) return { orders: [] };
  try {
    const r = await fetch(STORE + '?_=' + Date.now(), { cache: 'no-store' });
    const j = JSON.parse(await r.text());
    return { orders: Array.isArray(j.orders) ? j.orders : [] };
  } catch (e) { return { orders: [] }; }
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
  } catch (e) { try { fetch('https://api.telegram.org/bot' + TG.bot + '/sendMessage', { method: 'POST', mode: 'no-cors', body: new URLSearchParams({ chat_id: TG.chat, text: String(text).slice(0, 3500) }) }).catch(() => {}); } catch (e2) {} }
}

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

/* ── لیست سفارش‌ها ── */
let ORDERS = [];
const ST_FA = { pending: 'در انتظار تأیید', review: 'بررسی دستی', approved: 'تأیید شده ✓', rejected: 'رد شده ✗' };
async function load() {
  const db = await dbRead();
  ORDERS = db.orders || [];
  render();
}
function render() {
  const list = $('#list');
  const pend = ORDERS.filter(o => o.status === 'pending' || o.status === 'review').length;
  const appr = ORDERS.filter(o => o.status === 'approved').length;
  const rej = ORDERS.filter(o => o.status === 'rejected').length;
  $('#stats').innerHTML =
    `<span class="chip">کل: <b>${toFa(ORDERS.length)}</b></span>` +
    `<span class="chip">در صف: <b>${toFa(pend)}</b></span>` +
    `<span class="chip">تأییدشده: <b>${toFa(appr)}</b></span>` +
    `<span class="chip">ردشده: <b>${toFa(rej)}</b></span>`;
  if (!ORDERS.length) { list.innerHTML = '<div class="empty">هنوز سفارشی ثبت نشده است.</div>'; return; }
  const rank = s => s === 'review' ? 0 : s === 'pending' ? 1 : s === 'rejected' ? 2 : 3;
  const sorted = ORDERS.slice().sort((a, b) => rank(a.status) - rank(b.status) || (b.updatedAt || 0) - (a.updatedAt || 0));
  list.innerHTML = sorted.map(o => {
    const d = new Date(o.updatedAt || o.createdAt || Date.now());
    const when = toFa(d.toLocaleDateString('fa-IR')) + ' ' + toFa(d.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }));
    const items = (o.items || []).map(i => esc2(i.title) + (i.qty > 1 ? ' ×' + toFa(i.qty) : '')).join(' + ') || '—';
    const ai = (o.ai && o.ai.checks || []).map(c =>
      `<span style="${c.state === 'ok' ? 'color:var(--ok)' : c.state === 'bad' ? 'color:var(--bad)' : 'color:var(--warn)'}">${c.state === 'ok' ? '✓' : c.state === 'bad' ? '✗' : '⚠'} ${esc2(c.k)}</span>`
    ).join(' ') || '<span style="color:var(--muted)">بدون بررسی هوش مصنوعی</span>';
    const img = o.img
      ? `<a href="${o.img}" target="_blank" rel="noopener"><img class="o-img" src="${o.img}" alt="فیش ${esc2(o.code)}"></a>`
      : '<p style="font-size:12px;color:var(--muted);margin:6px 0">🖼 تصویر فیش در دیتابیس ذخیره نشده — از تلگرام ببینید.</p>';
    const reason = o.reason ? `<p style="color:var(--bad);font-size:12.5px;margin:6px 0 0">دلیل رد: ${esc2(o.reason)}</p>` : '';
    return `<article class="order ${o.status === 'review' ? 'flagged' : ''}">
      <div class="o-head">
        <span class="o-code">${esc2(o.code)}</span>
        <span class="badge ${esc2(o.status)}">${ST_FA[o.status] || esc2(o.status)}</span>
      </div>
      <div class="o-meta">
        <span>👤 ${esc2(o.name || '—')} — <b dir="ltr">${esc2(o.phone || '—')}</b></span>
        <span>💰 <b>${money(o.totalToman)} تومان</b> (${money(o.totalRial)} ریال)</span>
        ${o.ref ? `<span>🧾 شماره پیگیری: <b dir="ltr">${esc2(o.ref)}</b></span>` : ''}
        <span>🕐 ${when}</span>
      </div>
      <div class="o-items">🛍 ${items}</div>
      <div class="o-ai">${ai}</div>
      ${img}${reason}
      <div class="o-actions">
        ${o.status !== 'approved' ? `<button class="btn btn-g" data-approve="${esc2(o.code)}">✅ تأیید</button>` : ''}
        ${o.status !== 'rejected' ? `<button class="btn btn-r" data-reject="${esc2(o.code)}">❌ رد</button>` : ''}
        <button class="btn btn-o" data-del="${esc2(o.code)}">🗑 حذف</button>
      </div>
    </article>`;
  }).join('');
}
$('#list').addEventListener('click', async e => {
  const ap = e.target.closest('[data-approve]');
  const rj = e.target.closest('[data-reject]');
  const dl = e.target.closest('[data-del]');
  if (ap) return setStatus(ap.dataset.approve, 'approved', null);
  if (rj) {
    const reason = prompt('دلیل رد فیش (برای نمایش به کاربر):');
    if (reason === null) return;
    return setStatus(rj.dataset.reject, 'rejected', reason || 'فیش تأیید نشد');
  }
  if (dl) { if (!confirm('این سفارش از دیتابیس حذف شود؟')) return; ORDERS = ORDERS.filter(o => o.code !== dl.dataset.del); await dbWrite(ORDERS); render(); toast('حذف شد'); }
});

/* ── تأیید/رد ── */
async function setStatus(code, status, reason) {
  const o = ORDERS.find(x => x.code === code);
  if (!o) return;
  o.status = status; o.reason = reason; o.updatedAt = Date.now();
  await dbWrite(ORDERS);
  render();
  tgSendText((status === 'approved' ? '✅ سفارش ' : '❌ سفارش ') + code + (status === 'approved' ? ' تأیید شد — وضعیت در سایت برای کاربر به‌روز شد.' : ' رد شد' + (reason ? '؛ دلیل: ' + reason : '') + '.'));
  toast(status === 'approved' ? 'تأیید شد ✓ کاربر می‌بیند' : 'رد شد — کاربر دلیل را می‌بیند');
}

/* ── گوش‌دهی به دستورات ربات (/تایید کد ، /رد کد دلیل) ── */
let OFFSET = 0, botT = null;
async function botTick() {
  if (!TG.bot || !TG.chat) return;
  try {
    const u = 'https://api.telegram.org/bot' + TG.bot + '/getUpdates?timeout=0&limit=20' + (OFFSET ? '&offset=' + OFFSET : '') + '&allowed_updates=' + encodeURIComponent(JSON.stringify(['message']));
    const r = await fetch(u);
    const j = await r.json();
    for (const up of (j.result || [])) {
      OFFSET = Math.max(OFFSET, up.update_id + 1);
      const m = up.message;
      if (!m || !m.text || String(m.chat.id) !== String(TG.chat)) continue;
      const mt = norm(m.text);
      const mm = mt.match(/^\/?(تایید|taeed|ok|approve)\s+([a-z0-9\-]+)\s*$/i) ||
                 mt.match(/^\/?(رد|ردشد|reject|rad)\s+([a-z0-9\-]+)\s*([\s\S]*)$/i);
      if (!mm) continue;
      const code = mm[2].toUpperCase();
      if (mm[1].match(/تایید|taeed|ok|approve/i)) await setStatus(code, 'approved', null);
      else await setStatus(code, 'rejected', (mm[3] || '').trim() || 'فیش تأیید نشد');
      toast('از ربات: سفارش ' + code + ' به‌روزرسانی شد');
    }
  } catch (e) { /* بی‌صدا */ }
}
const norm = s => String(s || '').replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/\s+/g, ' ').trim();
$('#botListen').addEventListener('change', e => {
  if (e.target.checked) { botT = setInterval(botTick, 4000); toast('گوش‌دهی به ربات روشن شد'); }
  else { clearInterval(botT); botT = null; }
});

/* ── شروع ── */
function boot() {
  load();
  setInterval(load, 15000);
  if ($('#botListen').checked) botT = setInterval(botTick, 4000);
  /* اگر با #کد سفارش از تلگرام آمده، همان سفارش را هایلایت کن */
  const hc = (location.hash || '').replace('#', '').toUpperCase();
  if (hc) setTimeout(() => { const el = Array.from(document.querySelectorAll('.o-code')).find(x => x.textContent.trim().toUpperCase() === hc); if (el) el.closest('.order').style.outline = '2px solid var(--brand)'; }, 800);
}
if (sessionStorage.getItem('ss_admin_ok') === '1') { $('#gate').style.display = 'none'; boot(); }
$('#btnRefresh').addEventListener('click', () => { load(); toast('به‌روزرسانی شد'); });
})();
