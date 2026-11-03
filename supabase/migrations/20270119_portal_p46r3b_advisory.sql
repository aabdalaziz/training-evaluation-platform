-- © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
-- =====================================================================================
--  P46 ر3-ب — «محور التقارير»: التقرير الاستشاري (رأي استشاري · دراسة) + تقرير إنجاز لأي طلب استشارة ولو بلا عقد
--  لا جدول جديد — كل شيء في portal_reports:
--   1) consulting_request_id → portal_consulting_requests (الوثيقة/التقرير يرتبط بالطلب مباشرة؛ العقد اختياري)
--   2) supersedes_id → portal_reports (نسخة جديدة من رأي/دراسة تحلّ محلّ سابقة — القديمة تبقى قابلة للتحقّق بعلامة «نُسخت»)
--   3) قيد kind (إن وُجد) يُوسَّع ليضمّ advisory · study
--   4) تقرير إنجاز واحد لكل طلب بلا عقد (فهرس فريد جزئي)
--  آمنة للتكرار. التشخيص المتوقَّع: cols_2 = 2 · req_idx_1 = 1 · kind_chk_ok = 1 · advisory_0 = 0
-- =====================================================================================

alter table public.portal_reports add column if not exists consulting_request_id uuid null references public.portal_consulting_requests(id) on delete set null;
alter table public.portal_reports add column if not exists supersedes_id uuid null references public.portal_reports(id) on delete set null;

-- قيد النوع: نُسقط أي قيد check قائم على kind ونعيد بناءه موسَّعًا (إن لم يكن هناك قيد نضيف واحدًا)
do $$
declare c record;
begin
  for c in select con.conname from pg_constraint con join pg_class rel on rel.oid = con.conrelid join pg_namespace n on n.oid = rel.relnamespace
           where n.nspname = 'public' and rel.relname = 'portal_reports' and con.contype = 'c' and pg_get_constraintdef(con.oid) ilike '%kind%'
  loop execute format('alter table public.portal_reports drop constraint %I', c.conname); end loop;
  alter table public.portal_reports add constraint portal_reports_kind_check check (kind in ('weekly','final','mission','advisory','study','diploma_pulse','diploma_unit','diploma_profile'));
end $$;

create unique index if not exists portal_reports_mission_req_idx on public.portal_reports (consulting_request_id) where kind = 'mission' and engagement_id is null and consulting_request_id is not null;
create index if not exists portal_reports_request_idx on public.portal_reports (consulting_request_id) where consulting_request_id is not null;

-- =====================================================================================
--  تشخيص — المتوقَّع: cols_2 = 2 · req_idx_1 = 1 · kind_chk_ok = 1 · advisory_0 = 0
-- =====================================================================================
select
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'portal_reports' and column_name in ('consulting_request_id','supersedes_id')) as cols_2,
  (select count(*) from pg_indexes where schemaname = 'public' and indexname = 'portal_reports_mission_req_idx') as req_idx_1,
  (select count(*) from pg_constraint where conname = 'portal_reports_kind_check' and pg_get_constraintdef(oid) ilike '%advisory%') as kind_chk_ok,
  (select count(*) from public.portal_reports where kind in ('advisory','study')) as advisory_0;
