/* ═══════════════════════════════════════════════════
   STARSHOP — support.js
   دستیار هوش مصنوعی استارشاپ (ویجت پشتیبانی شناور)
   ─────────────────────────────────────────────────
   · موتور پاسخ‌گو کاملاً محلی (بدون سرور، بدون API خارجی):
     پایگاه دانش سه‌زبانه (FA/EN/AR) از موضوعات سایت +
     تشخیص نام ۶۱ سرویس هوش مصنوعی در سوال و پاسخ «قیمت دقیق»
     از روی کاتالوگ (SS_AI_TOOLS) با فرمول رسمی استارشاپ.
   · فقط سوالات مربوط به استارشاپ پاسخ داده می‌شود؛ سوالات
     خارج از حوزه با پیام مودبانه رد می‌شوند (رویکرد سفید‌لیست).
   · انتخاب زبان پاسخ هوشمند: بر اساس زبان سایت + زبان سوال
     (حروف فارسی/عربی/لاتین تشخیص داده می‌شود).
   · هیچ داده‌ای جایی ذخیره نمی‌شود — گفتگو فقط در حافظه است.
   ═══════════════════════════════════════════════════ */
(() => {
'use strict';

/* ── ابزارها ── */
const T = k => { try { return window.SSI18N.t(k); } catch (e) { return k; } };
const siteLang = () => window.SS_LANG || 'fa';
const escapeHtml = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const FA = '۰۱۲۳۴۵۶۷۸۹', AR = '٠١٢٣٤٥٦٧٨٩';
const faDig = s => String(s).replace(/\d/g, d => FA[d]);
const arDig = s => String(s).replace(/\d/g, d => AR[d]);
const grp = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '٬');
const money = (n, lang) => { const g = grp(n); return lang === 'fa' ? faDig(g) : lang === 'ar' ? arDig(g) : g; };

/* ── نرمال‌سازی متن (فارسی/عربی/لاتین) ── */
const norm = s => String(s || '')
  .toLowerCase()
  .replace(/[\u064A\u0649]/g, '\u06CC')
  .replace(/\u0643/g, '\u06A9')
  .replace(/[\u0622\u0623\u0625]/g, '\u0627')
  .replace(/\u0629/g, '\u0647')
  .replace(/[\u064B-\u0652\u0670\u0640]/g, '')
  .replace(/[\u06F0-\u06F9]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
  .replace(/[\u0660-\u0669]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
  .replace(/[\u200c-\u200f\u202a-\u202e]/g, ' ')
  .replace(/[^\p{L}\p{N}]+/gu, ' ')
  .replace(/\s+/g, ' ')
  .trim();

/* ── تشخیص زبان سوال (فارسی/عربی/انگلیسی) ── */
const pickLang = q => {
  const site = siteLang();
  if (/[پچژگ]/.test(q)) return 'fa';
  if (/[\u064A\u0643]/.test(q)) return 'ar';          /* ي/ك عربی */
  const letters = (q.match(/[a-z]/gi) || []).length;
  const total = q.replace(/\s/g, '').length;
  if (total && letters / total > 0.5) return 'en';
  return site;
};

/* ── نرخ زنده دلار (تومان) — فقط برای نمایش، شکست ندارد ── */
const liveUsdToman = () => {
  try {
    const r = window.SSRates && window.SSRates.get && window.SSRates.get();
    if (r && r.usdIrr && r.usdIrr > 200000) return Math.round(r.usdIrr / 10);
  } catch (e) {}
  return 0;
};

/* ═══════════ پایگاه دانش — سه زبانه ═══════════
   keys: نرمال‌شده؛ اولویت = ترتیب تعریف در آرایه */
const KB = [
  {
    id: 'hello',
    keys: ['سلام', 'درود', 'سلام علیکم', 'صبح بخیر', 'عصر بخیر', 'شب بخیر', 'hello', 'hi', 'hey', 'good morning', 'مرحبا', 'اهلا', 'السلام علیکم'],
    a: {
      fa: 'سلام! 👋 خوش اومدی به <b>استارشاپ</b>. هر سوالی درباره خدمات، قیمت‌ها یا نحوه خرید داری بپرس — فوری جواب می‌دم!',
      en: 'Hello! 👋 Welcome to <b>Star Shop</b>. Ask me anything about our services, prices or how to order!',
      ar: 'مرحباً! 👋 أهلاً بك في <b>ستار شوب</b>. اسألني أي شيء عن الخدمات أو الأسعار أو طريقة الطلب!'
    }
  },
  {
    id: 'thanks',
    keys: ['ممنون', 'مرسی', 'تشکر', 'متشکر', 'دستت درد نکنه', 'لطف کردی', 'thanks', 'thank you', 'شکرا', 'ممنون از شما'],
    a: {
      fa: 'خواهش می‌کنم! 🌟 اگه سوال دیگه‌ای داری در خدمتم. خرید خوشی داشته باشی!',
      en: "You're welcome! 🌟 If you have any other question, I'm here. Happy shopping!",
      ar: 'العفو! 🌟 إذا كان لديك أي سؤال آخر فأنا في الخدمة. تسوق سعيد!'
    }
  },
  {
    id: 'bye',
    keys: ['خداحافظ', 'بای', 'فعلا', 'بدرود', 'bye', 'goodbye', 'مع السلامه', 'فی امان الله'],
    a: {
      fa: 'خداحافظ! 👋 هر وقت سوالی داشتی، من همین‌جام. امیدوارم دوباره ببینمت! 🌟',
      en: 'Goodbye! 👋 I\'m here whenever you need me. Hope to see you again! 🌟',
      ar: 'وداعاً! 👋 أنا هنا كلما احتجتني. أتمنى أن أراك مرة أخرى! 🌟'
    }
  },
  {
    id: 'human',
    keys: ['پشتیبان', 'اپراتور', 'ادمین', 'مدیر', 'انسان', 'پشتیبانی', 'شماره تماس', 'تماس با شما', 'راه ارتباطی', 'با شما تماس', 'تلفن', 'support', 'contact', 'کارشناس', 'دستیار واقعی', 'موظف'],
    a: {
      fa: 'اگه جواب سوالت رو پیدا نکردی، مستقیم با پشتیبانی در تماس باش:<br>📱 تلگرام: <a href="https://t.me/Sam7NeC" target="_blank" rel="noopener">@Sam7NeC</a><br>🟣 بله: <a href="https://ble.ir/samyar_ahmadvand" target="_blank" rel="noopener">samyar_ahmadvand</a><br>☎️ تلفن: <a href="tel:+989216765883" dir="ltr">0921 676 5883</a><br>✉️ ایمیل: pingpixel92@gmail.com<br>در سریع‌ترین زمان پاسخ می‌دیم!',
      en: 'For direct human support:<br>📱 Telegram: <a href="https://t.me/Sam7NeC" target="_blank" rel="noopener">@Sam7NeC</a><br>🟣 Bale: <a href="https://ble.ir/samyar_ahmadvand" target="_blank" rel="noopener">samyar_ahmadvand</a><br>☎️ Phone: <a href="tel:+989216765883" dir="ltr">0921 676 5883</a><br>✉️ Email: pingpixel92@gmail.com',
      ar: 'للدعم المباشر:<br>📱 تيليجرام: <a href="https://t.me/Sam7NeC" target="_blank" rel="noopener">@Sam7NeC</a><br>🟣 بله: <a href="https://ble.ir/samyar_ahmadvand" target="_blank" rel="noopener">samyar_ahmadvand</a><br>☎️ الهاتف: <a href="tel:+989216765883" dir="ltr">0921 676 5883</a><br>✉️ البريد: pingpixel92@gmail.com'
    }
  },
  {
    id: 'hours',
    keys: ['ساعت کاری', 'ساعات کاری', 'چه روزهایی', 'تعطیل', '۲۴ ساعته', '24 ساعته', 'همیشه انلاین', 'working hours', 'ساعات', 'ساعات الدوام'],
    a: {
      fa: 'دستیار هوشمند (من! 🤖) ۲۴ ساعته و ۷ روز هفته اینجام و همیشه جواب می‌دم. پشتیبانی انسانی هم پیام‌هات رو در سریع‌ترین زمان پاسخ می‌ده — معمولاً کمتر از چند ساعت.',
      en: 'The AI assistant (me! 🤖) is online 24/7. Our human support team also replies as fast as possible — usually within a few hours.',
      ar: 'المساعد الذكي (أنا! 🤖) متاح على مدار الساعة طوال أيام الأسبوع، ويرد فريق الدعم البشري في أسرع وقت — عادة خلال ساعات قليلة.'
    }
  },
  {
    id: 'what',
    keys: ['استارشاپ چیه', 'استار شاپ چیه', 'استارشاپ چیست', 'درباره استارشاپ', 'درباره سایت', 'شما کی هستید', 'سایت شما چیکار', 'سایتتون چیکار', 'what is starshop', 'about starshop', 'about us', 'معرفی', 'ما چی هستیم'],
    a: {
      fa: '<b>استارشاپ</b> پلتفرم خدمات پرداخت بین‌المللی و خدمات دیجیتاله 🌟 هر پرداخت ارزی که لازم داری (سایت‌های خارجی، اشتراک‌ها، دانشگاه، آزمون، سفارت) رو با پرداخت ریالی انجام می‌دیم؛ به‌علاوه گیفت کارت، کارت‌های بین‌المللی، اکانت‌های جهانی، ۶۱ سرویس هوش مصنوعی و خیلی چیزهای دیگه. راه ساده‌تر برای دسترسی به دنیای جهانی!',
      en: '<b>Star Shop</b> is an international payment & digital services platform 🌟 We handle any foreign payment (websites, subscriptions, university, exams, embassies) with rial payment — plus gift cards, international cards, global accounts, 61 AI services and more.',
      ar: '<b>ستار شوب</b> منصة خدمات الدفع الدولي والخدمات الرقمية 🌟 نقوم بأي دفع بالعملات الأجنبية (مواقع، اشتراكات، جامعة، اختبارات) بالدفع الريالي، بالإضافة إلى بطاقات الهدايا والبطاقات الدولية والحسابات العالمية و٦١ خدمة ذكاء اصطناعي.'
    }
  },
  {
    id: 'services',
    keys: ['چه خدماتی', 'خدماتتون', 'خدمات شما', 'سرویس ها', 'چه سرویسی', 'لیست خدمات', 'چی دارید', 'چی دارین', 'چه کارایی', 'services', 'what do you offer', 'چه چیزهایی', 'ما چه چیزی'],
    a: {
      fa: 'استارشاپ این خدمات رو ارائه می‌ده:<br>💳 گیفت کارت‌های جهانی (گوگل‌پلی، آیتونز، ویزا، مسترکارت، استیم، پلی‌استیشن، Xbox، نتفلیکس، اسپاتیفای و…)<br>🤖 اشتراک ۶۱ سرویس هوش مصنوعی (ChatGPT، Claude، Gemini، Grok، Midjourney و…)<br>🌐 پرداخت ارزی به هر سایت و سرویس جهانی<br>💳 کارت مجازی و فیزیکی Visa/MasterCard<br>👤 اکانت‌های خارجی و PayPal<br>🛒 خرید از سایت‌های خارجی (آمازون و…)<br>🎓 پرداخت آزمون‌های بین‌المللی (IELTS، TOEFL و…)<br>💰 تسویه درآمد ارزی<br>کدوم رو می‌خوای بیشتر بدونی؟',
      en: 'Star Shop services:<br>💳 Global gift cards (Google Play, iTunes, Visa, Steam, PlayStation, Xbox, Netflix, Spotify and more)<br>🤖 61 AI service subscriptions (ChatGPT, Claude, Gemini, Grok, Midjourney…)<br>🌐 International payments to any website<br>💳 Virtual & physical Visa/MasterCard<br>👤 Foreign accounts & PayPal<br>🛒 Buying from foreign stores (Amazon…)<br>🎓 International exam payments (IELTS, TOEFL…)<br>💰 Freelance income settlement',
      ar: 'خدمات ستار شوب:<br>💳 بطاقات هدايا عالمية (Google Play، iTunes، Visa، Steam، PlayStation و…)<br>🤖 اشتراك ٦١ خدمة ذكاء اصطناعي<br>🌐 الدفع الدولي لأي موقع<br>💳 بطاقات Visa/MasterCard افتراضية وفيزيائية<br>👤 حسابات أجنبية و PayPal<br>🛒 الشراء من المتاجر الأجنبية<br>🎓 دفع رسوم الاختبارات الدولية<br>💰 تسوية الدخل بالعملات'
    }
  },
  {
    id: 'howbuy',
    keys: ['چطور خرید', 'چجوری خرید', 'نحوه خرید', 'طریقه خرید', 'روش خرید', 'خرید کنم', 'سفارش ثبت', 'ثبت سفارش', 'سفارش بدم', 'how to buy', 'how to order', 'order process', 'مراحل خرید', 'از کجا شروع', 'کیفیت خرید', 'how do i order', 'how do i buy', 'how can i order', 'how can i buy', 'i want to order', 'i want to buy', 'place an order', 'make an order', 'buy something', 'purchase', 'بخرم', 'خریدارم', 'می خوام خرید', 'می خوام سفارش', 'میخوام خرید', 'میخوام سفارش', 'کیف اطلب', 'کیف اشتری', 'ارید الشراء'],
    a: {
      fa: 'خرید خیلی ساده‌ست:<br>1️⃣ سرویس یا گیفت کارت موردنظرت رو انتخاب کن و «افزودن به سبد» رو بزن<br>2️⃣ سبد خرید رو باز کن و «پرداخت از طریق تلگرام» یا «بله» رو بزن — اطلاعات سفارشت خودکار آماده می‌شه<br>3️⃣ پیام رو برای ما بفرست تا کارشناس‌ها قیمت نهایی و مراحل بعدی رو اعلام کنن<br>برای خدمات خاص (پرداخت ارزی، خرید خارجی و…) هم می‌تونی از دکمه «شروع سفارش» فرم رو پر کنی.',
      en: 'Ordering is simple:<br>1️⃣ Pick a service or gift card and tap "Add to cart"<br>2️⃣ Open the cart and choose "Pay via Telegram" or "Bale" — your order details are auto-prepared<br>3️⃣ Send us the message and our team will confirm the final price and next steps.<br>For custom services, use the "Start Order" form.',
      ar: 'الطلب بسيط:<br>1️⃣ اختر الخدمة أو بطاقة الهدية واضغط "أضف إلى السلة"<br>2️⃣ افتح السلة واختر الدفع عبر تيليجرام أو بله — تُجهَّز تفاصيل طلبك تلقائياً<br>3️⃣ أرسل الرسالة لنا وسيؤكد الفريق السعر النهائي والخطوات التالية.'
    }
  },
  {
    id: 'cart',
    keys: ['سبد خرید', 'به سبد', 'افزودن به سبد', 'سبدت', 'cart'],
    a: {
      fa: 'برای استفاده از سبد خرید: روی هر سرویس یا گیفت کارت، دکمه «افزودن به سبد» رو بزن. آیکون سبد بالای صفحه تعداد اقلام رو نشون می‌ده؛ توی سبد می‌تونی تعداد رو کم و زیاد کنی و بعد «پرداخت از طریق تلگرام» یا «بله» رو بزنی — سفارشت خودکار برای ما ارسال می‌شه! 🛒',
      en: 'To use the cart: tap "Add to cart" on any service or gift card. The cart icon at the top shows item count; you can adjust quantities and then checkout via Telegram or Bale — your order is sent to us automatically! 🛒',
      ar: 'لاستخدام السلة: اضغط "أضف إلى السلة" على أي خدمة. يعرض أيقونة السلة عدد العناصر، ويمكنك تعديل الكميات ثم الدفع عبر تيليجرام أو بله — يُرسل طلبك إلينا تلقائياً! 🛒'
    }
  },
  {
    id: 'price',
    keys: ['نرخ', 'قیمت', 'چقدر', 'چنده', 'چند تومان', 'هزینه', 'نرخ دلار', 'دلار چند', 'usd', 'dollar', 'price', 'rate', 'cost', 'how much', 'اسعار', 'سعر', 'كم'],
    a: q => {
      const lang = pickLang(q);
      const live = liveUsdToman();
      const liveFa = live ? `💵 <b>نرخ لحظه‌ای دلار الان: ${money(live, 'fa')} تومان</b> هست (برای گیفت کارت‌ها و سایر خدمات، همین نرخ مبنای محاسبه‌ست).<br><br>` : '';
      const liveEn = live ? `💵 <b>Live USD rate right now: ${money(live, 'en')} Toman</b> (used for gift cards and other services).<br><br>` : '';
      const liveAr = live ? `💵 <b>سعر الدولار اللحظي الآن: ${money(live, 'ar')} تومان</b> (يستخدم لبطاقات الهدايا والخدمات الأخرى).<br><br>` : '';
      return {
        fa: liveFa + 'قیمت‌ها به نوع خدمت بستگی داره:<br>🤖 <b>اشتراک‌های هوش مصنوعی:</b> نرخ ثابت استارشاپ (هر ۱ دلار = ۲۳۳٬۴۰۰ تومان) + ۵۰۰٬۰۰۰ تومان حق خدمات — مثلاً ChatGPT Go ماهانه ۳٬۵۳۴٬۲۰۰ تومان. اسم سرویس رو بگو تا قیمت دقیقش رو بگم!<br>💳 <b>گیفت کارت‌ها:</b> با نرخ لحظه‌ای دلار محاسبه می‌شن — روی کارت موردنظر توی سایت بزن تا قیمت دقیق رو ببینی.<br>🌐 <b>سایر خدمات:</b> پس از بررسی سفارش، قیمت نهایی بهت اعلام می‌شه.',
        en: liveEn + 'Prices depend on the service:<br>🤖 <b>AI subscriptions:</b> fixed Star Shop rate ($1 = 233,400 Toman) + 500,000 Toman service fee — e.g. ChatGPT Go monthly = 3,534,200 Toman. Tell me the service name for an exact quote!<br>💳 <b>Gift cards:</b> calculated with the live USD rate — tap any card on the site to see its exact price.<br>🌐 <b>Other services:</b> final price is announced after order review.',
        ar: liveAr + 'تعتمد الأسعار على نوع الخدمة:<br>🤖 <b>اشتراكات الذكاء الاصطناعي:</b> سعر ستار شوب الثابت (1$ = 233,400 تومان) + 500,000 تومان رسوم خدمة.<br>💳 <b>بطاقات الهدايا:</b> تُحسب بسعر الدولار اللحظي — اضغط على البطاقة في الموقع لرؤية السعر.<br>🌐 <b>خدمات أخرى:</b> يُعلن السعر النهائي بعد مراجعة الطلب.'
      }[lang];
    }
  },
  {
    id: 'ai',
    keys: ['هوش مصنوعی', 'ai tools', 'سرویس های هوش مصنوعی', 'اشتراک هوش مصنوعی', 'الذكاء الاصطناعي', 'ذكاء اصطناعي', 'چت بات', 'قیمت هوش مصنوعی'],
    a: {
      fa: 'ما <b>۶۱ سرویس هوش مصنوعی</b> رو ارائه می‌دیم! 🤖 از ChatGPT، Claude، Gemini و Grok گرفته تا Midjourney، Suno، Runway، ElevenLabs، Cursor و ده‌ها سرویس دیگه — در سه دسته: متنی، صوتی/تصویری و برنامه‌نویسی.<br>قیمت هر اشتراک = نرخ استارشاپ (۱$ = ۲۳۳٬۴۰۰ تومان) + ۵۰۰٬۰۰۰ تومان حق خدمات.<br>اسم سرویسی که می‌خوای رو بگو تا قیمت دقیقش رو بگم! 😉',
      en: 'We offer <b>61 AI services</b>! 🤖 From ChatGPT, Claude, Gemini and Grok to Midjourney, Suno, Runway, ElevenLabs, Cursor and dozens more — in three categories: text, audio/video and coding.<br>Price = Star Shop rate ($1 = 233,400 Toman) + 500,000 Toman service fee. Tell me the service name for its exact price! 😉',
      ar: 'نقدم <b>٦١ خدمة ذكاء اصطناعي</b>! 🤖 من ChatGPT و Claude و Gemini و Grok إلى Midjourney و Suno و Runway وغيرها — في ثلاث فئات: نصية وصوتية/مرئية وبرمجة.<br>السعر = سعر ستار شوب (1$ = 233,400 تومان) + 500,000 تومان. أخبرني باسم الخدمة لمعرفة سعرها! 😉'
    }
  },
  {
    id: 'shared',
    keys: ['اشتراکی', 'shared', 'حساب مشترک', 'اشتراک مشترک', 'مشترک چیه'],
    a: {
      fa: 'در «اشتراک اشتراکی» (Shared)، یک حساب Premium بین چند کاربر تقسیم می‌شه و به همین دلیل قیمتش خیلی ارزون‌تره. برای <b>Grok</b>، <b>Perplexity</b> و <b>Midjourney</b> نسخه اشتراکی داریم. امکانات اصلی سرویس کاملاً در دسترسه؛ فقط ممکنه محدودیت‌های جزئی مثل صف پردازش یا تاریخچه مشترک وجود داشته باشه.',
      en: 'In a "Shared" plan, one Premium account is split between several users — that\'s why it\'s much cheaper. We offer shared versions of <b>Grok</b>, <b>Perplexity</b> and <b>Midjourney</b>. Core features are fully available; minor limits like processing queues may apply.',
      ar: 'في الخطة "المشتركة" (Shared) يُقسَّم حساب Premium بين عدة مستخدمين — لذلك يكون سعرها أرخص بكثير. لدينا نسخ مشتركة من <b>Grok</b> و<b>Perplexity</b> و<b>Midjourney</b>، مع إمكانية وجود قيود بسيطة.'
    }
  },
  {
    id: 'gift',
    keys: ['گیفت', 'گیفت کارت', 'gift card', 'giftcard', 'کارت هدیه', 'gift cards', 'بطاقة هدية', 'بطاقات هدية'],
    a: {
      fa: 'این گیفت کارت‌ها رو داریم: 🎁 Google Play، Apple/iTunes، Visa، MasterCard، Steam، PlayStation، Xbox، Netflix، Spotify، Discord Nitro، Razer Gold، Roblox، Nintendo eShop، Epic Games، YouTube Premium و…<br>با ریجن‌های آمریکا، اروپا، ترکیه، امارات، هند و…<br>برای دیدن قیمت، روی کارت موردنظر توی بخش «گیفت کارت» سایت بزن — قیمت‌ها با نرخ لحظه‌ای دلار به‌روز می‌شن.',
      en: 'We offer these gift cards: 🎁 Google Play, Apple/iTunes, Visa, MasterCard, Steam, PlayStation, Xbox, Netflix, Spotify, Discord Nitro, Razer Gold, Roblox, Nintendo eShop, Epic Games, YouTube Premium and more — with US, EU, Turkey, UAE, India regions and others.<br>Tap any card in the "Gift Cards" section to see its live-rate price.',
      ar: 'لدينا هذه البطاقات: 🎁 Google Play وApple/iTunes وVisa وMasterCard وSteam وPlayStation وXbox وNetflix وSpotify وDiscord Nitro والمزيد — بمناطق أمريكا وأوروبا وتركيا والإمارات وغيرها.<br>اضغط على أي بطاقة في قسم "بطاقات الهدايا" لرؤية سعرها بالسعر اللحظي.'
    }
  },
  {
    id: 'cards',
    keys: ['کارت مجازی', 'کارت فیزیکی', 'ویزا', 'مسترکارت', 'master card', 'mastercard', 'visa', 'virtual card', 'physical card', 'کارت بین المللی', 'فيزا'],
    a: {
      fa: '💳 <b>کارت مجازی</b> برای پرداخت آنلاین (اشتراک‌ها، خرید از سایت‌های خارجی) صادر می‌شه و اطلاعات‌شون دیجیتال تحویل داده می‌شه. <b>کارت فیزیکی</b> برای استفاده حضوری در سفر و دستگاه‌های POS خارجی مناسبه.<br>بگو برای چه کاری می‌خوای تا بهترین گزینه (Visa یا MasterCard) رو پیشنهاد بدیم.',
      en: '💳 A <b>virtual card</b> is for online payments (subscriptions, foreign websites) — delivered digitally. A <b>physical card</b> is for in-person use while traveling and foreign POS terminals.<br>Tell me your use case and we\'ll suggest the best option (Visa or MasterCard).',
      ar: '💳 <b>البطاقة الافتراضية</b> للدفع الإلكتروني وتُسلَّم رقمياً، و<b>البطاقة الفيزيائية</b> للاستخدام الشخصي في السفر وأجهزة POS الأجنبية.<br>أخبرنا بغرض الاستخدام لنقترح الخيار الأنسب.'
    }
  },
  {
    id: 'paypal',
    keys: ['پی پال', 'paypal', 'پال'],
    a: {
      fa: 'افتتاح حساب <b>PayPal</b> رو در دو نسخه انجام می‌دیم: Personal (برای خریدهای روزمره) و Business (برای دریافت وجه) — به‌همراه خدمات شارژ موجودی. فرآیند مرحله‌به‌مرحله و شفافه؛ از دکمه «شروع سفارش» یا بخش PayPal سایت درخواستت رو ثبت کن.',
      en: 'We set up <b>PayPal</b> accounts in two versions: Personal (for everyday purchases) and Business (for receiving money) — plus balance top-up services. Submit your request via the "Start Order" button or the PayPal section.',
      ar: 'نفتح حسابات <b>PayPal</b> بنسختين: Personal وBusiness — مع خدمات شحن الرصيد. أرسل طلبك عبر زر "ابدأ الطلب" أو قسم PayPal.'
    }
  },
  {
    id: 'shopping',
    keys: ['آمازون', 'amazon', 'خرید خارجی', 'سایت خارجی', 'لینک محصول', 'خرید از خارج', 'علی اکسپرس', 'aliexpress', 'ebay', 'ایبی'],
    a: {
      fa: 'برای خرید از آمازون یا هر سایت خارجی دیگه، فقط <b>لینک محصول</b> رو برامون بفرست (از طریق فرم سفارش یا تلگرام). بعد از بررسی، هزینه تقریبی و زمان تحویل رو اعلام می‌کنیم؛ پس از تأیید و پرداخت ریالی، خرید انجام می‌شه. قیمت نهایی ممکنه با نرخ ارز و هزینه ارسال کمی تغییر کنه.',
      en: 'To buy from Amazon or any foreign store, just send us the <b>product link</b> (via the order form or Telegram). We\'ll review it, quote the estimated cost and delivery time; after your confirmation and rial payment, we complete the purchase. Final price may vary slightly with FX and shipping.',
      ar: 'للشراء من أمازون أو أي متجر أجنبي، أرسل لنا <b>رابط المنتج</b> فقط. سندرس الطلب ونعلن التكلفة التقريبية ووقت التسليم، وبعد تأكيدك والدفع الريالي نتمم الشراء.'
    }
  },
  {
    id: 'exams',
    keys: ['آیلتس', 'ایلتس', 'ielts', 'تافل', 'toefl', 'آزمون', 'امتحان', 'duolingo', 'دولینگو', 'gmat', 'gre', 'امتحانات', 'اختبار'],
    a: {
      fa: 'هزینه آزمون‌های بین‌المللی مثل <b>IELTS، TOEFL، Duolingo، GMAT، GRE</b> و حتی گواهی‌های حرفه‌ای (AWS، PMP) رو پرداخت می‌کنیم. نوع آزمون، کشور و مرکز آزمون رو در فرم سفارش ثبت کن؛ پس از بررسی، مبلغ ریالی اعلام و ثبت‌نامت انجام می‌شه. توصیه می‌کنیم حداقل چند روز قبل از ددلاین سفارش بدی. 🎓',
      en: 'We pay for international exams like <b>IELTS, TOEFL, Duolingo, GMAT, GRE</b> and professional certificates (AWS, PMP). Register the exam type, country and center in the order form; after review, the rial amount is announced and your registration is completed. Order a few days before your deadline. 🎓',
      ar: 'ندفع رسوم الاختبارات الدولية مثل <b>IELTS وTOEFL وDuolingo</b> والشهادات المهنية. سجّل نوع الاختبار والبلد والمركز في نموذج الطلب؛ بعد المراجعة يُعلن المبلغ الريالي ويتم التسجيل. 🎓'
    }
  },
  {
    id: 'income',
    keys: ['درآمد', 'فریلنس', 'upwork', 'آپورک', 'fiverr', 'تسویه', 'نقد کردن', 'income', 'درايد'],
    a: {
      fa: 'درآمد ارزی‌ات (از <b>Upwork، Fiverr</b>، یوتیوب و…) رو به ریال تسویه می‌کنیم. پلتفرم مبدا و جزئیات درآمد رو در فرم سفارش ثبت کن؛ نرخ و زمان تسویه اعلام می‌شه و مبلغ مستقیم به حسابت واریز می‌شه. برای کسب‌وکارها تسویه منظم دوره‌ای هم داریم. 💰',
      en: 'We settle your foreign income (<b>Upwork, Fiverr</b>, YouTube…) into rials. Register the platform and income details in the order form; the rate and settlement time are announced and paid directly to your bank account. Regular business settlements available. 💰',
      ar: 'نسوٍّ دخلك بالعملات الأجنبية (من <b>Upwork وFiverr</b> ويوتيوب و…) إلى ريالات. سجّل تفاصيل الدخل في نموذج الطلب؛ يُعلن السعر والوقت ويُودع المبلغ مباشرة في حسابك. 💰'
    }
  },
  {
    id: 'payment',
    keys: ['پرداخت چطور', 'روش پرداخت', 'پرداخت ریالی', 'کارت به کارت', 'شیوه پرداخت', 'واریز', 'چطور پول', 'payment method', 'how to pay', 'طريقة الدفع'],
    a: {
      fa: 'پرداخت کاملاً <b>ریالی</b> هست! 💰 بعد از ثبت سفارش (از سبد خرید یا فرم)، هزینه به تومان اعلام می‌شه و از طریق تلگرام یا بله با هماهنگ می‌کنیم. اطلاعات حساب برای واریز، در همون گفتگو بهت داده می‌شه.',
      en: 'Payment is fully in <b>rial</b>! 💰 After submitting your order (cart or form), the Toman amount is announced and settled via Telegram or Bale. Bank details are shared in that same chat.',
      ar: 'الدفع بالكامل <b>بالريال</b>! 💰 بعد تسجيل الطلب، يُعلن المبلغ بالتومان ويُنسَّق عبر تيليجرام أو بله، وتُعطى تفاصيل الحساب في المحادثة نفسها.'
    }
  },
  {
    id: 'time',
    keys: ['چقدر طول', 'طول میکشه', 'طول می کشد', 'چند روز', 'چند ساعت', 'زمان انجام', 'زمان تحویل', 'چقدر زمان', 'چه زمانی', 'how long', 'delivery time', 'متى', 'كم يستغرق'],
    a: {
      fa: 'زمان انجام هر سفارش به نوع خدمتش بستگی داره: گیفت کارت‌ها و اکانت‌ها معمولاً بعد از تأیید پرداخت خیلی سریع تحویل داده می‌شن؛ پرداخت‌های ارزی و خرید خارجی بسته به سرویس مقصد از چند دقیقه تا چند روز زمان می‌بره. بعد از ثبت سفارش، زمان دقیق بهت اعلام می‌شه. ⏱️',
      en: 'Delivery time depends on the service: gift cards and accounts are usually delivered very quickly after payment confirmation; international payments and foreign purchases take from minutes to a few days. The exact time is announced after ordering. ⏱️',
      ar: 'يعتمد وقت التسليم على نوع الخدمة: تُسلَّم بطاقات الهدايا والحسابات عادة بسرعة بعد تأكيد الدفع، بينما تستغرق المدفوعات الدولية من دقائق إلى أيام قليلة. يُعلن الوقت الدقيق بعد الطلب. ⏱️'
    }
  },
  {
    id: 'track',
    keys: ['پیگیری', 'پیگیر', 'وضعیت سفارش', 'سفارش من', 'کد سفارش', 'track', 'دنبال سفارش', 'حالة الطلب'],
    a: {
      fa: 'وضعیت سفارش در هر مرحله از طریق تلگرام (<a href="https://t.me/Sam7NeC" target="_blank" rel="noopener">@Sam7NeC</a>) یا بله بهت اطلاع داده می‌شه. هر وقت خواستی، کد سفارشت رو همراه پیام بفرست تا وضعیت دقیق رو بگیم. سفارش‌های خودت رو توی پنل حساب کاربری هم می‌تونی ببینی. 📦',
      en: 'Order status is updated via Telegram (<a href="https://t.me/Sam7NeC" target="_blank" rel="noopener">@Sam7NeC</a>) or Bale at every stage. Send your order code anytime for an exact status. You can also see your orders in your account panel. 📦',
      ar: 'يُبلَّغ عن حالة الطلب في كل مرحلة عبر تيليجرام أو بله. أرسل رمز طلبك في أي وقت لمعرفة الوضع الدقيق، ويمكنك أيضاً رؤية طلباتك في لوحة حسابك. 📦'
    }
  },
  {
    id: 'warranty',
    keys: ['گارانتی', 'ضمانت', 'مرجوع', 'بازگشت وجه', 'پس دادن', 'لغو سفارش', 'انصراف', 'refund', 'cancel', 'return', 'مشکل بعد از', 'کار نکرد', 'خراب بود', 'استرداد'],
    a: {
      fa: 'رضایت کاربر اولویت ماست! اگه بعد از خرید با مشکلی مواجه شدی، فوراً از طریق تلگرام یا بله با پشتیبانی در تماس باش و کد سفارشت رو بگو. سفارش‌هایی که پردازششون شروع نشده طبق توافق قابل لغو هستن و مشکلات فنی خدمات سریع پیگیری می‌شن. 🛡️',
      en: 'Your satisfaction is our priority! If you face any issue after purchase, contact support via Telegram or Bale right away with your order code. Orders not yet processed can be cancelled by agreement; technical issues are resolved quickly. 🛡️',
      ar: 'رضاك أولويتنا! إذا واجهت أي مشكلة بعد الشراء، تواصل مع الدعم عبر تيليجرام أو بله مع رمز طلبك. الطلبات التي لم تبدأ معالجتها قابلة للإلغاء بالاتفاق، وتُعالج المشاكل التقنية بسرعة. 🛡️'
    }
  },
  {
    id: 'account',
    keys: ['ورود', 'ثبت نام', 'لاگین', 'login', 'sign up', 'signup', 'حساب کاربری', 'رمز', 'otp', 'کد تایید', 'اکانت سایت', 'پنل کاربری', 'account'],
    a: {
      fa: 'برای خرید لازم نیست حتماً عضو بشی، ولی با ورود (شماره موبایل + کد تأیید، یا گوگل) اطلاعات تماست خودکار توی سفارش‌ها میاد و تاریخچه سفارش‌هات رو هم می‌تونی ببینی. اطلاعات کاربری فقط روی دستگاه خودت ذخیره می‌شه — نه روی هیچ سروری. 🔐',
      en: 'You can order without signing up, but logging in (phone + OTP code, or Google) auto-fills your contact in orders and shows your order history. Your data stays only on your own device — never on any server. 🔐',
      ar: 'يمكنك الشراء دون تسجيل، لكن تسجيل الدخول (الهاتف + رمز التحقق أو Google) يعبّئ بياناتك تلقائياً ويعرض سجل طلباتك. بياناتك تبقى على جهازك فقط — وليس على أي خادم. 🔐'
    }
  },
  {
    id: 'privacy',
    keys: ['امنیت', 'امن', 'حریم خصوصی', 'اطلاعات من', 'مطمئن', 'trust', 'معتبر', 'privacy', 'security', 'safe', 'خصوصية'],
    a: {
      fa: 'امنیت و حریم خصوصی برامون مهمه: 🔒 هیچ داده‌ای روی سرور ذخیره نمی‌شه — اطلاعات سبد و سفارش فقط در مرورگر خودته · اطلاعات سفارش فقط برای پیگیری همون سفارش استفاده می‌شه · ورود با کد یکبارمصرفه و رمز عبوری وجود نداره. استارشاپ سرویس مستقلی هست و ادعای همکاری رسمی با هیچ برندی نداره.',
      en: 'Privacy matters to us: 🔒 No data is stored on any server — cart and order info stay in your own browser · order details are used only for that order · login is one-time-code based, no passwords. Star Shop is an independent service with no official brand partnerships.',
      ar: 'الخصوصية مهمة لنا: 🔒 لا تُخزَّن أي بيانات على خوادم — معلومات السلة والطلب تبقى في متصفحك · تُستخدم بيانات الطلب فقط لذلك الطلب · الدفع برمز لمرة واحدة دون كلمات مرور. ستار شوب خدمة مستقلة.'
    }
  },
  {
    id: 'wallet',
    keys: ['کیف پول', 'هارد ولت', 'ledger', 'تریزور', 'hardware wallet', 'محفظة'],
    a: {
      fa: 'کیف پول‌های سخت‌افزاری (مثل <b>Ledger</b>) امن‌ترین راه نگهداری دارایی دیجیتال هستن، چون کلیدهای خصوصی همیشه آفلاین می‌مونن. با مشاوره ما مدل مناسب نیازت رو انتخاب کن؛ راه‌اندازی اولیه هم همراهت هستیم. (توصیه سرمایه‌گذاری نمی‌کنیم!) 🔑',
      en: 'Hardware wallets (like <b>Ledger</b>) are the safest way to store digital assets — private keys stay offline. Consult us to pick the right model; we help with initial setup too. (No investment advice!) 🔑',
      ar: 'المحافظ المادية (مثل <b>Ledger</b>) هي الأأمن لتخزين الأصول الرقمية لأن المفاتيح تبقى دون اتصال. استشرنا لاختيار النموذج المناسب ونساعدك في الإعداد. (لا نقدم نصائح استثمارية!) 🔑'
    }
  },
  {
    id: 'lang',
    keys: ['زبان سایت', 'زبان ها', 'انگلیسی', 'عربی', 'فارسی', 'language', 'english', 'arabic', 'لغة'],
    a: {
      fa: 'سایت استارشاپ سه‌زبانه‌ست! از منوی بالا می‌تونی زبان <b>فارسی</b>، <b>English</b> یا <b>العربية</b> رو انتخاب کنی — کل سایت (حتی من!) همون زبان حرف می‌زنه. 🌐',
      en: 'Star Shop is trilingual! Use the top menu to switch between <b>فارسی</b>, <b>English</b> and <b>العربية</b> — the whole site (including me!) speaks your language. 🌐',
      ar: 'موقع ستار شوب ثلاثي اللغات! اختر <b>الفارسية</b> أو <b>English</b> أو <b>العربية</b> من القائمة — الموقع كله (بما فيه أنا!) يتحدث لغتك. 🌐'
    }
  }
];

/* ═══════════ موتور تشخیص سرویس هوش مصنوعی + قیمت ═══════════ */
const ALIAS = {
  'gpt': 'ic-chatgpt', 'openai': 'ic-chatgpt', 'چت جی تی': 'ic-chatgpt', 'چت جیتی': 'ic-chatgpt', 'جی پی تی': 'ic-chatgpt',
  'bard': 'ic-gemini', 'جمینای': 'ic-gemini', 'google ai': 'ic-gemini',
  'میدجورنی': 'ic-midjourney', 'میدجرنی': 'ic-midjourney', 'mid journey': 'ic-midjourney',
  'dalle': 'ic-dalle', 'dall e': 'ic-dalle', 'دالی': 'ic-dalle',
  'sora': 'ic-runway', 'دیپ سیک': 'ic-deepseek', 'کوپایلت': 'ic-copilot', 'github copilot': 'ic-copilot',
  'الیون لب': 'ic-elevenlabs', 'الون لبز': 'ic-elevenlabs', 'کرسر': 'ic-cursor', 'نوت بوک': 'ic-notebooklm'
};

const findTool = nq => {
  const tools = window.SS_AI_TOOLS || [];
  let best = null, bestLen = 0;
  for (const tl of tools) {
    const cands = [String(tl.t || '').toLowerCase(), norm(tl.n && tl.n.fa), String(tl.id || '').replace(/^ic-/, '').replace(/-/g, ' ')];
    for (const c of cands) {
      if (c && c.length >= 3 && nq.includes(c) && c.length > bestLen) { best = tl; bestLen = c.length; }
    }
  }
  if (best) return best;
  for (const k in ALIAS) {
    if (nq.includes(k)) { const tl = tools.find(x => x.id === ALIAS[k]); if (tl) return tl; }
  }
  return null;
};

const IC = () => window.SS_AI_IC || { unitRial: 2334000, premiumToman: 500000 };
const aiToman = usd => Math.round((usd + 1) * IC().unitRial / 10 + (IC().premiumToman || 500000));

const toolAnswer = (tl, q) => {
  const lang = pickLang(q);
  const name = (lang === 'fa' ? (tl.n && tl.n.fa) || tl.t : tl.t) || tl.id;
  const nm = escapeHtml(name);
  if (tl.avail === false) {
    return {
      fa: `<b>${nm}</b> فعلاً در استارشاپ ارائه نمی‌شه 😔 ولی خیلی از سرویس‌های مشابه رو داریم — بگو دنبال چه قابلیتی هستی تا جایگزین مناسب پیشنهاد بدم!`,
      en: `<b>${nm}</b> is temporarily unavailable at Star Shop 😔 But we offer many similar services — tell me what capability you need and I'll suggest an alternative!`,
      ar: `<b>${nm}</b> غير متوفر حالياً في ستار شوب 😔 لكن لدينا خدمات مشابه كثيرة — أخبرني بما تحتاجه لاقتراح بديل!`
    }[lang];
  }
  if (tl.custom) {
    return {
      fa: `🤖 برای <b>${nm}</b> فعالسازی و شارژ به انتخاب شماست و مبلغ بسته به نوع استفاده متفاوته. سفارشت رو از بخش هوش مصنوعی سایت ثبت کن یا از پشتیبانی بپرس تا دقیق اعلام شه!`,
      en: `🤖 For <b>${nm}</b>, activation/credit is fully up to you and the amount depends on your usage. Place your order in the AI section or ask support for an exact quote!`,
      ar: `🤖 لـ<b>${nm}</b> التنشيط والشحن حسب اختيارك، ويختلف المبلغ حسب الاستخدام. أرسل طلبك من قسم الذكاء الاصطناعي أو اسأل الدعم!`
    }[lang];
  }
  const plans = (tl.plans || []).map(p => ({ n: (lang === 'fa' && p.nf) ? p.nf : p.n, t: aiToman(p.usd) })).sort((a, b) => a.t - b.t);
  if (!plans.length) return null;
  const lines = plans.map(p => `• <b>${escapeHtml(p.n)}</b>: ${money(p.t, lang)} ${lang === 'en' ? 'Toman' : 'تومان'}`).join('<br>');
  const note = {
    fa: 'قیمت = نرخ استارشاپ (۱$ = ۲۳۳٬۴۰۰ تومان) + ۵۰۰٬۰۰۰ تومان حق خدمات. برای خرید، سرویس رو در بخش هوش مصنوعی سایت به سبد اضافه کن! 🛒',
    en: 'Price = Star Shop rate ($1 = 233,400 Toman) + 500,000 Toman service fee. To order, add the service to your cart in the AI section! 🛒',
    ar: 'السعر = سعر ستار شوب (1$ = 233,400 تومان) + 500,000 تومان. للطلب أضف الخدمة إلى السلة من قسم الذكاء الاصطناعي! 🛒'
  }[lang];
  const head = { fa: `🤖 قیمت <b>${nm}</b> در استارشاپ:`, en: `🤖 <b>${nm}</b> prices at Star Shop:`, ar: `🤖 أسعار <b>${nm}</b> في ستار شوب:` }[lang];
  return `${head}<br>${lines}<br><br>${note}`;
};

/* ═══════════ موتور پاسخ‌گو ═══════════ */
const hit = (nq, key) => key.includes(' ') ? nq.includes(key) : (' ' + nq + ' ').includes(' ' + key + ' ');
const scoreOf = (nq, keys) => {
  let s = 0;
  for (const k of keys) if (hit(nq, k)) s += k.replace(/\s/g, '').length + (k.includes(' ') ? 6 : 0) + (k.length <= 3 ? 2 : 0);
  return s;
};
const THRESHOLD = 4;

const REFUSE = {
  fa: 'این سوال خارج از تخصص منه 🙏 من دستیار هوش مصنوعی <b>استارشاپ</b> هستم و فقط درباره خدمات، قیمت‌ها، نحوه خرید و سفارش‌ها می‌تونم کمکت کنم. یکی از سوالای پیشنهادی زیر رو امتحان کن یا سوالت رو درباره سایت بپرس!',
  en: "That's outside my expertise 🙏 I'm <b>Star Shop's</b> AI assistant and I can only help with our services, prices, ordering and support. Try one of the suggested questions below, or ask me anything about the site!",
  ar: 'هذا السؤال خارج تخصصي 🙏 أنا المساعد الذكي لـ<b>ستار شوب</b> وأجيب فقط عن أسئلة الخدمات والأسعار والطلب. جرّب أحد الأسئلة المقترحة بالأسفل!'
};

const answerFor = raw => {
  const q = String(raw || '').trim();
  if (q.length < 2) return { html: REFUSE.fa, forceChips: true };
  const nq = norm(q);
  /* ۱) تشخیص سرویس هوش مصنوعی */
  const tl = findTool(nq);
  if (tl) { const a = toolAnswer(tl, q); if (a) return { html: a }; }
  /* ۲) پایگاه دانش */
  let best = null, bestScore = 0, second = 0;
  for (const topic of KB) {
    const s = scoreOf(nq, topic.keys);
    if (s > bestScore) { second = bestScore; best = topic; bestScore = s; }
    else if (s > second) second = s;
  }
  if (best && bestScore >= THRESHOLD) {
    let ans = typeof best.a === 'function' ? best.a(q) : best.a[pickLang(q)] || best.a.fa;
    return { html: ans, nearMiss: bestScore - second <= 2 && bestScore < 9 };
  }
  /* ۳) خارج از حوزه */
  return { html: REFUSE[pickLang(q)] || REFUSE.fa, forceChips: true };
};

/* ═══════════ رابط کاربری ویجت ═══════════ */
const ROBOT = `<svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><rect x="10" y="16.5" width="28" height="21" rx="8" stroke="url(#lg-star)" stroke-width="2.6" fill="rgba(78,140,255,.13)"/><circle cx="19" cy="27" r="2.5" fill="url(#lg-star)"/><circle cx="29" cy="27" r="2.5" fill="url(#lg-star)"/><path d="M20.5 32.5h7" stroke="url(#lg-star)" stroke-width="2.2" stroke-linecap="round"/><path d="M24 16.5V11" stroke="url(#lg-star)" stroke-width="2.6" stroke-linecap="round"/><circle cx="24" cy="8.6" r="2.3" fill="#00a6a6"/><path d="M10 27H6.8M41.2 27H38" stroke="url(#lg-star)" stroke-width="2.6" stroke-linecap="round"/></svg>`;
const SEND = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4Z"/></svg>`;

let els = null, opened = false, busy = false;

const build = () => {
  const root = document.createElement('div');
  root.className = 'sup-root';
  root.innerHTML = `
    <button class="sup-fab" id="supFab" aria-label="${escapeHtml(T('sup.w.fab'))}">
      ${ROBOT}<span class="sup-dot" aria-hidden="true"></span>
    </button>
    <div class="sup-panel" id="supPanel" hidden role="dialog" aria-label="${escapeHtml(T('sup.w.title'))}">
      <div class="sup-head">
        <span class="sup-avatar" aria-hidden="true">${ROBOT}</span>
        <div class="sup-head-txt">
          <b>${escapeHtml(T('sup.w.title'))}</b>
          <span class="sup-status"><i aria-hidden="true"></i>${escapeHtml(T('sup.w.status'))}</span>
        </div>
        <button class="sup-close" id="supClose" aria-label="${escapeHtml(T('sup.w.close'))}">
          <svg class="ic" viewBox="0 0 24 24"><use href="#i-close"/></svg>
        </button>
      </div>
      <div class="sup-msgs" id="supMsgs"></div>
      <div class="sup-chips" id="supChips"></div>
      <form class="sup-form" id="supForm" autocomplete="off">
        <input class="sup-in" id="supIn" maxlength="300" placeholder="${escapeHtml(T('sup.w.ph'))}">
        <button class="sup-send" type="submit" aria-label="${escapeHtml(T('sup.w.send'))}">${SEND}</button>
      </form>
      <p class="sup-fine">${escapeHtml(T('sup.w.fine'))}</p>
    </div>`;
  document.body.appendChild(root);
  els = {
    fab: root.querySelector('#supFab'), panel: root.querySelector('#supPanel'),
    msgs: root.querySelector('#supMsgs'), chips: root.querySelector('#supChips'),
    form: root.querySelector('#supForm'), in: root.querySelector('#supIn')
  };
  els.fab.addEventListener('click', open);
  root.querySelector('#supClose').addEventListener('click', close);
  els.form.addEventListener('submit', e => {
    e.preventDefault();
    const v = els.in.value.trim();
    if (!v || busy) return;
    els.in.value = '';
    ask(v);
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !els.panel.hidden) close();
  });
  document.addEventListener('click', e => {
    if (e.target.closest('[data-open-support]')) { e.preventDefault(); open(); }
  });
  document.addEventListener('ss:lang', () => { renderChrome(); });
};

const renderChips = () => {
  const items = [
    T('sup.q1'), T('sup.q2'), T('sup.q4'), T('sup.q3')
  ];
  els.chips.innerHTML = items.map(c => `<button type="button" class="sup-chip">${escapeHtml(c)}</button>`).join('');
  els.chips.querySelectorAll('.sup-chip').forEach(b => b.addEventListener('click', () => {
    if (busy) return;
    ask(b.textContent.trim());
  }));
};

const renderChrome = () => {
  if (!els) return;
  els.fab.setAttribute('aria-label', T('sup.w.fab'));
  els.panel.setAttribute('aria-label', T('sup.w.title'));
  const title = els.panel.querySelector('.sup-head-txt');
  title.innerHTML = `<b>${escapeHtml(T('sup.w.title'))}</b><span class="sup-status"><i aria-hidden="true"></i>${escapeHtml(T('sup.w.status'))}</span>`;
  els.in.placeholder = T('sup.w.ph');
  els.panel.querySelector('.sup-fine').textContent = T('sup.w.fine');
  renderChips();
};

/* ── پیام‌ها ── */
const scrollEnd = () => { els.msgs.scrollTop = els.msgs.scrollHeight; };
const addMsg = (html, who) => {
  const wrap = document.createElement('div');
  wrap.className = 'sup-msg ' + who;
  const bub = document.createElement('div');
  bub.className = 'sup-bub';
  bub.innerHTML = html;
  wrap.appendChild(bub);
  els.msgs.appendChild(wrap);
  scrollEnd();
  return wrap;
};
const showTyping = () => {
  const el = document.createElement('div');
  el.className = 'sup-msg bot';
  el.innerHTML = '<div class="sup-bub sup-typing" aria-hidden="true"><i></i><i></i><i></i></div>';
  els.msgs.appendChild(el);
  scrollEnd();
  return el;
};

const greet = () => {
  busy = true;
  const tp = showTyping();
  setTimeout(() => {
    tp.remove();
    const lang = siteLang();
    const hello = {
      fa: 'سلام! 👋 من <b>دستیار هوش مصنوعی استارشاپ</b> هستم.<br>هر سوالی درباره خدمات، قیمت‌ها یا نحوه خرید داری بپرس — فقط سوالات مربوط به استارشاپ رو جواب می‌دم! 😉',
      en: "Hi! 👋 I'm <b>Star Shop's AI assistant</b>.<br>Ask me anything about services, prices or ordering — I only answer Star Shop-related questions! 😉",
      ar: 'أهلاً! 👋 أنا <b>المساعد الذكي لستار شوب</b>.<br>اسألني عن الخدمات أو الأسعار أو الطلب — أجيب فقط عن أسئلة الموقع! 😉'
    }[lang] || '…';
    addMsg(hello, 'bot');
    renderChips();
    busy = false;
  }, 650);
};

const open = () => {
  if (!els) build();
  els.panel.hidden = false;
  requestAnimationFrame(() => els.panel.classList.add('open'));
  els.fab.classList.add('active');
  if (!opened) { opened = true; greet(); }
  setTimeout(() => els.in && els.in.focus(), 380);
};
const close = () => {
  els.panel.classList.remove('open');
  els.fab.classList.remove('active');
  setTimeout(() => { els.panel.hidden = true; }, 280);
};

/* ── پرسش → پاسخ ── */
const ask = q => {
  addMsg(escapeHtml(q).replace(/\n/g, '<br>'), 'me');
  busy = true;
  const tp = showTyping();
  const delay = 550 + Math.min(900, Math.round(q.length * 12)) + Math.floor(Math.random() * 300);
  setTimeout(() => {
    tp.remove();
    let res;
    try { res = answerFor(q); } catch (e) { res = { html: REFUSE.fa, forceChips: true }; }
    addMsg(res.html, 'bot');
    busy = false;
  }, delay);
};

/* ── init ── */
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
else build();
})();
