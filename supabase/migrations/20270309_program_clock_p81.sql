-- © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
-- P81 «ساعة البرنامج»: جدول أحداث تلقائي لكلّ برنامج (T-7 تذكير · T0 انطلاق · T+1 تقييم · T+30 متابعة · T+90 أثر)
-- يُولَّد عند إنشاء البرنامج أو تغيير تواريخه، ويُنفَّذ بالسلسلة اليومية الموجودة (/api/followups/send) — لا كرون جديد.

-- 1) الإعدادات (صفّ واحد)
create table if not exists public.program_clock_config (
  id            int primary key default 1 check (id = 1),
  enabled       boolean not null default true,
  offsets       jsonb   not null default '{"remind":-7,"start":0,"evaluate":1,"followup":30,"impact":90}'::jsonb,
  channels      jsonb   not null default '{"participants":true,"trainer":true,"admin":true}'::jsonb,
  updated_at    timestamptz not null default now(),
  updated_by    uuid
);
insert into public.program_clock_config (id) values (1) on conflict (id) do nothing;

-- 2) الأحداث
create table if not exists public.program_clock_events (
  id          uuid primary key default gen_random_uuid(),
  program_id  uuid not null references public.programs(id) on delete cascade,
  kind        text not null check (kind in ('remind','start','evaluate','followup','impact')),
  due_date    date not null,
  status      text not null default 'pending' check (status in ('pending','done','skipped','failed')),
  result      jsonb,
  done_at     timestamptz,
  created_at  timestamptz not null default now(),
  constraint program_clock_events_uq unique (program_id, kind)
);
create index if not exists program_clock_events_due_idx on public.program_clock_events (status, due_date);

-- 3) التوليد: من تواريخ البرنامج + الإزاحات؛ الأحداث المعلّقة تُحدَّث تواريخها، والمنجزة لا تُمسّ
create or replace function public.program_clock_generate(p_program uuid) returns int
language plpgsql security definer set search_path = public as $$
declare v_start date; v_end date; v_off jsonb; v_n int := 0; v_status text;
begin
  select start_date, end_date, status::text into v_start, v_end, v_status from public.programs where id = p_program;
  if v_start is null and v_end is null then return 0; end if;
  if coalesce(v_status,'') in ('CANCELLED','ARCHIVED') then return 0; end if;
  select offsets into v_off from public.program_clock_config where id = 1;
  v_off := coalesce(v_off, '{"remind":-7,"start":0,"evaluate":1,"followup":30,"impact":90}'::jsonb);
  v_end := coalesce(v_end, v_start); v_start := coalesce(v_start, v_end);
  insert into public.program_clock_events (program_id, kind, due_date) values
    (p_program, 'remind',   v_start + coalesce((v_off->>'remind')::int, -7)),
    (p_program, 'start',    v_start + coalesce((v_off->>'start')::int, 0)),
    (p_program, 'evaluate', v_end   + coalesce((v_off->>'evaluate')::int, 1)),
    (p_program, 'followup', v_end   + coalesce((v_off->>'followup')::int, 30)),
    (p_program, 'impact',   v_end   + coalesce((v_off->>'impact')::int, 90))
  on conflict (program_id, kind) do update set due_date = excluded.due_date
    where program_clock_events.status = 'pending' and program_clock_events.due_date <> excluded.due_date;
  get diagnostics v_n = row_count; return v_n;
end $$;

-- 4) توليد شامل للبرامج الحيّة (تُستدعى من الكرون يوميًّا — تلتقط البرامج القديمة وأيّ تعديل فات المشغّل)
create or replace function public.program_clock_generate_all() returns int
language plpgsql security definer set search_path = public as $$
declare r record; v_total int := 0;
begin
  for r in select id from public.programs
           where coalesce(status::text,'') not in ('CANCELLED','ARCHIVED')
             and coalesce(end_date, start_date) >= current_date - 120
  loop v_total := v_total + public.program_clock_generate(r.id); end loop;
  return v_total;
end $$;

-- 5) المشغّل: عند إنشاء برنامج أو تغيير تواريخه/حالته
create or replace function public.program_clock_on_program() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.start_date is distinct from old.start_date or new.end_date is distinct from old.end_date or new.status is distinct from old.status then
    perform public.program_clock_generate(new.id);
  end if;
  return new;
end $$;
drop trigger if exists program_clock_on_program on public.programs;
create trigger program_clock_on_program after insert or update of start_date, end_date, status on public.programs
  for each row execute function public.program_clock_on_program();

-- 6) RLS: قراءة/تعديل للطاقم الإداري؛ الكتابة التشغيلية بمفتاح الخدمة من الخادم
alter table public.program_clock_config enable row level security;
alter table public.program_clock_events enable row level security;
drop policy if exists program_clock_config_rw on public.program_clock_config;
create policy program_clock_config_rw on public.program_clock_config for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and upper(p.role::text) in ('PLATFORM_ADMIN','SUPER_ADMIN','ADMIN','PROGRAM_MANAGER','QUALITY_ANALYST')))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and upper(p.role::text) in ('PLATFORM_ADMIN','SUPER_ADMIN','ADMIN','PROGRAM_MANAGER')));
drop policy if exists program_clock_events_rw on public.program_clock_events;
create policy program_clock_events_rw on public.program_clock_events for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and upper(p.role::text) in ('PLATFORM_ADMIN','SUPER_ADMIN','ADMIN','PROGRAM_MANAGER','QUALITY_ANALYST','TRAINER')))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and upper(p.role::text) in ('PLATFORM_ADMIN','SUPER_ADMIN','ADMIN','PROGRAM_MANAGER')));
grant execute on function public.program_clock_generate(uuid) to authenticated, service_role;
grant execute on function public.program_clock_generate_all() to authenticated, service_role;

-- 7) التعبئة الأولى للبرامج الحيّة
select public.program_clock_generate_all();
