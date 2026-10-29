-- © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
-- بوابة أَثَر — P9-أ: طبقة الذكاء الاصطناعي المسؤول
--   • portal_ai_log: سجل حوكمة لكل استدعاء (الغرض، المصدر ai/local، النموذج، الأحجام، المدة) — بلا محتوى شخصي
--   • portal_ai_usage(): عدّاد الاستخدام خلال 24 ساعة لكل مستخدم/غرض (حدود الاستخدام تُطبَّق في الخادم)
--   • قراءة: الموظفون كل السجل، وكل مستخدم سجله فقط. الكتابة: مفتاح الخدمة فقط (لا سياسة insert).
-- آمن لإعادة التشغيل.

create extension if not exists pgcrypto with schema extensions;

-- 1) سجل الذكاء الاصطناعي
create table if not exists public.portal_ai_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid,
  email text,
  role text,
  purpose text not null,                          -- impact_brief | learner_plan | org_brief | activity_draft
  source text not null default 'local',           -- ai | local
  provider text,
  model text,
  input_chars integer not null default 0,
  output_chars integer not null default 0,
  duration_ms integer not null default 0,
  ok boolean not null default true,
  error text,
  context jsonb not null default '{}'::jsonb      -- معرّفات فقط (org_id, session_id, filters) — لا نصوص شخصية
);
create index if not exists portal_ai_log_user_idx on public.portal_ai_log (user_id, created_at desc);
create index if not exists portal_ai_log_purpose_idx on public.portal_ai_log (purpose, created_at desc);

alter table public.portal_ai_log enable row level security;
drop policy if exists portal_ai_log_staff_read on public.portal_ai_log;
create policy portal_ai_log_staff_read on public.portal_ai_log for select to authenticated using (public.portal_is_staff());
drop policy if exists portal_ai_log_own_read on public.portal_ai_log;
create policy portal_ai_log_own_read on public.portal_ai_log for select to authenticated using (user_id = auth.uid());
revoke insert, update, delete on public.portal_ai_log from anon, authenticated;

-- 2) عدّاد الاستخدام (خدمة فقط)
create or replace function public.portal_ai_usage(p_user uuid, p_purpose text)
returns integer language sql stable security definer set search_path = public as $$
  select count(*)::integer from public.portal_ai_log
  where user_id = p_user and purpose = p_purpose and ok and created_at >= now() - interval '24 hours';
$$;
revoke execute on function public.portal_ai_usage(uuid, text) from public, anon, authenticated;
grant execute on function public.portal_ai_usage(uuid, text) to service_role;

-- 3) تحقق
select 'ai log table' as t, count(*) as n from information_schema.tables where table_schema = 'public' and table_name = 'portal_ai_log'
union all select 'policies', count(*) from pg_policies where schemaname = 'public' and tablename = 'portal_ai_log'
union all select 'usage function', count(*) from pg_proc where proname = 'portal_ai_usage'
union all select 'indexes', count(*) from pg_indexes where schemaname = 'public' and tablename = 'portal_ai_log' and indexname like 'portal_ai_log_%_idx';
