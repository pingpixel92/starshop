# استار شاپ — STARSHOP

پلتفرم **خدمات پرداخت و سرویس‌های بین‌المللی** — وب‌سایت رسمی (استاتیک، سه‌زبانه).

پرداخت‌های بین‌المللی · حساب‌ها و PayPal · کارت‌های Visa/MasterCard · گیفت کارت · اکانت‌های هوش مصنوعی و Premium · خرید خارجی · درآمد ارزی · آزمون‌های بین‌المللی · کیف پول سخت‌افزاری

## 🌐 دامنه عمومی (GitHub Pages)

```
https://pingpixel92.github.io/starshop/
```

هر push به شاخه `main` به‌صورت **خودکار** دوباره منتشر می‌شود (GitHub Pages از شاخه `main / root` سرو می‌کند). نیازی به build نیست.

## ✨ امکانات نسخه ۲

- **ورود / ثبت‌نام با موبایل:** کد تأیید ۴ رقمی (هر بار کد جدید، انقضای ۲ دقیقه، قفل پس از ۵ تلاش ناموفق). کد به‌صورت هش SHA-256 ذخیره می‌شود.
- **ادامه با گوگل:** با تنظیم `googleClientId` در `config.js` فعال می‌شود (Google Identity Services).
- **سبد خرید:** افزودن خدمات و گیفت کارت‌ها، تنظیم تعداد، ذخیره محلی.
- **پرداخت از طریق تلگرام / بله:** با یک کلیک، چت مالک باز می‌شود و **جزئیات کامل سفارش** (اقلام، تعداد، کد سفارش، اطلاعات کاربر، تاریخ) به‌صورت خودکار آماده ارسال است — کاربر چیزی تایپ نمی‌کند.
- **سه‌زبانه کامل:** فارسی (پیش‌فرض، RTL) / English (LTR) / العربية (RTL) — همه محتوا شامل خدمات، مقالات، سوالات متداول و قوانین.
- **پنل حساب کاربری:** مشخصات، ویرایش نام، تاریخچه سفارش‌ها، خروج.
- **مقالات واقعی مجله:** ۶ مقاله کامل + قوانین و حریم خصوصی.
- **لوگوهای واقعی برندها:** PlayStation، Xbox، Steam، Apple، Amazon، Netflix، PUBG، Free Fire، Google Play، ChatGPT، Gemini، Cursor، Midjourney، Visa، Mastercard، PayPal، تلگرام، بله و گوگل.
- **امنیت:** CSP، ضد XSS (escape همه داده‌های کاربر)، محدودیت نرخ OTP، هش کد، انقضای نشست، `rel=noopener`.

## 🗂 ساختار

```
starshop/
├── index.html              # تک‌صفحه کامل (تمام سکشن‌ها + مودال‌ها)
├── assets/
│   ├── css/style.css       # دیزاین‌سیستم (تم روشن/تاریک، RTL، ریسپانسیو)
│   ├── js/config.js        # ⚙️ اطلاعات تماس + هوک پیامک + Client ID گوگل
│   ├── js/data-fa.js       # محتوای فارسی (خدمات، مقالات، FAQ، قوانین)
│   ├── js/data-en.js       # محتوای انگلیسی
│   ├── js/data-ar.js       # محتوای عربی
│   ├── js/i18n.js          # موتور چندزبانه + تغییر جهت RTL/LTR
│   ├── js/auth.js          # ورود OTP + گوگل + پنل حساب
│   ├── js/cart.js          # سبد خرید + پرداخت تلگرام/بله
│   ├── js/main.js          # رندر data-driven + تعاملات
│   ├── js/three-scene.js   # لایه WebGL (ذرات + شبکه جهانی) با فالبک
│   ├── logos/              # لوگوهای برندها (SVG محلی)
│   ├── favicon.svg · og.png
├── robots.txt · sitemap.xml · .nojekyll
```

## ⚙️ فعال‌سازی پیامک واقعی (OTP)

به‌صورت پیش‌فرض کد تأیید در «حالت نمایشی» داخل مودال نشان داده می‌شود. برای ارسال **واقعی SMS**:

1. یک سرویس پیامک ایرانی (Kavenegar، SMS.ir و…) راه بیندازید.
2. یک endpoint (مثلاً Cloudflare Worker یا پروکسی کوچک) بسازید که POST با بدنه `{ "phone", "code", "message" }` را بپذیرد و SMS بفرستد.
3. در `assets/js/config.js` مقدار `sms.endpoint` را قرار دهید.

> نکته امنیتی: کلید API سرویس پیامک را هرگز در فرانت‌اند قرار ندهید؛ همیشه از یک پروکسی سرورless استفاده کنید.

## ⚙️ فعال‌سازی ورود با گوگل

1. در [Google Cloud Console](https://console.cloud.google.com/) یک OAuth Client ID بسازید (Authorized JavaScript Origins: `https://pingpixel92.github.io`).
2. در `assets/js/config.js` مقدار `googleClientId` را قرار دهید.

## 🔒 اطلاعات تماس (واقعی)

- ایمیل: `pingpixel92@gmail.com`
- تلفن: `0921 676 5883`
- تلگرام: [@Sam7NeC](https://t.me/Sam7NeC)
- بله: [samyar_ahmadvand](https://ble.ir/samyar_ahmadvand)

## ▶️ اجرای محلی

```bash
python3 -m http.server 8000
# http://localhost:8000
```

## 🛠 فنی

- HTML + CSS + Vanilla JS — بدون فریمورک، بدون سرور
- Vazirmatn (CDN) · Lenis (اختیاری، با فالبک) · Three.js (اختیاری، با فالبک CSS)
- دسترس‌پذیری: ARIA، فوکوس‌پذیری، `prefers-reduced-motion`
- SEO: متاتگ‌ها، Open Graph، JSON-LD، sitemap
- هیچ آمار جعلی، لایسنس یا شریک تجاری ساختگی در سایت وجود ندارد؛ قیمت‌ها پس از بررسی سفارش اعلام می‌شود.
