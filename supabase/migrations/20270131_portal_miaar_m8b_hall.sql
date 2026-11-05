-- © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
-- مِعيار — م8-ب «قاعة الشاهد»: المراقبة الإلكترونية صفةً أساسية لكل اختبار + مركز المراقبة الإلكترونية للاختبارات (Examination Proctoring Center)
--  1) إعدادات مِعيار (miaar_settings): «وضع المراقبة الافتراضي» لكل الاختبارات = قاعة + شاهِد (camera) — يُغيَّر من القاعة
--  2) الدعوة: proctor_mode يصبح اختياريًّا (null = الافتراضي العام) + حقل «المكان» location («فرع جدة — قاعة 2»)
--  3) الجلسة: proctor_mode يُثبَّت عند البدء (فلا يعتمد الشاهد على وجود دعوة — الاختبار الفردي مشمول)
--  آمن للتكرار. المتوقَّع في النهاية: session_col=1 · invite_location=1 · settings_table=1
begin;

-- 1) الإعدادات
create table if not exists public.miaar_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by text null
);
alter table public.miaar_settings enable row level security;
revoke all on public.miaar_settings from anon, authenticated;
insert into public.miaar_settings (key, value) values ('witness_default_mode', '"camera"'::jsonb) on conflict (key) do nothing;

-- 2) الدعوة
alter table public.placement_invites alter column proctor_mode drop not null;
alter table public.placement_invites alter column proctor_mode drop default;
alter table public.placement_invites drop constraint if exists placement_invites_proctor_mode_chk;
alter table public.placement_invites add constraint placement_invites_proctor_mode_chk check (proctor_mode is null or proctor_mode in ('room','camera','remote'));
-- ما أُنشئ قبل اليوم بقيمة 'room' لم يُختَر صراحةً (كانت افتراض م8) → يتبع الافتراضي العام
update public.placement_invites set proctor_mode = null where proctor_mode = 'room' and created_at < timestamptz '2026-11-05 06:00:00+03';
alter table public.placement_invites add column if not exists location text null;

-- 3) الجلسة
alter table public.placement_secure_sessions add column if not exists proctor_mode text null;
alter table public.placement_secure_sessions drop constraint if exists placement_secure_sessions_proctor_mode_chk;
alter table public.placement_secure_sessions add constraint placement_secure_sessions_proctor_mode_chk check (proctor_mode is null or proctor_mode in ('room','camera','remote'));
create index if not exists placement_secure_sessions_live_idx on public.placement_secure_sessions (status, expires_at) where status = 'active';

commit;

notify pgrst, 'reload schema';

-- تشخيص (المتوقَّع: session_col=1 · invite_location=1 · settings_table=1)
select
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'placement_secure_sessions' and column_name = 'proctor_mode') as session_col,
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'placement_invites' and column_name = 'location') as invite_location,
  (select count(*) from information_schema.tables where table_schema = 'public' and table_name = 'miaar_settings') as settings_table;
