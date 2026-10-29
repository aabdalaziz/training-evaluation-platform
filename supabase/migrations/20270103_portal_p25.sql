-- © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved.
-- 846 — P25 «رحلة الممارس» (سجل الرحلة المهنية · «رحلتي») — آمن لإعادة التشغيل
-- ما يضيفه هذا الملف:
--   1) portal_journey_notes     «ما تغيّر فيّ»: تعليق المستخدم بكلماته (نص أو صوت/فيديو عبر القناة الواحدة) على كل فصل من رحلته
--   2) portal_journey_shares    النسخة القابلة للمشاركة: كشف انتقائي (فصول يختارها) → وثيقة Ed25519 (ATH-J-XXXX-XXXX) برابط عام /journey/<code> — تُلغى بزر
--   3) portal_time_capsules     «رسالة إلى نفسي بعد سنة»: تُختم اليوم وتُسلَّم بعد 365 يومًا مع لقطة «أين كنت» و«أين صرت» — عبر الكرون اليومي الحالي
--   4) portal_vc_issuances.kind  يقبل 'journey'
--   5) RLS: القراءة الذاتية للمستخدم؛ كل الكتابة عبر واجهات أَثَر بصلاحية الخدمة
-- =====================================================================================

-- 1) تعليقات الفصول
create table if not exists public.portal_journey_notes (
  id            bigserial primary key,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  user_id       uuid not null,
  email         text not null,
  chapter_key   text not null,                              -- مفتاح الفصل الثابت (مثل daily_first · level_approved:<skill_id>)
  body_ar       text not null default '',
  media_id      uuid,                                       -- صوت/فيديو من portal_media (اختياري)
  kind          text not null default 'text' check (kind in ('text','audio','video')),
  meta          jsonb not null default '{}'::jsonb,
  unique (user_id, chapter_key)
);
create index if not exists portal_journey_notes_user_idx on public.portal_journey_notes (user_id, updated_at desc);

-- 2) النسخ المشتركة
create table if not exists public.portal_journey_shares (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  user_id         uuid not null,
  email           text not null,
  code            text not null unique,                     -- ATH-J-XXXX-XXXX
  display_name    text not null,                            -- كما اختار المستخدم إظهاره (الاسم الكامل افتراضيًا أو «الاسم الأول + حرف»)
  name_mode       text not null default 'full' check (name_mode in ('full','short')),
  chapter_keys    text[] not null default '{}',
  chapters        jsonb not null default '[]'::jsonb,       -- لقطة مجمَّدة للفصول المختارة (عنوان · تاريخ · ما حدث · اقتباس إن اختار)
  include_quotes  boolean not null default true,
  intro_ar        text,
  status          text not null default 'active' check (status in ('active','revoked','expired')),
  expires_at      timestamptz not null,
  revoked_at      timestamptz,
  views           integer not null default 0,
  vc_issuance_id  uuid,
  meta            jsonb not null default '{}'::jsonb
);
create index if not exists portal_journey_shares_user_idx on public.portal_journey_shares (user_id, created_at desc);
create index if not exists portal_journey_shares_code_idx on public.portal_journey_shares (code) where status = 'active';

-- 3) رسائل إلى الذات بعد سنة
create table if not exists public.portal_time_capsules (
  id              bigserial primary key,
  created_at      timestamptz not null default now(),
  user_id         uuid not null,
  email           text not null,
  full_name       text,
  body_ar         text not null,
  media_id        uuid,
  kind            text not null default 'text' check (kind in ('text','audio','video')),
  deliver_at      timestamptz not null,
  delivered_at    timestamptz,
  status          text not null default 'sealed' check (status in ('sealed','delivered','cancelled')),
  snapshot_then   jsonb not null default '{}'::jsonb,       -- {chapters, levels:[{skill,level}], last_chapter}
  snapshot_now    jsonb,                                    -- يُملأ عند التسليم
  message_log_id  bigint,
  meta            jsonb not null default '{}'::jsonb
);
create index if not exists portal_time_capsules_due_idx on public.portal_time_capsules (deliver_at) where status = 'sealed';
create index if not exists portal_time_capsules_user_idx on public.portal_time_capsules (user_id, created_at desc);

-- 4) نوع الوثيقة
alter table public.portal_vc_issuances drop constraint if exists portal_vc_issuances_kind_check;
alter table public.portal_vc_issuances add constraint portal_vc_issuances_kind_check check (kind in ('credential','snapshot','dataset','council_badge','org_charter','journey'));

-- 5) الأمان
alter table public.portal_journey_notes enable row level security;
alter table public.portal_journey_shares enable row level security;
alter table public.portal_time_capsules enable row level security;
drop policy if exists portal_journey_notes_own_read on public.portal_journey_notes;
create policy portal_journey_notes_own_read on public.portal_journey_notes for select to authenticated using (user_id = auth.uid());
drop policy if exists portal_journey_shares_own_read on public.portal_journey_shares;
create policy portal_journey_shares_own_read on public.portal_journey_shares for select to authenticated using (user_id = auth.uid());
drop policy if exists portal_time_capsules_own_read on public.portal_time_capsules;
create policy portal_time_capsules_own_read on public.portal_time_capsules for select to authenticated using (user_id = auth.uid());
revoke insert, update, delete on public.portal_journey_notes, public.portal_journey_shares, public.portal_time_capsules from anon, authenticated;

-- =====================================================================================
-- فحص تشخيصي (المتوقع: tables = 3 · rls_on = 3 · policies = 3 · vc_kinds = 6)
select 'tables' as what, count(*)::text as value from information_schema.tables where table_schema = 'public' and table_name in ('portal_journey_notes','portal_journey_shares','portal_time_capsules')
union all select 'rls_on', count(*)::text from pg_tables where schemaname = 'public' and tablename in ('portal_journey_notes','portal_journey_shares','portal_time_capsules') and rowsecurity
union all select 'policies', count(*)::text from pg_policies where schemaname = 'public' and tablename in ('portal_journey_notes','portal_journey_shares','portal_time_capsules')
union all select 'vc_kinds', (select count(*) from unnest(array['credential','snapshot','dataset','council_badge','org_charter','journey']) k where pg_get_constraintdef((select oid from pg_constraint where conname = 'portal_vc_issuances_kind_check')) like '%' || k || '%')::text;
