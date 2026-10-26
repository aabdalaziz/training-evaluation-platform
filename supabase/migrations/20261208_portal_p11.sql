-- © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
-- أَثَر · P11 — التوأم المهاري + الشهادة الحية
--  1) portal_credentials.live  — الشهادة تعرض المستوى الحالي والطزاجة (يتحكم صاحبها)
--  2) portal_credential_watchers — جهات تشترك في شهادة لتصلها تغيّراتها (بريد أسبوعي مجمّع عبر الكرون اليومي الموجود)
--  3) portal_twin_exports — سجل تصدير/محو التوأم (حق المتعلم في بياناته) بلا محتوى شخصي
--  4) دالة عامة portal_living_credential(code) — بيانات الشهادة + مستويات مهاراتها الحالية وأدلتها (أنواع وتواريخ فقط)
--  يُنفَّذ في Supabase → SQL Editor (مشروع nybinzuqwhcctgwcimru) ثم انظر جدول التحقق في الأسفل.

-- 1) الشهادة الحية: مفعّلة افتراضيًا (الشهادة أصلًا عامة برمزها؛ لا تُعرض بيانات اتصال)
alter table public.portal_credentials add column if not exists live boolean not null default true;

-- 2) المشتركون في الشهادة
create table if not exists public.portal_credential_watchers (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  credential_id   uuid not null references public.portal_credentials(id) on delete cascade,
  email           text not null,
  name            text,
  organization    text,
  token           text not null unique,                       -- لإلغاء الاشتراك بلا تسجيل دخول
  confirmed_at    timestamptz,
  last_notified_at timestamptz,
  last_snapshot   jsonb,                                      -- {code:{level,status}} آخر حالة أُبلغت
  unsubscribed_at timestamptz,
  constraint pcw_email_chk check (position('@' in email) > 1)
);
create index if not exists pcw_cred_idx on public.portal_credential_watchers (credential_id, unsubscribed_at);
create unique index if not exists pcw_cred_email_uq on public.portal_credential_watchers (credential_id, lower(email)) where unsubscribed_at is null;
alter table public.portal_credential_watchers enable row level security;
-- لا سياسات للعامة: الوصول عبر الخادم (service role) فقط؛ صاحب الشهادة يرى عدد المشتركين فقط عبر الواجهة
drop policy if exists pcw_owner_read on public.portal_credential_watchers;
create policy pcw_owner_read on public.portal_credential_watchers for select to authenticated
  using (exists (select 1 from public.portal_credentials c where c.id = credential_id and c.user_id = auth.uid()));

-- 3) سجل حقوق التوأم (تصدير/محو)
create table if not exists public.portal_twin_exports (
  id          bigserial primary key,
  at          timestamptz not null default now(),
  user_id     uuid references auth.users(id) on delete set null,
  action      text not null,                                  -- export | forget
  events      int not null default 0,
  levels      int not null default 0
);
alter table public.portal_twin_exports enable row level security;
drop policy if exists pte_own_read on public.portal_twin_exports;
create policy pte_own_read on public.portal_twin_exports for select to authenticated using (user_id = auth.uid());

-- 4) الشهادة الحية (عامة بالرمز): الأساس + المستويات الحالية لمهارات الشهادة (إن كانت live) + سلسلة الأدلة (نوع/تاريخ/وسم فقط)
create or replace function public.portal_living_credential(p_code text) returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce((select jsonb_build_object(
    'ok', true, 'code', c.verify_code, 'kind', c.kind, 'title_ar', c.title_ar, 'title_en', c.title_en, 'full_name', c.full_name, 'level', c.level, 'hours', c.hours,
    'issued_at', c.issued_at, 'valid_until', c.valid_until, 'revoked', c.revoked_at is not null, 'live', c.live and c.user_id is not null,
    'program', (select p.name_ar from public.programs p where p.id = c.program_id),
    'skills', (select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'code', s.code, 'name_ar', s.name_ar, 'name_en', s.name_en, 'domain', s.domain, 'level', s.level, 'saqf_level', s.saqf_level, 'cefr_level', s.cefr_level, 'sdaia_code', s.sdaia_code)), '[]'::jsonb) from public.portal_skills s where s.id = any(c.skills)),
    'levels', case when c.live and c.user_id is not null then
       (select coalesce(jsonb_agg(jsonb_build_object('skill_id', l.skill_id, 'computed_level', l.computed_level, 'approved_level', l.approved_level, 'confidence', l.confidence, 'approved_at', l.approved_at,
          'evidence', (select coalesce(jsonb_agg(jsonb_build_object('kind', e->>'kind', 'level', e->'level', 'weight', e->'weight', 'at', e->>'at', 'label', left(e->>'label', 80))), '[]'::jsonb) from jsonb_array_elements(l.evidence) e))), '[]'::jsonb)
        from public.portal_skill_levels l where l.user_id = c.user_id and l.skill_id = any(c.skills)) else '[]'::jsonb end,
    'watchers', (select count(*) from public.portal_credential_watchers w where w.credential_id = c.id and w.unsubscribed_at is null),
    'badge', c.badge)
   from public.portal_credentials c where upper(c.verify_code) = upper(trim(p_code))), jsonb_build_object('ok', false));
$$;
grant execute on function public.portal_living_credential(text) to anon, authenticated;

-- 5) تحقق — المتوقع: live column 1 · watchers table 1 · exports table 1 · living fn 1 · policies 2
select 'live column' as t, count(*) as n from information_schema.columns where table_schema = 'public' and table_name = 'portal_credentials' and column_name = 'live'
union all select 'watchers table', count(*) from information_schema.tables where table_schema = 'public' and table_name = 'portal_credential_watchers'
union all select 'exports table', count(*) from information_schema.tables where table_schema = 'public' and table_name = 'portal_twin_exports'
union all select 'living fn', count(*) from pg_proc where proname = 'portal_living_credential'
union all select 'policies', count(*) from pg_policies where tablename in ('portal_credential_watchers', 'portal_twin_exports');
