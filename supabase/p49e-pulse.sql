-- =====================================================================
-- P49-هـ — «نبض البيئة التدريبية»: مهامّ التحسين من «بند الأسبوع» (end_survey_actions)
-- 2026-11-08 · آمن لإعادة التنفيذ · Supabase → SQL Editor
--  الجدول يحفظ بندًا واحدًا (مفتاح + نصّ) ومتوسّطه وعدد إجاباته لدفعة معيّنة، وحالة open|done مع ملاحظة الإغلاق.
--  لا بيانات شخصية: created_by/closed_by معرّفات داخلية للطاقم بلا عرض. القراءة والكتابة للطاقم فقط (portal_is_staff).
-- =====================================================================
create table if not exists public.end_survey_actions (
  id            uuid primary key default gen_random_uuid(),
  program_id    uuid not null references public.programs(id) on delete cascade,
  classroom_id  uuid null references public.classrooms(id) on delete set null,
  cohort_key    text not null,
  question_key  text not null,
  question_text text not null,
  section       text null,
  mean          numeric(4,2) not null,
  n             integer not null check (n >= 5),            -- قاعدة k ≥ 5
  status        text not null default 'open' check (status in ('open', 'done')),
  note          text null,
  created_at    timestamptz not null default now(),
  created_by    uuid null,
  closed_at     timestamptz null,
  closed_by     uuid null,
  constraint esa_done_needs_note check (status <> 'done' or (note is not null and length(trim(note)) >= 5))
);
create index if not exists esa_program_idx on public.end_survey_actions (program_id, created_at desc);
create unique index if not exists esa_open_uidx on public.end_survey_actions (cohort_key, question_key) where status = 'open';   -- مهمّة مفتوحة واحدة لكل (دفعة × بند)

alter table public.end_survey_actions enable row level security;
revoke all on public.end_survey_actions from anon;
grant select, insert, update on public.end_survey_actions to authenticated;
drop policy if exists esa_staff_read on public.end_survey_actions;
create policy esa_staff_read on public.end_survey_actions for select to authenticated using (public.portal_is_staff());
drop policy if exists esa_staff_insert on public.end_survey_actions;
create policy esa_staff_insert on public.end_survey_actions for insert to authenticated with check (public.portal_is_staff());
drop policy if exists esa_staff_update on public.end_survey_actions;
create policy esa_staff_update on public.end_survey_actions for update to authenticated using (public.portal_is_staff()) with check (public.portal_is_staff());

-- تشخيص — المتوقَّع: table = 1 · policies = 3 · open_uidx = 1
select
  (select count(*) from information_schema.tables where table_schema = 'public' and table_name = 'end_survey_actions') as "table",
  (select count(*) from pg_policies where schemaname = 'public' and tablename = 'end_survey_actions') as policies,
  (select count(*) from pg_indexes where schemaname = 'public' and indexname = 'esa_open_uidx') as open_uidx;
