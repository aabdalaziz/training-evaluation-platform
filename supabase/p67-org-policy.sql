-- © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
-- =====================================================================================================
--  P67 «سياسة الجهة — الاسم يدخل من الباب»  (يُنفَّذ مرة واحدة في Supabase → SQL Editor؛ آمن للتكرار)
--  · 7 مفاتيح سياسة على الجهة (jsonb واحد) + مُعرِّف قصير (slug) للدخول من /enter
--  · portal_org_codes: الأرقام التدريبية ↔ حسابات مصطنعة (الرقم السري يعيش في Auth فقط — لا نخزّنه هنا)
--  · portal_org_policy_seals: ختم «ATH-OP» لكل حفظ سياسة (موقَّع Ed25519 — يُتحقّق منه في /verify/policy)
--  · portal_org_flag / portal_user_org_flag: نقطة الاختناق في قاعدة البيانات (تُستعمل في portal_public_profile)
--  · لا مهام مجدولة جديدة · لا متغيّرات بيئة · لا حزم
-- =====================================================================================================

-- (1) أعمدة الجهة
alter table public.portal_organizations add column if not exists slug              text;
alter table public.portal_organizations add column if not exists policy            jsonb       not null default '{}'::jsonb;
alter table public.portal_organizations add column if not exists policy_updated_at timestamptz;
alter table public.portal_organizations add column if not exists policy_updated_by uuid references auth.users(id) on delete set null;
create unique index if not exists porg_slug_uidx on public.portal_organizations (lower(slug)) where slug is not null;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'porg_slug_chk') then
    alter table public.portal_organizations add constraint porg_slug_chk check (slug is null or slug ~ '^[a-z][a-z0-9-]{1,23}$');
  end if;
end $$;

-- (2) الأرقام التدريبية (الرقم السري ليس هنا — يعيش مُشفَّرًا في auth.users كأي كلمة مرور)
create table if not exists public.portal_org_codes (
  id              bigserial primary key,
  organization_id uuid        not null references public.portal_organizations(id) on delete cascade,
  training_no     text        not null,                      -- الرقم التدريبي كما تكتبه الجهة (حروف/أرقام/./-/_)
  user_id         uuid        references auth.users(id) on delete cascade,
  created_at      timestamptz not null default now(),
  created_by      uuid        references auth.users(id) on delete set null,
  pin_set_at      timestamptz not null default now(),        -- آخر تعيين/إعادة تعيين للرقم السري
  pin_changed     boolean     not null default false,        -- هل غيّر المتعلّم رقمه السري بنفسه بعد أول دخول
  first_login_at  timestamptz,                               -- أول دخول ناجح (وقبول «ميثاق الرمز»)
  last_login_at   timestamptz,
  failed          integer     not null default 0,            -- محاولات فاشلة متتالية
  locked_until    timestamptz,                               -- قفل مؤقت بعد 5 محاولات
  revoked_at      timestamptz,                               -- إيقاف الرمز (المتعلّم غادر)
  constraint poc_no_chk check (training_no ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,31}$'),
  constraint poc_org_no_uq unique (organization_id, training_no)
);
create index if not exists poc_user_idx on public.portal_org_codes (user_id);
alter table public.portal_org_codes enable row level security;
drop policy if exists poc_staff_read on public.portal_org_codes;
create policy poc_staff_read on public.portal_org_codes for select to authenticated using (public.portal_is_staff());
drop policy if exists poc_orgadmin_read on public.portal_org_codes;
create policy poc_orgadmin_read on public.portal_org_codes for select to authenticated
  using (exists (select 1 from public.portal_org_members m where m.organization_id = portal_org_codes.organization_id and m.user_id = auth.uid() and m.role = 'org_admin' and m.status = 'confirmed'));
revoke all on public.portal_org_codes from anon;
revoke insert, update, delete on public.portal_org_codes from authenticated;   -- الكتابة من الخادم (service) فقط

-- (3) أختام السياسة ATH-OP (وثيقة موقَّعة لكل حفظ — تُقرأ عامًا عبر /api/org/policy?verify=)
create table if not exists public.portal_org_policy_seals (
  id              bigserial primary key,
  organization_id uuid        not null references public.portal_organizations(id) on delete cascade,
  code            text        not null unique,               -- ATH-OP-XXXX-XXXX
  issued_at       timestamptz not null default now(),
  issued_by       uuid        references auth.users(id) on delete set null,
  policy          jsonb       not null default '{}'::jsonb,  -- لقطة المفاتيح وقت الختم
  changed         text[]      not null default '{}',         -- المفاتيح التي تغيّرت عن الختم السابق
  digest          text        not null default '',
  body            jsonb       not null default '{}'::jsonb   -- الوثيقة الموقَّعة (اسم الجهة + المفاتيح + البيان — لا أشخاص)
);
create index if not exists pops_org_idx on public.portal_org_policy_seals (organization_id, issued_at desc);
alter table public.portal_org_policy_seals enable row level security;
drop policy if exists pops_staff_read on public.portal_org_policy_seals;
create policy pops_staff_read on public.portal_org_policy_seals for select to authenticated using (public.portal_is_staff());
revoke all on public.portal_org_policy_seals from anon;
revoke insert, update, delete on public.portal_org_policy_seals from authenticated;

-- (4) نقطة الاختناق في القاعدة: هل المفتاح مفعَّل على جهة؟ / على أي جهة ينتمي إليها المستخدم؟
create or replace function public.portal_org_flag(p_org uuid, p_flag text) returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select (o.policy ->> p_flag) = 'true' from public.portal_organizations o where o.id = p_org), false);
$$;
create or replace function public.portal_user_org_flag(p_user uuid, p_flag text) returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.portal_org_members m join public.portal_organizations o on o.id = m.organization_id
     where m.user_id = p_user and m.status = 'confirmed' and (o.policy ->> p_flag) = 'true'
  );
$$;
grant execute on function public.portal_org_flag(uuid, text) to anon, authenticated;
grant execute on function public.portal_user_org_flag(uuid, text) to anon, authenticated;

-- (5) الملف العام: صفر وجوه عامة عندما تقفل الجهة «الوجوه العامة» (نفس الدالة الأصلية + شرط واحد)
create or replace function public.portal_public_profile(p_public_id text) returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce((select jsonb_build_object(
    'ok', true, 'public_id', pr.public_id, 'display_name', pr.display_name, 'headline', pr.headline, 'city', pr.city, 'share_mode', pr.share_mode,
    'organization', (select o.name_ar from public.portal_organizations o where o.id = pr.organization_id),
    'skills', (select coalesce(jsonb_agg(jsonb_build_object('code', s.code, 'name_ar', s.name_ar, 'name_en', s.name_en, 'domain', s.domain, 'saqf_level', s.saqf_level, 'cefr_level', s.cefr_level, 'sdaia_code', s.sdaia_code,
                 'computed_level', l.computed_level, 'confidence', l.confidence, 'approved_level', l.approved_level) order by coalesce(l.approved_level, l.computed_level) desc), '[]'::jsonb)
               from public.portal_skill_levels l join public.portal_skills s on s.id = l.skill_id where l.user_id = pr.user_id and (l.confidence >= 20 or l.approved_level is not null)),
    'credentials', (select coalesce(jsonb_agg(jsonb_build_object('code', c.verify_code, 'kind', c.kind, 'title_ar', c.title_ar, 'title_en', c.title_en, 'level', c.level, 'issued_at', c.issued_at) order by c.issued_at desc), '[]'::jsonb)
                    from public.portal_credentials c where c.user_id = pr.user_id and c.revoked_at is null))
   from public.portal_profiles pr where pr.public_id = p_public_id and pr.share_mode in ('link','public')
     and not public.portal_user_org_flag(pr.user_id, 'public_faces_off')), jsonb_build_object('ok', false));
$$;
grant execute on function public.portal_public_profile(text) to anon, authenticated;

-- (6) الدخول بالرمز: الجهة بالمُعرِّف (عام — اسم وسياسة الدخول فقط؛ تُستدعى من الخادم)
create or replace function public.portal_org_by_slug(p_slug text) returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce((select jsonb_build_object('id', o.id, 'name_ar', o.name_ar, 'name_en', o.name_en, 'slug', o.slug, 'policy', o.policy, 'active', o.active, 'frozen', o.frozen_at is not null)
                     from public.portal_organizations o where lower(o.slug) = lower(p_slug) and o.active), '{}'::jsonb);
$$;
revoke all on function public.portal_org_by_slug(text) from public, anon, authenticated;   -- الخادم فقط

-- =====================================================================================================
--  التشخيص (النتيجة المتوقَّعة بين قوسين)
-- =====================================================================================================
select 'p67_columns' as k, count(*)::text as v from information_schema.columns
 where table_schema = 'public' and table_name = 'portal_organizations' and column_name in ('slug', 'policy', 'policy_updated_at', 'policy_updated_by')                        -- (4)
union all select 'p67_tables',    count(*)::text from pg_tables where schemaname = 'public' and tablename in ('portal_org_codes', 'portal_org_policy_seals')                 -- (2)
union all select 'p67_functions', count(*)::text from pg_proc where proname in ('portal_org_flag', 'portal_user_org_flag', 'portal_org_by_slug', 'portal_public_profile')   -- (4)
union all select 'p67_policies',  count(*)::text from pg_policies where schemaname = 'public' and tablename in ('portal_org_codes', 'portal_org_policy_seals')              -- (3)
union all select 'p67_rls_on',    count(*)::text from pg_tables where schemaname = 'public' and tablename in ('portal_org_codes', 'portal_org_policy_seals') and rowsecurity  -- (2)
union all select 'p67_anon_grants', count(*)::text from information_schema.role_table_grants
 where table_schema = 'public' and table_name in ('portal_org_codes', 'portal_org_policy_seals') and grantee = 'anon'                                                         -- (0)
union all select 'orgs_with_policy', count(*)::text from public.portal_organizations where policy <> '{}'::jsonb                                                               -- (0 الآن — يرتفع مع أول حفظ)
union all select 'flag_fn_ok', (not public.portal_org_flag(gen_random_uuid(), 'pseudonymous'))::text;                                                                         -- (true)
