-- © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
-- =====================================================================================
--  P37 «أَثَر معك — عُمر الهواء» (Athar on Air · Continuity) — ترحيل واحد، آمن للتكرار
--  1) جدار الأسبوع      : week_questions + wall_hidden (طيّ الطاقم) · + helped_at («أفادتني» من كاتب الأمانة، مرة واحدة)
--  2) موسم مشترك        : season_slots + shared_with_org_id · shared_status (invited | pending | accepted) · shared_group
--  3) سجلّ السنة        : seasons + meetings_n (عدد اللقاءات الخام عند التجميد — خدميّ، لا يُعرض إلا شريحةً سنوية)
--  4) مترجم الموسم      : جدول portal_onair_season_sign_hours (تعهّد مترجم بساعة إشارة أسبوعية طوال الموسم؛ واحد لكل مترجم في الموسم)
--  تشخيص متوقَّع في النهاية: cols_6 = 6 · tables_1 = 1 · policies_1 = 1
-- =====================================================================================

-- 1) جدار الأسبوع
alter table public.portal_onair_week_questions add column if not exists wall_hidden boolean not null default false;
alter table public.portal_onair_week_questions add column if not exists helped_at   timestamptz;

-- 2) موسم مشترك
alter table public.portal_onair_season_slots add column if not exists shared_with_org_id uuid;
alter table public.portal_onair_season_slots add column if not exists shared_status      text;
alter table public.portal_onair_season_slots add column if not exists shared_group       text;
alter table public.portal_onair_season_slots drop constraint if exists portal_onair_season_slots_shared_chk;
alter table public.portal_onair_season_slots add constraint portal_onair_season_slots_shared_chk
  check (shared_status is null or shared_status in ('invited','pending','accepted'));

-- 3) سجلّ السنة
alter table public.portal_onair_seasons add column if not exists meetings_n integer;

-- 4) مترجم الموسم
create table if not exists public.portal_onair_season_sign_hours (
  id            bigserial primary key,
  season_id     bigint not null references public.portal_onair_seasons(id) on delete cascade,
  user_id       uuid not null,
  weekday       smallint not null check (weekday between 0 and 6),
  from_min      smallint not null check (from_min between 0 and 1439),
  duration_min  smallint not null check (duration_min between 30 and 90),
  created_at    timestamptz not null default now(),
  constraint portal_onair_season_sign_hours_uq unique (season_id, user_id)
);
create index if not exists portal_onair_season_sign_hours_season_idx on public.portal_onair_season_sign_hours (season_id);
alter table public.portal_onair_season_sign_hours enable row level security;
drop policy if exists onair_season_sign_hours_public on public.portal_onair_season_sign_hours;
create policy onair_season_sign_hours_public on public.portal_onair_season_sign_hours for select using (true);   -- الاسم لا يُعرض للمجهول في الواجهة؛ الكتابة بالخدمة فقط

-- =====================================================================================
--  تشخيص (المتوقَّع: cols_6 = 6 · tables_1 = 1 · policies_1 = 1)
-- =====================================================================================
select
  (select count(*) from information_schema.columns where table_schema = 'public' and ((table_name = 'portal_onair_week_questions' and column_name in ('wall_hidden','helped_at')) or (table_name = 'portal_onair_season_slots' and column_name in ('shared_with_org_id','shared_status','shared_group')) or (table_name = 'portal_onair_seasons' and column_name = 'meetings_n'))) as cols_6,
  (select count(*) from information_schema.tables where table_schema = 'public' and table_name = 'portal_onair_season_sign_hours') as tables_1,
  (select count(*) from pg_policies where tablename = 'portal_onair_season_sign_hours') as policies_1;
