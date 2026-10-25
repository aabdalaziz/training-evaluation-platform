me: athar-sql
description: Write Supabase/Postgres migrations for the Athar portal with idempotent DDL, RLS policies, SECURITY DEFINER RPCs, storage buckets and a single UNION diagnostic. Use for any schema change in github.com/aabdalaziz/training-evaluation-platform.
Athar — SQL migrations
File
supabase/migrations/YYYYMMDD_portal_pN.sql, applied by the owner in Supabase SQL Editor (one paste, one Run). The editor shows only the LAST result set → end with exactly one select ... union all select ... diagnostic and state the expected counts in the step guide.

Template
SQL

-- N) tables
create table if not exists public.portal_x (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid references auth.users(id) on delete set null,
  status text not null default 'new' check (status in ('new','...')),
  sector text, level text, delivery text, ai_ready boolean not null default false, lang text default 'ar'
);
alter table public.portal_x add column if not exists new_col text;      -- additive changes only
create index if not exists portal_x_user_idx on public.portal_x(user_id);
alter table public.portal_x enable row level security;

-- policies: drop+create for idempotency
drop policy if exists px_owner_read on public.portal_x;
create policy px_owner_read on public.portal_x for select to authenticated using (user_id = auth.uid());
drop policy if exists px_staff_read on public.portal_x;
create policy px_staff_read on public.portal_x for select to authenticated using (public.portal_is_staff());
drop policy if exists px_writer_all on public.portal_x;
create policy px_writer_all on public.portal_x for all to authenticated using (public.portal_is_writer()) with check (public.portal_is_writer());

-- RPC (user-callable, runs with definer rights)
create or replace function public.portal_do_x(p_id uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare r record; begin
  select * into r from public.portal_x where id = p_id and user_id = auth.uid();
  if not found then raise exception 'not_found'; end if;
  -- ...
  return r.id;
end $$;
revoke all on function public.portal_do_x(uuid) from public, anon;
grant execute on function public.portal_do_x(uuid) to authenticated;

-- diagnostic (single result set)
select 'x policies' as t, count(*) as n from pg_policies where tablename = 'portal_x'
union all select 'do_x()', count(*) from pg_proc where proname = 'portal_do_x';
Existing helpers (reuse, do not redefine differently)
public.portal_is_staff() (PLATFORM_ADMIN, SUPER_ADMIN, ADMIN, PROGRAM_MANAGER, QUALITY_ANALYST), public.portal_is_writer() (without QUALITY_ANALYST).
portal_payment_settings (id=1) for invoice numbering; portal_issue_invoice(p_enrollment); portal_quote_respond(p_quote, p_accept, p_note) shows how to issue an invoice from an RPC.
Roles are stored in profiles.role (text, uppercase); compare with upper(role::text) if enum.
Pitfalls (learned in production)
42P13: changing a function's return type requires drop function first.
New functions get EXECUTE for anon/authenticated by default → revoke for service-only RPCs.
PostgREST insert().select() from the client requires a SELECT policy for the role.
Production may contain legacy same-name tables/triggers → always if not exists/DO blocks; never drop table.
Triggers that set organization_id must only be attached to tables that have that column.
pgcrypto lives in the extensions schema; gen_random_uuid() is available without schema prefix.
Storage: insert into storage.buckets (id, name, public) values ('portal-x','portal-x',false) on conflict do nothing; + policies on storage.objects keyed by bucket_id and (storage.foldername(name))[1] = auth.uid()::text.
Validate locally: pip install pglast && python3 -c "import pglast; pglast.parse_sql(open('f.sql').read()); print('SQL OK')".
