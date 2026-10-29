-- © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
-- بوابة أَثَر — المرحلة P8-أ: الحساب الموحّد · الملف المهاري (مستويات محسوبة + اعتماد) · الشهادات الرقمية القابلة للتحقق (Open Badges 3.0)
-- آمن للتكرار. يعتمد على P5 (المهارات/الأحداث) وP7.

-- 1) الحساب الموحّد وإعدادات المشاركة (خصوصية افتراضية)
create table if not exists public.portal_profiles (
  user_id         uuid primary key references auth.users(id) on delete cascade,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  public_id       text not null unique,                     -- معرّف قصير للرابط العام /p/<public_id>
  display_name    text,
  headline        text,                                     -- المسمى/الوصف القصير
  city            text,
  organization_id uuid references public.portal_organizations(id) on delete set null,
  lang            text not null default 'ar',
  share_mode      text not null default 'private',          -- private | link | public
  share_enabled_at timestamptz,
  constraint ppr_share_chk check (share_mode in ('private','link','public'))
);
alter table public.portal_profiles enable row level security;
drop policy if exists ppr_own on public.portal_profiles;
create policy ppr_own on public.portal_profiles for all to authenticated using (user_id = auth.uid() or public.portal_is_staff()) with check (user_id = auth.uid() or public.portal_is_writer());
grant select, insert, update on public.portal_profiles to authenticated;

-- 2) مستويات المهارات: محسوبة من الأدلة + اعتماد يدوي اختياري
create table if not exists public.portal_skill_levels (
  user_id         uuid not null references auth.users(id) on delete cascade,
  skill_id        uuid not null references public.portal_skills(id) on delete cascade,
  computed_level  numeric(3,2) not null default 0,          -- 0..5
  confidence      int not null default 0,                   -- 0..100 (مجموع أوزان الأدلة)
  evidence        jsonb not null default '[]'::jsonb,       -- [{verb, object_type, object_id, level, weight, at, label}]
  approved_level  int,                                      -- 1..5 يضعه المدرب/الإدارة
  approved_by     uuid references auth.users(id) on delete set null,
  approved_at     timestamptz,
  approved_note   text,
  updated_at      timestamptz not null default now(),
  primary key (user_id, skill_id),
  constraint psl_level_chk check (approved_level is null or approved_level between 1 and 5)
);
create index if not exists psl_skill_idx on public.portal_skill_levels (skill_id);
alter table public.portal_skill_levels enable row level security;
drop policy if exists psl_read on public.portal_skill_levels;
create policy psl_read on public.portal_skill_levels for select to authenticated using (user_id = auth.uid() or public.portal_is_staff());
drop policy if exists psl_staff_write on public.portal_skill_levels;
create policy psl_staff_write on public.portal_skill_levels for update to authenticated using (public.portal_is_writer()) with check (public.portal_is_writer());
grant select, update on public.portal_skill_levels to authenticated;   -- الإدراج/إعادة الحساب من الخادم

-- 3) الشهادات الرقمية القابلة للتحقق
create table if not exists public.portal_credentials (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  user_id       uuid references auth.users(id) on delete set null,
  email         text not null,
  full_name     text,
  kind          text not null,                              -- program_completion | skill | attendance | placement
  title_ar      text not null,
  title_en      text,
  description_ar text,
  program_id    uuid references public.programs(id) on delete set null,
  session_id    uuid references public.portal_sessions(id) on delete set null,
  skills        uuid[] not null default '{}',
  level         text,                                       -- CEFR أو مستوى أَثَر كنص
  hours         numeric(6,1),
  verify_code   text not null unique,
  issued_at     timestamptz not null default now(),
  valid_until   timestamptz,
  revoked_at    timestamptz,
  revoke_reason text,
  issued_by     uuid references auth.users(id) on delete set null,
  badge         jsonb not null default '{}'::jsonb,         -- Open Badges 3.0 (VerifiableCredential)
  constraint pcr_kind_chk check (kind in ('program_completion','skill','attendance','placement'))
);
create index if not exists pcr_email_idx on public.portal_credentials (lower(email), issued_at desc);
create index if not exists pcr_user_idx  on public.portal_credentials (user_id, issued_at desc);
alter table public.portal_credentials enable row level security;
drop policy if exists pcr_read on public.portal_credentials;
create policy pcr_read on public.portal_credentials for select to authenticated using (user_id = auth.uid() or lower(email) = lower(coalesce(auth.jwt()->>'email','')) or public.portal_is_staff());
grant select on public.portal_credentials to authenticated;           -- الإصدار/الإلغاء من الخادم

-- ربط المستخدم بالبريد عند الإصدار
create or replace function public.trg_portal_credential_link() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.user_id is null then select id into new.user_id from auth.users where lower(email) = lower(new.email) limit 1; end if;
  return new;
end $$;
drop trigger if exists portal_credential_link on public.portal_credentials;
create trigger portal_credential_link before insert on public.portal_credentials for each row execute function public.trg_portal_credential_link();

-- 4) التحقق العام من شهادة (بلا تسجيل دخول) — يُرجع الحقول العامة فقط
create or replace function public.portal_verify_credential(p_code text) returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce((select jsonb_build_object(
    'ok', true, 'code', c.verify_code, 'kind', c.kind, 'title_ar', c.title_ar, 'title_en', c.title_en, 'full_name', c.full_name, 'level', c.level, 'hours', c.hours,
    'issued_at', c.issued_at, 'valid_until', c.valid_until, 'revoked', c.revoked_at is not null,
    'program', (select p.name_ar from public.programs p where p.id = c.program_id),
    'skills', (select coalesce(jsonb_agg(jsonb_build_object('code', s.code, 'name_ar', s.name_ar, 'name_en', s.name_en)), '[]'::jsonb) from public.portal_skills s where s.id = any(c.skills)),
    'badge', c.badge)
   from public.portal_credentials c where upper(c.verify_code) = upper(trim(p_code))), jsonb_build_object('ok', false));
$$;
grant execute on function public.portal_verify_credential(text) to anon, authenticated;

-- 5) الملف العام (حسب إعداد المشاركة) — بلا بيانات اتصال
create or replace function public.portal_public_profile(p_public_id text) returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce((select jsonb_build_object(
    'ok', true, 'public_id', pr.public_id, 'display_name', pr.display_name, 'headline', pr.headline, 'city', pr.city, 'share_mode', pr.share_mode,
    'organization', (select o.name_ar from public.portal_organizations o where o.id = pr.organization_id),
    'skills', (select coalesce(jsonb_agg(jsonb_build_object('code', s.code, 'name_ar', s.name_ar, 'name_en', s.name_en, 'domain', s.domain, 'saqf_level', s.saqf_level, 'cefr_level', s.cefr_level, 'sdaia_code', s.sdaia_code,
                 'computed_level', l.computed_level, 'confidence', l.confidence, 'approved_level', l.approved_level) order by coalesce(l.approved_level, l.computed_level) desc), '[]'::jsonb)
               from public.portal_skill_levels l join public.portal_skills s on s.id = l.skill_id where l.user_id = pr.user_id and (l.confidence >= 20 or l.approved_level is not null)),
    'credentials', (select coalesce(jsonb_agg(jsonb_build_object('code', c.verify_code, 'kind', c.kind, 'title_ar', c.title_ar, 'title_en', c.title_en, 'level', c.level, 'issued_at', c.issued_at) order by c.issued_at desc), '[]'::jsonb)
                    from public.portal_credentials c where c.user_id = pr.user_id and c.revoked_at is null))
   from public.portal_profiles pr where pr.public_id = p_public_id and pr.share_mode in ('link','public')), jsonb_build_object('ok', false));
$$;
grant execute on function public.portal_public_profile(text) to anon, authenticated;

-- 6) تحقق
select 'profiles policies' as t, count(*) as n from pg_policies where tablename = 'portal_profiles'
union all select 'skill_levels policies', count(*) from pg_policies where tablename = 'portal_skill_levels'
union all select 'credentials policies', count(*) from pg_policies where tablename = 'portal_credentials'
union all select 'verify()+public_profile()', count(*) from pg_proc where proname in ('portal_verify_credential','portal_public_profile')
union all select 'credential trigger', count(*) from pg_trigger where tgname = 'portal_credential_link';
