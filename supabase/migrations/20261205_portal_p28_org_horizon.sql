-- © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved.
-- 900 — P28 «أفق الجهة» (السردي: «عشر سنوات وخطوة») — آمن لإعادة التشغيل
-- ما يضيفه هذا الملف:
--   1) portal_org_horizons          أفق الجهة: «نحن في 2036» بصوت الجهة (يكتبه مدير الجهة؛ مسودة محلية/ذكاء اصطناعي يعتمدها هو) · الحالة · موعد المراجعة · «ما تغيّر فينا»
--   2) portal_org_horizon_pledges   عهد الجهة: الخطوة الواحدة المختارة لسنة (مجلس · 5 مهمات · 5 يواجهون المواقف · 5 مستويات · 5 شهادات أقران · كتاب السنة) · ATH-OH · وثيقة موقَّعة
--   3) portal_vc_issuances.kind  يقبل 'org_horizon'
--   4) RLS: قراءة مديري الجهة المؤكَّدين فقط؛ كل الكتابة عبر واجهات أَثَر بصلاحية الخدمة
--   درب الجهة («أين نحن من خطوتنا») لا يُخزَّن: يُشتق لحظيًا من أحداث المنسوبين المؤكَّدين بعد تاريخ التوقيع — أعداد أشخاص متمايزين، لا أسماء.
-- =====================================================================================

-- 1) أفق الجهة
create table if not exists public.portal_org_horizons (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  organization_id  uuid not null references public.portal_organizations(id) on delete cascade,
  org_name         text not null default '',
  written_by       uuid,                                    -- مدير الجهة الذي كتب (بصفته)
  written_email    text,
  year_target      integer not null default 2036,
  scenario_ar      text not null default '',
  scenario_source  text not null default 'own' check (scenario_source in ('own','local','ai')),
  status           text not null default 'draft' check (status in ('draft','active','review','renewed','archived')),
  activated_at     timestamptz,
  review_at        timestamptz,                             -- اليوم 365 بعد توقيع العهد
  reviewed_at      timestamptz,
  review_note_ar   text,                                    -- «ما تغيّر فينا» يوم المراجعة
  decision         text check (decision in ('renew','archive')),
  options          jsonb not null default '[]'::jsonb,      -- الخطوات الثلاث المقترحة (تُوقَّع واحدة)
  meta             jsonb not null default '{}'::jsonb
);
create index if not exists portal_org_horizons_org_idx on public.portal_org_horizons (organization_id, created_at desc);
create index if not exists portal_org_horizons_review_idx on public.portal_org_horizons (review_at) where status in ('active','review');

-- 2) عهد الجهة
create table if not exists public.portal_org_horizon_pledges (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  horizon_id       uuid not null references public.portal_org_horizons(id) on delete cascade,
  organization_id  uuid not null,
  org_name         text not null default '',
  kind             text not null check (kind in ('council','missions','daily','levels','attestations','yearbook')),
  title_ar         text not null,
  target           jsonb not null default '{}'::jsonb,      -- مثل {"people":5} أو {"members":2,"returns":1} أو {"chapters":3}
  code             text unique,                             -- ATH-OH-XXXX-XXXX
  signed_by        uuid,
  signed_email     text,
  signed_at        timestamptz,
  expires_at       timestamptz,
  revoked_at       timestamptz,
  status           text not null default 'active' check (status in ('active','revoked','reviewed','expired')),
  vc_issuance_id   uuid,
  meta             jsonb not null default '{}'::jsonb
);
create index if not exists portal_org_horizon_pledges_org_idx on public.portal_org_horizon_pledges (organization_id, created_at desc);
create index if not exists portal_org_horizon_pledges_horizon_idx on public.portal_org_horizon_pledges (horizon_id);

-- 3) نوع الوثيقة
alter table public.portal_vc_issuances drop constraint if exists portal_vc_issuances_kind_check;
alter table public.portal_vc_issuances add constraint portal_vc_issuances_kind_check check (kind in ('credential','snapshot','dataset','council_badge','org_charter','journey','org_journey','horizon','org_horizon'));

-- 4) الأمان — قراءة مديري الجهة المؤكَّدين فقط
alter table public.portal_org_horizons enable row level security;
alter table public.portal_org_horizon_pledges enable row level security;
drop policy if exists portal_org_horizons_admin_read on public.portal_org_horizons;
create policy portal_org_horizons_admin_read on public.portal_org_horizons for select to authenticated
  using (exists (select 1 from public.portal_org_members m where m.organization_id = portal_org_horizons.organization_id and m.user_id = auth.uid() and m.role = 'org_admin' and m.status = 'confirmed'));
drop policy if exists portal_org_horizon_pledges_admin_read on public.portal_org_horizon_pledges;
create policy portal_org_horizon_pledges_admin_read on public.portal_org_horizon_pledges for select to authenticated
  using (exists (select 1 from public.portal_org_members m where m.organization_id = portal_org_horizon_pledges.organization_id and m.user_id = auth.uid() and m.role = 'org_admin' and m.status = 'confirmed'));
revoke insert, update, delete on public.portal_org_horizons, public.portal_org_horizon_pledges from anon, authenticated;

-- =====================================================================================
-- فحص تشخيصي (المتوقع: tables = 2 · rls_on = 2 · policies = 2 · vc_kinds = 9)
select 'tables' as what, count(*)::text as value from information_schema.tables where table_schema = 'public' and table_name in ('portal_org_horizons','portal_org_horizon_pledges')
union all select 'rls_on', count(*)::text from pg_tables where schemaname = 'public' and tablename in ('portal_org_horizons','portal_org_horizon_pledges') and rowsecurity
union all select 'policies', count(*)::text from pg_policies where schemaname = 'public' and tablename in ('portal_org_horizons','portal_org_horizon_pledges')
union all select 'vc_kinds', (select count(*) from unnest(array['credential','snapshot','dataset','council_badge','org_charter','journey','org_journey','horizon','org_horizon']) k where pg_get_constraintdef((select oid from pg_constraint where conname = 'portal_vc_issuances_kind_check')) like '%' || k || '%')::text;
