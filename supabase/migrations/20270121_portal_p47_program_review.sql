-- © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
-- =====================================================================================
--  P47-أ — «البرنامج الذي يراجع نفسه» (الرسمي: مراجعة البرنامج بعد الدفعة)
--  لا جدول جديد في هذه الدفعة — المراجعة سجلّ في portal_reports بنوع 'program_review':
--   computed = الوعد (وحدات/هندسة/قالب) · ما ثبت (من المعتمَد فقط) · الفجوات بدرجاتها · المراجعات السابقة
--   body     = الاقتراحات (محلية أو من الذكاء بعد تنقية) · قرار الإنسان على كلٍّ (أقبل · أعدّل · أرفض) · «ما لا تراه الأرقام»
--   week_no  = رقم الدفعة (cohort_no) · classroom_id = الشعبة/الدفعة
--  1) قيد kind يُوسَّع ليضمّ program_review (بنفس الطريقة الآمنة في ر3-ب)
--  2) فهرس جزئي للقراءة العامة: المراجعات المعتمَدة لكل برنامج («هذا البرنامج تغيّر N مرة»)
--  نسخة الدفعة (portal_program_versions) تأتي في P47-ب.
--  آمنة للتكرار. التشخيص المتوقَّع: kind_chk_ok = 1 · review_idx_1 = 1 · reviews_0 = 0
-- =====================================================================================

do $$
declare c record;
begin
  for c in select con.conname from pg_constraint con join pg_class rel on rel.oid = con.conrelid join pg_namespace n on n.oid = rel.relnamespace
           where n.nspname = 'public' and rel.relname = 'portal_reports' and con.contype = 'c' and pg_get_constraintdef(con.oid) ilike '%kind%'
  loop execute format('alter table public.portal_reports drop constraint %I', c.conname); end loop;
  alter table public.portal_reports add constraint portal_reports_kind_check check (kind in ('weekly','final','mission','advisory','study','diploma_pulse','diploma_unit','diploma_profile','program_review'));
end $$;

create index if not exists portal_reports_review_idx on public.portal_reports (program_id, approved_at desc) where kind = 'program_review' and status = 'approved';

-- =====================================================================================
--  تشخيص — المتوقَّع: kind_chk_ok = 1 · review_idx_1 = 1 · reviews_0 = 0
-- =====================================================================================
select
  (select count(*) from pg_constraint where conname = 'portal_reports_kind_check' and pg_get_constraintdef(oid) ilike '%program_review%') as kind_chk_ok,
  (select count(*) from pg_indexes where schemaname = 'public' and indexname = 'portal_reports_review_idx') as review_idx_1,
  (select count(*) from public.portal_reports where kind = 'program_review') as reviews_0;
