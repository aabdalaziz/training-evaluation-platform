-- © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
-- بوّابة أَثَر — P5-ب: الحقائب المرخَّصة (معاينة للزائر · شراء بفاتورة · ترخيص مسجَّل)
--  · portal_resources.price_sar            سعر الحقيبة قبل الضريبة (افتراضيًّا 990 ر.س)
--  · access = 'paid'                       مستوى وصول جديد: يرى الزائر الاسم والنواتج وقائمة الملفّات فقط، والتنزيل بعد الشراء/الإذن
--  · portal_invoices.resource_id           فاتورة حقيبة (نفس الترقيم والضريبة ونفس صفحة /pay)
--  · portal_resource_grants                سجلّ التراخيص (من فاتورة مدفوعة أو منح يدوي من الطاقم) — بريد + معرّف
--  · portal_issue_resource_invoice(uuid)   يُصدر فاتورة الحقيبة للمستخدم الحالي (أو يعيد فاتورته المعلّقة)
--  · trg_resource_invoice_paid()           عند «مدفوعة/معفاة» يُسجَّل الترخيص تلقائيًّا
--  · portal_grant_resource(uuid, text, text) منح يدوي من الطاقم (مدير/مدير برامج) لبريد
--  · التسليم: عند السداد تُرسل ملفّات الحقيبة إلى بريد الفاتورة (الخادم)، والتنزيل من الموقع مرّة واحدة لكلّ ملفّ (downloads/download_limit)
--  · portal_resource_access()              تُرجع الآن أيضًا 'purchase' (مرخَّصة ولا ترخيص للمستخدم)
--  · كلّ الحقائب الحالية تتحوّل إلى 'paid' (قرار المالك 2026-11-25: بلا استثناء)
-- آمن لإعادة التشغيل (idempotent).

-- 1) الحقيبة: السعر + مستوى الوصول الجديد
alter table public.portal_resources add column if not exists price_sar numeric(10,2) not null default 990;
alter table public.portal_resources drop constraint if exists pr_access_chk;
alter table public.portal_resources add constraint pr_access_chk check (access in ('public','registered','program','org','staff','paid'));
alter table public.portal_resources drop constraint if exists pr_price_chk;
alter table public.portal_resources add constraint pr_price_chk check (price_sar >= 0);
alter table public.portal_resources alter column access set default 'paid';
update public.portal_resources set access = 'paid', updated_at = now() where access <> 'paid';

-- 2) الفاتورة تعرف الحقيبة
alter table public.portal_invoices add column if not exists resource_id uuid references public.portal_resources(id) on delete set null;
create index if not exists portal_invoices_resource_idx on public.portal_invoices (resource_id, user_id) where resource_id is not null;

-- 3) سجلّ التراخيص
create table if not exists public.portal_resource_grants (
  id           uuid primary key default gen_random_uuid(),
  resource_id  uuid not null references public.portal_resources(id) on delete cascade,
  user_id      uuid references auth.users(id) on delete set null,
  email        text not null,
  source       text not null default 'invoice',   -- invoice | staff
  invoice_id   uuid references public.portal_invoices(id) on delete set null,
  note         text,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  downloads    jsonb not null default '{}'::jsonb,   -- file_id → عدد مرّات التنزيل من الموقع
  download_limit int not null default 1,            -- مرّة واحدة لكلّ ملفّ (قرار المالك) — الطاقم يعيد الضبط
  delivered_at timestamptz,                          -- آخر إرسال للملفّات إلى بريد صاحب الترخيص
  constraint prg_source_chk check (source in ('invoice','staff'))
);
alter table public.portal_resource_grants add column if not exists downloads jsonb not null default '{}'::jsonb;
alter table public.portal_resource_grants add column if not exists download_limit int not null default 1;
alter table public.portal_resource_grants add column if not exists delivered_at timestamptz;
create unique index if not exists prg_resource_email_uq on public.portal_resource_grants (resource_id, lower(email));
create index if not exists prg_user_idx on public.portal_resource_grants (user_id);
alter table public.portal_resource_grants enable row level security;
drop policy if exists prg_own_read on public.portal_resource_grants;
create policy prg_own_read on public.portal_resource_grants for select to authenticated
  using (user_id = auth.uid() or lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')) or public.portal_is_staff());
drop policy if exists prg_write on public.portal_resource_grants;
create policy prg_write on public.portal_resource_grants for all to authenticated using (public.portal_is_writer()) with check (public.portal_is_writer());

-- 4) هل للمستخدم ترخيص؟ (بالمعرّف أو بالبريد)
create or replace function public.portal_resource_granted(p_resource uuid, p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.portal_resource_grants g
    where g.resource_id = p_resource
      and (g.user_id = p_user or lower(g.email) = (select lower(u.email) from auth.users u where u.id = p_user))
  );
$$;
revoke all on function public.portal_resource_granted(uuid, uuid) from public;
grant execute on function public.portal_resource_granted(uuid, uuid) to authenticated, service_role;

-- 5) قرار الوصول: ok | login | program | org | staff | purchase | not_found
create or replace function public.portal_resource_access(p_resource uuid, p_user uuid default auth.uid())
returns text language plpgsql stable security definer set search_path = public as $$
declare r record; v_email text; v_domain text;
begin
  select * into r from public.portal_resources where id = p_resource and status = 'published';
  if not found then return 'not_found'; end if;
  if r.access = 'public' then return 'ok'; end if;
  if p_user is null then return 'login'; end if;
  if exists (select 1 from public.profiles p where p.id = p_user and upper(p.role::text) in ('PLATFORM_ADMIN','SUPER_ADMIN','ADMIN','PROGRAM_MANAGER','QUALITY_ANALYST','TRAINER')) then return 'ok'; end if;
  if r.access = 'paid' then
    if public.portal_resource_granted(p_resource, p_user) then return 'ok'; end if;
    return 'purchase';
  end if;
  if r.access = 'registered' then return 'ok'; end if;
  if r.access = 'staff' then return 'staff'; end if;
  if r.access = 'program' then
    if r.program_id is null then return 'ok'; end if;
    if exists (select 1 from public.portal_enrollments e where e.program_id = r.program_id and e.user_id = p_user and e.status in ('approved','completed')) then return 'ok'; end if;
    return 'program';
  end if;
  if r.access = 'org' then
    if r.organization_id is null then return 'ok'; end if;
    select lower(u.email) into v_email from auth.users u where u.id = p_user;
    v_domain := split_part(coalesce(v_email, ''), '@', 2);
    if exists (select 1 from public.portal_organizations o where o.id = r.organization_id and o.email_domain is not null and lower(o.email_domain) = v_domain) then return 'ok'; end if;
    if exists (select 1 from public.portal_enrollments e where e.user_id = p_user and e.organization_id = r.organization_id) then return 'ok'; end if;
    return 'org';
  end if;
  return 'staff';
end $$;
revoke all on function public.portal_resource_access(uuid, uuid) from public;
grant execute on function public.portal_resource_access(uuid, uuid) to anon, authenticated, service_role;

-- 6) فاتورة الحقيبة للمستخدم الحالي (أو إعادة فاتورته المعلّقة لنفس الحقيبة)
create or replace function public.portal_issue_resource_invoice(p_resource uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare r record; s record; v_name text; v_phone text; v_email text; v_no text; v_sub numeric; v_vat numeric; v_total numeric; v_id uuid;
begin
  if auth.uid() is null then raise exception 'sign_in_required'; end if;
  select * into r from public.portal_resources where id = p_resource and status = 'published';
  if r is null then raise exception 'resource_not_found'; end if;
  if r.access <> 'paid' then raise exception 'not_paid_resource'; end if;
  if coalesce(r.price_sar, 0) <= 0 then raise exception 'price_not_set'; end if;
  v_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  if v_email = '' then raise exception 'email_required'; end if;
  if public.portal_resource_granted(p_resource, auth.uid()) then raise exception 'already_granted'; end if;
  select id into v_id from public.portal_invoices where user_id = auth.uid() and resource_id = p_resource and status in ('unpaid', 'under_review') order by created_at desc limit 1;
  if v_id is not null then return v_id; end if;
  select * into s from public.portal_payment_settings where id = 1 for update;
  v_no := s.invoice_prefix || '-' || to_char(now(), 'YYYY') || '-' || lpad(s.next_invoice_no::text, 5, '0');
  update public.portal_payment_settings set next_invoice_no = next_invoice_no + 1, updated_at = now() where id = 1;
  if s.prices_include_vat then
    v_total := round(r.price_sar, 2); v_sub := round(r.price_sar / (1 + s.vat_rate / 100), 2); v_vat := v_total - v_sub;
  else
    v_sub := round(r.price_sar, 2); v_vat := round(r.price_sar * s.vat_rate / 100, 2); v_total := v_sub + v_vat;
  end if;
  select full_name, phone into v_name, v_phone from public.profiles where id = auth.uid();
  insert into public.portal_invoices (invoice_no, user_id, customer_name, customer_email, customer_phone, description, currency, subtotal, vat_rate, vat_amount, total, due_date, lang, resource_id)
  values (v_no, auth.uid(), coalesce(nullif(v_name, ''), v_email), v_email, v_phone,
          'ترخيص استخدام حقيبة أَثَر — ' || r.title_ar || ' (الإصدار ' || coalesce(r.version, '1.0') || ')',
          s.currency, v_sub, s.vat_rate, v_vat, v_total, (current_date + least(s.due_days, 3)), 'ar', p_resource)
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.portal_issue_resource_invoice(uuid) from public, anon;
grant execute on function public.portal_issue_resource_invoice(uuid) to authenticated;

-- 7) الترخيص التلقائي عند السداد (مدفوعة/معفاة) — مرّة واحدة لكلّ فاتورة
create or replace function public.trg_resource_invoice_paid() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.resource_id is null then return new; end if;
  if new.status not in ('paid', 'waived') then return new; end if;
  if tg_op = 'UPDATE' and old.status in ('paid', 'waived') then return new; end if;
  if exists (select 1 from public.portal_resource_grants where invoice_id = new.id) then return new; end if;
  insert into public.portal_resource_grants (resource_id, user_id, email, source, invoice_id, note)
  values (new.resource_id, new.user_id, lower(new.customer_email), 'invoice', new.id, 'فاتورة ' || new.invoice_no)
  on conflict (resource_id, lower(email)) do update set invoice_id = excluded.invoice_id, user_id = coalesce(public.portal_resource_grants.user_id, excluded.user_id), note = excluded.note;
  return new;
end $$;
drop trigger if exists portal_invoices_resource_grant on public.portal_invoices;
create trigger portal_invoices_resource_grant after insert or update of status on public.portal_invoices
  for each row execute function public.trg_resource_invoice_paid();

-- 8) منح يدوي من الطاقم (مدير/مدير برامج): ترخيص لبريد بلا فاتورة
create or replace function public.portal_grant_resource(p_resource uuid, p_email text, p_note text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_uid uuid; v_email text;
begin
  if not public.portal_is_writer() then raise exception 'not_allowed'; end if;
  v_email := lower(trim(p_email));
  if v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then raise exception 'bad_email'; end if;
  if not exists (select 1 from public.portal_resources where id = p_resource) then raise exception 'resource_not_found'; end if;
  select id into v_uid from auth.users where lower(email) = v_email limit 1;
  insert into public.portal_resource_grants (resource_id, user_id, email, source, note, created_by)
  values (p_resource, v_uid, v_email, 'staff', nullif(trim(coalesce(p_note, '')), ''), auth.uid())
  on conflict (resource_id, lower(email)) do update set note = coalesce(excluded.note, public.portal_resource_grants.note), user_id = coalesce(public.portal_resource_grants.user_id, excluded.user_id)
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.portal_grant_resource(uuid, text, text) from public, anon;
grant execute on function public.portal_grant_resource(uuid, text, text) to authenticated;

-- 9) توحيد فقرة «شروط الاستخدام» في وصف الحقائب المنشورة/المسودة (الدفعتان ١ و٢) مع نموذج الترخيص — آمن للتكرار
update public.portal_resources
   set body_ar = regexp_replace(body_ar, 'شروط الاستخدام[[:space:]]*.*$', 'شروط الاستخدام' || E'\n' || 'ترخيص استخدام شخصيّ باسم المشتري: تنزيل الملفّات واستخدامها داخل عملك أو أسرتك، دون إعادة نشر أو نقل أو مشاركة. يُسجَّل كلّ تنزيل باسم صاحب الترخيص. الملفّات محميّة بحقوق المؤلّف © 2026 د. أحمد محمد عبدالعزيز بدوي.'),
       body_en = replace(replace(replace(coalesce(body_en, ''), 'Educational, non-commercial use with attribution.', 'Personal licence per purchaser; no redistribution.'), 'Free for parents with attribution.', 'Personal family licence per purchaser; no redistribution.'), 'Free to use with attribution.', 'Personal licence per purchaser; no redistribution.'),
       updated_at = now()
 where body_ar like '%شروط الاستخدام%' and body_ar not like '%ترخيص استخدام شخصيّ باسم المشتري%';

-- 10) تحقّق
select 'price_sar' as what, count(*) as n from information_schema.columns where table_name = 'portal_resources' and column_name = 'price_sar'
union all select 'invoices.resource_id', count(*) from information_schema.columns where table_name = 'portal_invoices' and column_name = 'resource_id'
union all select 'grants table', count(*) from information_schema.tables where table_name = 'portal_resource_grants'
union all select 'grants policies', count(*) from pg_policies where tablename = 'portal_resource_grants'
union all select 'functions', count(*) from pg_proc where proname in ('portal_resource_access','portal_resource_granted','portal_issue_resource_invoice','trg_resource_invoice_paid','portal_grant_resource')
union all select 'trigger', count(*) from pg_trigger where tgname = 'portal_invoices_resource_grant'
union all select 'delivery columns', count(*) from information_schema.columns where table_name = 'portal_resource_grants' and column_name in ('downloads','download_limit','delivered_at')
union all select 'resources now paid', count(*) from public.portal_resources where access = 'paid'
union all select 'licence text applied', count(*) from public.portal_resources where body_ar like '%ترخيص استخدام شخصيّ باسم المشتري%';
