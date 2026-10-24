-- بوابة أَثَر — المرحلة P4: الاستشارات (طلب → عرض سعر → قبول → تنفيذ ومتابعة)
-- آمن للتكرار. يعتمد على P3 (portal_invoices, portal_payment_settings).

-- 1) طلبات الاستشارة
create table if not exists public.portal_consulting_requests (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  user_id        uuid references auth.users(id) on delete set null,
  full_name      text not null,
  email          text not null,
  phone          text,
  organization   text,
  sector         text,                                   -- gov | edu | private | nonprofit | other
  area           text not null,                          -- management | academic | educational | quality
  title          text not null,
  details        text not null,
  goals          text,
  timeline       text,
  budget_range   text,
  lang           text not null default 'ar',
  status         text not null default 'new',            -- new | reviewing | quoted | accepted | declined | in_progress | completed | closed | cancelled
  assigned_to    uuid references auth.users(id) on delete set null,
  internal_notes text,
  client_note    text,
  decided_at     timestamptz,
  completed_at   timestamptz,
  invoice_id     uuid references public.portal_invoices(id) on delete set null,
  constraint pcr_area_chk check (area in ('management','academic','educational','quality')),
  constraint pcr_status_chk check (status in ('new','reviewing','quoted','accepted','declined','in_progress','completed','closed','cancelled'))
);
create index if not exists pcr_status_idx on public.portal_consulting_requests (status, created_at desc);
create index if not exists pcr_user_idx on public.portal_consulting_requests (user_id);

-- 2) عروض الأسعار (نسخ متعددة لكل طلب)
create table if not exists public.portal_consulting_quotes (
  id            uuid primary key default gen_random_uuid(),
  request_id    uuid not null references public.portal_consulting_requests(id) on delete cascade,
  created_at    timestamptz not null default now(),
  created_by    uuid references auth.users(id) on delete set null,
  version       int not null default 1,
  currency      text not null default 'SAR',
  items         jsonb not null default '[]'::jsonb,      -- [{"d":"وصف","q":1,"u":1000}]
  subtotal      numeric(12,2) not null default 0,
  vat_rate      numeric(5,2) not null default 0,
  vat_amount    numeric(12,2) not null default 0,
  total         numeric(12,2) not null default 0,
  valid_until   date,
  scope         text,
  deliverables  text,
  duration      text,
  terms         text,
  status        text not null default 'draft',          -- draft | sent | accepted | declined | superseded
  sent_at       timestamptz,
  responded_at  timestamptz,
  client_note   text,
  constraint pcq_status_chk check (status in ('draft','sent','accepted','declined','superseded'))
);
create index if not exists pcq_request_idx on public.portal_consulting_quotes (request_id, version desc);

-- 3) مراحل التنفيذ
create table if not exists public.portal_consulting_milestones (
  id                uuid primary key default gen_random_uuid(),
  request_id        uuid not null references public.portal_consulting_requests(id) on delete cascade,
  created_at        timestamptz not null default now(),
  position          int not null default 0,
  title             text not null,
  due_date          date,
  status            text not null default 'planned',    -- planned | in_progress | done
  note              text,
  done_at           timestamptz,
  visible_to_client boolean not null default true,
  constraint pcm_status_chk check (status in ('planned','in_progress','done'))
);
create index if not exists pcm_request_idx on public.portal_consulting_milestones (request_id, position);

-- 4) سجل التحديثات / الرسائل
create table if not exists public.portal_consulting_updates (
  id                uuid primary key default gen_random_uuid(),
  request_id        uuid not null references public.portal_consulting_requests(id) on delete cascade,
  created_at        timestamptz not null default now(),
  author_id         uuid references auth.users(id) on delete set null,
  author_name       text,
  by_staff          boolean not null default false,
  body              text not null,
  visible_to_client boolean not null default true
);
create index if not exists pcu_request_idx on public.portal_consulting_updates (request_id, created_at);

-- ربط الفاتورة بطلب الاستشارة
alter table public.portal_invoices add column if not exists consulting_request_id uuid references public.portal_consulting_requests(id) on delete set null;

-- 5) RLS
create or replace function public.portal_is_staff() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and upper(p.role::text) in ('PLATFORM_ADMIN','SUPER_ADMIN','ADMIN','PROGRAM_MANAGER','QUALITY_ANALYST'));
$$;
create or replace function public.portal_is_writer() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and upper(p.role::text) in ('PLATFORM_ADMIN','SUPER_ADMIN','ADMIN','PROGRAM_MANAGER'));
$$;
grant execute on function public.portal_is_staff() to authenticated;
grant execute on function public.portal_is_writer() to authenticated;

alter table public.portal_consulting_requests enable row level security;
drop policy if exists pcr_owner_read on public.portal_consulting_requests;
create policy pcr_owner_read on public.portal_consulting_requests for select to authenticated using (user_id = auth.uid() or public.portal_is_staff());
drop policy if exists pcr_owner_insert on public.portal_consulting_requests;
create policy pcr_owner_insert on public.portal_consulting_requests for insert to authenticated with check (user_id = auth.uid());
drop policy if exists pcr_owner_cancel on public.portal_consulting_requests;
create policy pcr_owner_cancel on public.portal_consulting_requests for update to authenticated
  using (user_id = auth.uid() and status in ('new','reviewing')) with check (user_id = auth.uid() and status in ('new','reviewing','cancelled'));
drop policy if exists pcr_staff_write on public.portal_consulting_requests;
create policy pcr_staff_write on public.portal_consulting_requests for all to authenticated using (public.portal_is_writer()) with check (public.portal_is_writer());
grant select, insert, update on public.portal_consulting_requests to authenticated;

alter table public.portal_consulting_quotes enable row level security;
drop policy if exists pcq_owner_read on public.portal_consulting_quotes;
create policy pcq_owner_read on public.portal_consulting_quotes for select to authenticated
  using (public.portal_is_staff() or (status <> 'draft' and exists (select 1 from public.portal_consulting_requests r where r.id = request_id and r.user_id = auth.uid())));
drop policy if exists pcq_staff_write on public.portal_consulting_quotes;
create policy pcq_staff_write on public.portal_consulting_quotes for all to authenticated using (public.portal_is_writer()) with check (public.portal_is_writer());
grant select, insert, update, delete on public.portal_consulting_quotes to authenticated;

alter table public.portal_consulting_milestones enable row level security;
drop policy if exists pcm_read on public.portal_consulting_milestones;
create policy pcm_read on public.portal_consulting_milestones for select to authenticated
  using (public.portal_is_staff() or (visible_to_client and exists (select 1 from public.portal_consulting_requests r where r.id = request_id and r.user_id = auth.uid())));
drop policy if exists pcm_staff_write on public.portal_consulting_milestones;
create policy pcm_staff_write on public.portal_consulting_milestones for all to authenticated using (public.portal_is_writer()) with check (public.portal_is_writer());
grant select, insert, update, delete on public.portal_consulting_milestones to authenticated;

alter table public.portal_consulting_updates enable row level security;
drop policy if exists pcu_read on public.portal_consulting_updates;
create policy pcu_read on public.portal_consulting_updates for select to authenticated
  using (public.portal_is_staff() or (visible_to_client and exists (select 1 from public.portal_consulting_requests r where r.id = request_id and r.user_id = auth.uid())));
drop policy if exists pcu_insert on public.portal_consulting_updates;
create policy pcu_insert on public.portal_consulting_updates for insert to authenticated
  with check (author_id = auth.uid() and (public.portal_is_writer() or (visible_to_client and not by_staff and exists (select 1 from public.portal_consulting_requests r where r.id = request_id and r.user_id = auth.uid()))));
drop policy if exists pcu_staff_write on public.portal_consulting_updates;
create policy pcu_staff_write on public.portal_consulting_updates for update to authenticated using (public.portal_is_writer()) with check (public.portal_is_writer());
grant select, insert, update on public.portal_consulting_updates to authenticated;

-- 6) ردّ العميل على عرض السعر (قبول → فاتورة تلقائيًا)
create or replace function public.portal_quote_respond(p_quote uuid, p_accept boolean, p_note text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare q record; r record; s record; v_no text; v_id uuid;
begin
  select * into q from public.portal_consulting_quotes where id = p_quote;
  if q is null then raise exception 'quote not found'; end if;
  select * into r from public.portal_consulting_requests where id = q.request_id;
  if r.user_id is distinct from auth.uid() and not public.portal_is_writer() then raise exception 'not allowed'; end if;
  if q.status <> 'sent' then raise exception 'quote is not open'; end if;
  if q.valid_until is not null and q.valid_until < current_date then raise exception 'quote expired'; end if;
  update public.portal_consulting_quotes set status = case when p_accept then 'accepted' else 'declined' end, responded_at = now(), client_note = p_note where id = p_quote;
  if not p_accept then
    update public.portal_consulting_requests set status = 'declined', decided_at = now(), client_note = p_note, updated_at = now() where id = r.id;
    return null;
  end if;
  v_id := r.invoice_id;
  if v_id is null and q.total > 0 then
    select * into s from public.portal_payment_settings where id = 1 for update;
    v_no := s.invoice_prefix || '-' || to_char(now(), 'YYYY') || '-' || lpad(s.next_invoice_no::text, 5, '0');
    update public.portal_payment_settings set next_invoice_no = next_invoice_no + 1, updated_at = now() where id = 1;
    insert into public.portal_invoices (invoice_no, consulting_request_id, user_id, customer_name, customer_email, customer_phone, customer_org, description, currency, subtotal, vat_rate, vat_amount, total, due_date, lang)
    values (v_no, r.id, r.user_id, r.full_name, r.email, r.phone, r.organization, 'خدمة استشارية: ' || r.title, q.currency, q.subtotal, q.vat_rate, q.vat_amount, q.total, (current_date + s.due_days), coalesce(r.lang, 'ar'))
    returning id into v_id;
  end if;
  update public.portal_consulting_requests set status = 'accepted', decided_at = now(), client_note = p_note, invoice_id = v_id, updated_at = now() where id = r.id;
  return v_id;
end $$;
revoke all on function public.portal_quote_respond(uuid, boolean, text) from public, anon;
grant execute on function public.portal_quote_respond(uuid, boolean, text) to authenticated;

-- 7) تحقق
select 'requests policies' as t, count(*) as n from pg_policies where tablename = 'portal_consulting_requests'
union all select 'quotes policies', count(*) from pg_policies where tablename = 'portal_consulting_quotes'
union all select 'milestones+updates policies', count(*) from pg_policies where tablename in ('portal_consulting_milestones','portal_consulting_updates')
union all select 'quote_respond()', count(*) from pg_proc where proname = 'portal_quote_respond'
union all select 'invoices.consulting_request_id', count(*) from information_schema.columns where table_name = 'portal_invoices' and column_name = 'consulting_request_id';
