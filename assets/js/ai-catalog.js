/* ═══════════════════════════════════════════════════
   STARSHOP — ai-catalog.js
   کاتالوگ کامل اکانت‌های هوش مصنوعی — مطابق فهرست ایرانیکارت
   (https://www.iranicard.ir/payments/accounts/artificial-intelligence/)
   اسکرپ مجدد ۲۰۲۶-۰۹-۲۳: ۶۱ محصول (۵۸ پایه + ۳ اشتراکی)
   فرمول قیمت (ثبت‌شده ۲۰۲۶-۰۹-۲۳ از صفحات محصول ایرانیکارت):
     ریال = (مبلغ دلاری + ۱$) × ۲٬۳۳۴٬۰۰۰  ← نرخ روز ایرانیکارت
     قیمت استارشاپ = قیمت ایرانیکارت + ۵۰۰٬۰۰۰ تومان (۵٬۰۰۰٬۰۰۰ ریال)
     → نمونه‌ها: ChatGPT Go 12$ = ۳۰٬۳۴۲٬۰۰۰ ریال ✓ · Claude Pro 20$ = ۴۹٬۰۱۴٬۰۰۰ ریال ✓
   cat: text=متنی · av=صوتی و تصویری · code=برنامه‌نویسی و API
   plans: پلن‌های رسمی صفحه محصول · custom:true = شارژ/فعالسازی به انتخاب کاربر
   avail:false = موقتاً ارائه نمی‌شود (مثل Copilot در ایرانیکارت)
   لوگوی هر سرویس: assets/logos/ai/<id>.webp (اسکرپ از خود ایرانیکارت)
   ═══════════════════════════════════════════════════ */
(() => {
'use strict';

window.SS_AI_IC = { unitRial: 2334000, premiumToman: 500000 };

const C = (id, t, fa, cat, extra) => Object.assign({ id, t, n: { fa, en: t, ar: t }, cat }, extra || {});

window.SS_AI_TOOLS = [
  /* ── تولید محتوای متنی ── */
  C('ic-chatgpt', 'ChatGPT', 'چت‌جی‌پی‌تی', 'text', { plans: [{ n: 'Go', usd: 12 }, { n: 'Plus', usd: 20 }, { n: 'Plus', nf: 'پلاس آماده', usd: 12 }, { n: 'Pro', usd: 100 }] }),
  C('ic-gemini', 'Gemini', 'جمنای', 'text', { plans: [{ n: 'Google AI Pro', usd: 19.99 }, { n: 'Google AI Ultra', usd: 249.99 }] }),
  C('ic-claude', 'Claude', 'کلود', 'text', { plans: [{ n: 'Pro', usd: 20 }, { n: 'Max', usd: 50 }] }),
  C('ic-grok', 'Grok', 'گروک', 'text', { plans: [{ n: 'SuperGrok Lite', usd: 10 }, { n: 'SuperGrok', usd: 30 }, { n: 'SuperGrok Plus', usd: 100 }, { n: 'SuperGrok Heavy', usd: 300 }] }),
  C('ic-grok-sh', 'Grok Shared', 'گروک اشتراکی', 'text', { custom: true }),
  C('ic-copilot', 'Microsoft Copilot', 'مایکروسافت کوپایلت', 'text', { avail: false }),
  C('ic-deepseek', 'DeepSeek', 'دیپ‌سیک', 'text', { custom: true }),
  C('ic-perplexity', 'Perplexity', 'پرپلکسیتی', 'text', { plans: [{ n: 'Pro', usd: 20 }] }),
  C('ic-perplexity-sh', 'Perplexity Shared', 'پرپلکسیتی اشتراکی', 'text', { custom: true }),
  C('ic-notebooklm', 'NotebookLM', 'نوت‌بوک‌ال‌ام', 'text', { custom: true }),
  C('ic-chatgot', 'Chatgot', 'چت‌گات', 'text', { custom: true }),
  C('ic-jasper', 'Jasper', 'جاسپر', 'text', { custom: true }),
  C('ic-writesonic', 'Writesonic', 'رایت‌سونیک', 'text', { custom: true }),
  C('ic-poe', 'Poe', 'پو', 'text', { custom: true }),
  C('ic-sincode', 'Sincode', 'سین‌کد', 'text', { custom: true }),
  C('ic-monica', 'Monica', 'مونیکا', 'text', { plans: [{ n: 'Pro', usd: 9.9 }] }),
  C('ic-sider', 'Sider', 'سایدر', 'text', { custom: true }),
  C('ic-rytr', 'Rytr', 'رایتر', 'text', { custom: true }),
  C('ic-wordtune', 'Wordtune', 'وردتیون', 'text', { custom: true }),
  C('ic-quillbot', 'Quillbot', 'کویل‌بات', 'text', { custom: true }),
  C('ic-praktika', 'Praktika', 'پراکتیکا', 'text', { custom: true }),
  C('ic-elicit', 'Elicit', 'الیسیت', 'text', { custom: true }),
  C('ic-typingmind', 'TypingMind', 'تایپینگ‌مایند', 'text', { custom: true }),
  C('ic-zai', 'z.ai', 'زی‌دات‌ای‌آی', 'text', { custom: true }),

  /* ── تولید محتوای صوتی و تصویری ── */
  C('ic-midjourney', 'Midjourney', 'میدجورنی', 'av', { custom: true }),
  C('ic-midjourney-sh', 'Midjourney Shared', 'میدجورنی اشتراکی', 'av', { custom: true }),
  C('ic-dalle', 'DALL-E', 'دال‌ئی', 'av', { custom: true }),
  C('ic-nanobanana', 'Nano Banana', 'نانو بنانا', 'av', { custom: true }),
  C('ic-leonardo', 'Leonardo AI', 'لئوناردو ای‌آی', 'av', { custom: true }),
  C('ic-dream', 'Dream.ai', 'دریم.ای', 'av', { custom: true }),
  C('ic-synthesia', 'Synthesia', 'سینتیزیا', 'av', { custom: true }),
  C('ic-elevenlabs', 'ElevenLabs', 'الون‌لبز', 'av', { custom: true }),
  C('ic-runway', 'Runway', 'رانوی', 'av', { custom: true }),
  C('ic-suno', 'Suno', 'سونو', 'av', { custom: true }),
  C('ic-kling', 'Kling AI', 'کلینگ ای‌آی', 'av', { custom: true }),
  C('ic-hailuo', 'Hailuo AI', 'هایلو ای‌آی', 'av', { custom: true }),
  C('ic-firefly', 'Adobe Firefly', 'ادوبی فایرفلای', 'av', { custom: true }),
  C('ic-kaiber', 'Kaiber', 'کایبر', 'av', { custom: true }),
  C('ic-fireflies', 'Fireflies', 'فایرفلایز', 'av', { custom: true }),
  C('ic-captions', 'Captions', 'کپشنز', 'av', { custom: true }),
  C('ic-remini', 'Remini', 'ریمینی', 'av', { custom: true }),
  C('ic-higgsfield', 'Higgsfield', 'هیگفیلد', 'av', { custom: true }),
  C('ic-genspark', 'GenSpark', 'جن‌اسپارک', 'av', { custom: true }),
  C('ic-gamma', 'Gamma', 'گاما', 'av', { custom: true }),
  C('ic-invideo', 'InVideo', 'این‌ویدیو', 'av', { custom: true }),
  C('ic-heygen', 'HeyGen', 'هی‌جن', 'av', { custom: true }),

  /* ── برنامه‌نویسی و API ── */
  C('ic-api-openai', 'OpenAI API', 'اِی‌پی‌آی اوپن‌ای‌آی', 'code', { custom: true, topup: true }),
  C('ic-cursor', 'Cursor', 'کرسر', 'code', { plans: [{ n: 'Pro', usd: 20 }, { n: 'Pro+', usd: 60 }, { n: 'Ultra', usd: 200 }, { n: 'Teams', usd: 40 }] }),
  C('ic-opencode', 'OpenCode', 'اوپن‌کد', 'code', { custom: true }),
  C('ic-mistral', 'Mistral Code', 'میسترال کد', 'code', { custom: true }),
  C('ic-tabnine', 'Tabnine', 'تب‌ناین', 'code', { custom: true }),
  C('ic-ghcopilot', 'GitHub Copilot', 'گیت‌هاب کوپایلت', 'code', { custom: true }),
  C('ic-n8n', 'n8n', 'ان‌ایت‌ان', 'code', { custom: true }),
  C('ic-lovable', 'Lovable', 'لاوبل', 'code', { custom: true }),
  C('ic-vercel', 'Vercel', 'ورسل', 'code', { custom: true }),
  C('ic-coderabbit', 'CodeRabbit', 'کد ربیت', 'code', { custom: true }),
  C('ic-bolt', 'Bolt', 'بولت', 'code', { custom: true }),
  C('ic-replit', 'Replit', 'ریپلیت', 'code', { custom: true }),
  C('ic-trae', 'Trae', 'تره', 'code', { custom: true }),
  C('ic-devin', 'Devin', 'دوین', 'code', { custom: true }),
  C('ic-1min', '1min.ai', 'وان‌مین', 'code', { plans: [{ n: 'Pro', usd: 8 }, { n: 'Business', usd: 12.5 }, { n: 'Enterprise', usd: 8.5 }] })
];
})();
