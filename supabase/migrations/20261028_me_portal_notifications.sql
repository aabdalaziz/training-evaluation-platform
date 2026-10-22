-- =====================================================================
-- المرحلة G3: بوابة المتدرب (/me) + مركز الإشعارات الإداري
-- آمن لإعادة التشغيل (idempotent)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) الإشعارات
-- ---------------------------------------------------------------------
do $$
begin
  if to_regclass('public.notifications') is not null
     and not exists (select 1 from information_schema.columns
                     where table_schema='public' and table_name='notifications' and column_name='dedupe_key') then
    execute 'alter table public.notifications rename to notifications_legacy_' || to_char(now(),'YYYYMMDD');
  end if;
end $$;

create table if not exists public.notifications (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid,
  kind            text not null,                          -- followup_missing | followup_silent | followup_manual_due | session_unclosed | certificates_missing | impact_post_pending | low_transfer | program_overdue | manual
  severity        text not null default 'info' check (severity in ('info','warn','critical')),
  title           text not null,
  body            text,
  href            text,
  entity_id       uuid,
  dedupe_key      text not null unique,
  created_at      timestamptz not null default now(),
  read_at         timestamptz,
  read_by         uuid,
  resolved_at     timestamptz
);
create index if not exists notifications_open_idx on public.notifications (resolved_at, read_at, created_at desc);

create table if not exists public.notification_runs (
  id        bigserial primary key,
  ran_at    timestamptz not null default now(),
  source    text not null default 'manual',               -- manual | cron
  inserted  int  not null default 0,
  resolved  int  not null default 0
);

alter table public.notifications      enable row level security;
alter table public.notification_runs  enable row level security;

drop policy if exists notifications_r on public.notifications;
create policy notifications_r on public.notifications for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid()
          and upper(p.role::text) in ('PLATFORM_ADMIN','SUPER_ADMIN','ADMIN','PROGRAM_MANAGER','QUALITY_ANALYST','TRAINER')));

drop policy if exists notifications_u on public.notifications;
create policy notifications_u on public.notifications for update to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid()
          and upper(p.role::text) in ('PLATFORM_ADMIN','SUPER_ADMIN','ADMIN','PROGRAM_MANAGER','QUALITY_ANALYST','TRAINER')))
  with check (true);

drop policy if exists notifications_i on public.notifications;
create policy notifications_i on public.notifications for insert to authenticated
  with check (exists (select 1 from public.profiles p where p.id = auth.uid()
          and upper(p.role::text) in ('PLATFORM_ADMIN','SUPER_ADMIN','ADMIN','PROGRAM_MANAGER','QUALITY_ANALYST')));

drop policy if exists notification_runs_r on public.notification_runs;
create policy notification_runs_r on public.notification_runs for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid()
          and upper(p.role::text) in ('PLATFORM_ADMIN','SUPER_ADMIN','ADMIN','PROGRAM_MANAGER','QUALITY_ANALYST','TRAINER')));

-- ---------------------------------------------------------------------
-- 2) فحص القواعد وتوليد الإشعارات (يُستدعى من الـ Cron أو زر «فحص الآن»)
-- ---------------------------------------------------------------------
create or replace function public.notifications_scan(p_source text default 'manual')
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_today    date := (now() at time zone 'Asia/Riyadh')::date;
  v_inserted int := 0;
  v_resolved int := 0;
  v_new      jsonb := '[]'::jsonb;
  v_kinds    text[] := array['followup_missing','followup_silent','followup_manual_due','session_unclosed','certificates_missing','impact_post_pending','low_transfer','program_overdue'];
begin
  if auth.role() is distinct from 'service_role'
     and not exists (select 1 from public.profiles p where p.id = auth.uid()
                     and upper(p.role::text) in ('PLATFORM_ADMIN','SUPER_ADMIN','ADMIN','PROGRAM_MANAGER','QUALITY_ANALYST')) then
    raise exception 'forbidden';
  end if;

  create temp table if not exists _cur (
    kind text, severity text, title text, body text, href text, entity_id uuid, organization_id uuid, dedupe_key text
  ) on commit drop;
  truncate _cur;

  -- R1: برنامج ينتهي خلال 14 يومًا أو انتهى خلال 45 يومًا بلا حملة متابعة أثر
  insert into _cur
  select 'followup_missing', 'warn',
         'برنامج بلا حملة متابعة أثر: ' || p.name_ar,
         case when p.end_date >= v_today then 'ينتهي في ' || to_char(p.end_date,'YYYY-MM-DD') else 'انتهى في ' || to_char(p.end_date,'YYYY-MM-DD') end
           || ' — أنشئ حملة متابعة (المستوى 3) ليُرسل الاستبيان تلقائيًا بعد 60–90 يومًا.',
         '/admin/followup?program=' || p.id, p.id, p.organization_id, 'followup_missing:' || p.id
  from public.programs p
  where p.end_date is not null and p.end_date between v_today - 45 and v_today + 14
    and upper(coalesce(p.status,'')) <> 'CANCELLED'
    and not exists (select 1 from public.behavior_followups f where f.program_id = p.id);

  -- R2: حملة مفتوحة أُرسلت قبل 7 أيام أو أكثر بلا أي استجابة
  insert into _cur
  select 'followup_silent', 'warn',
         'لا استجابات بعد: ' || f.title_ar,
         'أُرسلت في ' || to_char(f.sent_at at time zone 'Asia/Riyadh','YYYY-MM-DD') || ' ولم تصل أي استجابة — أعد التذكير أو تواصل مع المشرفين.',
         '/admin/followup', f.id, f.organization_id, 'followup_silent:' || f.id
  from public.behavior_followups f
  where f.status = 'open' and f.sent_at is not null and f.sent_at < now() - interval '7 days'
    and not exists (select 1 from public.behavior_responses r where r.followup_id = f.id);

  -- R3: حملة بإرسال يدوي بلغ موعدها ولم تُرسل
  insert into _cur
  select 'followup_manual_due', 'info',
         'حان موعد إرسال حملة المتابعة: ' || f.title_ar,
         'الموعد المقترح ' || to_char(f.open_at,'YYYY-MM-DD') || ' والإرسال التلقائي معطّل — اضغط «إرسال الآن» من إدارة الحملات.',
         '/admin/followup', f.id, f.organization_id, 'followup_manual_due:' || f.id
  from public.behavior_followups f
  where f.status = 'open' and f.auto_send = false and f.sent_at is null and f.open_at is not null and f.open_at <= v_today
    and jsonb_array_length(coalesce(f.recipients,'[]'::jsonb)) > 0;

  -- R4: جلسة حضور ما زالت مفتوحة بعد يومها
  insert into _cur
  select 'session_unclosed', 'info',
         'جلسة حضور لم تُغلق: ' || coalesce(s.title, to_char(s.session_date,'YYYY-MM-DD')),
         'بتاريخ ' || to_char(s.session_date,'YYYY-MM-DD') || ' — أغلقها لتثبيت نسب الحضور.',
         '/admin/attendance', s.id, s.organization_id, 'session_unclosed:' || s.id
  from public.attendance_sessions s
  where s.status = 'open' and s.session_date < v_today;

  -- R5: برنامج انتهى (منذ 1–60 يومًا) وله سجلات حضور ولا شهادات مصدرة
  insert into _cur
  select 'certificates_missing', 'info',
         'شهادات لم تُصدر: ' || p.name_ar,
         'انتهى في ' || to_char(p.end_date,'YYYY-MM-DD') || ' وله حضور مسجّل — استورد المؤهلين من سجل الحضور وأصدر الشهادات.',
         '/admin/certificates', p.id, p.organization_id, 'certificates_missing:' || p.id
  from public.programs p
  where p.end_date is not null and p.end_date between v_today - 60 and v_today - 1
    and exists (select 1 from public.attendance_sessions s join public.attendance_records r on r.session_id = s.id where s.program_id = p.id)
    and not exists (select 1 from public.certificates c where c.program_id = p.id and c.revoked_at is null);

  -- R6: أداة قياس أثر مفتوحة والبرنامج انتهى والقياس البعدي لم يُفعّل
  insert into _cur
  select 'impact_post_pending', 'warn',
         'فعّل القياس البعدي: ' || a.title_ar,
         'انتهى البرنامج «' || coalesce(p.name_ar,'—') || '» والقياس البعدي ما زال مغلقًا — فعّله لاحتساب الكسب المعياري.',
         '/admin/impact', a.id, a.organization_id, 'impact_post_pending:' || a.id
  from public.impact_assessments a join public.programs p on p.id = a.program_id
  where a.status = 'open' and a.post_open = false and p.end_date is not null and p.end_date <= v_today;

  -- R7: مؤشر نقل أثر منخفض (≥3 تقييمات مشرفين ومتوسطها أقل من 3 من 5)
  insert into _cur
  select 'low_transfer', 'critical',
         'نقل أثر ضعيف: ' || f.title_ar,
         'متوسط تقدير المشرفين ' || round(avg(r.scale_mean)::numeric, 2) || ' من ' || f.scale_max || ' عبر ' || count(*) || ' تقييمًا — راجع تقرير نقل الأثر وخطّط لجلسة تعزيز.',
         '/reports/transfer?followup=' || f.id, f.id, f.organization_id, 'low_transfer:' || f.id
  from public.behavior_followups f join public.behavior_responses r on r.followup_id = f.id and r.role = 'supervisor' and r.scale_mean is not null
  group by f.id, f.title_ar, f.scale_max, f.organization_id
  having count(*) >= 3 and avg(r.scale_mean) < (f.scale_max * 0.6);

  -- R8: برنامج «نشط» تجاوز تاريخ نهايته بأكثر من 7 أيام
  insert into _cur
  select 'program_overdue', 'info',
         'برنامج تجاوز تاريخ نهايته وما زال نشطًا: ' || p.name_ar,
         'تاريخ النهاية ' || to_char(p.end_date,'YYYY-MM-DD') || ' — حدّث حالته إلى «مكتمل» لتصحّ التقارير.',
         '/admin/management', p.id, p.organization_id, 'program_overdue:' || p.id
  from public.programs p
  where upper(coalesce(p.status,'')) = 'ACTIVE' and p.end_date is not null and p.end_date < v_today - 7;

  -- إدراج الجديد / إعادة فتح ما حُلّ سابقًا وعاد
  with up as (
    insert into public.notifications (organization_id, kind, severity, title, body, href, entity_id, dedupe_key)
    select c.organization_id, c.kind, c.severity, c.title, c.body, c.href, c.entity_id, c.dedupe_key from _cur c
    on conflict (dedupe_key) do update
      set title = excluded.title, body = excluded.body, severity = excluded.severity, href = excluded.href,
          created_at = case when public.notifications.resolved_at is not null then now() else public.notifications.created_at end,
          read_at    = case when public.notifications.resolved_at is not null then null  else public.notifications.read_at end,
          resolved_at = null
    returning id, kind, severity, title, href, (xmax = 0) as is_new
  )
  select count(*) filter (where is_new),
         coalesce(jsonb_agg(jsonb_build_object('id', id, 'kind', kind, 'severity', severity, 'title', title, 'href', href)) filter (where is_new), '[]'::jsonb)
    into v_inserted, v_new
  from up;

  -- حلّ ما لم يعد قائمًا
  with res as (
    update public.notifications n set resolved_at = now()
    where n.resolved_at is null and n.kind = any(v_kinds)
      and not exists (select 1 from _cur c where c.dedupe_key = n.dedupe_key)
    returning 1
  ) select count(*) into v_resolved from res;

  insert into public.notification_runs (source, inserted, resolved) values (coalesce(p_source,'manual'), v_inserted, v_resolved);
  return jsonb_build_object('ok', true, 'inserted', v_inserted, 'resolved', v_resolved, 'new', v_new, 'ran_at', now());
end $$;
grant execute on function public.notifications_scan(text) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 3) بوابة المتدرب: كل ما يخص المستخدم الحالي ببريده (برامج، حضور، تقييمات، شهادات، مهام)
-- ---------------------------------------------------------------------
create or replace function public.me_portal()
returns jsonb
language plpgsql security definer stable set search_path = public as $$
declare
  v_uid      uuid := auth.uid();
  v_email    text := lower(trim(coalesce(auth.jwt()->>'email','')));
  v_name     text;
  v_programs uuid[];
  v_list     jsonb;
  v_other    jsonb;
begin
  if v_uid is null or v_email = '' then return jsonb_build_object('ok', false, 'error', 'unauthenticated'); end if;

  select r.full_name into v_name from public.attendance_records r where lower(r.email) = v_email order by r.created_at desc limit 1;
  if v_name is null then select c.recipient_name into v_name from public.certificates c where lower(c.recipient_email) = v_email order by c.created_at desc limit 1; end if;
  if v_name is null then select e.guest_name into v_name from public.evaluations e where lower(e.guest_email) = v_email and e.guest_name is not null order by e.created_at desc limit 1; end if;
  if v_name is null then v_name := coalesce(auth.jwt()->'user_metadata'->>'full_name', split_part(v_email,'@',1)); end if;

  select array_agg(distinct pid) into v_programs from (
    select en.program_id as pid from public.enrollments en where en.trainee_id = v_uid and coalesce(en.is_active, true)
    union select s.program_id from public.attendance_records r join public.attendance_sessions s on s.id = r.session_id where lower(r.email) = v_email
    union select c.program_id from public.certificates c where lower(c.recipient_email) = v_email
    union select e.program_id from public.evaluations e where lower(e.guest_email) = v_email
  ) x where pid is not null;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id, 'name_ar', p.name_ar, 'name_en', p.name_en, 'status', p.status, 'start_date', p.start_date, 'end_date', p.end_date,
    'is_final_open', coalesce(p.is_final_open, false), 'delivery_mode', p.delivery_mode,
    'attendance', (select jsonb_build_object(
        'sessions', count(distinct s.id) filter (where s.session_date <= (now() at time zone 'Asia/Riyadh')::date),
        'present',  count(distinct r.id) filter (where r.status = 'present'),
        'late',     count(distinct r.id) filter (where r.status = 'late'),
        'excused',  count(distinct r.id) filter (where r.status = 'excused'))
      from public.attendance_sessions s left join public.attendance_records r on r.session_id = s.id and lower(r.email) = v_email
      where s.program_id = p.id),
    'open_sessions', (select coalesce(jsonb_agg(jsonb_build_object('token', s.token, 'title', s.title, 'session_date', s.session_date,
        'checked', exists (select 1 from public.attendance_records r where r.session_id = s.id and lower(r.email) = v_email)) order by s.session_date), '[]'::jsonb)
      from public.attendance_sessions s where s.program_id = p.id and s.status = 'open' and s.session_date >= (now() at time zone 'Asia/Riyadh')::date - 1),
    'evals', (select jsonb_build_object('daily', count(*) filter (where upper(coalesce(t.kind,'')) = 'DAILY'), 'final', count(*) filter (where upper(coalesce(t.kind,'')) = 'FINAL'), 'last_at', max(e.created_at))
      from public.evaluations e left join public.evaluation_templates t on t.id = e.template_id
      where e.program_id = p.id and lower(e.guest_email) = v_email),
    'impact', (select coalesce(jsonb_agg(jsonb_build_object('token', a.token, 'title_ar', a.title_ar, 'pre_open', a.pre_open, 'post_open', a.post_open) order by a.created_at), '[]'::jsonb)
      from public.impact_assessments a where a.program_id = p.id and a.status = 'open'),
    'followups', (select coalesce(jsonb_agg(jsonb_build_object('token', f.token, 'title_ar', f.title_ar,
        'answered', exists (select 1 from public.behavior_responses br where br.followup_id = f.id and br.role = 'trainee' and br.respondent_hash = md5(f.id::text || ':trainee:' || v_email))) order by f.created_at), '[]'::jsonb)
      from public.behavior_followups f where f.program_id = p.id and f.status = 'open' and f.trainee_open),
    'certificates', (select coalesce(jsonb_agg(jsonb_build_object('serial', c.serial, 'verify_code', c.verify_code, 'kind', c.kind, 'issued_at', c.issued_at,
        'award_title', c.award_title, 'hours', c.hours, 'revoked', c.revoked_at is not null) order by c.issued_at desc), '[]'::jsonb)
      from public.certificates c where c.program_id = p.id and lower(c.recipient_email) = v_email)
  ) order by p.start_date desc nulls last), '[]'::jsonb)
  into v_list
  from public.programs p where p.id = any(coalesce(v_programs, array[]::uuid[]));

  select coalesce(jsonb_agg(jsonb_build_object('serial', c.serial, 'verify_code', c.verify_code, 'kind', c.kind, 'issued_at', c.issued_at,
        'award_title', c.award_title, 'program_name', c.program_name, 'revoked', c.revoked_at is not null) order by c.issued_at desc), '[]'::jsonb)
  into v_other
  from public.certificates c where lower(c.recipient_email) = v_email and c.program_id is null;

  return jsonb_build_object('ok', true, 'email', v_email, 'name', v_name, 'programs', v_list, 'other_certificates', v_other,
                            'today', (now() at time zone 'Asia/Riyadh')::date);
end $$;
grant execute on function public.me_portal() to authenticated;
