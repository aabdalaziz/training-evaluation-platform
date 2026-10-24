-- أَثَر — المرحلة P2: كتالوج البرامج + طلبات التسجيل
-- آمن لإعادة التشغيل (idempotent)

-- 1) حقول النشر في البوابة على جدول البرامج
alter table public.programs
  add column if not exists fee                   numeric(10,2),                      -- null = غير محدد · 0 = مجاني
  add column if not exists currency              text not null default 'SAR',
  add column if not exists seats                 int,                                -- null = غير محدود
  add column if not exists program_type          text not null default 'course',     -- course | diploma | workshop | arabic
  add column if not exists is_public             boolean not null default true,
  add column if not exists registration_open     boolean not null default true,
  add column if not exists registration_deadline date,
  add column if not exists location_ar           text,
  add column if not exists location_en           text,
  add column if not exists hours                 int;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'programs_program_type_chk') then
    alter table public.programs add constraint programs_program_type_chk check (program_type in ('course','diploma','workshop','arabic'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'programs_fee_chk') then
    alter table public.programs add constraint programs_fee_chk check (fee is null or fee >= 0);
  end if;
exception when others then raise notice 'programs constraints: %', sqlerrm; end $$;

-- 2) طلبات التسجيل
create table if not exists public.portal_enrollments (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  program_id     uuid not null references public.programs(id) on delete cascade,
  user_id        uuid references auth.users(id) on delete set null,
  full_name      text not null,
  email          text not null,
  phone          text,
  organization   text,
  city           text,
  notes          text,
  lang           text not null default 'ar',
  source         text not null default 'portal',
  status         text not null default 'pending',   -- pending | approved | waitlisted | rejected | cancelled
  decided_by     uuid references auth.users(id) on delete set null,
  decided_at     timestamptz,
  decision_note  text,
  notified_at    timestamptz,
  constraint portal_enrollments_status_chk check (status in ('pending','approved','waitlisted','rejected','cancelled')),
  constraint portal_enrollments_name_chk check (char_length(full_name) between 2 and 120),
  constraint portal_enrollments_unique unique (program_id, email)
);
create index if not exists portal_enrollments_program_idx on public.portal_enrollments (program_id, status);
create index if not exists portal_enrollments_user_idx on public.portal_enrollments (user_id);

alter table public.portal_enrollments enable row level security;

-- المتقدّم (بعد التحقق من بريده عبر رابط الدخول): يُدرج طلبه فقط ببريده هو
drop policy if exists portal_enroll_insert_own on public.portal_enrollments;
create policy portal_enroll_insert_own on public.portal_enrollments
  for insert to authenticated
  with check (user_id = auth.uid() and lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')) and status = 'pending');

-- المتقدّم يرى طلباته
drop policy if exists portal_enroll_select_own on public.portal_enrollments;
create policy portal_enroll_select_own on public.portal_enrollments
  for select to authenticated using (user_id = auth.uid());

-- المتقدّم يستطيع إلغاء طلبه فقط
drop policy if exists portal_enroll_cancel_own on public.portal_enrollments;
create policy portal_enroll_cancel_own on public.portal_enrollments
  for update to authenticated
  using (user_id = auth.uid() and status in ('pending','waitlisted','approved'))
  with check (user_id = auth.uid() and status = 'cancelled');

-- الموظفون: قراءة وتحديث كل الطلبات
drop policy if exists portal_enroll_staff_read on public.portal_enrollments;
create policy portal_enroll_staff_read on public.portal_enrollments
  for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid()
                 and upper(p.role::text) in ('PLATFORM_ADMIN','SUPER_ADMIN','ADMIN','PROGRAM_MANAGER','QUALITY_ANALYST')));

drop policy if exists portal_enroll_staff_update on public.portal_enrollments;
create policy portal_enroll_staff_update on public.portal_enrollments
  for update to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid()
                 and upper(p.role::text) in ('PLATFORM_ADMIN','SUPER_ADMIN','ADMIN','PROGRAM_MANAGER','QUALITY_ANALYST')))
  with check (true);

grant select, insert, update on public.portal_enrollments to authenticated;

-- 3) إحصاء المقاعد للعامة (أرقام مجمّعة فقط، بلا بيانات شخصية)
create or replace function public.portal_enrollment_counts()
returns table (program_id uuid, approved int, pending int, waitlisted int)
language sql stable security definer set search_path = public as $$
  select e.program_id,
         count(*) filter (where e.status = 'approved')::int,
         count(*) filter (where e.status = 'pending')::int,
         count(*) filter (where e.status = 'waitlisted')::int
  from public.portal_enrollments e
  group by e.program_id
$$;
grant execute on function public.portal_enrollment_counts() to anon, authenticated;

-- 4) تحقق
select 'portal_enrollments' as t, count(*) as n from pg_policies where tablename = 'portal_enrollments'
union all
select 'programs.fee column', count(*) from information_schema.columns where table_schema = 'public' and table_name = 'programs' and column_name in ('fee','seats','program_type','is_public','registration_open','registration_deadline','hours')
union all
select 'portal_enrollment_counts()', count(*) from pg_proc where proname = 'portal_enrollment_counts';
