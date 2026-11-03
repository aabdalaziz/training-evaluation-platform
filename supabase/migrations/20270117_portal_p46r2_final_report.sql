-- © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
-- =====================================================================================
--  P46 ر2 «محور التقارير» — التقرير الختامي لأداء المتدرّبين («خاتمة الرحلة»)
--  لا جداول جديدة: التقرير الختامي صفٌّ في portal_reports بنوع kind = 'final'، ينمو من التقارير الأسبوعية المعتمدة
--  للشعبة نفسها (مسارات المتدرّبين تُحسب وتُحفظ في computed.trajectory). و«سطر لك» الختامي صفٌّ في portal_report_lines
--  بنوع kind = 'final' يحمل مسار المتدرّب (data) ورمز تحقّق التقرير، ويختار المتدرّب إظهاره في شهادته (show_on_credential).
--  آمن لإعادة التشغيل (idempotent).
-- =====================================================================================

-- 1) «سطر لك» يعرف نوعه ويحمل مسار صاحبه
alter table public.portal_report_lines add column if not exists kind               text    not null default 'weekly';
alter table public.portal_report_lines add column if not exists data               jsonb   not null default '{}'::jsonb;   -- مسار المتدرّب: المهارات أسبوعًا بأسبوع · الفرق · الحضور · التقدير الختامي
alter table public.portal_report_lines add column if not exists verify_code        text    null;                            -- رمز تحقّق التقرير الذي صدر منه السطر
alter table public.portal_report_lines add column if not exists show_on_credential boolean not null default false;         -- بإذن المتدرّب فقط (خاص افتراضيًا — P8)
alter table public.portal_report_lines drop constraint if exists portal_report_lines_kind_chk;
alter table public.portal_report_lines add constraint portal_report_lines_kind_chk check (kind in ('weekly','final','mission'));
create index if not exists portal_report_lines_kind_idx on public.portal_report_lines (kind, program_id, lower(email));

-- 2) فهرس «نضج التقرير»: الأسبوعيات المعتمدة لكل شعبة
create index if not exists portal_reports_final_src_idx on public.portal_reports (kind, status, program_id, coalesce(classroom_id::text, ''), period_from);

-- =====================================================================================
--  تشخيص — المتوقَّع: cols_4 = 4 · kind_chk_1 = 1 · final_idx_1 = 1 · final_reports_0 = 0
-- =====================================================================================
select
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'portal_report_lines' and column_name in ('kind','data','verify_code','show_on_credential')) as cols_4,
  (select count(*) from pg_constraint where conname = 'portal_report_lines_kind_chk') as kind_chk_1,
  (select count(*) from pg_indexes where schemaname = 'public' and indexname = 'portal_reports_final_src_idx') as final_idx_1,
  (select count(*) from public.portal_reports where kind = 'final') as final_reports_0;
