# درع أَثَر — دليل التشغيل الأمني (P21)

© 2026 د. أحمد محمد عبدالعزيز بدوي — جميع الحقوق محفوظة.

درع حيّ يختبر نفسه كل يوم ويعرض نتيجته علنًا. ستة مكوّنات، صفر تبعيات جديدة، صفر كرون جديد.

| المكوّن | أين | ماذا يفعل |
|---|---|---|
| **الجدار** | `next.config.js` | HSTS · nosniff · Referrer · Permissions · `frame-ancestors 'none'` (و`*` على `/verify/*` و`/m/*` عمدًا) · CSP كاملة **Report-Only** → `/api/shield/csp` |
| **الصمّام** | `lib/shield/ratelimit.ts` + RPC `shield_hit` | حدود معدل مشتركة في قاعدة البيانات (نافذة ثابتة) + مسار سريع بالذاكرة + تراجع تلقائي للذاكرة عند تعطّل القاعدة. 429 موحَّد مع `Retry-After` و`X-Request-Id` |
| **الحارس** | `lib/shield/guard.ts` + جدول `portal_security_events` | أحداث (معلومة/تحذير/حرج). الحرج يُرسل فورًا للطاقم (`NOTIFY_EMAILS` أو `ADMIN_EMAILS`) ولصاحب الحساب عند إعادة استخدام رمز/كود |
| **المفاتيح** | `lib/shield/keys.ts` · `/admin/shield` · `/admin/agents` | تدوير `VC_SIGNING_KEY` بلا انقطاع عبر `TOKEN_SECRET_PREV`؛ تدوير مفاتيح الجهات (`atk_`) بسماح 24 ساعة |
| **الباب المعلن** | `/.well-known/security.txt` · `/security` · `/security/report` | RFC 9116 (Expires آلي) · صفحة أمن عامة بحالة الدرع · نموذج بلاغ (فخّ روبوتات + 3/ساعة) |
| **التمرين** | `lib/shield/drill.ts` | 13 اختبارًا يشنّها الخادم على نفسه: زر في `/admin/shield` + يوميًا داخل كرون `followups/send` |

## الحدود الافتراضية
`oauth_token_ip` 20/دقيقة · `oauth_token_client` 10/دقيقة · `oauth_register_ip` 60/ساعة · `oauth_describe_ip` 30/دقيقة · `mcp_public_ip` 120/ساعة · `mcp_401_ip` 20/ساعة · `vc_ip` 120/ساعة · `credential_ip` 12/ساعة · `advisor_ip` 20/ساعة · `sim_anon_ip` 40/ساعة · `vuln_report_ip` 3/ساعة · `csp_ip` 30/دقيقة. تعديلها من `LIMITS` في `lib/shield/ratelimit.ts`.

## تدوير المفتاح الرئيسي (بلا انقطاع)
1. `/admin/shield` → المفاتيح → «توليد مفتاح جديد» (أو `openssl rand -base64 32`).
2. Vercel → Environment Variables: انسخ قيمة `VC_SIGNING_KEY` الحالية إلى متغير جديد `TOKEN_SECRET_PREV`، ثم ضع المفتاح الجديد في `VC_SIGNING_KEY`.
3. أعد النشر. رموز OAuth القديمة تبقى تتحقق حتى انقضائها؛ الشهادات القديمة تتحقق بالمفتاح المتقاعد المنشور في `did.json`.
4. بعد 30 يومًا احذف `TOKEN_SECRET_PREV`. **تدوير صارم** (اشتباه تسريب): لا تضع PREV — تُبطل كل الرموز فورًا.

## متغيرات اختيارية
`NOTIFY_EMAILS` (بريد التنبيهات الأمنية؛ وإلا `ADMIN_EMAILS`) · `SECURITY_CONTACT` (بريد يظهر في security.txt) · `TOKEN_SECRET_PREV` (أثناء التدوير فقط).

## تحتاج يدًا بشرية (مرة واحدة)
- Supabase → Authentication → Attack Protection → **Leaked password protection: On**.
- 2FA على حسابات GitHub وVercel وSupabase.
- بعد أسبوع من تقارير CSP نظيفة: حوّل `Content-Security-Policy-Report-Only` إلى `Content-Security-Policy` في `next.config.js`.

## الاستجابة لحدث حرج
1. التنبيه يصل بالبريد مع رابط `/admin/shield`. 2. الأحداث → افتح الحدث (IP مُقنَّع، التفاصيل في meta). 3. إعادة استخدام رمز: التفويض أُبطل تلقائيًا؛ تواصل مع المستخدم إن لزم. 4. بلاغ ثغرة: ردّ خلال 5 أيام عمل على وسيلة التواصل المذكورة. 5. اضغط «عولج».
