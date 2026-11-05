-- © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
-- مِعيار — م8 «شاهِد»: سجلّ نزاهة الاختبار — مراقبة مصوَّرة (Examination Integrity Record · photo proctoring)
--  1) الدعوة: وضع المراقبة proctor_mode (room قاعة بمراقب · camera قاعة + شاهِد · remote عن بُعد) + فاصل اللقطات witness_interval (ثوانٍ)
--  2) جدول أحداث الشاهد miaar_witness_events (لقطات · مغادرة اللسان · فقدان التركيز · ملء الشاشة · الكاميرا · همسة المراقب · الحكم) — خادم فقط
--  3) التقرير: حكم الشاهد integrity_status (pending|clear|note|invalid) + الملاحظة + الموقّع + الوقت — يوقّعه إنسان دائمًا
--  الصور تُحفظ في الدلو الخاص miaar-media تحت witness/<session>/ وتُحذف بعد 90 يومًا (كسولًا — بلا كرون)؛ الأحداث والحكم يبقيان.
--  آمن للتكرار. المتوقَّع في النهاية: invite_cols=2 · witness_table=1 · report_cols=4
begin;

-- 1) الدعوة
alter table public.placement_invites add column if not exists proctor_mode text not null default 'room';
alter table public.placement_invites drop constraint if exists placement_invites_proctor_mode_chk;
alter table public.placement_invites add constraint placement_invites_proctor_mode_chk check (proctor_mode in ('room','camera','remote'));
alter table public.placement_invites add column if not exists witness_interval integer null;
alter table public.placement_invites drop constraint if exists placement_invites_witness_interval_chk;
alter table public.placement_invites add constraint placement_invites_witness_interval_chk check (witness_interval is null or (witness_interval between 20 and 90));

-- 2) أحداث الشاهد
create table if not exists public.miaar_witness_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  invite_id uuid null,
  seq integer not null default 0,
  kind text not null,
  at timestamptz not null default now(),
  media_path text null,
  meta jsonb not null default '{}'::jsonb,
  constraint miaar_witness_events_kind_chk check (kind in ('frame','identity_frame','tab_hidden','focus_lost','fullscreen_exit','camera_lost','camera_back','still_frame','screen_extended','paste','section_start','whisper','verdict'))
);
create index if not exists miaar_witness_events_session_idx on public.miaar_witness_events (session_id, at);
create index if not exists miaar_witness_events_media_idx on public.miaar_witness_events (at) where media_path is not null;
alter table public.miaar_witness_events enable row level security;
-- لا سياسات: الوصول عبر service_role من الخادم فقط (الصور بيانات حسّاسة)
revoke all on public.miaar_witness_events from anon, authenticated;

-- 3) حكم الشاهد في التقرير
alter table public.placement_reports add column if not exists integrity_status text null;
alter table public.placement_reports drop constraint if exists placement_reports_integrity_chk;
alter table public.placement_reports add constraint placement_reports_integrity_chk check (integrity_status is null or integrity_status in ('pending','clear','note','invalid'));
alter table public.placement_reports add column if not exists integrity_note text null;
alter table public.placement_reports add column if not exists integrity_by text null;
alter table public.placement_reports add column if not exists integrity_at timestamptz null;
create index if not exists placement_reports_integrity_idx on public.placement_reports (integrity_status) where integrity_status = 'pending';

commit;

notify pgrst, 'reload schema';

-- تشخيص (المتوقَّع: invite_cols=2 · witness_table=1 · report_cols=4)
select
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'placement_invites' and column_name in ('proctor_mode','witness_interval')) as invite_cols,
  (select count(*) from information_schema.tables where table_schema = 'public' and table_name = 'miaar_witness_events') as witness_table,
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'placement_reports' and column_name in ('integrity_status','integrity_note','integrity_by','integrity_at')) as report_cols;
