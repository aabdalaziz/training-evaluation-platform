-- ============================================================================
-- Remote Learning Survey (Arabic for non-native speakers via Microsoft Teams)
-- Run this file in Supabase → SQL Editor. It is idempotent (safe to re-run).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Program levels (A1, A2, B1 …) — managed from /admin/survey-settings
--    program_id = NULL  →  a global level shared by all programs
-- ---------------------------------------------------------------------------
create table if not exists public.program_levels (
  id          uuid primary key default gen_random_uuid(),
  program_id  uuid null references public.programs(id) on delete cascade,
  code        text not null,
  name_ar     text not null,
  name_en     text not null,
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);
create unique index if not exists program_levels_program_code_uidx
  on public.program_levels (coalesce(program_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(code));

-- ---------------------------------------------------------------------------
-- 2) Link classrooms (groups / sections) to a level + optional display name
--    (existing free-text column "level" is kept untouched for backward compat)
-- ---------------------------------------------------------------------------
alter table public.classrooms add column if not exists level_id     uuid null references public.program_levels(id) on delete set null;
alter table public.classrooms add column if not exists section_name text null;

-- ---------------------------------------------------------------------------
-- 3) Class schedules — a group may meet on several days; two different groups
--    may share the exact same day/time. The schedule id is the unique key.
--    Times are stored as Asia/Riyadh wall-clock time.
-- ---------------------------------------------------------------------------
create table if not exists public.class_schedules (
  id           uuid primary key default gen_random_uuid(),
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  day_of_week  smallint not null check (day_of_week between 0 and 6), -- 0 = Sunday
  start_time   time not null,
  end_time     time not null,
  timezone     text not null default 'Asia/Riyadh',
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  constraint class_schedules_time_order check (end_time > start_time)
);
create index if not exists class_schedules_classroom_idx on public.class_schedules (classroom_id);

-- ---------------------------------------------------------------------------
-- 4) Anonymous survey responses
--    • No student identity is stored.
--    • IDs are stored for accurate reporting + text snapshots as a safety net
--      in case a trainer / group is renamed or deleted later.
-- ---------------------------------------------------------------------------
create table if not exists public.remote_learning_survey_responses (
  id                 uuid primary key default gen_random_uuid(),
  survey_version     integer not null default 1,

  program_id         uuid not null references public.programs(id) on delete restrict,
  level_id           uuid null references public.program_levels(id) on delete set null,
  trainer_id         uuid null references public.trainers(id) on delete set null,
  classroom_id       uuid null references public.classrooms(id) on delete set null,
  schedule_id        uuid null references public.class_schedules(id) on delete set null,
  lecture_date       date null,

  -- snapshots (display only)
  program_name_snapshot   text null,
  level_code_snapshot     text null,
  trainer_name_snapshot   text null,
  classroom_code_snapshot text null,
  schedule_snapshot       jsonb null,   -- {day_of_week,start_time,end_time}

  -- answers
  self_level_id      uuid null references public.program_levels(id) on delete set null,
  self_level_unknown boolean not null default false,
  attendance         text not null check (attendance in ('almost_all','most','some','few')),
  ratings            jsonb not null default '{}'::jsonb,   -- {"q01_teams_easy":"SA", ...}
  difficulties       text[] not null default '{}',
  difficulty_other   text null,
  liked_most         text null,
  suggestion         text null,

  ui_language        text not null default 'ar' check (ui_language in ('ar','en')),
  submitted_at       timestamptz not null default now()
);
create index if not exists rls_resp_program_idx   on public.remote_learning_survey_responses (program_id);
create index if not exists rls_resp_classroom_idx on public.remote_learning_survey_responses (classroom_id);
create index if not exists rls_resp_schedule_idx  on public.remote_learning_survey_responses (schedule_id);
create index if not exists rls_resp_date_idx      on public.remote_learning_survey_responses (lecture_date);

-- ---------------------------------------------------------------------------
-- 5) Row Level Security
-- ---------------------------------------------------------------------------
alter table public.program_levels                   enable row level security;
alter table public.class_schedules                  enable row level security;
alter table public.remote_learning_survey_responses enable row level security;

-- Levels: public read (needed by the anonymous form), admins manage
drop policy if exists "levels_public_read" on public.program_levels;
create policy "levels_public_read" on public.program_levels
  for select to anon, authenticated using (true);
drop policy if exists "levels_auth_write" on public.program_levels;
create policy "levels_auth_write" on public.program_levels
  for all to authenticated using (true) with check (true);

-- Schedules: public read, admins manage
drop policy if exists "schedules_public_read" on public.class_schedules;
create policy "schedules_public_read" on public.class_schedules
  for select to anon, authenticated using (true);
drop policy if exists "schedules_auth_write" on public.class_schedules;
create policy "schedules_auth_write" on public.class_schedules
  for all to authenticated using (true) with check (true);

-- Responses: anyone may INSERT (anonymous survey); only signed-in staff may read/delete
drop policy if exists "rls_resp_public_insert" on public.remote_learning_survey_responses;
create policy "rls_resp_public_insert" on public.remote_learning_survey_responses
  for insert to anon, authenticated with check (true);
drop policy if exists "rls_resp_auth_read" on public.remote_learning_survey_responses;
create policy "rls_resp_auth_read" on public.remote_learning_survey_responses
  for select to authenticated using (true);
drop policy if exists "rls_resp_auth_delete" on public.remote_learning_survey_responses;
create policy "rls_resp_auth_delete" on public.remote_learning_survey_responses
  for delete to authenticated using (true);

-- The anonymous form also needs to READ programs / trainers / classrooms.
-- (programs & classrooms are already readable by the existing evaluation form;
--  these statements only add what might be missing.)
alter table public.trainers   enable row level security;
alter table public.classrooms enable row level security;
alter table public.programs   enable row level security;
drop policy if exists "public_read_trainers" on public.trainers;
create policy "public_read_trainers" on public.trainers for select to anon using (true);
drop policy if exists "public_read_classrooms" on public.classrooms;
create policy "public_read_classrooms" on public.classrooms for select to anon using (true);
drop policy if exists "public_read_programs" on public.programs;
create policy "public_read_programs" on public.programs for select to anon using (true);

-- ---------------------------------------------------------------------------
-- 6) Seed CEFR-style global levels (skipped if they already exist)
-- ---------------------------------------------------------------------------
insert into public.program_levels (program_id, code, name_ar, name_en, sort_order)
select null, v.code, v.name_ar, v.name_en, v.sort_order
from (values
  ('A1', 'مبتدئ 1',     'Beginner 1',          1),
  ('A2', 'مبتدئ 2',     'Beginner 2',          2),
  ('B1', 'متوسط 1',     'Intermediate 1',      3),
  ('B2', 'متوسط 2',     'Intermediate 2',      4),
  ('C1', 'متقدم',       'Advanced',            5)
) as v(code, name_ar, name_en, sort_order)
where not exists (
  select 1 from public.program_levels l where l.program_id is null and lower(l.code) = lower(v.code)
);

-- ---------------------------------------------------------------------------
-- 7) Ask PostgREST to reload its schema cache
-- ---------------------------------------------------------------------------
notify pgrst, 'reload schema';
