/* ═══════════════════════════════════════════════════
   STARSHOP — cart.js
   سبد خرید + پرداخت از طریق تلگرام و بله
   با ارسال خودکار جزئیات سفارش (بدون تایپ توسط کاربر)
   ═══════════════════════════════════════════════════ */
(() => {
'use strict';

const $  = (s, c) => (c || document).querySelector(s);
const $$ = (s, c) => Array.from((c || document).querySelectorAll(s));

const CFG = () => window.SS_CONFIG || {};
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
const escapeHtml = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const faDig = n => String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
const localDig = n => {
  const lang = window.SS_LANG || 'fa';
  if (lang === 'fa') return faDig(n);
  if (lang === 'ar') return String(n).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
  return String(n);
};

let toastFn = m => console.log('[toast]', m);
const setToast = fn => { toastFn = fn; };

/* ── state: سبد مخصوص هر کاربر ──
   مهمان:  ss_cart
   کاربر:  ss_cart:u:<uid>   (هر حساب کاربری سبد جدای خودش را دارد)
   هنگام ورود، سبد مهمان با سبد کاربر ادغام و سبد مهمان خالی می‌شود. */
const K_CART = 'ss_cart';
const userKey = uid => 'ss_cart:u:' + String(uid).replace(/[^a-z0-9_@.\-]/gi, '_');
const readBucket = key => { try { const v = JSON.parse(localStorage.getItem(key)); return Array.isArray(v) ? v.filter(x => x && x.id && x.title) : []; } catch (e) { return []; } };
const writeBucket = (key, arr) => { try { localStorage.setItem(key, JSON.stringify(arr.slice(0, 30))); } catch (e) {} };
const mergeBuckets = (base, extra) => {
  const out = base.map(x => Object.assign({}, x));
  (extra || []).forEach(it => {
    const ex = out.find(x => x.id === it.id);
    if (ex) ex.qty = Math.min(20, ex.qty + it.qty);
    else out.push(Object.assign({}, it));
  });
  return out.slice(0, 30);
};

let activeUid = null;   /* null = مهمان */
let items = [];
const curUid = () => {
  const s = window.SSAuth ? window.SSAuth.session() : null;
  return s ? String(s.phone || '').toLowerCase() : null;
};
const bucketKey = () => activeUid ? userKey(activeUid) : K_CART;
/* بارگذاری سبدِ زمینه فعال + ادغام سبد مهمان هنگام ورود */
const reloadForUser = () => {
  const uid = curUid();
  if (uid === activeUid) return;
  if (uid) {
    const own = readBucket(userKey(uid));
    const guest = readBucket(K_CART);
    items = mergeBuckets(own, guest);
    writeBucket(userKey(uid), items);
    writeBucket(K_CART, []); /* مهمان بعدی سبد خالی شروع می‌کند */
  } else {
    items = readBucket(K_CART);
  }
  activeUid = uid;
  document.dispatchEvent(new CustomEvent('ss:cart'));
};

/* ── order code ── */
const orderCode = () => {
  const arr = new Uint8Array(4);
  crypto.getRandomValues(arr);
  return 'SS-' + Array.from(arr, b => b.toString(16).padStart(2, '0')).join('').toUpperCase().slice(0, 6);
};

/* ── ops ── */
const save = () => { writeBucket(bucketKey(), items); renderBadge(); renderDrawer(); document.dispatchEvent(new CustomEvent('ss:cart')); };
const add = (id, title, qty = 1, meta = null) => {
  if (!id || !title) return;
  const ex = items.find(i => i.id === id);
  if (ex) ex.qty = Math.min(20, ex.qty + qty);
  else items.push({ id, title: String(title).slice(0, 100), qty: Math.min(20, Math.max(1, qty)), meta: meta || null });
  save();
  toastFn(fmt(t('cart.added'), { item: title }));
};
const setQty = (id, q) => {
  const it = items.find(i => i.id === id); if (!it) return;
  it.qty = Math.max(1, Math.min(20, q | 0));
  save();
};
const remove = id => { items = items.filter(i => i.id !== id); save(); toastFn(t('cart.removed')); };
const clear = () => { items = []; save(); };
const count = () => items.reduce((a, i) => a + i.qty, 0);

/* ── order message builder ── */
const giftTitle = it => {
  try { if (it.meta && it.meta.kind === 'gift' && window.SSGift) return window.SSGift.titleFor(it.meta); } catch (e) {}
  return it.title;
};
const giftLines = it => {
  try { if (it.meta && it.meta.kind === 'gift' && window.SSGift) return window.SSGift.metaLines(it); } catch (e) {}
  return [];
};
const buildMessage = () => {
  const C = CFG();
  const lang = window.SS_LANG || 'fa';
  const D = window.SS_DATA[lang] || window.SS_DATA.fa;
  const user = window.SSAuth ? window.SSAuth.session() : null;
  const prof = window.SSAuth ? window.SSAuth.profile() : null;
  const locale = D.meta.numLocale;
  const now = new Date();
  const code = orderCode();
  const L = [];
  L.push(t('order.header'));
  L.push('— — — — —');
  items.forEach((i, idx) => {
    L.push(`${localDig(idx + 1)}) ${giftTitle(i)} ×${localDig(i.qty)}`);
    giftLines(i).forEach(ln => L.push('   ' + ln));
  });
  L.push('— — — — —');
  L.push(`${t('cart.total')}: ${localDig(count())}`);
  L.push(t('cart.price.note'));
  L.push(`${t('cart.code')}: ${code}`);
  if (user) L.push(`${t('order.user')}: ${prof && prof.name ? prof.name : t('order.none')} — ${user.phone || ''}`);
  L.push(`${t('order.date')}: ${now.toLocaleDateString(locale)} ${now.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}`);
  L.push(`${t('order.site')}: ${location.origin + location.pathname}`);
  return { text: L.join('\n'), code };
};

/* ── checkout channels ── */
const checkoutTelegram = () => {
  if (!items.length) { toastFn(t('cart.empty')); return; }
  const { text, code } = buildMessage();
  saveOrder('tg', code);
  const url = `${CFG().telegram.url}?text=${encodeURIComponent(text)}`;
  save();
  toastFn(t('cart.sent.tg'));
  const w = window.open(url, '_blank', 'noopener,noreferrer');
  if (!w) location.href = url;
};

const checkoutBale = async () => {
  if (!items.length) { toastFn(t('cart.empty')); return; }
  const { text, code } = buildMessage();
  saveOrder('bale', code);
  let copied = false;
  try { await navigator.clipboard.writeText(text); copied = true; } catch (e) {
    try {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      copied = document.execCommand('copy');
      ta.remove();
    } catch (e2) { copied = false; }
  }
  toastFn(copied ? t('cart.sent.bale') : t('toast.copyfail'));
  const w = window.open(CFG().bale.url, '_blank', 'noopener,noreferrer');
  if (!w) location.href = CFG().bale.url;
};

const saveOrder = (channel, code) => {
  try {
    const kOrders = activeUid ? 'ss_orders:u:' + String(activeUid).replace(/[^a-z0-9_@.\-]/gi, '_') : 'ss_orders';
    const orders = JSON.parse(localStorage.getItem(kOrders) || '[]');
    orders.push({ code, channel, ts: Date.now(), items: items.map(i => ({ id: i.id, title: giftTitle(i), qty: i.qty, meta: i.meta || null })) });
    localStorage.setItem(kOrders, JSON.stringify(orders.slice(-30)));
  } catch (e) {}
};
/* تاریخچه سفارش‌های کاربر فعال (برای پنل حساب) */
const getOrders = () => {
  try {
    const kOrders = activeUid ? 'ss_orders:u:' + String(activeUid).replace(/[^a-z0-9_@.\-]/gi, '_') : 'ss_orders';
    const v = JSON.parse(localStorage.getItem(kOrders));
    return Array.isArray(v) ? v : [];
  } catch (e) { return []; }
};

/* ── badge ── */
const renderBadge = () => {
  $$('.cart-badge').forEach(b => {
    const n = count();
    b.textContent = localDig(n);
    b.hidden = n === 0;
  });
};

/* ── drawer ── */
const renderDrawer = () => {
  const list = $('#cartItems'); if (!list) return;
  const n = count();
  const cnt = $('#cartCount'); if (cnt) cnt.textContent = fmt(t('cart.items'), { n: localDig(n) });
  const empty = $('#cartEmpty'), foot = $('#cartFoot');
  if (!items.length) {
    list.hidden = true; if (empty) empty.hidden = false; if (foot) foot.hidden = true;
    return;
  }
  list.hidden = false; if (empty) empty.hidden = true; if (foot) foot.hidden = false;
  list.innerHTML = items.map(i => {
    const gl = giftLines(i);
    return `
    <li class="cart-item">
      <div class="ci-info">
        <b>${escapeHtml(giftTitle(i))}</b>
        ${gl.length ? `<span class="ci-meta">${gl.map(l => `<span>${escapeHtml(l)}</span>`).join('')}</span>` : ''}
        <span class="ci-qty">
          <button type="button" data-cart-dec="${escapeHtml(i.id)}" aria-label="${t('cart.dec')}">−</button>
          <b>${localDig(i.qty)}</b>
          <button type="button" data-cart-inc="${escapeHtml(i.id)}" aria-label="${t('cart.inc')}">+</button>
        </span>
      </div>
      <button type="button" class="ci-del" data-cart-del="${escapeHtml(i.id)}" aria-label="${t('cart.remove')}">
        <svg class="ic" viewBox="0 0 24 24"><use href="#i-close"/></svg>
      </button>
    </li>`;
  }).join('');
  const hint = $('#cartLoginHint');
  if (hint) hint.hidden = !!window.SSAuth?.session();
};

/* ── delegation ── */
document.addEventListener('click', e => {
  const addBtn = e.target.closest('[data-add-cart]');
  if (addBtn) {
    const { id, title } = addBtn.dataset;
    add(id || addBtn.dataset.service, title || '');
    return;
  }
  const inc = e.target.closest('[data-cart-inc]');
  if (inc) { const it = items.find(i => i.id === inc.dataset.cartInc); if (it) setQty(it.id, it.qty + 1); return; }
  const dec = e.target.closest('[data-cart-dec]');
  if (dec) { const it = items.find(i => i.id === dec.dataset.cartDec); if (it) setQty(it.id, it.qty - 1); return; }
  const del = e.target.closest('[data-cart-del]');
  if (del) { remove(del.dataset.cartDel); return; }
  if (e.target.closest('[data-cart-clear]')) { clear(); return; }
  if (e.target.closest('[data-checkout-tg]')) { e.preventDefault(); checkoutTelegram(); return; }
  if (e.target.closest('[data-checkout-bale]')) { e.preventDefault(); checkoutBale(); return; }
});

/* gift tiles: کلیک روی گیفت کارت → مودال انتخاب ریجن/مبلغ/ارز (در gift.js) */

/* ── init ── */
const init = () => {
  reloadForUser();
  const tg = $('[data-checkout-tg]'), bl = $('[data-checkout-bale]');
  renderBadge(); renderDrawer();
  document.addEventListener('ss:lang', () => { renderBadge(); renderDrawer(); });
  document.addEventListener('ss:auth', () => { reloadForUser(); renderBadge(); renderDrawer(); });
  /* نرخ لحظه‌ای عوض شد → قیمت‌های تومانی سبد باز همیشه تازه بمانند */
  if (window.SSRates) window.SSRates.subscribe(() => {
    const m = document.getElementById('cartModal');
    if (m && !m.hidden) renderDrawer();
  });
};

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();

/* ── public API ── */
window.SSCart = { add, remove, setQty, clear, count, items: () => items.slice(), renderBadge, renderDrawer, buildMessage, checkoutTelegram, checkoutBale, setToast, getOrders, reloadForUser };
})();
