-- © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
-- P62 «رسالة إلى نفسي بعد سنة — إلى مَن سأكون» (الاسم الرسمي: الرسالة المؤجَّلة للمتدرّب)
-- لا جداول جديدة: الطبعة الثانية تبني على جدول «رحلتي» portal_time_capsules (P25) بأعمدة إضافية:
--   horizon        '3m' | '6m' | '1y' | 'grad'      — متى تعود (الافتراضي سنة)
--   opened_at      لحظة فتح صاحبها لها (الفتح بيده في الصفحة لا بالكرون)
--   opened_early   فُتحت قبل موعدها (مسموح — ملكه — لكن يُوسم بصدق)
--   reply_ar / reply_media_id / replied_at  — «ردّ على نفسك القديمة»
--   chain_of       الرسالة السابقة في «سلسلة سنواتي»
--   prompt_key     بذرة السؤال · context_key الباب الذي كُتبت منه (first_day · map_sign · weave · free · chain · cohort)
--   program_id     للأفق «عند تخرّجي» ولـ«رسالة الدفعة»
--   scope          'self' (رسالتي) | 'cohort' (سطر واحد مجهول إلى دفعتي يُفتح بعد سنة من نهاية البرنامج، k ≥ 5)
-- قواعد السفر: الرسالة والردّ لا يسافران (لا مدرّب ولا جهة ولا ملف اعتماد)؛ الصوت يبقى مع صاحبه؛ الحذف فوري؛ الإدارة أعداد فقط.
-- لا كرون جديد (إشعار «اليوم تُفتح رسالتك» داخل الكرون اليومي الحالي) · لا متغيّر بيئة · لا حزم.

alter table public.portal_time_capsules
  add column if not exists horizon        text        not null default '1y',
  add column if not exists opened_at      timestamptz,
  add column if not exists opened_early   boolean     not null default false,
  add column if not exists reply_ar       text,
  add column if not exists reply_media_id uuid,
  add column if not exists replied_at     timestamptz,
  add column if not exists chain_of       bigint,
  add column if not exists prompt_key     text,
  add column if not exists context_key    text,
  add column if not exists program_id     uuid,
  add column if not exists scope          text        not null default 'self';

alter table public.portal_time_capsules drop constraint if exists portal_time_capsules_horizon_ck;
alter table public.portal_time_capsules add constraint portal_time_capsules_horizon_ck check (horizon in ('3m','6m','1y','grad'));
alter table public.portal_time_capsules drop constraint if exists portal_time_capsules_scope_ck;
alter table public.portal_time_capsules add constraint portal_time_capsules_scope_ck check (scope in ('self','cohort'));
-- سطر الدفعة قصير ومجهول (160 حرفًا كحدّ أقصى)
alter table public.portal_time_capsules drop constraint if exists portal_time_capsules_cohort_len_ck;
alter table public.portal_time_capsules add constraint portal_time_capsules_cohort_len_ck check (scope <> 'cohort' or char_length(body_ar) <= 160);
-- سطر واحد لكل خرّيج في ظرف كل برنامج
create unique index if not exists portal_time_capsules_cohort_one_idx on public.portal_time_capsules (user_id, program_id) where scope = 'cohort' and status <> 'cancelled';
-- قراءة ظرف الدفعة وإشعار «اليوم تُفتح» والعدّ الشهري في «نبض الجهة»
create index if not exists portal_time_capsules_cohort_idx on public.portal_time_capsules (program_id, scope) where scope = 'cohort';
create index if not exists portal_time_capsules_open_idx on public.portal_time_capsules (deliver_at) where opened_at is null and status <> 'cancelled';
create index if not exists portal_time_capsules_email_idx on public.portal_time_capsules (email, created_at desc);

-- الرسائل القديمة (P25): مختومة بأفق سنة من مساحة «رحلتي» — تبقى كما هي وتُفتح من الصفحة الجديدة
update public.portal_time_capsules set context_key = 'journey' where context_key is null and scope = 'self';

-- الأمان كما كان: القراءة الذاتية فقط؛ كل الكتابة عبر واجهات أَثَر بصلاحية الخدمة (لا تغيير في السياسات)

-- =====================================================================================
-- فحص تشخيصي (المتوقع: new_cols = 11 · checks = 3 · indexes = 4 · scopes_bad = 0)
select 'new_cols' as what, count(*)::text as value from information_schema.columns where table_schema = 'public' and table_name = 'portal_time_capsules' and column_name in ('horizon','opened_at','opened_early','reply_ar','reply_media_id','replied_at','chain_of','prompt_key','context_key','program_id','scope')
union all select 'checks', count(*)::text from pg_constraint where conrelid = 'public.portal_time_capsules'::regclass and conname in ('portal_time_capsules_horizon_ck','portal_time_capsules_scope_ck','portal_time_capsules_cohort_len_ck')
union all select 'indexes', count(*)::text from pg_indexes where schemaname = 'public' and tablename = 'portal_time_capsules' and indexname in ('portal_time_capsules_cohort_one_idx','portal_time_capsules_cohort_idx','portal_time_capsules_open_idx','portal_time_capsules_email_idx')
union all select 'scopes_bad', count(*)::text from public.portal_time_capsules where scope not in ('self','cohort');
