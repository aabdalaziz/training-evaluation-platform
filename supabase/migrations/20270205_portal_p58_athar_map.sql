-- © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
-- P58 «خريطة أثرك — ما قاد إلى ماذا» (خريطة الأثر الذاتية للمتعلّم)
-- جدولان فقط:
--   1) portal_map_threads   — «خيوط» المتعلّم: قرار الإبقاء (مع «لأن…» نصًّا ≤ 120 حرفًا) أو الاستبعاد، وخيوطه اليدوية بين أيّ محطتين
--   2) portal_map_snapshots — «خريطة أثري <سنة>»: لقطة سنوية موقَّعة (رمز ATH-MP-XXXX-XXXX + بصمة SHA-256) خاصّة افتراضيًا، قابلة للإبطال
-- المحطات والخيوط المقترَحة لا تُخزَّن: تُحسَب كل مرة من وقائع الرحلة (lib/journey) بقواعد صريحة بلا ذكاء اصطناعي.
-- لا يدخل شيء من هنا في أي تقييم ولا في الملف المهاري المحسوب.

create extension if not exists pgcrypto;

-- 1) الخيوط ---------------------------------------------------------------
create table if not exists public.portal_map_threads (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  decided_at  timestamptz not null default now(),
  user_id     uuid,
  email       text not null,
  from_key    text not null,                         -- مفتاح المحطة الأولى مثل program:p1 · skill:<uuid> · daily:<id>
  to_key      text not null,                         -- مفتاح المحطة الثانية
  rule        text not null default 'manual',        -- قاعدة الاقتراح (program_skill · skill_credential · …) أو manual لخيط المتعلّم
  status      text not null default 'kept' check (status in ('kept','declined')),
  note_ar     text check (note_ar is null or char_length(note_ar) <= 120),   -- «نعم — لأن…»
  note_voice  jsonb not null default '{}'::jsonb,    -- احتياطي (مسار صوتي لاحقًا) — غير مستخدم الآن
  meta        jsonb not null default '{}'::jsonb,
  constraint portal_map_threads_pair_uq unique (email, from_key, to_key),
  constraint portal_map_threads_not_self_ck check (from_key <> to_key),
  constraint portal_map_threads_kept_has_note_ck check (status <> 'kept' or (note_ar is not null and char_length(btrim(note_ar)) >= 2))
);
create index if not exists portal_map_threads_email_idx on public.portal_map_threads (email, status);
create index if not exists portal_map_threads_user_idx  on public.portal_map_threads (user_id);

-- 2) اللقطات السنوية -----------------------------------------------------
create table if not exists public.portal_map_snapshots (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  user_id     uuid,
  email       text not null,
  year        int  not null check (year between 2024 and 2100),
  code        text not null unique,                  -- ATH-MP-XXXX-XXXX
  digest      text not null,                         -- sha256 على الجسم المعياري (JCS)
  body        jsonb not null,                        -- المحطات العامة + الخيوط المبقاة + الأعداد + سطر المرآة (بلا أسماء أشخاص)
  is_public   boolean not null default false,        -- خاصّة افتراضيًا؛ الرابط العام اختياري
  revoked_at  timestamptz,
  meta        jsonb not null default '{}'::jsonb
);
-- لقطة واحدة نافذة لكل سنة ميلادية (إعادة التوقيع تُبطل السابقة أولًا)
create unique index if not exists portal_map_snapshots_year_live_uq on public.portal_map_snapshots (email, year) where revoked_at is null;
create index if not exists portal_map_snapshots_user_idx on public.portal_map_snapshots (user_id);

-- RLS: المتعلّم يقرأ ما يخصّه فقط؛ الكتابة عبر واجهة الخادم (service role)
alter table public.portal_map_threads   enable row level security;
alter table public.portal_map_snapshots enable row level security;
drop policy if exists portal_map_threads_self_read on public.portal_map_threads;
create policy portal_map_threads_self_read on public.portal_map_threads for select to authenticated
  using (user_id = auth.uid() or lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));
drop policy if exists portal_map_snapshots_self_read on public.portal_map_snapshots;
create policy portal_map_snapshots_self_read on public.portal_map_snapshots for select to authenticated
  using (user_id = auth.uid() or lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));
grant select on public.portal_map_threads, public.portal_map_snapshots to authenticated;

comment on table public.portal_map_threads   is 'P58 — خيوط خريطة الأثر الذاتية (إبقاء/استبعاد/يدوي) — لا تدخل في أي تقييم';
comment on table public.portal_map_snapshots is 'P58 — لقطات «خريطة أثري <سنة>» الموقَّعة (رمز + بصمة) — خاصّة افتراضيًا';

-- تشخيص: المتوقَّع صفّان (الجدولان) · ثمّ صفّان للسياستين · ثمّ 1 للفهرس الجزئي
select table_name, (select count(*) from information_schema.columns c where c.table_schema = 'public' and c.table_name = t.table_name) as columns
from information_schema.tables t where table_schema = 'public' and table_name in ('portal_map_threads','portal_map_snapshots') order by 1;
-- المتوقَّع: portal_map_snapshots = 11 عمودًا · portal_map_threads = 13 عمودًا
select policyname from pg_policies where schemaname = 'public' and tablename in ('portal_map_threads','portal_map_snapshots') order by 1;
-- المتوقَّع: portal_map_snapshots_self_read · portal_map_threads_self_read
select count(*) as partial_year_index from pg_indexes where schemaname = 'public' and indexname = 'portal_map_snapshots_year_live_uq';
-- المتوقَّع: 1
