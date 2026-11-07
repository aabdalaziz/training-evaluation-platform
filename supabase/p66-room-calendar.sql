-- © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
-- P66 «أيام التدريب وفترات التطبيق» — الاسم الرسمي: تقويم الشعبة وفترات التطبيق الميداني
--   (Classroom training calendar & field-application periods)
-- جدولان جديدان — لا يمسّان أي جدول قائم:
--  1) portal_room_calendars  صفّ واحد لكل شعبة: أيام التدريب الفعلية (days) + الكتل وفترات التطبيق المشتقّة (blocks/applies — نسخة محسوبة للقراءة فقط)
--     بلا تقويم ← كل شيء يعمل كما كان (start_date → end_date متّصلة).
--  2) portal_learning_lines  سطور المتدرّب: learn «سطر اليوم» (يوم تدريب) · apply «سطر التطبيق» (أسبوع في فترة تطبيق) · commit «التزامي حتى نلتقي»
--     (آخر يوم في الكتلة، يُفتح له وحده أول يوم الكتلة التالية ويجيب: فعلت / جزئيًا / لم أفعل). لا درجة ولا تقييم. المدرّب يرى المجمَّع فقط (k ≥ 5).
-- التشغيل: Supabase → SQL Editor → New query → الصق → Run. آمن للتكرار (IF NOT EXISTS).

create table if not exists public.portal_room_calendars (
  classroom_id  text primary key,
  program_id    text,
  days          jsonb not null default '[]'::jsonb,
  blocks        jsonb not null default '[]'::jsonb,
  applies       jsonb not null default '[]'::jsonb,
  updated_by    uuid,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists portal_room_calendars_program_idx on public.portal_room_calendars (program_id);

create table if not exists public.portal_learning_lines (
  id            bigint generated always as identity primary key,
  user_id       uuid not null,
  email         text not null,
  classroom_id  text not null,
  program_id    text,
  kind          text not null,
  day           date not null,
  body_ar       text not null,
  blocker_ar    text,
  block_no      int,
  apply_no      int,
  week_no       int,
  opens_on      date,
  done          text,
  done_at       timestamptz,
  meta          jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint portal_learning_lines_kind check (kind in ('learn','apply','commit')),
  constraint portal_learning_lines_done check (done is null or done in ('yes','part','no')),
  constraint portal_learning_lines_len check (char_length(body_ar) between 1 and 200 and (blocker_ar is null or char_length(blocker_ar) <= 200)),
  constraint portal_learning_lines_one unique (user_id, classroom_id, kind, day)
);
create index if not exists portal_learning_lines_room_idx on public.portal_learning_lines (classroom_id, kind, day);
create index if not exists portal_learning_lines_user_idx on public.portal_learning_lines (user_id, created_at desc);
create index if not exists portal_learning_lines_opens_idx on public.portal_learning_lines (opens_on) where kind = 'commit' and done is null;

alter table public.portal_room_calendars enable row level security;
alter table public.portal_learning_lines enable row level security;
-- المتدرّب يقرأ سطوره فقط؛ كل كتابة عبر مفتاح الخدمة من /api/me/line و/api/me/calendar
drop policy if exists "learning_lines_owner_read" on public.portal_learning_lines;
create policy "learning_lines_owner_read" on public.portal_learning_lines for select to authenticated using (auth.uid() = user_id);
drop policy if exists "room_calendars_read" on public.portal_room_calendars;
create policy "room_calendars_read" on public.portal_room_calendars for select to authenticated using (true);

comment on table public.portal_room_calendars is 'P66 تقويم الشعبة — أيام التدريب الفعلية؛ منها تُشتقّ الكتل وفترات التطبيق واليوم الأول ويوم التخرّج. بلا تقويم = مدة متّصلة كما كان.';
comment on table public.portal_learning_lines is 'P66 سطور المتدرّب: سطر اليوم (learn) · سطر التطبيق الأسبوعي (apply: ماذا طبّقتُ / ما الذي منعني) · التزامي حتى نلتقي (commit). لا تقييم. المدرّب يرى المجمَّع فقط k ≥ 5.';

-- ─── تشخيص متوقَّع بعد التشغيل ───
-- select count(*) from public.portal_room_calendars;                                       -- 0
-- select count(*) from public.portal_learning_lines;                                       -- 0
-- select count(*) from pg_indexes where tablename = 'portal_room_calendars';               -- 2  (pkey + program)
-- select count(*) from pg_indexes where tablename = 'portal_learning_lines';               -- 5  (pkey + one + room + user + opens)
-- select count(*) from pg_policies where tablename in ('portal_room_calendars','portal_learning_lines'); -- 2
-- select column_name from information_schema.columns where table_name = 'portal_learning_lines' order by ordinal_position; -- 18 عمودًا
