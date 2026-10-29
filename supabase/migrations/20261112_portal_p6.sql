-- © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
-- بوابة أَثَر — المرحلة P6-أ: التعلّم المباشر والهجين
--   الشعب (قاعات متوازية بلا حد) · الإسكان التلقائي بعد السداد · الجلسات والسلاسل · المزوّدون (Teams/Zoom/Meet/أَثَر) · الحضور عبر /attend
-- آمن للتكرار. يعتمد على: classrooms, trainers, attendance_sessions (20261026), P2/P3/P5.

-- 1) الشعبة = القاعة: سعة، مزوّد افتراضي، روابط ثابتة، فتح/إغلاق الإسكان
alter table public.classrooms add column if not exists capacity        int  not null default 30;
alter table public.classrooms add column if not exists provider        text not null default 'teams';
alter table public.classrooms add column if not exists join_url        text;
alter table public.classrooms add column if not exists host_url        text;
alter table public.classrooms add column if not exists placement_open  boolean not null default true;
alter table public.classrooms add column if not exists portal_created  boolean not null default false;

-- 2) إسكان المتدرب في شعبة
alter table public.portal_enrollments add column if not exists classroom_id uuid references public.classrooms(id) on delete set null;
alter table public.portal_enrollments add column if not exists placed_at    timestamptz;
create index if not exists pe_classroom_idx on public.portal_enrollments (classroom_id);

-- 3) الجلسات
create table if not exists public.portal_sessions (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id) on delete set null,
  program_id      uuid references public.programs(id) on delete cascade,
  classroom_id    uuid references public.classrooms(id) on delete set null,
  trainer_id      uuid references public.trainers(id) on delete set null,
  series_id       uuid,
  kind            text not null default 'class',          -- class | webinar | workshop | office_hours
  title_ar        text not null,
  title_en        text,
  description_ar  text,
  description_en  text,
  speaker_name    text,
  starts_at       timestamptz not null,
  duration_min    int  not null default 90 check (duration_min between 15 and 600),
  provider        text not null default 'teams',           -- teams | zoom | meet | athar | other
  join_url        text,
  recording_url   text,
  resource_id     uuid references public.portal_resources(id) on delete set null,
  skills          uuid[] not null default '{}',
  sector          text references public.portal_sectors(code) on delete set null,
  access          text not null default 'program',         -- public | registered | program | org | staff
  organization_id uuid references public.portal_organizations(id) on delete set null,
  capacity        int,
  lang            text not null default 'ar',
  status          text not null default 'scheduled',       -- scheduled | live | ended | cancelled
  attendance_session_id uuid references public.attendance_sessions(id) on delete set null,
  reminder_sent_at timestamptz,
  notes           text,
  constraint psn_kind_chk     check (kind in ('class','webinar','workshop','office_hours')),
  constraint psn_provider_chk check (provider in ('teams','zoom','meet','athar','other')),
  constraint psn_access_chk   check (access in ('public','registered','program','org','staff')),
  constraint psn_status_chk   check (status in ('scheduled','live','ended','cancelled'))
);
create index if not exists psn_starts_idx    on public.portal_sessions (starts_at);
create index if not exists psn_classroom_idx on public.portal_sessions (classroom_id, starts_at);
create index if not exists psn_program_idx   on public.portal_sessions (program_id, starts_at);
create index if not exists psn_series_idx    on public.portal_sessions (series_id);

-- بيانات المضيف (رابط المدرب) — للفريق فقط
create table if not exists public.portal_session_private (
  session_id uuid primary key references public.portal_sessions(id) on delete cascade,
  host_url   text,
  notes      text
);

-- تسجيل الجمهور في الندوات العامة
create table if not exists public.portal_session_registrations (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.portal_sessions(id) on delete cascade,
  created_at  timestamptz not null default now(),
  user_id     uuid references auth.users(id) on delete set null,
  email       text not null,
  full_name   text,
  organization text,
  reminded_at timestamptz,
  unique (session_id, email)
);
create index if not exists psr_session_idx on public.portal_session_registrations (session_id);

-- 4) RLS
alter table public.portal_sessions enable row level security;
drop policy if exists psn_read on public.portal_sessions;
create policy psn_read on public.portal_sessions for select to anon, authenticated using (
  status <> 'cancelled' and (
    access = 'public'
    or public.portal_is_staff()
    or (auth.uid() is not null and (
      access = 'registered'
      or exists (select 1 from public.portal_enrollments e where e.user_id = auth.uid() and e.status = 'approved'
                 and ((portal_sessions.classroom_id is not null and e.classroom_id = portal_sessions.classroom_id)
                   or (portal_sessions.classroom_id is null and e.program_id = portal_sessions.program_id)))
      or exists (select 1 from public.portal_session_registrations r where r.session_id = portal_sessions.id and r.user_id = auth.uid())
    ))
  )
);
drop policy if exists psn_write on public.portal_sessions;
create policy psn_write on public.portal_sessions for all to authenticated using (public.portal_is_writer()) with check (public.portal_is_writer());
grant select on public.portal_sessions to anon, authenticated;
grant insert, update, delete on public.portal_sessions to authenticated;

alter table public.portal_session_private enable row level security;
drop policy if exists psp_staff on public.portal_session_private;
create policy psp_staff on public.portal_session_private for all to authenticated using (public.portal_is_staff()) with check (public.portal_is_writer());
grant select, insert, update, delete on public.portal_session_private to authenticated;

alter table public.portal_session_registrations enable row level security;
drop policy if exists psr_own_read on public.portal_session_registrations;
create policy psr_own_read on public.portal_session_registrations for select to authenticated using (user_id = auth.uid() or public.portal_is_staff());
drop policy if exists psr_own_insert on public.portal_session_registrations;
create policy psr_own_insert on public.portal_session_registrations for insert to authenticated with check (user_id = auth.uid());
drop policy if exists psr_own_delete on public.portal_session_registrations;
create policy psr_own_delete on public.portal_session_registrations for delete to authenticated using (user_id = auth.uid() or public.portal_is_writer());
grant select, insert, delete on public.portal_session_registrations to authenticated;

-- المتدرب يقرأ بيانات شعبته (لا أثر إن كانت RLS غير مفعّلة على classrooms)
drop policy if exists classrooms_portal_learner_read on public.classrooms;
create policy classrooms_portal_learner_read on public.classrooms for select to authenticated
  using (exists (select 1 from public.portal_enrollments e where e.user_id = auth.uid() and e.classroom_id = classrooms.id));
grant select on public.classrooms to authenticated;

-- 5) الإسكان التلقائي: أول شعبة مفتوحة فيها مقعد، وإلا تُنشأ شعبة جديدة
create or replace function public.portal_place_enrollment(p_enrollment uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare e record; c record; v_count int; v_code text; v_room uuid;
begin
  select * into e from public.portal_enrollments where id = p_enrollment;
  if not found or e.status <> 'approved' then return null; end if;
  if e.classroom_id is not null then return e.classroom_id; end if;
  for c in select cl.* from public.classrooms cl where cl.program_id = e.program_id and coalesce(cl.placement_open, true) order by cl.code, cl.id loop
    select count(*) into v_count from public.portal_enrollments x where x.classroom_id = c.id and x.status = 'approved';
    if v_count < coalesce(c.capacity, 30) then v_room := c.id; exit; end if;
  end loop;
  if v_room is null then
    select count(*) + 1 into v_count from public.classrooms where program_id = e.program_id;
    v_code := 'SEC-' || lpad(v_count::text, 2, '0');
    insert into public.classrooms (program_id, code, section_name, delivery_mode, organization_id, capacity, portal_created)
      select p.id, v_code, 'شعبة ' || v_count, coalesce(p.delivery_mode, 'remote'), p.organization_id, 30, true from public.programs p where p.id = e.program_id
      returning id into v_room;
  end if;
  update public.portal_enrollments set classroom_id = v_room, placed_at = now(), updated_at = now() where id = e.id;
  insert into public.portal_learning_events (user_id, email, verb, object_type, object_id, context)
    values (e.user_id, e.email, 'placed', 'classroom', v_room::text, jsonb_build_object('program_id', e.program_id, 'enrollment_id', e.id));
  return v_room;
end $$;
revoke all on function public.portal_place_enrollment(uuid) from public, anon;
grant execute on function public.portal_place_enrollment(uuid) to authenticated, service_role;

-- عند السداد/الإعفاء → إسكان
create or replace function public.trg_portal_invoice_place() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status in ('paid','waived') and (old.status is distinct from new.status) and new.enrollment_id is not null then
    perform public.portal_place_enrollment(new.enrollment_id);
  end if;
  return new;
end $$;
drop trigger if exists portal_invoice_place on public.portal_invoices;
create trigger portal_invoice_place after update on public.portal_invoices for each row execute function public.trg_portal_invoice_place();

-- عند القبول في برنامج مجاني → إسكان فوري
create or replace function public.trg_portal_enrollment_place() returns trigger language plpgsql security definer set search_path = public as $$
declare v_fee numeric;
begin
  if new.status = 'approved' and (old.status is distinct from new.status) and new.classroom_id is null then
    select fee into v_fee from public.programs where id = new.program_id;
    if v_fee is null or v_fee <= 0 then perform public.portal_place_enrollment(new.id); end if;
  end if;
  return new;
end $$;
drop trigger if exists portal_enrollment_place on public.portal_enrollments;
create trigger portal_enrollment_place after update on public.portal_enrollments for each row execute function public.trg_portal_enrollment_place();

-- 6) كل جلسة شعبة/برنامج تُنشئ جلسة حضور في منظومة الحضور الحالية (/attend/<token>)
create or replace function public.trg_portal_session_attendance() returns trigger language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_local timestamp;
begin
  if new.program_id is not null and new.attendance_session_id is null then
    v_local := new.starts_at at time zone 'Asia/Riyadh';
    insert into public.attendance_sessions (program_id, classroom_id, trainer_id, title, session_date, start_time, end_time, status, created_by, created_by_name)
      values (new.program_id, new.classroom_id, new.trainer_id, new.title_ar, v_local::date, v_local::time, (v_local + make_interval(mins => new.duration_min))::time, 'open', new.created_by, 'أَثَر — بث مباشر')
      returning id into v_id;
    new.attendance_session_id := v_id;
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists portal_session_attendance on public.portal_sessions;
create trigger portal_session_attendance before insert on public.portal_sessions for each row execute function public.trg_portal_session_attendance();

-- 7) إحصاء الإسكان لكل شعبة (للإدارة)
create or replace function public.portal_classroom_counts(p_program uuid default null)
returns table (classroom_id uuid, placed int) language sql stable security definer set search_path = public as $$
  select e.classroom_id, count(*)::int from public.portal_enrollments e
  where e.classroom_id is not null and e.status = 'approved' and (p_program is null or e.program_id = p_program)
  group by e.classroom_id;
$$;
revoke all on function public.portal_classroom_counts(uuid) from public, anon;
grant execute on function public.portal_classroom_counts(uuid) to authenticated, service_role;

-- 8) تحقق
select 'classrooms.capacity' as t, count(*) as n from information_schema.columns where table_name = 'classrooms' and column_name in ('capacity','provider','join_url','host_url','placement_open')
union all select 'enrollments.classroom_id', count(*) from information_schema.columns where table_name = 'portal_enrollments' and column_name in ('classroom_id','placed_at')
union all select 'sessions policies', count(*) from pg_policies where tablename = 'portal_sessions'
union all select 'private+registrations policies', count(*) from pg_policies where tablename in ('portal_session_private','portal_session_registrations')
union all select 'place()+counts()', count(*) from pg_proc where proname in ('portal_place_enrollment','portal_classroom_counts')
union all select 'triggers', count(*) from pg_trigger where tgname in ('portal_invoice_place','portal_enrollment_place','portal_session_attendance');
