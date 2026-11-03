-- © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
-- =====================================================================================
--  P46 ر3 — «محور التقارير» (توثيق الجودة والأداء): تقرير إنجاز المهمة («أثرُ المهمة») للخبير/المستشار/المدرّب المتعاقد
--  لا جدول جديد — التقرير يسكن portal_reports (kind = 'mission') ويرتبط بعقد التعاون (هيئة أَثَر P31):
--   1) program_id يصبح اختياريًا (المهمة قد لا تخصّ برنامجًا)
--   2) engagement_id → portal_directory_engagements (تقرير إنجاز واحد لكل عقد)
--   3) ack_token: رمز «إقرار الجهة» (رابط بلا دخول يُرسله الطاقم بعد الاعتماد) — لا يُقرأ إلا بمفتاح الخدمة
--  آمنة للتكرار. التشخيص المتوقَّع: program_nullable_1 = 1 · cols_2 = 2 · mission_idx_1 = 1 · mission_reports_0 = 0
-- =====================================================================================

alter table public.portal_reports alter column program_id drop not null;
alter table public.portal_reports add column if not exists engagement_id uuid null references public.portal_directory_engagements(id) on delete set null;
alter table public.portal_reports add column if not exists ack_token text null;

-- تقرير إنجاز واحد لكل عقد تعاون
create unique index if not exists portal_reports_mission_src_idx on public.portal_reports (engagement_id) where kind = 'mission' and engagement_id is not null;
create index if not exists portal_reports_engagement_idx on public.portal_reports (engagement_id) where engagement_id is not null;

-- =====================================================================================
--  تشخيص — المتوقَّع: program_nullable_1 = 1 · cols_2 = 2 · mission_idx_1 = 1 · mission_reports_0 = 0
-- =====================================================================================
select
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'portal_reports' and column_name = 'program_id' and is_nullable = 'YES') as program_nullable_1,
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'portal_reports' and column_name in ('engagement_id','ack_token')) as cols_2,
  (select count(*) from pg_indexes where schemaname = 'public' and indexname = 'portal_reports_mission_src_idx') as mission_idx_1,
  (select count(*) from public.portal_reports where kind = 'mission') as mission_reports_0;
