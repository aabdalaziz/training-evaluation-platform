-- © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
-- =====================================================================================
--  P44 «البرنامج الذي لم يُكتب بعد» (الاسم الرسمي: الاحتياج التدريبي المعلَن) — ترحيل واحد، آمن للتكرار
--  الكتالوج يُكتب من الحاجة لا من المكتب:
--   1) portal_needs          — حاجة بجملة (≤ 200 حرفًا، بلا أسماء) + قطاع؛ تبدأ «بذرة» (يراها المسجَّلون فقط) وتصير «معلَنة» عامة حين يقول خمسة غير كاتبها «وأنا أيضًا»؛
--                              يتبنّاها عضو في هيئة أَثَر (مدرّب/خبير معتمَد) أو الطاقم → مسودّة في هندسة البرامج → اعتماد بشري ونشر → «وُلد من حاجة أعلنها N ممارسًا»
--                              مصادرها: practitioner (ممارس) · station (من محطة «لم تسنح الفرصة»/«لم ينفعني» في P38) · org («جهة تحتاج» من /org) · offer (خمسة «أرغب» في ورشة تطبيق P39)
--   2) portal_need_supports  — «وأنا أيضًا»: صفّ لكل شخص لكل حاجة (بريد فريد) — بلا تعليق
--   3) programs.born_from_need_id — سطر الميلاد على صفحة البرنامج
--   4) المقاعد الأولى: حين يُفتح التسجيل في برنامج وُلد من حاجة تبدأ نافذة 72 ساعة (priority_until) لا يسجّل فيها غير كاتب الحاجة ومؤيّديها — حارس على portal_enrollments
--  تشخيص متوقَّع في النهاية: tables_expected_2 = 2 · column_expected_1 = 1 · trigger_expected_1 = 1 · policies_expected_2 = 2 · idx_expected_3 = 3
-- =====================================================================================

do $$ begin
  if not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'portal_program_drafts') then
    raise exception 'شغّل هجرة P13-أ أولًا (20261214_portal_p13a.sql) — هندسة البرامج التدريبية';
  end if;
end $$;

-- 1) الحاجات
create table if not exists public.portal_needs (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  user_id          uuid,
  email            text not null,
  sector           text not null,
  text_ar          text not null check (char_length(text_ar) between 20 and 200),
  source           text not null default 'practitioner' check (source in ('practitioner','station','org','offer')),
  source_ref       text,
  organization_id  uuid references public.portal_organizations(id) on delete set null,
  org_named        boolean not null default false,
  status           text not null default 'seed' check (status in ('seed','open','adopted','born','folded','withdrawn','merged')),
  supports         integer not null default 0,
  opened_at        timestamptz,
  adopter_user_id  uuid,
  adopter_email    text,
  adopter_kind     text check (adopter_kind is null or adopter_kind in ('faculty','staff')),
  adopter_name_ar  text,
  pitch_ar         text check (pitch_ar is null or char_length(pitch_ar) <= 600),
  adopted_at       timestamptz,
  draft_id         uuid,
  program_id       uuid references public.programs(id) on delete set null,
  born_at          timestamptz,
  priority_until   timestamptz,
  folded_at        timestamptz,
  revived_at       timestamptz,
  withdrawn_at     timestamptz,
  merged_into      uuid references public.portal_needs(id) on delete set null
);
create index if not exists portal_needs_status_idx on public.portal_needs (status, created_at desc);
create index if not exists portal_needs_program_idx on public.portal_needs (program_id) where program_id is not null;
alter table public.portal_needs enable row level security;
drop policy if exists needs_public_read on public.portal_needs;
create policy needs_public_read on public.portal_needs for select using (status in ('open','adopted','born'));   -- العامة: المعلَنة فقط؛ البذور والمطويّة عبر الخدمة

-- 2) «وأنا أيضًا»
create table if not exists public.portal_need_supports (
  id          bigserial primary key,
  need_id     uuid not null references public.portal_needs(id) on delete cascade,
  user_id     uuid,
  email       text not null,
  created_at  timestamptz not null default now()
);
create unique index if not exists portal_need_supports_uq on public.portal_need_supports (need_id, lower(email));
alter table public.portal_need_supports enable row level security;
drop policy if exists need_supports_self on public.portal_need_supports;
create policy need_supports_self on public.portal_need_supports for select
  using (user_id = auth.uid() or lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

-- 3) سطر الميلاد
alter table public.programs add column if not exists born_from_need_id uuid references public.portal_needs(id) on delete set null;

-- 4) المقاعد الأولى (72 ساعة) — حارس التسجيل
create or replace function public.portal_needs_priority_guard() returns trigger language plpgsql security definer set search_path = public as $$
declare v_need public.portal_needs%rowtype; v_email text := lower(coalesce(new.email, ''));
begin
  select n.* into v_need from public.portal_needs n join public.programs p on p.born_from_need_id = n.id where p.id = new.program_id;
  if v_need.id is null or v_need.priority_until is null or v_need.priority_until <= now() then return new; end if;
  if lower(v_need.email) = v_email or (new.user_id is not null and v_need.user_id = new.user_id) then return new; end if;
  if exists (select 1 from public.portal_need_supports s where s.need_id = v_need.id and (lower(s.email) = v_email or (new.user_id is not null and s.user_id = new.user_id))) then return new; end if;
  raise exception 'المقاعد الأولى لمن أعلنوا الحاجة حتى %', to_char(v_need.priority_until at time zone 'Asia/Riyadh', 'YYYY-MM-DD HH24:MI');
end $$;
drop trigger if exists portal_enrollments_need_priority on public.portal_enrollments;
create trigger portal_enrollments_need_priority before insert on public.portal_enrollments for each row execute function public.portal_needs_priority_guard();

-- تشخيص
select
  (select count(*) from information_schema.tables where table_schema = 'public' and table_name in ('portal_needs','portal_need_supports')) as tables_expected_2,
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'programs' and column_name = 'born_from_need_id') as column_expected_1,
  (select count(*) from pg_trigger where tgname = 'portal_enrollments_need_priority') as trigger_expected_1,
  (select count(*) from pg_policies where schemaname = 'public' and policyname in ('needs_public_read','need_supports_self')) as policies_expected_2,
  (select count(*) from pg_indexes where schemaname = 'public' and indexname in ('portal_needs_status_idx','portal_needs_program_idx','portal_need_supports_uq')) as idx_expected_3,
  (select count(*) from public.portal_after_stations where state in ('no_chance','not_useful') and written_at is not null) as station_candidates_now;
