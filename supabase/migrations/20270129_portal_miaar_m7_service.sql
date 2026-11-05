-- © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
-- مِعيار — م7 «عُبور للجهات»: خدمة الاختبار المعياري (CEFR) لمجموعات من خارج البرامج (Level Exit Examination — Institutional Service)
--  1) أعمدة الدعوة: الجهة الطالبة (client_name/client_contact) · وضع الخدمة (service_mode) · رمز القاعة (proctor_pin_hash) · رابط بوابة الجهة (client_token_hash) · وضع الهوية (identity_mode)
--  2) جدول سجلّ الخدمة miaar_service_orders (مقاعد مقرّرة/مستهلكة · حالة · ختم المراقب · أحداث) — خادم فقط (service_role)
--  3) placement_reports.source ('internal'|'external') لعزل نتائج الخارج عن مؤشرات البرامج
--  الاختبار نفسه (SYS-EXIT-*) لا يتغيّر — المعيارية تقتضي أن يكون اختبار الخارج عين اختبار الداخل.
--  آمن للتكرار. المتوقَّع في النهاية: invite_cols=6 · service_table=1 · report_source_col=1
begin;

-- 1) أعمدة الدعوة
alter table public.placement_invites add column if not exists client_name text null;
alter table public.placement_invites add column if not exists client_contact text null;
alter table public.placement_invites add column if not exists service_mode text not null default 'internal';
alter table public.placement_invites add column if not exists proctor_pin_hash text null;
alter table public.placement_invites add column if not exists client_token_hash text null;
alter table public.placement_invites add column if not exists identity_mode text not null default 'email';
alter table public.placement_invites drop constraint if exists placement_invites_service_mode_chk;
alter table public.placement_invites add constraint placement_invites_service_mode_chk check (service_mode in ('internal','external'));
alter table public.placement_invites drop constraint if exists placement_invites_identity_mode_chk;
alter table public.placement_invites add constraint placement_invites_identity_mode_chk check (identity_mode in ('email','email_id'));
create unique index if not exists placement_invites_client_token_uq on public.placement_invites (client_token_hash) where client_token_hash is not null;

-- 2) سجلّ الخدمة
create table if not exists public.miaar_service_orders (
  id uuid primary key default gen_random_uuid(),
  invite_id uuid not null unique references public.placement_invites(id) on delete cascade,
  client_name text not null,
  client_contact text null,
  level text not null check (level in ('A1','A2','B1','B2','C1')),
  seats integer null check (seats is null or seats > 0),
  seats_used integer not null default 0,
  status text not null default 'prepared' check (status in ('prepared','open','rating','delivered','invoiced','cancelled')),
  note text null,
  proctor_name text null,
  proctor_signed_at timestamptz null,
  proctor_signed_by text null,
  delivered_at timestamptz null,
  invoiced_at timestamptz null,
  events jsonb not null default '[]'::jsonb,
  created_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists miaar_service_orders_status_idx on public.miaar_service_orders (status, created_at desc);
alter table public.miaar_service_orders enable row level security;
revoke all on public.miaar_service_orders from anon, authenticated;
grant all on public.miaar_service_orders to service_role;

-- 3) مصدر التقرير
alter table public.placement_reports add column if not exists source text not null default 'internal';
alter table public.placement_reports drop constraint if exists placement_reports_source_chk;
alter table public.placement_reports add constraint placement_reports_source_chk check (source in ('internal','external'));
create index if not exists placement_reports_source_idx on public.placement_reports (source) where source <> 'internal';

commit;

notify pgrst, 'reload schema';

-- تشخيص (المتوقَّع: invite_cols=6 · service_table=1 · report_source_col=1)
select
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'placement_invites' and column_name in ('client_name','client_contact','service_mode','proctor_pin_hash','client_token_hash','identity_mode')) as invite_cols,
  (select count(*) from information_schema.tables where table_schema = 'public' and table_name = 'miaar_service_orders') as service_table,
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'placement_reports' and column_name = 'source') as report_source_col;
