-- © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
-- بوابة أَثَر — المرحلة P8-ج: تقارير الأثر القطاعية + الكتالوج المفتوح + جواز المهارات
-- آمن للتكرار. يعتمد على P4 (portal_is_staff) وP5 (القطاعات/المهارات/الجهات/الأحداث) وP6 (الجلسات) وP7 (مِعيار) وP8-أ/ب.

-- 1) قطاع البرنامج (اختياري) — يُستخدم في التصنيف القطاعي والكتالوج المفتوح
alter table public.programs add column if not exists sector text references public.portal_sectors(code) on update cascade on delete set null;
create index if not exists programs_sector_idx on public.programs (sector);

-- 2) دوال فرعية محمية (أي اختلاف في الجداول القديمة لا يُسقط التقرير كله)
-- الرضا: متوسط تقديرات بنود التقويم (1–5) لبرنامج في فترة
create or replace function public.portal_impact_satisfaction(p_program uuid, p_from timestamptz, p_to timestamptz) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v jsonb;
begin
  select jsonb_build_object('n', count(distinct e.id), 'mean', round(avg(a.rating_value)::numeric, 2))
    into v
    from public.evaluations e join public.evaluation_answers a on a.evaluation_id = e.id
   where e.program_id = p_program and e.submitted_at >= p_from and e.submitted_at < p_to and a.rating_value between 1 and 5;
  return coalesce(v, '{"n":0,"mean":null}'::jsonb);
exception when others then return jsonb_build_object('n', 0, 'mean', null, 'error', sqlerrm);
end $$;

-- القياس القبلي/البعدي: متوسط الدرجة الموحدة (0–100) لكل مرحلة
create or replace function public.portal_impact_prepost(p_program uuid, p_from timestamptz, p_to timestamptz) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v jsonb;
begin
  select jsonb_build_object(
      'pre_n', count(*) filter (where r.phase = 'pre'), 'pre', round(avg(r.score) filter (where r.phase = 'pre')::numeric, 1),
      'post_n', count(*) filter (where r.phase = 'post'), 'post', round(avg(r.score) filter (where r.phase = 'post')::numeric, 1))
    into v
    from public.impact_assessments ia join public.impact_responses r on r.assessment_id = ia.id
   where ia.program_id = p_program and r.submitted_at >= p_from and r.submitted_at < p_to and r.score is not null;
  return coalesce(v, '{"pre_n":0,"pre":null,"post_n":0,"post":null}'::jsonb);
exception when others then return jsonb_build_object('pre_n', 0, 'pre', null, 'post_n', 0, 'post', null, 'error', sqlerrm);
end $$;

-- نقل الأثر: متوسط نسبة التطبيق في العمل (مشرف/متدرب)
create or replace function public.portal_impact_transfer(p_program uuid, p_from timestamptz, p_to timestamptz) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v jsonb;
begin
  select jsonb_build_object('n', count(*), 'mean', round(avg(r.application_pct)::numeric, 1),
      'supervisor', round(avg(r.application_pct) filter (where r.role = 'supervisor')::numeric, 1), 'trainee', round(avg(r.application_pct) filter (where r.role = 'trainee')::numeric, 1))
    into v
    from public.behavior_followups f join public.behavior_responses r on r.followup_id = f.id
   where f.program_id = p_program and r.submitted_at >= p_from and r.submitted_at < p_to and r.application_pct is not null;
  return coalesce(v, '{"n":0,"mean":null}'::jsonb);
exception when others then return jsonb_build_object('n', 0, 'mean', null, 'error', sqlerrm);
end $$;

-- الحضور: الجلسات، المتوقع (جلسات × متعلمون)، الحاضرون
create or replace function public.portal_impact_attendance(p_program uuid, p_emails text[], p_from timestamptz, p_to timestamptz) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v jsonb;
begin
  select jsonb_build_object('sessions', count(distinct s.id),
      'present', (select count(distinct (r.session_id, lower(r.email))) from public.attendance_records r join public.attendance_sessions s2 on s2.id = r.session_id
                   where s2.program_id = p_program and s2.session_date >= p_from::date and s2.session_date < p_to::date and r.status::text in ('present','late') and lower(coalesce(r.email,'')) = any(p_emails)))
    into v
    from public.attendance_sessions s where s.program_id = p_program and s.session_date >= p_from::date and s.session_date < p_to::date;
  return coalesce(v, '{"sessions":0,"present":0}'::jsonb);
exception when others then return jsonb_build_object('sessions', 0, 'present', 0, 'error', sqlerrm);
end $$;

revoke execute on function public.portal_impact_satisfaction(uuid, timestamptz, timestamptz) from public, anon, authenticated;
revoke execute on function public.portal_impact_prepost(uuid, timestamptz, timestamptz) from public, anon, authenticated;
revoke execute on function public.portal_impact_transfer(uuid, timestamptz, timestamptz) from public, anon, authenticated;
revoke execute on function public.portal_impact_attendance(uuid, text[], timestamptz, timestamptz) from public, anon, authenticated;

-- 3) تقرير الأثر القطاعي (موظفون فقط) — مرشحات: الفترة، القطاع، المهارة، الجهة
create or replace function public.portal_impact_report(p_from date default null, p_to date default null, p_sector text default null, p_skill uuid default null, p_org uuid default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v jsonb; v_from timestamptz := coalesce(p_from, date '2000-01-01')::timestamptz; v_to timestamptz := (coalesce(p_to, current_date) + 1)::timestamptz;
  v_progs uuid[]; v_emails text[]; v_users uuid[]; v_skills uuid[];
begin
  if not public.portal_is_staff() then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;

  -- البرامج في النطاق
  select array_agg(p.id) into v_progs from public.programs p
   where p.archived_at is null
     and (p_sector is null or p.sector = p_sector
          or exists (select 1 from public.portal_enrollments e join public.portal_organizations o on o.id = e.organization_id where e.program_id = p.id and o.sector = p_sector))
     and (p_skill is null or exists (select 1 from public.portal_program_skills ps where ps.program_id = p.id and ps.skill_id = p_skill))
     and (p_org is null or exists (select 1 from public.portal_enrollments e where e.program_id = p.id and e.organization_id = p_org));
  v_progs := coalesce(v_progs, '{}');

  -- المتعلمون في النطاق (تسجيلات مقبولة ضمن الفترة)
  select array_agg(distinct lower(e.email)), array_agg(distinct e.user_id) filter (where e.user_id is not null) into v_emails, v_users
    from public.portal_enrollments e
   where e.program_id = any(v_progs) and e.status::text = 'approved' and e.created_at >= v_from and e.created_at < v_to and (p_org is null or e.organization_id = p_org);
  v_emails := coalesce(v_emails, '{}'); v_users := coalesce(v_users, '{}');

  -- المهارات في النطاق
  select array_agg(distinct ps.skill_id) into v_skills from public.portal_program_skills ps where ps.program_id = any(v_progs) and (p_skill is null or ps.skill_id = p_skill);
  v_skills := coalesce(v_skills, '{}');

  select jsonb_build_object('ok', true, 'generated_at', now(), 'from', p_from, 'to', p_to,
    'filters', jsonb_build_object('sector', p_sector, 'skill', p_skill, 'org', p_org),
    'scope', jsonb_build_object('programs', coalesce(array_length(v_progs, 1), 0), 'learners', coalesce(array_length(v_emails, 1), 0), 'skills', coalesce(array_length(v_skills, 1), 0)),
    'programs', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', p.id, 'name_ar', p.name_ar, 'name_en', p.name_en, 'sector', p.sector, 'program_type', p.program_type, 'hours', p.hours, 'cefr_level', p.cefr_level, 'start_date', p.start_date, 'end_date', p.end_date, 'delivery_mode', p.delivery_mode,
        'learners', (select count(distinct lower(e.email)) from public.portal_enrollments e where e.program_id = p.id and e.status::text = 'approved' and e.created_at >= v_from and e.created_at < v_to and (p_org is null or e.organization_id = p_org)),
        'pending', (select count(*) from public.portal_enrollments e where e.program_id = p.id and e.status::text in ('pending','waitlisted') and (p_org is null or e.organization_id = p_org)),
        'orgs', (select count(distinct e.organization_id) from public.portal_enrollments e where e.program_id = p.id and e.organization_id is not null and e.status::text = 'approved' and e.created_at >= v_from and e.created_at < v_to),
        'credentials', (select count(*) from public.portal_credentials c where c.program_id = p.id and c.revoked_at is null and c.issued_at >= v_from and c.issued_at < v_to and lower(c.email) = any(v_emails)),
        'skills', (select coalesce(jsonb_agg(ps.skill_id), '[]'::jsonb) from public.portal_program_skills ps where ps.program_id = p.id),
        'attendance', public.portal_impact_attendance(p.id, v_emails, v_from, v_to),
        'satisfaction', public.portal_impact_satisfaction(p.id, v_from, v_to),
        'prepost', public.portal_impact_prepost(p.id, v_from, v_to),
        'transfer', public.portal_impact_transfer(p.id, v_from, v_to)
      ) order by p.start_date desc nulls last), '[]'::jsonb) from public.programs p where p.id = any(v_progs)),
    'orgs', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', o.id, 'name_ar', o.name_ar, 'name_en', o.name_en, 'sector', o.sector, 'city', o.city,
        'learners', (select count(distinct lower(e.email)) from public.portal_enrollments e where e.organization_id = o.id and e.program_id = any(v_progs) and e.status::text = 'approved' and e.created_at >= v_from and e.created_at < v_to),
        'enrollments', (select count(*) from public.portal_enrollments e where e.organization_id = o.id and e.program_id = any(v_progs) and e.created_at >= v_from and e.created_at < v_to),
        'credentials', (select count(*) from public.portal_credentials c where c.revoked_at is null and c.issued_at >= v_from and c.issued_at < v_to and lower(c.email) in (select lower(m.email) from public.portal_org_members m where m.organization_id = o.id and m.status = 'confirmed')),
        'members', (select count(*) from public.portal_org_members m where m.organization_id = o.id and m.status = 'confirmed'),
        'avg_level', (select round(avg(coalesce(l.approved_level, l.computed_level))::numeric, 2) from public.portal_skill_levels l where l.skill_id = any(v_skills) and l.user_id in (select m.user_id from public.portal_org_members m where m.organization_id = o.id and m.status = 'confirmed' and m.user_id is not null))
      ) order by o.name_ar), '[]'::jsonb) from public.portal_organizations o
      where o.active and (p_org is null or o.id = p_org) and (p_sector is null or o.sector = p_sector or exists (select 1 from public.portal_enrollments e where e.organization_id = o.id and e.program_id = any(v_progs)))
        and exists (select 1 from public.portal_enrollments e where e.organization_id = o.id and e.program_id = any(v_progs))),
    'skills', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', s.id, 'code', s.code, 'name_ar', s.name_ar, 'name_en', s.name_en, 'domain', s.domain, 'saqf_level', s.saqf_level, 'cefr_level', s.cefr_level, 'sdaia_code', s.sdaia_code,
        'learners', (select count(*) from public.portal_skill_levels l where l.skill_id = s.id and l.user_id = any(v_users)),
        'avg_level', (select round(avg(coalesce(l.approved_level, l.computed_level))::numeric, 2) from public.portal_skill_levels l where l.skill_id = s.id and l.user_id = any(v_users)),
        'approved', (select count(*) from public.portal_skill_levels l where l.skill_id = s.id and l.user_id = any(v_users) and l.approved_level is not null),
        'proven', (select count(*) from public.portal_skill_levels l where l.skill_id = s.id and l.user_id = any(v_users) and coalesce(l.approved_level, l.computed_level) >= 3 and l.confidence >= 35),
        'programs', (select count(*) from public.portal_program_skills ps where ps.skill_id = s.id and ps.program_id = any(v_progs))
      ) order by s.code), '[]'::jsonb) from public.portal_skills s where s.id = any(v_skills)),
    'sectors', (select coalesce(jsonb_agg(jsonb_build_object('code', sc.code, 'name_ar', sc.name_ar, 'name_en', sc.name_en,
        'programs', (select count(*) from public.programs p where p.sector = sc.code and p.id = any(v_progs)),
        'orgs', (select count(*) from public.portal_organizations o where o.sector = sc.code and o.active),
        'learners', (select count(distinct lower(e.email)) from public.portal_enrollments e join public.programs p on p.id = e.program_id left join public.portal_organizations o on o.id = e.organization_id
                      where e.program_id = any(v_progs) and e.status::text = 'approved' and e.created_at >= v_from and e.created_at < v_to and (p.sector = sc.code or o.sector = sc.code))
      ) order by sc.name_ar), '[]'::jsonb) from public.portal_sectors sc where sc.active),
    'placements', (select coalesce(jsonb_object_agg(lv, n), '{}'::jsonb) from (
        select coalesce(x.entry_level, x.demonstrated_level, '—') as lv, count(*) as n from (
          select distinct on (lower(pl.email)) pl.email, pl.entry_level, pl.demonstrated_level from public.portal_placements pl where lower(pl.email) = any(v_emails) order by lower(pl.email), pl.taken_at desc) x group by 1) z),
    'credentials', (select jsonb_build_object('total', count(*), 'by_kind', coalesce(jsonb_object_agg(k, n), '{}'::jsonb)) from (
        select c.kind as k, count(*) as n from public.portal_credentials c where c.revoked_at is null and c.issued_at >= v_from and c.issued_at < v_to and lower(c.email) = any(v_emails) group by c.kind) y),
    'events', (select jsonb_build_object('total', count(*), 'downloads', count(*) filter (where verb = 'downloaded'), 'sessions', count(*) filter (where verb in ('joined','attended')), 'assessed', count(*) filter (where verb = 'assessed'), 'completed', count(*) filter (where verb = 'completed'))
        from public.portal_learning_events ev where ev.at >= v_from and ev.at < v_to and (lower(coalesce(ev.email,'')) = any(v_emails) or ev.user_id = any(v_users)))
  ) into v;
  return v;
end $$;
grant execute on function public.portal_impact_report(date, date, text, uuid, uuid) to authenticated;

-- 4) تحقق
select 'programs.sector' as t, count(*) as n from information_schema.columns where table_schema = 'public' and table_name = 'programs' and column_name = 'sector'
union all select 'helper functions', count(*) from pg_proc where proname in ('portal_impact_satisfaction','portal_impact_prepost','portal_impact_transfer','portal_impact_attendance')
union all select 'report function', count(*) from pg_proc where proname = 'portal_impact_report'
union all select 'report smoke (ok key)', count(*) from (select public.portal_impact_report() r) q where q.r ? 'ok';
