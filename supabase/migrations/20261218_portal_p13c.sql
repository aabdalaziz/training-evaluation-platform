-- © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
-- بوابة أَثَر — P13-ج: قناة واحدة (كتابة · صوت · فيديو) في كل تفاعل + غرف أَثَر الصغيرة
-- آمن لإعادة التشغيل (idempotent)
-- =====================================================================================
-- 1) مخزن الوسائط الخاص: فيديو/صوت الأداء (90 ثانية · 480p · حتى 12 م.ب)
-- =====================================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('athar-media', 'athar-media', false, 12582912, array['video/webm','video/mp4','video/quicktime','audio/webm','audio/ogg','audio/mp4','audio/mpeg','audio/wav'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types, public = false;

-- =====================================================================================
-- 2) سجل الوسائط: كل تسجيل أداء (فيديو/صوت) مع نصّه وسياقه وحالة مراجعته البشرية
-- =====================================================================================
create table if not exists public.portal_media (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text null,
  kind text not null check (kind in ('video','audio')),
  path text not null,
  mime text not null,
  bytes integer not null default 0,
  duration_sec integer not null default 0,
  transcript text null,
  context_type text not null default 'free' check (context_type in ('daily_case','whatif','advisor','copilot_moment','dialogue','mission','simulation','free')),
  context_id text null,
  skill_ids text[] not null default '{}',
  title text null,
  status text not null default 'uploaded' check (status in ('uploaded','approved','rejected')),
  reviewed_by uuid null references auth.users(id) on delete set null,
  reviewed_at timestamptz null,
  review_note text null,
  expires_at timestamptz not null default (now() + interval '180 days'),
  created_at timestamptz not null default now()
);
create index if not exists portal_media_user_idx on public.portal_media (user_id, created_at desc);
create index if not exists portal_media_status_idx on public.portal_media (status, created_at desc);
create index if not exists portal_media_ctx_idx on public.portal_media (context_type, context_id);
alter table public.portal_media enable row level security;
drop policy if exists media_owner_read on public.portal_media;
create policy media_owner_read on public.portal_media for select to authenticated using (user_id = auth.uid() or public.portal_is_staff());
-- الكتابة عبر الخادم فقط (service role)

-- ربط ردّ موقف اليوم بتسجيله (اختياري)
alter table public.portal_daily_case_responses add column if not exists media_id uuid null references public.portal_media(id) on delete set null;

-- =====================================================================================
-- 3) غرف أَثَر الصغيرة: فيديو من داخل المنصة حتى 6 أشخاص (WebRTC + قناة Supabase الفورية للتنسيق)
-- =====================================================================================
create table if not exists public.portal_rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  kind text not null default 'dialogue' check (kind in ('breakout','dialogue','consult')),
  session_id uuid null references public.portal_sessions(id) on delete cascade,
  created_by uuid null references auth.users(id) on delete set null,
  prompt text null,
  max_peers integer not null default 6 check (max_peers between 2 and 6),
  minutes integer not null default 10,
  status text not null default 'open' check (status in ('open','closed')),
  notes jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  closed_at timestamptz null
);
create index if not exists portal_rooms_session_idx on public.portal_rooms (session_id, created_at);
create index if not exists portal_rooms_status_idx on public.portal_rooms (status, created_at desc);
alter table public.portal_rooms enable row level security;
drop policy if exists rooms_auth_read on public.portal_rooms;
create policy rooms_auth_read on public.portal_rooms for select to authenticated using (true);
-- الكتابة عبر الخادم فقط (service role)

-- =====================================================================================
-- فحص تشخيصي — المتوقع: media=0 · rooms=0 · bucket=1 · media_col=1
-- =====================================================================================
select
  (select count(*) from public.portal_media) as media,
  (select count(*) from public.portal_rooms) as rooms,
  (select count(*) from storage.buckets where id = 'athar-media') as bucket,
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'portal_daily_case_responses' and column_name = 'media_id') as media_col;
