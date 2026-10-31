-- =====================================================================================
--  P34 «أَثَر معك — الهواء يتّسع» — ترحيل واحد
--  (1) ساعة الهواء الذهبية  (2) الهواء الصامت  (3) صدى السؤال  (4) ميراث الهواء
--  (5) هواء الجهة  (6) خريطة الحضور الحيّة  (7) الهواء بالإشارة  (8) رسالة في زجاجة
--  آمن لإعادة التشغيل. بلا بيانات تجريبية.
-- =====================================================================================

-- 1) أعمدة على الحضور: الهواء الصامت · ميراث الهواء
alter table public.portal_onair_presence add column if not exists text_only       boolean not null default false;   -- «نصّ فقط»
alter table public.portal_onair_presence add column if not exists mentor_user_id  uuid;                              -- من يرافقني (ميراث الهواء)
alter table public.portal_onair_presence add column if not exists mentor_status   text;                              -- invited | accepted | declined | done
alter table public.portal_onair_presence add column if not exists shadow_left     smallint not null default 0;       -- طلبات متبقّية تحت المرافقة
alter table public.portal_onair_presence drop constraint if exists portal_onair_presence_mentor_chk;
alter table public.portal_onair_presence add constraint portal_onair_presence_mentor_chk check (mentor_status is null or mentor_status in ('invited','accepted','declined','done'));

-- 2) هواء الجهة: الطلب يحمل جهته (null = الهواء العام)
alter table public.portal_onair_requests add column if not exists org_id uuid;
create index if not exists portal_onair_requests_org_idx on public.portal_onair_requests (org_id) where org_id is not null;

-- 3) ساعة الهواء الذهبية
create table if not exists public.portal_onair_golden (
  id            bigserial primary key,
  title_ar      text not null default 'ساعة الهواء الذهبية',
  weekday       smallint not null,                 -- 0 الأحد … 6 السبت (توقيت الرياض)
  from_min      smallint not null,
  duration_min  smallint not null default 60,
  active        boolean not null default true,
  created_by    uuid,
  created_at    timestamptz not null default now(),
  constraint portal_onair_golden_day_chk  check (weekday between 0 and 6),
  constraint portal_onair_golden_span_chk check (from_min between 0 and 1439 and duration_min between 30 and 180)
);
alter table public.portal_onair_golden enable row level security;
drop policy if exists onair_golden_public on public.portal_onair_golden;
create policy onair_golden_public on public.portal_onair_golden for select using (true);

create table if not exists public.portal_onair_golden_pledges (
  id          bigserial primary key,
  golden_id   bigint not null references public.portal_onair_golden(id) on delete cascade,
  user_id     uuid not null,
  email       text not null,
  week_key    text not null,                       -- YYYY-Www
  reminded_at timestamptz,
  created_at  timestamptz not null default now(),
  unique (golden_id, user_id, week_key)
);
alter table public.portal_onair_golden_pledges enable row level security;
drop policy if exists onair_golden_pledges_self on public.portal_onair_golden_pledges;
create policy onair_golden_pledges_self on public.portal_onair_golden_pledges for select using (auth.uid() = user_id);

-- 4) صدى السؤال: مسودّات «مهارة اليوم» من أسئلة محلولة بإذن أصحابها
create table if not exists public.portal_onair_echoes (
  id          bigserial primary key,
  request_id  bigint not null references public.portal_onair_requests(id) on delete cascade,
  status      text not null default 'draft',       -- draft | approved | published | rejected
  day         date,                                -- اليوم المختار للنشر
  draft       jsonb not null default '{}'::jsonb,  -- title_ar · situation_ar · ask_ar · rubric · domain_code
  model       text,
  created_by  uuid,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint portal_onair_echoes_status_chk check (status in ('draft','approved','published','rejected')),
  unique (request_id)
);
alter table public.portal_onair_echoes enable row level security;
create index if not exists portal_onair_echoes_day_idx on public.portal_onair_echoes (day) where status in ('approved','published');
drop trigger if exists portal_onair_echoes_touch on public.portal_onair_echoes;
create trigger portal_onair_echoes_touch before update on public.portal_onair_echoes for each row execute function public.portal_touch_updated_at();

-- =====================================================================================
--  تشخيص (المتوقَّع: tables_3 = 3 · presence_cols_4 = 4 · req_org_1 = 1 · policies_2 = 2)
-- =====================================================================================
select
  (select count(*) from information_schema.tables where table_schema = 'public' and table_name in ('portal_onair_golden','portal_onair_golden_pledges','portal_onair_echoes')) as tables_3,
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'portal_onair_presence' and column_name in ('text_only','mentor_user_id','mentor_status','shadow_left')) as presence_cols_4,
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'portal_onair_requests' and column_name = 'org_id') as req_org_1,
  (select count(*) from pg_policies where tablename in ('portal_onair_golden','portal_onair_golden_pledges')) as policies_2;
