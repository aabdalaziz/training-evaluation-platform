# دليل التشغيل والتسليم — منصة تقييم البرامج التدريبية

> وثيقة مرجعية واحدة لمن يشغّل المنصة أو يتسلّمها: البنية، المسارات، الصلاحيات، المتغيرات، المهام المجدولة، قاعدة البيانات، النسخ والاستعادة، وإجراءات الطوارئ.
> آخر تحديث: 2026-11-03 (بعد المرحلة L1). الدليل التفاعلي داخل المنصة: `/help`.

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

---

## 4) متغيرات البيئة (Vercel → Settings → Environment Variables)

| المتغير | إلزامي | ما يتعطل بدونه |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | المنصة كلها |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | تسجيل الدخول وكل الصفحات |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | الكرون، البريد، التفريغ، الاستعادة، OTP بوابة المتدرب |
| `CRON_SECRET` | ✅ | التقرير الأسبوعي، المتابعات اليومية، فحص الإشعارات |
| `RESEND_API_KEY` | ✅ | كل الرسائل |
| `REPORTS_FROM_EMAIL` | ✅ | إرسال البريد (مُرسِل معتمد في Resend) |
| `NEXT_PUBLIC_SITE_URL` | — | روابط البريد تشير للنطاق الرسمي |
| `AI_API_KEY` / `AI_PROVIDER` / `AI_MODEL` | — | توليد أدوات الأثر والملخص الذكي (البديل المحلي يعمل بدونها؛ المزوّد والنموذج يُكتشفان تلقائيًا) |
| `NOTIFY_EMAILS` | — | بريد تنبيهات الإدارة (الافتراضي: مديرو المنصة من `profiles`) |
| `TRAINEE_MAIL` | — | `0` لتعطيل بريد المتدربين التلقائي |
| `AUDIT_RETENTION_DAYS` | — | الافتراضي 730 |
| `PURGE_CONFIRM_CODE` | — | كلمة تأكيد التفريغ |

تغيير أي متغير يتطلب **Redeploy**. صفحة `/admin/health` تعرض المضبوط/المفقود.

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

### الجداول الرئيسية
`programs` (مع `archived_at`) · `program_levels` · `program_approvals` · `program_managers` · `trainers` · `classrooms` · `class_schedules` · `evaluation_templates` · `questions` · `program_evaluation_templates` · `evaluations` · `evaluation_answers` · `attendance_sessions` · `attendance_records` · `certificates` · `certificate_settings` · `trainer_awards` · `impact_assessments` · `impact_questions` · `impact_responses` · `behavior_followups` · `behavior_questions` · `behavior_responses` · `outcome_kpis` · `outcome_measurements` · `remote_learning_survey_responses` · `report_subscriptions` · `notifications` · `notification_runs` · `trainee_mail_log` · `audit_logs` · `backup_log` · `profiles`

### قواعد مهمة
- الأعمدة التي قد تكون **enum** (`profiles.role`, `evaluation_templates.kind`, `evaluations.kind`) تُقارَن عبر `upper(x::text)`.
- `create or replace function` لا يغيّر نوع الإرجاع → `drop function … cascade` أولًا.
- الدوال الجديدة تُمنح تلقائيًا لـ anon/authenticated → `revoke` للدوال الخدمية.
- محرّر SQL يعرض نتيجة **آخر** جملة فقط → اجمع التشخيص في استعلام `union all` واحد.

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
| لا تصل رسائل | `/admin/health` → البريد | `RESEND_API_KEY` و`REPORTS_FROM_EMAIL` (نطاق معتمد في Resend) → Redeploy |
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
- [ ] هذه الوثيقة محدّثة بتاريخ آخر مرحلة
