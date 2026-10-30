-- © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved.
-- 861 — P26 «رحلة الجهة» (الرحلة الجماعية · «كتاب السنة») — آمن لإعادة التشغيل
-- ما يضيفه هذا الملف:
--   1) portal_org_journey_notes    «ما تغيّر فينا»: تعليق مدير الجهة بصيغة الجمع (نص أو صوت) على كل فصل جماعي
--   2) portal_org_journey_shares   «كتاب السنة»: كشف انتقائي لفصول الجهة → وثيقة Ed25519 (ATH-OY-XXXX-XXXX) برابط عام /org-journey/<code> صالح 12 شهرًا · يُلغى بنقرة
--   3) portal_org_time_capsules    «رسالة الجهة إلى نفسها بعد سنة»: تُختم اليوم وتُسلَّم بعد 365 يومًا لمديري الجهة الحاليين مع «أين كنا» و«أين صرنا»
--   4) portal_vc_issuances.kind     يقبل 'org_journey'
--   5) RLS: القراءة لمديري الجهة المؤكَّدين (portal_org_members.role = org_admin · status = confirmed)؛ كل الكتابة عبر واجهات أَثَر بصلاحية الخدمة
--   الفصول الجماعية نفسها لا تُخزَّن: تُشتق لحظيًا من أحداث المنسوبين ولا يظهر فصل من أقل من 5 أشخاص.
-- =====================================================================================

-- 1) تعليقات الجهة على فصولها
create table if not exists public.portal_org_journey_notes (
  id               bigserial primary key,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  organization_id  uuid not null,
  chapter_key      text not null,                           -- مثل 2026-Q3:return · first:charter
  body_ar          text not null default '',
  media_id         uuid,
  kind             text not null default 'text' check (kind in ('text','audio','video')),
  author_user_id   uuid,
  author_email     text,
  meta             jsonb not null default '{}'::jsonb,
  unique (organization_id, chapter_key)
);
create index if not exists portal_org_journey_notes_org_idx on public.portal_org_journey_notes (organization_id, updated_at desc);

-- 2) كتب السنة
create table if not exists public.portal_org_journey_shares (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  organization_id  uuid not null,
  org_name         text not null,
  code             text not null unique,                    -- ATH-OY-XXXX-XXXX
  year_label       text not null,                           -- مثل «2026»
  chapter_keys     text[] not null default '{}',
  chapters         jsonb not null default '[]'::jsonb,      -- لقطة مجمَّدة (عنوان · حقبة · عدد · ما حدث · تعليق الجهة)
  intro_ar         text,
  status           text not null default 'active' check (status in ('active','revoked','expired')),
  expires_at       timestamptz not null,
  revoked_at       timestamptz,
  views            integer not null default 0,
  vc_issuance_id   uuid,
  published_by     uuid,
  published_email  text,
  show_in_councils boolean not null default true,
  meta             jsonb not null default '{}'::jsonb
);
create index if not exists portal_org_journey_shares_org_idx on public.portal_org_journey_shares (organization_id, created_at desc);
create index if not exists portal_org_journey_shares_pub_idx on public.portal_org_journey_shares (status, show_in_councils, created_at desc);

-- 3) رسالة الجهة إلى نفسها
create table if not exists public.portal_org_time_capsules (
  id               bigserial primary key,
  created_at       timestamptz not null default now(),
  organization_id  uuid not null,
  org_name         text not null,
  body_ar          text not null default '',
  media_id         uuid,
  kind             text not null default 'text' check (kind in ('text','audio','video')),
  written_by       uuid,
  written_email    text,
  deliver_at       timestamptz not null,
  delivered_at     timestamptz,
  status           text not null default 'sealed' check (status in ('sealed','delivered','cancelled')),
  snapshot_then    jsonb not null default '{}'::jsonb,
  snapshot_now     jsonb,
  delivered_to     text[] not null default '{}',            -- بُرُد مديري الجهة الذين استلموها يوم الوصول
  meta             jsonb not null default '{}'::jsonb
);
create index if not exists portal_org_time_capsules_due_idx on public.portal_org_time_capsules (deliver_at) where status = 'sealed';
create index if not exists portal_org_time_capsules_org_idx on public.portal_org_time_capsules (organization_id, created_at desc);

-- 4) نوع الوثيقة
alter table public.portal_vc_issuances drop constraint if exists portal_vc_issuances_kind_check;
alter table public.portal_vc_issuances add constraint portal_vc_issuances_kind_check check (kind in ('credential','snapshot','dataset','council_badge','org_charter','journey','org_journey'));

-- 5) الأمان — قراءة مدير الجهة المؤكَّد فقط
alter table public.portal_org_journey_notes enable row level security;
alter table public.portal_org_journey_shares enable row level security;
alter table public.portal_org_time_capsules enable row level security;
drop policy if exists portal_org_journey_notes_admin_read on public.portal_org_journey_notes;
create policy portal_org_journey_notes_admin_read on public.portal_org_journey_notes for select to authenticated
  using (exists (select 1 from public.portal_org_members m where m.organization_id = portal_org_journey_notes.organization_id and m.user_id = auth.uid() and m.role = 'org_admin' and m.status = 'confirmed'));
drop policy if exists portal_org_journey_shares_admin_read on public.portal_org_journey_shares;
create policy portal_org_journey_shares_admin_read on public.portal_org_journey_shares for select to authenticated
  using (exists (select 1 from public.portal_org_members m where m.organization_id = portal_org_journey_shares.organization_id and m.user_id = auth.uid() and m.role = 'org_admin' and m.status = 'confirmed'));
drop policy if exists portal_org_time_capsules_admin_read on public.portal_org_time_capsules;
create policy portal_org_time_capsules_admin_read on public.portal_org_time_capsules for select to authenticated
  using (exists (select 1 from public.portal_org_members m where m.organization_id = portal_org_time_capsules.organization_id and m.user_id = auth.uid() and m.role = 'org_admin' and m.status = 'confirmed'));
revoke insert, update, delete on public.portal_org_journey_notes, public.portal_org_journey_shares, public.portal_org_time_capsules from anon, authenticated;

-- =====================================================================================
-- فحص تشخيصي (المتوقع: tables = 3 · rls_on = 3 · policies = 3 · vc_kinds = 7)
select 'tables' as what, count(*)::text as value from information_schema.tables where table_schema = 'public' and table_name in ('portal_org_journey_notes','portal_org_journey_shares','portal_org_time_capsules')
union all select 'rls_on', count(*)::text from pg_tables where schemaname = 'public' and tablename in ('portal_org_journey_notes','portal_org_journey_shares','portal_org_time_capsules') and rowsecurity
union all select 'policies', count(*)::text from pg_policies where schemaname = 'public' and tablename in ('portal_org_journey_notes','portal_org_journey_shares','portal_org_time_capsules')
union all select 'vc_kinds', (select count(*) from unnest(array['credential','snapshot','dataset','council_badge','org_charter','journey','org_journey']) k where pg_get_constraintdef((select oid from pg_constraint where conname = 'portal_vc_issuances_kind_check')) like '%' || k || '%')::text;
