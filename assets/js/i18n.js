/* ═══════════════════════════════════════════════════
   STARSHOP — i18n.js
   موتور چندزبانه: فارسی (پیش‌فرض) / English / العربية
   جهت سند (RTL/LTR) هم خودکار تغییر می‌کند
   ═══════════════════════════════════════════════════ */
(() => {
'use strict';

const $  = (s, c) => (c || document).querySelector(s);
const $$ = (s, c) => Array.from((c || document).querySelectorAll(s));
const K_LANG = 'ss_lang';

let current = 'fa';
try {
  const saved = localStorage.getItem(K_LANG);
  if (saved && window.SS_DATA && window.SS_DATA[saved]) current = saved;
} catch (e) {}

const data = lang => (window.SS_DATA && window.SS_DATA[lang]) || window.SS_DATA.fa;
const t = k => { const ui = data(current).ui; return ui[k] != null ? ui[k] : (window.SS_DATA.fa.ui[k] != null ? window.SS_DATA.fa.ui[k] : k); };
const fmt = (s, o) => String(s).replace(/\{(\w+)\}/g, (_, k) => o && o[k] != null ? o[k] : '');

/* ── apply static UI strings ── */
const applyStatic = () => {
  const ui = data(current).ui;
  $$('[data-i18n]').forEach(el => {
    const k = el.dataset.i18n;
    let v = ui[k] != null ? ui[k] : null;
    if (v == null) return;
    if (v.includes('{year}')) v = v.replace('{year}', String(new Date().getFullYear()).replace(/\d/g, d => current === 'fa' ? '۰۱۲۳۴۵۶۷۸۹'[d] : current === 'ar' ? '٠١٢٣٤٥٦٧٨٩'[d] : d));
    el.textContent = v;
  });
  $$('[data-i18n-ph]').forEach(el => { const v = ui[el.dataset.i18nPh]; if (v != null) el.placeholder = v; });
  $$('[data-i18n-aria]').forEach(el => { const v = ui[el.dataset.i18nAria]; if (v != null) el.setAttribute('aria-label', v); });
  $$('[data-i18n-title]').forEach(el => { const v = ui[el.dataset.i18nTitle]; if (v != null) el.title = v; });
};

/* hero title: متن ساده با <br>؛ splits بعداً توسط main.js انجام می‌شود */
const applyHero = () => {
  const h = $('#heroTitle'); if (!h) return;
  const parts = String(t('hero.title')).split('|');
  h.textContent = '';
  parts.forEach((p, i) => {
    if (i > 0) h.appendChild(document.createElement('br'));
    h.appendChild(document.createTextNode(p));
  });
  if (window.SSUI && window.SSUI.splitWords) window.SSUI.splitWords();
};

/* ── switch language ── */
const setLang = lang => {
  if (!window.SS_DATA || !window.SS_DATA[lang]) return;
  current = lang;
  try { localStorage.setItem(K_LANG, lang); } catch (e) {}
  window.SS_LANG = lang;
  const meta = data(lang).meta;
  document.documentElement.lang = lang;
  document.documentElement.dir = meta.dir;
  document.title = lang === 'fa' ? 'استار شاپ | خدمات پرداخت و سرویس‌های بین‌المللی'
    : lang === 'ar' ? 'ستار شوب | خدمات الدفع والخدمات الدولية'
    : 'Star Shop | International Payment & Digital Services';
  /* lang menu state */
  $$('#langMenu button').forEach(b => b.classList.toggle('active', b.dataset.lang === lang));
  const lbl = $('#langBtn [data-i18n="lang.label"]') || $('#langBtn span');
  if (lbl) lbl.textContent = data(lang).ui['lang.label'];
  applyStatic();
  applyHero();
  document.dispatchEvent(new CustomEvent('ss:lang', { detail: { lang } }));
};

/* ── init ── */
const init = () => {
  window.SS_LANG = current;
  const menu = $('#langMenu');
  if (menu) {
    $$('#langMenu button').forEach(b => {
      b.classList.toggle('active', b.dataset.lang === current);
      /* حذف برچسب «به‌زودی» — همه زبان‌ها فعال هستند */
      const em = b.querySelector('em'); if (em) em.remove();
      b.addEventListener('click', () => {
        setLang(b.dataset.lang);
        const m = $('#langMenu'); if (m) m.hidden = true;
        const btn = $('#langBtn'); if (btn) btn.setAttribute('aria-expanded', 'false');
      });
    });
  }
  const meta = data(current).meta;
  document.documentElement.lang = current;
  document.documentElement.dir = meta.dir;
  applyStatic();
  applyHero();
};

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();

window.SSI18N = { setLang, applyStatic, applyHero, t, fmt, get lang() { return current; }, data };
})();
