-- © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
-- بوابة أَثَر — P15: منظومة التحسين المستمر القائمة على الأدلة («الحلقة المغلقة»)
-- آمن لإعادة التشغيل (idempotent) — لا يلمس أي جدول قائم
-- =====================================================================================
-- 1) اقتراحات الحلقة: ما تستخلصه الذاكرة وتعرضه على إنسان (برنامج من فجوة · مهمة تُغلق قناة · تركيز جلسة · خطوة للجهة)
-- =====================================================================================
create table if not exists public.portal_loop_suggestions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  kind text not null check (kind in ('program', 'mission', 'session_focus', 'org_step')),
  fingerprint text not null unique,            -- يمنع تكرار الاقتراح نفسه عبر الأيام
  title_ar text not null,
  why_ar text not null,                        -- البرهان بلغة بشرية
  evidence jsonb not null default '[]'::jsonb, -- سلسلة الأدلة [{label,value}]
  target jsonb not null default '{}'::jsonb,   -- ما يلزم للتنفيذ (sector/skill_id/program_id/template_id/emails/organization_id…)
  score numeric not null default 0,            -- أولوية (0–100)
  status text not null default 'draft' check (status in ('draft', 'accepted', 'dismissed', 'expired')),
  decided_by uuid null,
  decided_at timestamptz null,
  note text null,
  outcome jsonb null,                          -- ما نتج عن القبول (draft_id / missions created / …)
  expires_at timestamptz not null default (now() + interval '30 days')
);
create index if not exists portal_loop_suggestions_status_idx on public.portal_loop_suggestions (status, score desc);
create index if not exists portal_loop_suggestions_kind_idx on public.portal_loop_suggestions (kind, created_at desc);

-- =====================================================================================
-- 2) توقّع القدرة المؤسسية («طقس القدرة»): لكل جهة × مهارة — اتجاه 90 يومًا من ميل الأدلة
-- =====================================================================================
create table if not exists public.portal_capability_forecasts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  skill_id uuid not null,
  computed_at timestamptz not null default now(),
  horizon_days int not null default 90,
  trend text not null check (trend in ('rising', 'steady', 'fading', 'unknown')),
  slope numeric not null default 0,            -- فرق الوزن بين النافذتين (45 يومًا) مقسومًا على الوزن السابق
  recent_weight numeric not null default 0,
  prior_weight numeric not null default 0,
  evidence int not null default 0,
  people int not null default 0,
  steps jsonb not null default '[]'::jsonb,    -- «ثلاث خطوات تغيّر التوقع» [{title_ar,why_ar,kind}]
  unique (organization_id, skill_id)
);
create index if not exists portal_capability_forecasts_org_idx on public.portal_capability_forecasts (organization_id, trend);

-- =====================================================================================
-- 3) سجل قرارات الحلقة — تاريخ التعلّم المؤسسي («ما تعلّمته أَثَر هذا الشهر»)
-- =====================================================================================
create table if not exists public.portal_loop_decisions (
  id bigserial primary key,
  at timestamptz not null default now(),
  suggestion_id uuid null,
  kind text not null,
  action text not null check (action in ('proposed', 'accepted', 'dismissed', 'expired', 'outcome')),
  by_user uuid null,
  meta jsonb not null default '{}'::jsonb
);
create index if not exists portal_loop_decisions_at_idx on public.portal_loop_decisions (at desc);

-- =====================================================================================
-- RLS: الطاقم يقرأ ويقرر؛ مدير الجهة يقرأ توقّعات جهته فقط؛ الكتابة بمفتاح الخدمة
-- =====================================================================================
alter table public.portal_loop_suggestions enable row level security;
alter table public.portal_capability_forecasts enable row level security;
alter table public.portal_loop_decisions enable row level security;

drop policy if exists loop_suggestions_staff_read on public.portal_loop_suggestions;
create policy loop_suggestions_staff_read on public.portal_loop_suggestions for select to authenticated using (public.portal_is_staff());
drop policy if exists loop_decisions_staff_read on public.portal_loop_decisions;
create policy loop_decisions_staff_read on public.portal_loop_decisions for select to authenticated using (public.portal_is_staff());
drop policy if exists capability_forecasts_read on public.portal_capability_forecasts;
create policy capability_forecasts_read on public.portal_capability_forecasts for select to authenticated
  using (public.portal_is_staff() or exists (select 1 from public.portal_org_members m where m.organization_id = portal_capability_forecasts.organization_id and m.user_id = auth.uid() and m.status = 'confirmed'));

-- =====================================================================================
-- فحص تشخيصي — المتوقع: suggestions=0 · forecasts=0 · decisions=0
-- =====================================================================================
select
  (select count(*) from public.portal_loop_suggestions) as suggestions,
  (select count(*) from public.portal_capability_forecasts) as forecasts,
  (select count(*) from public.portal_loop_decisions) as decisions;
