-- © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
-- أَثَر P18 — مرصد القدرة البشرية («طقس القدرة»)
--  1) portal_observatory_snapshots — لقطة يومية محسوبة داخل السلسلة اليومية (لا أسماء، لا معرّفات؛ خلايا مكتومة إن قلّت عن 5 أشخاص/جهتين)
--  2) portal_observatory_issues    — «العدد الربعي»: مسودة في غرفة التحرير → معتمَد ومنشور وموقَّع (VC نوع DatasetStatement عبر مفتاح P17)
--  3) أعمدة اشتراك الجهة: observatory_public (الظهور بالاسم كـ«مساهم في المرصد») · observatory_watch («أبلغني حين يتغيّر طقس قطاعي»)
--  4) توسيع kind في portal_vc_issuances ليقبل 'dataset' (وثيقة العدد الموقَّعة تُتحقق من /verify/vc?code=ATH-OBS-2026-Q4)

create table if not exists public.portal_observatory_snapshots (
  id           uuid primary key default gen_random_uuid(),
  computed_at  timestamptz not null default now(),
  period_end   date not null default current_date,
  data         jsonb not null,
  stats        jsonb not null default '{}'::jsonb
);
create index if not exists portal_obs_snapshots_at_idx on public.portal_observatory_snapshots (computed_at desc);

create table if not exists public.portal_observatory_issues (
  id            uuid primary key default gen_random_uuid(),
  quarter       text not null unique,                       -- مثل 2026-Q4
  status        text not null default 'draft' check (status in ('draft','published')),
  editorial_ar  text not null default '',
  data          jsonb not null default '{}'::jsonb,         -- اللقطة المجمَّدة بعد الكتم
  suppressed    jsonb not null default '[]'::jsonb,         -- رموز قطاعات كُتمت يدويًا
  vc            jsonb,                                      -- الوثيقة الموقَّعة (إن وُجد المفتاح)
  vc_code       text,
  prev_issue_id uuid references public.portal_observatory_issues(id) on delete set null,
  published_at  timestamptz,
  published_by  uuid,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.portal_organizations add column if not exists observatory_public boolean not null default false;
alter table public.portal_organizations add column if not exists observatory_watch  boolean not null default false;

alter table public.portal_vc_issuances drop constraint if exists portal_vc_issuances_kind_check;
alter table public.portal_vc_issuances add  constraint portal_vc_issuances_kind_check check (kind in ('credential','snapshot','dataset'));

-- RLS: الطاقم يدير؛ القراءة العامة تمرّ عبر /api/observatory (مفتاح الخدمة) فقط — لا قراءة مباشرة لجداول المرصد
alter table public.portal_observatory_snapshots enable row level security;
alter table public.portal_observatory_issues    enable row level security;
drop policy if exists "p18 snapshots staff" on public.portal_observatory_snapshots;
create policy "p18 snapshots staff" on public.portal_observatory_snapshots for all to authenticated using (public.portal_is_staff()) with check (public.portal_is_staff());
drop policy if exists "p18 issues staff" on public.portal_observatory_issues;
create policy "p18 issues staff" on public.portal_observatory_issues for all to authenticated using (public.portal_is_staff()) with check (public.portal_is_staff());
drop policy if exists "p18 issues public read" on public.portal_observatory_issues;
create policy "p18 issues public read" on public.portal_observatory_issues for select to authenticated, anon using (status = 'published');

-- تشخيص: المتوقع بعد التشغيل الأول  snapshots | 0  ·  issues | 0  ·  orgs_watching | 0  ·  orgs_public | 0
select 'snapshots' as item, count(*) from public.portal_observatory_snapshots
union all select 'issues', count(*) from public.portal_observatory_issues
union all select 'orgs_watching', count(*) from public.portal_organizations where observatory_watch
union all select 'orgs_public', count(*) from public.portal_organizations where observatory_public;
