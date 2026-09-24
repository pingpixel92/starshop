/* ═══════════════════════════════════════════════════
   STARSHOP — auth.js
   ورود با شماره موبایل + کد ۴ رقمی (هر بار کد جدید)
   + ادامه با گوگل + پنل حساب کاربری
   امنیت: هش SHA-256 کد، محدودیت تلاش، انقضا، قفل موقت
   ═══════════════════════════════════════════════════ */
(() => {
'use strict';

const CFG = () => window.SS_CONFIG || {};
const SEC = () => (CFG().security || {});
const $  = (s, c) => (c || document).querySelector(s);
const $$ = (s, c) => Array.from((c || document).querySelectorAll(s));

/* ── i18n helper ── */
const t = k => {
  const lang = window.SS_LANG || 'fa';
  const dd = (window.SS_DATA[lang] || window.SS_DATA.fa);
  const fdd = window.SS_DATA.fa;
  let v = dd.ui && dd.ui[k]; if (v != null) return v;
  if (dd.order) { v = dd.order[k.replace(/^order\./, '')]; if (v != null) return v; }
  v = fdd.ui[k]; if (v != null) return v;
  if (fdd.order) { v = fdd.order[k]; if (v != null) return v; }
  return k;
};
const fmt = (s, obj) => String(s).replace(/\{(\w+)\}/g, (_, k) => obj && obj[k] != null ? obj[k] : '');
const faDig = n => String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
const localDig = n => {
  const lang = window.SS_LANG || 'fa';
  if (lang === 'fa') return faDig(n);
  if (lang === 'ar') return String(n).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
  return String(n);
};

/* ── crypto helpers ── */
const sha256 = async txt => {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(txt));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
};
const randCode = len => {
  const arr = new Uint32Array(len);
  crypto.getRandomValues(arr);
  return Array.from(arr, x => (x % 10)).join('');
};
const randToken = () => {
  const arr = new Uint8Array(24);
  crypto.getRandomValues(arr);
  return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
};
/* مقایسه زمان-ثابت ساده برای دو هش */
const safeEq = (a, b) => {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
};

/* ── storage keys ── */
const K_SESSION = 'ss_session';
const K_OTP     = 'ss_otp';
const K_META    = 'ss_otp_meta';
const K_PROFILE = 'ss_profile';

const read = (k, fb) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? fb : v; } catch (e) { return fb; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
const del = k => { try { localStorage.removeItem(k); } catch (e) {} };

/* ── session ── */
const session = () => {
  const s = read(K_SESSION, null);
  if (!s || !s.token || !s.exp || Date.now() > s.exp) { del(K_SESSION); return null; }
  return s;
};
const profile = () => read(K_PROFILE, { name: '' });

/* ── UI refs ── */
let modal, toastFn = m => console.log('[toast]', m);
const setToast = fn => { toastFn = fn; };

const showStep = name => {
  $$('.auth-step', modal).forEach(st => st.hidden = st.dataset.step !== name);
  const head = $('.auth-head', modal);
  if (head) head.textContent = name === 'account' ? t('auth.account') : t('auth.title');
};

const toastErr = id => { const el = $(`[data-autherr="${id}"]`, modal); if (el) el.hidden = false; };
const clearErrs = () => $$('[data-autherr]', modal).forEach(e => e.hidden = true);

/* ── normalize phone ── */
const normPhone = v => String(v || '')
  .replace(/[\u06F0-\u06F9]/g, d => String(d.charCodeAt(0) - 0x06F0))
  .replace(/[\u0660-\u0669]/g, d => String(d.charCodeAt(0) - 0x0660))
  .replace(/[\s\-()]/g, '').replace(/^\+98/, '0').replace(/^0098/, '0').replace(/^98(?=9\d{9}$)/, '0');

/* ── OTP state ── */
let currentPhone = '';
let timerInt = null;
let lastDemoCode = '';

const getMeta = () => read(K_META, { sentAt: 0, lockUntil: 0, hourCount: 0, hourStart: 0 });
const setMeta = m => write(K_META, m);

const startTimers = () => {
  clearInterval(timerInt);
  const expEl = $('[data-otp-expire]', modal), rsBtn = $('[data-otp-resend]', modal), rsLbl = $('[data-otp-resend-label]', modal);
  const otp = read(K_OTP, null);
  if (!otp) return;
  const tick = () => {
    const now = Date.now();
    const expLeft = Math.max(0, Math.ceil((otp.exp - now) / 1000));
    const rsLeft  = Math.max(0, Math.ceil((otp.resendAt - now) / 1000));
    if (expEl) expEl.textContent = fmt(t('auth.otp.expire'), { s: localDig(expLeft) });
    if (rsBtn) rsBtn.disabled = rsLeft > 0;
    if (rsLbl) rsLbl.textContent = rsLeft > 0 ? fmt(t('auth.otp.timer'), { s: localDig(rsLeft) }) : t('auth.otp.resend');
    if (expLeft <= 0) { clearInterval(timerInt); if (expEl) expEl.textContent = t('auth.err.expired'); }
  };
  timerInt = setInterval(tick, 1000); tick();
};

/* ── send code (هر بار کد جدید) ── */
const sendCode = async phone => {
  const sec = SEC();
  const meta = getMeta();
  const now = Date.now();
  if (meta.lockUntil && now < meta.lockUntil) {
    toastErr('lock');
    return { ok: false };
  }
  /* ضد اسپم: حداکثر N کد در ساعت */
  const hourStart = (now - (meta.hourStart || 0) < 3600000) ? (meta.hourStart || now) : now;
  const hourCount = hourStart === (meta.hourStart || now) ? (meta.hourCount || 0) : 0;
  if (hourCount >= (sec.maxCodesPerHour || 6)) { toastErr('spam'); return { ok: false }; }

  const code = randCode(4);
  const salt = randToken().slice(0, 12);
  const hash = await sha256(salt + ':' + code);
  const otp = { hash, salt, exp: now + (sec.otpTtl || 120) * 1000, resendAt: now + (sec.otpResend || 45) * 1000, attempts: 0, phone };
  write(K_OTP, otp);
  setMeta({ sentAt: now, lockUntil: 0, hourStart, hourCount: hourCount + 1 });

  /* ارسال واقعی SMS در صورت اتصال گیت‌وی؛ در غیر این‌صورت حالت نمایشی */
  let sent = false;
  const endpoint = (CFG().sms || {}).endpoint;
  if (endpoint) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code, message: `${code} — Star Shop` })
      });
      sent = res.ok;
    } catch (e) { sent = false; }
  }

  currentPhone = phone;
  $('[data-otp-phone]', modal).textContent = phone;
  const demo = $('[data-otp-demo]', modal);
  if (!sent) {
    demo.hidden = false;
    lastDemoCode = code;
    const raw = t('auth.demo.body');
    const idx = raw.indexOf('{code}');
    const pre = $('[data-demo-pre]', modal), post = $('[data-demo-post]', modal);
    if (pre) pre.textContent = idx >= 0 ? raw.slice(0, idx) : raw + ' ';
    if (post) post.textContent = idx >= 0 ? raw.slice(idx + 6) : '';
    $('[data-otp-demo-code]', modal).textContent = localDig(code);
  } else {
    demo.hidden = true;
    lastDemoCode = '';
  }
  clearErrs();
  showStep('otp');
  startTimers();
  $$('.otp-input', modal).forEach(i => i.value = '');
  setTimeout(() => { const f = $('.otp-input', modal); if (f) f.focus(); }, 120);
  return { ok: true, demoCode: sent ? null : code };
};

/* ── verify ── */
const verify = async codeStr => {
  const otp = read(K_OTP, null);
  const sec = SEC();
  if (!otp) { toastErr('expired'); return false; }
  if (Date.now() > otp.exp) { del(K_OTP); clearInterval(timerInt); toastErr('expired'); return false; }
  if (otp.attempts >= (sec.otpMaxAttempts || 5)) {
    setMeta(Object.assign(getMeta(), { lockUntil: Date.now() + (sec.otpLockMs || 300000) }));
    toastErr('lock'); return false;
  }
  const hash = await sha256(otp.salt + ':' + codeStr);
  if (!safeEq(hash, otp.hash)) {
    otp.attempts++;
    write(K_OTP, otp);
    const left = (sec.otpMaxAttempts || 5) - otp.attempts;
    if (left <= 0) {
      setMeta(Object.assign(getMeta(), { lockUntil: Date.now() + (sec.otpLockMs || 300000) }));
      toastErr('lock');
    } else {
      const el = $('[data-autherr="attempts"]', modal);
      if (el) { el.hidden = false; $('[data-left]', el).textContent = localDig(left); }
    }
    return false;
  }
  /* موفق */
  del(K_OTP);
  clearInterval(timerInt);
  const tok = randToken();
  const ttl = SEC().sessionTtl || 1209600000;
  const sig = await sha256('sssig:' + tok + ':' + currentPhone);
  write(K_SESSION, { token: tok, sig, phone: currentPhone, since: Date.now(), exp: Date.now() + ttl });
  const p = profile(); if (!p.name) { p.phone = currentPhone; write(K_PROFILE, p); }
  renderAccount();
  showStep('account');
  toastFn(t('auth.welcome'));
  document.dispatchEvent(new CustomEvent('ss:auth'));
  return true;
};

/* ── Google ── */
let gisLoaded = false;
const handleGoogle = async response => {
  try {
    const payload = JSON.parse(decodeURIComponent(atob(response.credential.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))));
    const name = String(payload.name || '').slice(0, 60);
    const email = String(payload.email || '').slice(0, 90);
    const tok = randToken();
    const sig = await sha256('sssig:' + tok + ':' + email);
    write(K_SESSION, { token: tok, sig, phone: email, name, google: true, since: Date.now(), exp: Date.now() + (SEC().sessionTtl || 1209600000) });
    const p = profile(); if (!p.name && name) { p.name = name; write(K_PROFILE, p); }
    renderAccount();
    showStep('account');
    toastFn(t('auth.welcome'));
    document.dispatchEvent(new CustomEvent('ss:auth'));
  } catch (e) { toastFn(t('auth.google.err')); }
};
const googleLogin = () => {
  const cid = (CFG().googleClientId || '').trim();
  if (!cid) { if (modal) showStep('google'); return; } /* حالت محلی: فرم گوگل داخلی */
  const init = () => {
    try {
      google.accounts.id.initialize({ client_id: cid, callback: handleGoogle, auto_select: false, use_fedcm_for_prompt: false });
      google.accounts.id.prompt();
    } catch (e) { toastFn(t('auth.google.err')); }
  };
  if (typeof google !== 'undefined' && google.accounts) init();
  else if (!gisLoaded) {
    gisLoaded = true;
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true; s.defer = true; s.onload = init; s.onerror = () => toastFn(t('auth.google.err'));
    document.head.appendChild(s);
  }
};

/* ── account panel render ── */
const renderAccount = () => {
  const s = session();
  const nameEl = $('[data-acc-name]', modal), phoneEl = $('[data-acc-phone]', modal),
        sinceEl = $('[data-acc-since]', modal), nameInput = $('[data-acc-name-input]', modal);
  if (!s) return;
  const p = profile();
  const lang = window.SS_LANG || 'fa';
  const locale = (window.SS_DATA[lang] || window.SS_DATA.fa).meta.numLocale;
  if (nameEl) nameEl.textContent = p.name || (s.google ? (s.name || t('order.none')) : t('order.none'));
  if (phoneEl) phoneEl.textContent = s.phone || '—';
  if (sinceEl) sinceEl.textContent = new Date(s.since || Date.now()).toLocaleDateString(locale);
  if (nameInput && p.name) nameInput.value = p.name;
  /* orders (مخصوص همان کاربر) + چیپ وضعیت زنده از مسیر کارت به کارت */
  const list = $('[data-acc-orders]', modal);
  if (list) {
    const orders = (window.SSCart && window.SSCart.getOrders ? window.SSCart.getOrders() : read('ss_orders', [])).slice().reverse();
    if (!orders.length) {
      list.innerHTML = `<div class="acc-empty"><svg class="ic" viewBox="0 0 24 24"><use href="#i-box"/></svg><b>${t('auth.orders.empty')}</b><p>${t('auth.orders.empty.hint')}</p></div>`;
    } else {
      const OST = { new: 'ost.new', sent: 'ost.sent', pending: 'ost.pending', review: 'ost.review', approved: 'ost.approved', delivered: 'ost.delivered', rejected: 'ost.rejected' };
      list.innerHTML = orders.map(o => {
        const items = (o.items || []).map(i => `<li>${escapeHtml(i.title)} <b>×${localDig(i.qty)}</b></li>`).join('');
        const ch = o.channel === 'bale' ? t('order.channel.bale') : t('order.channel.tg');
        const dt = new Date(o.ts).toLocaleDateString(locale);
        /* وضعیت ذخیره‌شده از صفحه پرداخت (هر ۱۲ ثانیه همان‌جا تازه می‌شود) */
        let st = null; try { st = localStorage.getItem('ss_c2c_status_' + o.code); } catch (e) {}
        const stChip = (st && OST[st]) ? `<span class="chip ost-chip ost-${escapeHtml(st)}">${t(OST[st])}</span>` : '';
        return `<article class="acc-order">
          <div class="acc-order-head"><b dir="ltr">${escapeHtml(o.code)}</b><span class="chip">${escapeHtml(ch)}</span>${stChip}<small>${dt}</small></div>
          <ul>${items}</ul>
          <a class="acc-track-link" href="orders.html">${t('auth.orders.track')} ←</a>
        </article>`;
      }).join('');
    }
  }
};
const escapeHtml = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/* ── header sync ── */
const syncHeader = () => {
  const btn = $('#loginBtn');
  if (!btn) return;
  const s = session();
  const label = btn.querySelector('[data-i18n="login"]');
  const mAcc = $('#accountBtnM');
  if (s) {
    const p = profile();
    btn.classList.add('is-logged');
    if (mAcc) mAcc.classList.add('is-logged');
    if (label) label.textContent = p.name || s.phone || t('auth.account');
    btn.setAttribute('aria-label', t('auth.account'));
  } else {
    btn.classList.remove('is-logged');
    if (mAcc) mAcc.classList.remove('is-logged');
    if (label) label.textContent = t('login');
  }
};
document.addEventListener('ss:lang', syncHeader);
document.addEventListener('ss:auth', syncHeader);
document.addEventListener('ss:lang', () => {
  if (modal && !modal.hidden && session()) { renderAccount(); showStep('account'); }
});

/* ── open/close ── */
const open = () => {
  if (!modal) return;
  if (window.SSUI && window.SSUI.openModal) { window.SSUI.openModal(modal); }
  clearErrs();
  if (session()) { renderAccount(); showStep('account'); }
  else { showStep('phone'); const ph = $('[data-auth-phone]', modal); setTimeout(() => ph && ph.focus(), 120); }
  syncHeader();
};

/* ── bind events ── */
const bind = () => {
  modal = $('#authModal');
  if (!modal) return;

  /* phone step */
  const phoneForm = $('[data-auth-form-phone]', modal);
  if (phoneForm) phoneForm.addEventListener('submit', e => {
    e.preventDefault();
    clearErrs();
    const inp = $('[data-auth-phone]', modal);
    const phone = normPhone(inp.value);
    if (!/^09\d{9}$/.test(phone)) { toastErr('phone'); return; }
    const btn = phoneForm.querySelector('button[type="submit"]');
    if (btn) { btn.disabled = true; btn.classList.add('loading'); }
    sendCode(phone).finally(() => { if (btn) { btn.disabled = false; btn.classList.remove('loading'); } });
  });

  /* resend */
  const rs = $('[data-otp-resend]', modal);
  if (rs) rs.addEventListener('click', e => {
    e.preventDefault();
    if (rs.disabled) return;
    sendCode(currentPhone).then(r => { if (r.ok) toastFn(t('auth.resend.ok')); });
  });
  const edit = $('[data-otp-edit]', modal);
  if (edit) edit.addEventListener('click', e => { e.preventDefault(); clearInterval(timerInt); del(K_OTP); showStep('phone'); });

  /* درج خودکار کد (حالت نمایشی) */
  const af = $('[data-otp-autofill]', modal);
  if (af) af.addEventListener('click', e => {
    e.preventDefault();
    if (!lastDemoCode) return;
    inputs.forEach((x, j) => x.value = lastDemoCode[j] || '');
    verify(lastDemoCode).then(ok => { if (!ok) setTimeout(() => { inputs.forEach(x => x.value = ''); inputs[0].focus(); }, 350); });
  });

  /* otp inputs */
  const inputs = $$('.otp-input', modal);
  inputs.forEach((inp, i) => {
    inp.addEventListener('input', () => {
      inp.value = inp.value.replace(/\D/g, '').slice(0, 1);
      if (inp.value && i < inputs.length - 1) inputs[i + 1].focus();
      if (inputs.every(x => x.value)) verify(inputs.map(x => x.value).join('')).then(ok => { if (!ok) setTimeout(() => { inputs.forEach(x => x.value = ''); inputs[0].focus(); }, 350); });
    });
    inp.addEventListener('keydown', e => {
      if (e.key === 'Backspace' && !inp.value && i > 0) inputs[i - 1].focus();
    });
    inp.addEventListener('paste', e => {
      e.preventDefault();
      const txt = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, inputs.length);
      if (!txt) return;
      inputs.forEach((x, j) => x.value = txt[j] || '');
      if (txt.length === inputs.length) verify(txt).then(ok => { if (!ok) setTimeout(() => { inputs.forEach(x => x.value = ''); inputs[0].focus(); }, 350); });
      else inputs[Math.min(txt.length, inputs.length - 1)].focus();
    });
  });
  /* digits only on mobile keyboards */
  inputs.forEach(inp => inp.setAttribute('inputmode', 'numeric'));
  inputs.forEach(inp => inp.setAttribute('autocomplete', 'one-time-code'));

  /* google */
  const g = $('[data-auth-google]', modal);
  if (g) g.addEventListener('click', e => { e.preventDefault(); googleLogin(); });

  /* google local form */
  const gf = $('[data-auth-form-google]', modal);
  if (gf) gf.addEventListener('submit', async e => {
    e.preventDefault();
    const inp = $('[data-auth-gemail]', modal);
    const email = String(inp && inp.value || '').trim().slice(0, 90);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { const er = $('[data-autherr="gmail"]', modal); if (er) er.hidden = false; return; }
    const btn = gf.querySelector('button[type="submit"]');
    if (btn) { btn.disabled = true; btn.classList.add('loading'); }
    try {
      const name = email.split('@')[0].slice(0, 40);
      const tok = randToken();
      const sig = await sha256('sssig:' + tok + ':' + email);
      write(K_SESSION, { token: tok, sig, phone: email, name, google: true, since: Date.now(), exp: Date.now() + (SEC().sessionTtl || 1209600000) });
      const p = profile(); if (!p.name) { p.name = name; write(K_PROFILE, p); }
      clearErrs();
      renderAccount();
      showStep('account');
      toastFn(t('auth.welcome'));
      document.dispatchEvent(new CustomEvent('ss:auth'));
    } finally { if (btn) { btn.disabled = false; btn.classList.remove('loading'); } }
  });
  const gback = $('[data-google-back]', modal);
  if (gback) gback.addEventListener('click', e => { e.preventDefault(); showStep('phone'); });

  /* account actions */
  const lo = $('[data-acc-logout]', modal);
  if (lo) lo.addEventListener('click', e => {
    e.preventDefault();
    del(K_SESSION); del(K_OTP);
    syncHeader();
    showStep('phone');
    document.dispatchEvent(new CustomEvent('ss:auth'));
  });
  const prof = $('[data-acc-profile-form]', modal);
  if (prof) prof.addEventListener('submit', e => {
    e.preventDefault();
    const p = profile();
    const val = $('[data-acc-name-input]', modal);
    p.name = val ? val.value.trim().slice(0, 60) : '';
    write(K_PROFILE, p);
    syncHeader(); renderAccount();
    toastFn(t('auth.saved'));
  });
  const back = $('[data-otp-back]', modal);
  if (back) back.addEventListener('click', e => { e.preventDefault(); clearInterval(timerInt); showStep('phone'); });
};

/* ── init ── */
const init = () => { bind(); syncHeader();
  /* دکمه حساب موبایل: همان جریان ورود/حساب */
  const mAcc = $('#accountBtnM'), lb = $('#loginBtn');
  if (mAcc && lb) mAcc.addEventListener('click', e => { e.preventDefault(); lb.click(); });
};
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();

/* ── public API ── */
window.SSAuth = {
  open,
  session,
  profile: () => { const s = session(); return s ? { phone: s.phone, name: profile().name || '' } : null; },
  logout: () => { del(K_SESSION); del(K_OTP); syncHeader(); document.dispatchEvent(new CustomEvent('ss:auth')); },
  setToast,
  syncHeader,
  normPhone
};
})();
