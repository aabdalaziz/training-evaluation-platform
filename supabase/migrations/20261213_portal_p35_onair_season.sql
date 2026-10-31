-- © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
-- =====================================================================================
--  P35 «أَثَر معك — موسم الهواء» — ترحيل واحد
--  (1) موسم الهواء  (2) صدى يعود  (3) أمانة إلى جهة  (4) ميراث متبادل  (5) الهواء على الخريطة بالزمن  (6) همسة المترجم
--  آمن لإعادة التشغيل. بلا بيانات تجريبية. بلا كرون جديد.
-- =====================================================================================

-- 1) موسم الهواء: موسم واحد نشط · لكل جهة ساعة واحدة فيه
create table if not exists public.portal_onair_seasons (
  id            bigserial primary key,
  title_ar      text not null default 'موسم الهواء',
  invite_ar     text,
  from_day      date not null,
  to_day        date not null,
  active        boolean not null default true,
  created_by    uuid,
  created_at    timestamptz not null default now(),
  constraint portal_onair_seasons_span_chk check (to_day >= from_day and to_day <= from_day + 14)
);
alter table public.portal_onair_seasons enable row level security;
drop policy if exists onair_seasons_public on public.portal_onair_seasons;
create policy onair_seasons_public on public.portal_onair_seasons for select using (true);

create table if not exists public.portal_onair_season_slots (
  id            bigserial primary key,
  season_id     bigint not null references public.portal_onair_seasons(id) on delete cascade,
  org_id        uuid not null,
  weekday       smallint not null,                 -- 0 الأحد … 6 السبت (توقيت الرياض)
  from_min      smallint not null,
  duration_min  smallint not null default 60,
  public_name   boolean not null default false,    -- بموافقة مدير الجهة يظهر اسمها على خريطة الموسم
  created_by    uuid,
  created_at    timestamptz not null default now(),
  constraint portal_onair_season_slots_uniq unique (season_id, org_id),
  constraint portal_onair_season_slots_day_chk  check (weekday between 0 and 6),
  constraint portal_onair_season_slots_span_chk check (from_min between 0 and 1439 and duration_min between 30 and 180)
);
alter table public.portal_onair_season_slots enable row level security;
drop policy if exists onair_season_slots_public on public.portal_onair_season_slots;
create policy onair_season_slots_public on public.portal_onair_season_slots for select using (true);

-- 2) صدى يعود: آخر درجة أُبلغ بها (5 · 25 · 100)
alter table public.portal_onair_echoes add column if not exists back_notified smallint not null default 0;

-- 3) أمانة إلى جهة: تبقى في عهدة الجهة حتى هذا الوقت ثم تنتقل إلى الهواء العام (بالقراءة)
alter table public.portal_onair_requests add column if not exists org_hold_until timestamptz;

-- 4) ميراث متبادل: المرافِق يعطي المرافَق دوره مرة واحدة
alter table public.portal_onair_presence add column if not exists reverse_left    smallint not null default 0;
alter table public.portal_onair_presence add column if not exists reverse_user_id uuid;

-- 5) الهواء على الخريطة بالزمن: سجلّ خفيف (مدينة · بداية · نهاية) يُحذف بعد 90 يومًا؛ بالخدمة فقط
create table if not exists public.portal_onair_presence_log (
  id          bigserial primary key,
  user_id     uuid not null,
  city_key    text,
  started_at  timestamptz not null default now(),
  ended_at    timestamptz
);
create index if not exists portal_onair_presence_log_started_idx on public.portal_onair_presence_log (started_at);
alter table public.portal_onair_presence_log enable row level security;   -- لا سياسات: الخدمة وحدها تقرأ وتكتب

-- 6) همسة المترجم: لا جدول — طلب kind=session بوسم meta.whisper وغرفة support عامة

-- 7) نوع الوثيقة: «وثيقة موسم» للجهة
alter table public.portal_vc_issuances drop constraint if exists portal_vc_issuances_kind_check;
alter table public.portal_vc_issuances add constraint portal_vc_issuances_kind_check
  check (kind in ('credential','snapshot','dataset','council_badge','org_charter','journey','org_journey','horizon','org_horizon','pair_pledge','org_pair_pledge','directory_card','collaboration','on_air','on_air_season'));

-- =====================================================================================
--  تشخيص (المتوقَّع: tables_3 = 3 · cols_4 = 4 · vc_kind_1 = 1 · policies_2 = 2)
-- =====================================================================================
select
  (select count(*) from information_schema.tables where table_schema = 'public' and table_name in ('portal_onair_seasons','portal_onair_season_slots','portal_onair_presence_log')) as tables_3,
  (select count(*) from information_schema.columns where table_schema = 'public' and ((table_name = 'portal_onair_echoes' and column_name = 'back_notified') or (table_name = 'portal_onair_requests' and column_name = 'org_hold_until') or (table_name = 'portal_onair_presence' and column_name in ('reverse_left','reverse_user_id')))) as cols_4,
  (select count(*) from pg_constraint where conname = 'portal_vc_issuances_kind_check' and pg_get_constraintdef(oid) like '%on_air_season%') as vc_kind_1,
  (select count(*) from pg_policies where tablename in ('portal_onair_seasons','portal_onair_season_slots')) as policies_2;
