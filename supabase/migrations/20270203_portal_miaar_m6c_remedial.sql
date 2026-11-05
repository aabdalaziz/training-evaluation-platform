-- =====================================================================
--  م6-ج «جلسة التعويض — من خريطة المنهج» — مِعيار — من أَثَر
--  يضيف (بلا جدول جديد):
--   1) portal_program_units.miaar_unit_codes text[] — ربط وحدة البرنامج بوحدات المستوى (خريطة المنهج)
--   2) portal_sessions: النوع الجديد 'remedial' · miaar_unit_codes text[] (وحدات الجلسة) · source_invite_id (دعوة العبور التي ولّدتها)
--  آمن لإعادة التشغيل (idempotent).
-- =====================================================================

-- 0) حارس الترتيب
do $$
begin
  if not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'miaar_syllabus_units') then
    raise exception 'مِعيار م6-ج: شغّل هجرة م6-ب أولًا (20270202_portal_miaar_m6b_syllabus.sql) — جدول miaar_syllabus_units مفقود';
  end if;
  if not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'portal_sessions') then
    raise exception 'مِعيار م6-ج: جدول portal_sessions مفقود (هجرة P6: 20261112_portal_p6.sql)';
  end if;
  if not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'portal_program_units') then
    raise exception 'مِعيار م6-ج: جدول portal_program_units مفقود (هجرة P46-ر4: 20270120_portal_p46r4_diploma.sql)';
  end if;
end $$;

-- 1) ربط وحدات البرنامج بوحدات المستوى
alter table public.portal_program_units add column if not exists miaar_unit_codes text[] null;
comment on column public.portal_program_units.miaar_unit_codes is 'م6-ج: رموز وحدات المستوى (خريطة المنهج) التي تغطّيها هذه الوحدة البرنامجية';
create index if not exists portal_program_units_miaar_units_idx on public.portal_program_units using gin (miaar_unit_codes);

-- 2) جلسات التعويض في التقويم
alter table public.portal_sessions add column if not exists miaar_unit_codes text[] null;
alter table public.portal_sessions add column if not exists source_invite_id uuid null;
comment on column public.portal_sessions.miaar_unit_codes is 'م6-ج: وحدات المستوى التي تعالجها جلسة التعويض';
comment on column public.portal_sessions.source_invite_id is 'م6-ج: دعوة اختبار نهاية المستوى التي وُلِّدت منها الجلسة (placement_invites.id)';
create index if not exists portal_sessions_source_invite_idx on public.portal_sessions (source_invite_id) where source_invite_id is not null;

-- 2-ب) توسيع قيد النوع ليشمل remedial (القيد القديم psn_kind_chk من P6)
alter table public.portal_sessions drop constraint if exists psn_kind_chk;
alter table public.portal_sessions add constraint psn_kind_chk check (kind in ('class','webinar','workshop','office_hours','remedial'));

-- PostgREST: أعد تحميل مخطّط الجداول حتى يرى الأعمدة فورًا
notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------
--  تشخيص: المتوقَّع  pu_col = 1 · ps_units = 1 · ps_src = 1 · kind_ok = 1
-- ---------------------------------------------------------------------
select
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'portal_program_units' and column_name = 'miaar_unit_codes') as pu_col,
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'portal_sessions' and column_name = 'miaar_unit_codes') as ps_units,
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'portal_sessions' and column_name = 'source_invite_id') as ps_src,
  (select count(*) from pg_constraint where conname = 'psn_kind_chk' and pg_get_constraintdef(oid) like '%remedial%') as kind_ok;
