-- =====================================================================================
-- 821 — P24 «أثر الجهة» (Organization Impact): صدى الجهة · دفعة العودة · مقاعد الجهة · ميثاق الجهة
-- © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved.
-- آمن لإعادة التشغيل. يُنفَّذ قبل رفع ملفات الكود.
--   1) portal_org_charters        ميثاق الجهة: تعهّد سنوي (4 بنود) يوقّعه مدير الجهة → وثيقة Ed25519 (portal_vc_issuances.kind = 'org_charter') وشارة عامة
--   2) portal_org_seat_requests   مقاعد الجهة: طلب جماعي حول موضوع → منسوبون متقدمون لدى المُوفِّق (توأمة بين جهتين)
--   3) portal_contract_releases   يقبل الدفعة الرابعة 'return' («دفعة العودة» — العقود القائمة لا تتغير؛ split/targets jsonb كما هي)
--   4) portal_vc_issuances.kind   يقبل 'council_badge' (إصلاح: شهادة عضو مجلس P23 كانت ستُرفض بالقيد القديم) و'org_charter'
--   «صدى الجهة» لا يحتاج جدولًا ولا RPC: يُحسب لحظيًا من جداول المجالس بصلاحية الخدمة مع k ≥ 5.
-- =====================================================================================

-- 1) ميثاق الجهة
create table if not exists public.portal_org_charters (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  organization_id  uuid not null references public.portal_organizations(id) on delete cascade,
  version          text not null default '2026-10',
  clauses          jsonb not null default '[]'::jsonb,          -- [{id,title}] البنود التي أُقرّ بها وقت التوقيع
  signer_user_id   uuid,
  signer_email     text not null,
  signer_name      text,
  signer_title     text,                                          -- صفة الموقِّع (مثال: مدير التدريب)
  signed_at        timestamptz not null default now(),
  expires_at       timestamptz not null,                          -- سنوي
  status           text not null default 'active' check (status in ('active','revoked','expired')),
  revoked_at       timestamptz,
  revoked_by       uuid,
  vc_code          text,                                          -- ATH-OC-XXXX-XXXX (رمز الوثيقة الموقَّعة)
  vc_issuance_id   uuid,
  meta             jsonb not null default '{}'::jsonb
);
create index if not exists portal_org_charters_org_idx on public.portal_org_charters (organization_id, status, signed_at desc);
create index if not exists portal_org_charters_active_idx on public.portal_org_charters (status, expires_at);

-- 2) مقاعد الجهة
create table if not exists public.portal_org_seat_requests (
  id                  bigserial primary key,
  created_at          timestamptz not null default now(),
  organization_id     uuid not null references public.portal_organizations(id) on delete cascade,
  requested_by        uuid,
  requested_email     text not null,
  topic               text not null,
  domain              text,                                       -- رمز الموضوع من قائمة خريطة الحكمة (إن طابق)
  seats               integer not null default 0,
  people              jsonb,                                      -- [{email, full_name}] — تُجهَّل عند النسيان
  note                text,
  status              text not null default 'pending' check (status in ('pending','matched','closed')),
  matched_council_id  uuid references public.portal_councils(id) on delete set null,
  meta                jsonb not null default '{}'::jsonb
);
create index if not exists portal_org_seat_requests_org_idx on public.portal_org_seat_requests (organization_id, status, created_at desc);

-- 3) دفعة العودة: قيد الدفعات يقبل 'return'
alter table public.portal_contract_releases drop constraint if exists portal_contract_releases_milestone_check;
alter table public.portal_contract_releases add constraint portal_contract_releases_milestone_check check (milestone in ('delivery','evidence','impact','return'));
comment on column public.portal_impact_contracts.split is 'jsonb {delivery,evidence,impact,return?} — العقود الجديدة 55/20/15/10؛ غياب return = 0 (عقد ثلاثي قائم)';
comment on column public.portal_impact_contracts.targets is 'jsonb {evidence_rate,impact_days,impact_rate,return_rate?} — return_rate افتراضيًا 25';

-- 4) أنواع الوثائق الموقَّعة
alter table public.portal_vc_issuances drop constraint if exists portal_vc_issuances_kind_check;
alter table public.portal_vc_issuances add constraint portal_vc_issuances_kind_check check (kind in ('credential','snapshot','dataset','council_badge','org_charter'));

-- 5) الأمان: الجداول للخادم فقط (كل الوصول عبر واجهات أَثَر بصلاحية الخدمة)
alter table public.portal_org_charters enable row level security;
alter table public.portal_org_seat_requests enable row level security;

-- =====================================================================================
-- فحص تشخيصي (المتوقع: tables = 2 · rls_on = 2 · release_kinds = 4 · vc_kinds = 5)
select 'tables' as what, count(*)::text as value from information_schema.tables where table_schema = 'public' and table_name in ('portal_org_charters','portal_org_seat_requests')
union all select 'rls_on', count(*)::text from pg_tables where schemaname = 'public' and tablename in ('portal_org_charters','portal_org_seat_requests') and rowsecurity
union all select 'release_kinds', (select count(*) from unnest(array['delivery','evidence','impact','return']) k where pg_get_constraintdef((select oid from pg_constraint where conname = 'portal_contract_releases_milestone_check')) like '%' || k || '%')::text
union all select 'vc_kinds', (select count(*) from unnest(array['credential','snapshot','dataset','council_badge','org_charter']) k where pg_get_constraintdef((select oid from pg_constraint where conname = 'portal_vc_issuances_kind_check')) like '%' || k || '%')::text;
