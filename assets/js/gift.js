/* ═══════════════════════════════════════════════════
   STARSHOP — gift.js
   مودال سفارش گیفت کارت: ریجن + مبلغ (۱ تا ۱۰۰ دلار، مخصوص هر کارت)
   یا مدت اشتراک + ارز پرداخت (ارز ریجن یا ریال) با نرخ لحظه‌ای + ۲۰٪
   ═══════════════════════════════════════════════════ */
(() => {
'use strict';

const $  = (s, c) => (c || document).querySelector(s);
const $$ = (s, c) => Array.from((c || document).querySelectorAll(s));
const escapeHtml = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const D  = () => window.SS_DATA[window.SS_LANG || 'fa'] || window.SS_DATA.fa;
const t  = k => { const v = D().ui[k]; if (v != null) return v; const v2 = window.SS_DATA.fa.ui[k]; return v2 != null ? v2 : k; };
const loc = () => D().meta.numLocale || 'fa-IR';
const localDig = n => {
  const lang = window.SS_LANG || 'fa';
  if (lang === 'fa') return String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
  if (lang === 'ar') return String(n).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
  return String(n);
};

/* نرخ فالبک ارزها وقتی سرویس زنده در دسترس نیست (تقریبی — هر واحد به ازای ۱ دلار) */
const FALLBACK_FX = { AED: 3.67, EUR: 0.92, TRY: 34, GBP: 0.79, SAR: 3.75, QAR: 3.64, KWD: 0.31, CAD: 1.37, AUD: 1.50, CHF: 0.88, CNY: 7.10, JPY: 150, INR: 84, RUB: 92 };
const RIAL_NAMES  = { fa: 'ریال ایران', en: 'Iranian Rial', ar: 'الريال الإيراني' };

let cur = null;   // {gift, regionId, value, payCur}
let panel = null;

/* ── lookups ── */
const findGift = id => D().gifts.find(g => g.id === id) || window.SS_DATA.fa.gifts.find(g => g.id === id);
/* ریجن‌های کارت + استخر کشورهای اضافی (بدون تکرار) — همه کشورها برای همه کارت‌ها */
const regionsAll = g => g.noExtra ? g.regions : g.regions.concat(((window.SS_DATA[window.SS_LANG || 'fa'] || window.SS_DATA.fa).regionsExtra || []).filter(r => !g.regions.some(x => x.id === r.id)));
const findRegion = (g, rid) => regionsAll(g).find(r => r.id === rid);

/* ── pricing ── */
const baseUsd = () => {
  if (!cur) return 0;
  const g = cur.gift;
  if (g.type === 'months') return g.tiers ? (g.tiers[cur.value] || 0) : g.perMonth * cur.value;
  return cur.value;
};
const pricing = () => {
  const R = window.SSRates; const st = R ? R.get() : null;
  const usdIrr = st && st.usdIrr ? st.usdIrr : 0;
  const curCode = cur.payCur;
  let rate, approx = false;
  if (curCode === 'IRR') rate = usdIrr;
  else if (curCode === 'USD') rate = 1;
  else {
    rate = (st && st.fx && st.fx[curCode]) || FALLBACK_FX[curCode] || 0;
    approx = !(st && st.fx && st.fx[curCode]);
  }
  if (curCode === 'IRR' && !usdIrr) approx = true;
  if (!usdIrr) approx = true;
  const markup = (window.SS_CONFIG && window.SS_CONFIG.rates && typeof window.SS_CONFIG.rates.markup === 'number') ? window.SS_CONFIG.rates.markup : 0.20;
  const pay = rate ? baseUsd() * rate * (1 + markup) : 0;
  const tomanRial = usdIrr ? baseUsd() * usdIrr * (1 + markup) : 0;
  return { rate, approx, pay, tomanRial, usdIrr, markup, ready: !!pay };
};

/* ── formatting ── */
const fmtMoney = (n, frac) => n.toLocaleString(loc(), { maximumFractionDigits: frac == null ? 2 : frac });
const fmtToman = rial => (rial / 10).toLocaleString(loc(), { maximumFractionDigits: 0 });
const titleFor = (meta) => {
  const g = findGift(meta.giftId) || { t: meta.brand };
  return meta.type === 'months'
    ? `${t('pay.gift')} ${g.t} — ${localDig(meta.value)} ${t('cart.meta.month')}`
    : `${t('pay.gift')} ${g.t} — ${localDig(meta.value)}$`;
};

/* ── meta lines (سبد + پیام سفارش) ── */
const metaLines = item => {
  const m = item.meta || {};
  if (m.kind !== 'gift') return [];
  const g = findGift(m.giftId);
  const r = g ? findRegion(g, m.regionId) : null;
  const regionTxt = `${r ? r.flag + ' ' + r.label : m.regionId}`;
  const rateTxt = m.cur === 'IRR' ? (m.usdIrr ? fmtMoney(m.usdIrr, 0) : '—') : (m.rate ? fmtMoney(m.rate, 2) : '—');
  const rateCur = m.cur === 'IRR' ? 'IRR' : m.cur;
  const lines = [
    `${t('cart.meta.region')}: ${regionTxt}`,
    m.type === 'months'
      ? `${t('cart.meta.months')}: ${localDig(m.value)} ${t('cart.meta.month')}`
      : `${t('cart.meta.amount')}: ${localDig(m.value)} USD`,
    `${t('cart.meta.pay')}: ` + (m.cur === 'IRR'
      ? `~${fmtToman(m.tomanRial)} ${t('rates.toman')}`
      : `~${m.payFmt} ${m.cur} ${t('gift.cfg.approx')} ${fmtToman(m.tomanRial)} ${t('rates.toman')}`),
    `${t('cart.meta.rate')}: 1$ = ${rateTxt} ${rateCur}`
  ];
  return lines;
};

/* ── render ── */
const render = () => {
  if (!cur || !panel) return;
  const g = cur.gift;
  const region = findRegion(g, cur.regionId);
  const p = pricing();
  const isMonths = g.type === 'months';

  const regionChips = regionsAll(g).map(r => `
    <button type="button" class="gm-chip${r.id === cur.regionId ? ' on' : ''}" data-gm-region="${r.id}">
      <span class="gm-flag">${r.flag}</span><span>${escapeHtml(r.label)}</span><b dir="ltr">${r.cur}</b>
    </button>`).join('');

  let amountUI = '';
  if (isMonths) {
    if (g.monthOpts) {
      /* انتخاب پله‌ای مدت اشتراک (مثلاً اسپاتیفای ۱/۲/۳ ماه، تلگرام پریمیوم ۱/۳/۶/۱۲) */
      amountUI = `
      <div class="gm-chips gm-months">${g.monthOpts.map(m => `
        <button type="button" class="gm-chip${m === cur.value ? ' on' : ''}" data-gm-month="${m}"><b dir="ltr">${localDig(m)}</b><span>${t('cart.meta.month')}${m > 1 ? (window.SS_LANG === 'en' ? 's' : '') : ''}</span></button>`).join('')}
      </div>
      <div class="gm-range-note">${t('gift.cfg.pickMonths')}</div>`;
    } else {
      amountUI = `
      <div class="gm-stepper" dir="ltr">
        <button type="button" class="gm-step" data-gm-months="-1" aria-label="-">−</button>
        <b>${localDig(cur.value)} <small>${t('cart.meta.month')}</small></b>
        <button type="button" class="gm-step" data-gm-months="1" aria-label="+">+</button>
      </div>
      <div class="gm-range-note">${localDig(g.minM)} – ${localDig(g.maxM)} ${t('cart.meta.month')} · ${localDig(g.perMonth)}$ / ${t('cart.meta.month')}</div>`;
    }
  } else {
    const presets = (g.presets || []).map(v => `<button type="button" class="gm-chip gm-amount${v === cur.value ? ' on' : ''}" data-gm-amount="${v}">${localDig(v)}$</button>`).join('');
    amountUI = `
      <div class="gm-presets">${presets}
        <button type="button" class="gm-chip gm-amount${!(g.presets || []).includes(cur.value) ? ' on' : ''}" data-gm-amount="custom">${t('gift.cfg.custom')}</button>
      </div>
      <div class="gm-slider-row">
        <input type="range" class="gm-range" data-gm-range min="${g.min}" max="${g.max}" step="${g.step}" value="${cur.value}" dir="ltr" aria-label="${escapeHtml(t('gift.cfg.amount'))}">
        <input type="number" class="gm-num" data-gm-num min="${g.min}" max="${g.max}" step="${g.step}" value="${cur.value}" dir="ltr" inputmode="numeric" aria-label="${escapeHtml(t('gift.cfg.amount'))}">
      </div>
      <div class="gm-range-note">${localDig(g.min)}$ – ${localDig(g.max)}$</div>`;
  }

  const payChips = `
    <button type="button" class="gm-chip${cur.payCur === region.cur ? ' on' : ''}" data-gm-cur="${region.cur}"><b dir="ltr">${region.cur}</b><span>${region.cur === 'USD' ? 'Dollar' : ''}</span></button>
    ${region.cur !== 'USD' ? `<button type="button" class="gm-chip${cur.payCur === 'USD' ? ' on' : ''}" data-gm-cur="USD"><b dir="ltr">USD</b><span>Dollar</span></button>` : ''}
    <button type="button" class="gm-chip${cur.payCur === 'IRR' ? ' on' : ''}" data-gm-cur="IRR"><b dir="ltr">IRR</b><span>${escapeHtml(RIAL_NAMES[window.SS_LANG || 'fa'] || 'IRR')}</span></button>`;

  const totalBox = !p.ready ? `
    <div class="gm-total loading"><svg class="ic spin" viewBox="0 0 24 24"><use href="#i-spark"/></svg> <span>${t('gift.cfg.loading')}</span></div>`
    : `
    <div class="gm-total">
      <span class="gm-total-label">${t('gift.cfg.total')}</span>
      <b class="gm-total-val">${cur.payCur === 'IRR'
        ? `${fmtToman(p.pay)} <i>${t('rates.toman')}</i>`
        : `${fmtMoney(p.pay)} <bdi dir="ltr"><i>${cur.payCur}</i></bdi>`}</b>
      ${cur.payCur !== 'IRR' && p.tomanRial ? `<span class="gm-total-sub">${t('gift.cfg.approx')} ${fmtToman(p.tomanRial)} ${t('rates.toman')}</span>` : ''}
      <span class="gm-total-base">${t('gift.cfg.base').replace('{usd}', localDig(baseUsd()) + '$')} · ${t('gift.cfg.markup')}</span>
      <span class="gm-rate" dir="ltr">${t('gift.cfg.rate').replace('{rate}', fmtMoney(p.rate, cur.payCur === 'IRR' ? 0 : 2))} <em class="badge${p.approx ? ' off' : ''}">${p.approx ? t('gift.cfg.offline') : t('gift.cfg.live')}</em></span>
    </div>`;

  panel.innerHTML = `
    <button class="modal-close" data-close-modal aria-label="${escapeHtml(t('cart.close'))}"><svg class="ic" viewBox="0 0 24 24"><use href="#i-close"/></svg></button>
    <div class="gm-head">
      <span class="gm-logo gc-${brandClass(g)}"><img src="assets/logos/${g.logo}.svg" alt="" width="46" height="46"></span>
      <div><span class="chip">${t('gift.eyebrow')}</span><h3 id="gmTitle">${escapeHtml(g.t)}</h3><p>${escapeHtml(g.d)}</p></div>
    </div>
    <div class="gm-sec"><h4>${t('gift.cfg.region')}</h4>
      <div class="gm-chips">${regionChips}</div>
      <p class="gm-note">${t('gift.cfg.regionNote')}</p>
    </div>
    <div class="gm-sec"><h4>${isMonths ? t('gift.cfg.months') : t('gift.cfg.amount')}</h4>${amountUI}</div>
    <div class="gm-sec"><h4>${t('gift.cfg.paycur')}</h4><div class="gm-chips">${payChips}</div></div>
    ${totalBox}
    <button class="btn btn-primary btn-lg w100" type="button" data-gm-add ${p.ready ? '' : 'disabled'}><svg class="ic" viewBox="0 0 24 24"><use href="#i-cart"/></svg>${t('gift.cfg.add')}</button>`;

  bindPanel();
};

const brandClass = g => {
  const map = { 'gift-apple':'apple', 'gift-steam':'steam', 'gift-ps':'ps', 'gift-xbox':'xbox', 'gift-amazon':'amazon', 'gift-pubg':'pubg', 'gift-ff':'ff', 'gift-netflix':'netflix', 'gift-gplay':'gplay', 'gift-spotify':'spotify', 'gift-telegram':'tg', 'gift-youtube':'yt', 'gift-discord':'discord', 'gift-chatgpt':'gpt', 'gift-canva':'canva', 'gift-razer':'razer', 'gift-roblox':'roblox', 'gift-nintendo':'nintendo', 'gift-epic':'epic', 'gift-visa':'visa', 'gift-master':'mc' };
  return map[g.id] || 'steam';
};

/* ── events ── */
const bindPanel = () => {
  $$('[data-gm-region]', panel).forEach(b => b.addEventListener('click', () => {
    cur.regionId = b.dataset.gmRegion;
    const r = findRegion(cur.gift, cur.regionId);
    /* ارز پرداخت بر اساس ریجن انتخابی (مگر کاربر ریال انتخاب کرده باشد) */
    if (cur.payCur !== 'IRR') cur.payCur = r.cur;
    render();
  }));
  $$('[data-gm-amount]', panel).forEach(b => b.addEventListener('click', () => {
    if (b.dataset.gmAmount === 'custom') {
      const numIn = $('[data-gm-num]', panel);
      if (numIn) { numIn.focus(); numIn.select(); }
      $$('.gm-amount', panel).forEach(x => x.classList.remove('on'));
      b.classList.add('on');
      return;
    }
    cur.value = clampTo(+b.dataset.gmAmount);
    render();
  }));
  const range = $('[data-gm-range]', panel);
  if (range) range.addEventListener('input', () => { cur.value = clampTo(+range.value); syncAmountUI(range.value); });
  const numIn = $('[data-gm-num]', panel);
  if (numIn) numIn.addEventListener('change', () => { cur.value = clampTo(+numIn.value || cur.gift.min); render(); });
  $$('[data-gm-months]', panel).forEach(b => b.addEventListener('click', () => {
    cur.value = Math.min(cur.gift.maxM, Math.max(cur.gift.minM, cur.value + (+b.dataset.gmMonths)));
    render();
  }));
  $$('[data-gm-month]', panel).forEach(b => b.addEventListener('click', () => {
    cur.value = +b.dataset.gmMonth;
    render();
  }));
  $$('[data-gm-cur]', panel).forEach(b => b.addEventListener('click', () => { cur.payCur = b.dataset.gmCur; render(); }));
  const add = $('[data-gm-add]', panel);
  if (add) add.addEventListener('click', () => {
    const g = cur.gift;
    const region = findRegion(g, cur.regionId);
    const p = pricing();
    if (!p.ready) return;
    const meta = {
      kind: 'gift', giftId: g.id, brand: g.t, type: g.type,
      regionId: cur.regionId, cur: cur.payCur, value: cur.value,
      usd: baseUsd(), pay: p.pay, payFmt: fmtMoney(p.pay), tomanRial: p.tomanRial, usdIrr: p.usdIrr, rate: p.rate
    };
    const id = `gift:${g.id}:${cur.regionId}:${cur.payCur}:${cur.value}`;
    const title = titleFor(meta);
    if (window.SSCart) window.SSCart.add(id, title, 1, meta);
    const m = window.SSUI && window.SSUI.closeModal ? window.SSUI.closeModal($('#giftModal')) : null;
    if (window.SSUI && window.SSUI.openCart) setTimeout(() => window.SSUI.openCart(), 260);
  });
};
const clampTo = v => {
  const g = cur.gift;
  const mn = g.type === 'months' ? g.minM : g.min;
  const mx = g.type === 'months' ? g.maxM : g.max;
  const st = g.step || 1;
  v = Math.min(mx, Math.max(mn, Math.round(v / st) * st));
  return v;
};
const syncAmountUI = v => {
  const numIn = $('[data-gm-num]', panel), range = $('[data-gm-range]', panel);
  if (numIn) numIn.value = v;
  if (range) range.value = v;
  $$('.gm-amount', panel).forEach(x => x.classList.toggle('on', x.dataset.gmAmount !== 'custom' && +x.dataset.gmAmount === v));
};

/* ── open ── */
let lastOpen = { id: null, t: 0 };
const open = giftId => {
  const now = Date.now();
  if (lastOpen.id === giftId && now - lastOpen.t < 250) return; /* ضد دوباره‌زنی (اتصال مستقیم + delegation) */
  lastOpen.id = giftId; lastOpen.t = now;
  const g = findGift(giftId);
  if (!g) return;
  panel = $('#giftPanel');
  if (!panel) return;
  cur = { gift: g, regionId: g.regions[0].id, value: g.type === 'months' ? (g.monthOpts ? g.monthOpts[0] : g.minM) : (g.presets ? g.presets[0] : g.min), payCur: g.regions[0].cur };
  render();
  const m = $('#giftModal');
  if (m && window.SSUI) window.SSUI.openModal(m);
};

/* ── delegation + listeners ── */
document.addEventListener('click', e => {
  const el = e.target.closest('[data-gift-open]');
  if (el) { open(el.dataset.giftOpen); }
});
document.addEventListener('ss:lang', () => { if (cur && panel && !$('#giftModal').hidden) { const id = cur.gift.id; const keep = { regionId: cur.regionId, value: cur.value, payCur: cur.payCur }; const g = findGift(id); if (g) { cur = Object.assign({ gift: g }, keep); render(); } } });
if (window.SSRates) window.SSRates.subscribe(() => { if (cur && panel && $('#giftModal') && !$('#giftModal').hidden) { /* recalc فقط قیمت */ const tb = $('.gm-total', panel) || $('.gm-total.loading', panel); if (tb) render(); } });

/* ── public API ── */
window.SSGift = { open, metaLines, titleFor };
})();
