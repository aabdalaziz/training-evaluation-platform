-- أَثَر — المرحلة P3: الدفع الآمن (تحويل بنكي موثّق + فواتير + تكامل Moyasar جاهز للتفعيل)
-- آمن لإعادة التشغيل (idempotent)

-- 1) إعدادات الدفع (صف واحد)
create table if not exists public.portal_payment_settings (
  id                    int primary key default 1 check (id = 1),
  updated_at            timestamptz not null default now(),
  bank_name             text not null default '',
  account_name          text not null default 'بوابة التميز للاستشارات والتدريب',
  iban                  text not null default '',
  swift                 text,
  vat_rate              numeric(5,2) not null default 15,     -- % (0 = بلا ضريبة)
  vat_number            text,
  prices_include_vat    boolean not null default true,         -- الرسوم المعلنة شاملة الضريبة؟
  invoice_prefix        text not null default 'ATH',
  next_invoice_no       int not null default 1,
  due_days              int not null default 7,
  bank_transfer_enabled boolean not null default true,
  card_enabled          boolean not null default false,        -- يُفعَّل عند إضافة مفاتيح Moyasar
  currency              text not null default 'SAR',
  terms_ar              text not null default 'تُعدّ الفاتورة مدفوعة بعد تأكيد الإدارة لاستلام المبلغ. لا تُسترد الرسوم بعد بدء البرنامج إلا بموافقة الإدارة.',
  terms_en              text not null default 'The invoice is considered paid once our team confirms receipt. Fees are non-refundable after the program starts unless approved by management.'
);
insert into public.portal_payment_settings (id) values (1) on conflict (id) do nothing;

alter table public.portal_payment_settings enable row level security;
drop policy if exists pps_read_auth on public.portal_payment_settings;
create policy pps_read_auth on public.portal_payment_settings for select to authenticated using (true);
drop policy if exists pps_staff_update on public.portal_payment_settings;
create policy pps_staff_update on public.portal_payment_settings for update to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and upper(p.role::text) in ('PLATFORM_ADMIN','SUPER_ADMIN','ADMIN')))
  with check (true);
grant select, update on public.portal_payment_settings to authenticated;

-- 2) الفواتير
create table if not exists public.portal_invoices (
  id                  uuid primary key default gen_random_uuid(),
  invoice_no          text not null unique,
  created_at          timestamptz not null default now(),
  enrollment_id       uuid references public.portal_enrollments(id) on delete set null,
  program_id          uuid references public.programs(id) on delete set null,
  user_id             uuid references auth.users(id) on delete set null,
  customer_name       text not null,
  customer_email      text not null,
  customer_phone      text,
  customer_org        text,
  description         text not null,
  currency            text not null default 'SAR',
  subtotal            numeric(12,2) not null,
  vat_rate            numeric(5,2) not null default 0,
  vat_amount          numeric(12,2) not null default 0,
  total               numeric(12,2) not null,
  status              text not null default 'unpaid',          -- unpaid | under_review | paid | cancelled | refunded | waived
  method              text,                                     -- bank_transfer | card | cash | waived
  due_date            date,
  paid_at             timestamptz,
  confirmed_by        uuid references auth.users(id) on delete set null,
  receipt_path        text,                                     -- مسار الإيصال في Storage
  receipt_uploaded_at timestamptz,
  transfer_ref        text,
  payer_note          text,
  gateway_payment_id  text,                                     -- معرّف عملية Moyasar
  gateway_payload     jsonb,
  notes               text,
  lang                text not null default 'ar',
  constraint portal_invoices_status_chk check (status in ('unpaid','under_review','paid','cancelled','refunded','waived'))
);
create index if not exists portal_invoices_status_idx on public.portal_invoices (status, created_at desc);
create index if not exists portal_invoices_user_idx on public.portal_invoices (user_id);
create index if not exists portal_invoices_enrollment_idx on public.portal_invoices (enrollment_id);

alter table public.portal_invoices enable row level security;

drop policy if exists pinv_owner_read on public.portal_invoices;
create policy pinv_owner_read on public.portal_invoices for select to authenticated using (user_id = auth.uid());

-- المالك: يرفع إيصال التحويل ويضع الفاتورة «قيد المراجعة» فقط
drop policy if exists pinv_owner_submit on public.portal_invoices;
create policy pinv_owner_submit on public.portal_invoices for update to authenticated
  using (user_id = auth.uid() and status in ('unpaid','under_review'))
  with check (user_id = auth.uid() and status in ('unpaid','under_review'));

drop policy if exists pinv_staff_read on public.portal_invoices;
create policy pinv_staff_read on public.portal_invoices for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and upper(p.role::text) in ('PLATFORM_ADMIN','SUPER_ADMIN','ADMIN','PROGRAM_MANAGER','QUALITY_ANALYST')));
drop policy if exists pinv_staff_write on public.portal_invoices;
create policy pinv_staff_write on public.portal_invoices for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and upper(p.role::text) in ('PLATFORM_ADMIN','SUPER_ADMIN','ADMIN','PROGRAM_MANAGER')))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and upper(p.role::text) in ('PLATFORM_ADMIN','SUPER_ADMIN','ADMIN','PROGRAM_MANAGER')));
grant select, insert, update on public.portal_invoices to authenticated;

-- 3) إصدار فاتورة لطلب مقبول (ترقيم تسلسلي آمن)
create or replace function public.portal_issue_invoice(p_enrollment uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare e record; p record; s record; v_no text; v_sub numeric; v_vat numeric; v_total numeric; v_id uuid;
begin
  select * into e from public.portal_enrollments where id = p_enrollment;
  if e is null then raise exception 'enrollment not found'; end if;
  select id into v_id from public.portal_invoices where enrollment_id = p_enrollment and status <> 'cancelled' limit 1;
  if v_id is not null then return v_id; end if;
  select * into p from public.programs where id = e.program_id;
  if p.fee is null or p.fee <= 0 then return null; end if;      -- مجاني أو غير مسعّر: بلا فاتورة
  select * into s from public.portal_payment_settings where id = 1 for update;
  v_no := s.invoice_prefix || '-' || to_char(now(), 'YYYY') || '-' || lpad(s.next_invoice_no::text, 5, '0');
  update public.portal_payment_settings set next_invoice_no = next_invoice_no + 1, updated_at = now() where id = 1;
  if s.prices_include_vat then
    v_total := round(p.fee, 2); v_sub := round(p.fee / (1 + s.vat_rate / 100), 2); v_vat := v_total - v_sub;
  else
    v_sub := round(p.fee, 2); v_vat := round(p.fee * s.vat_rate / 100, 2); v_total := v_sub + v_vat;
  end if;
  insert into public.portal_invoices (invoice_no, enrollment_id, program_id, user_id, customer_name, customer_email, customer_phone, customer_org, description, currency, subtotal, vat_rate, vat_amount, total, due_date, lang)
  values (v_no, e.id, e.program_id, e.user_id, e.full_name, e.email, e.phone, e.organization, 'رسوم التسجيل: ' || p.name_ar, coalesce(p.currency, s.currency), v_sub, s.vat_rate, v_vat, v_total, (current_date + s.due_days), coalesce(e.lang, 'ar'))
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.portal_issue_invoice(uuid) from public, anon;
grant execute on function public.portal_issue_invoice(uuid) to authenticated;

-- إصدار تلقائي عند القبول
create or replace function public.trg_portal_enroll_invoice() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'approved' and (old.status is distinct from 'approved') then
    begin perform public.portal_issue_invoice(new.id); exception when others then raise notice 'invoice: %', sqlerrm; end;
  end if;
  return new;
end $$;
drop trigger if exists trg_portal_enroll_invoice on public.portal_enrollments;
create trigger trg_portal_enroll_invoice after update of status on public.portal_enrollments
  for each row execute function public.trg_portal_enroll_invoice();

-- 4) مخزن إيصالات التحويل (خاص)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('portal-receipts', 'portal-receipts', false, 5242880, array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do update set public = false, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg','image/png','image/webp','application/pdf'];

drop policy if exists receipts_owner_upload on storage.objects;
create policy receipts_owner_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'portal-receipts' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists receipts_owner_read on storage.objects;
create policy receipts_owner_read on storage.objects for select to authenticated
  using (bucket_id = 'portal-receipts' and ((storage.foldername(name))[1] = auth.uid()::text
         or exists (select 1 from public.profiles p where p.id = auth.uid() and upper(p.role::text) in ('PLATFORM_ADMIN','SUPER_ADMIN','ADMIN','PROGRAM_MANAGER','QUALITY_ANALYST'))));

-- 5) تحقق
select 'portal_invoices policies' as t, count(*) as n from pg_policies where tablename = 'portal_invoices'
union all select 'payment_settings row', count(*) from public.portal_payment_settings
union all select 'issue_invoice()', count(*) from pg_proc where proname = 'portal_issue_invoice'
union all select 'receipts bucket', count(*) from storage.buckets where id = 'portal-receipts'
union all select 'storage policies', count(*) from pg_policies where tablename = 'objects' and policyname like 'receipts_%';
