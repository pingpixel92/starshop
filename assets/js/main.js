/* ═══════════════════════════════════════════════════
   STARSHOP — main.js  (no frameworks)
   همه رندرها data-driven هستند تا سه‌زبانه کامل باشد
   ═══════════════════════════════════════════════════ */
(() => {
'use strict';

/* ── utils ── */
const $  = (s, c) => (c || document).querySelector(s);
const $$ = (s, c) => Array.from((c || document).querySelectorAll(s));
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const touch   = matchMedia('(hover: none), (pointer: coarse)').matches;
const clamp   = (v, a, b) => Math.min(b, Math.max(a, v));

const escapeHtml = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const localDig = n => {
  const lang = window.SS_LANG || 'fa';
  if (lang === 'fa') return String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
  if (lang === 'ar') return String(n).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
  return String(n);
};
const normTxt = s => String(s || '')
  .replace(/[\u064A]/g, '\u06CC').replace(/[\u0643]/g, '\u06A9')
  .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
  .replace(/[\u06F0-\u06F9]/g, d => String(d.charCodeAt(0) - 0x06F0))
  .replace(/[\u0660-\u0669]/g, d => String(d.charCodeAt(0) - 0x0660))
  .replace(/\u200c/g, ' ').toLowerCase().trim();
const faToEn = s => String(s || '').replace(/[\u06F0-\u06F9]/g, d => String(d.charCodeAt(0) - 0x06F0)).replace(/[\u0660-\u0669]/g, d => String(d.charCodeAt(0) - 0x0660)).replace(/\u200c/g, '');

/* ── i18n bridge ── */
const D = () => window.SS_DATA[window.SS_LANG || 'fa'] || window.SS_DATA.fa;
const t = k => {
  const lang = window.SS_LANG || 'fa';
  const dd = window.SS_DATA[lang] || window.SS_DATA.fa;
  const fdd = window.SS_DATA.fa;
  let v = dd.ui[k]; if (v != null) return v;
  if (dd.order) { v = dd.order[k.replace(/^order\./, '')]; if (v != null) return v; }
  v = fdd.ui[k]; if (v != null) return v;
  if (fdd.order) { v = fdd.order[k]; if (v != null) return v; }
  return k;
};
const fmt = (s, o) => String(s).replace(/\{(\w+)\}/g, (_, k) => o && o[k] != null ? o[k] : '');
const catLabel = id => { const c = D().cats.find(c => c.id === id); return c ? c.label : ''; };
const getService = id => D().services.find(s => s.id === id);

/* ── toast ── */
let toastTimer;
const toast = msg => {
  const el = $('#toast'); if (!el) return;
  el.textContent = msg; el.hidden = false;
  requestAnimationFrame(() => el.classList.add('show'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.hidden = true, 450); }, 3000);
};

/* ═════════ DYNAMIC RENDERS (from SS_DATA) ═════════ */

const renderHeroCard = () => {
  const ul = $('#heroCardList'); if (!ul) return;
  ul.innerHTML = D().heroList.map(x => `<li><button data-service="${x.svc}"><svg class="ic" viewBox="0 0 24 24"><use href="#i-${x.icon}"/></svg>${escapeHtml(x.t)}<svg class="ic go" viewBox="0 0 24 24"><use href="#i-arrow"/></svg></button></li>`).join('');
};

const renderQuick = () => {
  const grid = $('#quickGrid'); if (!grid) return;
  grid.innerHTML = ['pay-web','pp-person','gift-cards','card-visa','ai-chatgpt','shop-link','income-freelance','exam-reg'].map(id => {
    const s = getService(id); if (!s) return '';
    return `<button class="qs" role="listitem" data-service="${s.id}" aria-label="${escapeHtml(s.title)}">
      <span class="card-ic"><svg class="ic" viewBox="0 0 24 24"><use href="#i-${s.icon}"/></svg></span>
      <h3>${escapeHtml(s.title)}</h3><p>${escapeHtml(s.desc.split('؛')[0].split('.')[0])}.</p>
      <span class="go"><svg class="ic" viewBox="0 0 24 24"><use href="#i-arrow"/></svg></span>
    </button>`;
  }).join('');
};

let activeCat = 'payments';
const renderExplorer = () => {
  const tabs = $('#explorerTabs'), panels = $('#explorerPanels');
  if (!tabs || !panels) return;
  tabs.innerHTML = D().cats.map(c =>
    `<button class="tab" role="tab" id="tab-${c.id}" aria-selected="${c.id === activeCat}" aria-controls="panel-${c.id}" data-cat="${c.id}">${escapeHtml(c.label)}</button>`
  ).join('');
  panels.innerHTML = D().cats.map(c => {
    const items = D().services.filter(s => s.cat === c.id);
    return `<div class="panel${c.id === activeCat ? ' active' : ''}" role="tabpanel" id="panel-${c.id}" aria-labelledby="tab-${c.id}" data-cat="${c.id}">
      ${items.map(s => `<article class="card" data-service="${s.id}" role="button" tabindex="0" aria-label="${escapeHtml(s.title)}">
        <span class="card-ic"><svg class="ic" viewBox="0 0 24 24"><use href="#i-${s.icon}"/></svg></span>
        <h3>${escapeHtml(s.title)}</h3><p>${escapeHtml(s.desc)}</p><span class="chip">${t('chip.detail')}</span>
        <span class="card-go"><svg class="ic" viewBox="0 0 24 24"><use href="#i-arrow"/></svg></span>
      </article>`).join('')}
    </div>`;
  }).join('');
  tabs.addEventListener('click', e => {
    const b = e.target.closest('.tab'); if (b) switchCat(b.dataset.cat);
  });
  tabs.addEventListener('keydown', e => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const list = $$('.tab', tabs);
    const i = list.findIndex(x => x.getAttribute('aria-selected') === 'true');
    const nx = e.key === 'ArrowLeft' ? (i + 1) % list.length : (i - 1 + list.length) % list.length;
    list[nx].focus(); switchCat(list[nx].dataset.cat);
  });
};
const setPanelHeight = () => {
  const panels = $('#explorerPanels'); if (!panels) return;
  const p = $('.panel.active', panels);
  panels.style.height = p ? p.offsetHeight + 'px' : 'auto';
};
const switchCat = id => {
  const panels = $('#explorerPanels'); if (!panels || id === activeCat) return;
  const tabs = $('#explorerTabs');
  const oldIdx = D().cats.findIndex(c => c.id === activeCat);
  const newIdx = D().cats.findIndex(c => c.id === id);
  panels.classList.toggle('rev', newIdx < oldIdx);
  const oldP = $('.panel.active', panels);
  const newP = $(`.panel[data-cat="${id}"]`, panels);
  if (oldP) oldP.classList.remove('active');
  if (newP) newP.classList.add('active');
  $$('.tab', tabs).forEach(x => x.setAttribute('aria-selected', String(x.dataset.cat === id)));
  activeCat = id;
  setPanelHeight();
};

const renderSelect = () => {
  const sel = $('#contactForm select[name="service"]'); if (!sel) return;
  const cur = sel.value;
  sel.innerHTML = `<option value="" selected disabled>${t('cm.select')}</option>` +
    D().cats.map(c => `<optgroup label="${escapeHtml(c.label)}">` +
      D().services.filter(s => s.cat === c.id).map(s => `<option value="${s.id}">${escapeHtml(s.title)}</option>`).join('') +
    '</optgroup>').join('');
  if (cur) sel.value = cur;
};

const renderPay = () => {
  const g = $('#payGrid'); if (!g) return;
  g.innerHTML = D().payCards.map(c => `<a class="card pay-card" href="#services" data-service="${c.svc}"><span class="card-ic"><svg class="ic" viewBox="0 0 24 24"><use href="#i-${c.icon}"/></svg></span><h3>${escapeHtml(c.t)}</h3><p>${escapeHtml(c.d)}</p><span class="card-go"><svg class="ic" viewBox="0 0 24 24"><use href="#i-arrow"/></svg></span></a>`).join('');
};

const renderAI = () => {
  const g = $('#aiGrid'); if (!g) return;
  g.innerHTML = D().aiCards.map((c, i) => {
    const mark = c.logo === 'star-w'
      ? `<svg class="ic" style="width:26px;height:26px" viewBox="0 0 24 24"><use href="#i-star"/></svg>`
      : `<img src="assets/logos/${c.logo}.svg" alt="" width="30" height="30">`;
    return `<article class="card ai-card${c.big ? ' big' : ''}" data-reveal data-reveal-delay="${i * 80}" data-service="${c.svc}" role="button" tabindex="0">
      <div class="ai-mark${c.mk ? ' ' + c.mk : ''}" aria-hidden="true">${mark}</div>
      <div class="ai-body"><h3>${escapeHtml(c.t)}</h3><p>${escapeHtml(c.d)}</p><span class="chip">${t('chip.buy')}</span></div>
    </article>`;
  }).join('');
};

const renderGifts = () => {
  const g = $('#giftTrack'); if (!g) return;
  g.innerHTML = D().gifts.map((x, i) => {
    const cls = ({'Apple':'gc-apple','Steam':'gc-steam','PlayStation':'gc-ps','Xbox':'gc-xbox','Amazon':'gc-amazon','PUBG':'gc-pubg','Free Fire':'gc-ff','Netflix':'gc-netflix','Google Play':'gc-gplay'}[x.t]) || 'gc-steam';
    return `<li class="gift ${cls}" data-gift-open="${x.id}" role="button" tabindex="0" aria-label="${t('gift.add')} — ${escapeHtml(x.t)}" style="animation-delay:${i * 40}ms">
      <span class="gift-logo" aria-hidden="true"><img src="assets/logos/${x.logo}.svg" alt="" width="52" height="52" loading="lazy"></span>
      <h3>${escapeHtml(x.t)}</h3><p>${escapeHtml(x.d)}</p>
      <span class="chip chip-dark gift-add"><svg class="ic" viewBox="0 0 24 24"><use href="#i-plus"/></svg>${t('gift.add')}</span>
    </li>`;
  }).join('');
};

const renderBanks = () => {
  const g = $('#bankGrid'); if (!g) return;
  g.innerHTML = D().bankCards.map((b, i) => `<div class="tilt-wrap" data-reveal data-reveal-delay="${i * 90}"><div class="bank tilt gc-${i === 0 ? 'visa' : i === 1 ? 'mc' : i === 2 ? 'phys' : 'travel'}" data-tilt><div class="bank-top"><span class="bank-chip" aria-hidden="true"></span><img class="bank-logo" src="assets/logos/${b.net}-w.svg" alt="${b.net === 'visa' ? 'Visa' : 'Mastercard'}"></div><div class="bank-num" dir="ltr">•••• •••• •••• ••••</div><div class="bank-foot"><span>STAR SHOP</span><span class="bank-wave" aria-hidden="true">)))</span></div><p class="bank-cap">${escapeHtml(b.cap)}</p></div></div>`).join('');
  initTilt();
};

const renderPP = () => {
  const g = $('#ppGrid'), pr = $('#ppProcess');
  if (g) g.innerHTML = D().ppCards.map((c, i) => `<article class="card pp-card" data-reveal data-reveal-delay="${i * 90}" data-service="${c.svc}" role="button" tabindex="0"><span class="pp-logo"><img src="assets/logos/paypal-brand.svg" alt="PayPal" width="72" height="72" loading="lazy"></span><h3>${escapeHtml(c.t)}</h3><p>${escapeHtml(c.d)}</p><span class="chip">${t('chip.detail')}</span></article>`).join('');
  if (pr) pr.innerHTML = D().process.map((p, i) => `<li><span class="p-num">${localDig(i + 1)}</span><h4>${escapeHtml(p.t)}</h4><p>${escapeHtml(p.d)}</p></li>`).join('');
};

const renderShop = () => {
  const dr = $('#destRow'), ss = $('#shopSteps');
  if (dr) dr.innerHTML = D().dests.map(d => `<span class="dest"><b>${d.c}</b> ${escapeHtml(d.t)}</span>`).join('');
  if (ss) ss.innerHTML = D().shopSteps.map((p, i) => `<li><span class="p-num">${localDig(i + 1)}</span><h4>${escapeHtml(p.t)}</h4><p>${escapeHtml(p.d)}</p></li>`).join('');
};

const renderIncome = () => {
  const f = $('#incFlow'), side = $('#incSide');
  if (f) f.innerHTML = D().incomeFlow.map((n, i) => `${i > 0 ? '<span class="flow-link" aria-hidden="true"><i></i></span>' : ''}<div class="flow-node${n.done ? ' done' : ''}"><svg class="ic" viewBox="0 0 24 24"><use href="#i-${n.icon}"/></svg><div><b>${escapeHtml(n.t)}</b><span>${escapeHtml(n.d)}</span></div></div>`).join('');
  if (side) side.innerHTML = D().incomeCards.map((c, i) => `<article class="card" data-reveal data-reveal-delay="${i * 90}" data-service="${c.svc}" role="button" tabindex="0"><h3>${escapeHtml(c.t)}</h3><p>${escapeHtml(c.d)}</p><span class="chip">${t('chip.detail')}</span></article>`).join('');
};

const renderExams = () => {
  const g = $('#examGrid'); if (!g) return;
  g.innerHTML = D().exams.map((x, i) => `<article class="card exam" data-reveal data-reveal-delay="${i * 70}" data-service="${x.svc}" role="button" tabindex="0"><b class="exam-abbr">${x.a}</b><p>${escapeHtml(x.p)}</p><span class="chip">${t('exam.chip')}</span></article>`).join('');
};

const renderHW = () => {
  const g = $('#hwGrid'), ul = $('#hwEduList');
  if (g) g.innerHTML = D().hwCards.map((c, i) => `<article class="card hw" data-reveal data-reveal-delay="${i * 90}"><span class="card-ic"><svg class="ic" viewBox="0 0 24 24"><use href="#i-${c.icon}"/></svg></span><h3>${escapeHtml(c.t)}</h3><p>${escapeHtml(c.d)}</p></article>`).join('');
  if (ul) ul.innerHTML = D().hwEdu.map(x => `<li><svg class="ic" viewBox="0 0 24 24"><use href="#i-check"/></svg> ${escapeHtml(x)}</li>`).join('');
};

const renderHow = () => {
  const g = $('#howSteps'); if (!g) return;
  g.innerHTML = D().howSteps.map((s, i) => `<div class="how-step${i === 0 ? ' is-active' : ''}"><b>${localDig(i + 1).padStart(2, '0')}</b><h3>${escapeHtml(s.t)}</h3><p>${escapeHtml(s.d)}</p></div>`).join('');
};

const renderWhy = () => {
  const g = $('#whyGrid'); if (!g) return;
  g.innerHTML = D().whyCards.map((c, i) => `<article class="card why" data-reveal data-reveal-delay="${i * 70}"><span class="card-ic"><svg class="ic" viewBox="0 0 24 24"><use href="#i-${c.icon}"/></svg></span><h3>${escapeHtml(c.t)}</h3><p>${escapeHtml(c.d)}</p></article>`).join('');
};

const renderStats = () => {
  const g = $('#statsGrid'); if (!g) return;
  g.innerHTML = D().stats.map((s, i) => `<div class="stat" data-reveal data-reveal-delay="${i * 80}"><b class="stat-num" data-count="${s.n}" data-suffix="${s.suf}">${localDig(0)}</b><span>${t(s.t.replace('__', ''))}</span></div>`).join('');
  initStats();
};

const renderTestimonials = () => {
  const tr = $('#testTrack'); if (!tr) return;
  tr.innerHTML = D().testimonials.map(x => `<li class="tst"><span class="chip chip-edit">${t('test.editable')}</span><h3>${escapeHtml(x.t)}</h3><blockquote>${escapeHtml(x.q)}</blockquote></li>`).join('');
};

const magCls = { a1:'mc-1', a2:'mc-2', a3:'mc-3', a4:'mc-4', a5:'mc-5', a6:'mc-6' };
const renderMag = () => {
  const g = $('#magGrid'); if (!g) return;
  g.innerHTML = D().articles.map((a, i) => `<article class="mag" data-reveal data-reveal-delay="${i * 70}" data-article="${a.id}" role="button" tabindex="0" aria-label="${escapeHtml(a.title)}">
    <div class="mag-cover ${magCls[a.id] || 'mc-1'}" aria-hidden="true"><span>${escapeHtml(a.tag)}</span></div>
    <div class="mag-body"><div class="mag-meta"><span class="chip">${escapeHtml(a.tag)}</span><span class="mag-read">${localDig(a.read)} ${t('mag.read')}</span></div><h3>${escapeHtml(a.title)}</h3><p>${escapeHtml(a.excerpt)}</p></div>
  </article>`).join('');
};

const renderFAQ = () => {
  const g = $('#faqList'); if (!g) return;
  g.innerHTML = D().faq.map((f, i) => `<div class="faq-item"><h3><button class="faq-q" aria-expanded="false" aria-controls="fa${i}">${escapeHtml(f.q)}<svg class="ic" viewBox="0 0 24 24"><use href="#i-chev"/></svg></button></h3><div class="faq-a" id="fa${i}" role="region"><div><p>${escapeHtml(f.a)}</p></div></div></div>`).join('');
  const items = $$('.faq-item', g);
  items.forEach(item => {
    const q = $('.faq-q', item);
    q.addEventListener('click', () => {
      const open = item.classList.contains('open');
      items.forEach(x => { x.classList.remove('open'); $('.faq-q', x).setAttribute('aria-expanded', 'false'); });
      if (!open) { item.classList.add('open'); q.setAttribute('aria-expanded', 'true'); }
    });
  });
};

const renderAll = () => {
  renderHeroCard(); renderQuick(); renderExplorer(); renderSelect();
  renderPay(); renderAI(); renderGifts(); renderBanks(); renderPP();
  renderShop(); renderIncome(); renderExams(); renderHW(); renderHow();
  renderWhy(); renderStats(); renderTestimonials(); renderMag(); renderFAQ();
  wireDirect();
  setPanelHeight();
};

/* ── loader ── */
const runLoader = () => new Promise(res => {
  const loader = $('#loader'); if (!loader) return res();
  if (reduced) { loader.classList.add('hide'); return res(); }
  document.body.style.overflow = 'hidden';
  const fill = $('#loadFill'), num = $('#loadNum');
  const DUR = sessionStorage.getItem('ss-loaded') ? 450 : 1400;
  const t0 = performance.now();
  const ease = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  const tick = now => {
    const p = clamp((now - t0) / DUR, 0, 1);
    const v = ease(p);
    if (fill) fill.style.width = (v * 100) + '%';
    if (num) num.textContent = String(Math.round(v * 100)).padStart(3, '0');
    if (p < 1) requestAnimationFrame(tick);
    else {
      loader.classList.add('done');
      sessionStorage.setItem('ss-loaded', '1');
      setTimeout(() => { document.body.style.overflow = ''; res(); }, 620);
      setTimeout(() => loader.classList.add('hide'), 1050);
    }
  };
  requestAnimationFrame(tick);
});

/* ── hero words (rebuild from i18n key) ── */
const splitWords = () => {
  const h = $('#heroTitle'); if (!h) return;
  const raw = (window.SSI18N ? window.SSI18N.t('hero.title') : t('hero.title'));
  const parts = String(raw).split('|');
  h.innerHTML = '';
  let i = 0;
  parts.forEach((part, pi) => {
    if (pi > 0) h.appendChild(document.createElement('br'));
    part.split(/\s+/).filter(Boolean).forEach(w => {
      const w1 = document.createElement('span'); w1.className = 'h-word';
      const w2 = document.createElement('span');
      w2.textContent = w;
      w2.style.transitionDelay = (i++ * 90) + 'ms';
      w1.appendChild(w2); h.appendChild(w1); h.appendChild(document.createTextNode(' '));
    });
  });
};

/* ── smooth scroll (Lenis optional) ── */
let lenis = null;
const initScroll = () => {
  if (!reduced && typeof Lenis !== 'undefined') {
    try { lenis = new Lenis({ duration: 1.15, smoothWheel: true }); } catch (e) { lenis = null; }
  }
  const raf = x => { if (lenis) lenis.raf(x); requestAnimationFrame(raf); };
  if (lenis) requestAnimationFrame(raf);
};
const scrollToEl = el => {
  if (!el) return;
  const off = -($('#siteHeader') ? 74 : 0);
  if (lenis) lenis.scrollTo(el, { offset: off, duration: 1.2 });
  else {
    const y = el.getBoundingClientRect().top + window.scrollY + off;
    window.scrollTo({ top: y, behavior: reduced ? 'auto' : 'smooth' });
  }
};
const initAnchors = () => {
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#"]'); if (!a) return;
    const id = a.getAttribute('href');
    if (id.length < 2) return;
    const el = $(id); if (!el) return;
    e.preventDefault();
    closeMenu();
    scrollToEl(el);
  });
};

/* ── theme sections ── */
const initTheme = () => {
  const secs = $$('[data-bg]'); if (!secs.length) return;
  const io = new IntersectionObserver(ents => {
    ents.forEach(en => { if (en.isIntersecting) document.body.dataset.theme = en.target.dataset.bg; });
  }, { rootMargin: '-44% 0px -44% 0px' });
  secs.forEach(s => io.observe(s));
};

/* ── progress ── */
const initProgress = () => {
  const rail = $('#progressBar'), top = $('#progressBarTop');
  let raf = null;
  const upd = () => {
    raf = null;
    const max = document.documentElement.scrollHeight - innerHeight;
    const p = max > 0 ? clamp(window.scrollY / max, 0, 1) : 0;
    if (rail) rail.style.transform = `scaleY(${p})`;
    if (top) top.style.transform = `scaleX(${p})`;
  };
  addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(upd); }, { passive: true });
  upd();
};

/* ── header scrolled state (پس‌زمینه بلور پس از اسکرول) ── */
const initHeaderState = () => {
  const h = $('#siteHeader'); if (!h) return;
  let raf = null;
  const upd = () => { raf = null; h.classList.toggle('scrolled', (window.scrollY || document.documentElement.scrollTop) > 24); };
  addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(upd); }, { passive: true });
  addEventListener('resize', upd, { passive: true });
  upd();
};

/* ── custom cursor ── */
const initCursor = () => {
  const cur = $('#cursor');
  if (!cur || touch || reduced) return;
  cur.classList.add('on');
  const dot = $('.c-dot', cur), ring = $('.c-ring', cur);
  let mx = innerWidth / 2, my = innerHeight / 2, rx = mx, ry = my;
  addEventListener('pointermove', e => { mx = e.clientX; my = e.clientY; }, { passive: true });
  const loop = () => {
    rx += (mx - rx) * .16; ry += (my - ry) * .16;
    dot.style.transform = `translate(${mx}px,${my}px)`;
    ring.style.transform = `translate(${rx}px,${ry}px)`;
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  const HOV = 'a,button,input,textarea,select,[role="button"],[data-service],.faq-q,.tab,.gift';
  document.addEventListener('pointerover', e => { if (e.target.closest(HOV)) cur.classList.add('hover'); });
  document.addEventListener('pointerout',  e => { if (e.target.closest(HOV)) cur.classList.remove('hover'); });
  document.documentElement.addEventListener('mouseleave', () => cur.classList.remove('on'));
  document.documentElement.addEventListener('mouseenter', () => cur.classList.add('on'));
};

/* ── magnetic buttons ── */
const initMagnetic = () => {
  if (touch || reduced) return;
  $$('.magnetic').forEach(el => {
    el.addEventListener('pointermove', e => {
      const r = el.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      el.style.transform = `translate(${dx * .18}px,${dy * .22}px)`;
    });
    el.addEventListener('pointerleave', () => { el.style.transform = ''; });
  });
};

/* ── reveals ── */
let revealIO = null;
const initReveals = () => {
  const els = $$('[data-reveal]').filter(el => !el.classList.contains('in'));
  if (reduced) { els.forEach(el => el.classList.add('in')); return; }
  if (revealIO) revealIO.disconnect();
  revealIO = new IntersectionObserver(ents => {
    ents.forEach(en => {
      if (!en.isIntersecting) return;
      const d = en.target.dataset.revealDelay;
      if (d) en.target.style.setProperty('--rd', d + 'ms');
      en.target.classList.add('in');
      revealIO.unobserve(en.target);
    });
  }, { threshold: .12, rootMargin: '0px 0px -6% 0px' });
  els.forEach(el => revealIO.observe(el));
};

/* ── tilt cards ── */
const initTilt = () => {
  if (touch || reduced) return;
  $$('[data-tilt]').forEach(el => {
    if (el.dataset.tiltBound) return;
    el.dataset.tiltBound = '1';
    el.addEventListener('pointermove', e => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      el.style.transition = 'transform .1s linear';
      el.style.transform = `rotateX(${(py - .5) * -9}deg) rotateY(${(px - .5) * 11}deg)`;
      el.style.setProperty('--mx', (px * 100) + '%');
      el.style.setProperty('--my', (py * 100) + '%');
    });
    el.addEventListener('pointerleave', () => {
      el.style.transition = 'transform .7s var(--spring)';
      el.style.transform = '';
    });
  });
};

/* ── carousels ── */
const initCarousel = (track, prevBtn, nextBtn, autoMs) => {
  if (!track) return;
  const step = () => {
    const item = track.firstElementChild;
    if (!item) return 260;
    const st = getComputedStyle(track);
    return item.getBoundingClientRect().width + parseFloat(st.columnGap || st.gap || 18);
  };
  const isRTL = getComputedStyle(track).direction === 'rtl';
  const dirSign = isRTL ? -1 : 1;
  const maxScroll = () => track.scrollWidth - track.clientWidth;
  const go = dir => {
    const m = maxScroll(); if (m <= 4) return;
    track.scrollBy({ left: dir * dirSign * step(), behavior: reduced ? 'auto' : 'smooth' });
  };
  if (nextBtn) nextBtn.addEventListener('click', () => go(1));
  if (prevBtn) prevBtn.addEventListener('click', () => go(-1));
  /* ⚠️ setPointerCapture فقط بعد از عبور آستانه درگ (۸px) فعال می‌شود؛
     در غیر این‌صورت مرورگر رویداد click را به خودِ track بازنشانه می‌کند و
     کلیک ساده روی کارت‌های داخل اسلایدر (مثل گیفت کارت‌ها) گم می‌شود. */
  let down = false, sx = 0, ss = 0, moved = 0, captured = false, pid = null;
  track.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse') { down = true; captured = false; pid = e.pointerId; sx = e.clientX; ss = track.scrollLeft; moved = 0; }
  });
  track.addEventListener('pointermove', e => {
    if (!down) return;
    const dx = e.clientX - sx; moved = Math.max(moved, Math.abs(dx));
    if (!captured && moved > 8) { captured = true; track.classList.add('dragging'); try { track.setPointerCapture(pid); } catch (err) {} }
    if (captured) track.scrollLeft = ss - dx;
  });
  const up = () => { down = false; captured = false; track.classList.remove('dragging'); };
  track.addEventListener('pointerup', up);
  track.addEventListener('pointercancel', up);
  track.addEventListener('click', e => { if (moved > 8) { e.preventDefault(); e.stopPropagation(); } }, true);
  track.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); go(-1); }
  });
  track.addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.gift')) { e.preventDefault(); e.target.click(); }
  });
  /* چرخش خودکار فقط دسکتاپ؛ روی لمسی خاموش است چون کارت هنگام انگشت کاربر
     حرکت می‌کند و تپ‌ها گم می‌شوند (هوور هم برای توقف، روی لمسی وجود ندارد) */
  if (autoMs && !reduced && !touch) {
    let timer = null, hover = false, visible = true;
    const start = () => { if (!timer && !hover && visible && !document.hidden) timer = setInterval(() => {
      if (Math.abs(track.scrollLeft) >= maxScroll() - 8) track.scrollTo({ left: 0, behavior: 'smooth' });
      else go(1);
    }, autoMs); };
    const stop = () => { clearInterval(timer); timer = null; };
    track.addEventListener('mouseenter', () => { hover = true; });
    track.addEventListener('mouseleave', () => { hover = false; start(); });
    track.addEventListener('pointerdown', stop);
    track.addEventListener('pointerup', () => setTimeout(start, 3600));
    document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else start(); });
    new IntersectionObserver(ents => { visible = ents[0].isIntersecting; visible ? start() : stop(); }).observe(track);
    start();
  }
};

/* ── process stagger ── */
const initProcess = () => {
  $$('.process').forEach(p => {
    if (p.classList.contains('vertical')) return;
    const io = new IntersectionObserver(ents => {
      if (ents[0].isIntersecting) { p.classList.add('in'); io.disconnect(); }
    }, { threshold: .3 });
    io.observe(p);
  });
};

/* ── how-it-works scroll ── */
const initHow = () => {
  const wrap = $('#howSection'); if (!wrap) return;
  const steps = $$('.how-step', wrap), fill = $('#howFill');
  const upd = () => {
    const r = wrap.getBoundingClientRect();
    const vh = innerHeight;
    const p = clamp((vh * .78 - r.top) / (r.height + vh * .12), 0, 1);
    if (fill) fill.style.transform = `scaleX(${p})`;
    const idx = clamp(Math.floor(p * steps.length + .12), 0, steps.length - 1);
    steps.forEach((s, i) => s.classList.toggle('is-active', i <= idx));
  };
  addEventListener('scroll', () => requestAnimationFrame(upd), { passive: true });
  upd();
};

/* ── modals (generic + focus trap) ── */
let lastFocus = null;
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),textarea,select,[tabindex]:not([tabindex="-1"])';
const openModal = m => {
  if (!m) return;
  lastFocus = document.activeElement;
  m.hidden = false;
  requestAnimationFrame(() => requestAnimationFrame(() => m.classList.add('show')));
  document.body.style.overflow = 'hidden';
  if (lenis) lenis.stop();
  const f = $(FOCUSABLE, m); if (f) setTimeout(() => f.focus(), 80);
  m.addEventListener('keydown', trap);
};
const closeModal = m => {
  if (!m || m.hidden) return;
  m.classList.remove('show');
  m.removeEventListener('keydown', trap);
  setTimeout(() => { m.hidden = true; }, 460);
  document.body.style.overflow = '';
  if (lenis) lenis.start();
  if (lastFocus) { try { lastFocus.focus(); } catch (e) {} }
};
const trap = e => {
  const m = e.currentTarget;
  if (e.key === 'Escape') { closeModal(m); return; }
  if (e.key !== 'Tab') return;
  const f = $$(FOCUSABLE, m).filter(el => el.offsetParent !== null);
  if (!f.length) return;
  const first = f[0], last = f[f.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
};
const anyOpenModal = () => $$('.modal').find(m => !m.hidden);

/* ── menu overlay ── */
const openMenu = () => {
  const m = $('#menuOverlay'), b = $('#burger');
  if (!m) return;
  m.hidden = false;
  requestAnimationFrame(() => requestAnimationFrame(() => m.classList.add('show')));
  $$('.menu-link', m).forEach((l, i) => l.style.transitionDelay = (i * 45 + 120) + 'ms');
  if (b) b.setAttribute('aria-expanded', 'true');
  document.body.style.overflow = 'hidden';
  if (lenis) lenis.stop();
  const c = $('#menuClose'); if (c) c.focus();
};
const closeMenu = () => {
  const m = $('#menuOverlay'), b = $('#burger');
  if (!m || m.hidden) return;
  m.classList.remove('show');
  setTimeout(() => { m.hidden = true; }, 520);
  if (b) b.setAttribute('aria-expanded', 'false');
  document.body.style.overflow = '';
  if (lenis) lenis.start();
};
const initMenu = () => {
  const b = $('#burger'); if (b) b.addEventListener('click', openMenu);
  const c = $('#menuClose'); if (c) c.addEventListener('click', closeMenu);
};

/* ── service detail modal ── */
const openService = id => {
  const s = getService(id), box = $('#serviceModalBody');
  if (!s || !box) return;
  box.innerHTML = `
    <button class="modal-close" data-close-modal aria-label="${t('cart.close')}"><svg class="ic" viewBox="0 0 24 24"><use href="#i-close"/></svg></button>
    <div class="sm-head">
      <span class="card-ic"><svg class="ic" viewBox="0 0 24 24"><use href="#i-${s.icon}"/></svg></span>
      <div><span class="sm-cat">${escapeHtml(catLabel(s.cat))}</span><h3 id="smTitle" style="margin:2px 0 0">${escapeHtml(s.title)}</h3></div>
    </div>
    <p class="sm-desc">${escapeHtml(s.desc)}</p>
    <div class="sm-meta">
      <span class="chip"><svg class="ic" style="width:13px;height:13px" viewBox="0 0 24 24"><use href="#i-clock"/></svg> ${t('sm.time')}</span>
      <span class="chip"><svg class="ic" style="width:13px;height:13px" viewBox="0 0 24 24"><use href="#i-coins"/></svg> ${t('sm.cost')}</span>
    </div>
    <div class="sm-block"><h4>${t('sm.who')}</h4><p class="sm-desc" style="margin:0">${escapeHtml(s.who)}</p></div>
    <div class="sm-block"><h4>${t('sm.steps')}</h4><ol>${s.steps.map(x => `<li>${escapeHtml(x)}</li>`).join('')}</ol></div>
    <div class="sm-block"><h4>${t('sm.req')}</h4><ul>${s.req.map(x => `<li>${escapeHtml(x)}</li>`).join('')}</ul></div>
    <div class="sm-cta">
      <button class="btn btn-ghost btn-lg" data-add-cart data-id="${s.id}" data-title="${escapeHtml(s.title)}"><svg class="ic" viewBox="0 0 24 24"><use href="#i-cart"/></svg>${t('sm.addcart')}</button>
      <button class="btn btn-primary btn-lg" data-open-contact data-prefill="${s.id}">${t('sm.order')}<svg class="ic arr" viewBox="0 0 24 24"><use href="#i-arrow"/></svg></button>
    </div>`;
  openModal($('#serviceModal'));
};

/* اتصال مستقیم و ضد دوباره‌زنی — حتی اگر رویداد به delegation نرسد کار می‌کند */
const lastOpenSvc = { id: null, t: 0 };
const openServiceG = id => {
  const now = Date.now();
  if (lastOpenSvc.id === id && now - lastOpenSvc.t < 250) return;
  lastOpenSvc.id = id; lastOpenSvc.t = now;
  openService(id);
};
const wireDirect = () => {
  $$('[data-service]').forEach(el => {
    if (el.__ssWired) return; el.__ssWired = true;
    el.addEventListener('click', e => { e.stopPropagation(); openServiceG(el.dataset.service); });
  });
  $$('.gift[data-gift-open]').forEach(el => {
    if (el.__ssWired) return; el.__ssWired = true;
    el.addEventListener('click', e => {
      e.stopPropagation();
      if (window.SSGift && window.SSGift.open) window.SSGift.open(el.dataset.giftOpen);
      else openServiceG(el.dataset.giftOpen);
    });
  });
};

/* ── article modal ── */
const openArticle = id => {
  const a = D().articles.find(x => x.id === id); if (!a) return;
  $('#artTag').textContent = a.tag;
  $('#artTitle').textContent = a.title;
  $('#artRead').textContent = `${localDig(a.read)} ${t('mag.read')}`;
  $('#artBody').innerHTML = a.body.map(p => `<p>${escapeHtml(p)}</p>`).join('');
  openModal($('#articleModal'));
};
const openMagAll = () => {
  $('#artTag').textContent = t('mag.eyebrow');
  $('#artTitle').textContent = t('mag.title1') + ' ' + t('mag.title2');
  $('#artRead').textContent = '';
  $('#artBody').innerHTML = D().articles.map(a => `<button class="art-item" data-article="${a.id}"><span class="chip">${escapeHtml(a.tag)}</span><b>${escapeHtml(a.title)}</b><small>${escapeHtml(a.excerpt)}</small></button>`).join('');
  openModal($('#articleModal'));
};

/* ── legal modal ── */
const openLegal = which => {
  const L = D().legal[which]; if (!L) return;
  $('#legalTitle').textContent = L.title;
  $('#legalBody').innerHTML = L.body.map(p => `<p>${escapeHtml(p)}</p>`).join('');
  openModal($('#legalModal'));
};

/* ── contact modal ── */
let lastOrderText = '';
const openContact = prefillId => {
  const m = $('#contactModal'); if (!m) return;
  const open = anyOpenModal(); if (open) closeModal(open);
  $('#formDone').hidden = true;
  $('#contactForm').hidden = false;
  if (prefillId) {
    const sel = $('#contactForm select[name="service"]');
    if (sel) sel.value = prefillId;
    const msg = $('#contactForm textarea[name="message"]');
    const s = getService(prefillId);
    if (msg && s && !msg.value) msg.value = `${t('sm.order')}: ${s.title}`;
  }
  setTimeout(() => openModal(m), open ? 200 : 0);
};

/* ── search ── */
const openSearch = () => {
  const m = $('#searchOverlay'), inp = $('#searchInput');
  if (!m) return;
  const open = anyOpenModal(); if (open) closeModal(open);
  m.hidden = false;
  requestAnimationFrame(() => requestAnimationFrame(() => m.classList.add('show')));
  document.body.style.overflow = 'hidden';
  if (lenis) lenis.stop();
  renderResults('');
  setTimeout(() => inp && inp.focus(), 90);
};
const closeSearch = () => {
  const m = $('#searchOverlay'); if (!m || m.hidden) return;
  m.classList.remove('show');
  setTimeout(() => { m.hidden = true; }, 420);
  document.body.style.overflow = '';
  if (lenis) lenis.start();
};
const renderResults = q => {
  const box = $('#searchResults'); if (!box) return;
  const nq = normTxt(q);
  let svc = D().services, arts = D().articles;
  if (nq) {
    svc = D().services.filter(s => normTxt(s.title + ' ' + s.desc + ' ' + catLabel(s.cat)).includes(nq));
    arts = D().articles.filter(a => normTxt(a.title + ' ' + a.excerpt + ' ' + a.tag).includes(nq));
  }
  if (!svc.length && !arts.length) {
    box.innerHTML = `<div class="no-res">${t('search.empty')}</div>`;
    return;
  }
  box.innerHTML =
    svc.slice(0, 14).map((s, i) => `<button class="sr-item" role="option" data-service="${s.id}" style="animation-delay:${i * 30}ms">
      <span class="card-ic"><svg class="ic" viewBox="0 0 24 24"><use href="#i-${s.icon}"/></svg></span>
      <span><b>${escapeHtml(s.title)}</b><small>${escapeHtml(catLabel(s.cat))}</small></span>
      <svg class="ic" viewBox="0 0 24 24"><use href="#i-arrow"/></svg></button>`).join('') +
    arts.map(a => `<button class="sr-item" role="option" data-article="${a.id}">
      <span class="card-ic"><svg class="ic" viewBox="0 0 24 24"><use href="#i-doc"/></svg></span>
      <span><b>${escapeHtml(a.title)}</b><small>${t('search.mag')} — ${escapeHtml(a.tag)}</small></span>
      <svg class="ic" viewBox="0 0 24 24"><use href="#i-arrow"/></svg></button>`).join('');
};
const initSearch = () => {
  const inp = $('#searchInput');
  if (inp) inp.addEventListener('input', () => renderResults(inp.value));
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey && e.key.toLowerCase() === 'k') || (e.key === '/' && !/input|textarea|select/i.test(document.activeElement.tagName))) {
      e.preventDefault(); openSearch();
    }
    if (e.key === 'Escape') { closeSearch(); closeMenu(); }
  });
};

/* ── contact form → سفارش آماده ارسال ── */
const initContactForm = () => {
  const form = $('#contactForm'); if (!form) return;
  const mark = (el, bad) => { const f = el.closest('.field'); if (f) f.classList.toggle('invalid', bad); return !bad; };
  form.addEventListener('submit', e => {
    e.preventDefault();
    const name = form.elements.name, phone = form.elements.phone, email = form.elements.email,
          service = form.elements.service, msg = form.elements.message;
    let ok = true;
    ok = mark(name, name.value.trim().length < 2) && ok;
    const ph = faToEn(phone.value).replace(/[\s-()]/g, '');
    ok = mark(phone, !/^(\+98|0098|98|0)?9\d{9}$/.test(ph)) && ok;
    ok = mark(email, !!email.value && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.value.trim())) && ok;
    ok = mark(service, !service.value) && ok;
    if (!ok) { toast(t('cm.err.fix')); return; }
    const sName = getService(service.value) ? getService(service.value).title : service.value;
    const C = window.SS_CONFIG || {};
    const locale = D().meta.numLocale;
    lastOrderText = [
      t('order.header'),
      '— — — — —',
      `${t('cm.name')}: ${name.value.trim()}`,
      `${t('cm.phone')}: ${ph}`,
      email.value.trim() ? `${t('cm.email')}: ${email.value.trim()}` : null,
      `${t('cm.service')}: ${sName}`,
      msg.value.trim() ? `${t('cm.msg')}: ${msg.value.trim()}` : null,
      '— — — — —',
      `${t('order.date')}: ${new Date().toLocaleString(locale)}`,
      `${t('order.site')}: ${location.origin + location.pathname}`
    ].filter(Boolean).join('\n');
    try {
      const orders = JSON.parse(localStorage.getItem('ss_orders') || '[]');
      orders.push({ code: 'SS-FORM', channel: 'form', ts: Date.now(), items: [{ id: service.value, title: sName, qty: 1 }] });
      localStorage.setItem('ss_orders', JSON.stringify(orders.slice(-30)));
    } catch (err) {}
    const mail = $('#doneMail');
    if (mail) mail.href = `mailto:${C.email || 'pingpixel92@gmail.com'}?subject=${encodeURIComponent(t('order.header') + ' — ' + sName)}&body=${encodeURIComponent(lastOrderText)}`;
    form.hidden = true;
    $('#formDone').hidden = false;
  });
  ['input', 'change'].forEach(ev => form.addEventListener(ev, e => {
    const f = e.target.closest('.field'); if (f) f.classList.remove('invalid');
  }));
  const tg = $('#doneTg'), bl = $('#doneBale'), cp = $('#doneCopy');
  if (tg) tg.addEventListener('click', () => {
    const url = `${(window.SS_CONFIG || {}).telegram.url}?text=${encodeURIComponent(lastOrderText)}`;
    window.open(url, '_blank', 'noopener,noreferrer') || (location.href = url);
  });
  if (bl) bl.addEventListener('click', async () => {
    let copied = false;
    try { await navigator.clipboard.writeText(lastOrderText); copied = true; } catch (e) {}
    toast(copied ? t('cart.sent.bale') : t('toast.copyfail'));
    window.open((window.SS_CONFIG || {}).bale.url, '_blank', 'noopener,noreferrer') || (location.href = (window.SS_CONFIG || {}).bale.url);
  });
  if (cp) cp.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(lastOrderText); toast(t('toast.copied')); }
    catch (e) { toast(t('toast.copyfail')); }
  });
};

/* ── calc form ── */
const initCalcForm = () => {
  const form = $('#calcForm'); if (!form) return;
  form.addEventListener('submit', e => {
    e.preventDefault();
    const url = $('#calcUrl'), note = $('#calcNote');
    let u = url.value.trim();
    let valid = false;
    try { const U = new URL(u); valid = U.protocol === 'http:' || U.protocol === 'https:'; } catch (err) { valid = false; }
    if (!valid) { url.closest('.field').classList.add('invalid'); toast(t('shop.calc.err')); return; }
    openContact('shop-link');
    const msg = $('#contactForm textarea[name="message"]');
    if (msg) msg.value = `${t('shop.calc.url')}: ${u}` + (note.value.trim() ? `\n${t('cm.msg')}: ${note.value.trim()}` : '');
    form.reset();
  });
};

/* ── count-up stats ── */
const initStats = () => {
  const els = $$('.stat-num').filter(el => !el.dataset.counted);
  if (!els.length) return;
  const io = new IntersectionObserver(ents => {
    ents.forEach(en => {
      if (!en.isIntersecting) return;
      io.unobserve(en.target);
      const el = en.target;
      el.dataset.counted = '1';
      const target = +el.dataset.count, suf = el.dataset.suffix || '';
      if (reduced) { el.textContent = localDig(target) + suf; return; }
      const t0 = performance.now(), DUR = 1500;
      const tick = now => {
        const p = clamp((now - t0) / DUR, 0, 1);
        const v = Math.round(target * (1 - Math.pow(1 - p, 3)));
        el.textContent = localDig(v) + suf;
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }, { threshold: .5 });
  els.forEach(el => io.observe(el));
};

/* ── global delegation ── */
const initDelegation = () => {
  document.addEventListener('click', e => {
    const art = e.target.closest('[data-article]');
    if (art) { openArticle(art.dataset.article); return; }
    if (e.target.closest('[data-open-legal]')) { openLegal(e.target.closest('[data-open-legal]').dataset.openLegal); return; }
    if (e.target.closest('[data-open-mag-all]')) { openMagAll(); return; }
    const svc = e.target.closest('[data-service]');
    if (svc && !svc.closest('#payGrid')) { openService(svc.dataset.service); return; }
    if (svc && svc.closest('#payGrid') && svc.classList.contains('card')) { openService(svc.dataset.service); return; }
    if (e.target.closest('[data-open-contact]')) {
      const pre = e.target.closest('[data-prefill]');
      openContact(pre ? pre.dataset.prefill : null);
      return;
    }
    if (e.target.closest('[data-open-auth]')) {
      const m = anyOpenModal(); if (m) closeModal(m);
      if (window.SSAuth) window.SSAuth.open();
      return;
    }
    if (e.target.closest('[data-open-cart]') || e.target.closest('#cartBtn')) {
      const m = anyOpenModal(); if (m && m.id !== 'cartModal') closeModal(m);
      openModal($('#cartModal'));
      return;
    }
    if (e.target.closest('[data-open-search]')) { openSearch(); return; }
    if (e.target.closest('#loginBtn')) {
      if (window.SSAuth) window.SSAuth.open();
      return;
    }
    const cm = e.target.closest('[data-close-modal]');
    if (cm) { closeModal(cm.closest('.modal')); return; }
  });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const el = document.activeElement;
    if (!el) return;
    if (el.matches('[data-service][role="button"]')) { e.preventDefault(); openService(el.dataset.service); }
    if (el.matches('.gift[role="button"]')) { e.preventDefault(); el.click(); }
    if (el.matches('[data-article][role="button"]')) { e.preventDefault(); openArticle(el.dataset.article); }
  });
};

/* ── boot ── */
const boot = async () => {
  renderAll();
  splitWords();
  initScroll(); initAnchors(); initTheme(); initProgress(); initHeaderState();
  initCursor(); initMagnetic(); initTilt();
  initMenu(); initSearch(); initContactForm(); initCalcForm();
  initProcess(); initHow(); initStats(); initDelegation();
  initCarousel($('#giftTrack'), $('#giftPrev'), $('#giftNext'), 4200);
  initCarousel($('#testTrack'), $('#testPrev'), $('#testNext'), 5200);
  /* expose UI bridge برای ماژول‌های دیگر */
  window.SSUI = { openModal, closeModal, splitWords, setPanelHeight, toast, openService, openCart: () => openModal($('#cartModal')) };
  if (window.SSAuth) window.SSAuth.setToast(toast);
  if (window.SSCart) window.SSCart.setToast(toast);
  if (window.SSCart) window.SSCart.renderBadge();
  document.addEventListener('ss:lang', () => {
    activeCat = activeCat || 'payments';
    renderAll();
    splitWords();
    initProcess(); initHow(); initStats();
    initReveals();
    setPanelHeight();
    if (window.SSCart) { window.SSCart.renderBadge(); window.SSCart.renderDrawer(); }
  });
  await runLoader();
  const hero = $('.hero'); if (hero) hero.classList.add('play');
  initReveals();
  setPanelHeight();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(setPanelHeight);
  addEventListener('resize', () => { setPanelHeight(); });
};
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
})();
