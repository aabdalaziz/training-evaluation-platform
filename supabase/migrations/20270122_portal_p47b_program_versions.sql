-- © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
-- =====================================================================================
--  P47-ب — «نسخة الدفعة» (الرسمي: إصدار نسخة البرنامج بعد المراجعة المعتمَدة)
--  الفكرة: المراجعة المعتمَدة (P47-أ) لا تبقى ورقة؛ ما قبله الإنسان من تعديلات يُطبَّق على وحدات البرنامج كنسخة جديدة
--  مفتوحة للدفعة القادمة، والوحدات القديمة تُؤرشَف لا تُحذف (تقارير الوحدات المعتمَدة تبقى تشير إليها).
--   1) portal_program_versions: صفّ لكل نسخة — قبل/بعد (وحدات · كفايات · ساعات) · التعديلات وقرارها · ما طُبِّق آليًا
--      وما يحتاج يدًا · «رسالة إلى الدفعة القادمة» (≤ 300 حرفًا يكتبها المصمّم ويراها متدرّبو الدفعة التالية).
--   2) portal_program_units: archived_at + version · قيد الفرادة (program_id, idx) يصبح جزئيًّا على غير المؤرشَفة
--      · قيد idx يُوسَّع (1..999) لأن حفظ الوحدات يرقّمها مؤقتًا من 100 فأعلى.
--  آمن لإعادة التنفيذ (idempotent).
-- =====================================================================================

-- 1) جدول النسخ
create table if not exists public.portal_program_versions (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  program_id   uuid not null references public.programs(id) on delete cascade,
  version      int  not null check (version between 2 and 999),
  review_id    uuid references public.portal_reports(id) on delete set null,
  review_code  text,
  cohort_no    int  not null default 1,
  created_by   uuid,
  created_name text,
  before       jsonb not null default '{}'::jsonb,
  after        jsonb not null default '{}'::jsonb,
  changes      jsonb not null default '[]'::jsonb,
  applied      jsonb not null default '[]'::jsonb,
  manual       jsonb not null default '[]'::jsonb,
  message_ar   text,
  unique (program_id, version)
);
create index if not exists portal_program_versions_program_idx on public.portal_program_versions (program_id, version desc);
alter table public.portal_program_versions enable row level security;
drop policy if exists portal_program_versions_read on public.portal_program_versions;
create policy portal_program_versions_read on public.portal_program_versions for select to anon, authenticated using (true);   -- سجلّ النسخ عام (الكود يُخفي الأسماء في العرض العام)
revoke insert, update, delete on public.portal_program_versions from anon, authenticated;   -- الكتابة من الخادم فقط

-- 2) الوحدات: أرشفة + رقم النسخة
alter table public.portal_program_units add column if not exists archived_at timestamptz;
alter table public.portal_program_units add column if not exists version int not null default 1;
create index if not exists portal_program_units_live_idx on public.portal_program_units (program_id) where archived_at is null;

-- 2-أ) قيد الفرادة (program_id, idx) → فهرس فريد جزئي على الوحدات الحيّة فقط (اسم القيد قد يختلف — يُكتشف ديناميكيًّا)
do $$
declare c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public' and rel.relname = 'portal_program_units' and con.contype = 'u'
      and (select array_agg(att.attname::text order by att.attname) from pg_attribute att where att.attrelid = rel.oid and att.attnum = any(con.conkey)) = array['idx','program_id']
  loop
    execute format('alter table public.portal_program_units drop constraint %I', c.conname);
  end loop;
end $$;
create unique index if not exists portal_program_units_live_uq on public.portal_program_units (program_id, idx) where archived_at is null;

-- 2-ب) قيد idx: 1..40 → 1..999 (الترقيم المؤقت أثناء الحفظ)
do $$
declare c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public' and rel.relname = 'portal_program_units' and con.contype = 'c'
      and (pg_get_constraintdef(con.oid) ilike '%(idx >= 1)%' or pg_get_constraintdef(con.oid) ilike '%idx between%')   -- بوستجرس يعيد كتابة BETWEEN كـ (idx >= 1) AND (idx <= 40)
  loop
    execute format('alter table public.portal_program_units drop constraint %I', c.conname);
  end loop;
end $$;
alter table public.portal_program_units drop constraint if exists portal_program_units_idx_chk;
alter table public.portal_program_units add constraint portal_program_units_idx_chk check (idx between 1 and 999);

-- =====================================================================================
--  تشخيص — المتوقَّع: versions_table_1 = 1 · unit_cols_2 = 2 · live_uq_1 = 1 · old_unique_0 = 0 · idx_chk_1 = 1 · versions_0 = 0 · live_units = عدد وحدات الدبلوم التجريبي (3 إن طُبِّق P47)
-- =====================================================================================
select
  (select count(*) from information_schema.tables where table_schema = 'public' and table_name = 'portal_program_versions') as versions_table_1,
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'portal_program_units' and column_name in ('archived_at','version')) as unit_cols_2,
  (select count(*) from pg_indexes where schemaname = 'public' and indexname = 'portal_program_units_live_uq') as live_uq_1,
  (select count(*) from pg_constraint con join pg_class rel on rel.oid = con.conrelid where rel.relname = 'portal_program_units' and con.contype = 'u') as old_unique_0,
  (select count(*) from pg_constraint where conname = 'portal_program_units_idx_chk' and pg_get_constraintdef(oid) ilike '%999%') as idx_chk_1,
  (select count(*) from public.portal_program_versions) as versions_0,
  (select count(*) from public.portal_program_units where archived_at is null) as live_units;
