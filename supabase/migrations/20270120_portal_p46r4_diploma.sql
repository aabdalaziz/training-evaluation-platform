-- © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
-- =====================================================================================
--  أَثَر — P46 «محور التقارير» ر4-أ: «ملف الدبلوم» (وحدات الدبلوم · نبض الأسبوع · تقرير الوحدة) — «أثرُ الدبلوم»
--  جدول جديد واحد (وحدات الدبلوم) + عمودان في portal_reports + فهارس. آمنة للتكرار.
--  التشخيص المتوقَّع: units_table_1 = 1 · cols_2 = 2 · idx_3 = 3 · lines_chk_1 = 1 · diploma_reports_0 = 0
-- =====================================================================================

-- 1) وحدات الدبلوم — السجلّ الصغير الذي يحتاجه كل شيء (الوحدة = وحدة الحكم التعليمي)
create table if not exists public.portal_program_units (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  program_id   uuid not null references public.programs(id) on delete cascade,
  idx          int  not null check (idx between 1 and 40),
  title_ar     text not null,
  outcome_ar   text not null default '',                       -- ناتج الوحدة بفعل قابل للملاحظة
  hours        numeric(6,1) not null default 0,                -- الساعات المخطَّطة
  skill_codes  text[] not null default '{}',                   -- رموز مهارات قالب البرنامج التي تستهدفها الوحدة
  starts_on    date,
  ends_on      date,
  closed_at    timestamptz,                                    -- تُغلق باعتماد «تقرير الوحدة» فقط
  closed_report_id uuid,                                       -- تقرير الوحدة الذي أغلقها
  source       text not null default 'manual' check (source in ('manual','design')),
  created_by   uuid,
  unique (program_id, idx)
);
create index if not exists portal_program_units_program_idx on public.portal_program_units (program_id, idx);
alter table public.portal_program_units enable row level security;
drop policy if exists portal_program_units_read on public.portal_program_units;
create policy portal_program_units_read on public.portal_program_units for select to anon, authenticated using (true);   -- عناوين الوحدات ونواتجها وعدٌ عام في صفحة البرنامج
revoke insert, update, delete on public.portal_program_units from anon, authenticated;        -- الكتابة من الخادم فقط

-- 2) portal_reports: الوحدة (لتقرير الوحدة والنبض الجاري) + صاحب كشف الكفايات (ر4-ب)
alter table public.portal_reports add column if not exists unit_id uuid references public.portal_program_units(id) on delete set null;
alter table public.portal_reports add column if not exists subject_email text;

-- تقرير وحدة واحد لكل (وحدة، شعبة) — الشعبة الفارغة تُمثَّل بمعرّف الوحدة نفسه
create unique index if not exists portal_reports_unit_idx on public.portal_reports (unit_id, coalesce(classroom_id, unit_id)) where kind = 'diploma_unit' and unit_id is not null;
-- نبض واحد لكل (برنامج، شعبة، أسبوع)
create unique index if not exists portal_reports_pulse_idx on public.portal_reports (program_id, coalesce(classroom_id, program_id), period_from) where kind = 'diploma_pulse' and program_id is not null;
-- كشف كفايات واحد غير منسوخ لكل (برنامج، متدرّب) — يُستعمل في ر4-ب
create unique index if not exists portal_reports_profile_idx on public.portal_reports (program_id, lower(subject_email)) where kind = 'diploma_profile' and subject_email is not null and (body->'superseded_by') is null;

-- 3) «سطر لك من تقرير الوحدة»: قيد نوع السطر يتّسع لتقرير الوحدة (وكشف الكفايات في ر4-ب)
alter table public.portal_report_lines drop constraint if exists portal_report_lines_kind_chk;
alter table public.portal_report_lines add constraint portal_report_lines_kind_chk check (kind in ('weekly','final','mission','diploma_unit','diploma_profile'));

-- =====================================================================================
--  تشخيص — المتوقَّع: units_table_1 = 1 · cols_2 = 2 · idx_3 = 3 · lines_chk_1 = 1 · diploma_reports_0 = 0
-- =====================================================================================
select
  (select count(*) from information_schema.tables where table_schema = 'public' and table_name = 'portal_program_units') as units_table_1,
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'portal_reports' and column_name in ('unit_id','subject_email')) as cols_2,
  (select count(*) from pg_indexes where schemaname = 'public' and indexname in ('portal_reports_unit_idx','portal_reports_pulse_idx','portal_reports_profile_idx')) as idx_3,
  (select count(*) from pg_constraint where conname = 'portal_report_lines_kind_chk' and pg_get_constraintdef(oid) ilike '%diploma_unit%') as lines_chk_1,
  (select count(*) from public.portal_reports where kind in ('diploma_pulse','diploma_unit','diploma_profile')) as diploma_reports_0;
