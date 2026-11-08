-- © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
-- =====================================================================================================
--  P65 — «درع أَثَر — الطبقة الثانية» (مراجعة أمن البيانات وحوكمة المعالجة)
--  يُنفَّذ مرة واحدة في Supabase → SQL Editor. آمن للتكرار (idempotent). لا يحذف شيئًا ولا يغيّر سياسة قائمة.
--  يضيف: (1) سجلّ الوصول الإداري portal_admin_access  (2) تقرير السياسات shield_policy_report
--         (3) أعمدة التجميد/المحو على portal_organizations  (4) بصمة/تصدير/محو الجهة عبر المفاتيح الأجنبية نفسها
--         (5) أختام الدرع الشهرية portal_shield_seals  (6) توسيع shield_gc (كنس 180 يومًا)
-- =====================================================================================================

-- (1) سجلّ الوصول الإداري — صفّ واحد لكل (مستخدم × مسار × شخص × يوم)؛ الشخص يُخزَّن بصمةً لا بريدًا
create table if not exists public.portal_admin_access (
  id            bigserial primary key,
  day           date        not null default ((now() at time zone 'Asia/Riyadh')::date),
  first_at      timestamptz not null default now(),
  last_at       timestamptz not null default now(),
  hits          integer     not null default 1,
  user_id       uuid        not null,
  role          text        not null default '',
  path          text        not null,
  subject_hash  text        not null default '',     -- '' = صفحة/قائمة · 'sha256:…' = ملف شخص بعينه
  ip_masked     text,
  constraint portal_admin_access_uniq unique (user_id, path, subject_hash, day)
);
create index if not exists portal_admin_access_day_idx     on public.portal_admin_access (day desc);
create index if not exists portal_admin_access_subject_idx on public.portal_admin_access (subject_hash, day desc) where subject_hash <> '';
alter table public.portal_admin_access enable row level security;   -- بلا سياسات = الخادم فقط

create or replace function public.shield_access_touch(p_user uuid, p_role text, p_path text, p_subject text default '', p_ip text default null)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  insert into public.portal_admin_access (user_id, role, path, subject_hash, ip_masked)
  values (p_user, coalesce(p_role, ''), left(p_path, 200), coalesce(p_subject, ''), left(p_ip, 64))
  on conflict (user_id, path, subject_hash, day)
  do update set hits = public.portal_admin_access.hits + 1, last_at = now()
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.shield_access_touch(uuid, text, text, text, text) from public, anon, authenticated;

-- (2) تقرير السياسات — كل جدول في public: RLS؟ كم سياسة؟ هل يقرأ anon؟ هل يكتب anon؟ هل القراءة مفتوحة (qual = true)؟
create or replace function public.shield_policy_report()
returns table (table_name text, rls_enabled boolean, policy_count integer, anon_read boolean, anon_write boolean, open_read boolean)
language sql security definer set search_path = public as $$
  select c.relname::text, c.relrowsecurity,
         (select count(*)::integer from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname),
         exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname
                   and (p.roles @> '{anon}'::name[] or p.roles @> '{public}'::name[]) and p.cmd in ('SELECT', 'ALL')),
         exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname
                   and (p.roles @> '{anon}'::name[] or p.roles @> '{public}'::name[]) and p.cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')),
         exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname
                   and (p.roles @> '{anon}'::name[] or p.roles @> '{public}'::name[]) and p.cmd in ('SELECT', 'ALL') and p.qual = 'true')
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
  order by c.relrowsecurity asc, c.relname;
$$;
revoke all on function public.shield_policy_report() from public, anon, authenticated;

-- (3) أعمدة التجميد والمحو المؤجَّل على الجهة
alter table if exists public.portal_organizations add column if not exists frozen_at          timestamptz;
alter table if exists public.portal_organizations add column if not exists frozen_reason      text;
alter table if exists public.portal_organizations add column if not exists frozen_by          uuid;
alter table if exists public.portal_organizations add column if not exists erase_at           timestamptz;   -- موعد التنفيذ (بعد 7 أيام)
alter table if exists public.portal_organizations add column if not exists erase_requested_by uuid;
alter table if exists public.portal_organizations add column if not exists erase_reason       text;

-- (4) بصمة الجهة: كل جدول يشير إلى portal_organizations بمفتاح أجنبي — من كتالوج القاعدة نفسه، فلا جدول يُنسى
create or replace function public.vault_org_footprint(p_org uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r record; n bigint; o jsonb := '{}'::jsonb;
begin
  for r in
    select c.conrelid::regclass::text as tbl, a.attname::text as col,
           case c.confdeltype when 'c' then 'cascade' when 'n' then 'set_null' when 'd' then 'set_default' else 'restrict' end as on_del
    from pg_constraint c join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
    where c.contype = 'f' and c.confrelid = 'public.portal_organizations'::regclass
    order by 1, 2
  loop
    execute format('select count(*) from %s where %I = $1', r.tbl, r.col) into n using p_org;
    if n > 0 then
      o := o || jsonb_build_object(r.tbl || '.' || r.col, jsonb_build_object('rows', n, 'on_delete', r.on_del));
    end if;
  end loop;
  return o;
end $$;
revoke all on function public.vault_org_footprint(uuid) from public, anon, authenticated;

-- تصدير الجهة: صفوفها في كل جدول مرتبط (حدّ 2000 صفّ/جدول) مع إسقاط أعمدة الأسرار (token/secret/hash/password)
create or replace function public.vault_org_export(p_org uuid, p_limit integer default 2000)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r record; rows jsonb; o jsonb := '{}'::jsonb;
begin
  for r in
    select c.conrelid::regclass::text as tbl, a.attname::text as col
    from pg_constraint c join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
    where c.contype = 'f' and c.confrelid = 'public.portal_organizations'::regclass
    order by 1, 2
  loop
    execute format(
      'select coalesce(jsonb_agg(x), ''[]''::jsonb) from (select (select jsonb_object_agg(k, v) from jsonb_each(to_jsonb(t)) where k !~ ''(token|secret|hash|password)'') as x from %s t where %I = $1 limit %s) s',
      r.tbl, r.col, greatest(1, least(p_limit, 5000))) into rows using p_org;
    if jsonb_array_length(rows) > 0 then o := o || jsonb_build_object(r.tbl, rows); end if;
  end loop;
  o := o || jsonb_build_object('portal_organizations', (select coalesce(jsonb_agg(to_jsonb(g)), '[]'::jsonb) from public.portal_organizations g where g.id = p_org));
  return o;
end $$;
revoke all on function public.vault_org_export(uuid, integer) from public, anon, authenticated;

-- محو الجهة: يحذف صفّ الجهة فتسري قواعد المخطط نفسها (cascade = يُحذف · set null = يُفكّ ربط الشخص بالجهة ويبقى حسابه)؛
-- الجداول ذات restrict تُحذف صفوفها صراحةً أولًا. يعيد البصمة قبل المحو + عدد الجداول.
create or replace function public.vault_org_erase(p_org uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare fp jsonb; r record; d bigint; touched integer := 0;
begin
  fp := public.vault_org_footprint(p_org);
  for r in
    select c.conrelid::regclass::text as tbl, a.attname::text as col
    from pg_constraint c join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
    where c.contype = 'f' and c.confrelid = 'public.portal_organizations'::regclass and c.confdeltype not in ('c', 'n', 'd')
  loop
    execute format('delete from %s where %I = $1', r.tbl, r.col) using p_org; get diagnostics d = row_count; if d > 0 then touched := touched + 1; end if;
  end loop;
  delete from public.portal_organizations where id = p_org; get diagnostics d = row_count;
  return jsonb_build_object('footprint', fp, 'org_deleted', d > 0, 'restrict_tables_cleared', touched, 'at', now());
end $$;
revoke all on function public.vault_org_erase(uuid) from public, anon, authenticated;

-- (5) أختام الدرع الشهرية — «شهادة الدرع» ATH-SH
create table if not exists public.portal_shield_seals (
  id           bigserial primary key,
  month        text        not null unique,          -- YYYY-MM
  code         text        not null unique,          -- ATH-SH-XXXX-XXXX
  issued_at    timestamptz not null default now(),
  passed_days  integer     not null default 0,       -- أيام نجح فيها التمرين كاملًا
  total_days   integer     not null default 0,       -- أيام جرى فيها التمرين
  checks_total integer     not null default 0,
  digest       text        not null default '',       -- sha256 للوثيقة بترتيب مفاتيح قياسي (jsonb لا يحفظ الترتيب)
  body         jsonb       not null default '{}'::jsonb   -- الوثيقة الموقَّعة (بلا أسرار)
);
alter table public.portal_shield_seals enable row level security;   -- القراءة العامة عبر الخادم فقط (/verify/shield)

-- (6) الكنس اليومي (داخل الكرون الموجود): دلاء > يوم · أحداث info > 90 يومًا · وصول إداري > 180 يومًا
create or replace function public.shield_gc() returns jsonb language plpgsql security definer set search_path = public as $$
declare b integer; e integer; a integer;
begin
  delete from public.portal_rate_buckets where updated_at < now() - interval '1 day'; get diagnostics b = row_count;
  delete from public.portal_security_events where severity = 'info' and at < now() - interval '90 days'; get diagnostics e = row_count;
  delete from public.portal_admin_access where day < (now() - interval '180 days')::date; get diagnostics a = row_count;
  return jsonb_build_object('buckets', b, 'events', e, 'access', a);
end $$;
revoke all on function public.shield_gc() from public, anon, authenticated;

-- =====================================================================================================
--  التشخيص (النتيجة المتوقَّعة بين قوسين)
-- =====================================================================================================
select 'p65_objects' as k, count(*)::text as v from pg_proc
 where proname in ('shield_access_touch', 'shield_policy_report', 'vault_org_footprint', 'vault_org_export', 'vault_org_erase', 'shield_gc')     -- (6)
union all select 'p65_tables', count(*)::text from pg_tables where schemaname = 'public' and tablename in ('portal_admin_access', 'portal_shield_seals')   -- (2)
union all select 'org_columns', count(*)::text from information_schema.columns
 where table_schema = 'public' and table_name = 'portal_organizations' and column_name in ('frozen_at', 'frozen_reason', 'frozen_by', 'erase_at', 'erase_requested_by', 'erase_reason')   -- (6)
union all select 'tables_total',       count(*)::text from public.shield_policy_report()                            -- (≈190+)
union all select 'tables_without_rls', count(*)::text from public.shield_policy_report() where not rls_enabled        -- (0 هو الهدف — إن ظهر رقم: انظر القائمة أدناه)
union all select 'tables_open_read',   count(*)::text from public.shield_policy_report() where open_read              -- (كتالوجات عامة فقط؛ تُراجَع يدويًا)
union all select 'tables_anon_write',  count(*)::text from public.shield_policy_report() where anon_write             -- (يُراجَع كل صفّ)
union all select 'org_fk_tables',      count(*)::text from pg_constraint where contype = 'f' and confrelid = 'public.portal_organizations'::regclass;   -- (≈30)

-- القوائم التي تحتاج عينًا بشرية (انسخها لي إن لم تكن فارغة):
select 'NO_RLS' as kind, table_name from public.shield_policy_report() where not rls_enabled
union all select 'OPEN_READ', table_name from public.shield_policy_report() where open_read
union all select 'ANON_WRITE', table_name from public.shield_policy_report() where anon_write
order by 1, 2;

-- =====================================================================================================
--  (اختياري — لا يُنفَّذ إلا بعد مراجعة قائمة NO_RLS معي): تفعيل RLS على ما تبقّى مع إبقاء وصول المسجَّلين كما هو ومنع anon
-- =====================================================================================================
-- do $$ declare r record; begin
--   for r in select table_name from public.shield_policy_report() where not rls_enabled loop
--     execute format('alter table public.%I enable row level security', r.table_name);
--     execute format('create policy %I on public.%I for all to authenticated using (true) with check (true)', r.table_name || '_authenticated_all', r.table_name);
--   end loop; end $$;
