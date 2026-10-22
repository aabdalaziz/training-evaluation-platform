-- =====================================================================
-- المرحلة G1: الحضور الرقمي (QR) — جلسات حضور + سجلات تسجيل الدخول
-- آمن لإعادة التشغيل (idempotent)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0) جداول قديمة بنفس الاسم ببنية مختلفة؟ نعيد تسميتها دون حذف بيانات
-- ---------------------------------------------------------------------
do $$
begin
  if to_regclass('public.attendance_sessions') is not null
     and not exists (select 1 from information_schema.columns
                     where table_schema='public' and table_name='attendance_sessions' and column_name='token') then
    execute 'alter table public.attendance_sessions rename to attendance_sessions_legacy_' || to_char(now(),'YYYYMMDD');
  end if;
  if to_regclass('public.attendance_records') is not null
     and not exists (select 1 from information_schema.columns
                     where table_schema='public' and table_name='attendance_records' and column_name='identity_key') then
    execute 'alter table public.attendance_records rename to attendance_records_legacy_' || to_char(now(),'YYYYMMDD');
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1) جلسات الحضور (لكل جلسة رمز QR/رابط عام)
-- ---------------------------------------------------------------------
create table if not exists public.attendance_sessions (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid,
  program_id       uuid not null references public.programs(id) on delete cascade,
  classroom_id     uuid references public.classrooms(id) on delete set null,
  trainer_id       uuid references public.trainers(id) on delete set null,
  title            text not null,
  session_date     date not null default (now() at time zone 'Asia/Riyadh')::date,
  start_time       time,
  end_time         time,
  late_after_min   int  not null default 15 check (late_after_min between 0 and 240),
  require_phone    boolean not null default false,
  token            text not null unique,
  status           text not null default 'open' check (status in ('open','closed')),
  notes            text,
  created_by       uuid,
  created_by_name  text,
  created_at       timestamptz not null default now(),
  closed_at        timestamptz
);
create index if not exists attendance_sessions_program_idx on public.attendance_sessions (program_id, session_date desc);
create index if not exists attendance_sessions_org_idx     on public.attendance_sessions (organization_id, session_date desc);

-- ---------------------------------------------------------------------
-- 2) سجلات الحضور (سجل واحد لكل شخص في كل جلسة)
-- ---------------------------------------------------------------------
create table if not exists public.attendance_records (
  id             uuid primary key default gen_random_uuid(),
  session_id     uuid not null references public.attendance_sessions(id) on delete cascade,
  trainee_id     uuid,
  full_name      text not null,
  email          text,
  phone          text,
  identity_key   text not null,
  status         text not null default 'present' check (status in ('present','late','excused','absent')),
  method         text not null default 'qr' check (method in ('qr','manual','import')),
  checked_in_at  timestamptz not null default now(),
  note           text,
  created_at     timestamptz not null default now(),
  unique (session_id, identity_key)
);
create index if not exists attendance_records_session_idx on public.attendance_records (session_id, checked_in_at);
create index if not exists attendance_records_email_idx   on public.attendance_records (lower(email));

-- ---------------------------------------------------------------------
-- 3) مفتاح الهوية الموحّد (بريد ← جوال ← الاسم) — نفس المنطق في الواجهة
-- ---------------------------------------------------------------------
create or replace function public.attendance_identity_key(p_name text, p_email text, p_phone text)
returns text language sql immutable as $$
  select case
    when nullif(lower(trim(coalesce(p_email,''))), '') is not null then 'e:' || lower(trim(p_email))
    when nullif(regexp_replace(coalesce(p_phone,''), '\D', '', 'g'), '') is not null
         then 'p:' || right(regexp_replace(p_phone, '\D', '', 'g'), 9)
    else 'n:' || lower(regexp_replace(trim(coalesce(p_name,'')), '\s+', ' ', 'g'))
  end;
$$;

-- المؤسسة تُورَّث من البرنامج إن لم تُحدَّد
create or replace function public.trg_attendance_session_defaults()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.organization_id is null then
    select organization_id into new.organization_id from public.programs where id = new.program_id;
  end if;
  if new.token is null or new.token = '' then
    new.token := upper(substr(md5(random()::text || clock_timestamp()::text || new.id::text), 1, 8));
  end if;
  new.token := upper(trim(new.token));
  if new.status = 'closed' and new.closed_at is null then new.closed_at := now(); end if;
  if new.status = 'open' then new.closed_at := null; end if;
  return new;
end $$;
drop trigger if exists attendance_session_defaults on public.attendance_sessions;
create trigger attendance_session_defaults before insert or update on public.attendance_sessions
  for each row execute function public.trg_attendance_session_defaults();

create or replace function public.trg_attendance_record_defaults()
returns trigger language plpgsql as $$
begin
  new.full_name := regexp_replace(trim(coalesce(new.full_name,'')), '\s+', ' ', 'g');
  new.email     := nullif(lower(trim(coalesce(new.email,''))), '');
  new.phone     := nullif(trim(coalesce(new.phone,'')), '');
  new.identity_key := public.attendance_identity_key(new.full_name, new.email, new.phone);
  return new;
end $$;
drop trigger if exists attendance_record_defaults on public.attendance_records;
create trigger attendance_record_defaults before insert or update on public.attendance_records
  for each row execute function public.trg_attendance_record_defaults();

-- ---------------------------------------------------------------------
-- 4) RLS — الإدارة تقرأ/تكتب، المدرب يقرأ، الزائر يمرّ عبر الدوال فقط
-- ---------------------------------------------------------------------
alter table public.attendance_sessions enable row level security;
alter table public.attendance_records  enable row level security;

drop policy if exists attendance_sessions_rw on public.attendance_sessions;
create policy attendance_sessions_rw on public.attendance_sessions for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid()
          and upper(p.role::text) in ('PLATFORM_ADMIN','SUPER_ADMIN','ADMIN','PROGRAM_MANAGER','QUALITY_ANALYST','TRAINER')))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid()
          and upper(p.role::text) in ('PLATFORM_ADMIN','SUPER_ADMIN','ADMIN','PROGRAM_MANAGER','QUALITY_ANALYST','TRAINER')));

drop policy if exists attendance_records_rw on public.attendance_records;
create policy attendance_records_rw on public.attendance_records for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid()
          and upper(p.role::text) in ('PLATFORM_ADMIN','SUPER_ADMIN','ADMIN','PROGRAM_MANAGER','QUALITY_ANALYST','TRAINER')))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid()
          and upper(p.role::text) in ('PLATFORM_ADMIN','SUPER_ADMIN','ADMIN','PROGRAM_MANAGER','QUALITY_ANALYST','TRAINER')));

-- ---------------------------------------------------------------------
-- 5) الدالة العامة: معلومات الجلسة برمز الرابط (بدون تسجيل دخول)
-- ---------------------------------------------------------------------
create or replace function public.attendance_session_public(p_token text)
returns jsonb
language sql security definer stable set search_path = public as $$
  select jsonb_build_object(
    'id', s.id, 'title', s.title, 'status', s.status,
    'session_date', s.session_date, 'start_time', s.start_time, 'end_time', s.end_time,
    'late_after_min', s.late_after_min, 'require_phone', s.require_phone,
    'program_name',    (select pr.name_ar from public.programs pr where pr.id = s.program_id),
    'program_name_en', (select pr.name_en from public.programs pr where pr.id = s.program_id),
    'classroom_code',  (select c.code from public.classrooms c where c.id = s.classroom_id),
    'trainer_name',    (select t.name from public.trainers t where t.id = s.trainer_id),
    'count', (select count(*) from public.attendance_records r where r.session_id = s.id and r.status in ('present','late'))
  )
  from public.attendance_sessions s
  where s.token = upper(trim(p_token))
  limit 1;
$$;
grant execute on function public.attendance_session_public(text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 6) الدالة العامة: تسجيل الحضور (تحسب «حاضر/متأخر» في الخادم بتوقيت الرياض)
-- ---------------------------------------------------------------------
create or replace function public.attendance_checkin(p_token text, p_name text, p_email text default null, p_phone text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  s      public.attendance_sessions%rowtype;
  nm     text := regexp_replace(trim(coalesce(p_name,'')), '\s+', ' ', 'g');
  em     text := nullif(lower(trim(coalesce(p_email,''))), '');
  ph     text := nullif(trim(coalesce(p_phone,'')), '');
  key    text;
  st     text := 'present';
  now_r  time := (now() at time zone 'Asia/Riyadh')::time;
  today  date := (now() at time zone 'Asia/Riyadh')::date;
  ex     public.attendance_records%rowtype;
  rid    uuid;
begin
  select * into s from public.attendance_sessions where token = upper(trim(p_token)) limit 1;
  if s.id is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if s.status <> 'open' then return jsonb_build_object('ok', false, 'error', 'closed'); end if;
  if length(nm) < 3 then return jsonb_build_object('ok', false, 'error', 'bad_name'); end if;
  if em is not null and em !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then return jsonb_build_object('ok', false, 'error', 'bad_email'); end if;
  if s.require_phone and (ph is null or length(regexp_replace(ph, '\D', '', 'g')) < 9) then
    return jsonb_build_object('ok', false, 'error', 'bad_phone');
  end if;

  key := public.attendance_identity_key(nm, em, ph);
  select * into ex from public.attendance_records where session_id = s.id and identity_key = key limit 1;
  if ex.id is not null then
    return jsonb_build_object('ok', true, 'already', true, 'status', ex.status, 'checked_in_at', ex.checked_in_at, 'name', ex.full_name);
  end if;

  -- التأخر: بعد وقت البداية + مهلة السماح (في يوم الجلسة نفسه أو بعده)
  if s.start_time is not null and (today > s.session_date or (today = s.session_date and now_r > s.start_time + make_interval(mins => s.late_after_min))) then
    st := 'late';
  end if;

  insert into public.attendance_records (session_id, trainee_id, full_name, email, phone, status, method)
  values (s.id, auth.uid(), nm, em, ph, st, 'qr')
  on conflict (session_id, identity_key) do update set full_name = excluded.full_name
  returning id into rid;

  return jsonb_build_object('ok', true, 'already', false, 'id', rid, 'status', st, 'checked_in_at', now(), 'name', nm);
end $$;
grant execute on function public.attendance_checkin(text, text, text, text) to anon, authenticated;

-- تحقق
select 'attendance_sessions' as t, count(*) from public.attendance_sessions
union all select 'attendance_records', count(*) from public.attendance_records;
