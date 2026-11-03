/* ═══════════════════════════════════════════════════
   STARSHOP — toc.js  (فهرست آسان مطالب — v20260979)
   معادل استاتیک «Easy Table of Contents»:
   • اسکن خودکار h2 های main.container از محتوای صفحه
   • ساخت جعبه «فهرست مطالب» با لینک‌های پرشی
     (انکرها در HTML استاتیک از قبل bake شده‌اند تا
      گوگل سایت‌لینک پرشی زیر نتیجه جستجو نشان دهد)
   • باز/بسته کردن + هایلایت بخش فعال هنگام اسکرول
   • کاملاً محافظت‌شده: هرگز خطای JS نمی‌دهد
   ═══════════════════════════════════════════════════ */
(function () {
  'use strict';
  try {
    var main = document.querySelector('main');
    if (!main || main.querySelector('.toc-box')) return;
    var hs = [].slice.call(main.querySelectorAll('h2'));
    if (hs.length < 3) return;

    /* انکر مطمئن: اگر h2 شناسه نداشت، خودکار بگذار */
    hs.forEach(function (h, i) { if (!h.id) h.id = 'sec-' + (i + 1); });

    /* جعبه فهرست */
    var box = document.createElement('nav');
    box.className = 'toc-box';
    box.setAttribute('aria-label', 'فهرست مطالب');

    var head = document.createElement('button');
    head.type = 'button';
    head.className = 'toc-head';
    head.setAttribute('aria-expanded', 'true');
    head.innerHTML =
      '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">' +
      '<path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" d="M4 6h16M4 12h16M4 18h10"/></svg>' +
      '<span>فهرست مطالب</span>' +
      '<svg class="toc-chev" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">' +
      '<path fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" d="M6 9l6 6 6-6"/></svg>';

    var ol = document.createElement('ol');
    ol.className = 'toc-list';
    var links = {};
    var cur = null;
    hs.forEach(function (h) {
      var li = document.createElement('li');
      var a = document.createElement('a');
      a.href = '#' + h.id;
      a.textContent = (h.textContent || '').trim();
      li.appendChild(a);
      ol.appendChild(li);
      links[h.id] = a;
      /* هایلایت فوری لینک کلیک‌شده (قطعی، مستقل از IO) */
      a.addEventListener('click', function () {
        if (cur) cur.classList.remove('on');
        cur = a;
        a.classList.add('on');
      });
    });

    box.appendChild(head);
    box.appendChild(ol);

    /* درج قبل از سکشن اولین h2 (بعد از مقدمه) */
    var first = hs[0].closest('section') || hs[0];
    first.parentNode.insertBefore(box, first);

    /* باز/بسته */
    head.addEventListener('click', function () {
      var closed = box.classList.toggle('toc-closed');
      head.setAttribute('aria-expanded', closed ? 'false' : 'true');
    });

    /* هایلایت بخش فعال هنگام اسکرول */
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) {
            if (cur) cur.classList.remove('on');
            cur = links[en.target.id];
            if (cur) cur.classList.add('on');
          }
        });
      }, { rootMargin: '-15% 0px -55% 0px' });
      hs.forEach(function (h) { io.observe(h); });
    }
  } catch (e) { /* هیچ‌وقت خطا نده */ }
})();
