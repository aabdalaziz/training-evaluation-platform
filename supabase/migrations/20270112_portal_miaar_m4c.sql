-- © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
-- مِعيار — من أَثَر · م4-ج «هيئة التصحيح»: دور «المصحّح» المستقلّ · القراءة الثانية واتفاق المصحّحَين · اعتماد المصحّح بالمراسي · نسخ النصوص · حذف الصوت بعد 180 يومًا
-- آمن لإعادة التشغيل (idempotent). لا يحذف شيئًا ولا يغيّر تقديرات قائمة.
--
-- خيارات التسمية (قاعدة «اشرح التسمية»):
--  · RATER / «المصحّح»: الاسم الرسمي للعمل (قاعدة P13: أسماء رسمية في الإدارة) — لا «القارئ» ولا «المقيّم». legacy_role فارغ عمدًا:
--    المصحّح لا يجسر إلى ENUM القديم فلا تنفتح له صفحات الطاقم الأخرى؛ غرفة التصحيح تتحقّق من صلاحية miaar.rate عبر طبقة الأدوار الجديدة (P42).
--  · miaar_performance_ratings («القراءات»): صفّ لكل (أداء × مصحّح). reading = 1 الأولى · 2 الثانية (عمياء) · 3 التحكيم · 0 قراءة تأهيل على مرساة (لا تمسّ الأداء).
--    التقدير المعتمد يبقى human_rating على miaar_performances (ما يُصدَر إلى البطاقة) — الجدول الجديد ذاكرة الاتفاق لا بديل عنه.
--  · miaar_rater_calibration («اعتماد المصحّح»): صفّ لكل مصحّح — كابا مقابل المراسي، وعدد القراءات، وتاريخ الاعتماد أو الإعفاء المقيَّد.
--  · is_anchor / anchor_band على الأداء نفسه: «المرساة» أداءٌ صادرٌ متّفقٌ عليه يُقاس عليه المصحّح الجديد (لا نسخ له في جدول آخر حتى لا يتضاعف النص).
--  · media_purged_at: شاهد على تنفيذ الوعد (الصوت يُحذف بعد 180 يومًا، ويبقى النصّ والنسخ والتقديرات).

-- 0) حارس الترتيب
do $$
begin
  if not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'miaar_performances') then
    raise exception 'مِعيار م4-ج: شغّل هجرة م4-ب أولًا (20270109_portal_miaar_m4b.sql) — جدول miaar_performances مفقود';
  end if;
  if not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'portal_roles') then
    raise exception 'مِعيار م4-ج: شغّل هجرة P42 أولًا (20270105_portal_p42_roles.sql) — جدول portal_roles مفقود';
  end if;
end $$;

-- 1) دور «المصحّح» (RATER) — صلاحية واحدة: miaar.rate · لا جسر إلى ENUM القديم
insert into public.portal_roles (code, name_ar, name_en, scope, landing, permissions, is_staff, legacy_role, is_system, sort)
values ('RATER', 'المصحّح', 'Rater', 'platform', '/admin/miaar/rating', '{miaar.rate}', true, null, true, 56)
on conflict (code) do update set name_ar = excluded.name_ar, name_en = excluded.name_en, landing = excluded.landing, permissions = excluded.permissions, is_staff = true, legacy_role = null, active = true;

-- 2) أعمدة م4-ج على الأداء
alter table public.miaar_performances add column if not exists second_reading boolean not null default false;   -- سُحب للقراءة الثانية
alter table public.miaar_performances add column if not exists adjudication text check (adjudication in ('needed', 'done'));  -- يحتاج تحكيمًا / حُكم
alter table public.miaar_performances add column if not exists is_anchor boolean not null default false;         -- مرساة اعتماد
alter table public.miaar_performances add column if not exists anchor_band smallint check (anchor_band between 0 and 5);
alter table public.miaar_performances add column if not exists transcript_source text check (transcript_source in ('human', 'ai_draft'));
alter table public.miaar_performances add column if not exists media_purged_at timestamptz;
create index if not exists miaar_performances_expires_idx on public.miaar_performances (expires_at) where media_path is not null;
create index if not exists miaar_performances_anchor_idx on public.miaar_performances (skill) where is_anchor = true;
create index if not exists miaar_performances_adjudication_idx on public.miaar_performances (adjudication) where adjudication = 'needed';

-- 3) القراءات
create table if not exists public.miaar_performance_ratings (
  id             uuid primary key default gen_random_uuid(),
  performance_id uuid not null references public.miaar_performances(id) on delete cascade,
  rater_id       uuid not null,
  reading        smallint not null default 1 check (reading between 0 and 3),
  scores         jsonb not null,
  band           smallint not null check (band between 0 and 5),      -- الدرجة الكلّية (متوسّط الأبعاد مقرَّبًا)
  mean           numeric(4,2),
  estimated      text,
  verdict_ar     text,
  note_ar        text,
  seconds        integer,                                             -- زمن القراءة (لمرآة المصحّح)
  created_at     timestamptz not null default now(),
  unique (performance_id, rater_id)
);
create index if not exists miaar_performance_ratings_rater_idx on public.miaar_performance_ratings (rater_id, created_at desc);
create index if not exists miaar_performance_ratings_perf_idx on public.miaar_performance_ratings (performance_id, reading);
alter table public.miaar_performance_ratings enable row level security;
revoke all on public.miaar_performance_ratings from anon, authenticated;
grant all on public.miaar_performance_ratings to service_role;

-- 4) اعتماد المصحّح
create table if not exists public.miaar_rater_calibration (
  rater_id        uuid primary key,
  kappa           numeric(5,3),
  n               integer not null default 0,
  passed_at       timestamptz,
  exempt_by       uuid,
  exempt_note_ar  text,
  locked_until    timestamptz,                                        -- بعد محاولة فاشلة: 24 ساعة
  attempts        integer not null default 0,
  updated_at      timestamptz not null default now()
);
alter table public.miaar_rater_calibration enable row level security;
revoke all on public.miaar_rater_calibration from anon, authenticated;
grant all on public.miaar_rater_calibration to service_role;

-- 5) تقرير التشخيص (يظهر في Results)
select
  (select count(*) from public.portal_roles where code = 'RATER' and 'miaar.rate' = any(permissions)) as rater_role_expected_1,
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'miaar_performances' and column_name in ('second_reading','adjudication','is_anchor','anchor_band','transcript_source','media_purged_at')) as performance_columns_expected_6,
  (select count(*) from information_schema.tables where table_schema = 'public' and table_name in ('miaar_performance_ratings','miaar_rater_calibration')) as tables_expected_2,
  (select count(*) from pg_indexes where schemaname = 'public' and indexname in ('miaar_performances_expires_idx','miaar_performances_anchor_idx','miaar_performances_adjudication_idx','miaar_performance_ratings_rater_idx','miaar_performance_ratings_perf_idx')) as indexes_expected_5,
  (select count(*) from public.miaar_performances where media_path is not null and expires_at < now()) as audio_due_for_purge_now;
