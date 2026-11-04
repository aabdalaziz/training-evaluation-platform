-- © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
-- =====================================================================================
--  P48-ب — «ملف الاعتماد الحيّ: التجميد والتحقّق والتجميع»
--  portal_accred_snapshots: نسخة مختومة من ملف الدراسة الذاتية — رمز تحقّق عام (A + 9) · بصمة SHA-256 على بنية JSON قانونية
--  (الجسم + بصمة نصوص المعايير وقت التجميد) · الجسم محفوظ كما عُرض (بلا أسماء متدرّبين) · الموقِّع بصفته المهنية · كلمة إلى المراجِع (≤ 300 حرفًا).
--  لا تغيير على جداول P48-أ. آمن لإعادة التنفيذ.
-- =====================================================================================
create table if not exists public.portal_accred_snapshots (
  id               uuid primary key default gen_random_uuid(),
  program_id       uuid not null references public.programs(id) on delete cascade,
  organization_id  uuid,
  code             text not null unique,
  sha256           text not null,
  standards_sha    text not null,
  body             jsonb not null default '{}'::jsonb,
  score_met        int  not null default 0,
  score_total      int  not null default 0,
  eligible         boolean not null default false,
  frozen_by        uuid,
  frozen_name      text,
  frozen_at        timestamptz not null default now(),
  note_ar          text
);
create index if not exists portal_accred_snapshots_program_idx on public.portal_accred_snapshots (program_id, frozen_at desc);
create index if not exists portal_accred_snapshots_org_idx on public.portal_accred_snapshots (organization_id);
alter table public.portal_accred_snapshots enable row level security;
drop policy if exists portal_accred_snapshots_read on public.portal_accred_snapshots;
create policy portal_accred_snapshots_read on public.portal_accred_snapshots for select to anon, authenticated using (true);   -- عام بالرمز (الجسم بلا أسماء)؛ الكتابة بالخادم فقط
revoke insert, update, delete on public.portal_accred_snapshots from anon, authenticated;

-- =====================================================================================
--  تشخيص — المتوقَّع: tables_1 = 1 · snapshots_0 = 0 · pas_25 = 25 (جداول P48-أ كما هي)
-- =====================================================================================
select
  (select count(*) from information_schema.tables where table_schema = 'public' and table_name = 'portal_accred_snapshots') as tables_1,
  (select count(*) from public.portal_accred_snapshots) as snapshots_0,
  (select count(*) from public.portal_accred_standards where framework = 'pas') as pas_25;
