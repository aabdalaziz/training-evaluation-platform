-- © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
-- مِعيار — من أَثَر · م5-ب «النموّ والمقارنة»: شهادة النموّ على التقرير · «ختم النموّ» باختيار صاحبه · فهارس أذون «نهاية البرنامج»
-- آمن لإعادة التشغيل (idempotent). لا يحذف شيئًا ولا يغيّر نتائج قائمة. لا جدول جديد.
--
-- خيارات التسمية (قاعدة «اشرح التسمية»):
--  · growth_vc_code على placement_reports: الشهادة تُعرَف من التقرير الذي أُصدرت له (الاختبار الثاني) — فلا نحتاج جدولًا وسيطًا،
--    والوثيقة الموقَّعة نفسها تعيش في portal_vc_issuances (بنية P17) ويُتحقَّق منها على /verify/vc بالرمز ATH-G-XXXX-XXXX.
--  · growth_public («ختم النموّ»): اختيارٌ صريح من حامل الرمز لإظهار نموّه رقمًا مجهولًا في «نبض مِعيار» — افتراضيًّا false (الخصوصية أولًا).
--  · لا عمود جديد لأذون «نهاية البرنامج»: نستعمل kind = 'program_end' + program_id القائمين من م5-أ، ونزيد فهرسًا فقط.

-- 0) حارس الترتيب
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'placement_reports' and column_name = 'previous_report_id') then
    raise exception 'مِعيار م5-ب: شغّل هجرة م5-أ أولًا (20270110_portal_miaar_m5a.sql) — عمود previous_report_id مفقود';
  end if;
  if not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'portal_vc_issuances') then
    raise exception 'مِعيار م5-ب: جدول portal_vc_issuances مفقود — شغّل هجرة P17 (الشهادات الرقمية) أولًا';
  end if;
end $$;

-- 1) شهادة النموّ و«ختم النموّ» على التقرير
alter table public.placement_reports add column if not exists growth_vc_code text;
alter table public.placement_reports add column if not exists growth_vc_at timestamptz;
alter table public.placement_reports add column if not exists growth_public boolean not null default false;
create unique index if not exists placement_reports_growth_vc_idx on public.placement_reports (growth_vc_code) where growth_vc_code is not null;
create index if not exists placement_reports_growth_public_idx on public.placement_reports (growth_public) where growth_public = true;
create index if not exists placement_reports_email_created_idx on public.placement_reports (lower(candidate_email), created_at);

-- 2) أذون «نهاية البرنامج» (kind = 'program_end' من م5-أ): فهرس للبحث بالبرنامج
create index if not exists test_retake_approvals_program_kind_idx on public.test_retake_approvals (program_id, kind) where program_id is not null;

-- 3) إصدارات الشهادات: البريد للبحث عن شهادات متقدّم مِعيار (بلا حساب)
create index if not exists portal_vc_issuances_email_idx on public.portal_vc_issuances (lower(email)) where email is not null;

-- 4) تقرير التشخيص (يظهر في Results)
select
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'placement_reports' and column_name in ('growth_vc_code','growth_vc_at','growth_public')) as report_cols_expected_3,
  (select count(*) from pg_indexes where schemaname = 'public' and indexname in ('placement_reports_growth_vc_idx','placement_reports_growth_public_idx','placement_reports_email_created_idx','test_retake_approvals_program_kind_idx','portal_vc_issuances_email_idx')) as indexes_expected_5,
  (select count(*) from public.placement_reports where growth_public) as growth_public_now_expected_0,
  (select count(*) from public.placement_reports where growth_vc_code is not null) as growth_certificates_now_expected_0,
  (select count(*) from public.test_retake_approvals where kind = 'program_end') as program_end_grants_now;
