-- © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved.
-- أَثَر — P21 «درع أَثَر»: حدود معدل مستمرة · أحداث أمنية · تقرير RLS · تنظيف
-- نفّذه مرة واحدة في Supabase SQL Editor. آمن للإعادة. لا يمس أي جدول موجود.
-- =====================================================================================

-- 1) دلاء حدود المعدل (نافذة ثابتة لكل مفتاح: نداء ذرّي واحد يزيد ويقرّر)
create table if not exists public.portal_rate_buckets (
  bucket_key text primary key,                 -- مثل: oauth_token:ip:1.2.3.4:29184512
  count integer not null default 0,
  window_start timestamptz not null,
  window_s integer not null,
  updated_at timestamptz not null default now()
);
create index if not exists portal_rate_buckets_updated_idx on public.portal_rate_buckets (updated_at);

-- يعيد {allowed, count, limit, retry_after}: يزيد العدّاد ذرّيًا داخل نافذة ثابتة طولها p_window_s ثانية
create or replace function public.shield_hit(p_key text, p_window_s integer, p_limit integer)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_slot bigint := floor(extract(epoch from now()) / greatest(p_window_s, 1));
  v_key text := p_key || ':' || v_slot::text;
  v_count integer;
  v_start timestamptz := to_timestamp(v_slot * greatest(p_window_s, 1));
begin
  insert into public.portal_rate_buckets (bucket_key, count, window_start, window_s, updated_at)
  values (v_key, 1, v_start, p_window_s, now())
  on conflict (bucket_key) do update set count = public.portal_rate_buckets.count + 1, updated_at = now()
  returning count into v_count;
  return jsonb_build_object(
    'allowed', v_count <= p_limit,
    'count', v_count,
    'limit', p_limit,
    'retry_after', greatest(0, ceil(extract(epoch from (v_start + make_interval(secs => p_window_s) - now())))::integer)
  );
end $$;
revoke all on function public.shield_hit(text, integer, integer) from public, anon, authenticated;

-- 2) الأحداث الأمنية
create table if not exists public.portal_security_events (
  id bigserial primary key,
  at timestamptz not null default now(),
  severity text not null check (severity in ('info','warn','critical')),
  kind text not null,                          -- token_reuse · code_reuse · pkce_fail · bad_redirect · mcp_401_burst · rate_limited · delegation_created · delegation_revoked · key_created · key_rotated · client_registered · csp_report · scope_escalation · vuln_report · drill · ...
  actor text null,                             -- user id / client / key name (بلا أسرار)
  ip text null,
  user_id uuid null,
  meta jsonb not null default '{}'::jsonb,
  notified_at timestamptz null,
  handled_at timestamptz null,
  handled_by uuid null
);
create index if not exists portal_security_events_at_idx on public.portal_security_events (at desc);
create index if not exists portal_security_events_sev_idx on public.portal_security_events (severity, handled_at);
create index if not exists portal_security_events_kind_idx on public.portal_security_events (kind, at desc);

-- 3) تقرير RLS: جداول public التي لا تملك RLS أو بلا سياسات (للطاقم عبر service role فقط)
create or replace function public.shield_rls_report()
returns table (table_name text, rls_enabled boolean, policy_count integer)
language sql security definer set search_path = public as $$
  select c.relname::text, c.relrowsecurity,
         (select count(*)::integer from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname)
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
  order by c.relrowsecurity asc, c.relname;
$$;
revoke all on function public.shield_rls_report() from public, anon, authenticated;

-- 4) تنظيف (يُستدعى من المسح اليومي الموجود — لا Cron جديد): دلاء أقدم من يوم · أحداث info أقدم من 90 يومًا
create or replace function public.shield_gc() returns jsonb language plpgsql security definer set search_path = public as $$
declare b integer; e integer;
begin
  delete from public.portal_rate_buckets where updated_at < now() - interval '1 day'; get diagnostics b = row_count;
  delete from public.portal_security_events where severity = 'info' and at < now() - interval '90 days'; get diagnostics e = row_count;
  return jsonb_build_object('buckets', b, 'events', e);
end $$;
revoke all on function public.shield_gc() from public, anon, authenticated;

-- 5) الأمان: الجدولان للخادم فقط (RLS مفعَّل بلا سياسات = لا قراءة من anon/authenticated)
alter table public.portal_rate_buckets enable row level security;
alter table public.portal_security_events enable row level security;

-- =====================================================================================
-- فحص تشخيصي (المتوقع: صفّان — buckets 0 · events 0 — ثم صف ثالث: rls_tables_without_policies = عدد جداول public بلا سياسات (رقم للعلم فقط))
select 'buckets' as what, count(*)::text as value from public.portal_rate_buckets
union all select 'events', count(*)::text from public.portal_security_events
union all select 'rls_tables_without_policies', count(*)::text from public.shield_rls_report() r where r.policy_count = 0;
