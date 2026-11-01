/* ═══════════════════════════════════════════════════
   STARSHOP — admin-cms.js
   پنل مدیریت کامل (الگوی وردپرس) برای سایت استاتیک گیت‌هاب Pages:
   • همه‌ی تغییرات = کامیت اتمی در مخزن (Git Data API) → Pages خودش ری‌بیلد می‌کند
   • محتوا در site-overrides.js ذخیره می‌شود (روی‌نویسی امن بدون دست‌زدن به فایل‌های اصلی)
   • هر ذخیره = bump خودکار نسخه‌ی sw.js → همه‌ی بازدیدکننده‌ها بلافاصله محتوای تازه می‌گیرند
   • مدیریت تصاویر: آپلود با تبدیل خودکار به webp + حذف — کامیت مستقیم در assets
   • v52 دسترسی کامل: بازی‌ها + کارت‌ها + خدمات فروشگاه + کاتالوگ هوش مصنوعی
     + گیفت کارت‌ها + همه‌ی متن‌های سه‌زبانه (سوالات متداول/نظرات/بخش‌های JSON)
   توکن گیت‌هاب فقط در localStorage همین مرورگر ذخیره می‌شود و هرگز کامیت نمی‌شود.
   ═══════════════════════════════════════════════════ */
(() => {
'use strict';

const REPO = 'pingpixel92/starshop';       /* مخزن ۱ — دامنه قدیمی → starshop.kdns.fr (آینه) */
const REPO2 = 'pingpixel92/STAR-SHOP2';    /* مخزن ۲ — دامنه اصلی → starshop24.ir */
const BR = 'main';
const OV_PATH = 'assets/js/site-overrides.js';
const LIVE = 'https://starshop24.ir/';     /* دامنه اصلی */
const LIVE2 = 'https://starshop.kdns.fr/'; /* دامنه قدیمی (آینه) */
/* خواندن: از مخزن اصلی، اگر نبود از آینه — نوشتن: همیشه هر دو */
let READ_REPO = REPO2;
async function ghRead(suffix, opts = {}) {
  const order = READ_REPO === REPO2 ? [REPO2, REPO] : [REPO, REPO2];
  let lastErr = null;
  for (const rp of order) {
    try { const j = await gh('/repos/' + rp + suffix, opts); READ_REPO = rp; return j; }
    catch (e) { lastErr = e; }
  }
  throw lastErr;
}
const rawBase = () => 'https://raw.githubusercontent.com/' + READ_REPO + '/' + BR + '/';

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

/* کامیت اتمی چندفایلی در یک مخزن + bump خودکار sw.js — الگوی Git Data API */
let BUSY = false;
async function commitToRepo(repo, list, msg) {
  const ref = await gh('/repos/' + repo + '/git/ref/heads/' + BR);
  const headSha = ref.object.sha;
  const c0 = await gh('/repos/' + repo + '/git/commits/' + headSha);
  const entries = [];
  for (const f of list) {
    if (f.del) { entries.push({ path: f.path, mode: '100644', type: 'blob', sha: null }); continue; }
    const b = await gh('/repos/' + repo + '/git/blobs', { method: 'POST', body: JSON.stringify({ content: f.text != null ? u64(f.text) : f.b64, encoding: 'base64' }) });
    entries.push({ path: f.path, mode: f.mode || '100644', type: 'blob', sha: b.sha });
  }
  let tree, commit;
  try {
    tree = await gh('/repos/' + repo + '/git/trees', { method: 'POST', body: JSON.stringify({ base_tree: c0.tree.sha, tree: entries }) });
    commit = await gh('/repos/' + repo + '/git/commits', { method: 'POST', body: JSON.stringify({ message: msg, tree: tree.sha, parents: [headSha] }) });
    await gh('/repos/' + repo + '/git/refs/heads/' + BR, { method: 'PATCH', body: JSON.stringify({ sha: commit.sha, force: false }) });
  } catch (e) {
    if (!/409|is at|Fast-forward/.test(String(e.message))) throw e;
    toast('⚠ تداخل کامیت در ' + repo + ' — دوباره تلاش می‌کنم…');
    const ref2 = await gh('/repos/' + repo + '/git/ref/heads/' + BR);
    const c2 = await gh('/repos/' + repo + '/git/commits/' + ref2.object.sha);
    tree = await gh('/repos/' + repo + '/git/trees', { method: 'POST', body: JSON.stringify({ base_tree: c2.tree.sha, tree: entries }) });
    commit = await gh('/repos/' + repo + '/git/commits', { method: 'POST', body: JSON.stringify({ message: msg, tree: tree.sha, parents: [ref2.object.sha] }) });
    await gh('/repos/' + repo + '/git/refs/heads/' + BR, { method: 'PATCH', body: JSON.stringify({ sha: commit.sha, force: false }) });
  }
  return commit.sha;
}
/* ذخیره = کامیت همزمان در هر دو مخزن (دامنه اصلی + آینه) */
async function commitFiles(files, msg, opts = {}) {
  if (BUSY) throw new Error('یک ذخیره‌سازی در جریان است — کمی صبر کنید');
  BUSY = true;
  try {
    const list = files.slice();
    if (!opts.noVerBump && !list.some(f => f.path === 'sw.js')) {
      try {
        const swj = await ghRead('/contents/sw.js?ref=' + BR);
        const swTxt = b64u(swj.content || '');
        const m = swTxt.match(/const VER = '(\d+)';/);
        if (m) list.push({ path: 'sw.js', text: swTxt.replace("const VER = '" + m[1] + "';", "const VER = '" + String(+m[1] + 1) + "';") });
      } catch (e) { /* بدون bump ادامه بده */ }
    }
    const rs = await Promise.allSettled([commitToRepo(REPO2, list, msg), commitToRepo(REPO, list, msg)]);
    const okB = rs[0].status === 'fulfilled', okA = rs[1].status === 'fulfilled';
    if (!okB && !okA) throw new Error('کامیت در هر دو مخزن شکست خورد: ' + ((rs[0].reason && rs[0].reason.message) || '') + ' / ' + ((rs[1].reason && rs[1].reason.message) || ''));
    if (!okB) toast('⚠ مخزن اصلی (' + REPO2 + '): ' + ((rs[0].reason && rs[0].reason.message) || '') + ' — فقط آینه به‌روز شد');
    if (!okA) toast('⚠ مخزن آینه (' + REPO + '): ' + ((rs[1].reason && rs[1].reason.message) || '') + ' — فقط دامنه اصلی به‌روز شد');
    return { sha: okB ? rs[0].value : rs[1].value, ver: await targetVer(), bothOk: okB && okA };
  } finally { BUSY = false; }
}

/* نسخه‌ی هدف برای poll انتشار = VER فعلی ریپو + ۱ (بعد از bump) */
async function targetVer() {
  try {
    const swj = await ghRead('/contents/sw.js?ref=' + BR);
    const m = (b64u(swj.content || '')).match(/const VER = '(\d+)';/);
    return m ? m[1] : null;
  } catch (e) { return null; }
}

/* انتظار برای انتشار Pages: poll نسخه‌ی زنده هر دو دامنه */
async function waitDeploy(targetVer, ui) {
  const t0 = Date.now();
  const probe = async live => {
    try {
      const r = await fetch(live + 'sw.js?_=' + Date.now(), { cache: 'no-store' });
      const m = (await r.text()).match(/const VER = '(\d+)';/);
      return !!(m && m[1] === String(targetVer));
    } catch (e) { return false; }
  };
  const status = { main: false, mirror: false };
  while (Date.now() - t0 < 6 * 60000) {
    status.main = await probe(LIVE);
    status.mirror = await probe(LIVE2);
    if (ui) ui(Math.min(95, Math.round((Date.now() - t0) / 3600)), status);
    if (status.main && status.mirror) return true;
    await new Promise(r => setTimeout(r, 15000));
  }
  return status.main && status.mirror;
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
"if (O.aiCfg && window.SS_AI_IC) deep(window.SS_AI_IC, O.aiCfg);\n" +
"if (Array.isArray(O.aiTools) && O.aiTools.length) window.SS_AI_TOOLS = O.aiTools;\n" +
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
    const j = await ghRead('/contents/' + OV_PATH + '?ref=' + BR);
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
  waitDeploy(res.ver, (p, st) => {
    let s = 'در حال انتشار… ' + toFa(p) + '٪ (نسخه ' + toFa(res.ver) + ') — اصلی: ' + (st && st.main ? '✓' : '…') + ' · آینه: ' + (st && st.mirror ? '✓' : '…');
    msg.textContent = s;
  }).then(ok => {
    bar.hidden = true;
    toast(ok ? '✅ منتشر شد — هر دو دامنه به‌روز است (نسخه ' + toFa(res.ver) + ')' : '⏳ انتشار کمی طول کشید — بعداً چک کنید');
    if (ok && $('#pane-dash') && !$('#pane-dash').hidden) dashLoad();
  });
}

/* ══════════ ۴) توکن ══════════ */
async function tokenValidate(t) {
  TOK.set(t);
  try {
    const j = await gh('/repos/' + REPO);
    let both = false;
    try { await gh('/repos/' + REPO2); both = true; } catch (e) { both = false; }
    try { localStorage.setItem('ss_gh_login', (j.full_name || REPO) + (both ? ' + آینه ✓' : ' (بدون آینه)')); localStorage.setItem('ss_gh_both', both ? '1' : '0'); } catch (e2) {}
    return both;
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
  let liveVer = '—', mirrorVer = '—';
  try { liveVer = ((await (await fetch(LIVE + 'sw.js?_=' + Date.now(), { cache: 'no-store' })).text()).match(/const VER = '(\d+)';/) || [])[1] || '—'; } catch (e) {}
  try { mirrorVer = ((await (await fetch(LIVE2 + 'sw.js?_=' + Date.now(), { cache: 'no-store' })).text()).match(/const VER = '(\d+)';/) || [])[1] || '—'; } catch (e) {}
  if (el('dVer')) el('dVer').textContent = toFa(liveVer);
  if (el('dMirror')) el('dMirror').textContent = '🔁 آینه (starshop.kdns.fr): ' + toFa(mirrorVer);
  if (TOK.get()) {
    try {
      const rv = await targetVer();
      const rep = el('dRepoVer'); if (rep) rep.textContent = toFa(rv || '—');
      const chip = el('dDeployChip');
      if (chip) { chip.textContent = (rv && liveVer && rv === liveVer) ? '✅ همگام' : '⏳ در حال انتشار'; chip.style.color = (rv && liveVer && rv === liveVer) ? 'var(--ok)' : 'var(--warn)'; }
      const cs = await ghRead('/commits?per_page=5');
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
      '<span class="row-thumb"><img src="' + rawBase() + 'assets/img/games/' + esc(g.img || g.id) + '.webp" alt="" onerror="this.style.visibility=\'hidden\'"></span>' +
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
$('#geSave').addEventListener('click', async () => {
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
  editGame = -1; gamesRender();
  /* v51: انتشار فوری یک‌کلیکی — دیگر «ذخیره پیش‌نویس» نیست؛ مستقیم کامیت در هر دو مخزن می‌شود */
  if (!TOK.get()) { tokenGate(true); toast('ابتدا توکن گیت‌هاب را وارد کنید، بعد ذخیره کنید'); return; }
  try {
    OV.config = OV.config || {};
    OV.config.gameTopups = EFF.gameTopups;
    OV.config.physCards = EFF.physCards;
    OV.config.virtCards = EFF.virtCards;
    OV.config.ppAcct = EFF.ppAcct;
    await saveOv('به‌روزرسانی بازی «' + (g.nf || g.n || g.id) + '» و قیمت‌ها');
  } catch (e) { toast('✗ ' + e.message); }
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
  TREE = await ghRead('/git/trees/' + BR + '?recursive=1');
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
        '<img src="' + rawBase() + esc(f.path) + '?_=' + Date.now() + '" loading="lazy" alt="">' +
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
    const cs = await ghRead('/commits?path=' + OV_PATH + '&per_page=12');
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
    const j = await ghRead('/contents/' + OV_PATH + '?ref=' + b.dataset.rev);
    OV = parseOv(b64u(j.content || ''));
    await saveOv('بازگردانی نسخه‌ی قبلی (' + String(b.dataset.rev).slice(0, 7) + ')');
    toast('بازگردانی شد ✓');
  } catch (e) { toast('✗ ' + e.message); }
});
$('#btnBackup').addEventListener('click', async () => {
  try {
    const files = {};
    for (const p of ['assets/js/config.js', 'assets/js/data-fa.js', 'assets/js/data-en.js', 'assets/js/data-ar.js', OV_PATH]) {
      try { const j = await ghRead('/contents/' + p + '?ref=' + BR); files[p] = b64u(j.content || ''); } catch (e) {}
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

/* ══════════ ۱۳) خدمات فروشگاه — گرید اصلی سایت (v52) ══════════ */
const LG3 = ['fa', 'en', 'ar'];
const LG_NAME = { fa: 'فارسی', en: 'English', ar: 'العربية' };
let SVC = null, SVC_EDIT = -1, SVC_LANG = 'fa';

function svcLoad() {
  SVC = {};
  for (const lg of LG3) {
    const base = (window.SS_DATA[lg] && window.SS_DATA[lg].services) || [];
    const ov = (OV.data && OV.data[lg] && OV.data[lg].services) || null;
    SVC[lg] = clone(ov && ov.length ? ov : base);
  }
}
function svcRender() {
  const box = $('#svcList');
  if (!box) return;
  const cats = (window.SS_DATA.fa && window.SS_DATA.fa.cats) || [];
  $('#svcEditor').hidden = SVC_EDIT < 0;
  box.innerHTML = (SVC.fa || []).map((s, i) => {
    const item = SVC[SVC_LANG][i] || s;
    const cat = cats.find(c => c.id === s.cat);
    return '<div class="row"' + (s.off ? ' style="opacity:.5"' : '') + '>' +
      '<span class="row-thumb" aria-hidden="true"><svg viewBox="0 0 24 24" style="width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:1.8"><use href="#i-' + esc(s.icon || 'spark') + '"/></svg></span>' +
      '<div class="row-main"><b>' + esc(item.title || s.id) + '</b><small dir="ltr">' + esc(s.id) + ' · ' + esc(cat ? cat.label : (s.cat || '')) + (s.off ? ' · مخفی' : '') + '</small></div>' +
      '<span class="row-actions">' +
        '<button class="btn btn-o btn-sm" data-sedit="' + i + '">ویرایش</button>' +
        '<button class="btn btn-o btn-sm" data-sup="' + i + '">↑</button>' +
        '<button class="btn btn-o btn-sm" data-sdn="' + i + '">↓</button>' +
        '<button class="btn btn-o btn-sm" data-soff="' + i + '">' + (s.off ? 'نمایش' : 'مخفی') + '</button>' +
        '<button class="btn btn-r btn-sm" data-sdel="' + i + '">حذف</button>' +
      '</span></div>';
  }).join('') || '<div class="empty">خدمتی نیست</div>';
  if (SVC_EDIT >= 0) svcEditorRender();
}
function svcEditorRender() {
  const s = SVC.fa[SVC_EDIT], t = SVC[SVC_LANG][SVC_EDIT];
  if (!s || !t) { SVC_EDIT = -1; $('#svcEditor').hidden = true; return; }
  $('#seLangLbl').textContent = LG_NAME[SVC_LANG] || SVC_LANG;
  $('#seId').value = s.id || '';
  $('#seCat').innerHTML = ((window.SS_DATA.fa && window.SS_DATA.fa.cats) || []).map(c =>
    '<option value="' + esc(c.id) + '"' + (c.id === s.cat ? ' selected' : '') + '>' + esc(c.label) + '</option>').join('');
  $('#seIcon').value = s.icon || '';
  $('#seTitle').value = t.title || '';
  $('#seDesc').value = t.desc || '';
  $('#seWho').value = t.who || '';
  $('#seSteps').value = (t.steps || []).join('\n');
  $('#seReq').value = (t.req || []).join('\n');
}
$('#svcLang').addEventListener('change', e => {
  if (SVC_EDIT >= 0 && !confirm('تغییر زبان، ویرایشگرِ باز را می‌بندد و تغییرات ذخیره‌نشده‌اش پاک می‌شود. ادامه؟')) { e.target.value = SVC_LANG; return; }
  SVC_LANG = e.target.value; SVC_EDIT = -1; svcRender();
});
$('#btnSvcAdd').addEventListener('click', () => {
  const id = 'svc-' + Date.now().toString(36);
  const seed = { fa: 'خدمت جدید', en: 'New service', ar: 'خدمة جديدة' };
  for (const lg of LG3) SVC[lg].push({ id, cat: 'payments', icon: 'spark', title: seed[lg], desc: '', who: '', steps: [], req: [] });
  SVC_EDIT = SVC.fa.length - 1;
  svcRender();
});
$('#svcList').addEventListener('click', e => {
  const ed = e.target.closest('[data-sedit]'), up = e.target.closest('[data-sup]'), dn = e.target.closest('[data-sdn]'), of = e.target.closest('[data-soff]'), de = e.target.closest('[data-sdel]');
  if (ed) { SVC_EDIT = +ed.dataset.sedit; svcRender(); return; }
  const swap = (i, j) => { for (const lg of LG3) { const a = SVC[lg]; if (a[i] && a[j]) { const tmp = a[i]; a[i] = a[j]; a[j] = tmp; } } };
  if (up) { const i = +up.dataset.sup; if (i > 0) { swap(i, i - 1); if (SVC_EDIT === i) SVC_EDIT = i - 1; else if (SVC_EDIT === i - 1) SVC_EDIT = i; svcRender(); } }
  if (dn) { const i = +dn.dataset.sdn; if (i < SVC.fa.length - 1) { swap(i, i + 1); if (SVC_EDIT === i) SVC_EDIT = i + 1; else if (SVC_EDIT === i + 1) SVC_EDIT = i; svcRender(); } }
  if (of) {
    const i = +of.dataset.soff;
    const hideIt = SVC.fa[i] && SVC.fa[i].off !== true;
    for (const lg of LG3) { const s = SVC[lg][i]; if (!s) continue; if (hideIt) s.off = true; else delete s.off; }
    svcRender();
  }
  if (de) {
    const i = +de.dataset.sdel;
    if (confirm('خدمت «' + ((SVC.fa[i] || {}).id || '') + '» از هر سه زبان حذف شود؟')) {
      if (SVC_EDIT === i) SVC_EDIT = -1; else if (SVC_EDIT > i) SVC_EDIT--;
      for (const lg of LG3) SVC[lg].splice(i, 1);
      svcRender();
    }
  }
});
$('#seSave').addEventListener('click', () => {
  const i = SVC_EDIT; if (i < 0) return;
  const icon = $('#seIcon').value.trim() || 'spark', cat = $('#seCat').value;
  const title = $('#seTitle').value.trim(), desc = $('#seDesc').value.trim(), who = $('#seWho').value.trim();
  const steps = $('#seSteps').value.split('\n').map(x => x.trim()).filter(Boolean);
  const req = $('#seReq').value.split('\n').map(x => x.trim()).filter(Boolean);
  for (const lg of LG3) {
    const s = SVC[lg][i]; if (!s) continue;
    s.icon = icon; s.cat = cat;
    if (lg === SVC_LANG) {
      if (title) s.title = title;
      s.desc = desc; s.who = who; s.steps = steps; s.req = req;
    }
  }
  SVC_EDIT = -1; svcRender();
  toast('خدمت ذخیره شد — برای اعمال روی سایت، «انتشار تغییرات» را بزنید');
});
$('#seCancel').addEventListener('click', () => { SVC_EDIT = -1; svcRender(); });
$('#btnSvcSave').addEventListener('click', async () => {
  if (!TOK.get()) { tokenGate(true); return; }
  try {
    OV.data = OV.data || {};
    for (const lg of LG3) { OV.data[lg] = OV.data[lg] || {}; OV.data[lg].services = SVC[lg]; }
    $('#btnSvcSave').disabled = true;
    await saveOv('خدمات فروشگاه به‌روزرسانی شد');
    svcLoad(); svcRender();
  } catch (e) { toast('✗ ' + e.message); }
  finally { $('#btnSvcSave').disabled = false; }
});

/* ══════════ ۱۴) فروشگاه هوش مصنوعی — کاتالوگ کامل (v52) ══════════ */
let AI = null, AI_EDIT = -1, AI_NEW = false;
function aiLoad() {
  AI = clone(Array.isArray(OV.aiTools) && OV.aiTools.length ? OV.aiTools : (window.SS_AI_TOOLS || []));
  const ic = Object.assign({}, window.SS_AI_IC || {}, OV.aiCfg || {});
  $('#aiPremium').value = ic.premiumToman != null ? ic.premiumToman : '';
  $('#aiUnit').value = ic.unitRial != null ? ic.unitRial : '';
}
function aiRender() {
  const box = $('#aiList');
  if (!box) return;
  const HEAD = { text: '📝 تولید محتوای متنی', av: '🎨 تولید محتوای صوتی و تصویری', code: '💻 برنامه‌نویسی و API' };
  let html = '';
  for (const ck of ['text', 'av', 'code']) {
    const rows = AI.map((x, i) => ({ x, i })).filter(o => (o.x.cat || 'text') === ck).map(o => {
      const x = o.x, i = o.i;
      return '<div class="row"' + (x.avail === false ? ' style="opacity:.5"' : '') + '>' +
        '<span class="row-thumb"><img src="' + rawBase() + 'assets/logos/ai/' + esc(x.id) + '.webp" alt="" loading="lazy" onerror="this.style.visibility=\'hidden\'"></span>' +
        '<div class="row-main"><b>' + esc((x.n && (x.n.fa || x.n.en)) || x.t) + '</b><small dir="ltr">' + esc(x.id) + ' · ' + (x.custom ? 'custom' : ((x.plans || []).length) + ' plan') + (x.avail === false ? ' · ناموجود' : '') + '</small></div>' +
        '<span class="row-actions">' +
          '<button class="btn btn-o btn-sm" data-aedit="' + i + '">ویرایش</button>' +
          '<button class="btn btn-o btn-sm" data-aup="' + i + '">↑</button>' +
          '<button class="btn btn-o btn-sm" data-adn="' + i + '">↓</button>' +
          '<button class="btn btn-r btn-sm" data-adel="' + i + '">حذف</button>' +
        '</span></div>';
    }).join('');
    html += '<div class="grp-h">' + (HEAD[ck] || ck) + ' <small>' + toFa(AI.filter(x => (x.cat || 'text') === ck).length) + ' سرویس</small></div>' + (rows || '<div class="empty">—</div>');
  }
  box.innerHTML = html;
  $('#aiEditor').hidden = AI_EDIT < 0;
  if (AI_EDIT >= 0) aiEditorRender();
}
function aiEditorRender() {
  const x = AI[AI_EDIT];
  if (!x) { AI_EDIT = -1; $('#aiEditor').hidden = true; return; }
  $('#aeId').value = x.id || '';
  $('#aeId').disabled = !AI_NEW;
  $('#aeT').value = x.t || '';
  $('#aeNfa').value = (x.n && x.n.fa) || '';
  $('#aeNen').value = (x.n && x.n.en) || '';
  $('#aeNar').value = (x.n && x.n.ar) || '';
  $('#aeCat').value = x.cat || 'text';
  $('#aeCustom').checked = x.custom === true;
  $('#aeTopup').checked = x.topup === true;
  $('#aeUser').checked = !!(x.flds && x.flds.indexOf('user') >= 0);
  $('#aePw').checked = !!(x.flds && x.flds.indexOf('pw') >= 0);
  $('#aeOff').checked = x.avail === false;
  $('#aePlans').innerHTML = (x.plans || []).map((p, j) =>
    '<div class="pack-row" style="grid-template-columns:1.2fr 1.2fr 110px 40px">' +
      '<input data-apn="' + j + '" value="' + esc(p.n) + '" placeholder="Plan name" dir="ltr">' +
      '<input data-apnf="' + j + '" value="' + esc(p.nf || '') + '" placeholder="نام فارسی">' +
      '<input data-ausd="' + j + '" value="' + esc(p.usd) + '" placeholder="دلار" dir="ltr" inputmode="decimal">' +
      '<button type="button" class="btn btn-r btn-sm" data-apdel="' + j + '">✕</button></div>'
  ).join('') || '<div class="empty" style="padding:10px">پلنی ثبت نشده — سفارش «مبلغ دلخواه (custom)» می‌شود</div>';
}
$('#btnAIAdd').addEventListener('click', () => {
  AI.push({ id: 'new-ai', t: 'New AI', n: { fa: 'سرویس جدید', en: 'New AI', ar: 'سرویس جدید' }, cat: 'text', custom: true });
  AI_EDIT = AI.length - 1; AI_NEW = true;
  aiRender();
});
$('#aiList').addEventListener('click', e => {
  const ed = e.target.closest('[data-aedit]'), up = e.target.closest('[data-aup]'), dn = e.target.closest('[data-adn]'), de = e.target.closest('[data-adel]');
  if (ed) { AI_EDIT = +ed.dataset.aedit; AI_NEW = false; aiRender(); return; }
  if (up) { const i = +up.dataset.aup; if (i > 0) { const t = AI[i]; AI[i] = AI[i - 1]; AI[i - 1] = t; if (AI_EDIT === i) AI_EDIT = i - 1; else if (AI_EDIT === i - 1) AI_EDIT = i; aiRender(); } }
  if (dn) { const i = +dn.dataset.adn; if (i < AI.length - 1) { const t = AI[i]; AI[i] = AI[i + 1]; AI[i + 1] = t; if (AI_EDIT === i) AI_EDIT = i + 1; else if (AI_EDIT === i + 1) AI_EDIT = i; aiRender(); } }
  if (de) {
    const i = +de.dataset.adel;
    if (confirm('سرویس «' + (AI[i].t || AI[i].id) + '» حذف شود؟')) {
      if (AI_EDIT === i) AI_EDIT = -1; else if (AI_EDIT > i) AI_EDIT--;
      AI.splice(i, 1);
      aiRender();
    }
  }
});
$('#aeAddPlan').addEventListener('click', () => {
  const x = AI[AI_EDIT]; if (!x) return;
  x.plans = x.plans || [];
  x.plans.push({ n: 'New Plan', nf: 'پلن جدید', usd: 9.99 });
  aiEditorRender();
});
$('#aePlans').addEventListener('click', e => {
  const de = e.target.closest('[data-apdel]');
  if (!de) return;
  const x = AI[AI_EDIT]; if (!x) return;
  x.plans.splice(+de.dataset.apdel, 1);
  aiEditorRender();
});
$('#aeSave').addEventListener('click', () => {
  const x = AI[AI_EDIT]; if (!x) return;
  if (AI_NEW) {
    const nid = $('#aeId').value.trim().replace(/[^a-z0-9\-]/gi, '-').toLowerCase() || 'new-ai';
    if (AI.some((o, i) => i !== AI_EDIT && o.id === nid)) { toast('این شناسه قبلاً استفاده شده — دیگری انتخاب کنید'); return; }
    x.id = nid; AI_NEW = false;
  }
  x.t = $('#aeT').value.trim() || x.t;
  x.n = { fa: $('#aeNfa').value.trim() || x.t, en: $('#aeNen').value.trim() || x.t, ar: $('#aeNar').value.trim() || x.t };
  x.cat = $('#aeCat').value;
  if ($('#aeCustom').checked) x.custom = true; else delete x.custom;
  if ($('#aeTopup').checked) x.topup = true; else delete x.topup;
  const f = [];
  if ($('#aeUser').checked) f.push('user');
  if ($('#aePw').checked) f.push('pw');
  if (f.length) x.flds = f; else delete x.flds;
  if ($('#aeOff').checked) x.avail = false; else delete x.avail;
  const plans = [];
  $$('#aePlans input').forEach(inp => {
    if (inp.dataset.apn != null) { const j = +inp.dataset.apn; plans[j] = plans[j] || {}; plans[j].n = inp.value.trim(); }
    else if (inp.dataset.apnf != null) { const j = +inp.dataset.apnf; plans[j] = plans[j] || {}; plans[j].nf = inp.value.trim(); }
    else if (inp.dataset.ausd != null) { const j = +inp.dataset.ausd; plans[j] = plans[j] || {}; plans[j].usd = parseFloat(String(inp.value).replace(/[^\d.]/g, '')) || 0; }
  });
  const pl = plans.filter(Boolean).map(p => { const q = { n: p.n || 'Plan' }; if (p.nf) q.nf = p.nf; q.usd = p.usd || 0; return q; });
  if (pl.length) x.plans = pl; else { delete x.plans; if (!x.custom) { x.custom = true; $('#aeCustom').checked = true; toast('بدون پلن = حالت «سفارشی» فعال شد'); } }
  AI_EDIT = -1; aiRender();
  toast('سرویس ذخیره شد — برای اعمال روی سایت، «انتشار تغییرات» را بزنید');
});
$('#aeCancel').addEventListener('click', () => { AI_EDIT = -1; AI_NEW = false; aiRender(); });
$('#btnAISave').addEventListener('click', async () => {
  if (!TOK.get()) { tokenGate(true); return; }
  try {
    const seen = {};
    for (const x of AI) { if (seen[x.id]) { toast('شناسه تکراری: ' + x.id); return; } seen[x.id] = 1; }
    OV.aiTools = AI;
    const ic = Object.assign({}, window.SS_AI_IC || {}, OV.aiCfg || {});
    ic.premiumToman = parseFloat(String($('#aiPremium').value).replace(/[^\d]/g, '')) || 0;
    ic.unitRial = parseFloat(String($('#aiUnit').value).replace(/[^\d]/g, '')) || ic.unitRial || 2334000;
    OV.aiCfg = ic;
    $('#btnAISave').disabled = true;
    await saveOv('فروشگاه هوش مصنوعی به‌روزرسانی شد');
    aiLoad(); aiRender();
  } catch (e) { toast('✗ ' + e.message); }
  finally { $('#btnAISave').disabled = false; }
});

/* ══════════ ۱۵) گیفت کارت‌ها — مدیریت کامل (v52) ══════════ */
let GIFT = null, GIFT_EDIT = -1, GIFT_LANG = 'fa';
function giftLoad() {
  GIFT = {};
  for (const lg of LG3) {
    const base = (window.SS_DATA[lg] && window.SS_DATA[lg].gifts) || [];
    const ov = (OV.data && OV.data[lg] && OV.data[lg].gifts) || null;
    GIFT[lg] = clone(ov && ov.length ? ov : base);
  }
}
function giftRender() {
  const box = $('#giftsList');
  if (!box) return;
  $('#giftEditor').hidden = GIFT_EDIT < 0;
  box.innerHTML = (GIFT.fa || []).map((g, i) => {
    const item = GIFT[GIFT_LANG][i] || g;
    const range = g.type === 'months'
      ? (g.monthOpts && g.monthOpts.length ? g.monthOpts.join('/') + ' ماه' : ((g.minM || 1) + '–' + (g.maxM || 12) + ' ماه'))
      : ('$' + g.min + ' تا $' + g.max);
    return '<div class="row"' + (g.off ? ' style="opacity:.5"' : '') + '>' +
      '<span class="row-thumb"><img src="assets/logos/' + esc(g.logo || 'steam-w') + '.svg" alt="" loading="lazy" onerror="this.style.visibility=\'hidden\'"></span>' +
      '<div class="row-main"><b>' + esc(item.t || g.id) + '</b><small dir="ltr">' + esc(g.id) + ' · ' + esc(range) + ' · ' + toFa((g.regions || []).length) + ' ریجن' + (g.off ? ' · مخفی' : '') + '</small></div>' +
      '<span class="row-actions">' +
        '<button class="btn btn-o btn-sm" data-gfedit="' + i + '">ویرایش</button>' +
        '<button class="btn btn-o btn-sm" data-gfup="' + i + '">↑</button>' +
        '<button class="btn btn-o btn-sm" data-gfdn="' + i + '">↓</button>' +
        '<button class="btn btn-o btn-sm" data-gfoff="' + i + '">' + (g.off ? 'نمایش' : 'مخفی') + '</button>' +
        '<button class="btn btn-r btn-sm" data-gfdel="' + i + '">حذف</button>' +
      '</span></div>';
  }).join('') || '<div class="empty">گیفت کارتی نیست</div>';
  if (GIFT_EDIT >= 0) giftEditorRender();
}
function giftEditorRender() {
  const gf = GIFT.fa[GIFT_EDIT], g = GIFT[GIFT_LANG][GIFT_EDIT];
  if (!gf || !g) { GIFT_EDIT = -1; $('#giftEditor').hidden = true; return; }
  $('#gfeLangLbl').textContent = LG_NAME[GIFT_LANG] || GIFT_LANG;
  $('#gfeId').value = gf.id || '';
  $('#gfeT').value = g.t || gf.t || '';
  $('#gfeLogo').value = gf.logo || '';
  $('#gfeD').value = g.d || '';
  $('#gfeType').value = gf.type === 'months' ? 'months' : 'amount';
  $('#gfeAmountBox').hidden = gf.type === 'months';
  $('#gfeMonthsBox').hidden = gf.type !== 'months';
  $('#gfeMin').value = gf.min != null ? gf.min : '';
  $('#gfeMax').value = gf.max != null ? gf.max : '';
  $('#gfeStep').value = gf.step != null ? gf.step : '';
  $('#gfePresets').value = (gf.presets || []).join(', ');
  $('#gfeMinM').value = gf.minM != null ? gf.minM : '';
  $('#gfeMaxM').value = gf.maxM != null ? gf.maxM : '';
  $('#gfeMonthOpts').value = (gf.monthOpts || []).join(', ');
  $('#gfeRegions').innerHTML = (g.regions || []).map((r, ri) =>
    '<div class="pack-row" style="grid-template-columns:64px 76px 1fr 40px">' +
      '<input data-rf="flag" data-ri="' + ri + '" value="' + esc(r.flag) + '" placeholder="🇺🇸" title="پرچم (ایموجی)">' +
      '<input data-rf="cur" data-ri="' + ri + '" value="' + esc(r.cur) + '" dir="ltr" placeholder="USD" title="ارز ریجن">' +
      '<input data-rf="label" data-ri="' + ri + '" value="' + esc(r.label) + '" placeholder="نام کشور — زبان ' + GIFT_LANG + '">' +
      '<input type="hidden" data-rf="id" data-ri="' + ri + '" value="' + esc(r.id) + '">' +
      '<button type="button" class="btn btn-r btn-sm" data-regdel="' + ri + '">✕</button></div>'
  ).join('');
}
function gfeTypeToggle() {
  const m = $('#gfeType').value === 'months';
  $('#gfeAmountBox').hidden = m;
  $('#gfeMonthsBox').hidden = !m;
}
$('#gfeType').addEventListener('change', gfeTypeToggle);
$('#giftLang').addEventListener('change', e => {
  if (GIFT_EDIT >= 0 && !confirm('تغییر زبان، ویرایشگرِ باز را می‌بندد و تغییرات ذخیره‌نشده‌اش پاک می‌شود. ادامه؟')) { e.target.value = GIFT_LANG; return; }
  GIFT_LANG = e.target.value; GIFT_EDIT = -1; giftRender();
});
$('#btnGiftAdd').addEventListener('click', () => {
  const id = 'gift-' + Date.now().toString(36);
  const seed = {
    fa: { t: 'گیفت کارت جدید', d: 'توضیح کوتاه', regions: [{ id: 'us', flag: '🇺🇸', label: 'آمریکا', cur: 'USD' }] },
    en: { t: 'New Gift Card', d: 'Short description', regions: [{ id: 'us', flag: '🇺🇸', label: 'United States', cur: 'USD' }] },
    ar: { t: 'بطاقة هدية جديدة', d: 'وصف قصير', regions: [{ id: 'us', flag: '🇺🇸', label: 'الولايات المتحدة', cur: 'USD' }] }
  };
  for (const lg of LG3) GIFT[lg].push(Object.assign({ id, logo: 'steam-w', type: 'amount', min: 5, max: 100, step: 5, presets: [5, 10, 25, 50, 100] }, seed[lg]));
  GIFT_EDIT = GIFT.fa.length - 1;
  giftRender();
});
$('#giftsList').addEventListener('click', e => {
  const ed = e.target.closest('[data-gfedit]'), up = e.target.closest('[data-gfup]'), dn = e.target.closest('[data-gfdn]'), of = e.target.closest('[data-gfoff]'), de = e.target.closest('[data-gfdel]');
  if (ed) { GIFT_EDIT = +ed.dataset.gfedit; giftRender(); return; }
  const swap = (i, j) => { for (const lg of LG3) { const a = GIFT[lg]; if (a[i] && a[j]) { const tmp = a[i]; a[i] = a[j]; a[j] = tmp; } } };
  if (up) { const i = +up.dataset.gfup; if (i > 0) { swap(i, i - 1); if (GIFT_EDIT === i) GIFT_EDIT = i - 1; else if (GIFT_EDIT === i - 1) GIFT_EDIT = i; giftRender(); } }
  if (dn) { const i = +dn.dataset.gfdn; if (i < GIFT.fa.length - 1) { swap(i, i + 1); if (GIFT_EDIT === i) GIFT_EDIT = i + 1; else if (GIFT_EDIT === i + 1) GIFT_EDIT = i; giftRender(); } }
  if (of) {
    const i = +of.dataset.gfoff;
    const hideIt = GIFT.fa[i] && GIFT.fa[i].off !== true;
    for (const lg of LG3) { const g = GIFT[lg][i]; if (!g) continue; if (hideIt) g.off = true; else delete g.off; }
    giftRender();
  }
  if (de) {
    const i = +de.dataset.gfdel;
    if (confirm('گیفت کارت «' + ((GIFT.fa[i] || {}).id || '') + '» از هر سه زبان حذف شود؟')) {
      if (GIFT_EDIT === i) GIFT_EDIT = -1; else if (GIFT_EDIT > i) GIFT_EDIT--;
      for (const lg of LG3) GIFT[lg].splice(i, 1);
      giftRender();
    }
  }
});
$('#gfeAddReg').addEventListener('click', () => {
  const box = $('#gfeRegions');
  const ri = box.querySelectorAll('.pack-row').length;
  const div = document.createElement('div');
  div.className = 'pack-row';
  div.style.gridTemplateColumns = '64px 76px 1fr 40px';
  div.innerHTML =
    '<input data-rf="flag" data-ri="' + ri + '" value="🏳️" title="پرچم (ایموجی)">' +
    '<input data-rf="cur" data-ri="' + ri + '" value="USD" dir="ltr" title="ارز ریجن">' +
    '<input data-rf="label" data-ri="' + ri + '" value="" placeholder="نام کشور — زبان ' + GIFT_LANG + '">' +
    '<input type="hidden" data-rf="id" data-ri="' + ri + '" value="">' +
    '<button type="button" class="btn btn-r btn-sm" data-regdel="' + ri + '">✕</button>';
  box.appendChild(div);
});
$('#gfeRegions').addEventListener('click', e => {
  const de = e.target.closest('[data-regdel]');
  if (de) de.closest('.pack-row').remove();
});
$('#gfeSave').addEventListener('click', () => {
  const gi = GIFT_EDIT; if (gi < 0) return;
  const type = $('#gfeType').value === 'months' ? 'months' : 'amount';
  const logo = $('#gfeLogo').value.trim() || 'steam-w';
  const t = $('#gfeT').value.trim();
  const d = $('#gfeD').value.trim();
  const rows = $$('#gfeRegions .pack-row').map((row, ri) => {
    const get = f => { const el = row.querySelector('[data-rf="' + f + '"]'); return el ? el.value.trim() : ''; };
    return { id: get('id') || get('cur').toLowerCase() || ('r' + (ri + 1)), flag: get('flag') || '🏳️', cur: (get('cur') || 'USD').toUpperCase(), label: get('label') };
  });
  const ids = {};
  for (const r of rows) { if (ids[r.id]) { toast('شناسه ریجن تکراری: ' + r.id); return; } ids[r.id] = 1; }
  const num = (sel, fb) => { const v = parseFloat(String($(sel).value).replace(/[^\d.]/g, '')); return isNaN(v) ? fb : v; };
  for (const lg of LG3) {
    const g = GIFT[lg][gi]; if (!g) continue;
    g.type = type; g.logo = logo;
    if (t) g.t = t;
    if (type === 'amount') {
      g.min = num('#gfeMin', 1); g.max = num('#gfeMax', 100); g.step = num('#gfeStep', 1);
      const pr = $('#gfePresets').value.split(/[,\s،]+/).map(x => parseFloat(String(x).replace(/[^\d.]/g, ''))).filter(v => v > 0);
      if (pr.length) g.presets = pr; else delete g.presets;
      delete g.minM; delete g.maxM; delete g.monthOpts;
    } else {
      const mm = $('#gfeMinM').value.trim(), mx = $('#gfeMaxM').value.trim();
      if (mm) g.minM = parseInt(mm, 10); else delete g.minM;
      if (mx) g.maxM = parseInt(mx, 10); else delete g.maxM;
      const mo = $('#gfeMonthOpts').value.split(/[,\s،]+/).map(x => parseInt(x, 10)).filter(v => v > 0);
      if (mo.length) g.monthOpts = mo; else { delete g.monthOpts; if (g.minM == null) g.minM = 1; if (g.maxM == null) g.maxM = 12; }
      delete g.min; delete g.max; delete g.step; delete g.presets;
    }
    /* ریجن: ساختار از زبان جاری؛ لیبل زبان‌های دیگر حفظ می‌شود (هم‌اندیس) */
    g.regions = rows.map((r, ri) => {
      const old = (g.regions || [])[ri];
      const label = (lg === GIFT_LANG) ? (r.label || (old && old.label) || r.id) : ((old && old.label) || r.id);
      return { id: r.id, flag: r.flag, cur: r.cur, label };
    });
  }
  GIFT_EDIT = -1; giftRender();
  toast('کارت ذخیره شد — برای اعمال روی سایت، «انتشار تغییرات» را بزنید');
});
$('#gfeCancel').addEventListener('click', () => { GIFT_EDIT = -1; giftRender(); });
$('#btnGiftSave').addEventListener('click', async () => {
  if (!TOK.get()) { tokenGate(true); return; }
  try {
    OV.data = OV.data || {};
    for (const lg of LG3) { OV.data[lg] = OV.data[lg] || {}; OV.data[lg].gifts = GIFT[lg]; }
    $('#btnGiftSave').disabled = true;
    await saveOv('گیفت کارت‌ها به‌روزرسانی شد');
    giftLoad(); giftRender();
  } catch (e) { toast('✗ ' + e.message); }
  finally { $('#btnGiftSave').disabled = false; }
});

/* ══════════ ۱۶) متن‌های سایت — همه‌ی متن‌ها + سوالات متداول + نظرات + بخش‌های JSON (v52) ══════════ */
let TXT_LANG = 'fa', TXT_SECTION = 'ui';
const TXT_DIRTY = { fa: new Set(), en: new Set(), ar: new Set() };
const TXT_VALS = { fa: {}, en: {}, ar: {} };
let TXT_WORK = { faq: null, tst: null };
const txtBaseUI = lg => (window.SS_DATA[lg] && window.SS_DATA[lg].ui) || {};
const txtOvUI = lg => (OV.data && OV.data[lg] && OV.data[lg].ui) || {};
const txtEffUI = lg => Object.assign({}, txtBaseUI(lg), txtOvUI(lg));
const txtEffArr = (lg, key) => {
  const ov = OV.data && OV.data[lg] && OV.data[lg][key];
  if (Array.isArray(ov)) return ov;
  return (window.SS_DATA[lg] && window.SS_DATA[lg][key]) || [];
};
function txtDirtyCount() { return TXT_DIRTY[TXT_LANG].size; }
function txtChip() { const el = $('#txtDirtyChip'); if (el) el.textContent = toFa(txtDirtyCount()) + ' تغییر ذخیره‌نشده (زبان ' + (LG_NAME[TXT_LANG] || '') + ')'; }
function txtRender() {
  const box = $('#txtList'), jb = $('#txtJsonBox');
  if (!box) return;
  const isJson = TXT_SECTION === '__json';
  jb.hidden = !isJson;
  $('#txtSearchWrap').style.display = TXT_SECTION === 'ui' ? '' : 'none';
  $('#btnTxtSave').style.display = isJson ? 'none' : '';
  if (isJson) { txtJsonRender(); box.innerHTML = ''; return; }
  if (TXT_SECTION === 'faq') { txtFaqRender(); return; }
  if (TXT_SECTION === 'testimonials') { txtTstRender(); return; }
  const q = ($('#txtSearch').value || '').trim().toLowerCase();
  const eff = txtEffUI(TXT_LANG);
  const keys = Object.keys(eff).filter(k => !q || k.toLowerCase().includes(q) || String(eff[k]).toLowerCase().includes(q)).slice(0, 250);
  box.innerHTML = keys.map(k => {
    const dirty = TXT_DIRTY[TXT_LANG].has(k);
    const val = dirty && TXT_VALS[TXT_LANG][k] != null ? TXT_VALS[TXT_LANG][k] : eff[k];
    return '<div class="row" style="align-items:flex-start;flex-wrap:wrap">' +
      '<div class="row-main" style="min-width:220px"><b style="font-weight:400;font-size:13.5px">' + esc(val) + '</b><small dir="ltr">' + esc(k) + '</small></div>' +
      '<input data-txtkey="' + esc(k) + '" value="' + esc(val) + '" style="flex:1.1;min-width:220px;border:1.5px solid var(--line);border-radius:10px;background:var(--bg);color:var(--ink);padding:8px 10px;font-family:var(--font);font-size:13px"' + (dirty ? ' class="dirty"' : '') + '>' +
    '</div>';
  }).join('') || '<div class="empty">موردی یافت نشد</div>';
}
$('#txtList').addEventListener('input', e => {
  const k = e.target.dataset && e.target.dataset.txtkey;
  if (!k) return;
  TXT_VALS[TXT_LANG][k] = e.target.value;
  const orig = txtOvUI(TXT_LANG)[k] != null ? txtOvUI(TXT_LANG)[k] : txtBaseUI(TXT_LANG)[k];
  if (e.target.value === String(orig == null ? '' : orig)) TXT_DIRTY[TXT_LANG].delete(k); else TXT_DIRTY[TXT_LANG].add(k);
  e.target.classList.toggle('dirty', TXT_DIRTY[TXT_LANG].has(k));
  txtChip();
});
$('#txtLang').addEventListener('change', e => {
  if ((TXT_DIRTY[TXT_LANG].size || TXT_SECTION !== 'ui') && !confirm('تغییر زبان — تغییرات ذخیره‌نشده‌ی متنِ زبان جاری در همین صفحه می‌ماند و بعداً می‌توانید برگردید. ادامه؟')) { e.target.value = TXT_LANG; return; }
  TXT_LANG = e.target.value;
  TXT_WORK = { faq: null, tst: null };
  txtRender();
});
$('#txtSection').addEventListener('change', e => { TXT_SECTION = e.target.value; txtRender(); });
$('#txtSearch').addEventListener('input', () => { if (TXT_SECTION === 'ui') txtRender(); });
$('#btnTxtSave').addEventListener('click', async () => {
  if (!TOK.get()) { tokenGate(true); return; }
  try {
    OV.data = OV.data || {}; OV.data[TXT_LANG] = OV.data[TXT_LANG] || {};
    if (TXT_SECTION === 'ui') {
      const d = TXT_DIRTY[TXT_LANG];
      if (!d.size) { toast('تغییری برای ذخیره نیست'); return; }
      OV.data[TXT_LANG].ui = Object.assign({}, OV.data[TXT_LANG].ui || {});
      d.forEach(k => { OV.data[TXT_LANG].ui[k] = TXT_VALS[TXT_LANG][k] != null ? TXT_VALS[TXT_LANG][k] : ($('#txtList [data-txtkey="' + k + '"]') || {}).value || ''; });
    } else if (TXT_SECTION === 'faq') {
      txtFaqCollect();
      OV.data[TXT_LANG].faq = TXT_WORK.faq;
    } else if (TXT_SECTION === 'testimonials') {
      txtTstCollect();
      OV.data[TXT_LANG].testimonials = TXT_WORK.tst;
    } else return;
    $('#btnTxtSave').disabled = true;
    await saveOv('متن‌های سایت (' + (LG_NAME[TXT_LANG] || TXT_LANG) + ' — ' + TXT_SECTION + ') به‌روزرسانی شد');
    if (TXT_SECTION === 'ui') { TXT_DIRTY[TXT_LANG] = new Set(); TXT_VALS[TXT_LANG] = {}; }
    txtRender();
  } catch (e) { toast('✗ ' + e.message); }
  finally { $('#btnTxtSave').disabled = false; }
});
/* ── سوالات متداول ── */
function txtFaqRender() {
  if (!TXT_WORK.faq) TXT_WORK.faq = clone(txtEffArr(TXT_LANG, 'faq'));
  $('#txtList').innerHTML = TXT_WORK.faq.map((f, i) =>
    '<div class="card-block"><div class="f2">' +
      '<label class="fld"><span>سوال ' + toFa(i + 1) + '</span><input data-fq="' + i + '" value="' + esc(f.q) + '"></label>' +
      '<label class="fld"><span>پاسخ ' + toFa(i + 1) + '</span><textarea data-fans="' + i + '" rows="3" class="ed-ta">' + esc(f.a) + '</textarea></label>' +
    '</div><button class="btn btn-r btn-sm" data-fdel="' + i + '">حذف این سوال</button></div>'
  ).join('') + '<button class="btn btn-o" id="btnFaqAdd" type="button">➕ سوال جدید</button>';
}
function txtFaqCollect() {
  const arr = TXT_WORK.faq || [];
  $$('#txtList [data-fq]').forEach(inp => { const i = +inp.dataset.fq; if (arr[i]) arr[i].q = inp.value; });
  $$('#txtList [data-fans]').forEach(inp => { const i = +inp.dataset.fans; if (arr[i]) arr[i].a = inp.value; });
  TXT_WORK.faq = arr;
}
$('#txtList').addEventListener('click', async e => {
  const fa = e.target.closest('#btnFaqAdd'), fdel = e.target.closest('[data-fdel]');
  const ta = e.target.closest('#btnTstAdd'), tdel = e.target.closest('[data-tdel]');
  if (fa) { txtFaqCollect(); TXT_WORK.faq.push({ q: 'سوال جدید', a: 'پاسخ' }); txtFaqRender(); }
  if (fdel) { txtFaqCollect(); TXT_WORK.faq.splice(+fdel.dataset.fdel, 1); txtFaqRender(); }
  if (ta) { txtTstCollect(); TXT_WORK.tst.push({ t: 'موضوع جدید', q: 'متن نظر' }); txtTstRender(); }
  if (tdel) { txtTstCollect(); TXT_WORK.tst.splice(+tdel.dataset.tdel, 1); txtTstRender(); }
});
/* ── نظرات مشتریان ── */
function txtTstRender() {
  if (!TXT_WORK.tst) TXT_WORK.tst = clone(txtEffArr(TXT_LANG, 'testimonials'));
  $('#txtList').innerHTML = TXT_WORK.tst.map((f, i) =>
    '<div class="card-block"><div class="f2">' +
      '<label class="fld"><span>موضوع ' + toFa(i + 1) + '</span><input data-tt="' + i + '" value="' + esc(f.t) + '"></label>' +
      '<label class="fld"><span>متن نظر ' + toFa(i + 1) + '</span><textarea data-tq="' + i + '" rows="3" class="ed-ta">' + esc(f.q) + '</textarea></label>' +
    '</div><button class="btn btn-r btn-sm" data-tdel="' + i + '">حذف این نظر</button></div>'
  ).join('') + '<button class="btn btn-o" id="btnTstAdd" type="button">➕ نظر جدید</button>';
}
function txtTstCollect() {
  const arr = TXT_WORK.tst || [];
  $$('#txtList [data-tt]').forEach(inp => { const i = +inp.dataset.tt; if (arr[i]) arr[i].t = inp.value; });
  $$('#txtList [data-tq]').forEach(inp => { const i = +inp.dataset.tq; if (arr[i]) arr[i].q = inp.value; });
  TXT_WORK.tst = arr;
}
/* ── بخش‌های JSON ── */
const TXT_JSON_SKIP = { ui: 1, faq: 1, testimonials: 1, gifts: 1, services: 1, meta: 1 };
function txtJsonRender() {
  const sel = $('#txtJsonSec');
  const keys = Object.keys(window.SS_DATA[TXT_LANG] || {}).filter(k => !TXT_JSON_SKIP[k]);
  const cur = sel.value;
  sel.innerHTML = keys.map(k => '<option value="' + esc(k) + '">' + esc(k) + '</option>').join('');
  if (cur && keys.includes(cur)) sel.value = cur;
  txtJsonFill();
}
function txtJsonFill() {
  const k = $('#txtJsonSec').value;
  const ov = OV.data && OV.data[TXT_LANG] && OV.data[TXT_LANG][k];
  const eff = ov != null ? ov : (window.SS_DATA[TXT_LANG] || {})[k];
  $('#txtJsonArea').value = JSON.stringify(eff, null, 2);
}
$('#txtJsonSec').addEventListener('change', txtJsonFill);
$('#txtJsonReload').addEventListener('click', () => { txtJsonFill(); toast('بازخوانی شد'); });
$('#btnTxtJsonSave').addEventListener('click', async () => {
  if (!TOK.get()) { tokenGate(true); return; }
  let val;
  try { val = JSON.parse($('#txtJsonArea').value || 'null'); }
  catch (e) { toast('✗ JSON نامعتبر: ' + e.message); return; }
  try {
    const k = $('#txtJsonSec').value;
    OV.data = OV.data || {}; OV.data[TXT_LANG] = OV.data[TXT_LANG] || {};
    OV.data[TXT_LANG][k] = val;
    $('#btnTxtJsonSave').disabled = true;
    await saveOv('بخش «' + k + '» (' + (LG_NAME[TXT_LANG] || TXT_LANG) + ') به‌روزرسانی شد');
  } catch (e) { toast('✗ ' + e.message); }
  finally { $('#btnTxtJsonSave').disabled = false; }
});

/* ══════════ ۱۷) تب‌ها و شروع ══════════ */
$$('.tab[data-pane]').forEach(t => t.addEventListener('click', () => {
  $$('.tab[data-pane]').forEach(x => x.classList.toggle('on', x === t));
  $$('.pane').forEach(p => { p.hidden = p.id !== 'pane-' + t.dataset.pane; });
  if (t.dataset.pane === 'dash') dashLoad();
  if (t.dataset.pane === 'products') { gamesRender(); cardsRender(); }
  if (t.dataset.pane === 'services') { svcLoad(); svcRender(); }
  if (t.dataset.pane === 'ai') { aiLoad(); aiRender(); }
  if (t.dataset.pane === 'gifts') { giftLoad(); giftRender(); }
  if (t.dataset.pane === 'texts') txtRender();
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
