-- =====================================================================
-- المرحلة الثالثة (C): قياس أثر التدريب — اختبار/استبانة قبلي وبعدي
-- آمن لإعادة التشغيل (idempotent) — لا يعتمد على أي إضافات
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) أدوات القياس (أداة واحدة لكل برنامج/قاعة، لها رابط عام برمز token)
-- ---------------------------------------------------------------------
create table if not exists public.impact_assessments (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid,
  program_id      uuid references public.programs(id) on delete set null,
  classroom_id    uuid references public.classrooms(id) on delete set null,
  title_ar        text not null,
  title_en        text,
  intro_ar        text,
  token           text not null unique,
  status          text not null default 'open' check (status in ('draft','open','closed')),
  pre_open        boolean not null default true,
  post_open       boolean not null default false,
  scale_max       int  not null default 5 check (scale_max between 3 and 10),
  identity_hint_ar text not null default 'آخر 4 أرقام من رقم الهوية/الإقامة + سنة الميلاد (مثال: 4821-1998)',
  created_by      uuid,
  created_by_name text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists impact_assessments_program_idx on public.impact_assessments (program_id, created_at desc);

-- ---------------------------------------------------------------------
-- 2) بنود الأداة (مقياس تقدير ذاتي أو سؤال معرفي باختيار من متعدد)
-- ---------------------------------------------------------------------
create table if not exists public.impact_questions (
  id            uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.impact_assessments(id) on delete cascade,
  order_no      int  not null default 1,
  kind          text not null default 'scale' check (kind in ('scale','mcq')),
  domain_ar     text not null default 'عام',
  text_ar       text not null,
  text_en       text,
  options       jsonb not null default '[]'::jsonb,   -- [{"k":"a","ar":"...","en":"..."}] للأسئلة المعرفية
  correct_key   text,                                 -- مفتاح الإجابة الصحيحة للأسئلة المعرفية
  weight        numeric not null default 1
);
create index if not exists impact_questions_assessment_idx on public.impact_questions (assessment_id, order_no);

-- ---------------------------------------------------------------------
-- 3) الاستجابات (استجابة واحدة لكل متدرب لكل مرحلة، تُربط بمعرّف مُشفَّر)
-- ---------------------------------------------------------------------
create table if not exists public.impact_responses (
  id               uuid primary key default gen_random_uuid(),
  assessment_id    uuid not null references public.impact_assessments(id) on delete cascade,
  phase            text not null check (phase in ('pre','post')),
  respondent_hash  text not null,
  respondent_label text,                              -- آخر 3 رموز من المعرّف للعرض فقط
  gender           text,
  answers          jsonb not null default '{}'::jsonb, -- {question_id: value}
  scale_mean       numeric,                           -- متوسط بنود المقياس (1..scale_max)
  knowledge_pct    numeric,                           -- نسبة الإجابات الصحيحة 0..100
  score            numeric,                           -- الدرجة الموحدة 0..100
  submitted_at     timestamptz not null default now(),
  unique (assessment_id, phase, respondent_hash)
);
create index if not exists impact_responses_assessment_idx on public.impact_responses (assessment_id, phase);

-- ---------------------------------------------------------------------
-- 4) RLS: الإدارة فقط عبر الجداول؛ المتدربون عبر الدوال العامة أدناه
-- ---------------------------------------------------------------------
alter table public.impact_assessments enable row level security;
alter table public.impact_questions   enable row level security;
alter table public.impact_responses   enable row level security;

drop policy if exists impact_assessments_rw on public.impact_assessments;
create policy impact_assessments_rw on public.impact_assessments for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid()
          and upper(p.role::text) in ('PLATFORM_ADMIN','SUPER_ADMIN','ADMIN','PROGRAM_MANAGER','QUALITY_ANALYST','TRAINER')))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid()
          and upper(p.role::text) in ('PLATFORM_ADMIN','SUPER_ADMIN','ADMIN','PROGRAM_MANAGER','QUALITY_ANALYST')));

drop policy if exists impact_questions_rw on public.impact_questions;
create policy impact_questions_rw on public.impact_questions for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid()
          and upper(p.role::text) in ('PLATFORM_ADMIN','SUPER_ADMIN','ADMIN','PROGRAM_MANAGER','QUALITY_ANALYST','TRAINER')))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid()
          and upper(p.role::text) in ('PLATFORM_ADMIN','SUPER_ADMIN','ADMIN','PROGRAM_MANAGER','QUALITY_ANALYST')));

drop policy if exists impact_responses_r on public.impact_responses;
create policy impact_responses_r on public.impact_responses for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid()
          and upper(p.role::text) in ('PLATFORM_ADMIN','SUPER_ADMIN','ADMIN','PROGRAM_MANAGER','QUALITY_ANALYST','TRAINER')));
drop policy if exists impact_responses_d on public.impact_responses;
create policy impact_responses_d on public.impact_responses for delete to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid()
          and upper(p.role::text) in ('PLATFORM_ADMIN','SUPER_ADMIN','ADMIN','PROGRAM_MANAGER')));

-- ---------------------------------------------------------------------
-- 5) تحديث updated_at
-- ---------------------------------------------------------------------
create or replace function public.trg_impact_touch() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists impact_touch on public.impact_assessments;
create trigger impact_touch before update on public.impact_assessments for each row execute function public.trg_impact_touch();

-- ---------------------------------------------------------------------
-- 6) الدالة العامة: جلب نموذج الأداة برمز الرابط (بدون تسجيل دخول)
-- ---------------------------------------------------------------------
create or replace function public.impact_form(p_token text)
returns jsonb
language sql security definer stable set search_path = public as $$
  select jsonb_build_object(
    'assessment', jsonb_build_object(
      'id', a.id, 'title_ar', a.title_ar, 'title_en', a.title_en, 'intro_ar', a.intro_ar,
      'status', a.status, 'pre_open', a.pre_open, 'post_open', a.post_open, 'scale_max', a.scale_max,
      'identity_hint_ar', a.identity_hint_ar,
      'program_name', (select pr.name_ar from public.programs pr where pr.id = a.program_id),
      'program_name_en', (select pr.name_en from public.programs pr where pr.id = a.program_id),
      'classroom_code', (select c.code from public.classrooms c where c.id = a.classroom_id)
    ),
    'questions', coalesce((
      select jsonb_agg(jsonb_build_object('id', q.id, 'order_no', q.order_no, 'kind', q.kind, 'domain_ar', q.domain_ar,
                                          'text_ar', q.text_ar, 'text_en', q.text_en, 'options', q.options) order by q.order_no)
      from public.impact_questions q where q.assessment_id = a.id), '[]'::jsonb)
  )
  from public.impact_assessments a
  where a.token = upper(trim(p_token)) and a.status <> 'draft'
  limit 1;
$$;
grant execute on function public.impact_form(text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 7) الدالة العامة: تسجيل استجابة قبلية/بعدية (تحسب الدرجات في الخادم)
-- ---------------------------------------------------------------------
create or replace function public.impact_submit(p_token text, p_phase text, p_identity text, p_answers jsonb, p_gender text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  a        public.impact_assessments%rowtype;
  ident    text := lower(regexp_replace(coalesce(p_identity,''), '\s+', '', 'g'));
  h        text;
  lbl      text;
  q        record;
  v        text;
  s_sum    numeric := 0; s_n int := 0;
  k_ok     numeric := 0; k_n numeric := 0;
  sm       numeric; kp numeric; sc numeric;
  prev     numeric;
  rid      uuid;
begin
  select * into a from public.impact_assessments where token = upper(trim(p_token)) limit 1;
  if a.id is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if a.status <> 'open' then return jsonb_build_object('ok', false, 'error', 'closed'); end if;
  if p_phase not in ('pre','post') then return jsonb_build_object('ok', false, 'error', 'bad_phase'); end if;
  if (p_phase = 'pre' and not a.pre_open) or (p_phase = 'post' and not a.post_open) then
    return jsonb_build_object('ok', false, 'error', 'phase_closed');
  end if;
  if length(ident) < 4 then return jsonb_build_object('ok', false, 'error', 'bad_identity'); end if;

  h   := md5(a.id::text || ':' || ident);
  lbl := '…' || right(ident, 3);

  for q in select * from public.impact_questions where assessment_id = a.id loop
    v := p_answers ->> q.id::text;
    if v is null or v = '' then continue; end if;
    if q.kind = 'scale' then
      s_sum := s_sum + least(greatest(v::numeric, 1), a.scale_max); s_n := s_n + 1;
    else
      k_n := k_n + coalesce(q.weight, 1);
      if q.correct_key is not null and v = q.correct_key then k_ok := k_ok + coalesce(q.weight, 1); end if;
    end if;
  end loop;

  if s_n = 0 and k_n = 0 then return jsonb_build_object('ok', false, 'error', 'empty'); end if;
  sm := case when s_n > 0 then round(s_sum / s_n, 3) end;
  kp := case when k_n > 0 then round(100 * k_ok / k_n, 2) end;
  -- الدرجة الموحدة 0..100: متوسط ما هو متاح من (المقياس محوَّلًا إلى %) و(النسبة المعرفية)
  sc := round((coalesce(100 * (sm - 1) / nullif(a.scale_max - 1, 0), 0) + coalesce(kp, 0))
        / nullif((case when sm is null then 0 else 1 end) + (case when kp is null then 0 else 1 end), 0), 2);

  insert into public.impact_responses (assessment_id, phase, respondent_hash, respondent_label, gender, answers, scale_mean, knowledge_pct, score)
  values (a.id, p_phase, h, lbl, nullif(p_gender,''), coalesce(p_answers, '{}'::jsonb), sm, kp, sc)
  on conflict (assessment_id, phase, respondent_hash) do update
    set answers = excluded.answers, scale_mean = excluded.scale_mean, knowledge_pct = excluded.knowledge_pct,
        score = excluded.score, gender = excluded.gender, submitted_at = now()
  returning id into rid;

  if p_phase = 'post' then
    select score into prev from public.impact_responses where assessment_id = a.id and phase = 'pre' and respondent_hash = h;
  end if;

  return jsonb_build_object('ok', true, 'id', rid, 'score', sc, 'scale_mean', sm, 'knowledge_pct', kp, 'pre_score', prev);
end $$;
grant execute on function public.impact_submit(text, text, text, jsonb, text) to anon, authenticated;

-- تحقق
select 'impact_assessments' as t, count(*) from public.impact_assessments
union all select 'impact_questions', count(*) from public.impact_questions
union all select 'impact_responses', count(*) from public.impact_responses;
