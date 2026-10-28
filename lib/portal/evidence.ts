-- © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
-- بوابة أَثَر — P14: قاعدة الأدلة المؤسسية («الذاكرة الحية») + أَثَر للوكلاء (الوكلاء المفوَّضون)
-- آمن لإعادة التشغيل (idempotent) — لا يلمس أي جدول قائم
-- =====================================================================================
-- 1) قاعدة الأدلة المؤسسية: رسم بياني (عقد + روابط) يُبنى ليليًا من الجداول الموجودة
--    العقد: مهارة · برنامج · جلسة · محاكٍ · قالب مهمة · قناة تعلّم · قطاع · جهة · مدرب · عقد أثر
--    الروابط: raised (رفع مهارة) · delivered (قدّم) · invested (استثمرت) · needs (يحتاج) · targets (يستهدف)
-- =====================================================================================
create table if not exists public.portal_graph_nodes (
  id text primary key,                        -- kind:ref  مثل skill:<uuid> · program:<id> · channel:mission
  kind text not null,
  label_ar text not null default '',
  label_en text null,
  ref_id text null,
  weight numeric not null default 0,          -- مجموع أوزان الأدلة المرتبطة
  people integer not null default 0,          -- عدد الأشخاص (مجهّل · للعرض العام ≥ 5 فقط)
  meta jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create index if not exists portal_graph_nodes_kind_idx on public.portal_graph_nodes (kind, weight desc);

create table if not exists public.portal_graph_edges (
  id bigserial primary key,
  src text not null,
  dst text not null,
  rel text not null,
  weight numeric not null default 0,
  evidence integer not null default 0,        -- عدد الأدلة خلف الرابط
  people integer not null default 0,
  period_from date null,
  period_to date null,
  meta jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (src, dst, rel)
);
create index if not exists portal_graph_edges_src_idx on public.portal_graph_edges (src, weight desc);
create index if not exists portal_graph_edges_dst_idx on public.portal_graph_edges (dst, weight desc);

-- درس الأسبوع: ما تعلّمته المؤسسة — مسودة آلية، يعتمدها إنسان قبل الظهور
create table if not exists public.portal_graph_lessons (
  id uuid primary key default gen_random_uuid(),
  week date not null,
  title_ar text not null,
  body_ar text not null,
  evidence jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft','approved','rejected')),
  source text not null default 'local',
  created_at timestamptz not null default now(),
  decided_by uuid null references auth.users(id) on delete set null,
  decided_at timestamptz null,
  unique (week, title_ar)
);

-- سجل «اسأل الذاكرة»: السؤال، القالب الذي أُجيب به، والإجابة (لموجز الأدلة وللتعلّم من الأسئلة)
create table if not exists public.portal_evidence_queries (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid null references auth.users(id) on delete set null,
  email text null,
  question text not null,
  template text null,
  params jsonb not null default '{}'::jsonb,
  answer jsonb null,
  source text not null default 'local',
  ok boolean not null default true
);
create index if not exists portal_evidence_queries_at_idx on public.portal_evidence_queries (created_at desc);

-- =====================================================================================
-- 2) أَثَر للوكلاء: مفاتيح مفوَّضة للجهات · طلبات تنتظر اعتمادًا بشريًا · سجل كامل
-- =====================================================================================
create table if not exists public.portal_agent_keys (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  organization_id uuid null references public.portal_organizations(id) on delete set null,
  name text not null,
  prefix text not null,                        -- أول 12 حرفًا للعرض (atk_xxxxxxxx)
  key_hash text not null unique,               -- SHA-256 للمفتاح — المفتاح نفسه لا يُخزَّن
  scopes text[] not null default array['discover','fit','verify','report']::text[],
  daily_limit integer not null default 200,
  expires_at timestamptz null,
  revoked_at timestamptz null,
  last_used_at timestamptz null,
  uses integer not null default 0,
  note text null
);
create index if not exists portal_agent_keys_org_idx on public.portal_agent_keys (organization_id, created_at desc);

create table if not exists public.portal_agent_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  key_id uuid null references public.portal_agent_keys(id) on delete set null,
  organization_id uuid null references public.portal_organizations(id) on delete set null,
  kind text not null check (kind in ('quote','reserve','dialogue','report')),
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','approved','rejected','answered')),
  response jsonb null,
  decided_by uuid null references auth.users(id) on delete set null,
  decided_at timestamptz null,
  note text null
);
create index if not exists portal_agent_requests_status_idx on public.portal_agent_requests (status, created_at desc);

create table if not exists public.portal_agent_log (
  id bigserial primary key,
  at timestamptz not null default now(),
  key_id uuid null references public.portal_agent_keys(id) on delete set null,
  tool text not null,
  ok boolean not null default true,
  ms integer not null default 0,
  meta jsonb not null default '{}'::jsonb
);
create index if not exists portal_agent_log_at_idx on public.portal_agent_log (at desc);
create index if not exists portal_agent_log_key_idx on public.portal_agent_log (key_id, at desc);

-- =====================================================================================
-- 3) الأمان: الطاقم يقرأ؛ الكتابة عبر الخادم (service role) فقط
-- =====================================================================================
alter table public.portal_graph_nodes enable row level security;
alter table public.portal_graph_edges enable row level security;
alter table public.portal_graph_lessons enable row level security;
alter table public.portal_evidence_queries enable row level security;
alter table public.portal_agent_keys enable row level security;
alter table public.portal_agent_requests enable row level security;
alter table public.portal_agent_log enable row level security;

drop policy if exists graph_nodes_staff_read on public.portal_graph_nodes;
create policy graph_nodes_staff_read on public.portal_graph_nodes for select to authenticated using (public.portal_is_staff());
drop policy if exists graph_edges_staff_read on public.portal_graph_edges;
create policy graph_edges_staff_read on public.portal_graph_edges for select to authenticated using (public.portal_is_staff());
drop policy if exists graph_lessons_read on public.portal_graph_lessons;
create policy graph_lessons_read on public.portal_graph_lessons for select to authenticated using (status = 'approved' or public.portal_is_staff());
drop policy if exists evidence_queries_staff_read on public.portal_evidence_queries;
create policy evidence_queries_staff_read on public.portal_evidence_queries for select to authenticated using (public.portal_is_staff());
drop policy if exists agent_keys_staff_read on public.portal_agent_keys;
create policy agent_keys_staff_read on public.portal_agent_keys for select to authenticated using (public.portal_is_staff());
drop policy if exists agent_requests_staff_read on public.portal_agent_requests;
create policy agent_requests_staff_read on public.portal_agent_requests for select to authenticated using (public.portal_is_staff());
drop policy if exists agent_log_staff_read on public.portal_agent_log;
create policy agent_log_staff_read on public.portal_agent_log for select to authenticated using (public.portal_is_staff());

-- =====================================================================================
-- فحص تشخيصي — المتوقع: nodes=0 · edges=0 · lessons=0 · queries=0 · keys=0 · requests=0 · agent_log=0
-- =====================================================================================
select
  (select count(*) from public.portal_graph_nodes) as nodes,
  (select count(*) from public.portal_graph_edges) as edges,
  (select count(*) from public.portal_graph_lessons) as lessons,
  (select count(*) from public.portal_evidence_queries) as queries,
  (select count(*) from public.portal_agent_keys) as keys,
  (select count(*) from public.portal_agent_requests) as requests,
  (select count(*) from public.portal_agent_log) as agent_log;
