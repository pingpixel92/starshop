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
     (Origins: https://pingpixel92.github.io) و اینجا قرار دهید. */
  googleClientId: '',

  /* ── نرخ لحظه‌ای و کارمزد ──
     markup: کارمزد خدمات (۲۰٪) روی نرخ لحظه‌ای
     refreshMs: فاصله تازه‌سازی خودکار نرخ‌ها (۴ دقیقه)
     fallback: نرخ تقریبی در صورت قطع بودن منابع زنده (ریال) */
  rates: {
    markup: 0.20,
    refreshMs: 240000,
    fallback: { usdIrr: 1100000, gold18: 3500000, coin: 90000000 }
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
