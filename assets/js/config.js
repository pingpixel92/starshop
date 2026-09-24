/* ═══════════════════════════════════════════════════
   STARSHOP — config.js
   اطلاعات تماس واقعی + تنظیمات امنیتی + هوک پیامک
   ═══════════════════════════════════════════════════ */
window.SS_CONFIG = {
  /* ── راه‌های ارتباطی (واقعی) ── */
  email: 'pingpixel92@gmail.com',
  phoneDisplay: '0921 676 5883',
  phoneLink: 'tel:+989216765883',
  telegram: { user: 'Sam7NeC', url: 'https://t.me/Sam7NeC' },
  bale: { user: 'samyar_ahmadvand', url: 'https://ble.ir/samyar_ahmadvand' },

  /* ── گیت‌وی پیامک (کد تأیید واقعی) ──
     برای ارسال واقعی SMS: یک سرویس پیامک (مثلاً Kavenegar یا SMS.ir) راه بیندازید
     و آدرس یک endpoint (یا پروکسی کوچک) را اینجا بگذارید:
       endpoint: 'https://your-proxy.example/send-sms'
     سرور باید POST با بدنه JSON زیر را بپذیرد:
       { "phone": "09xxxxxxxxx", "code": "1234", "message": "..." }
     تا زمانی که خالی باشد، سایت در «حالت نمایشی» کد را داخل خود مودال نشان می‌دهد. */
  sms: { endpoint: '', apiKey: '' },

  /* ── ورود با گوگل ──
     برای فعال‌سازی واقعی: در Google Cloud Console یک OAuth Client ID بسازید
     (Origins: https://starshop.kdns.fr و https://pingpixel92.github.io) و اینجا قرار دهید. */
  googleClientId: '',

  /* ── نرخ لحظه‌ای و کارمزد ──
     markup: کارمزد خدمات (۲۰٪) روی نرخ لحظه‌ای
     refreshMs: فاصله تازه‌سازی خودکار نرخ‌ها (۱۲ ثانیه — صفحه فعال)
     fallback: نرخ تقریبی فقط وقتی همه منابع زنده قطع باشند (ریال) */
  rates: {
    markup: 0.20,
    refreshMs: 12000,
    fallback: { usdIrr: 2310000, gold18: 235600000, coin: 2354800000 }
  },

  /* ── ثبت بازدیدکننده‌ها (لید مارکتینگ) ──
     هر بازدید یک پیام فشرده (دستگاه/مرورگر/منبع ورود/صفحه) به این چت تلگرام می‌رود؛
     ورود کاربر با شماره تلفن هم جداگانه اطلاع داده می‌شود.
     minGapMs: حداقل فاصله بین دو پیام بازدید از هر دستگاه (۳۰ دقیقه)
     برای خاموش‌کردن: enabled: false */
  visitorLog: {
    enabled: true,
    bot: '8892166127:AAFq2MQyzNPq9UUIuiE-MIHvjZCvzMldf10',
    chat: '8693613536',
    minGapMs: 1800000
  },

  /* ── اطلاع‌رسانی سفارش‌ها به تلگرام مالک ──
     هر بار کاربر سبد را با تلگرام/بله نهایی کند یا فرم سفارش ثبت کند،
     متن کامل سفارش خودکار به این چت ارسال می‌شود.
     برای خاموش‌کردن: enabled: false (اگر bot/chat خالی باشد از visitorLog ارث می‌برد) */
  orderNotify: {
    enabled: true,
    bot: '8892166127:AAFq2MQyzNPq9UUIuiE-MIHvjZCvzMldf10',
    chat: '8693613536'
  },

  /* ── تنظیمات امنیتی ── */
  security: {
    otpTtl: 120,          // ثانیه اعتبار کد
    otpResend: 45,        // ثانیه فاصله ارسال مجدد
    otpMaxAttempts: 5,    // حداکثر تلاش برای هر کد
    otpLockMs: 300000,    // قفل ۵ دقیقه‌ای پس از تلاش‌های ناموفق
    maxCodesPerHour: 6,   // ضد اسپم ارسال کد
    sessionTtl: 1209600000 // ۱۴ روز (میلی‌ثانیه)
  }
};
