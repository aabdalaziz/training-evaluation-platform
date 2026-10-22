-- =====================================================================
-- المرحلة G2: متابعة أثر التدريب في بيئة العمل (كيركباتريك — المستوى 3: السلوك)
-- حملة متابعة لكل برنامج بعد 60–90 يومًا: استبيان للمشرف المباشر وللمتدرب
-- آمن لإعادة التشغيل (idempotent)
-- =====================================================================

do $$
begin
  if to_regclass('public.behavior_followups') is not null
     and not exists (select 1 from information_schema.columns
                     where table_schema='public' and table_name='behavior_followups' and column_name='token') then
    execute 'alter table public.behavior_followups rename to behavior_followups_legacy_' || to_char(now(),'YYYYMMDD');
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1) حملات المتابعة
-- ---------------------------------------------------------------------
create table if not exists public.behavior_followups (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid,
  program_id       uuid references public.programs(id) on delete set null,
  classroom_id     uuid references public.classrooms(id) on delete set null,
  title_ar         text not null,
  title_en         text,
  intro_ar         text,
  token            text not null unique,
  status           text not null default 'open' check (status in ('draft','open','closed')),
  scale_max        int  not null default 5 check (scale_max between 3 and 10),
  due_days         int  not null default 60 check (due_days between 0 and 365),
  open_at          date,                              -- موعد الإرسال التلقائي (نهاية البرنامج + due_days)
  supervisor_open  boolean not null default true,
  trainee_open     boolean not null default true,
  auto_send        boolean not null default true,
  remind_after_days int not null default 14,
  recipients       jsonb not null default '[]'::jsonb, -- [{name,email,role:'supervisor'|'trainee',trainee_name?,trainee_email?}]
  sent_at          timestamptz,
  reminded_at      timestamptz,
  created_by       uuid,
  created_by_name  text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists behavior_followups_program_idx on public.behavior_followups (program_id, created_at desc);
create index if not exists behavior_followups_due_idx     on public.behavior_followups (status, auto_send, open_at);

-- ---------------------------------------------------------------------
-- 2) بنود الاستبيان
-- ---------------------------------------------------------------------
create table if not exists public.behavior_questions (
  id           uuid primary key default gen_random_uuid(),
  followup_id  uuid not null references public.behavior_followups(id) on delete cascade,
  order_no     int  not null default 1,
  kind         text not null default 'scale' check (kind in ('scale','percent','multi','text')),
  audience     text not null default 'all' check (audience in ('all','supervisor','trainee')),
  domain_ar    text,
  text_ar      text not null,
  text_en      text,
  options      jsonb,                                  -- لبنود multi: ["...","..."]
  required     boolean not null default true
);
create index if not exists behavior_questions_followup_idx on public.behavior_questions (followup_id, order_no);

-- ---------------------------------------------------------------------
-- 3) الاستجابات (استجابة واحدة لكل مُجيب عن كل متدرب)
-- ---------------------------------------------------------------------
create table if not exists public.behavior_responses (
  id               uuid primary key default gen_random_uuid(),
  followup_id      uuid not null references public.behavior_followups(id) on delete cascade,
  role             text not null check (role in ('supervisor','trainee','peer')),
  respondent_hash  text not null,                     -- md5(followup:role:email|name)
  respondent_label text,
  trainee_key      text not null,                     -- بريد المتدرب (أو اسمه) موحّدًا — للمزاوجة بين المشرف والمتدرب
  trainee_label    text,
  answers          jsonb not null default '{}'::jsonb,
  scale_mean       numeric(5,3),
  application_pct  numeric(5,2),
  barriers         jsonb not null default '[]'::jsonb,
  comment          text,
  submitted_at     timestamptz not null default now(),
  unique (followup_id, role, respondent_hash, trainee_key)
);
create index if not exists behavior_responses_followup_idx on public.behavior_responses (followup_id, role);

-- ---------------------------------------------------------------------
-- 4) RLS
-- ---------------------------------------------------------------------
alter table public.behavior_followups enable row level security;
alter table public.behavior_questions enable row level security;
alter table public.behavior_responses enable row level security;

drop policy if exists behavior_followups_rw on public.behavior_followups;
create policy behavior_followups_rw on public.behavior_followups for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid()
          and upper(p.role::text) in ('PLATFORM_ADMIN','SUPER_ADMIN','ADMIN','PROGRAM_MANAGER','QUALITY_ANALYST','TRAINER')))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid()
          and upper(p.role::text) in ('PLATFORM_ADMIN','SUPER_ADMIN','ADMIN','PROGRAM_MANAGER','QUALITY_ANALYST')));

drop policy if exists behavior_questions_rw on public.behavior_questions;
create policy behavior_questions_rw on public.behavior_questions for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid()
          and upper(p.role::text) in ('PLATFORM_ADMIN','SUPER_ADMIN','ADMIN','PROGRAM_MANAGER','QUALITY_ANALYST','TRAINER')))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid()
          and upper(p.role::text) in ('PLATFORM_ADMIN','SUPER_ADMIN','ADMIN','PROGRAM_MANAGER','QUALITY_ANALYST')));

drop policy if exists behavior_responses_r on public.behavior_responses;
create policy behavior_responses_r on public.behavior_responses for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid()
          and upper(p.role::text) in ('PLATFORM_ADMIN','SUPER_ADMIN','ADMIN','PROGRAM_MANAGER','QUALITY_ANALYST','TRAINER')));
drop policy if exists behavior_responses_d on public.behavior_responses;
create policy behavior_responses_d on public.behavior_responses for delete to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid()
          and upper(p.role::text) in ('PLATFORM_ADMIN','SUPER_ADMIN','ADMIN')));

create or replace function public.trg_behavior_touch() returns trigger language plpgsql as $$
begin new.updated_at := now(); new.token := upper(trim(new.token)); return new; end $$;
drop trigger if exists behavior_followups_touch on public.behavior_followups;
create trigger behavior_followups_touch before insert or update on public.behavior_followups
  for each row execute function public.trg_behavior_touch();

-- ---------------------------------------------------------------------
-- 5) الدالة العامة: نموذج الاستبيان برمز الرابط
-- ---------------------------------------------------------------------
create or replace function public.behavior_form(p_token text)
returns jsonb
language sql security definer stable set search_path = public as $$
  select jsonb_build_object(
    'followup', jsonb_build_object(
      'id', f.id, 'title_ar', f.title_ar, 'title_en', f.title_en, 'intro_ar', f.intro_ar, 'status', f.status,
      'scale_max', f.scale_max, 'supervisor_open', f.supervisor_open, 'trainee_open', f.trainee_open,
      'program_name',    (select pr.name_ar from public.programs pr where pr.id = f.program_id),
      'program_name_en', (select pr.name_en from public.programs pr where pr.id = f.program_id),
      'program_end',     (select pr.end_date from public.programs pr where pr.id = f.program_id),
      'classroom_code',  (select c.code from public.classrooms c where c.id = f.classroom_id)
    ),
    'questions', coalesce((
      select jsonb_agg(jsonb_build_object('id', q.id, 'order_no', q.order_no, 'kind', q.kind, 'audience', q.audience, 'domain_ar', q.domain_ar,
                                          'text_ar', q.text_ar, 'text_en', q.text_en, 'options', q.options, 'required', q.required) order by q.order_no)
      from public.behavior_questions q where q.followup_id = f.id), '[]'::jsonb)
  )
  from public.behavior_followups f
  where f.token = upper(trim(p_token)) and f.status <> 'draft'
  limit 1;
$$;
grant execute on function public.behavior_form(text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 6) الدالة العامة: تسجيل استجابة (تحسب المتوسط ونسبة التطبيق والمعوقات في الخادم)
-- ---------------------------------------------------------------------
create or replace function public.behavior_submit(
  p_token text, p_role text, p_respondent_name text, p_respondent_email text,
  p_trainee_name text, p_trainee_email text, p_answers jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  f        public.behavior_followups%rowtype;
  q        record;
  v        jsonb;
  s_sum    numeric := 0; s_n int := 0;
  app      numeric;
  bars     jsonb := '[]'::jsonb;
  cmt      text;
  r_email  text := nullif(lower(trim(coalesce(p_respondent_email,''))), '');
  r_name   text := regexp_replace(trim(coalesce(p_respondent_name,'')), '\s+', ' ', 'g');
  t_email  text := nullif(lower(trim(coalesce(p_trainee_email,''))), '');
  t_name   text := regexp_replace(trim(coalesce(p_trainee_name,'')), '\s+', ' ', 'g');
  tkey     text;
  rhash    text;
  rid      uuid;
begin
  select * into f from public.behavior_followups where token = upper(trim(p_token)) limit 1;
  if f.id is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if f.status <> 'open' then return jsonb_build_object('ok', false, 'error', 'closed'); end if;
  if p_role not in ('supervisor','trainee','peer') then return jsonb_build_object('ok', false, 'error', 'bad_role'); end if;
  if (p_role = 'supervisor' and not f.supervisor_open) or (p_role = 'trainee' and not f.trainee_open) then
    return jsonb_build_object('ok', false, 'error', 'role_closed');
  end if;
  if length(r_name) < 3 then return jsonb_build_object('ok', false, 'error', 'bad_name'); end if;

  -- المتدرب موضوع التقييم: المتدرب نفسه عند الإجابة الذاتية
  if p_role = 'trainee' then t_name := r_name; t_email := r_email; end if;
  if length(t_name) < 3 and t_email is null then return jsonb_build_object('ok', false, 'error', 'bad_trainee'); end if;
  tkey  := coalesce('e:' || t_email, 'n:' || lower(t_name));
  rhash := md5(f.id::text || ':' || p_role || ':' || coalesce(r_email, lower(r_name)));

  for q in select * from public.behavior_questions where followup_id = f.id and audience in ('all', p_role) loop
    v := p_answers -> q.id::text;
    if v is null or v = 'null'::jsonb then continue; end if;
    if q.kind = 'scale' then
      s_sum := s_sum + least(greatest((v #>> '{}')::numeric, 1), f.scale_max); s_n := s_n + 1;
    elsif q.kind = 'percent' then
      app := least(greatest((v #>> '{}')::numeric, 0), 100);
    elsif q.kind = 'multi' then
      if jsonb_typeof(v) = 'array' then bars := bars || v; end if;
    elsif q.kind = 'text' then
      cmt := concat_ws(E'\n', cmt, nullif(trim(v #>> '{}'), ''));
    end if;
  end loop;
  if s_n = 0 and app is null then return jsonb_build_object('ok', false, 'error', 'empty'); end if;

  insert into public.behavior_responses (followup_id, role, respondent_hash, respondent_label, trainee_key, trainee_label, answers, scale_mean, application_pct, barriers, comment)
  values (f.id, p_role, rhash, r_name, tkey, t_name, coalesce(p_answers, '{}'::jsonb),
          case when s_n > 0 then round(s_sum / s_n, 3) end, app, bars, cmt)
  on conflict (followup_id, role, respondent_hash, trainee_key) do update
    set answers = excluded.answers, scale_mean = excluded.scale_mean, application_pct = excluded.application_pct,
        barriers = excluded.barriers, comment = excluded.comment, respondent_label = excluded.respondent_label,
        trainee_label = excluded.trainee_label, submitted_at = now()
  returning id into rid;

  return jsonb_build_object('ok', true, 'id', rid, 'scale_mean', case when s_n > 0 then round(s_sum / s_n, 3) end, 'application_pct', app);
end $$;
grant execute on function public.behavior_submit(text, text, text, text, text, text, jsonb) to anon, authenticated;

-- تحقق
select 'behavior_followups' as t, count(*) from public.behavior_followups
union all select 'behavior_questions', count(*) from public.behavior_questions
union all select 'behavior_responses', count(*) from public.behavior_responses;
