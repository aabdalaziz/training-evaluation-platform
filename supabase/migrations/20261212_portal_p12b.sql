-- © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
-- أَثَر — P12-ب: عقود الأثر (Outcome / Impact Contracts)
--  الجهة تدفع ثمن النتيجة لا المقعد: 60% عند التسليم · 25% عند أدلة الأثر المؤكَّدة (مهمات P12-أ) · 15% عند أثر 90 يومًا.
--  صفحة حية بالرمز للطرفين، والمبالغ المستحقة تُحتسب من بيانات الأثر الموجودة أصلًا — والإفراج عن كل دفعة قرار بشري موثَّق.
--  آمن لإعادة التشغيل.

-- 1) العقود
create table if not exists public.portal_impact_contracts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  created_by uuid null,
  organization_id uuid not null references public.portal_organizations(id) on delete cascade,
  program_id text null,
  title_ar text not null,
  contact_email text null,
  contact_name text null,
  cohort jsonb not null default '[]'::jsonb,                 -- [{email, full_name}] المنسوبون المشمولون بالعقد
  total_amount numeric(12,2) not null check (total_amount >= 0),
  currency text not null default 'SAR',
  split jsonb not null default '{"delivery":60,"evidence":25,"impact":15}'::jsonb,
  targets jsonb not null default '{"evidence_rate":60,"impact_days":90,"impact_rate":50}'::jsonb,
  status text not null default 'draft' check (status in ('draft','active','settled','cancelled')),
  token text not null unique,
  start_at date null,
  delivered_at timestamptz null,                             -- يُثبته الطاقم (قرار بشري) → يفتح نافذة أثر 90 يومًا
  flags jsonb not null default '{}'::jsonb,                  -- إشعارات أُرسلت (evidence_due_at, impact_due_at, impact_closing_at …)
  notes text null,
  updated_at timestamptz not null default now()
);
create index if not exists portal_impact_contracts_org_idx on public.portal_impact_contracts (organization_id, status);
create index if not exists portal_impact_contracts_program_idx on public.portal_impact_contracts (program_id);

-- 2) الدفعات المُفرَج عنها (كل دفعة قرار بشري مع لقطة من مؤشرات الأثر لحظة القرار)
create table if not exists public.portal_contract_releases (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.portal_impact_contracts(id) on delete cascade,
  milestone text not null check (milestone in ('delivery','evidence','impact')),
  pct numeric(5,2) not null,
  amount numeric(12,2) not null,
  memo_no text not null unique,
  released_at timestamptz not null default now(),
  released_by uuid null,
  released_by_name text null,
  note text null,
  snapshot jsonb not null default '{}'::jsonb,
  unique (contract_id, milestone)
);
create index if not exists portal_contract_releases_contract_idx on public.portal_contract_releases (contract_id);

-- 3) RLS: الطاقم يرى الكل؛ مدير الجهة المؤكَّد يرى عقود جهته. كل الكتابة والقراءة العامة بالرمز عبر مفتاح الخدمة من الـAPI فقط.
alter table public.portal_impact_contracts enable row level security;
alter table public.portal_contract_releases enable row level security;
drop policy if exists impact_contracts_read on public.portal_impact_contracts;
create policy impact_contracts_read on public.portal_impact_contracts for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and upper(p.role::text) in ('PLATFORM_ADMIN','SUPER_ADMIN','ADMIN','PROGRAM_MANAGER','QUALITY_ANALYST'))
         or exists (select 1 from public.portal_org_members m where m.organization_id = portal_impact_contracts.organization_id and m.role = 'org_admin' and m.status = 'confirmed'
                    and (m.user_id = auth.uid() or lower(m.email) = lower(coalesce(auth.jwt() ->> 'email', '')))));
drop policy if exists contract_releases_read on public.portal_contract_releases;
create policy contract_releases_read on public.portal_contract_releases for select to authenticated
  using (exists (select 1 from public.portal_impact_contracts c where c.id = portal_contract_releases.contract_id));

-- 4) تحقق — المتوقع: contracts table 1 · releases table 1 · policies 2
select 'contracts table' as t, count(*) as n from information_schema.tables where table_schema = 'public' and table_name = 'portal_impact_contracts'
union all select 'releases table', count(*) from information_schema.tables where table_schema = 'public' and table_name = 'portal_contract_releases'
union all select 'policies', count(*) from pg_policies where tablename in ('portal_impact_contracts', 'portal_contract_releases');
