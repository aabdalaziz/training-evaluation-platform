-- © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved.
-- أَثَر — P20 «سفارة أَثَر»: التفويض الشخصي للوكلاء (OAuth 2.1) — عملاء · تفويضات · أكواد
-- نفّذه مرة واحدة في Supabase SQL Editor. آمن للإعادة (if not exists). لا يمس أي جدول موجود.
-- =====================================================================================

-- 1) العملاء (مساعدون/تطبيقات): مسجَّلون ديناميكيًا (dcr) أو بوثيقة بيانات عميل (cimd) أو يدويًا
create table if not exists public.portal_oauth_clients (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  client_name text not null,
  client_uri text null,
  logo_uri text null,
  redirect_uris text[] not null default '{}'::text[],
  source text not null default 'dcr' check (source in ('dcr','cimd','manual')),
  software_id text null,                       -- لعملاء CIMD: رابط الوثيقة نفسه
  last_seen_at timestamptz null
);
create index if not exists portal_oauth_clients_created_idx on public.portal_oauth_clients (source, created_at desc);

-- 2) التفويضات: من (المستخدم) فوّض أي عميل بأي نطاقات — سجل واحد حي لكل مستخدم×عميل
create table if not exists public.portal_delegations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  client_id text not null,                     -- uuid من portal_oauth_clients أو رابط https (CIMD)
  client_name text not null,
  scopes text[] not null default '{}'::text[], -- wallet:read · daily:write · missions:read · snapshot:issue
  refresh_hash text null,                      -- تجزئة رمز التجديد الحالي (يُستبدل عند كل تجديد؛ إعادة الاستخدام تُبطل التفويض)
  refresh_expires_at timestamptz null,
  last_used_at timestamptz null,
  uses integer not null default 0,
  revoked_at timestamptz null
);
create index if not exists portal_delegations_user_idx on public.portal_delegations (user_id, created_at desc);
create index if not exists portal_delegations_client_idx on public.portal_delegations (client_id, revoked_at);

-- 3) أكواد التفويض (5 دقائق · تُستهلك مرة واحدة · PKCE)
create table if not exists public.portal_oauth_codes (
  code_hash text primary key,
  created_at timestamptz not null default now(),
  delegation_id uuid not null references public.portal_delegations(id) on delete cascade,
  client_id text not null,
  redirect_uri text not null,
  code_challenge text not null,
  resource text null,
  scopes text[] not null default '{}'::text[],
  expires_at timestamptz not null,
  used_at timestamptz null
);
create index if not exists portal_oauth_codes_exp_idx on public.portal_oauth_codes (expires_at);

-- 4) الأمان: المستخدم يقرأ تفويضاته فقط؛ كل الكتابة عبر الخادم (service role)
alter table public.portal_oauth_clients enable row level security;
alter table public.portal_delegations enable row level security;
alter table public.portal_oauth_codes enable row level security;
drop policy if exists "delegations_select_own" on public.portal_delegations;
create policy "delegations_select_own" on public.portal_delegations for select to authenticated using (auth.uid() = user_id);
-- (لا سياسات أخرى: العملاء والأكواد لا يقرؤها إلا الخادم)

-- 5) تنظيف دوري خفيف يمكن استدعاؤه من أي مهمة موجودة (اختياري — لا Cron جديد)
create or replace function public.portal_oauth_gc() returns integer language sql security definer set search_path = public as $$
  with d as (delete from public.portal_oauth_codes where expires_at < now() - interval '1 day' returning 1) select count(*)::integer from d;
$$;

-- =====================================================================================
-- فحص تشخيصي (المتوقع في البداية: 3 صفوف بقيمة 0)
select 'clients' as what, count(*) from public.portal_oauth_clients
union all select 'delegations', count(*) from public.portal_delegations
union all select 'codes', count(*) from public.portal_oauth_codes;
