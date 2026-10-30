-- © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved.
-- 942 — P30 «عهد الممارس وجهته» (السردي: «خطوة مني وخطوة من جهتي») — آمن لإعادة التشغيل
-- ما يضيفه هذا الملف:
--   1) portal_org_pair_pledges  جدول واحد: طلب (من المنسوب أو من الجهة) → اقتراح متقابل (الجهة تطلب خطوة شخصية · المنسوب يطلب خطوة تشهدها المنصة عن جهة تجاهه)
--      → توقيعان (المنسوب باسمه · مدير الجهة بصفته) → عهد نشط 365 يومًا → مراجعة مشتركة → تجديد أو طيّ
--      member_step = ما يؤدّيه المنسوب (اقترحته الجهة) · org_step = ما تؤدّيه الجهة له (اقترحه المنسوب)
--   2) portal_vc_issuances.kind يقبل 'org_pair_pledge' (وثيقة واحدة بحاملَين: شخص + جهة — ATH-PO-XXXX-XXXX)
--   3) RLS: يقرأ المنسوب صفّه، ويقرأ مدير الجهة المؤكَّد صفوف جهته؛ كل الكتابة عبر واجهات أَثَر بصلاحية الخدمة
--   الدربان لا يُخزَّنان: درب المنسوب من أحداثه (محرّك P27)، ودرب الجهة من أفعالها تجاهه (مقعد · اعتماد مستوى · اعتماد شهادة قرين · تأكيد مهامه في مهلتها).
-- =====================================================================================

create table if not exists public.portal_org_pair_pledges (
  id                 uuid primary key default gen_random_uuid(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  organization_id    uuid not null references public.portal_organizations(id) on delete cascade,
  org_name           text,
  status             text not null default 'invited' check (status in ('invited','proposing','active','review','renewed','closed','declined','expired','revoked')),
  invited_by         text not null default 'member' check (invited_by in ('member','org')),
  member_user_id     uuid,
  member_email       text not null,
  member_name        text,
  member_name_mode   text not null default 'first' check (member_name_mode in ('full','first','anon')),
  invite_why_ar      text not null default '',                 -- «لماذا الآن؟» (المنسوب) أو «لماذا أنت؟» (الجهة)
  member_step        jsonb,                                    -- {kind,title_ar,why_ar,target,proposed_by:'org',accepted_at,rework}
  org_step           jsonb,                                    -- {kind,title_ar,why_ar,target,proposed_by:'member',accepted_at,rework}
  invited_at         timestamptz not null default now(),
  accepted_at        timestamptz,
  member_signed_at   timestamptz,
  org_signed_at      timestamptz,
  org_signer_id      uuid,                                     -- مدير الجهة الذي وقّع بصفته (لا يظهر في الوثيقة)
  org_signer_email   text,
  signed_at          timestamptz,
  expires_at         timestamptz,
  review_at          timestamptz,
  member_review_ar   text,
  org_review_ar      text,
  member_reviewed_at timestamptz,
  org_reviewed_at    timestamptz,
  member_decision    text check (member_decision in ('renew','close')),
  org_decision       text check (org_decision in ('renew','close')),
  reviewed_at        timestamptz,
  code               text unique,                              -- ATH-PO-XXXX-XXXX
  vc_issuance_id     uuid,
  meta               jsonb not null default '{}'::jsonb
);
create index if not exists portal_org_pair_pledges_org_idx on public.portal_org_pair_pledges (organization_id, status, created_at desc);
create index if not exists portal_org_pair_pledges_member_idx on public.portal_org_pair_pledges (lower(member_email), created_at desc);
create index if not exists portal_org_pair_pledges_review_idx on public.portal_org_pair_pledges (status, review_at);

-- 2) نوع الوثيقة
alter table public.portal_vc_issuances drop constraint if exists portal_vc_issuances_kind_check;
alter table public.portal_vc_issuances add constraint portal_vc_issuances_kind_check check (kind in ('credential','snapshot','dataset','council_badge','org_charter','journey','org_journey','horizon','org_horizon','pair_pledge','org_pair_pledge'));

-- 3) الأمان — المنسوب يقرأ صفّه · مدير الجهة المؤكَّد يقرأ صفوف جهته
alter table public.portal_org_pair_pledges enable row level security;
drop policy if exists portal_org_pair_pledges_read on public.portal_org_pair_pledges;
create policy portal_org_pair_pledges_read on public.portal_org_pair_pledges for select to authenticated
  using (
    member_user_id = auth.uid() or lower(member_email) = lower(coalesce(auth.jwt()->>'email',''))
    or exists (select 1 from public.portal_org_members m where m.organization_id = portal_org_pair_pledges.organization_id and m.role = 'org_admin' and m.status = 'confirmed' and (m.user_id = auth.uid() or lower(m.email) = lower(coalesce(auth.jwt()->>'email',''))))
  );
revoke insert, update, delete on public.portal_org_pair_pledges from anon, authenticated;

-- =====================================================================================
-- فحص تشخيصي (المتوقع: tables = 1 · rls_on = 1 · policies = 1 · vc_kinds = 11)
select 'tables' as what, count(*)::text as value from information_schema.tables where table_schema = 'public' and table_name in ('portal_org_pair_pledges')
union all select 'rls_on', count(*)::text from pg_tables where schemaname = 'public' and tablename in ('portal_org_pair_pledges') and rowsecurity
union all select 'policies', count(*)::text from pg_policies where schemaname = 'public' and tablename in ('portal_org_pair_pledges')
union all select 'vc_kinds', (select count(*) from unnest(array['credential','snapshot','dataset','council_badge','org_charter','journey','org_journey','horizon','org_horizon','pair_pledge','org_pair_pledge']) k where pg_get_constraintdef((select oid from pg_constraint where conname = 'portal_vc_issuances_kind_check')) like '%' || k || '%')::text;
