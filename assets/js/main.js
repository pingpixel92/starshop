/* ═══════════════════════════════════════════
   STARSHOP — main.js  (no frameworks)
   ═══════════════════════════════════════════ */
(() => {
'use strict';

/* ── utils ── */
const $  = (s, c) => (c || document).querySelector(s);
const $$ = (s, c) => Array.from((c || document).querySelectorAll(s));
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const touch   = matchMedia('(hover: none), (pointer: coarse)').matches;
const clamp   = (v, a, b) => Math.min(b, Math.max(a, v));
const faDig   = n => Number(n).toLocaleString('fa-IR', { useGrouping: false });
const normTxt = s => String(s || '')
  .replace(/[\u064A]/g, '\u06CC').replace(/[\u0643]/g, '\u06A9')
  .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
  .replace(/[\u06F0-\u06F9]/g, d => String(d.charCodeAt(0) - 0x06F0))
  .replace(/[\u0660-\u0669]/g, d => String(d.charCodeAt(0) - 0x0660))
  .replace(/\u200c/g, ' ').toLowerCase().trim();

let toastTimer;
const toast = msg => {
  const t = $('#toast'); if (!t) return;
  t.textContent = msg; t.hidden = false;
  requestAnimationFrame(() => t.classList.add('show'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.hidden = true, 450); }, 2800);
};

/* ── service catalog (single source of truth) ── */
const CATS = [
  { id: 'payments',  label: 'پرداخت‌ها' },
  { id: 'accounts',  label: 'حساب‌ها' },
  { id: 'cards',     label: 'کارت‌ها' },
  { id: 'ai',        label: 'اکانت‌ها' },
  { id: 'giftcards', label: 'گیفت کارت' },
  { id: 'shopping',  label: 'خرید خارجی' },
  { id: 'income',    label: 'درآمد ارزی' },
  { id: 'exams',     label: 'آزمون‌ها' },
  { id: 'crypto',    label: 'رمزارز' },
  { id: 'business',  label: 'کسب‌وکارها' }
];
const catLabel = id => (CATS.find(c => c.id === id) || {}).label || '';

const SERVICES = [
  { id:'pay-web', cat:'payments', icon:'globe', title:'پرداخت سایت‌های خارجی', desc:'خرید و پرداخت از هر سایت بین‌المللی؛ لینک یا فاکتور را ثبت کنید، هزینه ریالی پرداخت می‌شود و پرداخت جهانی انجام می‌گیرد.', who:'کاربرانی که از سایت‌های خارجی خرید می‌کنند و ابزار پرداخت ارزی ندارند؛ خریداران نرم‌افزار، قالب، دوره و هر محصول دیجیتال یا فیزیکی.', steps:['لینک سایت یا فاکتور و مبلغ دقیق را ثبت می‌کنید','هزینه و شرایط پس از بررسی اعلام و تأیید می‌شود','هزینه را به ریال پرداخت می‌کنید','پرداخت ارزی انجام و رسید ارائه می‌شود'], req:['آدرس سایت یا فاکتور','مبلغ دقیق به ارز مقصد','راه ارتباطی برای پیگیری'] },
  { id:'pay-sub', cat:'payments', icon:'spark', title:'پرداخت اشتراک‌های خارجی', desc:'خرید و تمدید اشتراک سرویس‌های خارجی، ماهانه یا سالانه؛ از پنل کاربری خود لینک تمدید را ارسال کنید.', who:'کاربران سرویس‌های اشتراکی خارجی که نیاز به تمدید منظم دارند.', steps:['لینک یا تصویر فاکتور اشتراک را ثبت می‌کنید','هزینه پس از بررسی اعلام می‌شود','پرداخت ریالی انجام می‌دهید','اشتراک تمدید و تأیید می‌شود'], req:['لینک تمدید یا فاکتور','نوع پلن و مدت اشتراک'] },
  { id:'pay-uni', cat:'payments', icon:'cap', title:'پرداخت هزینه‌های دانشگاهی', desc:'پرداخت شهریه، هزینه پذیرش، خوابگاه و سایر هزینه‌های تحصیلی دانشگاه‌های خارجی.', who:'دانشجویان و پذیرفته‌شدگان دانشگاه‌های خارج از کشور.', steps:['فاکتور یا نامه پرداخت دانشگاه را ثبت می‌کنید','اطلاعات دانشجویی بررسی می‌شود','هزینه ریالی پرداخت می‌شود','پرداخت انجام و رسید ارائه می‌شود'], req:['نامه پذیرش یا فاکتور دانشگاه','شناسه دانشجویی و نام دانشگاه','مبلغ دقیق'] },
  { id:'pay-exam', cat:'payments', icon:'doc', title:'پرداخت آزمون‌های بین‌المللی', desc:'ثبت‌نام و پرداخت هزینه آزمون‌های بین‌المللی شامل IELTS، TOEFL، Duolingo، PTE، PMP، AWS و سایر آزمون‌ها.', who:'متقاضیان مهاجرت، تحصیل یا اشتغال بین‌المللی که به کارنامه آزمون جهانی نیاز دارند.', steps:['نوع آزمون، کشور و مرکز را ثبت می‌کنید','اطلاعات پاسخ‌دهی بررسی و تأیید می‌شود','هزینه ریالی پرداخت می‌شود','ثبت‌نام انجام و تأییدیه ارائه می‌شود'], req:['نوع آزمون و تاریخ موردنظر','کشور و مرکز آزمون','اطلاعات پاسخ‌دهی طبق مدرک هویتی'] },
  { id:'pay-embassy', cat:'payments', icon:'plane', title:'پرداخت ویزا و سفارت', desc:'پرداخت هزینه ویزا، وقت مصاحبه و خدمات کنسولی سفارت‌های مختلف.', who:'متقاضیان ویزای تحصیلی، کاری، گردشگری و اقامت.', steps:['نوع ویزا و کشور را ثبت می‌کنید','مبلغ و نحوه پرداخت اعلام می‌شود','هزینه ریالی پرداخت می‌شود','پرداخت انجام و رسید ارائه می‌شود'], req:['نوع ویزا و کشور مقصد','کد پیگیری پرونده (در صورت وجود)','اطلاعات درخواست‌دهنده'] },
  { id:'pay-saas', cat:'payments', icon:'cpu', title:'پرداخت سرویس‌های SaaS و تخصصی', desc:'پرداخت هاست، دامنه، ابزارهای توسعه و هر سرویس آنلاین تخصصی دیگر.', who:'توسعه‌دهندگان، استارتاپ‌ها و تیم‌هایی که از ابزارهای خارجی استفاده می‌کنند.', steps:['آدرس سرویس و فاکتور را ثبت می‌کنید','هزینه پس از بررسی اعلام می‌شود','پرداخت ریالی انجام می‌دهید','سرویس فعال و تأیید می‌شود'], req:['آدرس سرویس یا فاکتور','نوع پلن و مدت','اطلاعات حساب کاربری (در صورت نیاز)'] },
  { id:'pp-person', cat:'accounts', icon:'wallet', title:'افتتاح حساب PayPal Personal', desc:'همراهی گام‌به‌گام در فرآیند افتتاح و تنظیم حساب PayPal شخصی برای پرداخت‌های جهانی.', who:'کاربرانی که برای خرید شخصی از سایت‌های خارجی به PayPal نیاز دارند.', steps:['درخواست شما ثبت و بررسی می‌شود','مراحل افتتاح و تنظیم حساب راهنمایی می‌شوید','اتصال و تأیید حساب انجام می‌شود','حساب آماده استفاده است'], req:['مدارک هویتی معتبر','ایمیل فعال','شماره تماس'] },
  { id:'pp-business', cat:'accounts', icon:'wallet', title:'افتتاح حساب PayPal Business', desc:'راه‌اندازی حساب PayPal Business برای فروشندگان و کسب‌وکارهایی که دریافت و پرداخت وجه دارند.', who:'فروشندگان آنلاین و کسب‌وکارهایی که با مشتریان خارجی کار می‌کنند.', steps:['شرایط کسب‌وکار شما بررسی می‌شود','فرآیند افتتاح حساب Business همراهی می‌شوید','تنظیمات دریافت و پرداخت انجام می‌شود','حساب آماده بهره‌برداری است'], req:['اطلاعات کسب‌وکار','ایمیل سازمانی','مدارک هویتی'] },
  { id:'pp-balance', cat:'accounts', icon:'coins', title:'خرید و فروش موجودی PayPal', desc:'تبدیل و تسویه موجودی PayPal، منوط به بررسی و تأیید شرایط هر سفارش.', who:'کاربرانی که موجودی PayPal دارند یا به آن نیاز دارند.', steps:['مبلغ و نوع درخواست را ثبت می‌کنید','شرایط سفارش بررسی و نرخ اعلام می‌شود','پس از تأیید، تسویه انجام می‌شود','رسید ارائه می‌شود'], req:['مبلغ موجودی یا نیاز','تصویر پنل حساب (در صورت نیاز)','راه ارتباطی'] },
  { id:'pp-intl', cat:'accounts', icon:'globe', title:'حساب‌های بین‌المللی', desc:'مشاوره و راهنمایی برای انتخاب و راه‌اندازی حساب‌های بین‌المللی مناسب نیاز شما.', who:'کاربرانی که گزینه‌های مالی بین‌المللی متنوع می‌خواهند.', steps:['نیاز و شرایط شما بررسی می‌شود','گزینه‌های مناسب معرفی می‌شود','فرآیند راه‌اندازی همراهی می‌شوید','حساب آماده استفاده است'], req:['توضیح نیاز و کاربرد','اطلاعات تماس'] },
  { id:'card-visa', cat:'cards', icon:'card', title:'کارت مجازی Visa', desc:'صدور کارت مجازی Visa برای پرداخت‌های آنلاین؛ اطلاعات کارت به‌صورت دیجیتال تحویل داده می‌شود.', who:'خریداران از سایت‌های خارجی که کارت آنلاین امن می‌خواهند.', steps:['نوع کارت و موجودی را انتخاب می‌کنید','شرایط پس از بررسی اعلام می‌شود','هزینه ریالی پرداخت می‌شود','اطلاعات کارت تحویل داده می‌شود'], req:['موجودی موردنیاز','ایمیل برای تحویل','راه ارتباطی'] },
  { id:'card-mc', cat:'cards', icon:'card', title:'کارت مجازی MasterCard', desc:'صدور کارت مجازی MasterCard برای خرید از فروشگاه‌ها و سرویس‌های جهانی.', who:'کاربرانی که MasterCard برای خرید آنلاین نیاز دارند.', steps:['نوع کارت و موجودی را انتخاب می‌کنید','شرایط پس از بررسی اعلام می‌شود','هزینه ریالی پرداخت می‌شود','اطلاعات کارت تحویل داده می‌شود'], req:['موجودی موردنیاز','ایمیل برای تحویل','راه ارتباطی'] },
  { id:'card-phys', cat:'cards', icon:'card', title:'کارت فیزیکی بین‌المللی', desc:'کارت فیزیکی بین‌المللی برای استفاده حضوری، عابربانک‌های خارجی و خرید آنلاین.', who:'مسافران و کاربرانی که کارت فیزیکی لازم دارند.', steps:['نوع کارت را انتخاب می‌کنید','شرایط و زمان صدور اعلام می‌شود','هزینه ریالی پرداخت می‌شود','کارت طبق روش اعلام‌شده تحویل می‌شود'], req:['آدرس یا روش تحویل','مدارک موردنیاز طبق اعلام','هزینه صدور'] },
  { id:'card-travel', cat:'cards', icon:'plane', title:'کارت مناسب سفر', desc:'انتخاب و تهیه کارتی که برای خرید آنلاین و استفاده در سفر مناسب است.', who:'مسافران کشورهای خارجی.', steps:['مقصد سفر و نیاز شما بررسی می‌شود','گزینه مناسب پیشنهاد می‌شود','هزینه ریالی پرداخت می‌شود','کارت تحویل داده می‌شود'], req:['کشور مقصد','مدت سفر','موجودی موردنیاز'] },
  { id:'ai-chatgpt', cat:'ai', icon:'cpu', title:'اشتراک ChatGPT Plus', desc:'خرید و تمدید اشتراک ChatGPT Plus برای دسترسی به قابلیت‌های پیشرفته‌تر.', who:'تولیدکننده محتوا، برنامه‌نویسان، پژوهشگران و همه علاقه‌مندان به ابزارهای AI.', steps:['نوع پلن و مدت را انتخاب می‌کنید','هزینه پس از بررسی اعلام می‌شود','پرداخت ریالی انجام می‌دهید','اشتراک فعال و تحویل می‌شود'], req:['ایمیل حساب (طبق اعلام)','مدت اشتراک','راه ارتباطی'] },
  { id:'ai-gemini', cat:'ai', icon:'spark', title:'اشتراک Gemini', desc:'خرید و تمدید اشتراک Gemini برای استفاده از مدل‌های پیشرفته گوگل.', who:'کاربرانی که از ابزارهای هوش مصنوعی گوگل استفاده می‌کنند.', steps:['نوع پلن و مدت را انتخاب می‌کنید','هزینه پس از بررسی اعلام می‌شود','پرداخت ریالی انجام می‌دهید','اشتراک فعال و تحویل می‌شود'], req:['حساب گوگل (طبق اعلام)','مدت اشتراک','راه ارتباطی'] },
  { id:'ai-cursor', cat:'ai', icon:'cpu', title:'اشتراک Cursor', desc:'خرید و تمدید اشتراک Cursor؛ ویرایشگر کد مبتنی بر هوش مصنوعی برای توسعه‌دهندگان.', who:'توسعه‌دهندگان و تیم‌های برنامه‌نویسی.', steps:['نوع پلن و مدت را انتخاب می‌کنید','هزینه پس از بررسی اعلام می‌شود','پرداخت ریالی انجام می‌دهید','اشتراک فعال و تحویل می‌شود'], req:['ایمیل حساب (طبق اعلام)','مدت اشتراک','راه ارتباطی'] },
  { id:'ai-midjourney', cat:'ai', icon:'spark', title:'اشتراک Midjourney', desc:'خرید و تمدید اشتراک Midjourney برای ساخت تصویر با هوش مصنوعی.', who:'طراحان، گرافیست‌ها و تولیدکنندگان محتوای بصری.', steps:['نوع پلن و مدت را انتخاب می‌کنید','هزینه پس از بررسی اعلام می‌شود','پرداخت ریالی انجام می‌دهید','اشتراک فعال و تحویل می‌شود'], req:['حساب کاربری (طبق اعلام)','مدت اشتراک','راه ارتباطی'] },
  { id:'ai-premium', cat:'ai', icon:'star', title:'سایر اکانت‌های Premium', desc:'Netflix، Spotify، Telegram Premium، TradingView، Freepik و سرویس‌های Premium دیگر؛ خرید و تمدید.', who:'کاربرانی که به سرویس‌های Premium جهانی نیاز دارند.', steps:['سرویس و پلن را اعلام می‌کنید','هزینه پس از بررسی اعلام می‌شود','پرداخت ریالی انجام می‌دهید','اکانت طبق روش اعلام‌شده تحویل می‌شود'], req:['نام سرویس و نوع پلن','مدت اشتراک','راه ارتباطی'] },
  { id:'gift-cards', cat:'giftcards', icon:'gift', title:'خرید گیفت کارت', desc:'گیفت کارت Apple، Steam، PlayStation، Xbox، Amazon، PUBG، Free Fire، Netflix، Google Play و برندهای دیگر.', who:'گیمرها، کاربران اپلیکیشن‌ها و همه کسانی که اعتبار سرویس‌های جهانی می‌خواهند.', steps:['برند و مبلغ گیفت کارت را انتخاب می‌کنید','موجودی و قیمت پس از بررسی اعلام می‌شود','هزینه ریالی پرداخت می‌شود','کد گیفت کارت تحویل داده می‌شود'], req:['نام برند و مبلغ','ایمیل یا راه تحویل','راه ارتباطی'] },
  { id:'shop-link', cat:'shopping', icon:'cart', title:'خرید با ارسال لینک محصول', desc:'از هر سایت یا مارکت‌پلیس بین‌المللی؛ لینک محصول را بفرستید تا بررسی و خرید انجام شود.', who:'خریداران محصول از سایت‌های خارجی که روش پرداخت ندارند.', steps:['لینک محصول را ثبت می‌کنید','هزینه تقریبی پس از بررسی اعلام می‌شود','هزینه ریالی پرداخت می‌کنید','سفارش خریداری و طبق توافق تحویل می‌شود'], req:['لینک دقیق محصول','مشخصات (سایز، رنگ، تعداد)','راه ارتباطی'] },
  { id:'shop-store', cat:'shopping', icon:'box', title:'خرید از فروشگاه‌های UK / UAE / ترکیه / آمریکا', desc:'خرید از فروشگاه‌های کشورهای مختلف و مارکت‌پلیس‌های جهانی با بررسی کامل قبل از پرداخت.', who:'خریداران از برندها و فروشگاه‌های مشخص خارجی.', steps:['فروشگاه و محصولات را اعلام می‌کنید','لیست و هزینه پس از بررسی اعلام می‌شود','پرداخت ریالی انجام می‌دهید','سفارش‌ها خریداری و ارسال می‌شوند'], req:['نام فروشگاه یا کشور','لیست محصولات','راه ارتباطی'] },
  { id:'income-freelance', cat:'income', icon:'coins', title:'نقد کردن درآمد فریلنسری', desc:'دریافت درآمد از پلتفرم‌های خارجی (Upwork، Fiverr و...) و تسویه ریالی پس از بررسی.', who:'فریلنسرها، تولیدکنندگان محتوا و متخصصانی که از پلتفرم‌های خارجی درآمد دارند.', steps:['جزئیات درآمد و پلتفرم را ثبت می‌کنید','شرایط بررسی و نرخ اعلام می‌شود','پس از تأیید، فرآیند تسویه انجام می‌شود','مبلغ ریالی به حساب شما واریز می‌شود'], req:['نام پلتفرم مبدا','مبلغ و نوع درآمد','اطلاعات حساب بانکی'] },
  { id:'income-biz', cat:'income', icon:'chart', title:'تسویه درآمد کسب‌وکارهای آنلاین', desc:'تسویه منظم درآمد فروشگاه‌ها، سرویس‌های اینترنتی و کسب‌وکارهای آنلاین از پلتفرم‌های خارجی.', who:'صاحبان کسب‌وکارهای آنلاین با درآمد ارزی مستمر.', steps:['شرایط کسب‌وکار بررسی می‌شود','فرآیند و نرخ اعلام می‌شود','تسویه‌ها طبق توافق انجام می‌شود','گزارش هر تسویه ارائه می‌شود'], req:['معرفی کسب‌وکار','حجم و دوره تسویه','اطلاعات حساب بانکی'] },
  { id:'exam-reg', cat:'exams', icon:'doc', title:'ثبت‌نام آزمون‌های بین‌المللی', desc:'ثبت‌نام و پرداخت هزینه آزمون‌های IELTS، TOEFL، Duolingo، PTE، PMP، AWS و سایر آزمون‌های جهانی.', who:'متقاضیان مهاجرت، تحصیل و اشتغال بین‌المللی.', steps:['نوع آزمون و مرکز را ثبت می‌کنید','اطلاعات بررسی و تأیید می‌شود','هزینه ریالی پرداخت می‌شود','ثبت‌نام انجام و تأییدیه ارائه می‌شود'], req:['نوع آزمون','کشور و مرکز آزمون','اطلاعات پاسخ‌دهی'] },
  { id:'hw-wallet', cat:'crypto', icon:'box', title:'کیف پول سخت‌افزاری', desc:'معرفی و تأمین کیف پول‌های سخت‌افزاری متناسب با نیاز شما، همراه با راهنمای راه‌اندازی اولیه.', who:'دارندگان دارایی دیجیتال که امنیت نگهداری برایشان اولویت است.', steps:['نیاز و بودجه شما بررسی می‌شود','مدل‌های مناسب معرفی می‌شود','موجودی و قیمت اعلام می‌شود','دستگاه طبق توافق تحویل می‌شود'], req:['حجم تقریبی دارایی','نوع کاربردها','راه ارتباطی'] },
  { id:'hw-edu', cat:'crypto', icon:'shield', title:'آموزش نگهداری امن دارایی', desc:'آموزش اصول نگهداری امن دارایی دیجیتال و کیف پول سخت‌افزاری؛ بدون هیچ توصیه سرمایه‌گذاری.', who:'کاربران جدید حوزه رمزارز و دارندگان کیف پول.', steps:['سطح و نیاز آموزشی شما بررسی می‌شود','محتوای آموزشی مناسب ارائه می‌شود','سؤالات شما پاسخ داده می‌شود','چک‌لیست امنیتی تحویل می‌شود'], req:['موضوع موردنظر','سطح آشنایی','راه ارتباطی'] },
  { id:'biz-corp', cat:'business', icon:'briefcase', title:'خدمات پرداخت شرکت‌ها', desc:'پرداخت هزینه‌های عملیاتی شرکت‌ها شامل SaaS، توزیع‌کنندگان و خدمات بین‌المللی.', who:'شرکت‌ها و تیم‌هایی که پرداخت‌های ارزی منظم دارند.', steps:['نیازهای شرکت بررسی می‌شود','فرآیند و شرایط اعلام می‌شود','قرارداد و توافق انجام می‌شود','پرداخت‌ها طبق برنامه انجام می‌شود'], req:['معرفی شرکت','نوع و حجم پرداخت‌ها','راه ارتباطی'] },
  { id:'biz-student', cat:'business', icon:'cap', title:'پکیج خدمات دانشجویان و مهاجرت', desc:'مجموعه پرداخت‌های تحصیلی، آزمون و ویزا در یک مسیر یکپارچه برای متقاضیان مهاجرت.', who:'دانشجویان و متقاضیان مهاجرت با نیازهای پرداخت متعدد.', steps:['نیازهای شما به‌صورت لیست ثبت می‌شود','برنامه پرداخت پیشنهاد می‌شود','هر مورد طبق فرآیند انجام می‌شود','گزارش پیشرفت ارائه می‌شود'], req:['لیست نیازها','زمان‌بندی موردنظر','راه ارتباطی'] }
];
const getService = id => SERVICES.find(s => s.id === id);
const FEATURED = ['pay-web','pp-person','gift-cards','card-visa','ai-chatgpt','shop-link','income-freelance','exam-reg'];

/* ── render: quick services ── */
const renderQuick = () => {
  const grid = $('#quickGrid'); if (!grid) return;
  grid.innerHTML = FEATURED.map(id => {
    const s = getService(id); if (!s) return '';
    return `<button class="qs" role="listitem" data-service="${s.id}" aria-label="${s.title}">
      <span class="card-ic"><svg class="ic" viewBox="0 0 24 24"><use href="#i-${s.icon}"/></svg></span>
      <h3>${s.title}</h3><p>${s.desc.split('؛')[0].split('.')[0]}.</p>
      <span class="go"><svg class="ic" viewBox="0 0 24 24"><use href="#i-arrow"/></svg></span>
    </button>`;
  }).join('');
};

/* ── render: explorer tabs + panels ── */
let activeCat = CATS[0].id;
const renderExplorer = () => {
  const tabs = $('#explorerTabs'), panels = $('#explorerPanels');
  if (!tabs || !panels) return;
  tabs.innerHTML = CATS.map((c, i) =>
    `<button class="tab" role="tab" id="tab-${c.id}" aria-selected="${i === 0}" aria-controls="panel-${c.id}" data-cat="${c.id}">${c.label}</button>`
  ).join('');
  panels.innerHTML = CATS.map(c => {
    const items = SERVICES.filter(s => s.cat === c.id);
    return `<div class="panel${c.id === activeCat ? ' active' : ''}" role="tabpanel" id="panel-${c.id}" aria-labelledby="tab-${c.id}" data-cat="${c.id}">
      ${items.map(s => `<article class="card" data-service="${s.id}" role="button" tabindex="0" aria-label="${s.title}">
        <span class="card-ic"><svg class="ic" viewBox="0 0 24 24"><use href="#i-${s.icon}"/></svg></span>
        <h3>${s.title}</h3><p>${s.desc}</p><span class="chip">جزئیات خدمت</span>
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
    const i = list.findIndex(t => t.getAttribute('aria-selected') === 'true');
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
  const oldIdx = CATS.findIndex(c => c.id === activeCat);
  const newIdx = CATS.findIndex(c => c.id === id);
  panels.classList.toggle('rev', newIdx < oldIdx);
  const oldP = $('.panel.active', panels);
  const newP = $(`.panel[data-cat="${id}"]`, panels);
  if (oldP) oldP.classList.remove('active');
  if (newP) newP.classList.add('active');
  $$('.tab', tabs).forEach(t => t.setAttribute('aria-selected', String(t.dataset.cat === id)));
  activeCat = id;
  setPanelHeight();
};

/* ── render: contact select ── */
const renderSelect = () => {
  const sel = $('#contactForm select[name="service"]'); if (!sel) return;
  sel.innerHTML = '<option value="" selected disabled>انتخاب کنید…</option>' +
    CATS.map(c => `<optgroup label="${c.label}">` +
      SERVICES.filter(s => s.cat === c.id).map(s => `<option value="${s.id}">${s.title}</option>`).join('') +
    '</optgroup>').join('');
};

/* ── loader ── */
const runLoader = () => new Promise(res => {
  const loader = $('#loader'); if (!loader) return res();
  if (reduced) { loader.classList.add('hide'); return res(); }
  document.body.style.overflow = 'hidden';
  const fill = $('#loadFill'), num = $('#loadNum');
  const DUR = sessionStorage.getItem('ss-loaded') ? 450 : 1400;
  const t0 = performance.now();
  const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
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

/* ── hero words ── */
const splitWords = () => {
  const h = $('#heroTitle'); if (!h) return;
  const nodes = Array.from(h.childNodes); h.innerHTML = '';
  let i = 0;
  nodes.forEach(n => {
    if (n.nodeType === 3) {
      n.textContent.split(/\s+/).filter(Boolean).forEach(w => {
        const w1 = document.createElement('span'); w1.className = 'h-word';
        const w2 = document.createElement('span');
        w2.textContent = w;
        w2.style.transitionDelay = (i++ * 90) + 'ms';
        w1.appendChild(w2); h.appendChild(w1); h.appendChild(document.createTextNode(' '));
      });
    } else if (n.nodeName === 'BR') h.appendChild(n);
  });
};

/* ── smooth scroll (Lenis optional) ── */
let lenis = null;
const initScroll = () => {
  if (!reduced && typeof Lenis !== 'undefined') {
    try { lenis = new Lenis({ duration: 1.15, smoothWheel: true }); } catch (e) { lenis = null; }
  }
  const raf = t => { if (lenis) lenis.raf(t); requestAnimationFrame(raf); };
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
  const rail = $('#progressBar'), top = $('#progressTop');
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
  const HOV = 'a,button,input,textarea,select,[role="button"],[data-service],.faq-q,.tab';
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
const initReveals = () => {
  const els = $$('[data-reveal]');
  if (reduced) { els.forEach(el => el.classList.add('in')); return; }
  const io = new IntersectionObserver(ents => {
    ents.forEach(en => {
      if (!en.isIntersecting) return;
      const d = en.target.dataset.revealDelay;
      if (d) en.target.style.setProperty('--rd', d + 'ms');
      en.target.classList.add('in');
      io.unobserve(en.target);
    });
  }, { threshold: .16, rootMargin: '0px 0px -6% 0px' });
  els.forEach(el => io.observe(el));
};

/* ── tilt cards ── */
const initTilt = () => {
  if (touch || reduced) return;
  $$('[data-tilt]').forEach(el => {
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
  /* drag */
  let down = false, sx = 0, ss = 0, moved = 0;
  track.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse') { down = true; sx = e.clientX; ss = track.scrollLeft; moved = 0; track.classList.add('dragging'); track.setPointerCapture(e.pointerId); }
  });
  track.addEventListener('pointermove', e => {
    if (!down) return;
    const dx = e.clientX - sx; moved = Math.max(moved, Math.abs(dx));
    track.scrollLeft = ss - dx;
  });
  const up = () => { down = false; track.classList.remove('dragging'); };
  track.addEventListener('pointerup', up);
  track.addEventListener('pointercancel', up);
  track.addEventListener('click', e => { if (moved > 8) { e.preventDefault(); e.stopPropagation(); } }, true);
  /* keyboard */
  track.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); go(-1); }
  });
  /* auto */
  if (autoMs && !reduced) {
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
    <button class="modal-close" data-close-modal aria-label="بستن"><svg class="ic" viewBox="0 0 24 24"><use href="#i-close"/></svg></button>
    <div class="sm-head">
      <span class="card-ic"><svg class="ic" viewBox="0 0 24 24"><use href="#i-${s.icon}"/></svg></span>
      <div><span class="sm-cat">${catLabel(s.cat)}</span><h3 id="smTitle" style="margin:2px 0 0">${s.title}</h3></div>
    </div>
    <p class="sm-desc">${s.desc}</p>
    <div class="sm-meta">
      <span class="chip"><svg class="ic" style="width:13px;height:13px" viewBox="0 0 24 24"><use href="#i-clock"/></svg> زمان: پس از بررسی سفارش</span>
      <span class="chip"><svg class="ic" style="width:13px;height:13px" viewBox="0 0 24 24"><use href="#i-coins"/></svg> هزینه: استعلام قیمت</span>
    </div>
    <div class="sm-block"><h4>چه کسانی به این خدمت نیاز دارند؟</h4><p class="sm-desc" style="margin:0">${s.who}</p></div>
    <div class="sm-block"><h4>مراحل انجام</h4><ol>${s.steps.map(x => `<li>${x}</li>`).join('')}</ol></div>
    <div class="sm-block"><h4>مدارک / اطلاعات موردنیاز</h4><ul>${s.req.map(x => `<li>${x}</li>`).join('')}</ul></div>
    <div class="sm-cta">
      <button class="btn btn-primary btn-lg" data-open-contact data-prefill="${s.id}">ثبت سفارش این خدمت<svg class="ic arr" viewBox="0 0 24 24"><use href="#i-arrow"/></svg></button>
    </div>`;
  openModal($('#serviceModal'));
};

/* ── contact modal ── */
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
    if (msg && s && !msg.value) msg.value = `درخواست خدمت: ${s.title}`;
  }
  setTimeout(() => openModal(m), open ? 200 : 0);
};

/* ── search ── */
const openSearch = () => {
  const m = $('#searchOverlay'), inp = $('#searchInput');
  if (!m) return;
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
  const arts = [
    { t: 'راهنمای افتتاح حساب PayPal', c: 'PayPal' },
    { t: 'کارت مجازی یا فیزیکی؟', c: 'کارت‌ها' },
    { t: 'پرداخت هزینه IELTS', c: 'آزمون‌ها' },
    { t: 'کیف پول سخت‌افزاری چیست؟', c: 'رمزارز' },
    { t: 'نقد کردن درآمد فریلنسری', c: 'درآمد ارزی' },
    { t: 'خرید از آمازون از ایران', c: 'خرید خارجی' }
  ];
  let svc = SERVICES, list = arts;
  if (nq) {
    svc = SERVICES.filter(s => normTxt(s.title + ' ' + s.desc + ' ' + catLabel(s.cat)).includes(nq));
    list = arts.filter(a => normTxt(a.t + ' ' + a.c).includes(nq));
  }
  if (!svc.length && !list.length) {
    box.innerHTML = '<div class="no-res">نتیجه‌ای یافت نشد؛ عبارت دیگری را امتحان کنید.</div>';
    return;
  }
  box.innerHTML =
    svc.slice(0, 14).map((s, i) => `<button class="sr-item" role="option" data-service="${s.id}" style="animation-delay:${i * 30}ms">
      <span class="card-ic"><svg class="ic" viewBox="0 0 24 24"><use href="#i-${s.icon}"/></svg></span>
      <span><b>${s.title}</b><small>${catLabel(s.cat)}</small></span>
      <svg class="ic" viewBox="0 0 24 24"><use href="#i-arrow"/></svg></button>`).join('') +
    list.map(a => `<button class="sr-item" role="option" data-soon="این مقاله به‌زودی منتشر می‌شود">
      <span class="card-ic"><svg class="ic" viewBox="0 0 24 24"><use href="#i-doc"/></svg></span>
      <span><b>${a.t}</b><small>مجله — ${a.c}</small></span>
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

/* ── contact form ── */
const faToEn = s => String(s || '').replace(/[\u06F0-\u06F9]/g, d => String(d.charCodeAt(0) - 0x06F0)).replace(/[\u0660-\u0669]/g, d => String(d.charCodeAt(0) - 0x0660)).replace(/\u200c/g, '');
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
    if (!ok) { toast('لطفاً موارد مشخص‌شده را اصلاح کنید.'); return; }
    const sName = getService(service.value) ? getService(service.value).title : service.value;
    const summary = `سفارش جدید — استار شاپ\nنام: ${name.value.trim()}\nتلفن: ${ph}\nایمیل: ${email.value.trim() || '—'}\nخدمت: ${sName}\nتوضیحات: ${msg.value.trim() || '—'}`;
    const mail = $('#doneMail');
    if (mail) mail.href = 'mailto:support@starshop.example?subject=' + encodeURIComponent('سفارش جدید — ' + sName) + '&body=' + encodeURIComponent(summary);
    const copy = $('#doneCopy');
    if (copy) copy.onclick = async () => {
      try { await navigator.clipboard.writeText(summary); toast('اطلاعات سفارش کپی شد.'); }
      catch (err) { toast('کپی خودکار ممکن نشد؛ متن را دستی کپی کنید.'); }
    };
    form.hidden = true;
    $('#formDone').hidden = false;
  });
  ['input', 'change'].forEach(ev => form.addEventListener(ev, e => {
    const f = e.target.closest('.field'); if (f) f.classList.remove('invalid');
  }));
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
    if (!valid) { url.closest('.field').classList.add('invalid'); toast('لینک محصول معتبر وارد کنید (با https://).'); return; }
    openContact('shop-link');
    const msg = $('#contactForm textarea[name="message"]');
    if (msg) msg.value = 'لینک محصول: ' + u + (note.value.trim() ? '\nتوضیحات: ' + note.value.trim() : '');
    form.reset();
  });
};

/* ── count-up stats ── */
const initStats = () => {
  const els = $$('.stat-num'); if (!els.length) return;
  const io = new IntersectionObserver(ents => {
    ents.forEach(en => {
      if (!en.isIntersecting) return;
      io.unobserve(en.target);
      const el = en.target, target = +el.dataset.count, suf = el.dataset.suffix || '';
      if (reduced) { el.textContent = faDig(target) + suf; return; }
      const t0 = performance.now(), DUR = 1500;
      const tick = now => {
        const p = clamp((now - t0) / DUR, 0, 1);
        const v = Math.round(target * (1 - Math.pow(1 - p, 3)));
        el.textContent = faDig(v) + suf;
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }, { threshold: .5 });
  els.forEach(el => io.observe(el));
};

/* ── i18n (structural) ── */
const I18N = {
  fa: { lang: 'فارسی', login: 'ورود / ثبت‌نام', cta: 'شروع سفارش', 'view-services': 'مشاهده خدمات' },
  en: { lang: 'English', login: 'Login / Sign up', cta: 'Start an order', 'view-services': 'Explore services' },
  ar: { lang: 'العربية', login: 'تسجيل الدخول', cta: 'ابدأ الطلب', 'view-services': 'استكشف الخدمات' }
};
const initLang = () => {
  const btn = $('#langBtn'), menu = $('#langMenu');
  if (!btn || !menu) return;
  btn.addEventListener('click', e => {
    e.stopPropagation();
    const open = menu.hidden;
    menu.hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
  });
  document.addEventListener('click', e => { if (!menu.hidden && !e.target.closest('#langWrap')) { menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); } });
  $$('button[data-lang]', menu).forEach(b => b.addEventListener('click', () => {
    const lang = b.dataset.lang;
    if (lang !== 'fa') { toast('نسخه ' + b.textContent.trim().replace('به‌زودی', '') + ' به‌زودی افزوده می‌شود.'); menu.hidden = true; return; }
    const dict = I18N.fa;
    $$('[data-i18n]').forEach(el => { const k = el.dataset.i18n; if (dict[k]) el.textContent = dict[k]; });
    $$('#langMenu button').forEach(x => x.classList.toggle('active', x.dataset.lang === 'fa'));
    menu.hidden = true;
  }));
};

/* ── global delegation ── */
const initDelegation = () => {
  document.addEventListener('click', e => {
    const soon = e.target.closest('[data-soon]');
    if (soon) { const t = $('#soonText'); if (t) t.textContent = soon.dataset.soon || 'به‌زودی'; openModal($('#soonModal')); return; }
    const svc = e.target.closest('[data-service]');
    if (svc) { openService(svc.dataset.service); return; }
    if (e.target.closest('[data-open-contact]')) {
      const pre = e.target.closest('[data-prefill]');
      openContact(pre ? pre.dataset.prefill : null);
      return;
    }
    if (e.target.closest('[data-open-search]')) { openSearch(); return; }
    const cm = e.target.closest('[data-close-modal]');
    if (cm) { closeModal(cm.closest('.modal')); return; }
    if (e.target.closest('#loginBtn')) {
      const t = $('#soonText');
      if (t) t.textContent = 'پنل کاربری به‌زودی راه‌اندازی می‌شود؛ در حال حاضر سفارش‌ها از طریق «شروع سفارش» ثبت می‌شوند.';
      openModal($('#soonModal'));
    }
  });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const el = document.activeElement;
    if (el && el.matches('[data-service][role="button"]')) { e.preventDefault(); openService(el.dataset.service); }
  });
};

/* ── boot ── */
const boot = async () => {
  renderQuick(); renderExplorer(); renderSelect();
  splitWords();
  initScroll(); initAnchors(); initTheme(); initProgress();
  initCursor(); initMagnetic(); initTilt();
  initMenu(); initSearch(); initContactForm(); initCalcForm();
  initStats(); initLang(); initDelegation(); initProcess(); initHow();
  initCarousel($('#giftTrack'), $('#giftPrev'), $('#giftNext'), 4200);
  initCarousel($('#testTrack'), $('#testPrev'), $('#testNext'), 5200);
  const y = $('#year'); if (y) y.textContent = new Date().getFullYear().toLocaleString('fa-IR', { useGrouping: false });
  await runLoader();
  $('.hero').classList.add('play');
  initReveals();
  setPanelHeight();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(setPanelHeight);
  addEventListener('resize', () => { setPanelHeight(); });
  const faq = $$('.faq-item');
  faq.forEach(item => {
    const q = $('.faq-q', item);
    q.addEventListener('click', () => {
      const open = item.classList.contains('open');
      faq.forEach(i => { i.classList.remove('open'); $('.faq-q', i).setAttribute('aria-expanded', 'false'); });
      if (!open) { item.classList.add('open'); q.setAttribute('aria-expanded', 'true'); }
    });
  });
};
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
})();
