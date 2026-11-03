-- © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
-- مِعيار — من أَثَر · م5-أ «سجلّ مِعيار»: إدارة النتائج (أرشفة · حذف فوري) · إذن الإعادة المربوط بالمحاولة السابقة · قرار التسكين (يدوي/تلقائي) المربوط ببرنامج وشعبة
-- آمن لإعادة التشغيل (idempotent). لا يحذف شيئًا ولا يغيّر نتائج قائمة. القراءة والكتابة بصلاحية الخدمة فقط (RLS من م1).
--
-- خيارات التسمية (بناءً على قاعدة «اشرح التسمية»):
--  · «السجلّ» (ledger): لأن الشاشة دفترٌ تُقيَّد فيه كل نتيجة وكل قرار عليها — لا «لوحة» ولا «تقارير».
--  · placement_decisions: جدولٌ وُلد في م1 (وراثةً من مِعيار القديم) بعمود report_id فريد ومحفّزَي الملء والأحداث، ولم يُستعمل قطّ —
--    نُحييه بدل إنشاء جدول جديد، فكلّ قرار له صفٌّ واحد وسجلّ أحداث (placement_decision_events) جاهز.
--  · test_retake_approvals: جدول «موافقة الإعادة» القائم؛ نزيده أعمدة بدل جدول «منح» جديد حتى يبقى canStart() كما هو (مسار الإطلاق لا يتغيّر).

-- 0) حارس الترتيب
do $$
begin
  if not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'miaar_performances') then
    raise exception 'مِعيار م5-أ: شغّل هجرة م4-ب أولًا (20270109_portal_miaar_m4b.sql) — جدول miaar_performances مفقود';
  end if;
  if not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'placement_decisions') then
    raise exception 'مِعيار م5-أ: شغّل هجرة م1 أولًا (20261217_portal_miaar_m1.sql) — جدول placement_decisions مفقود';
  end if;
end $$;

-- 1) النتيجة: أرشفة (تبقى البطاقة العلنية تعمل بشارة «نتيجة مؤرشفة») · ربط المحاولة بالسابقة · وسم المجموعة
alter table public.placement_reports add column if not exists archived_at timestamptz;
alter table public.placement_reports add column if not exists archived_by uuid;
alter table public.placement_reports add column if not exists archive_note text;
alter table public.placement_reports add column if not exists previous_report_id uuid references public.placement_reports(id) on delete set null;
alter table public.placement_reports add column if not exists group_tag text;
create index if not exists placement_reports_archived_idx on public.placement_reports (archived_at) where archived_at is not null;
create index if not exists placement_reports_invite_idx on public.placement_reports (invite_id, created_at desc);
create index if not exists placement_reports_group_idx on public.placement_reports (group_tag) where group_tag is not null;

-- 2) إذن الإعادة: مدّة صلاحية · السبب · نوع الإذن · الدعوة/البرنامج الذي صدر لأجله · المحاولة التي يُقارَن بها
alter table public.test_retake_approvals add column if not exists expires_at timestamptz;
alter table public.test_retake_approvals add column if not exists reason text;
alter table public.test_retake_approvals add column if not exists kind text not null default 'staff';
alter table public.test_retake_approvals add column if not exists invite_id uuid;
alter table public.test_retake_approvals add column if not exists program_id uuid;
alter table public.test_retake_approvals add column if not exists previous_report_id uuid references public.placement_reports(id) on delete set null;
alter table public.test_retake_approvals add column if not exists revoked_at timestamptz;
alter table public.test_retake_approvals drop constraint if exists test_retake_approvals_kind_chk;
alter table public.test_retake_approvals add constraint test_retake_approvals_kind_chk check (kind in ('staff','group','program_end'));
create index if not exists test_retake_approvals_open_idx on public.test_retake_approvals (lower(email)) where used_at is null and revoked_at is null;

-- 3) قرار التسكين: البرنامج والتسجيل والشعبة · المصدر (إنسان/تلقائي) · المهلة · سبب «المنطقة الرمادية»
alter table public.placement_decisions add column if not exists program_id uuid references public.programs(id) on delete set null;
alter table public.placement_decisions add column if not exists enrollment_id uuid references public.portal_enrollments(id) on delete set null;
alter table public.placement_decisions add column if not exists classroom_id uuid references public.classrooms(id) on delete set null;
alter table public.placement_decisions add column if not exists source text not null default 'staff';
alter table public.placement_decisions add column if not exists note text;
alter table public.placement_decisions add column if not exists deadline_at timestamptz;
alter table public.placement_decisions add column if not exists gray_reason text;
alter table public.placement_decisions add column if not exists notified_at timestamptz;
alter table public.placement_decisions drop constraint if exists placement_decisions_source_chk;
alter table public.placement_decisions add constraint placement_decisions_source_chk check (source in ('staff','auto'));
create index if not exists placement_decisions_status_idx on public.placement_decisions (decision_status, decided_at desc);
create index if not exists placement_decisions_program_idx on public.placement_decisions (program_id);

-- 4) الدعوة: مهلة قرار الإنسان قبل التسكين التلقائي (ساعات؛ null = لا تسكين تلقائي لهذه الدعوة) · خريطة «المستوى → البرنامج»
alter table public.placement_invites add column if not exists decision_deadline_hours int default 48;
alter table public.placement_invites add column if not exists level_programs jsonb not null default '{}'::jsonb;
alter table public.placement_invites drop constraint if exists placement_invites_deadline_chk;
alter table public.placement_invites add constraint placement_invites_deadline_chk check (decision_deadline_hours is null or decision_deadline_hours between 1 and 720);

-- 5) التسجيل الناتج عن قرار مِعيار يُعرَف بمصدره (source = 'miaar') — العمود قائم منذ P2؛ لا تغيير بنيويًّا. فهرس للبريد حتى يسرع «سجلّ المتقدّم»
create index if not exists portal_enrollments_email_idx on public.portal_enrollments (lower(email));

-- 6) تقرير التشخيص (يظهر في Results)
select
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'placement_reports' and column_name in ('archived_at','archived_by','archive_note','previous_report_id','group_tag')) as reports_cols_expected_5,
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'test_retake_approvals' and column_name in ('expires_at','reason','kind','invite_id','program_id','previous_report_id','revoked_at')) as retake_cols_expected_7,
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'placement_decisions' and column_name in ('program_id','enrollment_id','classroom_id','source','note','deadline_at','gray_reason','notified_at')) as decision_cols_expected_8,
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'placement_invites' and column_name in ('decision_deadline_hours','level_programs')) as invite_cols_expected_2,
  (select count(*) from public.placement_reports where archived_at is not null) as archived_reports_expected_0,
  (select count(*) from public.placement_decisions) as decisions_now;
