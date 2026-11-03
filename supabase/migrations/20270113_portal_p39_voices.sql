-- © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
-- =====================================================================================
--  P39 «أصوات حول الشهادة» (متابعة أثر التدريب — المستوى الثاني) — ترحيل واحد، آمن للتكرار
--  حول شهادة P38 (صوت المتدرّب اليوم) أربعة أصوات أخرى، بلا مساس بقاعدتها (كلمات لا أرقام · لا أثر رجعي · k≥5 · الإنسان يعتمد):
--   1) portal_after_letters        — «رسالة إلى نفسي بعد سنة»: تُكتب في آخر أيام البرنامج وتُختم، وتُفتح مع محطة السنة. خاصة دائمًا.
--   2) portal_after_offers         — «البرنامج يردّ»: عرض ورشة تطبيق يكتبه إنسان من الطاقم حين يكتب خمسة «لم تسنح الفرصة»
--      portal_after_offer_replies  — إجابة المتدرّب (أرغب / لا، شكرًا) — إجابة واحدة تُبدَّل
--   3) portal_after_org_stations   — «محطة الجهة»: بعد سنة تكتب الجهة سطرها هي (حالة بالكلمات + نصّ)؛ تُفتح بخمسة منسوبين؛ تُنشر بإذن الجهة
--   4) in_doc_measure على portal_after_stations — «أثر بعد» في مِعيار: المتدرّب يختار إضافة قياسه بعد البرنامج إلى وثيقة ATH-AF
--  تشخيص متوقَّع في النهاية: tables_expected_4 = 4 · measure_col_expected_1 = 1 · policies_expected_3 = 3 · idx_expected_4 = 4
-- =====================================================================================

do $$ begin
  if not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'portal_after_stations') then
    raise exception 'شغّل هجرة P38 أولًا (20261216_portal_p38_after.sql)';
  end if;
end $$;

-- 1) رسالة إلى نفسي بعد سنة
create table if not exists public.portal_after_letters (
  id             bigserial primary key,
  created_at     timestamptz not null default now(),
  enrollment_id  uuid not null references public.portal_enrollments(id) on delete cascade,
  program_id     uuid not null references public.programs(id) on delete cascade,
  user_id        uuid,
  email          text not null,
  text_ar        text not null check (char_length(text_ar) between 40 and 600),
  sealed_at      timestamptz not null default now(),
  opened_at      timestamptz,
  in_doc         boolean not null default false,
  constraint portal_after_letters_uq unique (enrollment_id)
);
create index if not exists portal_after_letters_open_idx on public.portal_after_letters (program_id) where opened_at is null;
alter table public.portal_after_letters enable row level security;
drop policy if exists after_letters_self on public.portal_after_letters;
create policy after_letters_self on public.portal_after_letters for select
  using (user_id = auth.uid() or lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));   -- الكتابة عبر الخدمة فقط؛ لا يقرؤها غير صاحبها أبدًا

-- 2) البرنامج يردّ
create table if not exists public.portal_after_offers (
  id          bigserial primary key,
  created_at  timestamptz not null default now(),
  program_id  uuid not null references public.programs(id) on delete cascade,
  title_ar    text not null check (char_length(title_ar) between 3 and 120),
  text_ar     text not null check (char_length(text_ar) between 20 and 400),
  link        text,
  created_by  uuid,
  closed_at   timestamptz
);
create index if not exists portal_after_offers_program_idx on public.portal_after_offers (program_id) where closed_at is null;
alter table public.portal_after_offers enable row level security;
revoke all on public.portal_after_offers from anon, authenticated; grant all on public.portal_after_offers to service_role;

create table if not exists public.portal_after_offer_replies (
  id             bigserial primary key,
  offer_id       bigint not null references public.portal_after_offers(id) on delete cascade,
  enrollment_id  uuid not null references public.portal_enrollments(id) on delete cascade,
  user_id        uuid,
  email          text not null,
  reply          text not null check (reply in ('want','no')),
  at             timestamptz not null default now(),
  constraint portal_after_offer_replies_uq unique (offer_id, enrollment_id)
);
create index if not exists portal_after_offer_replies_offer_idx on public.portal_after_offer_replies (offer_id, reply);
alter table public.portal_after_offer_replies enable row level security;
drop policy if exists after_offer_replies_self on public.portal_after_offer_replies;
create policy after_offer_replies_self on public.portal_after_offer_replies for select
  using (user_id = auth.uid() or lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

-- 3) محطة الجهة
create table if not exists public.portal_after_org_stations (
  id               bigserial primary key,
  created_at       timestamptz not null default now(),
  program_id       uuid not null references public.programs(id) on delete cascade,
  organization_id  uuid not null references public.portal_organizations(id) on delete cascade,
  state            text check (state is null or state in ('changed','partly','not_yet','cannot_judge')),
  text_ar          text check (text_ar is null or char_length(text_ar) between 40 and 600),
  public           boolean not null default false,
  written_by       uuid,
  written_at       timestamptz,
  notified_at      timestamptz,
  constraint portal_after_org_stations_uq unique (program_id, organization_id)
);
create index if not exists portal_after_org_stations_program_idx on public.portal_after_org_stations (program_id) where written_at is not null;
alter table public.portal_after_org_stations enable row level security;
drop policy if exists after_org_stations_public on public.portal_after_org_stations;
create policy after_org_stations_public on public.portal_after_org_stations for select using (public = true and written_at is not null);

-- 4) أثر بعد في مِعيار — خيار المتدرّب
alter table public.portal_after_stations add column if not exists in_doc_measure boolean not null default false;

-- تشخيص
select
  (select count(*) from information_schema.tables where table_schema = 'public' and table_name in ('portal_after_letters','portal_after_offers','portal_after_offer_replies','portal_after_org_stations')) as tables_expected_4,
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'portal_after_stations' and column_name = 'in_doc_measure') as measure_col_expected_1,
  (select count(*) from pg_policies where schemaname = 'public' and policyname in ('after_letters_self','after_offer_replies_self','after_org_stations_public')) as policies_expected_3,
  (select count(*) from pg_indexes where schemaname = 'public' and indexname in ('portal_after_letters_open_idx','portal_after_offers_program_idx','portal_after_offer_replies_offer_idx','portal_after_org_stations_program_idx')) as idx_expected_4,
  (select count(*) from public.portal_after_stations where state = 'no_chance') as no_chance_now;
