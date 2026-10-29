-- =====================================================================================
-- 789 — P23 «مجالس أَثَر» (Athar Councils): مجالس الأقران حيث يُصنع الأثر بين الممارسين لا فوقهم
-- © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved.
-- آمن لإعادة التشغيل. يُنفَّذ قبل رفع ملفات الكود.
--   1) portal_councils              المجلس: المجال · القطاع · المهارات · الدورة (6 أسابيع) · الكرسي · الميثاق · الحالة
--   2) portal_council_members       الأعضاء (5–7 من جهتين على الأقل) + المتقدمون (council_id فارغ) · توقيع الميثاق · الدور · الدورات المكتملة
--   3) portal_council_cases         القضية: موقف عمل حقيقي → التزام (موعد عودة 14 يومًا) → عودة → إغلاق
--   4) portal_council_posts         المداولات: سؤال · نصيحة · دليل · ملاحظة عودة (نص + وسائط اختيارية من «الأداء المُشاهَد»)
--   5) portal_council_attestations  شهادة الأقران: من → لمن · مهارة · دليل مُسنَد · pending → approved/declined (مدير الجهة أولًا ثم الطاقم)
--   6) portal_council_scribe        مخرجات «كاتب المجلس» لكل قضية (ملخص · التزامات · الأسئلة المحورية · ما لم يُقل · أنماط) — بلا أسماء
--   7) دوال RPC (service role فقط): council_feed · council_mirror · council_wisdom (k ≥ 5 أشخاص و≥ 2 جهة)
-- =====================================================================================

-- 1) المجالس
create table if not exists public.portal_councils (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  created_by       uuid,
  title_ar         text not null,
  domain           text,                                   -- مجال مهاري (رمز)
  sector_code      text,                                   -- قطاع (اختياري)
  skill_ids        uuid[] not null default '{}',
  status           text not null default 'proposed' check (status in ('proposed','active','paused','closed')),
  cycle_no         integer not null default 1,
  cycle_weeks      integer not null default 6 check (cycle_weeks between 2 and 12),
  cycle_started_at timestamptz,
  cycle_ends_at    timestamptz,
  chair_email      text,
  charter_version  text not null default '2026-10',
  max_members      integer not null default 7 check (max_members between 3 and 12),
  min_orgs         integer not null default 2,
  meta             jsonb not null default '{}'::jsonb
);
create index if not exists portal_councils_status_idx on public.portal_councils (status, cycle_ends_at);

-- 2) الأعضاء والمتقدمون
create table if not exists public.portal_council_members (
  id                bigserial primary key,
  created_at        timestamptz not null default now(),
  council_id        uuid references public.portal_councils(id) on delete cascade,   -- null = متقدم ينتظر التشكيل
  user_id           uuid,
  email             text not null,
  full_name         text,
  organization_id   uuid,
  role              text not null default 'member' check (role in ('chair','member')),
  status            text not null default 'invited' check (status in ('applied','invited','active','left')),
  charter_signed_at timestamptz,
  joined_at         timestamptz,
  left_at           timestamptz,
  cycles_completed  integer not null default 0,
  last_seen_at      timestamptz,
  note              text,                                 -- طلب الانضمام: المجال/القطاع/الدافع
  meta              jsonb not null default '{}'::jsonb
);
create unique index if not exists portal_council_members_uq on public.portal_council_members (council_id, lower(email)) where council_id is not null;
create index if not exists portal_council_members_email_idx on public.portal_council_members (lower(email));
create index if not exists portal_council_members_user_idx on public.portal_council_members (user_id);

-- 3) القضايا
create table if not exists public.portal_council_cases (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  council_id      uuid not null references public.portal_councils(id) on delete cascade,
  cycle_no        integer not null default 1,
  author_user_id  uuid,
  author_email    text not null,
  title_ar        text not null,
  body_ar         text not null,
  kind            text not null default 'text' check (kind in ('text','audio','video')),
  media_id        uuid,
  status          text not null default 'open' check (status in ('open','committed','returned','closed')),
  commitment_ar   text,
  committed_at    timestamptz,
  return_due_at   timestamptz,
  return_ar       text,
  return_outcome  text check (return_outcome in ('succeeded','struggled','reframed')),
  returned_at     timestamptz,
  closed_at       timestamptz,
  reminded_at     timestamptz,
  theme           text,                                   -- وسم موضوعي مجهول يختاره كاتب المجلس (لخريطة الحكمة والواجهة العامة)
  meta            jsonb not null default '{}'::jsonb
);
create index if not exists portal_council_cases_council_idx on public.portal_council_cases (council_id, status, created_at desc);
create index if not exists portal_council_cases_due_idx on public.portal_council_cases (status, return_due_at);

-- 4) المداولات
create table if not exists public.portal_council_posts (
  id          bigserial primary key,
  created_at  timestamptz not null default now(),
  case_id     uuid not null references public.portal_council_cases(id) on delete cascade,
  council_id  uuid not null references public.portal_councils(id) on delete cascade,
  user_id     uuid,
  email       text not null,
  kind        text not null check (kind in ('question','advice','evidence','return_note')),
  body_ar     text not null,
  media_id    uuid,
  meta        jsonb not null default '{}'::jsonb
);
create index if not exists portal_council_posts_case_idx on public.portal_council_posts (case_id, created_at);
create index if not exists portal_council_posts_user_idx on public.portal_council_posts (council_id, lower(email));

-- 5) شهادات الأقران
create table if not exists public.portal_council_attestations (
  id             bigserial primary key,
  created_at     timestamptz not null default now(),
  council_id     uuid not null references public.portal_councils(id) on delete cascade,
  case_id        uuid references public.portal_council_cases(id) on delete set null,
  cycle_no       integer not null default 1,
  from_user_id   uuid,
  from_email     text not null,
  to_user_id     uuid,
  to_email       text not null,
  skill_id       uuid not null,
  evidence_ar    text not null,
  status         text not null default 'pending' check (status in ('pending','approved','declined')),
  approver_role  text check (approver_role in ('org_admin','staff')),
  approved_by    uuid,
  decided_at     timestamptz,
  decision_note  text,
  event_id       bigint,
  reminded_at    timestamptz
);
create index if not exists portal_council_attestations_to_idx on public.portal_council_attestations (lower(to_email), status);
create index if not exists portal_council_attestations_status_idx on public.portal_council_attestations (status, created_at);

-- 6) كاتب المجلس
create table if not exists public.portal_council_scribe (
  id                 bigserial primary key,
  created_at         timestamptz not null default now(),
  case_id            uuid not null references public.portal_council_cases(id) on delete cascade,
  council_id         uuid not null references public.portal_councils(id) on delete cascade,
  phase              text not null check (phase in ('deliberation','commitment','return')),
  summary_ar         text not null default '',
  commitments        jsonb not null default '[]'::jsonb,
  pivotal_questions  jsonb not null default '[]'::jsonb,
  unsaid_ar          text,
  patterns           text[] not null default '{}',
  source             text not null default 'local',
  model              text
);
create index if not exists portal_council_scribe_case_idx on public.portal_council_scribe (case_id, phase);

-- 7) دوال RPC (service role فقط)
-- 7-أ) نبض المجلس: لكل قضية عدد الأسئلة/النصائح/الأدلة والمتداولين
create or replace function public.council_feed(p_council uuid)
returns jsonb language sql security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(c.id::text, jsonb_build_object(
    'posts', (select count(*) from public.portal_council_posts p where p.case_id = c.id),
    'questions', (select count(*) from public.portal_council_posts p where p.case_id = c.id and p.kind = 'question'),
    'advice', (select count(*) from public.portal_council_posts p where p.case_id = c.id and p.kind = 'advice'),
    'evidence', (select count(*) from public.portal_council_posts p where p.case_id = c.id and p.kind = 'evidence'),
    'voices', (select count(distinct lower(p.email)) from public.portal_council_posts p where p.case_id = c.id),
    'last_at', (select max(p.created_at) from public.portal_council_posts p where p.case_id = c.id)
  )), '{}'::jsonb)
  from public.portal_council_cases c where c.council_id = p_council;
$$;
revoke all on function public.council_feed(uuid) from public, anon, authenticated;

-- 7-ب) مرآة العضو في مجلس (دورة محددة أو كل الدورات حين p_cycle = null) — مقارنة بنفسه لا بالآخرين
create or replace function public.council_mirror(p_email text, p_council uuid, p_cycle integer)
returns jsonb language sql security definer set search_path = public as $$
  select jsonb_build_object(
    'questions', (select count(*) from public.portal_council_posts p join public.portal_council_cases c on c.id = p.case_id where p.council_id = p_council and lower(p.email) = lower(p_email) and p.kind = 'question' and (p_cycle is null or c.cycle_no = p_cycle)),
    'advice',    (select count(*) from public.portal_council_posts p join public.portal_council_cases c on c.id = p.case_id where p.council_id = p_council and lower(p.email) = lower(p_email) and p.kind = 'advice' and (p_cycle is null or c.cycle_no = p_cycle)),
    'evidence',  (select count(*) from public.portal_council_posts p join public.portal_council_cases c on c.id = p.case_id where p.council_id = p_council and lower(p.email) = lower(p_email) and p.kind = 'evidence' and (p_cycle is null or c.cycle_no = p_cycle)),
    'cases',     (select count(*) from public.portal_council_cases c where c.council_id = p_council and lower(c.author_email) = lower(p_email) and (p_cycle is null or c.cycle_no = p_cycle)),
    'commitments', (select count(*) from public.portal_council_cases c where c.council_id = p_council and lower(c.author_email) = lower(p_email) and c.committed_at is not null and (p_cycle is null or c.cycle_no = p_cycle)),
    'returns',   (select count(*) from public.portal_council_cases c where c.council_id = p_council and lower(c.author_email) = lower(p_email) and c.returned_at is not null and (p_cycle is null or c.cycle_no = p_cycle)),
    'returns_late', (select count(*) from public.portal_council_cases c where c.council_id = p_council and lower(c.author_email) = lower(p_email) and c.returned_at is not null and c.return_due_at is not null and c.returned_at > c.return_due_at and (p_cycle is null or c.cycle_no = p_cycle)),
    'given',     (select count(*) from public.portal_council_attestations a where a.council_id = p_council and lower(a.from_email) = lower(p_email) and (p_cycle is null or a.cycle_no = p_cycle)),
    'received',  (select count(*) from public.portal_council_attestations a where a.council_id = p_council and lower(a.to_email) = lower(p_email) and a.status = 'approved' and (p_cycle is null or a.cycle_no = p_cycle))
  );
$$;
revoke all on function public.council_mirror(text, uuid, integer) from public, anon, authenticated;

-- 7-ج) خريطة الحكمة: الأنماط المتكررة عبر المجالس — تُنشر فقط حين يقف خلفها ≥ p_k أشخاص و≥ 2 جهة
create or replace function public.council_wisdom(p_k integer default 5)
returns table (pattern text, cases bigint, persons bigint, orgs bigint, councils bigint)
language sql security definer set search_path = public as $$
  with x as (
    select unnest(s.patterns) as pattern, c.id as case_id, lower(c.author_email) as who, c.council_id,
           (select m.organization_id from public.portal_council_members m where m.council_id = c.council_id and lower(m.email) = lower(c.author_email) limit 1) as org
    from public.portal_council_scribe s join public.portal_council_cases c on c.id = s.case_id
  )
  select pattern, count(distinct case_id), count(distinct who), count(distinct org) filter (where org is not null), count(distinct council_id)
  from x group by pattern
  having count(distinct who) >= greatest(coalesce(p_k, 5), 1) and count(distinct org) filter (where org is not null) >= 2
  order by 2 desc, 1;
$$;
revoke all on function public.council_wisdom(integer) from public, anon, authenticated;

-- 8) الأمان: الجداول للخادم فقط (كل الوصول عبر واجهات أَثَر بصلاحية الخدمة)
alter table public.portal_councils enable row level security;
alter table public.portal_council_members enable row level security;
alter table public.portal_council_cases enable row level security;
alter table public.portal_council_posts enable row level security;
alter table public.portal_council_attestations enable row level security;
alter table public.portal_council_scribe enable row level security;

-- =====================================================================================
-- فحص تشخيصي (المتوقع: 6 صفوف كلها 0 — ثم صف سابع wisdom_rpc = 0 وصف ثامن feed_rpc = {})
select 'councils' as what, count(*)::text as value from public.portal_councils
union all select 'members', count(*)::text from public.portal_council_members
union all select 'cases', count(*)::text from public.portal_council_cases
union all select 'posts', count(*)::text from public.portal_council_posts
union all select 'attestations', count(*)::text from public.portal_council_attestations
union all select 'scribe', count(*)::text from public.portal_council_scribe
union all select 'wisdom_rpc', (select count(*) from public.council_wisdom(5))::text
union all select 'feed_rpc', public.council_feed('00000000-0000-4000-8000-000000000000'::uuid)::text;
