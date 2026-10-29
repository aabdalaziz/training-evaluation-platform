-- =====================================================================================
-- 761 — P22 «خزنة أَثَر» (Athar Vault): سيادة الشخص على بياناته وفق نظام حماية البيانات الشخصية (PDPL)
-- © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved.
-- آمن لإعادة التشغيل. يُنفَّذ قبل رفع ملفات الكود.
--   1) portal_dsr_requests    طلبات الأشخاص (اطّلاع/نسخة · تصحيح · إتلاف · اعتراض · نقل) بعدّاد 30 يومًا (+30 بسبب)
--   2) portal_consents        دفتر الموافقات الصريحة (منح/سحب) — يُكمل ما هو مسجَّل في جداول أخرى (واتساب · تفويضات · دفع)
--   3) portal_incidents       دفتر الحوادث بعدّاد 72 ساعة (إبلاغ سدايا) مرتبط بأحداث درع أَثَر
--   4) portal_erasure_queue   حجر النسيان 7 أيام (تراجع بالرابط) ثم تنفيذ آلي + إيصال موقَّع
--   5) portal_retention_log   ما نفّذته سياسات الاحتفاظ
--   6) دوال RPC عامة (service role فقط): عدّ بيانات شخص عبر أي جداول · تجهيل · حذف · احتفاظ — بـ to_regclass فتتخطى الجداول غير الموجودة
-- =====================================================================================

-- 1) طلبات الأشخاص
create table if not exists public.portal_dsr_requests (
  id              bigserial primary key,
  created_at      timestamptz not null default now(),
  user_id         uuid,
  email           text not null,
  full_name       text,
  kind            text not null check (kind in ('access','correction','erasure','objection','portability')),
  status          text not null default 'open' check (status in ('open','extended','done','rejected','cancelled')),
  due_at          timestamptz not null default (now() + interval '30 days'),
  extended_at     timestamptz,
  extension_reason text,
  details         jsonb not null default '{}'::jsonb,      -- للتصحيح: {field, current, requested, reason}
  result          jsonb,                                   -- ما نُفِّذ / سبب الرفض
  handled_by      uuid,
  closed_at       timestamptz,
  reminded_at     timestamptz
);
create index if not exists portal_dsr_requests_open_idx on public.portal_dsr_requests (status, due_at);
create index if not exists portal_dsr_requests_email_idx on public.portal_dsr_requests (email);

-- 2) دفتر الموافقات
create table if not exists public.portal_consents (
  id           bigserial primary key,
  created_at   timestamptz not null default now(),
  user_id      uuid,
  email        text not null,
  scope        text not null,          -- whatsapp · push · share_profile · observatory · agent:<client> · research …
  granted_at   timestamptz,
  withdrawn_at timestamptz,
  source       text,                   -- ui · api · agent · import
  meta         jsonb not null default '{}'::jsonb
);
create index if not exists portal_consents_email_idx on public.portal_consents (email, scope);

-- 3) الحوادث (72 ساعة)
create table if not exists public.portal_incidents (
  id                 bigserial primary key,
  created_at         timestamptz not null default now(),
  created_by         uuid,
  discovered_at      timestamptz not null default now(),
  deadline_at        timestamptz not null default (now() + interval '72 hours'),
  reported_at        timestamptz,
  sdaia_ref          text,
  status             text not null default 'open' check (status in ('open','reported','closed','dismissed')),
  severity           text not null default 'high' check (severity in ('low','medium','high','critical')),
  summary            text not null,
  tables             text[] not null default '{}',
  affected_count     integer,
  actions            text,
  security_event_id  bigint,
  affected_notified_at timestamptz,
  closed_at          timestamptz,
  reminded_at        timestamptz
);

-- 4) حجر النسيان
create table if not exists public.portal_erasure_queue (
  id             bigserial primary key,
  created_at     timestamptz not null default now(),
  user_id        uuid not null,
  email          text not null,
  full_name      text,
  token_hash     text not null,
  execute_after  timestamptz not null default (now() + interval '7 days'),
  cancelled_at   timestamptz,
  executed_at    timestamptz,
  plan           jsonb not null default '{}'::jsonb,
  receipt        jsonb,
  dsr_id         bigint
);
create index if not exists portal_erasure_queue_due_idx on public.portal_erasure_queue (execute_after) where executed_at is null and cancelled_at is null;

-- 5) سجل الاحتفاظ
create table if not exists public.portal_retention_log (
  id          bigserial primary key,
  at          timestamptz not null default now(),
  table_name  text not null,
  action      text not null,            -- delete · anonymize
  rows        integer not null default 0,
  policy      text
);

-- 6) دوال RPC (service role فقط)
-- 6-أ) عدّ بيانات شخص: p_tables = [{"t":"portal_missions","u":"user_id","e":"email"}, …] → {"portal_missions": 3, …}
create or replace function public.vault_subject_counts(p_user uuid, p_email text, p_tables jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare it jsonb; t text; ucol text; ecol text; n bigint; out jsonb := '{}'::jsonb; cond text;
begin
  for it in select * from jsonb_array_elements(p_tables) loop
    t := it->>'t'; ucol := it->>'u'; ecol := it->>'e';
    if to_regclass('public.'||t) is null then out := out || jsonb_build_object(t, null); continue; end if;
    cond := '';
    if ucol is not null and p_user is not null then cond := format('%I = %L', ucol, p_user); end if;
    if ecol is not null and p_email is not null then cond := cond || case when cond = '' then '' else ' or ' end || format('lower(%I) = lower(%L)', ecol, p_email); end if;
    if cond = '' then out := out || jsonb_build_object(t, 0); continue; end if;
    begin
      execute format('select count(*) from public.%I where %s', t, cond) into n;
      out := out || jsonb_build_object(t, n);
    exception when others then out := out || jsonb_build_object(t, null); end;
  end loop;
  return out;
end $$;
revoke all on function public.vault_subject_counts(uuid, text, jsonb) from public, anon, authenticated;

-- 6-ب) تجهيل صفوف شخص: user_id → معرّف مستعار ثابت غير قابل للعكس، email → anon-<hash>@erased.invalid، والأعمدة الإضافية → null
create or replace function public.vault_anonymize(p_table text, p_user uuid, p_email text, p_user_col text, p_email_col text, p_null_cols text[])
returns integer language plpgsql security definer set search_path = public as $$
declare cond text := ''; sets text := ''; n integer := 0; c text; pseudo uuid; anon_mail text;
begin
  if to_regclass('public.'||p_table) is null then return 0; end if;
  pseudo := md5('athar-erased:' || coalesce(p_user::text, lower(p_email)))::uuid;
  anon_mail := 'anon-' || left(md5('athar-erased:' || lower(coalesce(p_email, p_user::text))), 12) || '@erased.invalid';
  if p_user_col is not null and p_user is not null then cond := format('%I = %L', p_user_col, p_user); sets := format('%I = %L', p_user_col, pseudo); end if;
  if p_email_col is not null and p_email is not null then
    cond := cond || case when cond = '' then '' else ' or ' end || format('lower(%I) = lower(%L)', p_email_col, p_email);
    sets := sets || case when sets = '' then '' else ', ' end || format('%I = %L', p_email_col, anon_mail);
  end if;
  if cond = '' then return 0; end if;
  if p_null_cols is not null then foreach c in array p_null_cols loop
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = p_table and column_name = c) then sets := sets || format(', %I = null', c); end if;
  end loop; end if;
  execute format('update public.%I set %s where %s', p_table, sets, cond); get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.vault_anonymize(text, uuid, text, text, text, text[]) from public, anon, authenticated;

-- 6-ج) حذف صفوف شخص
create or replace function public.vault_delete(p_table text, p_user uuid, p_email text, p_user_col text, p_email_col text)
returns integer language plpgsql security definer set search_path = public as $$
declare cond text := ''; n integer := 0;
begin
  if to_regclass('public.'||p_table) is null then return 0; end if;
  if p_user_col is not null and p_user is not null then cond := format('%I = %L', p_user_col, p_user); end if;
  if p_email_col is not null and p_email is not null then cond := cond || case when cond = '' then '' else ' or ' end || format('lower(%I) = lower(%L)', p_email_col, p_email); end if;
  if cond = '' then return 0; end if;
  execute format('delete from public.%I where %s', p_table, cond); get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.vault_delete(text, uuid, text, text, text) from public, anon, authenticated;

-- 6-د) الاحتفاظ: حذف أو تجهيل الصفوف الأقدم من p_days حسب عمود زمني (p_dry = معاينة بالعدّ فقط)
create or replace function public.vault_retention(p_table text, p_ts_col text, p_days integer, p_action text, p_user_col text, p_email_col text, p_null_cols text[], p_dry boolean)
returns integer language plpgsql security definer set search_path = public as $$
declare n integer := 0; sets text := ''; c text; cutoff timestamptz := now() - (p_days || ' days')::interval;
begin
  if to_regclass('public.'||p_table) is null then return 0; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = p_table and column_name = p_ts_col) then return 0; end if;
  if p_dry then execute format('select count(*) from public.%I where %I < %L', p_table, p_ts_col, cutoff) into n; return n; end if;
  if p_action = 'delete' then
    execute format('delete from public.%I where %I < %L', p_table, p_ts_col, cutoff); get diagnostics n = row_count;
  else
    if p_user_col is not null then sets := format('%I = md5(''athar-retired:'' || coalesce(%I::text, id::text))::uuid', p_user_col, p_user_col); end if;
    if p_email_col is not null then sets := sets || case when sets = '' then '' else ', ' end || format('%I = case when %I is null then null else ''anon-'' || left(md5(''athar-retired:'' || lower(%I)), 12) || ''@erased.invalid'' end', p_email_col, p_email_col, p_email_col); end if;
    if p_null_cols is not null then foreach c in array p_null_cols loop
      if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = p_table and column_name = c) then sets := sets || case when sets = '' then '' else ', ' end || format('%I = null', c); end if;
    end loop; end if;
    if sets = '' then return 0; end if;
    execute format('update public.%I set %s where %I < %L and not (coalesce(%I::text, '''') like ''anon-%%'')', p_table, sets, p_ts_col, cutoff, coalesce(p_email_col, p_ts_col)); get diagnostics n = row_count;
  end if;
  if n > 0 then insert into public.portal_retention_log (table_name, action, rows, policy) values (p_table, p_action, n, p_days || 'd'); end if;
  return n;
end $$;
revoke all on function public.vault_retention(text, text, integer, text, text, text, text[], boolean) from public, anon, authenticated;

-- 6-هـ) تنظيف سجل التدقيق بعد النسيان: صفوف التدقيق التي تحمل نسخة قبل/بعد من بيانات الشخص (مشغّلات audit_row_change)
create or replace function public.vault_scrub_audit(p_user uuid, p_email text)
returns integer language plpgsql security definer set search_path = public as $$
declare n integer := 0; m integer := 0;
begin
  if to_regclass('public.audit_logs') is null then return 0; end if;
  update public.audit_logs set before_data = null, after_data = null, changes = null, entity_label = '[erased]'
   where (p_user is not null and entity_id = p_user::text)
      or (p_email is not null and (lower(coalesce(before_data->>'email', after_data->>'email', before_data->>'recipient_email', after_data->>'recipient_email', '')) = lower(p_email)));
  get diagnostics n = row_count;
  update public.audit_logs set actor_email = null where p_email is not null and lower(coalesce(actor_email,'')) = lower(p_email);
  get diagnostics m = row_count;
  return n + m;
exception when others then return -1;
end $$;
revoke all on function public.vault_scrub_audit(uuid, text) from public, anon, authenticated;

-- 7) الأمان: الجداول للخادم فقط
alter table public.portal_dsr_requests enable row level security;
alter table public.portal_consents enable row level security;
alter table public.portal_incidents enable row level security;
alter table public.portal_erasure_queue enable row level security;
alter table public.portal_retention_log enable row level security;

-- =====================================================================================
-- فحص تشخيصي (المتوقع: 5 صفوف كلها 0 — ثم صف سادس: counts_rpc = {"portal_missions": 0, …} أو أرقام فعلية)
select 'dsr_requests' as what, count(*)::text as value from public.portal_dsr_requests
union all select 'consents', count(*)::text from public.portal_consents
union all select 'incidents', count(*)::text from public.portal_incidents
union all select 'erasure_queue', count(*)::text from public.portal_erasure_queue
union all select 'retention_log', count(*)::text from public.portal_retention_log
union all select 'counts_rpc', public.vault_subject_counts(null, 'nobody@example.invalid', '[{"t":"portal_missions","u":"user_id","e":"email"},{"t":"table_that_does_not_exist","u":"user_id","e":null}]'::jsonb)::text;
