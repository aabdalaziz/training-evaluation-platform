-- © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
-- بوابة أَثَر — المرحلة P8-ب: بوابة الجهات (B2B) — العضوية (نطاق البريد + دعوات، بتأكيد مدير الجهة)، لوحة الأثر، التسجيل الجماعي
-- آمن للتكرار. يعتمد على P5 (الجهات) وP6 وP8-أ.

-- 1) أعضاء الجهة
create table if not exists public.portal_org_members (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.portal_organizations(id) on delete cascade,
  created_at      timestamptz not null default now(),
  user_id         uuid references auth.users(id) on delete set null,
  email           text not null,
  full_name       text,
  role            text not null default 'learner',          -- learner | org_admin
  status          text not null default 'pending',          -- pending | confirmed | rejected
  source          text not null default 'domain',           -- domain | invite | admin | bulk
  invited_by      uuid references auth.users(id) on delete set null,
  confirmed_by    uuid references auth.users(id) on delete set null,
  confirmed_at    timestamptz,
  note            text,
  constraint pom_role_chk check (role in ('learner','org_admin')),
  constraint pom_status_chk check (status in ('pending','confirmed','rejected')),
  constraint pom_source_chk check (source in ('domain','invite','admin','bulk'))
);
create unique index if not exists pom_org_email_uq on public.portal_org_members (organization_id, lower(email));
create index if not exists pom_user_idx on public.portal_org_members (user_id);

-- هل المستخدم مدير جهة مؤكد؟
create or replace function public.portal_is_org_admin(p_org uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.portal_org_members m where m.organization_id = p_org and m.role = 'org_admin' and m.status = 'confirmed'
                 and (m.user_id = auth.uid() or lower(m.email) = lower(coalesce(auth.jwt()->>'email',''))));
$$;
grant execute on function public.portal_is_org_admin(uuid) to authenticated;

alter table public.portal_org_members enable row level security;
drop policy if exists pom_read on public.portal_org_members;
create policy pom_read on public.portal_org_members for select to authenticated
  using (user_id = auth.uid() or lower(email) = lower(coalesce(auth.jwt()->>'email','')) or public.portal_is_staff() or public.portal_is_org_admin(organization_id));
drop policy if exists pom_org_admin_write on public.portal_org_members;
create policy pom_org_admin_write on public.portal_org_members for update to authenticated using (public.portal_is_org_admin(organization_id)) with check (public.portal_is_org_admin(organization_id));
drop policy if exists pom_staff_all on public.portal_org_members;
create policy pom_staff_all on public.portal_org_members for all to authenticated using (public.portal_is_writer()) with check (public.portal_is_writer());
grant select, insert, update, delete on public.portal_org_members to authenticated;

-- مدير الجهة يقرأ بيانات جهته
drop policy if exists porg_admin_read on public.portal_organizations;
create policy porg_admin_read on public.portal_organizations for select to authenticated using (public.portal_is_org_admin(id));

-- 2) طلبات التسجيل الجماعي من الجهات
create table if not exists public.portal_org_requests (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.portal_organizations(id) on delete cascade,
  created_at      timestamptz not null default now(),
  requested_by    uuid references auth.users(id) on delete set null,
  requester_email text,
  program_id      uuid references public.programs(id) on delete set null,
  people          jsonb not null default '[]'::jsonb,       -- [{email, full_name}]
  count           int not null default 0,
  note            text,
  status          text not null default 'new',               -- new | reviewing | quoted | approved | enrolled | cancelled
  consulting_request_id uuid references public.portal_consulting_requests(id) on delete set null,
  invoice_id      uuid references public.portal_invoices(id) on delete set null,
  internal_notes  text,
  updated_at      timestamptz not null default now(),
  constraint por_status_chk check (status in ('new','reviewing','quoted','approved','enrolled','cancelled'))
);
create index if not exists por_org_idx on public.portal_org_requests (organization_id, created_at desc);
alter table public.portal_org_requests enable row level security;
drop policy if exists por_read on public.portal_org_requests;
create policy por_read on public.portal_org_requests for select to authenticated using (public.portal_is_staff() or public.portal_is_org_admin(organization_id));
drop policy if exists por_staff_write on public.portal_org_requests;
create policy por_staff_write on public.portal_org_requests for all to authenticated using (public.portal_is_writer()) with check (public.portal_is_writer());
grant select, insert, update on public.portal_org_requests to authenticated;

-- 3) ربط التسجيلات بالجهة تلقائيًا عند تأكيد العضوية (وعند إنشاء تسجيل لعضو مؤكد)
create or replace function public.trg_portal_member_link() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.user_id is null then select id into new.user_id from auth.users where lower(email) = lower(new.email) limit 1; end if;
  if new.status = 'confirmed' and (tg_op = 'INSERT' or old.status is distinct from 'confirmed') then
    new.confirmed_at := coalesce(new.confirmed_at, now());
    update public.portal_enrollments set organization_id = new.organization_id where lower(email) = lower(new.email) and organization_id is null;
    update public.portal_profiles set organization_id = new.organization_id where user_id = new.user_id and organization_id is null;
  end if;
  return new;
end $$;
drop trigger if exists portal_member_link on public.portal_org_members;
create trigger portal_member_link before insert or update on public.portal_org_members for each row execute function public.trg_portal_member_link();

create or replace function public.trg_portal_enrollment_org() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.organization_id is null then
    select organization_id into new.organization_id from public.portal_org_members m where lower(m.email) = lower(new.email) and m.status = 'confirmed' order by m.created_at limit 1;
  end if;
  return new;
end $$;
drop trigger if exists portal_enrollment_org on public.portal_enrollments;
create trigger portal_enrollment_org before insert on public.portal_enrollments for each row execute function public.trg_portal_enrollment_org();

-- 4) الانضمام التلقائي بنطاق البريد (بانتظار تأكيد مدير الجهة) — يُستدعى من الخادم عند دخول المستخدم
create or replace function public.portal_org_autojoin(p_user uuid, p_email text) returns int language plpgsql security definer set search_path = public as $$
declare v_domain text := lower(split_part(coalesce(p_email,''), '@', 2)); v_n int := 0; o record;
begin
  if v_domain = '' then return 0; end if;
  for o in select id from public.portal_organizations where active and email_domain is not null and lower(email_domain) = v_domain loop
    insert into public.portal_org_members (organization_id, user_id, email, role, status, source)
      values (o.id, p_user, lower(p_email), 'learner', 'pending', 'domain')
      on conflict (organization_id, lower(email)) do nothing;
    if found then v_n := v_n + 1; end if;
  end loop;
  return v_n;
end $$;
revoke all on function public.portal_org_autojoin(uuid, text) from public, anon, authenticated;
grant execute on function public.portal_org_autojoin(uuid, text) to service_role;

-- 5) لوحة أثر الجهة (مدير جهة مؤكد أو فريق أَثَر) — بيانات الأعضاء المؤكدين فقط
create or replace function public.portal_org_dashboard(p_org uuid) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v jsonb; v_emails text[]; v_users uuid[];
begin
  if not (public.portal_is_staff() or public.portal_is_org_admin(p_org)) then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;
  select array_agg(lower(email)), array_agg(user_id) filter (where user_id is not null) into v_emails, v_users from public.portal_org_members where organization_id = p_org and status = 'confirmed';
  v_emails := coalesce(v_emails, '{}'); v_users := coalesce(v_users, '{}');
  select jsonb_build_object('ok', true,
    'org', (select jsonb_build_object('id', o.id, 'name_ar', o.name_ar, 'name_en', o.name_en, 'sector', o.sector, 'email_domain', o.email_domain, 'city', o.city) from public.portal_organizations o where o.id = p_org),
    'members', (select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'email', m.email, 'full_name', m.full_name, 'role', m.role, 'status', m.status, 'source', m.source, 'created_at', m.created_at, 'user_id', m.user_id) order by m.status, m.created_at desc), '[]'::jsonb) from public.portal_org_members m where m.organization_id = p_org),
    'enrollments', (select coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'email', lower(e.email), 'full_name', e.full_name, 'status', e.status, 'program_id', e.program_id, 'program', p.name_ar, 'classroom_id', e.classroom_id, 'placement_level', e.placement_level, 'created_at', e.created_at,
        'attendance', (select jsonb_build_object('sessions', count(distinct s.id), 'present', count(distinct r.id) filter (where r.status::text in ('present','late'))) from public.attendance_sessions s left join public.attendance_records r on r.session_id = s.id and lower(r.email) = lower(e.email) where s.program_id = e.program_id)
      ) order by e.created_at desc), '[]'::jsonb) from public.portal_enrollments e join public.programs p on p.id = e.program_id where lower(e.email) = any(v_emails)),
    'credentials', (select coalesce(jsonb_agg(jsonb_build_object('email', lower(c.email), 'title_ar', c.title_ar, 'kind', c.kind, 'level', c.level, 'issued_at', c.issued_at, 'verify_code', c.verify_code) order by c.issued_at desc), '[]'::jsonb) from public.portal_credentials c where lower(c.email) = any(v_emails) and c.revoked_at is null),
    'placements', (select coalesce(jsonb_agg(jsonb_build_object('email', lower(pl.email), 'level', coalesce(pl.entry_level, pl.demonstrated_level), 'taken_at', pl.taken_at)), '[]'::jsonb) from public.portal_placements pl where lower(pl.email) = any(v_emails)),
    'skills', (select coalesce(jsonb_agg(jsonb_build_object('skill_id', l.skill_id, 'code', s.code, 'name_ar', s.name_ar, 'name_en', s.name_en, 'domain', s.domain, 'level', coalesce(l.approved_level, l.computed_level), 'confidence', l.confidence, 'user_id', l.user_id)), '[]'::jsonb) from public.portal_skill_levels l join public.portal_skills s on s.id = l.skill_id where l.user_id = any(v_users)),
    'events', (select jsonb_build_object('downloads', count(*) filter (where verb = 'downloaded'), 'sessions', count(*) filter (where verb in ('joined','attended')), 'assessed', count(*) filter (where verb = 'assessed'), 'last_at', max(at)) from public.portal_learning_events ev where lower(ev.email) = any(v_emails) or ev.user_id = any(v_users)),
    'requests', (select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'program_id', r.program_id, 'program', (select name_ar from public.programs where id = r.program_id), 'count', r.count, 'status', r.status, 'created_at', r.created_at, 'note', r.note) order by r.created_at desc), '[]'::jsonb) from public.portal_org_requests r where r.organization_id = p_org),
    'resources', (select coalesce(jsonb_agg(jsonb_build_object('id', rs.id, 'title_ar', rs.title_ar, 'title_en', rs.title_en, 'type', rs.type, 'downloads', rs.downloads) order by rs.published_at desc), '[]'::jsonb) from public.portal_resources rs where rs.organization_id = p_org and rs.status = 'published')
  ) into v;
  return v;
end $$;
grant execute on function public.portal_org_dashboard(uuid) to authenticated;

-- 6) تحقق
select 'members policies' as t, count(*) as n from pg_policies where tablename = 'portal_org_members'
union all select 'requests policies', count(*) from pg_policies where tablename = 'portal_org_requests'
union all select 'org admin read', count(*) from pg_policies where policyname = 'porg_admin_read'
union all select 'functions', count(*) from pg_proc where proname in ('portal_is_org_admin','portal_org_autojoin','portal_org_dashboard')
union all select 'triggers', count(*) from pg_trigger where tgname in ('portal_member_link','portal_enrollment_org');
