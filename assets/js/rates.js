/* ═══════════════════════════════════════════════════
   STARSHOP — rates.js
   نرخ لحظه‌ای دلار، یورو، طلا و سکه + موتور محاسبه قیمت
   منابع: tgju.org → open.er-api.com → api.gold-api.com
   با فالبک آفلاین، تازه‌سازی خودکار و جهت تغییر (▲▼)
   ═══════════════════════════════════════════════════ */
(() => {
'use strict';

const CFG = () => window.SS_CONFIG || {};
const RC = () => CFG().rates || {};

/* ── state ── */
const K_CACHE = 'ss_rates_cache';
let state = {
  ready: false, offline: false, ts: 0,
  usdIrr: 0,   // ریال (بازار آزاد)
  gold18: 0,   // ریال هر گرم عیار ۱۸
  coin: 0,     // ریال سکه امامی
  fx: {},      // واحدهای ارز خارجی به ازای هر دلار
  dir: {}      // جهت تغییر: 1 بالا، -1 پایین، 0 بدون تغییر
};
const subs = [];
const subscribe = fn => { subs.push(fn); try { fn(state); } catch (e) {} };
const emit = () => subs.forEach(fn => { try { fn(state); } catch (e) {} });

/* ── cache ── */
const readCache = () => { try { return JSON.parse(localStorage.getItem(K_CACHE)); } catch (e) { return null; } };
const writeCache = () => { try { localStorage.setItem(K_CACHE, JSON.stringify({ ts: state.ts, usdIrr: state.usdIrr, gold18: state.gold18, coin: state.coin, fx: state.fx, prev: state.dir })); } catch (e) {} };

/* ── helpers ── */
const num = s => { const n = parseFloat(String(s == null ? '' : s).replace(/[^\d.]/g, '')); return isFinite(n) ? n : 0; };
const fetchJson = async (url, ms = 7000) => {
  const ac = (typeof AbortController !== 'undefined') ? new AbortController() : null;
  const tid = ac ? setTimeout(() => ac.abort(), ms) : null;
  try {
    const res = await fetch(url, ac ? { signal: ac.signal } : {});
    if (!res.ok) throw new Error('http ' + res.status);
    return await res.json();
  } finally { if (tid) clearTimeout(tid); }
};

/* ── source 1: tgju (دلار بازار ایران، طلا، سکه) ── */
const fetchTgju = async () => {
  const hosts = ['call5', 'call3', 'call2', 'call1', 'call4'];
  for (const h of hosts) {
    try {
      const j = await fetchJson(`https://${h}.tgju.org/ajax.json`, 6500);
      const cur = j && (j.current || j);
      if (!cur) continue;
      const d = cur.price_dollar_rl && num(cur.price_dollar_rl.p);
      const g = cur.geram18 && num(cur.geram18.p);
      const c = cur.sekee && num(cur.sekee.p);
      if (d > 100000) return { usdIrr: d, gold18: g || 0, coin: c || 0 };
    } catch (e) { /* next host */ }
  }
  return null;
};

/* ── source 2: open.er-api.com (نرخ ارزهای جهانی بر پایه دلار) ── */
const fetchFx = async () => {
  try {
    const j = await fetchJson('https://open.er-api.com/v6/latest/USD', 7000);
    const r = j && j.rates;
    if (!r) return null;
    const fx = {};
    ['AED', 'EUR', 'TRY', 'GBP', 'SAR', 'CAD', 'AUD', 'IRR'].forEach(c => { if (r[c]) fx[c] = r[c]; });
    return fx;
  } catch (e) { return null; }
};

/* ── source 3: api.gold-api.com (انس جهانی طلا — فالبک طلا) ── */
const fetchGoldOz = async () => {
  try {
    const j = await fetchJson('https://api.gold-api.com/price/XAU', 6500);
    const p = j && num(j.price);
    return p > 100 ? p : 0; // دلار برای هر اونس
  } catch (e) { return 0; }
};

/* ── update ── */
let busy = false;
const refresh = async (silent) => {
  if (busy) return state;
  busy = true;
  try {
    const prev = { usdIrr: state.usdIrr, gold18: state.gold18, coin: state.coin };
    const [tgju, fx] = await Promise.all([fetchTgju(), fetchFx()]);
    const f = RC().fallback || {};
    if (tgju) {
      state.usdIrr = tgju.usdIrr;
      state.gold18 = tgju.gold18;
      state.coin = tgju.coin;
      state.offline = false;
    } else {
      state.usdIrr = f.usdIrr || state.usdIrr || 0;
      state.gold18 = f.gold18 || state.gold18 || 0;
      state.coin = f.coin || state.coin || 0;
      state.offline = true;
    }
    state.fx = fx || state.fx || {};
    /* فالبک طلا: اگر tgju طلا نداد، از انس جهانی + نرخ دلار بساز */
    if (!state.gold18 && state.usdIrr) {
      const oz = await fetchGoldOz();
      if (oz) state.gold18 = Math.round((oz / 31.1034768) * 0.75 * state.usdIrr);
    }
    /* جهت تغییر برای ▲▼ */
    const dir = {};
    ['usdIrr', 'gold18', 'coin'].forEach(k => {
      if (!prev[k] || !state[k]) dir[k] = 0;
      else if (state[k] > prev[k]) dir[k] = 1;
      else if (state[k] < prev[k]) dir[k] = -1;
      else dir[k] = state.dir[k] || 0;
    });
    state.dir = dir;
    state.ready = true;
    state.ts = Date.now();
    writeCache();
    emit();
  } finally { busy = false; }
  return state;
};

/* ── public calc helpers ── */
/* نرخ هر ارز به ازای ۱ دلار */
const rateOf = cur => {
  if (!cur) return 0;
  if (cur === 'USD') return 1;
  if (cur === 'IRR') return state.usdIrr || 0;
  return (state.fx && state.fx[cur]) || 0;
};
/* قیمت نهایی = مبلغ دلاری × نرخ × (۱ + کارمزد) */
const convert = (usd, cur) => {
  const r = rateOf(cur);
  if (!r) return 0;
  const markup = typeof RC().markup === 'number' ? RC().markup : 0.20;
  return usd * r * (1 + markup);
};
const toman = rial => rial / 10; // ریال → تومان
const get = () => state;

/* ── init ── */
const cached = readCache();
if (cached && cached.usdIrr) {
  state.usdIrr = cached.usdIrr;
  state.gold18 = cached.gold18 || 0;
  state.coin = cached.coin || 0;
  state.fx = cached.fx || {};
  state.ts = cached.ts || 0;
  state.ready = true;
}
const REFRESH_MS = RC().refreshMs || 240000;
const init = () => {
  refresh(true);
  setInterval(() => { if (!document.hidden) refresh(true); }, REFRESH_MS);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && Date.now() - state.ts > REFRESH_MS) refresh(true); });
  addEventListener('online', () => refresh(true));
};

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();

/* ── rates strip UI ── */
const renderStrip = () => {
  const row = document.getElementById('ratesRow');
  const meta = document.getElementById('ratesMeta');
  if (!row) return;
  const lang = window.SS_LANG || 'fa';
  const dd = (window.SS_DATA[lang] || window.SS_DATA.fa);
  const L = k => { const dd2 = dd; let v = dd2.ui && dd2.ui[k]; if (v != null) return v; v = window.SS_DATA.fa.ui[k]; return v != null ? v : k; };
  const loc = dd.meta && dd.meta.numLocale ? dd.meta.numLocale : 'fa-IR';
  const fmtT = rial => toman(rial).toLocaleString(loc, { maximumFractionDigits: 0 });
  const arrow = d => d === 1 ? '▲' : d === -1 ? '▼' : '';
  const chip = (label, val, d, id) =>
    `<div class="rate-chip${d ? ' ' + (d > 0 ? 'up' : 'down') : ''}"${id ? ` data-rate="${id}"` : ''}>
      <span class="rate-label">${label}</span>
      <span class="rate-val">${val ? `<b>${fmtT(val)}</b> <i>${L('rates.toman')}</i> <em class="rate-dir">${arrow(d)}</em>` : '—'}</span>
    </div>`;
  row.innerHTML =
    chip(L('rates.usd'), state.usdIrr, state.dir.usdIrr, 'usd') +
    chip(L('rates.eur'), state.usdIrr && state.fx.EUR ? state.usdIrr * state.fx.EUR : 0, 0, 'eur') +
    chip(L('rates.gold'), state.gold18, state.dir.gold18, 'gold') +
    chip(L('rates.coin'), state.coin, state.dir.coin, 'coin');
  if (meta) {
    if (state.offline) { meta.textContent = L('rates.offline'); }
    else {
      const t = state.ts ? new Date(state.ts).toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' }) : '—';
      meta.textContent = L('rates.updated').replace('{t}', t);
    }
    meta.classList.toggle('offline', state.offline);
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

/* ── public API ── */
window.SSRates = { get, rateOf, convert, toman, refresh, subscribe };
})();
