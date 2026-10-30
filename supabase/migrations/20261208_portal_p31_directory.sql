-- © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
-- =====================================================================================
-- أَثَر — P31 «هيئة أَثَر» (دليل الخبراء الاستشاريين ودليل المدربين — هوية واحدة بوجهين)
-- «سيرتك توثّقها بنفسك، وشهادة توثيقها أَثَر»
--  1) portal_directory_profiles   — السيرة الواحدة بوجهين (expert/trainer) · الكشف بندًا بندًا · حقول للطاقم فقط
--  2) portal_directory_engagements — عقد تعاون على كل مهمة بين عضو الهيئة وأَثَر (الأجر حسب المشروع — لا يظهر لغير الطرفين)
--  3) portal_consulting_requests  + expert_profile_id / kind (طلب ممهور بخبير أو ترشيح مدرب)
--  4) نوعا وثيقة: directory_card (ATH-EX / ATH-TR) · collaboration (ATH-CO)
--  5) دلو عام صغير للصور المعتمَدة فقط: athar-public (الصورة تُنسخ إليه بعد الموافقة + الاعتماد، وتُحذف عند الإيقاف)
-- آمن لإعادة التشغيل.
-- =====================================================================================

-- 1) السيرة
create table if not exists public.portal_directory_profiles (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  user_id          uuid references auth.users(id) on delete cascade,
  email            text not null,
  status           text not null default 'draft' check (status in ('draft','submitted','approved','changes_requested','suspended')),
  faces            text[] not null default '{}',                       -- expert | trainer
  listed           boolean not null default true,                      -- صاحب السيرة يسحب نفسه من الدليل العام ويعود متى شاء
  slug             text unique,
  code             text unique,                                        -- ATH-HM-XXXX-XXXX (عضو الهيئة)
  name_ar          text not null default '',
  name_en          text,
  title_ar         text not null default '',
  title_en         text,
  city             text,
  languages        text[] not null default '{}',
  photo_path       text,                                               -- في الدلو الخاص athar-media
  photo_public_path text,                                              -- في الدلو العام athar-public بعد الاعتماد
  photo_consent_at timestamptz,
  summary_ar       text not null default '',
  summary_en       text,
  achievements     jsonb not null default '[]'::jsonb,
  education        jsonb not null default '[]'::jsonb,
  experience       jsonb not null default '[]'::jsonb,
  certifications   jsonb not null default '[]'::jsonb,
  publications     jsonb not null default '[]'::jsonb,
  skill_ids        text[] not null default '{}',
  skill_names      text[] not null default '{}',                       -- مُحلّ من portal_skills عند الحفظ (للبحث)
  sectors          text[] not null default '{}',
  services         text[] not null default '{}',
  modes            text[] not null default '{}',
  coverage         text[] not null default '{}',
  visibility       jsonb not null default '{}'::jsonb,                 -- مفاتيح الأقسام (الافتراضي يظهر)
  witness_hidden   boolean not null default false,
  staff_only       jsonb not null default '{}'::jsonb,                 -- {availability, docs[], notes} — لا يُقرأ إلا بالخدمة
  staff_note_ar    text,                                               -- طلب تعديل بكلمات الطاقم
  search_plain     text not null default '',
  submitted_at     timestamptz,
  approved_at      timestamptz,
  approved_by      uuid,
  suspended_at     timestamptz,
  card_expert      jsonb,                                              -- {code, vc_issuance_id, issued_at}
  card_trainer     jsonb,
  legacy_trainer_id uuid,
  meta             jsonb not null default '{}'::jsonb
);
create unique index if not exists portal_directory_profiles_email_uq on public.portal_directory_profiles (lower(email));
create index if not exists portal_directory_profiles_status_idx on public.portal_directory_profiles (status, listed, updated_at desc);
create index if not exists portal_directory_profiles_user_idx on public.portal_directory_profiles (user_id);

-- 2) عقود التعاون
create table if not exists public.portal_directory_engagements (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  profile_id       uuid not null references public.portal_directory_profiles(id) on delete cascade,
  user_id          uuid,
  email            text not null,
  kind             text not null default 'consult' check (kind in ('consult','train')),
  consulting_request_id uuid,
  title_ar         text not null,
  scope_ar         text not null default '',
  deliverables     jsonb not null default '[]'::jsonb,
  start_at         date,
  end_at           date,
  mode             text,
  fee_amount       numeric(12,2),
  currency         text not null default 'SAR',
  terms_ar         text,
  status           text not null default 'proposed' check (status in ('proposed','changes_requested','active','completed','settled','declined','cancelled')),
  change_note_ar   text,
  token            text not null unique default encode(gen_random_bytes(12), 'hex'),
  member_signed_at timestamptz,
  athar_signed_at  timestamptz,
  completed_at     timestamptz,
  settled_at       timestamptz,
  code             text unique,                                        -- ATH-CO-XXXX-XXXX
  vc_issuance_id   uuid,
  created_by       uuid,
  meta             jsonb not null default '{}'::jsonb
);
create index if not exists portal_directory_engagements_profile_idx on public.portal_directory_engagements (profile_id, status, created_at desc);
create index if not exists portal_directory_engagements_email_idx on public.portal_directory_engagements (lower(email));

-- 3) طلبات الاستشارة الممهورة بخبير / ترشيح مدرب
alter table public.portal_consulting_requests add column if not exists expert_profile_id uuid;
alter table public.portal_consulting_requests add column if not exists kind text not null default 'consult';

-- 4) نوعا الوثيقة
alter table public.portal_vc_issuances drop constraint if exists portal_vc_issuances_kind_check;
alter table public.portal_vc_issuances add constraint portal_vc_issuances_kind_check check (kind in ('credential','snapshot','dataset','council_badge','org_charter','journey','org_journey','horizon','org_horizon','pair_pledge','org_pair_pledge','directory_card','collaboration'));

-- 5) الدلو العام للصور المعتمَدة (2 MB · صور فقط) — الكتابة بالخدمة فقط
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('athar-public', 'athar-public', true, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 2097152, allowed_mime_types = array['image/jpeg','image/png','image/webp'];
drop policy if exists athar_public_read on storage.objects;
create policy athar_public_read on storage.objects for select to anon, authenticated using (bucket_id = 'athar-public');

-- 6) الأمان — صاحب السيرة يقرأ صفّه (بلا staff_only عبر الواجهة: الخادم يحذفها) · الطاقم يقرأ الكل · الكتابة بالخدمة فقط
alter table public.portal_directory_profiles enable row level security;
drop policy if exists portal_directory_profiles_read on public.portal_directory_profiles;
create policy portal_directory_profiles_read on public.portal_directory_profiles for select to authenticated
  using (user_id = auth.uid() or lower(email) = lower(coalesce(auth.jwt()->>'email','')) or public.portal_is_staff());
revoke insert, update, delete on public.portal_directory_profiles from anon, authenticated;

alter table public.portal_directory_engagements enable row level security;
drop policy if exists portal_directory_engagements_read on public.portal_directory_engagements;
create policy portal_directory_engagements_read on public.portal_directory_engagements for select to authenticated
  using (user_id = auth.uid() or lower(email) = lower(coalesce(auth.jwt()->>'email','')) or public.portal_is_staff());
revoke insert, update, delete on public.portal_directory_engagements from anon, authenticated;

-- =====================================================================================
-- فحص تشخيصي (المتوقع: tables = 2 · rls_on = 2 · policies = 2 · vc_kinds = 13 · bucket = 1 · req_cols = 2)
select 'tables' as what, count(*)::text as value from information_schema.tables where table_schema = 'public' and table_name in ('portal_directory_profiles','portal_directory_engagements')
union all select 'rls_on', count(*)::text from pg_tables where schemaname = 'public' and tablename in ('portal_directory_profiles','portal_directory_engagements') and rowsecurity
union all select 'policies', count(*)::text from pg_policies where schemaname = 'public' and tablename in ('portal_directory_profiles','portal_directory_engagements')
union all select 'vc_kinds', (select count(*) from unnest(array['credential','snapshot','dataset','council_badge','org_charter','journey','org_journey','horizon','org_horizon','pair_pledge','org_pair_pledge','directory_card','collaboration']) k where pg_get_constraintdef((select oid from pg_constraint where conname = 'portal_vc_issuances_kind_check')) like '%' || k || '%')::text
union all select 'bucket', count(*)::text from storage.buckets where id = 'athar-public'
union all select 'req_cols', count(*)::text from information_schema.columns where table_schema = 'public' and table_name = 'portal_consulting_requests' and column_name in ('expert_profile_id','kind');
