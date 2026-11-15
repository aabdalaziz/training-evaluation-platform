# دليل التشغيل والتسليم — منصة تقييم البرامج التدريبية

> وثيقة مرجعية واحدة لمن يشغّل المنصة أو يتسلّمها: البنية، المسارات، الصلاحيات، المتغيرات، المهام المجدولة، قاعدة البيانات، النسخ والاستعادة، وإجراءات الطوارئ.
> آخر تحديث: 2026-11-15 (النطاق الرسمي athar-portal.com + البريد الرسمي). الدليل التفاعلي داخل المنصة: `/help`.
---

## 1) نظرة عامة

| البند | القيمة |
|---|---|
| التقنية | Next.js 14 (App Router) + Supabase (Postgres/Auth/RLS) + Vercel (استضافة + Cron) + Resend (بريد) |
| المستودع | github.com/aabdalaziz/training-evaluation-platform (الفرع `main` ينشر تلقائيًا) |
| الإنتاج | https://training-evaluation-platform.vercel.app |
| اللغة/الاتجاه | عربي RTL (مع نسخة إنجليزية لاستطلاع التعلم عن بُعد) |
| الاعتماديات | صفر مكتبات إضافية: Excel/PPTX/PDF/QR/تشفير مكتوبة يدويًا في `lib/export` و`lib/certificates` |
| الاختبارات | `npm test` → `tests/index.ts` (157 اختبارًا نقيًا بلا شبكة) |

### نموذج كيركباتريك داخل المنصة
| المستوى | ما يقيسه | أين |
|---|---|---|
| 1 رد الفعل | التقييم اليومي/الختامي، استطلاع التعلم عن بُعد | `/evaluate/daily` `/evaluate/final` `/survey/remote-learning` |
| 2 التعلم | أدوات الأثر قبل/بعد | `/admin/impact` `/impact/[token]` `/reports/impact` |
| 3 السلوك | متابعات نقل الأثر (60–90 يومًا) | `/admin/followup` `/followup/[token]` `/reports/transfer` |
| 4 النتائج | مؤشرات النتائج المؤسسية | `/admin/outcomes` `/reports/chain` |

---

## 2) خريطة المسارات

### عامة (بلا تسجيل دخول)
| المسار | الوظيفة |
|---|---|
| `/evaluate/daily` · `/evaluate/final` | استمارات التقييم (تظهر فقط البرامج غير المؤرشفة ذات قالب مفعّل) |
| `/survey/remote-learning` | استطلاع التعلم عن بُعد (عربي/إنجليزي) |
| `/attend/[token]` | تسجيل الحضور الرقمي لجلسة |
| `/impact/[token]` · `/followup/[token]` | أداة الأثر / استبيان المتابعة عبر رابط |
| `/verify` · `/verify/[code]` | التحقق من الشهادات |
| `/me` | بوابة المتدرب (OTP عبر البريد) |
| `/login` · `/forgot-password` · `/reset-password` | الدخول واستعادة كلمة المرور |

### لوحة الإدارة (`/dashboard` هي نقطة البداية وتحوي كل الروابط)
| المسار | الوظيفة | الحد الأدنى للدور |
|---|---|---|
| `/admin/management` | البرامج، القاعات، المدربون، المستويات، الاعتمادات | ADMIN / PROGRAM_MANAGER (ضمن نطاقه) |
| `/admin/templates` | قوالب التقييم والأسئلة وربطها بالبرامج | ADMIN |
| `/admin/readiness` | قائمة تحقق جاهزية كل برنامج (13 فحصًا) | موظفون |
| `/admin/attendance` | جلسات الحضور وروابطها | موظفون |
| `/admin/impact` · `/admin/followup` · `/admin/outcomes` | المستويات 2–4 | موظفون |
| `/admin/certificates` · `/admin/awards` | الشهادات وتكريم المدربين | ADMIN |
| `/admin/survey-settings` | إعدادات استطلاع التعلم عن بُعد | ADMIN |
| `/admin/notifications` | مركز التنبيهات (الجرس) | موظفون |
| `/admin/audit` | سجل التدقيق | ADMIN / QUALITY_ANALYST |
| `/admin/health` | صحة المنصة (بيئة، كرون، بريد، بيانات، آخر نسخة احتياطية) | ADMIN / QUALITY_ANALYST |
| `/admin/access` | نطاق وصول مديري البرامج | PLATFORM_ADMIN |
| `/admin/backup` | النسخ الاحتياطي (Excel/JSON)، الأرشفة، الاستعادة، السجل | ADMIN (الاستعادة: PLATFORM_ADMIN/SUPER_ADMIN) |
| `/admin/data-lifecycle` | تفريغ منضبط للبيانات التجريبية/القديمة | PLATFORM_ADMIN |
| `/help` | دليل الاستخدام التفاعلي | الجميع |

### التقارير
`/reports/center` (المركز) · `/reports/executive` · `/reports/program` (بطاقة البرنامج الشاملة) · `/reports/impact` · `/reports/transfer` · `/reports/chain` (سلسلة الأثر 1→4) · `/reports/cohorts` (الذكاء التحليلي) · `/reports/remote-survey` · `/final-analysis` · `/command-center`

### واجهات API (`app/api`)
| المسار | من يستدعيها | الحماية |
|---|---|---|
| `/api/reports/digest` | Vercel Cron الأحد 05:00 | `CRON_SECRET` |
| `/api/followups/send` | Vercel Cron يوميًا 06:00 | `CRON_SECRET` |
| `/api/notifications/scan` | يدوي/داخلي | Bearer موظف أو `CRON_SECRET` |
| `/api/reports/email` · `/api/reports/summary` · `/api/certificates/send` · `/api/sendmail` | الواجهة | Bearer مستخدم |
| `/api/impact/generate` | بانِي أدوات الأثر (AI) | Bearer مستخدم |
| `/api/admin/health` · `/api/admin/restore` · `/api/admin/purge-evaluations` | صفحات الإدارة | Bearer مستخدم + دور + مفتاح الخدمة |

---

## 3) الأدوار والصلاحيات

| الدور (`profiles.role`) | يرى | يكتب |
|---|---|---|
| `PLATFORM_ADMIN` | كل شيء | كل شيء + نطاق الوصول + الاستعادة + التفريغ |
| `SUPER_ADMIN` | كل شيء | كل شيء + الاستعادة |
| `ADMIN` | كل شيء | الإدارة، القوالب، الشهادات، النسخ/الأرشفة |
| `PROGRAM_MANAGER` | برامجه فقط (J3: `program_managers`) | برامجه فقط |
| `QUALITY_ANALYST` | كل التقارير والتدقيق والصحة | لا شيء تقريبًا |
| `TRAINER` | قراءة محدودة | — |
| زائر (anon) | البرامج غير المؤرشفة، القوالب/الأسئلة المفعّلة، التحقق من الشهادات | إدراج تقييم/استجابة/حضور عبر الروابط فقط |

- RLS مفعّل على كل الجداول. سياسات الزوار **إدراج فقط** (لا قراءة للتقييمات).
- نطاق مديري البرامج: سياسات **RESTRICTIVE** على الجداول المرتبطة بالبرنامج (`is_program_in_scope`).
- إضافة مستخدم: Supabase → Authentication → Add user، ثم صف في `profiles` (id = auth.uid، role، full_name). مستخدم بلا دور لا يستطيع الدخول للوحة (يظهر في صحة المنصة).

### 3-ب) إنشاء حسابات المنسوبين — الطريقة المعتمدة (P42-أ · مصطلحات 2026-11-15)
الجدول أعلاه هو ENUM القديم في `profiles.role`؛ الطريقة الحالية لإدخال موظف/مدرّب/خبير/مستشار/قيادة هي **الدعوة** من `/admin/roles` (لا إنشاء يدوي في Supabase إلا للطوارئ):

| المصطلح في الشاشات | المعنى | أين |
|---|---|---|
| **الدور** | ما يُسنَد للمستخدم (`portal_roles` — 17 دورًا نظاميًا + أدوار مخصّصة) | `/admin/roles` → «قائمة الأدوار» |
| **الصلاحية** | أثر الدور الفعلي (`portal_role_grants`) — تُلغى بنقرة، يبقى الحساب | `/admin/roles` → «المستخدمون والأدوار» |
| **الدعوة** | بريد + دور (حتى 5) + جهة اختيارية → رابط `/join/<token>` يُعرض مرة واحدة، صالح 14 يومًا | `/admin/roles` → «دعوة جديدة» (شخصية · جماعية بـ QR · إسناد مباشر) |
| **الصفحة الرئيسية للدور** | وجهة المستخدم بعد الدخول (`landing`: `/hub/trainer` · `/hub/leadership` …) | `/hub` = «صفحاتي» عند تعدّد الأدوار |
| **حذف الحساب** | «أن تُنسى»: مهلة تراجع 7 أيام برابط للشخص ثم تنفيذ آلي (حذف/تجهيل/إبقاء نظامي + حذف حساب الدخول + إيصال موقَّع) | `/admin/vault` → «حذف الحسابات» → «بدء الحذف» |

- دورة المدعو: يفتح الرابط → يكتب بريده نفسه → «أرسل لي رابط الدخول» (رابط لمرة واحدة من Supabase Auth؛ قد يقع في Spam أول مرة، وحدّ الإرسال نحو 2–4/ساعة للبريد الواحد) → يعود → «قبول الدعوة والدخول».
- انتهاء الارتباط: ألغِ الدور من «المستخدمون والأدوار» (المعتاد). الحذف الكامل فقط بطلب الشخص أو انتهاء مدة الاحتفاظ. `erasure_for` يجد الحساب عبر عضوية جهة أو تسجيل برنامج **أو دور مُسنَد** (منذ 2026-11-15).
- الأسماء السردية («باب»، «صفة»، «الردهة») انسحبت من شاشات الإدارة والدخول (قاعدة P13)؛ تبقى في الصفحة الرئيسية و2062 وأثير فقط.

---

## 4) متغيرات البيئة (Vercel → Settings → Environment Variables)

| المتغير | إلزامي | ما يتعطل بدونه |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | المنصة كلها |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | تسجيل الدخول وكل الصفحات |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | الكرون، البريد، التفريغ، الاستعادة، OTP بوابة المتدرب |
| `CRON_SECRET` | ✅ | التقرير الأسبوعي، المتابعات اليومية، فحص الإشعارات |
| `RESEND_API_KEY` | ✅ | كل الرسائل |
| `REPORTS_FROM_EMAIL` | — | الافتراضي في الكود `أَثَر <reports@athar-portal.com>` (نطاق متحقَّق في Resend). اضبطه فقط لتغيير المُرسِل |
| `NEXT_PUBLIC_SITE_URL` | — | على Vercel يُثبَّت من `next.config.js` (وقت البناء) ومن `instrumentation.ts` (وقت التشغيل) إلى `https://athar-portal.com` — قيمة اللوحة القديمة لا أثر لها. محليًا للـ E2E فقط |
| `SECURITY_CONTACT` | — | بريد الإفصاح المسؤول في `security.txt`؛ الافتراضي `security@athar-portal.com` |
| `AI_API_KEY` / `AI_PROVIDER` / `AI_MODEL` | — | توليد أدوات الأثر والملخص الذكي (البديل المحلي يعمل بدونها؛ المزوّد والنموذج يُكتشفان تلقائيًا) |
| `NOTIFY_EMAILS` | — | بريد تنبيهات الإدارة (الافتراضي: مديرو المنصة من `profiles`) |
| `TRAINEE_MAIL` | — | `0` لتعطيل بريد المتدربين التلقائي |
| `AUDIT_RETENTION_DAYS` | — | الافتراضي 730 |
| `PURGE_CONFIRM_CODE` | — | كلمة تأكيد التفريغ |

تغيير أي متغير يتطلب **Redeploy** (إن طلب Vercel رمز تحقّق لإجراء حسّاس ولم يتوافر: أنشئ المتغير من نوع **Config** أو ادفع commit على `main` فيُنشر تلقائيًا). صفحة `/admin/health` تعرض المضبوط/المفقود.

### 4-ب) النطاق الرسمي والبريد (منذ 2026-11-15)

| البند | القيمة | أين |
|---|---|---|
| النطاق الرسمي | `https://athar-portal.com` (الجذر) · `www` يحوّل 308 إلى الجذر · `athar.university` و`www.athar.university` يحوّلان 308 إلى الجذر مع حفظ المسار · `athar-portal.vercel.app` يبقى اسمًا بديلًا يعمل (لا يُحذف) | Vercel → Settings → Domains |
| لماذا `.com` لا `.university`/`.edu` | «جامعة» مسمّى محمي في المملكة (ترخيص وزارة التعليم)؛ `.edu` للجامعات الأمريكية فقط؛ `.com` محايد ويطابق اسم المشروع منذ البداية ويمهّد لـ `athar-portal.sa` بالاسم نفسه | قرار 2026-11-15 |
| المسجِّل / DNS | Hostinger (hpanel.hostinger.com → Domains → athar-portal.com → DNS / Nameservers) · التجديد التلقائي مفعَّل · ينتهي 2027-11-15 | A `@` → `216.198.79.1` (Vercel) · CNAME `www` → `athar-portal.com` |
| البريد الوارد | **Hostinger Business Email** (مجاني 12 شهرًا ضمن الاستضافة، ثم ≈ $1–2/صندوق شهريًا) · ثلاثة صناديق فعّالة (2026-11-15): `info@` · `reports@` · `security@` (كلٌّ 1 GB) · تحويل Active من `reports@` و`security@` إلى `info@` مع حفظ نسخة (hPanel → Emails → athar-portal.com → Forwarders) فالمتابعة من صندوق واحد · Webmail: https://mail.hostinger.com · IMAP `imap.hostinger.com:993` / SMTP `smtp.hostinger.com:465` | MX `mx1/mx2.hostinger.com` · TXT `v=spf1 include:_spf.mail.hostinger.com ~all` · DKIM `hostingermail-a/b._domainkey` · `_dmarc` = `v=DMARC1; p=none` — كلها أُضيفت تلقائيًا؛ **لا تُحذف** |
| البريد الصادر (المنصة) | Resend → Domains → athar-portal.com = **Verified** (Tokyo) · المُرسِل الافتراضي `أَثَر <reports@athar-portal.com>` في `lib/portal/notify.ts` | TXT `resend._domainkey` · CNAME `rsend` · CNAME `send` (الإرسال عبر النطاق الفرعي `send` فلا يتعارض مع SPF الجذر الخاص بـ Hostinger) |
| عناوين الهوية | `info@` تواصل عام (`CONTACT.email` في `lib/portal/content.ts`) · `reports@` مُرسِل المنصة · `security@` الإفصاح المسؤول (`security.txt`، يغلبه المتغير `SECURITY_CONTACT`) | — |
| رسائل الدخول (Supabase Auth) | منذ 2026-11-15: **Custom SMTP عبر Resend** — Host `smtp.resend.com` · Port 465 · User `resend` · Password = مفتاح Resend «Sending access» (`supabase-auth-smtp`) · Sender `أَثَر <reports@athar-portal.com>` · حدّ الإرسال 30 رسالة/ساعة (Authentication → Rate Limits) · القالبان **Magic Link** و**Confirm sign up** عربيان بعنوان «رابط دخولك إلى أَثَر» (Authentication → Emails → Templates). قبلها: بريد Supabase الافتراضي الإنجليزي بحدّ رسالتين/ساعة | لوحة Supabase فقط — لا متغيرات Vercel |
| ثبات النطاق في الكود | طبقتان: (1) `next.config.js` يثبّت `NEXT_PUBLIC_SITE_URL = https://athar-portal.com` داخل الحزم وقت البناء؛ (2) `instrumentation.ts` (خطّاف `register` على Vercel) يصحّح القيمة الحيّة في `process.env` عند إقلاع كل دالة — لأن دوالًا مثل `securityTxt` و`channelEnv` تستلم كائن البيئة كاملًا. محليًا يبقى المتغير لاختبارات E2E | `CANONICAL_SITE` · `resolveSiteEnv` |
| الظهور في البحث («بوابة الأثر») | `app/layout.tsx`: العنوان الرئيسي يحوي «بوابة الأثر»؛ JSON-LD (`Organization` + `WebSite`) يعلن الأسماء البديلة: بوابة الأثر · بوابة أثر · منصة أثر · Athar Portal. خارج الكود: Google Search Console — خاصية Domain `athar-portal.com` موثَّقة بسجل TXT في Hostinger + إرسال `sitemap.xml` + طلب فهرسة `/`. سجل TXT يبقى دائمًا (حذفه يُلغي التوثيق) | `siteJsonLd` · `SITE_ALT_NAMES` |
| هويّة التوقيع | `did:web:athar-portal.com` (تُشتقّ من النطاق) · الشهادات الصادرة قبل 2026-11-15 بهويّة `did:web:athar-portal.vercel.app` أو `did:web:athar.university` تبقى قابلة للتحقّق لأن الاسمين البديلين يبقيان على Vercel | لا تحذف الأسماء البديلة |
| تجديد | النطاقان (`athar-portal.com` · `athar.university`) كل **نوفمبر** — التجديد التلقائي مفعَّل، ثبّت بطاقة سارية · بريد Hostinger يتحوّل إلى مدفوع في **نوفمبر 2027** · ضع تذكيرًا قبل 30 يومًا | انقطاع النطاق = توقّف الموقع والبريد والتحقّق معًا |
| `robots.txt` / `sitemap.xml` | يُولَّدان من `app/robots.ts` و`app/sitemap.ts`؛ الصفحات العامّة فقط، وكل ما يُفتح برمز خارج الفهرسة | — |
| Supabase Auth | Site URL = `https://athar-portal.com` · Redirect URLs تشمل `https://athar-portal.com/**` و`https://www.athar-portal.com/**` (والقديمة باقية) | Authentication → URL Configuration |
| لاحقًا | `athar-portal.sa` عبر مسجِّل سعودي (يحتاج السجل التجاري) → يحوّل 308 إلى `.com` بالاسم نفسه — لا ازدواجية | راجع BACKLOG |
---

## 5) المهام المجدولة (`vercel.json` — حد الخطة المجانية: مهمتان)

| المهمة | التوقيت (UTC) | ماذا تفعل |
|---|---|---|
| `/api/followups/send` | يوميًا 06:00 | إرسال استبيانات المتابعة المستحقة · `notifications_scan` (8 قواعد تنبيه) · بريد المتدربين التلقائي · فحص صحة المنصة ومزامنة تنبيهات الجرس (بما فيها «آخر نسخة احتياطية > 30 يومًا») · نبضة `cron_heartbeat` |
| `/api/reports/digest` | الأحد 05:00 | التقرير الدوري للمشتركين · ملخص الذكاء التحليلي · تنظيف سجل التدقيق (`AUDIT_RETENTION_DAYS`) |

التحقق من عملها: `/admin/health` → مجموعة «المهام المجدولة» (آخر نبضة). تشغيل يدوي: Vercel → Cron Jobs → Run.

---

## 6) قاعدة البيانات

### ملفات SQL بترتيب التنفيذ (كلها آمنة لإعادة التشغيل)
| # | الملف | المحتوى |
|---|---|---|
| 1 | `phase1/17-audit-logs.sql` | جدول التدقيق الأساسي |
| 2 | `phase2/29-program_profile.sql` | ملف البرنامج (أهداف/مخرجات/فئة) |
| 3 | `phase4-ab/40-SQL-email-and-approvals.sql` | الاعتمادات، اشتراكات التقارير |
| 4 | `supabase/migrations/20261020_remote_learning_survey.sql` | استطلاع التعلم عن بُعد |
| 5 | `…20261023_certificates_and_awards.sql` (+ `50b-HOTFIX`) | الشهادات والتكريم |
| 6 | `…20261024_impact_assessments.sql` | أدوات الأثر |
| 7 | `…20261026_attendance.sql` | الحضور الرقمي |
| 8 | `…20261027_behavior_followups.sql` | متابعات نقل الأثر |
| 9 | `…20261028_me_portal_notifications.sql` | بوابة المتدرب + التنبيهات + `notifications_scan` |
| 10 | `…20261029_outcomes.sql` · `…20261030_trainee_mail_log.sql` | المستوى 4 + سجل بريد المتدربين |
| 11 | `…20261031_audit_trail.sql` (+ `193b`) | محفّزات التدقيق على 20 جدولًا |
| 12 | `…20261101_program_scoped_access.sql` | نطاق مديري البرامج |
| 13 | `phase5-j/222–229` | إصلاحات القوالب/التقييمات (ربط تلقائي، حارس النطاق، الأعمدة المطلوبة، respondent_hash) |
| 14 | `…20261102_templates_admin.sql` | صلاحيات تحرير القوالب + حرّاس الحذف |
| 15 | `…20261103_archive_backup.sql` | الأرشفة + `backup_log` + سياسة الزوار |
| … | (مراحل البوابة P1–P68: `supabase/migrations/2026*–2027*` + `supabase/p6x-*.sql`) | انظر وثائق كل مرحلة |
| 2026-11-08 | `supabase/p49d-end-survey-v2.sql` ثم `supabase/p49d2-link-guard.sql` | الاستبيان الختامي الشامل (53 بندًا) + حارس `evaluations_scope_guard` يقبل القالب الافتراضي ويربطه تلقائيًا + حارس جدول الربط v2 (القالب الافتراضي محايد المؤسسة). نُفِّذا في الإنتاج: `1·53·47·7·4·1·0·0·1` و`unlinked_programs = 0` |
| 2026-11-08 | `supabase/p49e-pulse.sql` | P49-هـ: جدول `end_survey_actions` (مهامّ «بند الأسبوع» · k≥5 · إغلاق بملاحظة) + 3 سياسات + قيد مهمّة مفتوحة واحدة لكل (دفعة × بند) | `table=1 · policies=3 · open_uidx=1` |

### الجداول الرئيسية
`programs` (مع `archived_at`) · `program_levels` · `program_approvals` · `program_managers` · `trainers` · `classrooms` · `class_schedules` · `evaluation_templates` · `questions` · `program_evaluation_templates` · `evaluations` · `evaluation_answers` · `attendance_sessions` · `attendance_records` · `certificates` · `certificate_settings` · `trainer_awards` · `impact_assessments` · `impact_questions` · `impact_responses` · `behavior_followups` · `behavior_questions` · `behavior_responses` · `outcome_kpis` · `outcome_measurements` · `remote_learning_survey_responses` · `report_subscriptions` · `notifications` · `notification_runs` · `trainee_mail_log` · `audit_logs` · `backup_log` · `profiles`

### قواعد مهمة
- الأعمدة التي قد تكون **enum** (`profiles.role`, `evaluation_templates.kind`, `evaluations.kind`) تُقارَن عبر `upper(x::text)`.
- `create or replace function` لا يغيّر نوع الإرجاع → `drop function … cascade` أولًا.
- الدوال الجديدة تُمنح تلقائيًا لـ anon/authenticated → `revoke` للدوال الخدمية.
- محرّر SQL يعرض نتيجة **آخر** جملة فقط → اجمع التشخيص في استعلام `union all` واحد.
- **حرّاس المنصّة الأصلية** (phase5-j وما قبلها) ما زالوا يعملون في قاعدة الإنتاج ولا يظهرون في المستودع: `evaluations_scope_guard` على `evaluations`، `program_templates_scope_guard` على `program_evaluation_templates`، `trg_audit_*`. قبل أيّ ميزة تُدرج في هذه الجداول: `select tgname from pg_trigger where tgrelid = 'public.<table>'::regclass and not tgisinternal;` — وعند تعديل حارس: دالة جديدة بالقاعدة نفسها + استثناء موثَّق، وإعادة توجيه التريغر دون حذف الدالة القديمة (P49-د).

---

## 7) النسخ الاحتياطي والاستعادة والأرشفة (`/admin/backup`)

**الإيقاع الموصى به:** نسخة JSON شهريًا على الأقل (تنبيه تلقائي بعد 30 يومًا) + نسخة قبل أي تفريغ أو استعادة أو تغيير SQL كبير. احفظ الملفات خارج المنصة (Drive/OneDrive مؤسسي).

| العملية | كيف | ملاحظات |
|---|---|---|
| نسخة Excel | النطاق → «Excel» | ورقة الفهرس + «الإجابات المفكوكة» + ورقة لكل جدول غير فارغ؛ بلا أعمدة حساسة |
| نسخة JSON | النطاق → «JSON» | كاملة (27 جدولًا) وصالحة للاستعادة |
| الاستعادة | «الاستعادة» → رفع JSON → «فحص بلا تغيير» → اكتب «استعادة» → تنفيذ | إضافة الناقص (افتراضي) أو استبدال المطابق؛ لا حذف؛ دفعات 400 صف؛ تُسجَّل في التدقيق |
| الأرشفة | «الأرشفة» → أرشفة/إلغاء | المؤرشف يختفي من الاستمارات والجاهزية ويبقى في التقارير |
| التفريغ | `/admin/data-lifecycle` | لا رجعة — خذ نسخة أولًا |

نسخة Supabase نفسها: Database → Backups (يومية في الخطط المدفوعة). للمشاريع المجانية اعتمد على JSON المنصة.

**الاستعادة على مشروع Supabase جديد:** 1) نفّذ ملفات SQL بالترتيب (القسم 6) · 2) أنشئ المستخدمين و`profiles` · 3) اضبط متغيرات Vercel على المشروع الجديد · 4) `/admin/backup` → الاستعادة → «إضافة الناقص».

---

## 8) إجراءات الطوارئ

| العرض | التشخيص | العلاج |
|---|---|---|
| «لا يوجد قالب تقييم مفعّل لهذا البرنامج» | `/admin/readiness` → بند القوالب | `/admin/templates` → اربط قالبًا يوميًا/ختاميًا بالبرنامج |
| المشارك لا يجد قاعته | القاعة على برنامج آخر أو غير موجودة | `/admin/management?tab=rooms` |
| لا تصل رسائل | `/admin/health` → البريد | `RESEND_API_KEY` موجود؟ · نطاق `athar-portal.com` ما زال Verified في Resend؟ (سجلّات DKIM/CNAME في Hostinger لم تُحذف) · إن ضُبط `REPORTS_FROM_EMAIL` يدويًا فليكن على النطاق نفسه |
| الكرون متوقف | `/admin/health` → المهام المجدولة | Vercel → Cron Jobs → تأكد من التفعيل و`CRON_SECRET` |
| فشل النشر خلال ~10 ثوانٍ | خطأ أنواع (ملف مستورد ناقص) | راجع آخر ملف مُلصَق؛ قارن بالمرجع |
| «Deployment rate limited» | حد 100 نشر/يوم (Hobby) | انتظر 24 ساعة ثم Redeploy لآخر كومِت |
| مستخدم لا يدخل اللوحة | `profiles.role` فارغ | عيّن الدور |
| حُذفت بيانات بالخطأ | — | الاستعادة من آخر JSON بوضع «إضافة الناقص» |
| ضغط/بطء | `/admin/health` → زمن الاستجابة | راجع Supabase → Reports؛ أرشف البرامج القديمة |

---

## 9) النشر والتطوير

- **التدفق:** تعديل في `main` → نشر تلقائي على Vercel (≈2–3 دقائق). كل ملف يُستبدل كاملًا ويُقارَن بالمرجع بعد الدفع.
- **محليًا:** `npm install` → `npm run dev` مع `.env.local` (المتغيرات أعلاه) · `npm test` · `npx tsc --noEmit` · `npm run build`.
- **قواعد الكود:** صفر اعتماديات جديدة · منطق نقي في `lib/*/model.ts` مع اختبارات · صفحات العميل تحمي نفسها بالدور · أنماط لكل صفحة ببادئة (`.bk`, `.rd`, `.hp` …) · لا تعدّل `tsconfig.json`/`next-env.d.ts`.
- **نظام الألوان:** كحلي `#0f2a4e` · أخضر مزرق `#0b8a83` · ذهبي `#c9a24b`.

## 10) قائمة التسليم
- [ ] متغيرات Vercel مضبوطة و`/admin/health` أخضر
- [ ] مديرو المنصة لديهم أدوار في `profiles`
- [ ] مهمتا الكرون مفعّلتان ونبضاتهما حديثة
- [ ] نسخة JSON محفوظة خارج المنصة وتاريخها مسجّل في `/admin/backup`
- [ ] البرامج المنتهية مؤرشفة
- [ ] التجديد التلقائي للنطاقين `athar-portal.com` و`athar.university` مفعّل في Hostinger وبطاقة الدفع سارية
- [x] `athar-portal.com` بحالة Verified في Resend · صناديق `info@` · `reports@` · `security@` تستقبل، والتحويل إلى `info@` Active (2026-11-15)
- [x] رسائل الدخول باسم أَثَر من `reports@` عبر Resend SMTP + قوالب عربية · تجربة الدورة الكاملة (دعوة «المدرّب» → قبول → إلغاء) ناجحة (2026-11-15)
- [x] Google Search Console: خاصية Domain موثَّقة (TXT) · `sitemap.xml` = 12 صفحة · طُلبت فهرسة `/` `/programs` `/miaar` `/about` `/contact` (2026-11-15)
- [ ] هذه الوثيقة محدّثة بتاريخ آخر مرحلة
