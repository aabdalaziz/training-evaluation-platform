-- =====================================================================
-- المرحلة J3: أدوار دقيقة لكل برنامج (Program-scoped access)
-- مدير البرنامج (PROGRAM_MANAGER) المرتبط ببرامج محددة يرى ويعدّل بياناتها فقط.
-- مدير بلا أي ربط = يبقى كما هو اليوم (يرى الكل) — لا أحد يُقفل عليه بالخطأ.
-- الأدمن/المشرفون/محلل الجودة غير متأثرين. الزوار (anon) غير متأثرين.
-- آمن لإعادة التشغيل (idempotent)
-- =====================================================================

-- 1) جدول الربط
create table if not exists public.program_managers (
  profile_id   uuid not null references public.profiles(id) on delete cascade,
  program_id   uuid not null references public.programs(id) on delete cascade,
  assigned_at  timestamptz not null default now(),
  assigned_by  uuid,
  primary key (profile_id, program_id)
);
create index if not exists program_managers_program_idx on public.program_managers (program_id);

alter table public.program_managers enable row level security;

-- الإدارة: كل شيء · المستخدم: يقرأ ارتباطاته فقط
drop policy if exists program_managers_admin_all on public.program_managers;
create policy program_managers_admin_all on public.program_managers
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid()
                 and upper(p.role::text) in ('PLATFORM_ADMIN','SUPER_ADMIN','ADMIN')))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid()
                 and upper(p.role::text) in ('PLATFORM_ADMIN','SUPER_ADMIN','ADMIN')));

drop policy if exists program_managers_self_read on public.program_managers;
create policy program_managers_self_read on public.program_managers
  for select to authenticated
  using (profile_id = auth.uid());

-- 2) دوال مساعدة (security definer لتفادي تكرار RLS)
create or replace function public.my_program_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select pm.program_id from public.program_managers pm where pm.profile_id = auth.uid();
$$;

create or replace function public.is_scoped_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select upper(p.role::text) = 'PROGRAM_MANAGER'
       and exists (select 1 from public.program_managers pm where pm.profile_id = p.id)
      from public.profiles p where p.id = auth.uid()
  ), false);
$$;

-- يسمح بالصف إذا لم يكن المستخدم مديرًا مقيّدًا، أو كان البرنامج ضمن نطاقه
create or replace function public.program_in_scope(p_program uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (not public.is_scoped_manager()) or (p_program is not null and p_program in (select public.my_program_ids()));
$$;

grant execute on function public.my_program_ids()        to authenticated, anon;
grant execute on function public.is_scoped_manager()     to authenticated, anon;
grant execute on function public.program_in_scope(uuid)  to authenticated, anon;

-- 3) سياسات تقييدية (RESTRICTIVE) تُضاف فوق السياسات الحالية — على الجداول/الأعمدة الموجودة فعلًا
do $$
declare
  t text;
  col text;
begin
  -- programs: المعرّف نفسه
  if to_regclass('public.programs') is not null then
    execute 'drop policy if exists scope_programs on public.programs';
    execute 'create policy scope_programs on public.programs as restrictive for all to authenticated using (public.program_in_scope(id)) with check (public.program_in_scope(id))';
  end if;

  -- جداول فيها عمود program_id
  foreach t in array array['classrooms','evaluations','certificates','attendance_sessions','behavior_followups','impact_assessments','outcome_kpis','program_levels','trainee_mail_log'] loop
    if to_regclass('public.' || t) is not null
       and exists (select 1 from information_schema.columns where table_schema='public' and table_name=t and column_name='program_id') then
      execute format('drop policy if exists scope_%1$s on public.%1$I', t);
      execute format('create policy scope_%1$s on public.%1$I as restrictive for all to authenticated using (public.program_in_scope(program_id)) with check (public.program_in_scope(program_id))', t);
    end if;
  end loop;

  -- evaluation_answers: عبر التقييم
  if to_regclass('public.evaluation_answers') is not null and to_regclass('public.evaluations') is not null then
    execute 'drop policy if exists scope_evaluation_answers on public.evaluation_answers';
    execute 'create policy scope_evaluation_answers on public.evaluation_answers as restrictive for all to authenticated using ((not public.is_scoped_manager()) or exists (select 1 from public.evaluations e where e.id = evaluation_id and public.program_in_scope(e.program_id))) with check ((not public.is_scoped_manager()) or exists (select 1 from public.evaluations e where e.id = evaluation_id and public.program_in_scope(e.program_id)))';
  end if;

  -- outcome_measurements: عبر المؤشر
  if to_regclass('public.outcome_measurements') is not null and to_regclass('public.outcome_kpis') is not null then
    execute 'drop policy if exists scope_outcome_measurements on public.outcome_measurements';
    execute 'create policy scope_outcome_measurements on public.outcome_measurements as restrictive for all to authenticated using ((not public.is_scoped_manager()) or exists (select 1 from public.outcome_kpis k where k.id = kpi_id and public.program_in_scope(k.program_id))) with check ((not public.is_scoped_manager()) or exists (select 1 from public.outcome_kpis k where k.id = kpi_id and public.program_in_scope(k.program_id)))';
  end if;

  -- attendance_records: عبر الجلسة
  if to_regclass('public.attendance_records') is not null and to_regclass('public.attendance_sessions') is not null then
    execute 'drop policy if exists scope_attendance_records on public.attendance_records';
    execute 'create policy scope_attendance_records on public.attendance_records as restrictive for all to authenticated using ((not public.is_scoped_manager()) or exists (select 1 from public.attendance_sessions s where s.id = session_id and public.program_in_scope(s.program_id))) with check ((not public.is_scoped_manager()) or exists (select 1 from public.attendance_sessions s where s.id = session_id and public.program_in_scope(s.program_id)))';
  end if;

  -- class_schedules: عبر القاعة
  if to_regclass('public.class_schedules') is not null and to_regclass('public.classrooms') is not null then
    execute 'drop policy if exists scope_class_schedules on public.class_schedules';
    execute 'create policy scope_class_schedules on public.class_schedules as restrictive for all to authenticated using ((not public.is_scoped_manager()) or exists (select 1 from public.classrooms c where c.id = classroom_id and public.program_in_scope(c.program_id))) with check ((not public.is_scoped_manager()) or exists (select 1 from public.classrooms c where c.id = classroom_id and public.program_in_scope(c.program_id)))';
  end if;
end $$;

-- 4) مدير مقيّد ينشئ برنامجًا جديدًا → يُربط به تلقائيًا (قبل فحص RLS)
create or replace function public.programs_autoassign_manager()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and public.is_scoped_manager() then
    insert into public.program_managers (profile_id, program_id, assigned_by)
    values (auth.uid(), new.id, auth.uid())
    on conflict do nothing;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_programs_autoassign on public.programs;
create trigger trg_programs_autoassign before insert on public.programs
  for each row execute function public.programs_autoassign_manager();

-- 5) تتبّع التدقيق على جدول الربط (إن كانت دالة J1 موجودة)
do $$
begin
  if to_regproc('public.audit_row_change') is not null then
    execute 'drop trigger if exists trg_audit_program_managers on public.program_managers';
    execute 'create trigger trg_audit_program_managers after insert or update or delete on public.program_managers for each row execute function public.audit_row_change()';
  end if;
end $$;

-- تحقق
select count(*) as assignments from public.program_managers;
select policyname, tablename from pg_policies where schemaname = 'public' and policyname like 'scope_%' order by tablename;
