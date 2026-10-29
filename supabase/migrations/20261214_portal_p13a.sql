-- © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
-- أَثَر — P13-أ: مصنع البرامج + موقف اليوم + طبقة المستقبل على التصنيف
--  1) portal_skills: المجال من المجالات الاثني عشر (domain_code) + عائلة ما بعد الذكاء الاصطناعي (future_family) + الأفق (horizon) + الصمود أمام الأتمتة
--  2) portal_daily_cases: «موقف اليوم» (موقف/قضية/حالة بتوتر خفي) المخزّن لكل يوم — مرتبط بالمناسبة والمجال
--  3) portal_daily_case_responses: ردود الممارسين الحرّة + «مرآة الأداء» (وصف الأداء، الجدارات، الاحتياجات)؛ الرد المحفوظ يدخل portal_learning_events (object_type = daily_case)
--  4) portal_calendar_events: مناسبات إضافية (هجرية/خاصة بالجهة) تُضاف من الإدارة فوق التقويم المدمج في الكود
--  5) portal_program_drafts: مسودّات مصنع البرامج (استشراف → مصمَّم → مُراجَع → منشور)
--  آمن لإعادة التشغيل.

-- 1) طبقة المستقبل على التصنيف
alter table public.portal_skills add column if not exists domain_code text null;
alter table public.portal_skills add column if not exists future_family text null;
alter table public.portal_skills add column if not exists horizon int null;
alter table public.portal_skills add column if not exists automation_resilience text null;
alter table public.portal_skills drop constraint if exists ps_domain_code_chk;
alter table public.portal_skills add constraint ps_domain_code_chk check (domain_code is null or domain_code in ('purpose','judgment','integrity','resilience','vitality','relational','language','professional','financial','civic','creative','digital_sovereignty'));
alter table public.portal_skills drop constraint if exists ps_future_family_chk;
alter table public.portal_skills add constraint ps_future_family_chk check (future_family is null or future_family in ('judgment_accountability','agent_leadership','verification_trust','ethics_meaning','synthesis_creativity','presence_influence','self_reinvention','focus_wellbeing'));
alter table public.portal_skills drop constraint if exists ps_horizon_chk;
alter table public.portal_skills add constraint ps_horizon_chk check (horizon is null or horizon in (2035, 2050, 2070));
alter table public.portal_skills drop constraint if exists ps_resilience_chk;
alter table public.portal_skills add constraint ps_resilience_chk check (automation_resilience is null or automation_resilience in ('low','medium','high'));
-- إسقاط المجال القديم على المجالات الاثني عشر حيث الخانة فارغة (قابل للتعديل من الإدارة لاحقًا)
update public.portal_skills set domain_code = case domain
  when 'arabic' then 'language' when 'pedagogy' then 'professional' when 'leadership' then 'relational' when 'quality' then 'judgment'
  when 'data_ai' then 'digital_sovereignty' when 'digital' then 'professional' when 'research' then 'judgment' when 'wellbeing' then 'resilience' else 'professional' end
  where domain_code is null;
update public.portal_skills set future_family = case domain_code
  when 'language' then 'presence_influence' when 'judgment' then 'judgment_accountability' when 'integrity' then 'verification_trust' when 'relational' then 'presence_influence'
  when 'digital_sovereignty' then 'agent_leadership' when 'resilience' then 'focus_wellbeing' when 'vitality' then 'focus_wellbeing' when 'creative' then 'synthesis_creativity'
  when 'purpose' then 'ethics_meaning' when 'civic' then 'ethics_meaning' when 'financial' then 'self_reinvention' else 'agent_leadership' end
  where future_family is null;
update public.portal_skills set horizon = 2035 where horizon is null;
update public.portal_skills set automation_resilience = case when domain_code in ('judgment','integrity','relational','purpose') then 'high' when domain_code in ('language','professional','creative','civic','resilience') then 'medium' else 'low' end where automation_resilience is null;
create index if not exists ps_domain_code_idx on public.portal_skills (domain_code, horizon);

-- 2) موقف اليوم
create table if not exists public.portal_daily_cases (
  id uuid primary key default gen_random_uuid(),
  day date not null unique,
  slug text not null,
  title_ar text not null,
  scene_ar text not null default '',
  role_ar text not null default '',
  situation_ar text not null,
  twist_ar text not null default '',
  ask_ar text not null default '',
  parties_ar jsonb not null default '[]'::jsonb,
  domain_code text not null,
  family text null,
  horizon int null,
  skill_codes jsonb not null default '[]'::jsonb,
  skill_ids uuid[] not null default '{}',
  event_code text null,
  event_name_ar text null,
  rubric jsonb not null default '[]'::jsonb,             -- [{code, weight}]
  source text not null default 'local',                  -- local | ai | human
  model text null,
  created_by uuid null,
  created_at timestamptz not null default now()
);
create index if not exists portal_daily_cases_domain_idx on public.portal_daily_cases (domain_code, day desc);
alter table public.portal_daily_cases enable row level security;
drop policy if exists portal_daily_cases_public_read on public.portal_daily_cases;
create policy portal_daily_cases_public_read on public.portal_daily_cases for select to anon, authenticated using (true);
revoke insert, update, delete on public.portal_daily_cases from anon, authenticated;

-- 3) الردود ومرآة الأداء
create table if not exists public.portal_daily_case_responses (
  id bigserial primary key,
  case_id uuid not null references public.portal_daily_cases(id) on delete cascade,
  day date not null,
  user_id uuid null,
  email text null,
  response text not null,
  evaluation jsonb not null default '{}'::jsonb,         -- {band, score, performance_ar, strengths_ar[], blind_spot_ar, needs_ar[], next_step_ar, skills[], rubric_hits[], source}
  band text null,
  score int null,
  source text null,                                      -- local | ai
  model text null,
  chars int not null default 0,
  created_at timestamptz not null default now()
);
create unique index if not exists portal_daily_case_responses_user_day on public.portal_daily_case_responses (day, user_id) where user_id is not null;
create index if not exists portal_daily_case_responses_day_idx on public.portal_daily_case_responses (day);
alter table public.portal_daily_case_responses enable row level security;
drop policy if exists portal_daily_case_responses_own_read on public.portal_daily_case_responses;
create policy portal_daily_case_responses_own_read on public.portal_daily_case_responses for select to authenticated using (user_id = auth.uid() or public.portal_is_staff());
revoke insert, update, delete on public.portal_daily_case_responses from anon, authenticated;

-- 4) مناسبات إضافية من الإدارة (فوق التقويم المدمج)
create table if not exists public.portal_calendar_events (
  code text primary key,
  name_ar text not null,
  name_en text null,
  month int not null check (month between 1 and 12),
  day int null check (day is null or day between 1 and 31),
  kind text not null default 'international' check (kind in ('national','international','month','org')),
  domains text[] not null default '{}',
  theme_ar text null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.portal_calendar_events enable row level security;
drop policy if exists portal_calendar_events_public_read on public.portal_calendar_events;
create policy portal_calendar_events_public_read on public.portal_calendar_events for select to anon, authenticated using (active);
drop policy if exists portal_calendar_events_staff_write on public.portal_calendar_events;
create policy portal_calendar_events_staff_write on public.portal_calendar_events for all to authenticated using (public.portal_is_staff()) with check (public.portal_is_staff());

-- 5) مصنع البرامج
create table if not exists public.portal_program_drafts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  created_by uuid null,
  title_ar text not null,
  need jsonb not null,                                   -- {sector, domain_code, family, stage, institution, horizon, gap_ar, audience_ar, org_name}
  stage text not null default 'foresight' check (stage in ('foresight','designed','reviewed','published')),
  foresight jsonb null,
  design jsonb null,
  review jsonb null,
  program_id text null,                                  -- البرنامج المُنشأ عند النشر (مسودّة في programs)
  notes text null,
  log jsonb not null default '[]'::jsonb,                -- [{at, by, action, source}]
  updated_at timestamptz not null default now()
);
create index if not exists portal_program_drafts_stage_idx on public.portal_program_drafts (stage, created_at desc);
alter table public.portal_program_drafts enable row level security;
drop policy if exists portal_program_drafts_staff_read on public.portal_program_drafts;
create policy portal_program_drafts_staff_read on public.portal_program_drafts for select to authenticated using (public.portal_is_staff());
revoke insert, update, delete on public.portal_program_drafts from anon, authenticated;

-- 6) تشخيص
select 'skills_with_domain_code' as k, count(*) from public.portal_skills where domain_code is not null
union all select 'skills_without_domain_code', count(*) from public.portal_skills where domain_code is null
union all select 'daily_cases', count(*) from public.portal_daily_cases
union all select 'daily_case_responses', count(*) from public.portal_daily_case_responses
union all select 'calendar_events', count(*) from public.portal_calendar_events
union all select 'program_drafts', count(*) from public.portal_program_drafts;
