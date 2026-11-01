-- © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
-- P42-أ «بابٌ واحد لكل دور» — بوابة الدخول الموحّد بالأدوار: الدعوة تسبق الدور.
--  · portal_roles: سجلّ الأدوار الرسمي (نظامي + مخصّص من الإدارة) — بلا توسيع لـ ENUM القديم profiles.role.
--  · portal_role_invites: دعوة من الإدارة للمنسوب (بريد + صفة أو صفات + جهة اختيارية) برمز لمرة واحدة.
--  · portal_role_grants: المنحة الفعلية (قد تكون بالبريد قبل أول دخول ثم تُربط بالحساب) — قابلة للسحب والانتهاء.
--  · portal_my_roles()/portal_has_role(): تقرأ المنح + الترجمة التلقائية للـENUM القديم؛ portal_is_staff()/portal_is_writer() تُحدَّثان لتقرآ الطبقتين.
create extension if not exists pgcrypto;

create table if not exists public.portal_roles (
  code         text primary key check (code ~ '^[A-Z][A-Z0-9_]{1,39}$'),
  name_ar      text not null,
  name_en      text not null,
  scope        text not null default 'platform' check (scope in ('platform','org','personal')),
  landing      text not null default '/me',
  permissions  text[] not null default '{}',
  is_staff     boolean not null default false,   -- يفتح /admin و/dashboard (الجسر إلى ENUM القديم)
  legacy_role  text,                               -- أدنى دور قديم يفتح صفحات هذا الدور (ترقية فقط، لا تخفيض)
  is_system    boolean not null default false,
  active       boolean not null default true,
  sort         int not null default 100,
  created_at   timestamptz not null default now(),
  created_by   uuid
);

create table if not exists public.portal_role_invites (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  created_by   uuid,
  token_hash   text not null unique,
  email        text not null,
  full_name    text,
  role_codes   text[] not null,
  org_id       uuid references public.portal_organizations(id) on delete set null,
  message      text,
  expires_at   timestamptz not null default (now() + interval '14 days'),
  accepted_at  timestamptz,
  accepted_by  uuid,
  revoked_at   timestamptz,
  constraint pri_email_chk check (position('@' in email) > 1)
);
create index if not exists portal_role_invites_email_idx on public.portal_role_invites (lower(email));

create table if not exists public.portal_role_grants (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  user_id       uuid,                                 -- يُربط عند أول دخول إن كانت المنحة بالبريد
  email         text not null,
  role_code     text not null references public.portal_roles(code) on update cascade,
  org_id        uuid references public.portal_organizations(id) on delete cascade,
  granted_by    uuid,
  source        text not null default 'invite' check (source in ('invite','manual','legacy','system')),
  invite_id     uuid references public.portal_role_invites(id) on delete set null,
  note          text,
  expires_at    timestamptz,
  revoked_at    timestamptz,
  revoked_by    uuid,
  revoke_reason text
);
create index if not exists portal_role_grants_email_idx on public.portal_role_grants (lower(email)) where revoked_at is null;
create index if not exists portal_role_grants_user_idx on public.portal_role_grants (user_id) where revoked_at is null;
create unique index if not exists portal_role_grants_uniq on public.portal_role_grants (lower(email), role_code, coalesce(org_id, '00000000-0000-0000-0000-000000000000'::uuid)) where revoked_at is null;

-- سجلّ الأدوار النظامية (الأسماء المهنية الرسمية)
insert into public.portal_roles (code, name_ar, name_en, scope, landing, permissions, is_staff, legacy_role, is_system, sort) values
  ('ADMIN',            'مدير النظام',                    'System administrator',           'platform', '/dashboard',        '{*}', true,  'ADMIN',           true, 10),
  ('LEADERSHIP',       'القيادة',                         'Leadership',                     'platform', '/hub/leadership',   '{reports.read,observatory.read,impact.read,finance.read}', true, 'QUALITY_ANALYST', true, 20),
  ('EXEC_PROGRAMS',    'المشرف التنفيذي للبرامج',         'Executive supervisor — programs','platform', '/hub/programs',     '{programs.write,sessions.write,enrollments.write,placements.write,reports.read}', true, 'PROGRAM_MANAGER', true, 30),
  ('EXEC_DIPLOMAS',    'المشرف التنفيذي للدبلومات',       'Executive supervisor — diplomas','platform', '/hub/diplomas',     '{programs.write,sessions.write,enrollments.write,credentials.write,reports.read}', true, 'PROGRAM_MANAGER', true, 31),
  ('EXEC_ARABIC',      'المشرف التنفيذي لتعليم العربية',  'Executive supervisor — Arabic',  'platform', '/hub/programs',     '{programs.write,sessions.write,miaar.write,reports.read}', true, 'PROGRAM_MANAGER', true, 32),
  ('QUALITY_MANAGER',  'مدير الجودة',                     'Quality manager',                'platform', '/hub/quality',      '{reports.read,evidence.write,observatory.read,inclusion.write,loop.write}', true, 'QUALITY_ANALYST', true, 40),
  ('TEST_AUTHOR',      'معدّ الاختبارات',                 'Assessment author',              'platform', '/admin/miaar/bank', '{miaar.bank.write,miaar.forms.write}', true, 'QUALITY_ANALYST', true, 45),
  ('ADMIN_SUPERVISOR', 'المشرف الإداري',                  'Administrative supervisor',      'platform', '/hub/operations',   '{enrollments.write,placements.write,attendance.write,invites.write,inbox.write}', true, 'PROGRAM_MANAGER', true, 50),
  ('FINANCE_MANAGER',  'المدير المالي',                   'Finance manager',                'platform', '/hub/finance',      '{payments.write,invoices.write,contracts.read,reports.read}', true, 'PROGRAM_MANAGER', true, 60),
  ('CONSULTANT',       'المستشار',                        'Consultant',                     'platform', '/hub/expert',       '{consulting.write,directory.self}', false, null, true, 70),
  ('EXPERT',           'الخبير',                          'Expert',                         'platform', '/hub/expert',       '{directory.self,councils.chair,onair.answer}', false, null, true, 71),
  ('TRAINER',          'المدرّب',                         'Trainer',                        'platform', '/hub/trainer',      '{sessions.host,rooms.host,attendance.write,directory.self}', true, 'TRAINER', true, 72),
  ('ORG_ADMIN',        'مسؤول المؤسسة',                   'Organization administrator',     'org',      '/org',              '{org.members,org.reports,org.invites}', false, null, true, 80),
  ('PARTICIPANT',      'المشارك',                         'Participant',                    'personal', '/me',               '{me}', false, null, true, 90),
  ('TRAINEE',          'المتدرّب',                        'Trainee',                        'personal', '/me',               '{me}', false, null, true, 91),
  ('STUDENT',          'الطالب',                          'Student',                        'personal', '/me',               '{me,miaar}', false, null, true, 92)
on conflict (code) do nothing;

-- أدواري: المنح النشطة (بالحساب أو بالبريد) + ترجمة ENUM القديم تلقائيًا
create or replace function public.portal_my_roles() returns text[] language sql stable security definer set search_path = public as $$
  with g as (
    select g.role_code as r from public.portal_role_grants g
      join public.portal_roles pr on pr.code = g.role_code and pr.active
      where g.revoked_at is null and (g.expires_at is null or g.expires_at > now())
        and (g.user_id = auth.uid() or lower(g.email) = lower(coalesce(auth.email(), '')))
  ), legacy as (
    select case upper(p.role::text)
      when 'PLATFORM_ADMIN' then 'ADMIN' when 'SUPER_ADMIN' then 'ADMIN' when 'ADMIN' then 'ADMIN'
      when 'PROGRAM_MANAGER' then 'EXEC_PROGRAMS' when 'QUALITY_ANALYST' then 'QUALITY_MANAGER' when 'TRAINER' then 'TRAINER'
      else null end as r
      from public.profiles p where p.id = auth.uid()
  ), all_r as (
    select r from g
    union all
    -- الجسر القديم: مستوى المدير يُحتسب دائمًا؛ وغيره فقط لمن لا منح له بعد (المنح هي المرجع متى وُجدت)
    select r from legacy where r is not null and (r = 'ADMIN' or not exists (select 1 from g))
    union all
    select 'ORG_ADMIN' from public.portal_org_members m where m.user_id = auth.uid() and m.role = 'org_admin'
  )
  select coalesce((select array_agg(distinct r order by r) from all_r), '{}');
$$;
grant execute on function public.portal_my_roles() to authenticated;

create or replace function public.portal_has_role(p_code text) returns boolean language sql stable security definer set search_path = public as $$
  select p_code = any(public.portal_my_roles()) or 'ADMIN' = any(public.portal_my_roles());
$$;
grant execute on function public.portal_has_role(text) to authenticated;

-- الجسر: الطاقم/الكتّاب = ENUM القديم أو منحة بدور is_staff
create or replace function public.portal_is_staff() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and upper(p.role::text) in ('PLATFORM_ADMIN','SUPER_ADMIN','ADMIN','PROGRAM_MANAGER','QUALITY_ANALYST'))
      or exists (select 1 from public.portal_role_grants g join public.portal_roles r on r.code = g.role_code
                 where g.revoked_at is null and (g.expires_at is null or g.expires_at > now()) and r.active and r.is_staff and r.code <> 'TRAINER'
                   and (g.user_id = auth.uid() or lower(g.email) = lower(coalesce(auth.email(), ''))));
$$;
create or replace function public.portal_is_writer() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and upper(p.role::text) in ('PLATFORM_ADMIN','SUPER_ADMIN','ADMIN','PROGRAM_MANAGER'))
      or exists (select 1 from public.portal_role_grants g join public.portal_roles r on r.code = g.role_code
                 where g.revoked_at is null and (g.expires_at is null or g.expires_at > now()) and r.active
                   and r.code in ('ADMIN','EXEC_PROGRAMS','EXEC_DIPLOMAS','EXEC_ARABIC','ADMIN_SUPERVISOR')
                   and (g.user_id = auth.uid() or lower(g.email) = lower(coalesce(auth.email(), ''))));
$$;

-- RLS: القراءة للذات وللطاقم؛ الكتابة عبر الخادم (صلاحية الخدمة) فقط
alter table public.portal_roles enable row level security;
alter table public.portal_role_invites enable row level security;
alter table public.portal_role_grants enable row level security;
drop policy if exists portal_roles_read on public.portal_roles;
create policy portal_roles_read on public.portal_roles for select to authenticated using (true);
drop policy if exists portal_role_grants_self on public.portal_role_grants;
create policy portal_role_grants_self on public.portal_role_grants for select to authenticated
  using (user_id = auth.uid() or lower(email) = lower(coalesce(auth.email(), '')) or public.portal_is_staff());
drop policy if exists portal_role_invites_staff on public.portal_role_invites;
create policy portal_role_invites_staff on public.portal_role_invites for select to authenticated using (public.portal_is_staff());

-- تشخيص: المتوقع roles=16 · funcs=4 · policies=3
select (select count(*) from public.portal_roles where is_system) as roles,
       (select count(*) from pg_proc where proname in ('portal_my_roles','portal_has_role','portal_is_staff','portal_is_writer')) as funcs,
       (select count(*) from pg_policies where tablename in ('portal_roles','portal_role_grants','portal_role_invites')) as policies;
