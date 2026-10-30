-- © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved.
-- 880 — P27 «أفق الممارس» (السردي: «رسالتي من 2036») — آمن لإعادة التشغيل
-- ما يضيفه هذا الملف:
--   1) portal_horizons          الأفق: «أنا في 2036» بصوت صاحبه (مسودة محلية/ذكاء اصطناعي يعتمدها هو) · حالة الحلقة (draft → active → review → renewed|archived)
--   2) portal_horizon_pledges   عهد الأفق: الخطوة الواحدة المختارة لسنة (مجلس · مهمة · 20 موقفًا · مستوى · شهادة قرين) → وثيقة Ed25519 ATH-HZ-XXXX-XXXX · 365 يومًا · تُسحب بنقرة
--   3) portal_vc_issuances.kind  يقبل 'horizon'
--   4) RLS: قراءة المالك فقط؛ كل الكتابة عبر واجهات أَثَر بصلاحية الخدمة
--   الدرب («أين أنا من عهدي») لا يُخزَّن: يُشتق لحظيًا من الأحداث (المجالس · المهام · كل يوم مهارة · المستويات · الشهادات).
-- =====================================================================================

-- 1) الأفق
create table if not exists public.portal_horizons (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  user_id          uuid not null,
  email            text not null,
  full_name        text,
  year_target      integer not null default 2036,
  scenario_ar      text not null default '',
  scenario_source  text not null default 'own' check (scenario_source in ('own','local','ai')),
  status           text not null default 'draft' check (status in ('draft','active','review','renewed','archived')),
  activated_at     timestamptz,
  review_at        timestamptz,                             -- اليوم 365 بعد توقيع العهد
  reviewed_at      timestamptz,
  review_note_ar   text,                                    -- «ما تغيّر» بكلمات صاحبه يوم المراجعة
  decision         text check (decision in ('renew','archive')),
  options          jsonb not null default '[]'::jsonb,      -- الخيارات الثلاثة المقترحة (لا تُوقَّع إلا واحدة)
  meta             jsonb not null default '{}'::jsonb
);
create index if not exists portal_horizons_user_idx on public.portal_horizons (user_id, created_at desc);
create index if not exists portal_horizons_review_idx on public.portal_horizons (review_at) where status in ('active','review');

-- 2) عهد الأفق
create table if not exists public.portal_horizon_pledges (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  horizon_id       uuid not null references public.portal_horizons(id) on delete cascade,
  user_id          uuid not null,
  email            text not null,
  kind             text not null check (kind in ('council','mission','daily','level','credential')),
  title_ar         text not null,
  target           jsonb not null default '{}'::jsonb,      -- مثل {"days":20} أو {"skill_id":"…","to":4}
  code             text unique,                             -- ATH-HZ-XXXX-XXXX
  signed_at        timestamptz,
  expires_at       timestamptz,
  revoked_at       timestamptz,
  status           text not null default 'active' check (status in ('active','revoked','reviewed','expired')),
  vc_issuance_id   uuid,
  meta             jsonb not null default '{}'::jsonb
);
create index if not exists portal_horizon_pledges_user_idx on public.portal_horizon_pledges (user_id, created_at desc);
create index if not exists portal_horizon_pledges_horizon_idx on public.portal_horizon_pledges (horizon_id);

-- 3) نوع الوثيقة
alter table public.portal_vc_issuances drop constraint if exists portal_vc_issuances_kind_check;
alter table public.portal_vc_issuances add constraint portal_vc_issuances_kind_check check (kind in ('credential','snapshot','dataset','council_badge','org_charter','journey','org_journey','horizon'));

-- 4) الأمان — قراءة المالك فقط
alter table public.portal_horizons enable row level security;
alter table public.portal_horizon_pledges enable row level security;
drop policy if exists portal_horizons_own_read on public.portal_horizons;
create policy portal_horizons_own_read on public.portal_horizons for select to authenticated using (user_id = auth.uid());
drop policy if exists portal_horizon_pledges_own_read on public.portal_horizon_pledges;
create policy portal_horizon_pledges_own_read on public.portal_horizon_pledges for select to authenticated using (user_id = auth.uid());
revoke insert, update, delete on public.portal_horizons, public.portal_horizon_pledges from anon, authenticated;

-- =====================================================================================
-- فحص تشخيصي (المتوقع: tables = 2 · rls_on = 2 · policies = 2 · vc_kinds = 8)
select 'tables' as what, count(*)::text as value from information_schema.tables where table_schema = 'public' and table_name in ('portal_horizons','portal_horizon_pledges')
union all select 'rls_on', count(*)::text from pg_tables where schemaname = 'public' and tablename in ('portal_horizons','portal_horizon_pledges') and rowsecurity
union all select 'policies', count(*)::text from pg_policies where schemaname = 'public' and tablename in ('portal_horizons','portal_horizon_pledges')
union all select 'vc_kinds', (select count(*) from unnest(array['credential','snapshot','dataset','council_badge','org_charter','journey','org_journey','horizon']) k where pg_get_constraintdef((select oid from pg_constraint where conname = 'portal_vc_issuances_kind_check')) like '%' || k || '%')::text;
