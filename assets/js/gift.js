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
/* آیتم‌های هوش مصنوعی (کاتالوگ ایرانیکارت) + PayPal (v39) */
const findAI = id => (window.SS_AI_TOOLS || []).find(a => a.id === id) || physProduct(id) || ppProduct(id);
/* ═ کارت‌های بین‌المللی (v37+v38) — مطابق ایرانیکارت: مدارک + قیمت زنده
   phys-mc: کارت فیزیکی مسترکارت (۳ نوع) — virt-visa / virt-mc / travel-mc: کارت‌های مجازی و سفر
   تعریف در config.js → SS_CONFIG.physCards / SS_CONFIG.virtCards (usd پایه قابل تنظیم) */
const physProduct = id => {
  if (id === 'phys-mc') {
    const c = (window.SS_CONFIG && window.SS_CONFIG.physCards) || {};
    if (c.enabled === false) return null;
    const types = (c.types && c.types.length ? c.types : [{ n: 'Viva Debit', nf: 'دبیت کارت فیزیکی ویوا', usd: 35 }, { n: 'Viva Credit', nf: 'کردیت کارت فیزیکی ویوا', usd: 45 }, { n: 'PoA Credit', nf: 'کردیت کارت اعتباری وکالتی', usd: 55 }]);
    return {
      id: 'phys-mc', t: 'Physical MasterCard', cat: 'card', phys: true,
      n: { fa: 'مستر کارت فیزیکی', en: 'Physical MasterCard', ar: 'ماستر كارد فيزيائية' },
      plans: types.map(x => ({ n: x.n, nf: x.nf || x.n, usd: +x.usd || 0 })),
      flds: ['fullname', 'phone', 'passport'], notes: 'phys', logo: 'mastercard-brand'
    };
  }
  const v = (window.SS_CONFIG && window.SS_CONFIG.virtCards) || {};
  if (v.enabled === false || !v.items || !v.items.length) return null;
  const it = v.items.find(x => x.id === id);
  if (!it) return null;
  const net = it.net === 'visa' ? 'visa' : 'mastercard';
  return {
    id: it.id, t: it.n || 'Virtual Card', cat: 'card', phys: true, virt: true,
    n: { fa: it.nf || it.n, en: it.n || 'Virtual Card', ar: it.n || 'بطاقة افتراضية' },
    plans: [{ n: '', nf: it.nf || it.n, usd: +it.usd || 0 }],
    flds: ['fullname', 'phone', 'passport'], notes: 'virt', logo: net + '-brand'
  };
};
/* ═ افتتاح حساب PayPal (v39 — مطابق فرم مرجع) ═
   pp-person / pp-business → مودال سفارش کامل:
   دو گزینه (شماره مجازی یک‌ساله / سیم‌کارت فیزیکی) با قیمت ثابت تومانی +
   سؤال پاسخ‌گویی به تماس + مشخصات پاسپورت (انگلیسی) + تاریخ تولد میلادی +
   ایمیل + رمز ایمیل + عکس پاسپورت الزامی — تعریف در config.js → SS_CONFIG.ppAcct */
const ppProduct = id => {
  const c = (window.SS_CONFIG && window.SS_CONFIG.ppAcct) || {};
  if (c.enabled === false) return null;
  const defs = {
    'pp-person':   { t: 'PayPal Personal', n: { fa: 'افتتاح حساب PayPal Personal', en: 'PayPal Personal Account', ar: 'فتح حساب PayPal Personal' } },
    'pp-business': { t: 'PayPal Business', n: { fa: 'افتتاح حساب PayPal Business', en: 'PayPal Business Account', ar: 'فتح حساب PayPal Business' } }
  };
  const d = defs[id];
  if (!d) return null;
  const plans = (c.plans && c.plans.length ? c.plans : [
    { id: 'virt', n: 'Virtual number (1 year)', nf: 'با شماره مجازی یک‌ساله', toman: 285000 },
    { id: 'sim',  n: 'Physical SIM card',       nf: 'با سیم‌کارت فیزیکی',     toman: 24312000 }
  ]);
  return {
    id, t: d.t, cat: 'pp', pp: true, ppToman: true,
    n: d.n,
    plans: plans.map(x => ({ n: x.n, nf: x.nf || x.n, usd: 0, toman: +x.toman || 0 })),
    flds: ['ppcall', 'pname', 'plname', 'dob', 'email', 'pw', 'passport'],
    notes: 'pp', logo: 'paypal-brand'
  };
};
const IC = () => window.SS_AI_IC || { unitRial: 2334000, premiumToman: 500000 };
/* ریجن‌های کارت + استخر کشورهای اضافی (بدون تکرار) — همه کشورها برای همه کارت‌ها */
const regionsAll = g => g.noExtra ? g.regions : g.regions.concat(((window.SS_DATA[window.SS_LANG || 'fa'] || window.SS_DATA.fa).regionsExtra || []).filter(r => !g.regions.some(x => x.id === r.id)));
const findRegion = (g, rid) => regionsAll(g).find(r => r.id === rid);

/* ═ فیلدهای مشخصات هر محصول (مثل آیدی تلگرام برای تلگرام پریمیوم) — الگو: ایران‌کارت
   هر فیلد: k=کلید، ui=برچسب (کلید ترجمه)، req=الزامی، d=جهت، t=type */
const FIELD_DEFS = {
  tg:    { ui: 'fld.tg',    req: true, d: 'ltr', t: 'text'  },
  email: { ui: 'fld.email', req: true, d: 'ltr', t: 'email' },
  dc:    { ui: 'fld.dc',    req: true, d: 'ltr', t: 'text'  },
  pid:   { ui: 'fld.pid',   req: true, d: 'ltr', t: 'text'  },
  rbx:   { ui: 'fld.rbx',   req: true, d: 'ltr', t: 'text'  },
  sp:    { ui: 'fld.sp',    req: true, d: 'ltr', t: 'text'  },
  acc:   { ui: 'fld.acc',   req: true, d: 'ltr', t: 'email' },
  user:  { ui: 'fld.user',  req: true, d: 'ltr', t: 'text'  },
  pw:    { ui: 'fld.pw',    req: true, d: 'ltr', t: 'password' },
  aid:   { ui: 'fld.aid',   req: true, d: 'ltr', t: 'email'  },
  fullname: { ui: 'fld.fullname', req: true, d: 'rtl', t: 'text' },
  phone:    { ui: 'fld.phone',    req: true, d: 'ltr', t: 'tel'   },
  passport: { ui: 'fld.passport', req: true, d: 'ltr', t: 'file'  },
  /* v39 — فرم افتتاح حساب PayPal */
  pname:  { ui: 'fld.pname',  req: true, d: 'ltr', t: 'text' },
  plname: { ui: 'fld.plname', req: true, d: 'ltr', t: 'text' },
  dob:    { ui: 'fld.dob',    req: true, d: 'ltr', t: 'date' },
  ppcall: { ui: 'fld.ppcall', req: true, t: 'radio', def: 'no', opts: [['no', 'fld.ppcall.no'], ['yes', 'fld.ppcall.yes']] }
};
const GIFT_FIELDS = {
  'gift-telegram': ['tg'],
  'gift-spotify':  ['sp'],
  'gift-netflix':  ['email'],
  'gift-youtube':  ['email'],
  'gift-discord':  ['dc'],
  'gift-chatgpt':  ['email'],
  'gift-canva':    ['email'],
  'gift-pubg':     ['pid'],
  'gift-ff':       ['pid'],
  'gift-roblox':   ['rbx'],
  /* شارژ والت با لاگین اکانت — ایمیل + رمز (الگوی ایران‌کارت) */
  'gift-ps':       ['acc', 'pw'],
  'gift-xbox':     ['acc', 'pw'],
  'gift-steam':    ['acc', 'pw'],
  'gift-epic':     ['acc', 'pw'],
  'gift-nintendo': ['acc', 'pw'],
  'gift-apple':    ['aid'],
  /* Task 49 — برندهای جدید (شارژ والت با لاگین اکانت / فعال‌سازی روی اکانت کاربر) */
  'gift-bnet':     ['acc', 'pw'],
  'gift-xboxgp':   ['acc', 'pw'],
  'gift-paypal':   ['acc'],
  'gift-skrill':   ['acc'],
  'gift-hulu':     ['email'],
  'gift-tidal':    ['email']
};
const fieldsFor = g => g ? (g.cat ? (g.flds || ['email']) : (GIFT_FIELDS[g.id] || [])).map(k => Object.assign({ k }, FIELD_DEFS[k])) : [];
const fieldInput = f => {
  const isPw = f.t === 'password';
  /* v39 — رادیو بله/خیر (سؤال پاسخ‌گویی به تماس) */
  if (f.t === 'radio') {
    const v = (cur.fvals && cur.fvals[f.k]) || f.def || '';
    return `<div class="gm-radio" role="radiogroup" data-gf-radio="${f.k}">${(f.opts || []).map(o => `<button type="button" class="gm-chip${v === o[0] ? ' on' : ''}" data-gf-rval="${o[0]}" aria-pressed="${v === o[0]}">${escapeHtml(t(o[1]))}</button>`).join('')}</div>`;
  }
  /* v39 — تاریخ میلادی (تاریخ تولد) */
  if (f.t === 'date') {
    return `<input type="date" class="gm-field gm-date" data-gf="${f.k}" dir="ltr" value="${escapeHtml((cur.fvals && cur.fvals[f.k]) || '')}" aria-label="${escapeHtml(t(f.ui))}">`;
  }
  if (f.t === 'file') {
    return `<div class="gm-filewrap">
      <input type="file" accept="image/*" class="gm-file-input" data-gf-file="${f.k}" hidden>
      <button type="button" class="gm-file-btn" data-gf-filebtn="${f.k}"><svg class="ic" viewBox="0 0 24 24"><use href="#i-plus"/></svg>${escapeHtml(t('fld.file.pick'))}</button>
      <img class="gm-file-thumb" data-gf-thumb="${f.k}" alt="" hidden>
      <span class="gm-file-name" data-gf-fname="${f.k}"></span>
      <span class="gm-file-ok" data-gf-ok="${f.k}" hidden>✓ ${escapeHtml(t('fld.file.ok'))}</span>
    </div>`;
  }
  const inp = `<input type="${f.t || 'text'}" class="gm-field" data-gf="${f.k}" dir="${f.d || 'ltr'}" placeholder="${escapeHtml(t(f.ui + '.ph'))}" autocomplete="${isPw ? 'new-password' : 'off'}" spellcheck="false" value="${escapeHtml(cur.fvals[f.k] || '')}" aria-label="${escapeHtml(t(f.ui))}">`;
  return isPw ? `<div class="gm-fldwrap">${inp}<button type="button" class="gm-eye" data-gf-eye aria-label="${escapeHtml(t('fld.pw.eye'))}" title="${escapeHtml(t('fld.pw.eye'))}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3.2"/></svg></button></div>` : inp;
};
const fieldsUI = g => {
  const defs = fieldsFor(g);
  if (!defs.length) return '';
  cur.fvals = cur.fvals || {};
  cur.fdocs = cur.fdocs || {};
  /* مقدار پیش‌فرض رادیو (مثل «خیر» در فرم مرجع) */
  defs.forEach(f => { if (f.t === 'radio' && !cur.fvals[f.k]) cur.fvals[f.k] = f.def || ''; });
  return `<div class="gm-sec gm-flds-sec"><h4>${escapeHtml(t('gift.cfg.fields'))}</h4>
    ${defs.map(f => `<label class="gm-fld"><span>${escapeHtml(t(f.ui))}${f.req ? ' <i class="gm-req" aria-hidden="true">*</i>' : ''}</span>
      ${fieldInput(f)}</label>`).join('')}
    <p class="gm-note">${escapeHtml(t('gift.cfg.fieldsNote'))}</p></div>`;
};
const collectFields = g => {
  const defs = fieldsFor(g);
  if (!defs.length) return [];
  cur.fvals = cur.fvals || {};
  $$('.gm-field', panel).forEach(inp => { cur.fvals[inp.dataset.gf] = (inp.value || '').trim(); });
  /* فیلدهای فایل (مدارک) — مقدارشان در cur.fdocs است */
  const fdefs = defs.filter(f => f.t === 'file');
  for (const f of fdefs) {
    if (f.req && !(cur.fdocs && cur.fdocs[f.k] && cur.fdocs[f.k].dataUrl)) {
      const btn = panel.querySelector(`[data-gf-filebtn="${f.k}"]`);
      if (btn) { btn.classList.add('err'); btn.focus(); }
      if (window.SSUI && window.SSUI.toast) window.SSUI.toast(t('fld.file.req'));
      return null;
    }
  }
  const textDefs = defs.filter(f => f.t !== 'file');
  const missing = textDefs.find(f => f.req && !(cur.fvals[f.k] || '').trim());
  if (missing) {
    const inp = panel.querySelector('.gm-field[data-gf="' + missing.k + '"]');
    if (inp) { inp.classList.add('err'); inp.focus(); }
    if (window.SSUI && window.SSUI.toast) window.SSUI.toast(t('gift.cfg.fieldReq').replace('{f}', t(missing.ui)));
    return null;
  }
  const out = textDefs.filter(f => (cur.fvals[f.k] || '').trim()).map(f => {
    let v = cur.fvals[f.k];
    if (f.t === 'radio') { const o = (f.opts || []).find(x => x[0] === v); v = o ? t(o[1]) : v; }
    return { l: t(f.ui), v };
  });
  fdefs.forEach(f => { if (cur.fdocs && cur.fdocs[f.k]) out.push({ l: t(f.ui), v: cur.fdocs[f.k].name || t('fld.file.pick'), doc: true }); });
  return out;
};
/* اسناد آپلودشده (dataURL) — برای ارسال به تلگرام در صفحه پرداخت */
const collectDocs = g => {
  const defs = fieldsFor(g).filter(f => f.t === 'file');
  if (!defs.length || !cur.fdocs) return [];
  return defs.filter(f => cur.fdocs[f.k]).map(f => ({ l: t(f.ui), name: cur.fdocs[f.k].name, dataUrl: cur.fdocs[f.k].dataUrl }));
};

/* ── کارت فیزیکی: نکات مهم (مطابق ایرانیکارت) ── */
const physNotes = () => `<div class="gm-sec"><h4>${escapeHtml(t('phys.notes'))}</h4><ul class="gm-phys-notes">
  <li>${escapeHtml(t('phys.note1'))}</li>
  <li>${escapeHtml(t('phys.note2'))}</li>
  <li>${escapeHtml(t('phys.note3'))}</li>
  <li>${escapeHtml(t('phys.note4'))}</li>
</ul></div>`;
/* ── کارت مجازی / سفر: نکات مهم (v38) ── */
const virtNotes = () => `<div class="gm-sec"><h4>${escapeHtml(t('card.vnotes'))}</h4><ul class="gm-phys-notes">
  <li>${escapeHtml(t('card.note1'))}</li>
  <li>${escapeHtml(t('card.note2'))}</li>
  <li>${escapeHtml(t('card.note3'))}</li>
  <li>${escapeHtml(t('card.note4'))}</li>
</ul></div>`;
/* ── PayPal: نکات مهم افتتاح حساب (v39) ── */
const ppNotes = () => `<div class="gm-sec"><h4>${escapeHtml(t('pp.notes'))}</h4><ul class="gm-phys-notes">
  <li>${escapeHtml(t('pp.note1'))}</li>
  <li>${escapeHtml(t('pp.note2'))}</li>
  <li>${escapeHtml(t('pp.note3'))}</li>
  <li>${escapeHtml(t('pp.note4'))}</li>
</ul></div>`;
/* ── آپلود و فشرده‌سازی عکس مدارک (پاسپورت) ── */
const fileToDoc = file => new Promise(res => {
  try {
    const fr = new FileReader();
    fr.onload = () => {
      const img = new Image();
      img.onload = () => {
        const MAXD = 1500, MAXB = 480 * 1024;
        const w = img.width || img.naturalWidth || 1000, h = img.height || img.naturalHeight || 1000;
        const sc = Math.min(1, MAXD / Math.max(w, h));
        const draw = (scale, q) => {
          const c = document.createElement('canvas');
          c.width = Math.max(1, Math.round(w * scale)); c.height = Math.max(1, Math.round(h * scale));
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          return c.toDataURL('image/jpeg', q);
        };
        let out = draw(sc, 0.75);
        if (out.length > MAXB) out = draw(sc * 0.75, 0.6);
        if (out.length > MAXB) out = draw(sc * 0.5, 0.55);
        res({ dataUrl: out, name: file.name || 'passport.jpg' });
      };
      img.onerror = () => res(null);
      img.src = fr.result;
    };
    fr.onerror = () => res(null);
    fr.readAsDataURL(file);
  } catch (e) { res(null); }
});

/* ── pricing ── */
const baseUsd = () => {
  if (!cur) return 0;
  const g = cur.gift;
  if (g.type === 'months') return g.tiers ? (g.tiers[cur.value] || 0) : g.perMonth * cur.value;
  if (g.cat && g.plans) return (g.plans[cur.planIdx] || g.plans[0]).usd;
  return cur.value;
};
const aiRial = () => {
  /* قیمت = (دلار + ۱$) × نرخ لحظه‌ای دلار بازار + ۵۰۰٬۰۰۰ تومان خدمات استارشاپ
     نرخ زنده SSRates (tgju، هر ۱۲ ثانیه) — فالبک: نرخ آخر ایرانیکارت */
  const ic = IC();
  const st = window.SSRates ? window.SSRates.get() : null;
  const live = st && st.usdIrr ? st.usdIrr : 0;
  const rate = live || ic.unitRial;
  const extraUsd = (cur.gift && cur.gift.phys) ? 0 : 1; /* کارت فیزیکی: فقط ۵۰۰ هزار تومان بیشتر از ایرانیکارت */
  const pc = window.SS_CONFIG && window.SS_CONFIG.physCards;
  const prem = (cur.gift && cur.gift.phys && pc && typeof pc.premiumToman === 'number') ? pc.premiumToman : (ic.premiumToman || 500000);
  return { rial: (baseUsd() + extraUsd) * rate + prem * 10, live: !!live, rate };
};
const pricing = () => {
  const R = window.SSRates; const st = R ? R.get() : null;
  /* v39 — PayPal: قیمت ثابت تومانی گزینه انتخابی (مستقل از دلار) */
  if (cur.gift.ppToman) {
    const pls = cur.gift.plans || [];
    const pl = pls[cur.planIdx] || pls[0] || {};
    const rial = (+pl.toman || 0) * 10;
    return { rate: 0, approx: false, pay: rial, tomanRial: rial, usdIrr: (st && st.usdIrr) || 0, markup: 0, ready: rial > 0, pp: true };
  }
  const usdIrr = st && st.usdIrr ? st.usdIrr : 0;
  const curCode = cur.payCur;
  if (cur.gift.cat) {
    /* هوش مصنوعی: (دلار+۱) × نرخ لحظه‌ای + ۵۰۰٬۰۰۰ تومان — پرداخت صرفاً تومانی */
    const a = aiRial();
    return { rate: a.rate / 10, approx: !a.live, pay: a.rial, tomanRial: a.rial, usdIrr: a.rate, markup: 0, ready: true, ic: true };
  }
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
  const g = findGift(meta.giftId) || findAI(meta.giftId) || { t: meta.brand, n: { fa: meta.brand, en: meta.brand, ar: meta.brand } };
  const nm = g.n ? (g.n[window.SS_LANG || 'fa'] || g.t) : g.t;
  if (meta.type === 'ppplan') return meta.planName ? `${nm} — ${meta.planName}` : nm;
  if (meta.type === 'plans') {
    const base = `${t('pay.card')} ${nm}`;
    return meta.planName ? `${base} — ${meta.planName}` : base;
  }
  if (meta.type === 'aiusd') return `${t('pay.ai')} ${nm} — ${localDig(meta.value)}$`;
  return meta.type === 'months'
    ? `${t('pay.gift')} ${g.t} — ${localDig(meta.value)} ${t('cart.meta.month')}`
    : `${t('pay.gift')} ${g.t} — ${localDig(meta.value)}$`;
};

/* ── meta lines (سبد + پیام سفارش) ── */
const metaLines = item => {
  const m = item.meta || {};
  if (m.kind !== 'gift') return [];
  const g = findGift(m.giftId) || findAI(m.giftId);
  if (!g || g.cat) {
    if (g && g.cat) {
      const nmAll = g.n ? (g.n[window.SS_LANG || 'fa'] || g.t) : g.t;
      const headLines = [
        (m.type === 'plans' || m.type === 'ppplan') ? `${t('cart.meta.plan')}: ${m.planName || nmAll}` : `${t('cart.meta.amount')}: ${localDig(m.value)} USD`,
        `${t('cart.meta.pay')}: ~${fmtToman(m.tomanRial)} ${t('rates.toman')}`
      ];
      const tailLines = m.type === 'ppplan'
        ? [`${t('pp.fixedPrice')}`]
        : [`${t('cart.meta.icRate')}: 1$ = ${m.usdIrr ? fmtMoney(m.usdIrr, 0) : '—'} IRR`, `${t('gift.cfg.icNote')}`];
      return headLines.concat(tailLines)
        .concat((m.fields || []).map(f => `${f.l}: ${f.v}`))
        .concat((m.docs && m.docs.length) ? [`📎 ${t('phys.docsNote')}`] : []);
    }
    return [];
  }
  const r = findRegion(g, m.regionId);
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
  return lines.concat((m.fields || []).map(f => `${f.l}: ${f.v}`));
};

/* ── render ── */
const render = () => {
  if (!cur || !panel) return;
  const g = cur.gift;
  if (g.cat) return renderAI();
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
    ${fieldsUI(g)}
    ${totalBox}
    <button class="btn btn-primary btn-lg w100" type="button" data-gm-add ${p.ready ? '' : 'disabled'}><svg class="ic" viewBox="0 0 24 24"><use href="#i-cart"/></svg>${t('gift.cfg.add')}</button>`;

  bindPanel();
};

/* ── render مودال هوش مصنوعی (کاتالوگ ایرانیکارت) ── */
const renderAI = () => {
  const g = cur.gift;
  const p = pricing();
  const lang = window.SS_LANG || 'fa';
  const nm = g.n ? (g.n[lang] || g.t) : g.t;

  const head = `
    <button class="modal-close" data-close-modal aria-label="${escapeHtml(t('cart.close'))}"><svg class="ic" viewBox="0 0 24 24"><use href="#i-close"/></svg></button>
    <div class="gm-head">
      <span class="gm-logo ai-logo"><img src="${g.logo ? `assets/logos/${g.logo}.svg` : (g.phys ? 'assets/logos/mastercard-brand.svg' : `assets/logos/ai/${g.id}.webp?v=20260932`)}" alt="" width="48" height="48"></span>
      <div><span class="chip">${g.pp ? t('pay.pp') : (g.phys ? t('pay.card') : t('pay.ai'))}</span><h3 id="gmTitle">${escapeHtml(nm)}</h3><p dir="ltr">${escapeHtml(g.t)}</p></div>
    </div>`;

  if (g.avail === false) {
    panel.innerHTML = `${head}
      <p class="gm-note" style="margin-top:18px">${t('ai.unavail')}</p>`;
    bindPanel();
    return;
  }

  let chooseUI = '';
  if (g.plans && g.plans.length > 1) {
    /* v39 — PayPal: قیمت گزینه‌ها تومانی ثابت / کارت‌ها: دلاری با نرخ لحظه‌ای */
    const priceBit = pl => g.ppToman
      ? `<b>${fmtToman((+pl.toman || 0) * 10)} <i>${escapeHtml(t('rates.toman'))}</i></b>`
      : `<b dir="ltr">${localDig(pl.usd)}$</b>`;
    chooseUI = `
      <div class="gm-chips gm-months">${g.plans.map((pl, i) => `
        <button type="button" class="gm-chip${i === cur.planIdx ? ' on' : ''}" data-gm-plan="${i}"><span>${escapeHtml(pl.nf && lang === 'fa' ? pl.nf : pl.n)}</span>${priceBit(pl)}</button>`).join('')}
      </div>
      <div class="gm-range-note">${t(g.ppToman ? 'pp.pickType' : 'ai.pickPlan')}</div>`;
  } else if (g.plans) {
    /* کارت تک‌نوعه (v38) — نمایش ثابت نوع کارت بدون چیپ انتخابی */
    const pl = g.plans[0];
    chooseUI = `
      <div class="gm-chips gm-months"><span class="gm-chip on gm-single"><span>${escapeHtml(lang === 'fa' && pl.nf ? pl.nf : (pl.n || nm))}</span><b dir="ltr">${localDig(pl.usd)}$</b></span></div>`;
  } else {
    const presets = (g.presets || []).map(v => `<button type="button" class="gm-chip gm-amount${v === cur.value ? ' on' : ''}" data-gm-amount="${v}">${localDig(v)}$</button>`).join('');
    chooseUI = `
      <div class="gm-presets">${presets}
        <button type="button" class="gm-chip gm-amount${!(g.presets || []).includes(cur.value) ? ' on' : ''}" data-gm-amount="custom">${t('gift.cfg.custom')}</button>
      </div>
      <div class="gm-slider-row">
        <input type="range" class="gm-range" data-gm-range min="${g.min}" max="${g.max}" step="${g.step}" value="${cur.value}" dir="ltr" aria-label="${escapeHtml(t('gift.cfg.amount'))}">
        <input type="number" class="gm-num" data-gm-num min="${g.min}" max="${g.max}" step="${g.step}" value="${cur.value}" dir="ltr" inputmode="numeric" aria-label="${escapeHtml(t('gift.cfg.amount'))}">
      </div>
      <div class="gm-range-note">${localDig(g.min)}$ – ${localDig(g.max)}$ · ${t('ai.customNote')}</div>`;
  }

  const totalBox = `
    <div class="gm-total">
      <span class="gm-total-label">${t('gift.cfg.total')}</span>
      <b class="gm-total-val">${fmtToman(p.pay)} <i>${t('rates.toman')}</i></b>
      ${g.ppToman
        ? `<span class="gm-total-base">${t('pp.priceNote')}</span>`
        : `<span class="gm-total-base">${t('gift.cfg.icNote')}</span>
      <span class="gm-rate" dir="ltr">${t('ai.icRate').replace('{rate}', fmtMoney(p.rate, 0))}</span>`}
    </div>`;

  panel.innerHTML = `${head}${g.notes === 'virt' ? virtNotes() : (g.notes === 'pp' ? ppNotes() : (g.phys ? physNotes() : ''))}
    <div class="gm-sec"><h4>${g.ppToman ? t('pp.type') : (g.plans ? t('ai.plans') : t('gift.cfg.amount'))}</h4>${chooseUI}</div>
    ${fieldsUI(g)}
    ${totalBox}
    <button class="btn btn-primary btn-lg w100" type="button" data-gm-add><svg class="ic" viewBox="0 0 24 24"><use href="#i-cart"/></svg>${t('gift.cfg.add')}</button>`;

  bindPanel();
};

const brandClass = g => {
  const map = { 'gift-apple':'apple', 'gift-steam':'steam', 'gift-ps':'ps', 'gift-xbox':'xbox', 'gift-amazon':'amazon', 'gift-pubg':'pubg', 'gift-ff':'ff', 'gift-netflix':'netflix', 'gift-gplay':'gplay', 'gift-spotify':'spotify', 'gift-telegram':'tg', 'gift-youtube':'yt', 'gift-discord':'discord', 'gift-chatgpt':'gpt', 'gift-canva':'canva', 'gift-razer':'razer', 'gift-roblox':'roblox', 'gift-nintendo':'nintendo', 'gift-epic':'epic', 'gift-visa':'visa', 'gift-master':'mc', 'gift-hulu':'hulu', 'gift-tidal':'tidal', 'gift-paypal':'paypal', 'gift-walmart':'walmart', 'gift-target':'target', 'gift-nike':'nike', 'gift-uber':'uber', 'gift-ebay':'ebay', 'gift-huawei':'huawei', 'gift-skrill':'skrill', 'gift-bnet':'bnet', 'gift-xboxgp':'xbox' };
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
  $$('[data-gm-plan]', panel).forEach(b => b.addEventListener('click', () => {
    cur.planIdx = +b.dataset.gmPlan;
    render();
  }));
  $$('[data-gm-cur]', panel).forEach(b => b.addEventListener('click', () => { cur.payCur = b.dataset.gmCur; render(); }));
  /* v39 — رادیو بله/خیر (سؤال پاسخ‌گویی به تماس) — بدون رندر مجدد */
  $$('[data-gf-rval]', panel).forEach(b => b.addEventListener('click', () => {
    const grp = b.closest('[data-gf-radio]');
    if (!grp || !cur) return;
    cur.fvals = cur.fvals || {};
    cur.fvals[grp.dataset.gfRadio] = b.dataset.gfRval;
    $$('[data-gf-rval]', grp).forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
  }));
  /* آپلود عکس مدارک (کارت فیزیکی) */
  $$('[data-gf-filebtn]', panel).forEach(b => b.addEventListener('click', () => {
    const inp = panel.querySelector(`[data-gf-file="${b.dataset.gfFilebtn}"]`); if (inp) inp.click();
  }));
  $$('[data-gf-file]', panel).forEach(inp => inp.addEventListener('change', async () => {
    const k = inp.dataset.gfFile, f = inp.files && inp.files[0];
    const btn = panel.querySelector(`[data-gf-filebtn="${k}"]`); if (btn) btn.classList.remove('err');
    if (!f) return;
    if (!/^image\//.test(f.type)) { if (window.SSUI && window.SSUI.toast) window.SSUI.toast(t('fld.file.notimg')); inp.value = ''; return; }
    if (f.size > 12 * 1024 * 1024) { if (window.SSUI && window.SSUI.toast) window.SSUI.toast(t('fld.file.big')); inp.value = ''; return; }
    const doc = await fileToDoc(f);
    if (!doc) { if (window.SSUI && window.SSUI.toast) window.SSUI.toast(t('fld.file.big')); return; }
    cur.fdocs = cur.fdocs || {}; cur.fdocs[k] = doc;
    const th = panel.querySelector(`[data-gf-thumb="${k}"]`); if (th) { th.src = doc.dataUrl; th.hidden = false; }
    const nm = panel.querySelector(`[data-gf-fname="${k}"]`); if (nm) nm.textContent = doc.name;
    const ok = panel.querySelector(`[data-gf-ok="${k}"]`); if (ok) ok.hidden = false;
    if (btn) btn.innerHTML = `<svg class="ic" viewBox="0 0 24 24"><use href="#i-check"/></svg>${escapeHtml(t('fld.file.repick'))}`;
  }));
  const add = $('[data-gm-add]', panel);
  if (add) add.addEventListener('click', () => {
    const g = cur.gift;
    const p = pricing();
    if (!p.ready) return;
    const flds = collectFields(g);
    if (flds === null) return;
    if (g.cat) {
      const pl = g.plans ? (g.plans[cur.planIdx] || g.plans[0]) : null;
      const meta = {
        kind: 'gift', giftId: g.id, brand: g.t, type: g.ppToman ? 'ppplan' : (g.plans ? 'plans' : 'aiusd'),
        phys: !!g.phys,
        cur: 'IRR', value: g.plans ? cur.planIdx : cur.value,
        planName: pl ? (g.ppToman ? ((window.SS_LANG || 'fa') === 'fa' && pl.nf ? pl.nf : pl.n) : (pl.n || '')) : '',
        usd: baseUsd(), pay: p.pay, tomanRial: p.tomanRial, usdIrr: p.usdIrr, rate: p.rate, fields: flds,
        docs: collectDocs(g)
      };
      const id = `gift:${g.id}:${g.plans ? 'p' + cur.planIdx : 'usd' + cur.value}`;
      const title = titleFor(meta);
      if (window.SSCart) window.SSCart.add(id, title, 1, meta);
      if (window.SSUI && window.SSUI.closeModal) window.SSUI.closeModal($('#giftModal'));
      if (window.SSUI && window.SSUI.openCart) setTimeout(() => window.SSUI.openCart(), 260);
      return;
    }
    const region = findRegion(g, cur.regionId);
    const meta = {
      kind: 'gift', giftId: g.id, brand: g.t, type: g.type,
      regionId: cur.regionId, cur: cur.payCur, value: cur.value,
      usd: baseUsd(), pay: p.pay, payFmt: fmtMoney(p.pay), tomanRial: p.tomanRial, usdIrr: p.usdIrr, rate: p.rate, fields: flds
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
  const a = g ? null : findAI(giftId);
  if (!g && !a) return;
  panel = $('#giftPanel');
  if (!panel) return;
  if (a) {
    const ai = Object.assign({}, a, a.custom ? { min: 5, max: 500, step: 1, presets: [10, 20, 50, 100] } : {});
    cur = { gift: ai, planIdx: 0, value: a.custom ? 10 : 0, payCur: 'IRR', fvals: {}, fdocs: {} };
  } else {
    cur = { gift: g, regionId: g.regions[0].id, value: g.type === 'months' ? (g.monthOpts ? g.monthOpts[0] : g.minM) : (g.presets ? g.presets[0] : g.min), payCur: g.regions[0].cur, fvals: {} };
  }
  render();
  const m = $('#giftModal');
  if (m && window.SSUI) window.SSUI.openModal(m);
};

/* ── delegation + listeners ── */
document.addEventListener('click', e => {
  const el = e.target.closest('[data-gift-open]');
  if (el) { open(el.dataset.giftOpen); }
});
/* حفظ مقادیر فیلدهای مشخصات هنگام تغییر گزینه‌ها (رندر مجدد) + پاک‌کردن خطا هنگام تایپ */
document.addEventListener('input', e => {
  const inp = e.target.closest ? e.target.closest('.gm-field') : null;
  if (inp && cur && panel && panel.contains(inp)) {
    cur.fvals = cur.fvals || {};
    cur.fvals[inp.dataset.gf] = inp.value;
    inp.classList.remove('err');
  }
});
/* نمایش/مخفی‌کردن رمز اکانت */
document.addEventListener('click', e => {
  const eye = e.target.closest ? e.target.closest('.gm-eye') : null;
  if (eye && panel && panel.contains(eye)) {
    const inp = $('.gm-field[data-gf="pw"]', panel);
    if (inp) { inp.type = inp.type === 'password' ? 'text' : 'password'; eye.classList.toggle('on'); }
  }
});
document.addEventListener('ss:lang', () => { if (cur && panel && !$('#giftModal').hidden) { const id = cur.gift.id; const keep = cur.gift.cat ? { planIdx: cur.planIdx, value: cur.value, payCur: cur.payCur, fvals: cur.fvals } : { regionId: cur.regionId, value: cur.value, payCur: cur.payCur, fvals: cur.fvals }; const g = findGift(id) || findAI(id); if (g) { cur = Object.assign({ gift: g.cat ? Object.assign({}, g, g.custom ? { min: 5, max: 500, step: 1, presets: [10, 20, 50, 100] } : {}) : g }, keep); render(); } } });
if (window.SSRates) window.SSRates.subscribe(() => { if (cur && panel && $('#giftModal') && !$('#giftModal').hidden) { /* recalc فقط قیمت */ const tb = $('.gm-total', panel) || $('.gm-total.loading', panel); if (tb) render(); } });

/* ── public API ── */
window.SSGift = { open, metaLines, titleFor };
})();
