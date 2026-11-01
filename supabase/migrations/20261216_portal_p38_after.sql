-- © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
-- =====================================================================================
--  P38 «الشهادة التي تكبر» (متابعة أثر التدريب · Training impact follow-up) — ترحيل واحد، آمن للتكرار
--  جدول واحد: portal_after_stations — محطة واحدة (30 · 90 · 365 يومًا بعد نهاية البرنامج) لكل تسجيل مكتمل:
--    ما كتبه المتدرّب بكلماته · حالة واحدة بالكلمات (طبّقته · جزئيًا · لم تسنح · لم ينفعني) · شاهد يدعوه المتدرّب (بريد → يوقّع أو يعتذر)
--    · إذن النشر (may_publish) · إظهار الفصل في الشهادة الحيّة (shown_on_credential) · اعتماد الطاقم للاقتباس العام (published_at)
--  الصفّ يُنشأ عند فتح المحطة (notified_at) أو عند الكتابة (written_at)؛ المحطة الفائتة تبقى فارغة — لا استكمال بأثر رجعي.
--  وثيقة ATH-AF تُصدر في portal_vc_issuances (kind = 'after') — لا جدول لها.
--  تشخيص متوقَّع في النهاية: tables_1 = 1 · policies_1 = 1 · idx_2 = 2
-- =====================================================================================

create table if not exists public.portal_after_stations (
  id                  bigserial primary key,
  created_at          timestamptz not null default now(),
  enrollment_id       uuid not null references public.portal_enrollments(id) on delete cascade,
  program_id          uuid not null references public.programs(id) on delete cascade,
  user_id             uuid,
  email               text not null,
  station             smallint not null check (station in (30, 90, 365)),
  state               text check (state is null or state in ('applied','partly','no_chance','not_useful')),
  text_ar             text check (text_ar is null or char_length(text_ar) between 40 and 1200),
  may_publish         boolean not null default false,
  shown_on_credential boolean not null default false,
  witness_email       text,
  witness_user_id     uuid,
  witness_status      text check (witness_status is null or witness_status in ('invited','signed','declined')),
  witness_text        text check (witness_text is null or char_length(witness_text) <= 300),
  witness_at          timestamptz,
  notified_at         timestamptz,
  written_at          timestamptz,
  published_at        timestamptz,
  published_by        uuid,
  constraint portal_after_stations_uq unique (enrollment_id, station)
);
create index if not exists portal_after_stations_program_idx on public.portal_after_stations (program_id, station);
create index if not exists portal_after_stations_email_idx   on public.portal_after_stations (lower(email));
alter table public.portal_after_stations enable row level security;
drop policy if exists after_stations_self on public.portal_after_stations;
create policy after_stations_self on public.portal_after_stations for select
  using (user_id = auth.uid() or lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));   -- القراءة العامة المجهَّلة (k≥5) والكتابة عبر الخدمة فقط

-- تشخيص
select
  (select count(*) from information_schema.tables where table_schema = 'public' and table_name = 'portal_after_stations') as tables_1,
  (select count(*) from pg_policies where schemaname = 'public' and tablename = 'portal_after_stations' and policyname = 'after_stations_self') as policies_1,
  (select count(*) from pg_indexes where schemaname = 'public' and tablename = 'portal_after_stations' and indexname in ('portal_after_stations_program_idx','portal_after_stations_email_idx')) as idx_2;
