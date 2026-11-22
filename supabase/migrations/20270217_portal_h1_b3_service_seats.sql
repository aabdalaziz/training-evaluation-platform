-- © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved.
-- هـ-1/3 (2026-11-23): مقاعد الخدمات (service seats) — أوّل خدمة: اقْرَأْ.
--  · service_plans         خطط الاشتراك لكل خدمة (أسعار قابلة للتعديل دون نشر)
--  · service_entitlements  المقعد الفعلي: بريد + خدمة + بداية/نهاية + مصدره (تجربة/فاتورة/طاقم/جهة)
--  · portal_invoices       عمودان جديدان service/plan_code، فاتورة خدمة بلا تسجيل برنامج
--  · portal_issue_service_invoice(service, plan)   يُصدر فاتورة الخطّة للمستخدم الحالي (نفس ترقيم فواتير أَثَر وضريبتها)
--  · portal_start_trial(service)                   تجربة واحدة لكل بريد لكل خدمة
--  · trg: عند paid/waived لفاتورة خدمة → يُمنح/يُمدَّد المقعد تلقائيًّا (يعمل مع البطاقة والتحويل والإعفاء وwebhook)
-- حساب الدفع تجريبيّ الآن (مفاتيح Moyasar test)؛ الحساب الحقيقي = تبديل المفاتيح فقط.

create table if not exists public.service_plans (
  service     text not null,                       -- iqra | miaar | …
  code        text not null,                       -- trial | month | quarter | year
  name_ar     text not null,
  blurb_ar    text not null default '',
  days        int  not null check (days > 0),
  price       numeric(12,2) not null default 0,    -- بالريال (شاملة/غير شاملة الضريبة بحسب إعدادات الدفع)
  sort        int  not null default 0,
  active      boolean not null default true,
  updated_at  timestamptz not null default now(),
  primary key (service, code)
);
alter table public.service_plans enable row level security;
drop policy if exists service_plans_read on public.service_plans;
create policy service_plans_read on public.service_plans for select using (active);

insert into public.service_plans (service, code, name_ar, blurb_ar, days, price, sort) values
  ('iqra', 'trial',   'تجربة ٧ أيام',  'كل حلقات مستواك ومراجعاتك ودفترك — مرّة واحدة لكل حساب، بلا بطاقة.', 7,   0,   0),
  ('iqra', 'month',   'شهر',           'مستواك كاملًا مع المراجعات المتباعدة ودفتر الكلمات وحلقات الصوت.',    30,  99,  1),
  ('iqra', 'quarter', 'ثلاثة أشهر',    'وقتٌ يكفي لعبور مستوى: الحلقات + اختبار العبور + شهادة المستوى.',     90,  249, 2),
  ('iqra', 'year',    'سنة',           'رحلة كاملة على السُّلّم — كلّ مستوى تعبره يفتح الذي بعده.',             365, 799, 3)
on conflict (service, code) do nothing;

create table if not exists public.service_entitlements (
  id             uuid primary key default gen_random_uuid(),
  service        text not null,
  learner_email  text not null,
  user_id        uuid references auth.users(id) on delete set null,
  plan_code      text not null,
  source         text not null default 'invoice',   -- trial | invoice | staff | org
  starts_at      timestamptz not null default now(),
  ends_at        timestamptz not null,
  invoice_id     uuid references public.portal_invoices(id) on delete set null,
  granted_by     uuid references auth.users(id) on delete set null,
  note           text,
  created_at     timestamptz not null default now()
);
create index if not exists service_entitlements_email_idx on public.service_entitlements (service, learner_email, ends_at desc);
create unique index if not exists service_entitlements_invoice_uq on public.service_entitlements (invoice_id) where invoice_id is not null;
create unique index if not exists service_entitlements_trial_uq on public.service_entitlements (service, learner_email) where source = 'trial';
alter table public.service_entitlements enable row level security;
drop policy if exists service_entitlements_own on public.service_entitlements;
create policy service_entitlements_own on public.service_entitlements for select using (user_id = auth.uid() or lower(learner_email) = lower(coalesce(auth.jwt() ->> 'email', '')));

alter table public.portal_invoices add column if not exists service   text;
alter table public.portal_invoices add column if not exists plan_code text;
create index if not exists portal_invoices_service_idx on public.portal_invoices (service, customer_email) where service is not null;

-- فاتورة خطّة خدمة للمستخدم الحالي (أو إعادة فاتورته غير المدفوعة لنفس الخطّة)
create or replace function public.portal_issue_service_invoice(p_service text, p_plan text)
returns uuid language plpgsql security definer set search_path = public as $$
declare pl record; s record; v_name text; v_phone text; v_email text; v_no text; v_sub numeric; v_vat numeric; v_total numeric; v_id uuid;
begin
  if auth.uid() is null then raise exception 'sign_in_required'; end if;
  select * into pl from public.service_plans where service = p_service and code = p_plan and active and price > 0;
  if pl is null then raise exception 'plan_not_found'; end if;
  v_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  if v_email = '' then raise exception 'email_required'; end if;
  select id into v_id from public.portal_invoices where user_id = auth.uid() and service = p_service and plan_code = p_plan and status in ('unpaid', 'under_review') order by created_at desc limit 1;
  if v_id is not null then return v_id; end if;
  select * into s from public.portal_payment_settings where id = 1 for update;
  v_no := s.invoice_prefix || '-' || to_char(now(), 'YYYY') || '-' || lpad(s.next_invoice_no::text, 5, '0');
  update public.portal_payment_settings set next_invoice_no = next_invoice_no + 1, updated_at = now() where id = 1;
  if s.prices_include_vat then
    v_total := round(pl.price, 2); v_sub := round(pl.price / (1 + s.vat_rate / 100), 2); v_vat := v_total - v_sub;
  else
    v_sub := round(pl.price, 2); v_vat := round(pl.price * s.vat_rate / 100, 2); v_total := v_sub + v_vat;
  end if;
  select full_name, phone into v_name, v_phone from public.profiles where id = auth.uid();
  insert into public.portal_invoices (invoice_no, user_id, customer_name, customer_email, customer_phone, description, currency, subtotal, vat_rate, vat_amount, total, due_date, lang, service, plan_code)
  values (v_no, auth.uid(), coalesce(nullif(v_name, ''), v_email), v_email, v_phone,
          case when p_service = 'iqra' then 'اشتراك اقْرَأْ — ' else 'اشتراك خدمة — ' end || pl.name_ar || ' (' || pl.days || ' يومًا)',
          s.currency, v_sub, s.vat_rate, v_vat, v_total, (current_date + least(s.due_days, 3)), 'ar', p_service, p_plan)
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.portal_issue_service_invoice(text, text) from public, anon;
grant execute on function public.portal_issue_service_invoice(text, text) to authenticated;

-- تجربة مجانية واحدة لكل بريد لكل خدمة
create or replace function public.portal_start_trial(p_service text)
returns table (id uuid, ends_at timestamptz, already boolean) language plpgsql security definer set search_path = public as $$
declare pl record; v_email text; e record;
begin
  if auth.uid() is null then raise exception 'sign_in_required'; end if;
  v_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  select * into pl from public.service_plans where service = p_service and code = 'trial' and active;
  if pl is null then raise exception 'trial_not_available'; end if;
  select * into e from public.service_entitlements se where se.service = p_service and se.learner_email = v_email and se.source = 'trial' limit 1;
  if e is not null then return query select e.id, e.ends_at, true; return; end if;
  return query insert into public.service_entitlements (service, learner_email, user_id, plan_code, source, starts_at, ends_at, note)
    values (p_service, v_email, auth.uid(), 'trial', 'trial', now(), now() + make_interval(days => pl.days), 'تجربة مجانية')
    returning service_entitlements.id, service_entitlements.ends_at, false;
end $$;
revoke all on function public.portal_start_trial(text) from public, anon;
grant execute on function public.portal_start_trial(text) to authenticated;

-- منح المقعد عند سداد فاتورة خدمة (يمتدّ من نهاية المقعد الحالي إن كان ما زال ساريًا)
create or replace function public.trg_service_invoice_paid() returns trigger language plpgsql security definer set search_path = public as $$
declare pl record; v_from timestamptz; v_email text;
begin
  if new.service is null or new.plan_code is null then return new; end if;
  if new.status not in ('paid', 'waived') then return new; end if;
  if tg_op = 'UPDATE' and old.status in ('paid', 'waived') then return new; end if;
  if exists (select 1 from public.service_entitlements where invoice_id = new.id) then return new; end if;
  select * into pl from public.service_plans where service = new.service and code = new.plan_code;
  if pl is null then return new; end if;
  v_email := lower(new.customer_email);
  select greatest(now(), coalesce(max(ends_at), now())) into v_from from public.service_entitlements where service = new.service and learner_email = v_email;
  insert into public.service_entitlements (service, learner_email, user_id, plan_code, source, starts_at, ends_at, invoice_id, note)
  values (new.service, v_email, new.user_id, new.plan_code, 'invoice', v_from, v_from + make_interval(days => pl.days), new.id, 'فاتورة ' || new.invoice_no);
  return new;
end $$;
drop trigger if exists portal_invoices_service_seat on public.portal_invoices;
create trigger portal_invoices_service_seat after insert or update of status on public.portal_invoices
  for each row execute function public.trg_service_invoice_paid();

-- منح يدوي من الطاقم (مدير/مدير برامج): أيّام إضافية لبريد
create or replace function public.portal_grant_seat(p_service text, p_email text, p_days int, p_note text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_role text; v_from timestamptz; v_id uuid; v_email text;
begin
  select upper(role) into v_role from public.profiles where id = auth.uid();
  if v_role not in ('PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER') then raise exception 'forbidden'; end if;
  if p_days is null or p_days < 1 or p_days > 1000 then raise exception 'bad_days'; end if;
  v_email := lower(trim(p_email));
  select greatest(now(), coalesce(max(ends_at), now())) into v_from from public.service_entitlements where service = p_service and learner_email = v_email;
  insert into public.service_entitlements (service, learner_email, plan_code, source, starts_at, ends_at, granted_by, note)
  values (p_service, v_email, 'staff', 'staff', v_from, v_from + make_interval(days => p_days), auth.uid(), p_note) returning id into v_id;
  return v_id;
end $$;
revoke all on function public.portal_grant_seat(text, text, int, text) from public, anon;
grant execute on function public.portal_grant_seat(text, text, int, text) to authenticated;
