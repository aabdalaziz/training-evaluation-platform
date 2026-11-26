-- © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
-- P83 — المالية: إغلاق المقعد تلقائيًّا · مطابقة الإيصال الممسوح · إعدادات الاعتماد الآلي · تحرير المقاعد المنتهية مهلتها
-- آمن لإعادة التشغيل (idempotent)

-- 1) المقعد على طلب التسجيل: none (لا رسوم/لم يُقبل بعد) · held (مقبول وبانتظار السداد) · confirmed (مُغلق بعد السداد/الإعفاء) · released (حُرّر لانتهاء المهلة أو الاسترداد)
alter table public.portal_enrollments add column if not exists seat_status text not null default 'none';
alter table public.portal_enrollments add column if not exists seat_confirmed_at timestamptz;
alter table public.portal_enrollments add column if not exists seat_released_at timestamptz;
alter table public.portal_enrollments drop constraint if exists portal_enrollments_seat_chk;
alter table public.portal_enrollments add constraint portal_enrollments_seat_chk check (seat_status in ('none','held','confirmed','released'));
create index if not exists portal_enrollments_seat_idx on public.portal_enrollments (program_id, seat_status);

-- 2) الإيصال الممسوح: ما استخرجه القارئ (مبلغ/تاريخ/مرجع/بنك) ونتيجة المطابقة مع الفاتورة
alter table public.portal_invoices add column if not exists receipt_meta jsonb;
alter table public.portal_invoices add column if not exists receipt_match text;   -- match | partial | mismatch
alter table public.portal_invoices add column if not exists auto_confirmed boolean not null default false;
alter table public.portal_invoices drop constraint if exists portal_invoices_receipt_match_chk;
alter table public.portal_invoices add constraint portal_invoices_receipt_match_chk check (receipt_match is null or receipt_match in ('match','partial','mismatch'));

-- 3) إعدادات P83
alter table public.portal_payment_settings add column if not exists auto_confirm_receipts boolean not null default false; -- اعتماد آلي للإيصال المطابق تمامًا
alter table public.portal_payment_settings add column if not exists seat_grace_days int not null default 3;             -- أيام سماح بعد الاستحقاق قبل تحرير المقعد
alter table public.portal_payment_settings add column if not exists auto_release_seats boolean not null default true;    -- تحرير المقاعد المنتهية مهلتها آليًّا

-- 4) السياسة: المتقدّم يرى حقول المقعد ضمن صفّه (السياسات القائمة تكفي)؛ تحديث receipt_meta/receipt_match ضمن سياسة الرفع القائمة pinv_owner_submit

-- 5) عند القبول: المقعد محجوز (إن كان للبرنامج رسوم) أو مؤكَّد مباشرة (مجاني)
create or replace function public.trg_portal_seat_on_decision() returns trigger language plpgsql security definer set search_path = public as $$
declare v_fee numeric;
begin
  if new.status = 'approved' and old.status is distinct from 'approved' then
    select fee into v_fee from public.programs where id = new.program_id;
    if v_fee is null or v_fee <= 0 then new.seat_status := 'confirmed'; new.seat_confirmed_at := now();
    else new.seat_status := 'held'; end if;
    new.seat_released_at := null;
  elsif new.status in ('rejected','cancelled') and old.status not in ('rejected','cancelled') then
    if new.seat_status in ('held','confirmed') then new.seat_status := 'released'; new.seat_released_at := now(); end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_portal_seat_on_decision on public.portal_enrollments;
create trigger trg_portal_seat_on_decision before update of status on public.portal_enrollments
  for each row execute function public.trg_portal_seat_on_decision();

-- 6) عند السداد/الإعفاء: إغلاق المقعد تلقائيًّا؛ عند الاسترداد/الإلغاء: تحريره
create or replace function public.trg_portal_seat_on_payment() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.enrollment_id is null then return new; end if;
  if new.status in ('paid','waived') and old.status is distinct from new.status then
    update public.portal_enrollments set seat_status = 'confirmed', seat_confirmed_at = now(), seat_released_at = null
      where id = new.enrollment_id and status = 'approved';
  elsif new.status in ('refunded','cancelled') and old.status in ('paid','waived') then
    update public.portal_enrollments set seat_status = 'released', seat_released_at = now()
      where id = new.enrollment_id and seat_status = 'confirmed';
  end if;
  return new;
end $$;
drop trigger if exists trg_portal_seat_on_payment on public.portal_invoices;
create trigger trg_portal_seat_on_payment after update of status on public.portal_invoices
  for each row execute function public.trg_portal_seat_on_payment();

-- 7) تحرير المقاعد المنتهية مهلتها: فاتورة غير مدفوعة تجاوزت الاستحقاق + أيام السماح → الطلب إلى قائمة الانتظار والمقعد released. تُعيد الصفوف المحرَّرة.
create or replace function public.portal_release_expired_seats(p_dry boolean default false)
returns table (enrollment_id uuid, invoice_id uuid, invoice_no text, program_id uuid, full_name text, email text, due_date date, lang text)
language plpgsql security definer set search_path = public as $$
declare s record;
begin
  select * into s from public.portal_payment_settings where id = 1;
  if s is null or not s.auto_release_seats then return; end if;
  return query
  with cand as (
    select e.id as eid, i.id as iid, i.invoice_no as ino, e.program_id as pid, e.full_name as fn, e.email as em, i.due_date as dd, e.lang as lg
    from public.portal_enrollments e join public.portal_invoices i on i.enrollment_id = e.id
    join public.programs p on p.id = e.program_id
    where e.status = 'approved' and e.seat_status = 'held' and i.status = 'unpaid' and i.due_date is not null
      and i.due_date + coalesce(s.seat_grace_days, 0) < current_date
      and (p.start_date is null or p.start_date >= current_date)
  ), upd as (
    update public.portal_enrollments e set status = 'waitlisted', seat_status = 'released', seat_released_at = now(),
      decision_note = coalesce(e.decision_note || ' · ', '') || 'حُرّر المقعد آليًّا: انتهت مهلة السداد ' || to_char(now(), 'YYYY-MM-DD')
    from cand where e.id = cand.eid and not p_dry returning e.id
  ), inv as (
    update public.portal_invoices i set status = 'cancelled', notes = coalesce(i.notes || ' · ', '') || 'أُلغيت آليًّا: انتهت مهلة السداد وحُرّر المقعد'
    from cand where i.id = cand.iid and not p_dry returning i.id
  )
  select cand.eid, cand.iid, cand.ino, cand.pid, cand.fn, cand.em, cand.dd, cand.lg from cand;
end $$;
revoke all on function public.portal_release_expired_seats(boolean) from public, anon, authenticated;

-- 8) تهيئة البيانات القائمة (مرّة واحدة؛ لا تمسّ ما وُسم من قبل)
update public.portal_enrollments e set seat_status = 'confirmed', seat_confirmed_at = coalesce(i.paid_at, e.decided_at, now())
  from public.portal_invoices i where i.enrollment_id = e.id and i.status in ('paid','waived') and e.status = 'approved' and e.seat_status = 'none';
update public.portal_enrollments e set seat_status = 'held'
  from public.portal_invoices i where i.enrollment_id = e.id and i.status in ('unpaid','under_review') and e.status = 'approved' and e.seat_status = 'none';
update public.portal_enrollments e set seat_status = 'confirmed', seat_confirmed_at = coalesce(e.decided_at, now())
  from public.programs p where p.id = e.program_id and e.status = 'approved' and e.seat_status = 'none' and (p.fee is null or p.fee <= 0);

comment on column public.portal_enrollments.seat_status is 'P83: none | held (مقبول بانتظار السداد) | confirmed (مُغلق) | released (حُرّر)';
comment on column public.portal_invoices.receipt_meta is 'P83: ما استخرجه القارئ من الإيصال {amount,date,ref,bank,iban_tail,confidence} — نصّ فقط، لا صورة';

-- تحقّق
select 'seat_status' as item, count(*) from information_schema.columns where table_schema = 'public' and table_name = 'portal_enrollments' and column_name = 'seat_status'
union all select 'receipt_meta', count(*) from information_schema.columns where table_schema = 'public' and table_name = 'portal_invoices' and column_name = 'receipt_meta'
union all select 'auto_confirm_receipts', count(*) from information_schema.columns where table_schema = 'public' and table_name = 'portal_payment_settings' and column_name = 'auto_confirm_receipts'
union all select 'trg_seat_on_payment', count(*) from pg_trigger where tgname = 'trg_portal_seat_on_payment'
union all select 'release_fn', count(*) from pg_proc where proname = 'portal_release_expired_seats';
