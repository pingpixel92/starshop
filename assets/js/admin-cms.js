/* ═══════════════════════════════════════════════════
   STARSHOP — admin-cms.js
   پنل مدیریت کامل (الگوی وردپرس) برای سایت استاتیک گیت‌هاب Pages:
   • همه‌ی تغییرات = کامیت اتمی در مخزن (Git Data API) → Pages خودش ری‌بیلد می‌کند
   • محتوا در site-overrides.js ذخیره می‌شود (روی‌نویسی امن بدون دست‌زدن به فایل‌های اصلی)
   • هر ذخیره = bump خودکار نسخه‌ی sw.js → همه‌ی بازدیدکننده‌ها بلافاصله محتوای تازه می‌گیرند
   • مدیریت تصاویر: آپلود با تبدیل خودکار به webp + حذف — کامیت مستقیم در assets
   توکن گیت‌هاب فقط در localStorage همین مرورگر ذخیره می‌شود و هرگز کامیت نمی‌شود.
   ═══════════════════════════════════════════════════ */
(() => {
'use strict';

const REPO = 'pingpixel92/starshop';
const BR = 'main';
const OV_PATH = 'assets/js/site-overrides.js';
const RAW = 'https://raw.githubusercontent.com/' + REPO + '/' + BR + '/';
const LIVE = 'https://starshop24.ir/';

const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const FA = '۰۱۲۳۴۵۶۷۸۹';
const toFa = n => String(n == null ? '' : n).replace(/\d/g, d => FA[d]);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clone = o => JSON.parse(JSON.stringify(o || {}));
let toastT = null;
const toast = m => { const el = $('#admToast'); if (!el) return; el.textContent = m; el.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), 3000); };

/* ── base64 ↔ متن (یونیکد-امن) ── */
const b64u = b64 => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\s/g, '')), c => c.charCodeAt(0)));
const u64 = txt => { const b = new TextEncoder().encode(txt); let s = ''; b.forEach(x => { s += String.fromCharCode(x); }); return btoa(s); };
const blobB64 = blob => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] || ''); r.onerror = rej; r.readAsDataURL(blob); });
async function sha256(txt) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(txt));
  return Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('');
}

/* ══════════ ۱) لایه گیت‌هاب ══════════ */
const TOK = {
  get: () => { try { return localStorage.getItem('ss_gh_token') || ''; } catch (e) { return ''; } },
  set: v => { try { localStorage.setItem('ss_gh_token', v.trim()); } catch (e) {} },
  clear: () => { try { localStorage.removeItem('ss_gh_token'); localStorage.removeItem('ss_gh_login'); } catch (e) {} },
  login: () => { try { return localStorage.getItem('ss_gh_login') || ''; } catch (e) { return ''; } }
};

async function gh(path, opts = {}) {
  if (!TOK.get()) throw new Error('توکن گیت‌هاب تنظیم نشده است');
  const r = await fetch('https://api.github.com' + path, Object.assign({}, opts, {
    headers: Object.assign({
      'Accept': 'application/vnd.github+json',
      'Authorization': 'Bearer ' + TOK.get(),
      'X-GitHub-Api-Version': '2022-11-28'
    }, opts.headers || {})
  }));
  if (!r.ok) {
    let msg = 'خطای ' + r.status;
    try { const j = await r.json(); msg = j.message || msg; } catch (e) {}
    throw new Error('GitHub: ' + msg);
  }
  if (r.status === 204) return {};
  return r.json();
}

/* کامیت اتمی چندفایلی + bump خودکار sw.js — الگوی Git Data API */
let BUSY = false;
async function commitFiles(files, msg, opts = {}) {
  if (BUSY) throw new Error('یک ذخیره‌سازی در جریان است — کمی صبر کنید');
  BUSY = true;
  try {
    /* ۱) نسخه‌ی جدید sw.js (bump) — مگر اینکه خود فایل در لیست باشد یا bump نخواهیم */
    const list = files.slice();
    if (!opts.noVerBump && !list.some(f => f.path === 'sw.js')) {
      try {
        const swj = await gh('/repos/' + REPO + '/contents/sw.js?ref=' + BR);
        const swTxt = b64u(swj.content || '');
        const m = swTxt.match(/const VER = '(\d+)';/);
        if (m) list.push({ path: 'sw.js', text: swTxt.replace("const VER = '" + m[1] + "';", "const VER = '" + String(+m[1] + 1) + "';") });
      } catch (e) { /* بدون bump ادامه بده */ }
    }
    /* ۲) ref → commit → tree پایه */
    const ref = await gh('/repos/' + REPO + '/git/ref/heads/' + BR);
    const headSha = ref.object.sha;
    const c0 = await gh('/repos/' + REPO + '/git/commits/' + headSha);
    /* ۳) ساخت blob ها */
    const entries = [];
    for (const f of list) {
      if (f.del) { entries.push({ path: f.path, mode: '100644', type: 'blob', sha: null }); continue; }
      const b = await gh('/repos/' + REPO + '/git/blobs', { method: 'POST', body: JSON.stringify({ content: f.text != null ? u64(f.text) : f.b64, encoding: 'base64' }) });
      entries.push({ path: f.path, mode: f.mode || '100644', type: 'blob', sha: b.sha });
    }
    /* ۴) درخت جدید + کامیت + جابه‌جایی ref (با کنترل مسابقه) */
    let tree, commit;
    try {
      tree = await gh('/repos/' + REPO + '/git/trees', { method: 'POST', body: JSON.stringify({ base_tree: c0.tree.sha, tree: entries }) });
      commit = await gh('/repos/' + REPO + '/git/commits', { method: 'POST', body: JSON.stringify({ message: msg, tree: tree.sha, parents: [headSha] }) });
      await gh('/repos/' + REPO + '/git/refs/heads/' + BR, { method: 'PATCH', body: JSON.stringify({ sha: commit.sha, force: false }) });
    } catch (e) {
      if (!/409|is at|Fast-forward/.test(String(e.message))) throw e;
      toast('⚠ تداخل کامیت — دوباره تلاش می‌کنم…');
      const ref2 = await gh('/repos/' + REPO + '/git/ref/heads/' + BR);
      const c2 = await gh('/repos/' + REPO + '/git/commits/' + ref2.object.sha);
      tree = await gh('/repos/' + REPO + '/git/trees', { method: 'POST', body: JSON.stringify({ base_tree: c2.tree.sha, tree: entries }) });
      commit = await gh('/repos/' + REPO + '/git/commits', { method: 'POST', body: JSON.stringify({ message: msg, tree: tree.sha, parents: [ref2.object.sha] }) });
      await gh('/repos/' + REPO + '/git/refs/heads/' + BR, { method: 'PATCH', body: JSON.stringify({ sha: commit.sha, force: false }) });
    }
    return { sha: commit.sha, ver: await targetVer() };
  } finally { BUSY = false; }
}

/* نسخه‌ی هدف برای poll انتشار = VER فعلی ریپو + ۱ (بعد از bump) */
async function targetVer() {
  try {
    const swj = await gh('/repos/' + REPO + '/contents/sw.js?ref=' + BR);
    const m = (b64u(swj.content || '')).match(/const VER = '(\d+)';/);
    return m ? m[1] : null;
  } catch (e) { return null; }
}

/* انتظار برای انتشار Pages: poll نسخه‌ی زنده */
async function waitDeploy(targetVer, ui) {
  const t0 = Date.now();
  while (Date.now() - t0 < 6 * 60000) {
    try {
      const r = await fetch(LIVE + 'sw.js?_=' + Date.now(), { cache: 'no-store' });
      const txt = await r.text();
      const m = txt.match(/const VER = '(\d+)';/);
      if (m && m[1] === String(targetVer)) return true;
    } catch (e) {}
    if (ui) ui(Math.min(95, Math.round((Date.now() - t0) / 3600)));
    await new Promise(r => setTimeout(r, 15000));
  }
  return false;
}

/* ══════════ ۲) لایه overrides ══════════ */
const OV_HEAD = '/* ═══════════════════════════════════════════════════\n' +
'   STARSHOP — site-overrides.js\n' +
'   ⚠️ این فایل توسط پنل مدیریت (admin.html) تولید می‌شود.\n' +
'   تنظیمات دلخواه مدیر را روی SS_CONFIG و SS_DATA «روی‌نویسی» می‌کند\n' +
'   بدون اینکه فایل‌های اصلی دست بخورند (الگوی امن مثل دیتابیس وردپرس).\n' +
'   بخش JSON بین دو نشانگر START/END توسط پنل به‌روزرسانی می‌شود؛\n' +
'   موتور ادغام پایین دستکاری نکنید.\n' +
'   ═══════════════════════════════════════════════════ */\n' +
"window.SS_OVERRIDES = ";
const OV_TAIL = ";\n\n;(() => {\n'use strict';\nconst O = window.SS_OVERRIDES || {};\nif (!O || typeof O !== 'object') return;\n" +
"const deep = (t, s) => {\n  for (const k in s) {\n    if (!Object.prototype.hasOwnProperty.call(s, k)) continue;\n    const v = s[k];\n    if (v && typeof v === 'object' && !Array.isArray(v) && t[k] && typeof t[k] === 'object' && !Array.isArray(t[k])) deep(t[k], v);\n    else t[k] = v;\n  }\n  return t;\n};\n" +
"if (O.config && window.SS_CONFIG) deep(window.SS_CONFIG, O.config);\n" +
"if (O.data && window.SS_DATA) {\n  for (const lang in O.data) {\n    if (window.SS_DATA[lang]) deep(window.SS_DATA[lang], O.data[lang]);\n    else window.SS_DATA[lang] = O.data[lang];\n  }\n}\n" +
"window.SS_FLAGS = O.flags || {};\n" +
"const hide = (O.flags && O.flags.hideSections) || [];\n" +
"const kill = id => {\n  const el = document.getElementById(id);\n  if (el) { el.style.display = 'none'; el.setAttribute('data-flag-hidden', '1'); }\n  document.querySelectorAll('a[href=\"#' + id + '\"]').forEach(a => {\n    const box = a.closest('li') || a.closest('div') || a;\n    box.style.display = 'none';\n  });\n};\n" +
"if (hide.length) {\n  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => hide.forEach(kill));\n  else hide.forEach(kill);\n}\n})();\n";

let OV = {};          /* آبجکت overrides جاری (از ریپو) */
let OVSHA = null;     /* sha فایل برای تشخیص تغییر بیرونی */
let EFF = {};         /* پیکربندی مؤثر (base ⊕ overrides) برای ویرایش */

const parseOv = text => {
  const m = text && text.match(/\/\* SS_OVERRIDES_JSON_START \*\/([\s\S]*?)\/\* SS_OVERRIDES_JSON_END \*\//);
  if (!m) return {};
  try { return JSON.parse(m[1]) || {}; } catch (e) { return {}; }
};
const buildOvFile = ov => OV_HEAD + '/* SS_OVERRIDES_JSON_START */' + JSON.stringify(ov, null, 2) + '/* SS_OVERRIDES_JSON_END */' + OV_TAIL;

async function loadOv() {
  try {
    const j = await gh('/repos/' + REPO + '/contents/' + OV_PATH + '?ref=' + BR);
    OVSHA = j.sha;
    OV = parseOv(b64u(j.content || ''));
  } catch (e) { OVSHA = null; OV = {}; }
  EFF = clone(window.SS_CONFIG || {});
  if (OV.config) { const deep = (t, s) => { for (const k in s) { if (s[k] && typeof s[k] === 'object' && !Array.isArray(s[k]) && t[k] && typeof t[k] === 'object' && !Array.isArray(t[k])) deep(t[k], s[k]); else t[k] = clone(s[k]); } return t; }; deep(EFF, OV.config); }
}

async function saveOv(msg) {
  const text = buildOvFile(OV);
  JSON.parse(text.match(/\/\* SS_OVERRIDES_JSON_START \*\/([\s\S]*?)\/\* SS_OVERRIDES_JSON_END \*\//)[1]); /* اعتبارسنجی */
  const res = await commitFiles([{ path: OV_PATH, text }], msg + ' — از پنل مدیریت');
  deployStart(res);
  await loadOv();
}

/* ══════════ ۳) نوار انتشار ══════════ */
function deployStart(res) {
  const bar = $('#deployBar'), msg = $('#deployMsg');
  if (!bar) { toast('ذخیره شد ✓ در حال انتشار…'); return; }
  bar.hidden = false;
  msg.textContent = 'کامیت شد ✓ در حال انتشار روی سایت (۱ تا ۳ دقیقه)… نسخه‌ی هدف: ' + toFa(res.ver || '؟');
  if (!res.ver) { setTimeout(() => { bar.hidden = true; toast('کامیت شد ✓'); }, 3000); return; }
  waitDeploy(res.ver, p => { msg.textContent = 'در حال انتشار… ' + toFa(p) + '٪ (نسخه ' + toFa(res.ver) + ')'; }).then(ok => {
    bar.hidden = true;
    toast(ok ? '✅ منتشر شد — سایت به‌روز است (نسخه ' + toFa(res.ver) + ')' : '⏳ انتشار کمی طول کشید — بعداً چک کنید');
    if (ok && $('#pane-dash') && !$('#pane-dash').hidden) dashLoad();
  });
}

/* ══════════ ۴) توکن ══════════ */
async function tokenValidate(t) {
  TOK.set(t);
  try {
    const j = await gh('/repos/' + REPO);
    try { localStorage.setItem('ss_gh_login', (j.full_name || REPO)); } catch (e) {}
    return true;
  } catch (e) { TOK.clear(); throw e; }
}
function tokenChip() {
  const c = $('#ghChip');
  if (!c) return;
  if (TOK.get()) c.innerHTML = '🔗 توکن فعال ✓ <b dir="ltr">' + esc(TOK.login() || REPO) + '</b>';
  else c.innerHTML = '🔒 توکن: داده نشده';
}
function tokenGate(show) {
  const g = $('#tokGate');
  if (!g) return;
  g.hidden = !show;
  if (show) { $('#tokIn').value = ''; $('#tokErr').textContent = ''; setTimeout(() => $('#tokIn').focus(), 100); }
}
$('#btnToken').addEventListener('click', () => tokenGate(true));
$('#tokCancel').addEventListener('click', () => tokenGate(false));
$('#tokLogout').addEventListener('click', () => { TOK.clear(); tokenChip(); tokenGate(false); toast('توکن از این مرورگر پاک شد'); });
$('#tokSave').addEventListener('click', async () => {
  const v = $('#tokIn').value.trim();
  if (!v) { $('#tokErr').textContent = 'توکن را وارد کنید'; return; }
  $('#tokSave').disabled = true; $('#tokErr').textContent = 'در حال بررسی…';
  try {
    await tokenValidate(v);
    tokenChip(); tokenGate(false);
    toast('توکن تأیید شد ✓ حالا می‌توانید ذخیره کنید');
    cmsInit();
  } catch (e) {
    $('#tokErr').textContent = 'توکن نامعتبر: ' + e.message;
  } finally { $('#tokSave').disabled = false; }
});

/* ══════════ ۵) داشبورد ══════════ */
const VIS_DB = (window.SS_CONFIG && window.SS_CONFIG.visitorLog && window.SS_CONFIG.visitorLog.store) || '';
const ORD_DB = (window.SS_CONFIG && window.SS_CONFIG.card2card && window.SS_CONFIG.card2card.store) || '';
async function dbGet(url) {
  try { const r = await fetch(url + '?_=' + Date.now(), { cache: 'no-store' }); return JSON.parse((await r.text()) || '{}'); }
  catch (e) { return {}; }
}
async function dashLoad() {
  const el = id => $('#' + id);
  /* بازدیدها */
  const vis = VIS_DB ? await dbGet(VIS_DB) : {};
  if (el('dVisTotal')) el('dVisTotal').textContent = toFa(vis.total || 0);
  if (el('dVisToday')) el('dVisToday').textContent = toFa(vis.todayCount || 0);
  const lu = vis.updatedAt ? new Date(+vis.updatedAt) : null;
  if (el('dVisLast')) el('dVisLast').textContent = lu ? toFa(lu.toLocaleDateString('fa-IR')) + ' ' + toFa(lu.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })) : '—';
  /* سفارش‌ها */
  const ord = ORD_DB ? await dbGet(ORD_DB) : {};
  const os = Array.isArray(ord.orders) ? ord.orders : [];
  const cnt = s => os.filter(o => o.status === s).length;
  if (el('dOrdAll')) el('dOrdAll').textContent = toFa(os.length);
  if (el('dOrdPend')) el('dOrdPend').textContent = toFa(cnt('pending') + cnt('review'));
  if (el('dOrdOk')) el('dOrdOk').textContent = toFa(cnt('approved') + cnt('delivered'));
  /* نسخه زنده و ریپو */
  let liveVer = '—';
  try { liveVer = ((await (await fetch(LIVE + 'sw.js?_=' + Date.now(), { cache: 'no-store' })).text()).match(/const VER = '(\d+)';/) || [])[1] || '—'; } catch (e) {}
  if (el('dVer')) el('dVer').textContent = toFa(liveVer);
  if (TOK.get()) {
    try {
      const rv = await targetVer();
      const rep = el('dRepoVer'); if (rep) rep.textContent = toFa(rv || '—');
      const chip = el('dDeployChip');
      if (chip) { chip.textContent = (rv && liveVer && rv === liveVer) ? '✅ همگام' : '⏳ در حال انتشار'; chip.style.color = (rv && liveVer && rv === liveVer) ? 'var(--ok)' : 'var(--warn)'; }
      const cs = await gh('/repos/' + REPO + '/commits?per_page=5');
      const box = el('dCommits');
      if (box) box.innerHTML = cs.map(c => {
        const d = new Date(c.commit.author.date);
        return '<li><b dir="ltr">' + esc(String(c.sha).slice(0, 7)) + '</b> — ' + esc(c.commit.message.split('\n')[0].slice(0, 80)) + ' <span style="color:var(--muted)">' + toFa(d.toLocaleDateString('fa-IR')) + ' ' + toFa(d.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })) + '</span></li>';
      }).join('') || '<li>—</li>';
    } catch (e) {
      const box = el('dCommits'); if (box) box.innerHTML = '<li>برای فعالیت مخزن، توکن گیت‌هاب بدهید: ' + esc(e.message) + '</li>';
    }
  }
}
$('#dashRefresh').addEventListener('click', () => { dashLoad(); toast('به‌روزرسانی شد'); });
$('#btnHardReload').addEventListener('click', () => {
  if (caches && caches.keys) caches.keys().then(k => Promise.all(k.map(x => caches.delete(x)))).finally(() => location.reload(true));
  else location.reload(true);
});

/* ══════════ ۶) محصولات ══════════ */
let editGame = -1; /* اندکس در حال ویرایش؛ -۱ = بسته */
function gamesRender() {
  const box = $('#gamesList');
  if (!box) return;
  const gt = EFF.gameTopups || (EFF.gameTopups = { enabled: true, premiumToman: 850000, items: [] });
  gt.items = gt.items || [];
  $('#prodPremium').value = gt.premiumToman != null ? gt.premiumToman : '';
  box.innerHTML = gt.items.map((g, i) =>
    '<div class="row">' +
      '<span class="row-thumb"><img src="' + RAW + 'assets/img/games/' + esc(g.img || g.id) + '.webp" alt="" onerror="this.style.visibility=\'hidden\'"></span>' +
      '<div class="row-main"><b>' + esc(g.nf || g.n || g.id) + '</b>' +
      '<small dir="ltr">' + esc(g.id) + ' · ' + toFa((g.packs || []).length) + ' بسته · ' + esc(g.img || g.id) + '.webp</small></div>' +
      '<span class="row-actions">' +
        '<button class="btn btn-o btn-sm" data-gedit="' + i + '">ویرایش</button>' +
        '<button class="btn btn-o btn-sm" data-gup="' + i + '">↑</button>' +
        '<button class="btn btn-o btn-sm" data-gdn="' + i + '">↓</button>' +
        '<button class="btn btn-r btn-sm" data-gdel="' + i + '">حذف</button>' +
      '</span></div>'
  ).join('') || '<div class="empty">هنوز بازی‌ای نیست — «افزودن بازی» بزنید.</div>';
  $('#gameEditor').hidden = editGame < 0;
  if (editGame >= 0) gameEditorRender();
}
function gameEditorRender() {
  const g = EFF.gameTopups.items[editGame];
  if (!g) { editGame = -1; $('#gameEditor').hidden = true; return; }
  $('#geNf').value = g.nf || ''; $('#geNa').value = g.na || ''; $('#geN').value = g.n || '';
  $('#geId').value = g.id || ''; $('#geImg').value = g.img || '';
  $('#geFit').checked = g.fit === 'contain';
  $('#gePacks').innerHTML = (g.packs || []).map((p, j) =>
    '<div class="pack-row">' +
      '<input data-pn="' + j + '" value="' + esc(p.n) + '" placeholder="نام انگلیسی" dir="ltr">' +
      '<input data-pnf="' + j + '" value="' + esc(p.nf || '') + '" placeholder="نام فارسی">' +
      '<input data-pusd="' + j + '" value="' + esc(p.usd) + '" placeholder="دلار" dir="ltr" inputmode="decimal">' +
      '<button class="btn btn-r btn-sm" data-pdel="' + j + '">✕</button></div>'
  ).join('');
}
$('#btnGameAdd').addEventListener('click', () => {
  EFF.gameTopups.items.push({ id: 'new-game', n: 'New Game', nf: 'بازی جدید', na: '', packs: [{ n: '100 Coins', nf: '۱۰۰ سکه', usd: 0.99 }] });
  editGame = EFF.gameTopups.items.length - 1;
  gamesRender();
});
$('#gamesList').addEventListener('click', e => {
  const ed = e.target.closest('[data-gedit]'), up = e.target.closest('[data-gup]'), dn = e.target.closest('[data-gdn]'), de = e.target.closest('[data-gdel]');
  const items = EFF.gameTopups.items;
  if (ed) { editGame = +ed.dataset.gedit; gamesRender(); }
  if (up) { const i = +up.dataset.gup; if (i > 0) { [items[i - 1], items[i]] = [items[i], items[i - 1]]; gamesRender(); } }
  if (dn) { const i = +dn.dataset.gdn; if (i < items.length - 1) { [items[i + 1], items[i]] = [items[i], items[i + 1]]; gamesRender(); } }
  if (de) { const i = +de.dataset.gdel; if (confirm('بازی «' + (items[i].nf || items[i].id) + '» حذف شود؟')) { items.splice(i, 1); if (editGame === i) editGame = -1; gamesRender(); } }
});
$('#gePacks').addEventListener('click', e => {
  const de = e.target.closest('[data-pdel]');
  if (de) { EFF.gameTopups.items[editGame].packs.splice(+de.dataset.pdel, 1); gameEditorRender(); }
});
$('#geAddPack').addEventListener('click', () => {
  EFF.gameTopups.items[editGame].packs.push({ n: 'New Pack', nf: 'بسته جدید', usd: 0.99 });
  gameEditorRender();
});
$('#geSave').addEventListener('click', () => {
  const g = EFF.gameTopups.items[editGame];
  const id = $('#geId').value.trim().replace(/[^a-z0-9\-]/gi, '').toLowerCase() || 'game';
  g.id = id; g.n = $('#geN').value.trim() || id; g.nf = $('#geNf').value.trim() || id;
  g.na = $('#geNa').value.trim(); g.img = $('#geImg').value.trim();
  g.fit = $('#geFit').checked ? 'contain' : undefined;
  $$('#gePacks input').forEach(inp => {
    const j = inp.dataset.pn != null ? +inp.dataset.pn : inp.dataset.pnf != null ? +inp.dataset.pnf : +inp.dataset.pusd;
    const p = g.packs[j]; if (!p) return;
    if (inp.dataset.pn != null) p.n = inp.value.trim();
    if (inp.dataset.pnf != null) p.nf = inp.value.trim();
    if (inp.dataset.pusd != null) p.usd = parseFloat(String(inp.value).replace(/[^\d.]/g, '')) || 0;
  });
  editGame = -1; gamesRender(); toast('بازی ذخیره شد (منتظر «انتشار تغییرات») ');
});
$('#geCancel').addEventListener('click', () => { editGame = -1; gamesRender(); });
$('#prodPremium').addEventListener('input', e => { EFF.gameTopups.premiumToman = parseFloat(String(e.target.value).replace(/[^\d]/g, '')) || 0; });

/* ویرایشگر کارت‌ها و پی‌پال */
function cardsRender() {
  const box = $('#cardsList');
  if (!box) return;
  const block = (title, arr, priceKey, unit) => {
    return '<div class="card-block"><h3>' + title + '</h3>' +
      arr.map((it, i) => '<div class="row"><div class="row-main"><b>' + esc(it.nf || it.n || it.id) + '</b><small dir="ltr">' + esc(it.n || it.id) + '</small></div>' +
        '<label>' + unit + ' <input data-ck="' + priceKey + '" data-ci="' + i + '" value="' + esc(it[priceKey]) + '" dir="ltr" inputmode="decimal" style="width:110px"></label></div>').join('') +
      '</div>';
  };
  box.innerHTML =
    block('کارت فیزیکی — هزینه دلاری (usd)', (EFF.physCards && EFF.physCards.types) || [], 'usd', '$') +
    block('کارت مجازی و سفر — هزینه دلاری (usd)', (EFF.virtCards && EFF.virtCards.items) || [], 'usd', '$') +
    block('پی‌پال — قیمت ثابت تومان', (EFF.ppAcct && EFF.ppAcct.plans) || [], 'toman', 'تومان');
}
$('#cardsList').addEventListener('input', e => {
  const t = e.target;
  if (!t.dataset.ck) return;
  const key = t.dataset.ck, i = +t.dataset.ci;
  const val = parseFloat(String(t.value).replace(/[^\d.]/g, '')) || 0;
  if (key === 'usd' && EFF.physCards && EFF.physCards.types[i]) EFF.physCards.types[i].usd = val;
  if (key === 'usd' && EFF.virtCards && EFF.virtCards.items[i]) EFF.virtCards.items[i].usd = val;
  if (key === 'toman' && EFF.ppAcct && EFF.ppAcct.plans[i]) EFF.ppAcct.plans[i].toman = val;
});
$('#btnProdSave').addEventListener('click', async () => {
  if (!TOK.get()) { tokenGate(true); return; }
  try {
    OV.config = OV.config || {};
    OV.config.gameTopups = EFF.gameTopups;
    OV.config.physCards = EFF.physCards;
    OV.config.virtCards = EFF.virtCards;
    OV.config.ppAcct = EFF.ppAcct;
    $('#btnProdSave').disabled = true;
    await saveOv('محصولات و قیمت‌ها به‌روزرسانی شد');
  } catch (e) { toast('✗ ' + e.message); }
  finally { $('#btnProdSave').disabled = false; }
});

/* ══════════ ۷) تصاویر ══════════ */
let TREE = null;
const IMG_RE = /\.(webp|png|jpe?g|svg|gif|avif)$/i;
async function getTree(force) {
  if (TREE && !force) return TREE;
  TREE = await gh('/repos/' + REPO + '/git/trees/' + BR + '?recursive=1');
  return TREE;
}
const IMG_DIRS = ['assets/img/games', 'assets/logos/ai', 'assets/logos', 'assets/img'];
function imgDirFill() {
  const sel = $('#imgDir');
  if (!sel) return;
  sel.innerHTML = IMG_DIRS.map(d => '<option value="' + d + '">' + d + '</option>').join('');
}
async function imgGrid() {
  const grid = $('#imgGrid');
  if (!grid) return;
  if (!TOK.get()) { grid.innerHTML = '<div class="empty">برای مدیریت تصاویر، توکن گیت‌هاب بدهید.</div>'; return; }
  grid.innerHTML = '<div class="empty">در حال خواندن فهرست…</div>';
  try {
    await getTree();
    const dir = $('#imgDir').value;
    const files = (TREE.tree || []).filter(t => t.type === 'blob' && t.path.startsWith(dir + '/') && IMG_RE.test(t.path));
    grid.innerHTML = files.map(f => {
      const name = f.path.split('/').pop();
      return '<figure class="img-card" data-path="' + esc(f.path) + '">' +
        '<img src="' + RAW + esc(f.path) + '?_=' + Date.now() + '" loading="lazy" alt="">' +
        '<figcaption><span dir="ltr" title="' + esc(name) + '">' + esc(name) + '</span>' +
        '<span class="img-size">' + toFa(Math.max(1, Math.round((f.size || 0) / 1024))) + ' کیلوبایت</span></figcaption>' +
        '<button class="btn btn-r btn-sm img-del" data-delpath="' + esc(f.path) + '">حذف</button></figure>';
    }).join('') || '<div class="empty">این پوشه تصویری ندارد.</div>';
  } catch (e) { grid.innerHTML = '<div class="empty">✗ ' + esc(e.message) + '</div>'; }
}
$('#imgDir').addEventListener('change', imgGrid);
$('#imgRefresh').addEventListener('click', () => { TREE = null; imgGrid(); });
$('#imgGrid').addEventListener('click', async e => {
  const del = e.target.closest('[data-delpath]');
  if (!del) return;
  const p = del.dataset.delpath;
  if (!confirm('«' + p.split('/').pop() + '» از مخزن حذف شود؟ (سایت با کاشی گرادیانی جای خالی را نشان می‌دهد)')) return;
  try {
    const res = await commitFiles([{ path: p, del: true }], 'حذف تصویر ' + p + ' — از پنل مدیریت');
    toast('حذف شد ✓ در حال انتشار…');
    deployStart(res);
    imgGrid();
  } catch (e) { toast('✗ ' + e.message); }
});
/* آپلود + تبدیل خودکار به webp */
async function toWebpBlob(file, maxDim) {
  if (/svg/i.test(file.type) || /\.svg$/i.test(file.name)) return null; /* svg دست‌نخورده */
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(bmp.width * scale));
  c.height = Math.max(1, Math.round(bmp.height * scale));
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise(r => c.toBlob(r, 'image/webp', 0.9));
}
$('#btnImgUpload').addEventListener('click', async () => {
  if (!TOK.get()) { tokenGate(true); return; }
  const inp = $('#imgFile');
  if (!inp.files || !inp.files.length) { toast('اول فایل عکس را انتخاب کنید'); return; }
  const dir = $('#imgDir').value;
  const maxDim = /logos/.test(dir) ? 512 : 640;
  $('#btnImgUpload').disabled = true;
  try {
    const files = [];
    for (const f of inp.files) {
      let name = $('#imgName').value.trim();
      if (inp.files.length > 1 || !name) name = f.name.replace(/\.[^.]+$/, '').replace(/[^\w\-]/g, '-').toLowerCase();
      name = name.replace(/\.(webp|png|jpe?g)$/i, '');
      const wp = await toWebpBlob(f, maxDim);
      if (wp) files.push({ path: dir + '/' + name + '.webp', b64: await blobB64(wp) });
      else files.push({ path: dir + '/' + name + '.svg', b64: await blobB64(f) });
    }
    const res = await commitFiles(files, 'آپلود ' + files.length + ' تصویر در ' + dir + ' — از پنل مدیریت');
    toast('آپلود شد ✓ در حال انتشار…');
    deployStart(res);
    TREE = null;
    setTimeout(imgGrid, 500);
    inp.value = '';
  } catch (e) { toast('✗ ' + e.message); }
  finally { $('#btnImgUpload').disabled = false; }
});
['dragover', 'drop'].forEach(ev => $('#imgGrid').addEventListener(ev, e => {
  e.preventDefault();
  if (ev === 'drop' && e.dataTransfer.files.length) {
    const dt = new DataTransfer();
    Array.from(e.dataTransfer.files).forEach(f => dt.items.add(f));
    $('#imgFile').files = dt.files;
    toast('فایل آماده است — «آپلود و انتشار» را بزنید');
  }
}));

/* ══════════ ۸) افزونه‌ها ══════════ */
const SECTIONS = [
  { id: 'games', label: 'سکشن خرید درون‌بازی (بازی‌ها)' },
  { id: 'giftcards', label: 'سکشن گیفت‌کارت' },
  { id: 'ai', label: 'سکشن هوش مصنوعی' },
  { id: 'cards', label: 'سکشن کارت بانکی/ویزا' },
  { id: 'paypal', label: 'سکشن پی‌پال' },
  { id: 'support', label: 'سکشن پشتیبانی (پایین سایت)' }
];
const PLUGINS = [
  { key: 'supportBubble', label: 'حباب چت پشتیبانی شناور', off: true },
  { key: 'smoothScroll', label: 'اسکرول نرم (Lenis)', off: true },
  { key: 'scene3d', label: 'پس‌زمینه سه‌بعدی WebGL', off: true }
];
const CFG_TOGGLES = [
  { path: 'card2card.enabled', label: 'پرداخت کارت‌به‌کارت (آپلود فیش)' },
  { path: 'physCards.enabled', label: 'کارت فیزیکی مسترکارت' },
  { path: 'virtCards.enabled', label: 'کارت مجازی و کارت سفر' },
  { path: 'ppAcct.enabled', label: 'افتتاح حساب پی‌پال' },
  { path: 'visitorLog.enabled', label: 'ثبت بازدیدکننده‌ها (تلگرام + شمارنده)' },
  { path: 'orderNotify.enabled', label: 'اطلاع‌رسانی سفارش‌ها به تلگرام' }
];
const cfgGet = p => p.split('.').reduce((o, k) => (o == null ? o : o[k]), EFF);
const cfgSet = (p, v) => { const ks = p.split('.'); let o = EFF; for (let i = 0; i < ks.length - 1; i++) { o[ks[i]] = o[ks[i]] || {}; o = o[ks[i]]; } o[ks[ks.length - 1]] = v; };
function plugRender() {
  const box = $('#plugForm');
  if (!box) return;
  const flags = (OV.flags = OV.flags || {});
  const hidden = flags.hideSections || [];
  box.innerHTML =
    '<h3>سکشن‌های سایت</h3>' +
    SECTIONS.map(s => '<label class="plug-row"><input type="checkbox" data-sec="' + s.id + '"' + (!hidden.includes(s.id) ? ' checked' : '') + '> ' + esc(s.label) + ' <small>(' + (hidden.includes(s.id) ? 'خاموش' : 'روشن') + ')</small></label>').join('') +
    '<h3>قابلیت‌ها</h3>' +
    PLUGINS.map(p => '<label class="plug-row"><input type="checkbox" data-plug="' + p.key + '"' + (flags[p.key] !== false ? ' checked' : '') + '> ' + esc(p.label) + '</label>').join('') +
    '<h3>ماژول‌های فروش</h3>' +
    CFG_TOGGLES.map(t => '<label class="plug-row"><input type="checkbox" data-cfg="' + t.path + '"' + (cfgGet(t.path) !== false ? ' checked' : '') + '> ' + esc(t.label) + '</label>').join('');
}
$('#plugForm').addEventListener('change', e => {
  const t = e.target;
  if (t.dataset.sec) {
    const hid = new Set(OV.flags.hideSections || []);
    if (t.checked) hid.delete(t.dataset.sec); else hid.add(t.dataset.sec);
    OV.flags.hideSections = Array.from(hid);
  }
  if (t.dataset.plug) OV.flags[t.dataset.plug] = t.checked ? undefined : false;
  if (t.dataset.cfg) { OV.config = OV.config || {}; cfgSet(t.dataset.cfg, t.checked); }
});
$('#btnPlugSave').addEventListener('click', async () => {
  if (!TOK.get()) { tokenGate(true); return; }
  try {
    /* undefined ها را از flags حذف کن */
    const f = OV.flags = OV.flags || {};
    Object.keys(f).forEach(k => { if (f[k] === undefined) delete f[k]; });
    if (!Object.keys(f).length) delete OV.flags;
    $('#btnPlugSave').disabled = true;
    await saveOv('افزونه‌ها/سکشن‌ها به‌روزرسانی شد');
  } catch (e) { toast('✗ ' + e.message); }
  finally { $('#btnPlugSave').disabled = false; }
});

/* ══════════ ۹) تنظیمات ══════════ */
function setRender() {
  const c = EFF;
  const v = (id, val) => { const el = $('#' + id); if (el) el.value = val == null ? '' : val; };
  v('setEmail', c.email); v('setPhone', c.phoneDisplay); v('setPhoneLink', c.phoneLink);
  v('setTgUser', c.telegram && c.telegram.user); v('setBaleUser', c.bale && c.bale.user);
  v('setCardNum', c.card2card && c.card2card.cardNumber); v('setCardHolder', c.card2card && c.card2card.holder); v('setCardBank', c.card2card && c.card2card.bank);
  v('setMarkup', c.rates && Math.round((c.rates.markup || 0) * 100));
  v('setTgProxy', c.tgProxy);
}
$('#btnSetSave').addEventListener('click', async () => {
  if (!TOK.get()) { tokenGate(true); return; }
  try {
    OV.config = OV.config || {};
    OV.config.email = $('#setEmail').value.trim();
    OV.config.phoneDisplay = $('#setPhone').value.trim();
    OV.config.phoneLink = $('#setPhoneLink').value.trim() || ('tel:' + $('#setPhone').value.replace(/\s/g, ''));
    OV.config.telegram = Object.assign({}, EFF.telegram, { user: $('#setTgUser').value.trim(), url: 'https://t.me/' + $('#setTgUser').value.trim() });
    OV.config.bale = Object.assign({}, EFF.bale, { user: $('#setBaleUser').value.trim(), url: 'https://ble.ir/' + $('#setBaleUser').value.trim() });
    OV.config.card2card = Object.assign({}, EFF.card2card, {
      cardNumber: $('#setCardNum').value.replace(/[^\d]/g, ''),
      holder: $('#setCardHolder').value.trim(),
      bank: $('#setCardBank').value.trim()
    });
    const np = $('#setAdminPw').value;
    if (np) {
      if (np.length < 6) { toast('رمز جدید حداقل ۶ کاراکتر'); return; }
      OV.config.card2card.adminPasswordHash = await sha256(np);
      $('#setAdminPw').value = '';
    }
    OV.config.rates = Object.assign({}, EFF.rates, { markup: (parseFloat($('#setMarkup').value) || 0) / 100 });
    OV.config.tgProxy = $('#setTgProxy').value.trim();
    $('#btnSetSave').disabled = true;
    await saveOv('تنظیمات سایت به‌روزرسانی شد');
  } catch (e) { toast('✗ ' + e.message); }
  finally { $('#btnSetSave').disabled = false; }
});

/* ══════════ ۱۰) JSON پیشرفته ══════════ */
$('#btnJsonFmt').addEventListener('click', () => {
  try { $('#jsonArea').value = JSON.stringify(JSON.parse($('#jsonArea').value || '{}'), null, 2); }
  catch (e) { toast('JSON نامعتبر: ' + e.message); }
});
$('#btnJsonSave').addEventListener('click', async () => {
  if (!TOK.get()) { tokenGate(true); return; }
  try {
    OV = JSON.parse($('#jsonArea').value || '{}');
    $('#btnJsonSave').disabled = true;
    await saveOv('ویرایش پیشرفته JSON');
  } catch (e) { toast('✗ JSON نامعتبر: ' + e.message); }
  finally { $('#btnJsonSave').disabled = false; }
});

/* ══════════ ۱۱) نسخه‌ها و پشتیبان ══════════ */
async function revList() {
  const box = $('#revList');
  if (!TOK.get()) { box.innerHTML = '<div class="empty">برای تاریخچه، توکن گیت‌هاب بدهید.</div>'; return; }
  box.innerHTML = '<div class="empty">در حال خواندن تاریخچه…</div>';
  try {
    const cs = await gh('/repos/' + REPO + '/commits?path=' + OV_PATH + '&per_page=12');
    box.innerHTML = cs.length ? cs.map(c => {
      const d = new Date(c.commit.author.date);
      return '<div class="row"><span class="row-main"><b dir="ltr">' + esc(String(c.sha).slice(0, 7)) + '</b> — ' + esc(c.commit.message.split('\n')[0].slice(0, 70)) + '<small>' + toFa(d.toLocaleDateString('fa-IR')) + ' ' + toFa(d.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })) + '</small></span>' +
        '<button class="btn btn-o btn-sm" data-rev="' + esc(c.sha) + '">بازگردانی</button></div>';
    }).join('') : '<div class="empty">هنوز نسخه‌ای ذخیره نشده — با اولین «انتشار تغییرات» تاریخچه ساخته می‌شود.</div>';
  } catch (e) { box.innerHTML = '<div class="empty">✗ ' + esc(e.message) + '</div>'; }
}
$('#revList').addEventListener('click', async e => {
  const b = e.target.closest('[data-rev]');
  if (!b) return;
  if (!confirm('محتوای overrides به نسخه‌ی انتخاب‌شده برگردد و منتشر شود؟')) return;
  try {
    const j = await gh('/repos/' + REPO + '/contents/' + OV_PATH + '?ref=' + b.dataset.rev);
    OV = parseOv(b64u(j.content || ''));
    await saveOv('بازگردانی نسخه‌ی قبلی (' + String(b.dataset.rev).slice(0, 7) + ')');
    toast('بازگردانی شد ✓');
  } catch (e) { toast('✗ ' + e.message); }
});
$('#btnBackup').addEventListener('click', async () => {
  try {
    const files = {};
    for (const p of ['assets/js/config.js', 'assets/js/data-fa.js', 'assets/js/data-en.js', 'assets/js/data-ar.js', OV_PATH]) {
      try { const j = await gh('/repos/' + REPO + '/contents/' + p + '?ref=' + BR); files[p] = b64u(j.content || ''); } catch (e) {}
    }
    const blob = new Blob([JSON.stringify({ madeAt: new Date().toISOString(), files }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'starshop-backup-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    toast('پشتیبان دانلود شد ✓');
  } catch (e) { toast('✗ ' + e.message); }
});
$('#restoreFile').addEventListener('change', async e => {
  const f = e.target.files && e.target.files[0];
  if (!f) return;
  if (!confirm('فایل‌های داخل پشتیبان جایگزین نسخه‌ی فعلی مخزن شود و منتشر شود؟')) return;
  try {
    const j = JSON.parse(await f.text());
    const files = Object.entries(j.files || {}).map(([path, text]) => ({ path, text }));
    if (!files.length) { toast('پشتیبان خالی است'); return; }
    const res = await commitFiles(files, 'بازگردانی از فایل پشتیبان');
    toast('بازگردانی شد ✓ در حال انتشار…');
    deployStart(res);
  } catch (e) { toast('✗ ' + e.message); }
});

/* ══════════ ۱۲) تب‌ها و شروع ══════════ */
$$('.tab[data-pane]').forEach(t => t.addEventListener('click', () => {
  $$('.tab[data-pane]').forEach(x => x.classList.toggle('on', x === t));
  $$('.pane').forEach(p => { p.hidden = p.id !== 'pane-' + t.dataset.pane; });
  if (t.dataset.pane === 'dash') dashLoad();
  if (t.dataset.pane === 'products') { gamesRender(); cardsRender(); }
  if (t.dataset.pane === 'images') { imgDirFill(); imgGrid(); }
  if (t.dataset.pane === 'plugins') plugRender();
  if (t.dataset.pane === 'settings') setRender();
  if (t.dataset.pane === 'json') $('#jsonArea').value = JSON.stringify(OV, null, 2);
  if (t.dataset.pane === 'rev') revList();
}));

let CMS_READY = false;
async function cmsInit() {
  if (CMS_READY) return;
  CMS_READY = true;
  await loadOv();
  tokenChip();
  dashLoad();
}
function cmsBootIfReady() {
  if (sessionStorage.getItem('ss_admin_ok') === '1' && !CMS_READY) cmsInit();
}
$('#gBtn').addEventListener('click', () => setTimeout(cmsBootIfReady, 250));
$('#gPass').addEventListener('keydown', e => { if (e.key === 'Enter') setTimeout(cmsBootIfReady, 250); });
if (sessionStorage.getItem('ss_admin_ok') === '1') cmsBootIfReady();
})();
