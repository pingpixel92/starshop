/* ═══════════════════════════════════════════════════
   STARSHOP — rates.js  v3
   نرخ لحظه‌ای بازار ایران (tgju) + ۱۵ ارز + طلا/مثقال/سکه
   + همه ارزهای کشورهای جهان (SS_WORLD — مودال «همه نرخ‌ها»)
   ⚠️ tgju مستقیم CORS ندارد → زنجیره پراکسی:
     r.jina.ai → api.codetabs.com → api.allorigins.win → مستقیم
   فالبک: open.er-api.com + api.gold-api.com → مقادیر config
   تازه‌سازی: هر ۱۲ ثانیه (صفحه فعال) + backoff در خطا
   ═══════════════════════════════════════════════════ */
(() => {
'use strict';

const CFG = () => window.SS_CONFIG || {};
const RC = () => CFG().rates || {};

/* ── نمادهای tgju → کلید داخلی (همه مقادیر «ریال») ── */
const UNITS = {
  usdIrr: 'price_dollar_rl', eurIrr: 'price_eur', gbpIrr: 'price_gbp',
  aedIrr: 'price_aed', sarIrr: 'price_sar', qarIrr: 'price_qar',
  kwdIrr: 'price_kwd', tryIrr: 'price_try', cadIrr: 'price_cad',
  audIrr: 'price_aud', chfIrr: 'price_chf', cnyIrr: 'price_cny',
  jpyIrr: 'price_jpy', inrIrr: 'price_inr', rubIrr: 'price_rub',
  gold18: 'geram18', mesghal: 'mesghal', coin: 'sekee'
};
const LETTERS = { eurIrr:'EUR', gbpIrr:'GBP', aedIrr:'AED', sarIrr:'SAR', qarIrr:'QAR', kwdIrr:'KWD', tryIrr:'TRY', cadIrr:'CAD', audIrr:'AUD', chfIrr:'CHF', cnyIrr:'CNY', jpyIrr:'JPY', inrIrr:'INR', rubIrr:'RUB' };
const DIR_KEYS = Object.keys(UNITS); /* برای ▲▼ روی همه نمادها */

/* ── state ── */
const K_CACHE = 'ss_rates_cache_v3';
let state = {
  ready: false, offline: false, ts: 0, src: '',
  usdIrr: 0, gold18: 0, coin: 0, mesghal: 0,
  units: {},   // هر ارز به ریال (بازار آزاد ایران)
  fx: {},      // هر ارز به ازای ۱ دلار (برای قیمت‌گذاری محلی)
  dir: {},
  world: {},      // همه ارزها (کد → ریال) از SS_WORLD
  worldGold: {},  // طلا/سکه (کلید → ریال؛ ons دلار)
  dirW: {}        // جهت تغییر ▲▼ برای world+worldGold
};
const subs = [];
const subscribe = fn => { subs.push(fn); try { fn(state); } catch (e) {} };
const emit = () => subs.forEach(fn => { try { fn(state); } catch (e) {} });

/* ── cache ── */
const readCache = () => { try { return JSON.parse(localStorage.getItem(K_CACHE)); } catch (e) { return null; } };
const writeCache = () => { try {
  localStorage.setItem(K_CACHE, JSON.stringify({
    ts: state.ts, usdIrr: state.usdIrr, gold18: state.gold18, coin: state.coin, mesghal: state.mesghal,
    units: state.units, fx: state.fx, prev: state.dir, offline: state.offline,
    world: state.world, worldGold: state.worldGold, prevW: state.dirW
  }));
} catch (e) {} };

/* ── helpers ── */
const num = s => { const n = parseFloat(String(s == null ? '' : s).replace(/[^\d.]/g, '')); return isFinite(n) ? n : 0; };
const fetchText = async (url, ms = 9000) => {
  const ac = (typeof AbortController !== 'undefined') ? new AbortController() : null;
  const tid = ac ? setTimeout(() => ac.abort(), ms) : null;
  try {
    const res = await fetch(url, ac ? { signal: ac.signal } : {});
    if (!res.ok) throw new Error('http ' + res.status);
    return await res.text();
  } finally { if (tid) clearTimeout(tid); }
};
const extractJson = txt => {
  const i = txt.indexOf('{'), j = txt.lastIndexOf('}');
  if (i < 0 || j <= i) throw new Error('no json');
  return JSON.parse(txt.slice(i, j + 1));
};

/* ── منبع اصلی: tgju از راه زنجیره پراکسی (چرخش هاست در هر تلاش) ── */
let hostIdx = 0;
const TGJU_HOSTS = ['call3', 'call1', 'call5', 'call2', 'call4'];
const nextHost = () => TGJU_HOSTS[(hostIdx++) % TGJU_HOSTS.length];
const buildProxies = h => {
  const target = `https://${h}.tgju.org/ajax.json`;
  return [
    { url: `https://r.jina.ai/${target}`, wrap: true },
    { url: `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(target)}`, wrap: false },
    { url: `https://api.allorigins.win/raw?url=${encodeURIComponent(target)}`, wrap: false },
    { url: target, wrap: false } /* اگر مرورگر/کلاینت اجازه داد */
  ];
};
const parseTgju = j => {
  const cur = j && (j.current || j);
  if (!cur) return null;
  const out = {};
  for (const k of Object.keys(UNITS)) {
    const row = cur[UNITS[k]];
    out[k] = row ? num(row.p) : 0;
  }
  /* اعتبارسنجی: دلار آزاد ایران باید حداقل این حد باشد (ریال) */
  if (!out.usdIrr || out.usdIrr < 200000) return null;
  /* همه ارزهای جهان + طلا/سکه برای مودال «همه نرخ‌ها» */
  out.world = {};
  (window.SS_WORLD || []).forEach(w => {
    const row = cur[w.k];
    const v = row ? num(row.p) : 0;
    if (v > 0) out.world[w.c] = v;
  });
  out.worldGold = {};
  (window.SS_WORLD_GOLD || []).forEach(w => {
    const row = cur[w.k];
    const v = row ? num(row.p) : 0;
    if (v > 0) out.worldGold[w.k] = v;
  });
  return out;
};
const fetchTgju = async () => {
  const start = hostIdx;
  for (let round = 0; round < 2; round++) {
    const h = TGJU_HOSTS[(start + round) % TGJU_HOSTS.length];
    for (const p of buildProxies(h)) {
      try {
        const txt = await fetchText(p.url, 9000);
        const j = p.wrap ? extractJson(txt) : JSON.parse(txt);
        const map = parseTgju(j);
        if (map) { hostIdx = (hostIdx + 1) % TGJU_HOSTS.length; return { map, via: h }; }
      } catch (e) { /* پراکسی بعدی */ }
    }
  }
  return null;
};

/* ── فالبک ۱: ارزهای جهانی از er-api (روزانه — فقط وقتی tgju قطع است) ── */
const fetchFx = async () => {
  try {
    const j = JSON.parse(await fetchText('https://open.er-api.com/v6/latest/USD', 7000));
    const r = j && j.rates; if (!r) return null;
    const fx = {};
    Object.values(LETTERS).forEach(c => { if (r[c]) fx[c] = r[c]; });
    return fx;
  } catch (e) { return null; }
};
/* ── فالبک ۲: انس جهانی طلا → ساخت گرم ۱۸ با نرخ دلار ── */
const fetchGoldOz = async () => {
  try {
    const j = JSON.parse(await fetchText('https://api.gold-api.com/price/XAU', 6500));
    const p = j && num(j.price);
    return p > 100 ? p : 0;
  } catch (e) { return 0; }
};

/* ── update ── */
let busy = false, fails = 0, cooldownUntil = 0;
const refresh = async (silent) => {
  if (busy) return state;
  busy = true;
  try {
    const prev = {};
    DIR_KEYS.forEach(k => { prev[k] = state.units[k] != null ? state.units[k] : (k === 'usdIrr' ? state.usdIrr : k === 'gold18' ? state.gold18 : k === 'coin' ? state.coin : 0); });
    const prevW = Object.assign({}, state.world, state.worldGold);

    const got = await fetchTgju();
    const f = RC().fallback || {};
    if (got && got.map) {
      state.units = got.map;
      state.usdIrr = got.map.usdIrr;
      state.gold18 = got.map.gold18;
      state.mesghal = got.map.mesghal;
      state.coin = got.map.coin;
      state.world = got.map.world || state.world;
      state.worldGold = got.map.worldGold || state.worldGold;
      state.offline = false;
      state.src = 'tgju · ' + got.via;
      fails = 0;
      cooldownUntil = 0;
    } else {
      fails++;
      state.usdIrr = f.usdIrr || state.usdIrr || 0;
      state.gold18 = f.gold18 || state.gold18 || 0;
      state.coin = f.coin || state.coin || 0;
      state.mesghal = state.mesghal || 0;
      state.offline = true;
      state.src = 'fallback';
    }
    /* fx هر ارز به ازای ۱ دلار (برای قیمت‌گذاری به ارز محلی) */
    const fx = {};
    if (state.usdIrr) {
      Object.keys(LETTERS).forEach(k => {
        const u = state.units[k];
        if (u > 0) fx[LETTERS[k]] = state.usdIrr / u;
      });
    }
    if (!Object.keys(fx).length && state.offline) {
      const fxf = await fetchFx();
      if (fxf) Object.assign(fx, fxf);
    }
    state.fx = fx;
    /* فالبک طلا: اگر tgju طلا نداد، از انس جهانی بساز */
    if (!state.gold18 && state.usdIrr) {
      const oz = await fetchGoldOz();
      if (oz) state.gold18 = Math.round((oz / 31.1034768) * 0.75 * state.usdIrr);
    }
    /* جهت تغییر ▲▼ روی همه نمادها */
    const dir = {};
    DIR_KEYS.forEach(k => {
      const now = state.units[k] || 0;
      const was = prev[k] || 0;
      dir[k] = (!now || !was) ? (state.dir[k] || 0) : now > was ? 1 : now < was ? -1 : 0;
    });
    state.dir = dir;
    /* جهت ▲▼ برای ارزهای جهانی + طلا */
    const dirW = {};
    Object.keys(state.world).forEach(c => {
      const now = state.world[c] || 0, was = prevW[c] || 0;
      dirW[c] = (!now || !was) ? (state.dirW[c] || 0) : now > was ? 1 : now < was ? -1 : 0;
    });
    Object.keys(state.worldGold).forEach(k => {
      const now = state.worldGold[k] || 0, was = prevW[k] || 0;
      dirW[k] = (!now || !was) ? (state.dirW[k] || 0) : now > was ? 1 : now < was ? -1 : 0;
    });
    state.dirW = dirW;
    state.ready = true;
    state.ts = Date.now();
    writeCache();
    emit();
  } finally { busy = false; }
  return state;
};

/* ── public calc helpers ── */
const rateOf = cur => {
  if (!cur) return 0;
  if (cur === 'USD') return 1;
  if (cur === 'IRR') return state.usdIrr || 0;
  return (state.fx && state.fx[cur]) || 0;
};
const convert = (usd, cur) => {
  const r = rateOf(cur);
  if (!r) return 0;
  const markup = typeof RC().markup === 'number' ? RC().markup : 0.20;
  return usd * r * (1 + markup);
};
const toman = rial => rial / 10;
const get = () => state;

/* ── init + polling (۱۲ ثانیه ± جیتر، فقط صفحه فعال، فیوز در خطای پیاپی) ──
   مقاوم‌سازی ترافیک بالا:
   • جیتر ±۲ ثانیه → موج هماهنگ ۱۰۰۰ کاربر به پراکسی‌ها نمی‌خورد
   • فیوز (circuit breaker): ۶ خطای پیاپی → ۵ دقیقه استراحت (با آخرین نرخ سالم)
   • کش تازه (<۹۰ث) → اولین fetch حذف = بازدیدکننده برگشتی هیچ درخواستی نمی‌زند
   • saveData مرورگر → فاصله ۵ برابری
   ─────────────────────────────────────────────── */
const cached = readCache();
if (cached && cached.usdIrr) {
  state.usdIrr = cached.usdIrr;
  state.gold18 = cached.gold18 || 0;
  state.coin = cached.coin || 0;
  state.mesghal = cached.mesghal || 0;
  state.units = cached.units || {};
  state.fx = cached.fx || {};
  state.dir = cached.prev || {};
  state.world = cached.world || {};
  state.worldGold = cached.worldGold || {};
  state.dirW = cached.prevW || {};
  state.ts = cached.ts || 0;
  state.offline = !!cached.offline;
  state.ready = true;
}
const DATA_SAVER = !!(navigator.connection && navigator.connection.saveData);
const BASE_MS = (RC().refreshMs || 12000) * (DATA_SAVER ? 5 : 1);
const jitter = () => BASE_MS + Math.floor(Math.random() * 4000) - 2000;
let timer = null;
const schedule = ms => { clearTimeout(timer); timer = setTimeout(tick, ms); };
const tick = async () => {
  if (Date.now() < cooldownUntil) { schedule(60000); return; }
  if (document.hidden) { schedule(jitter()); return; }
  await refresh(true);
  if (fails >= 6) cooldownUntil = Date.now() + 300000; /* فیوز: ۵ دقیقه استراحت */
  schedule(state.offline ? Math.min(BASE_MS * (1 + fails), 96000) + Math.floor(Math.random() * 8000) : jitter());
};
const init = () => {
  const freshCache = state.ts && (Date.now() - state.ts < 90000);
  if (!freshCache) setTimeout(() => { refresh(true).catch(() => {}); }, Math.floor(Math.random() * 2500)); /* پخش بار ورود */
  schedule(freshCache ? jitter() : jitter() + 2500);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && Date.now() - state.ts > BASE_MS) { clearTimeout(timer); tick(); }
  });
  addEventListener('online', () => { clearTimeout(timer); cooldownUntil = 0; refresh(true).catch(() => {}); schedule(jitter()); });
};

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();

/* ── rates strip UI ── */
const STRIP = [
  ['usdIrr', 'rates.usd'], ['eurIrr', 'rates.eur'], ['gbpIrr', 'rates.gbp'], ['aedIrr', 'rates.aed'],
  ['sarIrr', 'rates.sar'], ['qarIrr', 'rates.qar'], ['kwdIrr', 'rates.kwd'], ['tryIrr', 'rates.try'],
  ['cadIrr', 'rates.cad'], ['audIrr', 'rates.aud'], ['chfIrr', 'rates.chf'], ['cnyIrr', 'rates.cny'],
  ['jpyIrr', 'rates.jpy'], ['inrIrr', 'rates.inr'], ['rubIrr', 'rates.rub'],
  ['gold18', 'rates.gold'], ['mesghal', 'rates.mesghal'], ['coin', 'rates.coin']
];
const renderStrip = () => {
  const row = document.getElementById('ratesRow');
  const meta = document.getElementById('ratesMeta');
  if (!row) return;
  const lang = window.SS_LANG || 'fa';
  const dd = (window.SS_DATA[lang] || window.SS_DATA.fa);
  const L = k => { let v = dd.ui && dd.ui[k]; if (v != null) return v; v = window.SS_DATA.fa.ui[k]; return v != null ? v : k; };
  const loc2 = dd.meta && dd.meta.numLocale ? dd.meta.numLocale : 'fa-IR';
  const fmtT = rial => toman(rial).toLocaleString(loc2, { maximumFractionDigits: 0 });
  const arrow = d => d === 1 ? '▲' : d === -1 ? '▼' : '';
  const val = k => {
    if (k === 'usdIrr') return state.usdIrr;
    if (k === 'gold18') return state.gold18;
    if (k === 'coin') return state.coin;
    return state.units[k] || 0;
  };
  row.innerHTML = STRIP.map(([k, lk]) => {
    const v = val(k), d = state.dir[k] || 0;
    return `<div class="rate-chip${d ? ' ' + (d > 0 ? 'up' : 'down') : ''}" data-rate="${k}">
      <span class="rate-label">${L(lk)}</span>
      <span class="rate-val">${v ? `<b>${fmtT(v)}</b> <i>${L('rates.toman')}</i> <em class="rate-dir">${arrow(d)}</em>` : '—'}</span>
    </div>`;
  }).join('');
  if (meta) {
    if (state.offline) {
      meta.textContent = L('rates.offline');
    } else {
      const t2 = state.ts ? new Date(state.ts).toLocaleTimeString(loc2, { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—';
      meta.innerHTML = `<span class="dot-live" aria-hidden="true"></span>` + L('rates.updated').replace('{t}', t2);
    }
    meta.classList.toggle('offline', !!state.offline);
    meta.classList.toggle('live', !state.offline);
  }
};
document.addEventListener('ss:lang', renderStrip);
subscribe(renderStrip);

const refreshBtn = () => {
  const b = document.getElementById('ratesRefresh');
  if (!b || b.dataset.bound) return;
  b.dataset.bound = '1';
  b.addEventListener('click', () => { b.classList.add('spin'); refresh(true).finally(() => setTimeout(() => b.classList.remove('spin'), 700)); });
};
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', refreshBtn);
else refreshBtn();

/* ═════════ مودال «همه نرخ‌ها» — ارز همه کشورهای جهان، زنده ═════════ */
const langDD = () => (window.SS_DATA[window.SS_LANG || 'fa'] || window.SS_DATA.fa);
const L = k => { const dd = langDD(); let v = dd.ui && dd.ui[k]; if (v != null) return v; v = window.SS_DATA.fa.ui[k]; return v != null ? v : k; };
const localDigW = n => {
  const lang = window.SS_LANG || 'fa';
  if (lang === 'fa') return String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
  if (lang === 'ar') return String(n).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
  return String(n);
};
const normQ = s => String(s || '')
  .replace(/[\u064A]/g, '\u06CC').replace(/[\u0643]/g, '\u06A9')
  .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
  .replace(/[\u06F0-\u06F9]/g, d => String(d.charCodeAt(0) - 0x06F0))
  .replace(/[\u0660-\u0669]/g, d => String(d.charCodeAt(0) - 0x0660))
  .replace(/\u200c/g, ' ').toLowerCase().trim();

const renderWorld = () => {
  const goldBox = document.getElementById('rmGold');
  const fxBox = document.getElementById('rmFx');
  if (!goldBox || !fxBox) return;
  const lang = window.SS_LANG || 'fa';
  const dd = (window.SS_DATA[lang] || window.SS_DATA.fa);
  const loc2 = dd.meta && dd.meta.numLocale ? dd.meta.numLocale : 'fa-IR';
  const q = normQ(document.getElementById('rmSearch') ? document.getElementById('rmSearch').value : '');
  const arrow = d => d === 1 ? '▲' : d === -1 ? '▼' : '';
  const fmtT = rial => toman(rial).toLocaleString(loc2, { maximumFractionDigits: 0 });
  const card = (f, name, code, valHtml, dir) => `
    <div class="rm-card${dir ? ' ' + (dir > 0 ? 'up' : 'down') : ''}">
      <span class="rm-flag" aria-hidden="true">${f}</span>
      <span class="rm-name">${name}<b dir="ltr">${code}</b></span>
      <span class="rm-val" dir="ltr">${valHtml}</span>
    </div>`;

  /* طلا و سکه */
  const goldRows = (window.SS_WORLD_GOLD || []).filter(w => {
    if (!q) return true;
    return normQ(w.fa).includes(q) || normQ(w.en).includes(q) || normQ(w.c).includes(q) || normQ(lang === 'ar' ? w.ar : '').includes(q);
  });
  goldBox.innerHTML = goldRows.map(w => {
    const v = state.worldGold[w.k] || 0;
    if (!v) return '';
    const d = state.dirW[w.k] || 0;
    const val = w.usd
      ? `<b>$${v.toLocaleString('en-US', { maximumFractionDigits: 0 })}</b>`
      : `<b>${fmtT(v)}</b> <i>${L('rates.toman')}</i>`;
    return card(w.f, lang === 'en' ? w.en : lang === 'ar' ? w.ar : w.fa, w.c, val + `<em class="rm-dir">${arrow(d)}</em>`, d);
  }).join('') || `<p class="rm-empty">${L('rm.none')}</p>`;

  /* ارز کشورها */
  const fxRows = (window.SS_WORLD || []).filter(w => {
    if (!q) return true;
    return normQ(w.fa).includes(q) || normQ(w.en).includes(q) || normQ(w.ar).includes(q) || normQ(w.c).includes(q);
  });
  const total = (window.SS_WORLD || []).length;
  fxBox.innerHTML = fxRows.map(w => {
    const v = state.world[w.c] || 0;
    if (!v) return '';
    const d = state.dirW[w.c] || 0;
    return card(w.f, lang === 'en' ? w.en : lang === 'ar' ? w.ar : w.fa, w.c,
      `<b>${fmtT(v)}</b> <i>${L('rates.toman')}</i><em class="rm-dir">${arrow(d)}</em>`, d);
  }).join('') || `<p class="rm-empty">${L('rm.none')}</p>`;

  const cnt = document.getElementById('rmCount');
  if (cnt) cnt.textContent = L('rm.count').replace('{n}', localDigW(fxRows.length)).replace('{all}', localDigW(total));
  const meta2 = document.getElementById('rmMeta');
  if (meta2) {
    if (state.offline) meta2.textContent = L('rates.offline');
    else {
      const t2 = state.ts ? new Date(state.ts).toLocaleTimeString(loc2, { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—';
      meta2.innerHTML = L('rates.updated').replace('{t}', t2) + ' · ' + (state.src || '');
    }
    meta2.classList.toggle('offline', !!state.offline);
  }
};

const wireWorld = () => {
  const btn = document.getElementById('ratesAllBtn');
  const modal = document.getElementById('ratesModal');
  if (!btn || !modal || btn.dataset.bound) return;
  btn.dataset.bound = '1';
  btn.addEventListener('click', () => {
    renderWorld();
    if (window.SSUI && window.SSUI.openModal) window.SSUI.openModal(modal);
    else modal.hidden = false;
  });
  const search = document.getElementById('rmSearch');
  if (search) {
    let tid = null;
    search.addEventListener('input', () => { clearTimeout(tid); tid = setTimeout(renderWorld, 120); });
  }
  subscribe(renderWorld);
  document.addEventListener('ss:lang', renderWorld);
};
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wireWorld);
else wireWorld();

/* ── public API ── */
window.SSRates = { get, rateOf, convert, toman, refresh, subscribe };
})();
