-- © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved.
-- 920 — P29 «العهد المتقابل» (السردي: «عهدان متقابلان — خطوة لك وخطوة لي») — آمن لإعادة التشغيل
-- ما يضيفه هذا الملف:
--   1) portal_pair_pledges   جدول واحد: الدعوة (من دائرتي: مجلس مشترك أو جهة واحدة) → الاقتراح المتبادل (كلٌّ يقترح خطوة لصاحبه) → توقيعان → عهد نشط 365 يومًا → مراجعة مشتركة
--      الطرف (a) الداعي · الطرف (b) المدعوّ · a_step = الخطوة التي يؤدّيها (a) واقترحها (b) · b_step = الخطوة التي يؤدّيها (b) واقترحها (a)
--   2) portal_vc_issuances.kind يقبل 'pair_pledge' (وثيقة واحدة بحاملَين ATH-MP-XXXX-XXXX)
--   3) RLS: يقرأ الطرفان فقط؛ كل الكتابة عبر واجهات أَثَر بصلاحية الخدمة
--   الدرب المزدوج («أين نحن من عهدنا») لا يُخزَّن: يُشتق لحظيًا من أحداث كل طرف بعد التوقيع (محرّك P27 نفسه).
-- =====================================================================================

create table if not exists public.portal_pair_pledges (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  status           text not null default 'invited' check (status in ('invited','proposing','active','review','renewed','closed','declined','expired','revoked')),
  circle_kind      text not null check (circle_kind in ('council','org')),
  circle_id        uuid not null,
  circle_title     text,
  a_user_id        uuid not null,
  a_email          text not null,
  a_name           text,
  a_name_mode      text not null default 'first' check (a_name_mode in ('full','first','anon')),
  b_user_id        uuid,
  b_email          text not null,
  b_name           text,
  b_name_mode      text not null default 'first' check (b_name_mode in ('full','first','anon')),
  invite_why_ar    text not null default '',                  -- «لماذا أنت؟» بكلمات الداعي
  a_step           jsonb,                                     -- {kind,title_ar,why_ar,target,proposed_by:'b',accepted_at,rework:0}
  b_step           jsonb,
  invited_at       timestamptz not null default now(),
  accepted_at      timestamptz,
  a_signed_at      timestamptz,
  b_signed_at      timestamptz,
  signed_at        timestamptz,                               -- حين يوقّع الطرفان
  expires_at       timestamptz,
  review_at        timestamptz,                               -- اليوم 365
  a_review_ar      text,
  b_review_ar      text,
  a_reviewed_at    timestamptz,
  b_reviewed_at    timestamptz,
  a_decision       text check (a_decision in ('renew','close')),
  b_decision       text check (b_decision in ('renew','close')),
  reviewed_at      timestamptz,
  code             text unique,                               -- ATH-MP-XXXX-XXXX
  vc_issuance_id   uuid,
  meta             jsonb not null default '{}'::jsonb
);
create index if not exists portal_pair_pledges_a_idx on public.portal_pair_pledges (a_user_id, created_at desc);
create index if not exists portal_pair_pledges_b_idx on public.portal_pair_pledges (lower(b_email), created_at desc);
create index if not exists portal_pair_pledges_status_idx on public.portal_pair_pledges (status, review_at);

-- 2) نوع الوثيقة
alter table public.portal_vc_issuances drop constraint if exists portal_vc_issuances_kind_check;
alter table public.portal_vc_issuances add constraint portal_vc_issuances_kind_check check (kind in ('credential','snapshot','dataset','council_badge','org_charter','journey','org_journey','horizon','org_horizon','pair_pledge'));

-- 3) الأمان — يقرأ الطرفان فقط
alter table public.portal_pair_pledges enable row level security;
drop policy if exists portal_pair_pledges_party_read on public.portal_pair_pledges;
create policy portal_pair_pledges_party_read on public.portal_pair_pledges for select to authenticated
  using (a_user_id = auth.uid() or b_user_id = auth.uid() or lower(a_email) = lower(coalesce(auth.jwt()->>'email','')) or lower(b_email) = lower(coalesce(auth.jwt()->>'email','')));
revoke insert, update, delete on public.portal_pair_pledges from anon, authenticated;

-- =====================================================================================
-- فحص تشخيصي (المتوقع: tables = 1 · rls_on = 1 · policies = 1 · vc_kinds = 10)
select 'tables' as what, count(*)::text as value from information_schema.tables where table_schema = 'public' and table_name in ('portal_pair_pledges')
union all select 'rls_on', count(*)::text from pg_tables where schemaname = 'public' and tablename in ('portal_pair_pledges') and rowsecurity
union all select 'policies', count(*)::text from pg_policies where schemaname = 'public' and tablename in ('portal_pair_pledges')
union all select 'vc_kinds', (select count(*) from unnest(array['credential','snapshot','dataset','council_badge','org_charter','journey','org_journey','horizon','org_horizon','pair_pledge']) k where pg_get_constraintdef((select oid from pg_constraint where conname = 'portal_vc_issuances_kind_check')) like '%' || k || '%')::text;
