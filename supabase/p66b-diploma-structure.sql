-- © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
-- P66-ب «مقرّرات الدبلوم — لكل مقرّر أستاذه» — الاسم الرسمي: هيكل الدبلوم: المستويات والمقرّرات والشُّعب وأساتذة المواد
--   (Diploma structure: levels · courses · sections · course instructors)
-- التسلسل المعتمد: اسم الدبلوم : المستوى الدراسي — المقرّر — الشعبة (1، 2، 3…) — أستاذ المادة
-- لا يُنشئ جدولًا للمحاضرات: المحاضرة = صفّ في portal_sessions (P6) تولّده الخادم من سطر الجدول (series_id = سطر الجدول).
-- التشغيل: Supabase → SQL Editor → New query → الصق → Run. آمن للتكرار (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).

-- 1) الدبلوم: لا أوقات مثبَّتة — المشرف يُعدّ الجدول بالعرف الأكاديمي. هذه القيم اختيارية (فارغة افتراضيًا) تُستعمل فقط لتعبئة النموذج مسبقًا إن حدّدها المشرف.
alter table public.programs add column if not exists lecture_minutes   int  check (lecture_minutes between 20 and 300);   -- فارغ = يكتبه المشرف في كل سطر جدول (قد يكون 50 لمقرّر و110 لآخر)
alter table public.programs add column if not exists lecture_break_min int  check (lecture_break_min between 0 and 60);
alter table public.programs add column if not exists first_lecture_at  time;                                              -- فارغ = لا افتراض صباحي/مسائي
alter table public.programs add column if not exists levels_count      int  not null default 0 check (levels_count between 0 and 8);  -- 0 = ليس دبلومًا بمستويات

-- 1-ب) فترات خاصّة (رمضان، الاختبارات، الصيف…): تغيّر المدّة ووقت البدء لكل محاضرات الدبلوم ضمن مدى تاريخي — بلا لمس الجدول الأصلي
create table if not exists public.portal_schedule_periods (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  program_id       uuid not null references public.programs(id) on delete cascade,
  name_ar          text not null,                                                 -- «شهر رمضان 1448»
  from_day         date not null,
  to_day           date not null,
  lecture_minutes  int  check (lecture_minutes between 20 and 300),                -- فارغ = كما في السطر
  lecture_break_min int check (lecture_break_min between 0 and 60),
  first_lecture_at time,                                                           -- فارغ = كما في السطر
  shift_minutes    int  not null default 0 check (shift_minutes between -720 and 720),  -- إزاحة كل المحاضرات (مثلًا +300 دقيقة في رمضان)
  updated_by       uuid,
  constraint portal_schedule_periods_span check (to_day >= from_day)
);
create index if not exists portal_schedule_periods_prog_idx on public.portal_schedule_periods (program_id, from_day, to_day);
alter table public.portal_schedule_periods enable row level security;
drop policy if exists "schedule_periods_read" on public.portal_schedule_periods;
create policy "schedule_periods_read" on public.portal_schedule_periods for select to authenticated using (true);
revoke insert, update, delete on public.portal_schedule_periods from anon, authenticated;

-- 2) المقرّر = وحدة الدبلوم (P46-ر4) + المستوى + أستاذ المادة الافتراضي
alter table public.portal_program_units add column if not exists level_no   int  check (level_no between 1 and 8);
alter table public.portal_program_units add column if not exists trainer_id uuid references public.trainers(id) on delete set null;
alter table public.portal_program_units add column if not exists code       text;   -- رمز المقرّر الرسمي إن وُجد (مثل EDU-203)
create index if not exists portal_program_units_level_idx on public.portal_program_units (program_id, level_no, idx);

-- 3) جدول المحاضرات: سطر واحد = المقرّر × الشعبة × أستاذ المادة × اليوم × رقم المحاضرة/وقتها × المدّة × من/إلى
create table if not exists public.portal_unit_schedules (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  program_id     uuid not null references public.programs(id) on delete cascade,
  unit_id        uuid not null references public.portal_program_units(id) on delete cascade,
  classroom_id   uuid not null references public.classrooms(id) on delete cascade,
  trainer_id     uuid references public.trainers(id) on delete set null,          -- فارغ = أستاذ المادة الافتراضي للمقرّر
  weekday        int  not null check (weekday between 0 and 6),                    -- 0 الأحد … 6 السبت
  period_no      int  not null default 1 check (period_no between 1 and 8),        -- المحاضرة الأولى/الثانية/الثالثة…
  starts_at      time not null,                                                    -- يكتبه المشرف (العرف الأكاديمي) — لا حساب تلقائي إلا كتعبئة مسبقة للنموذج
  minutes        int  not null check (minutes between 20 and 300),                 -- مدّة محاضرة هذا المقرّر (50 أو 110 أو غيرها) — الفترات الخاصّة تتجاوزها زمنيًا
  from_day       date not null,
  to_day         date not null,
  room_ar        text,                                                             -- القاعة (اختياري)
  provider       text not null default 'athar' check (provider in ('teams','zoom','meet','athar','other')),  -- حضوري = athar
  generated_at   timestamptz,                                                      -- آخر توليد للمحاضرات في portal_sessions
  updated_by     uuid,
  constraint portal_unit_schedules_span check (to_day >= from_day)
);
create index if not exists portal_unit_schedules_room_idx    on public.portal_unit_schedules (classroom_id, weekday, period_no);
create index if not exists portal_unit_schedules_unit_idx    on public.portal_unit_schedules (unit_id);
create index if not exists portal_unit_schedules_trainer_idx on public.portal_unit_schedules (trainer_id);
alter table public.portal_unit_schedules enable row level security;
drop policy if exists "unit_schedules_read" on public.portal_unit_schedules;
create policy "unit_schedules_read" on public.portal_unit_schedules for select to authenticated using (true);   -- الجدول معلومة تنظيمية لا شخصية
revoke insert, update, delete on public.portal_unit_schedules from anon, authenticated;                       -- الكتابة من الخادم فقط

-- 4) المحاضرات المولَّدة تعرف سطرها ومقرّرها
alter table public.portal_sessions add column if not exists unit_id uuid references public.portal_program_units(id) on delete set null;
create index if not exists psn_unit_idx on public.portal_sessions (unit_id, starts_at);

-- 5) سطر المتدرّب يعرف مقرّره (يوم فيه محاضرتان من مقرّرين = سطران)
alter table public.portal_learning_lines add column if not exists unit_id uuid references public.portal_program_units(id) on delete set null;
alter table public.portal_learning_lines drop constraint if exists portal_learning_lines_one;
create unique index if not exists portal_learning_lines_one_idx on public.portal_learning_lines (user_id, classroom_id, kind, day, coalesce(unit_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- 6) طلب نقل الشعبة (لا تنفيذ تلقائي — التسكين بأداة التسكين الموجودة)
create table if not exists public.portal_section_requests (
  id             bigserial primary key,
  created_at     timestamptz not null default now(),
  user_id        uuid not null,
  email          text not null,
  program_id     uuid not null references public.programs(id) on delete cascade,
  enrollment_id  uuid,
  from_classroom uuid references public.classrooms(id) on delete set null,
  to_classroom   uuid references public.classrooms(id) on delete set null,     -- فارغ = «أي شعبة أخرى»
  reason_ar      text not null check (char_length(reason_ar) between 5 and 200),
  status         text not null default 'open' check (status in ('open','done','declined')),
  decided_by     uuid,
  decided_at     timestamptz,
  note_ar        text
);
create index if not exists portal_section_requests_prog_idx on public.portal_section_requests (program_id, status, created_at desc);
alter table public.portal_section_requests enable row level security;
drop policy if exists "section_requests_owner_read" on public.portal_section_requests;
create policy "section_requests_owner_read" on public.portal_section_requests for select to authenticated using (auth.uid() = user_id);
revoke insert, update, delete on public.portal_section_requests from anon, authenticated;

comment on table public.portal_unit_schedules is 'P66-ب هيكل الدبلوم — سطر جدول: المقرّر × الشعبة × أستاذ المادة × اليوم × المحاضرة. المحاضرات الفعلية تُولَّد في portal_sessions (series_id = id).';
comment on table public.portal_section_requests is 'P66-ب طلب نقل شعبة من المتدرّب — يقرّره المنسّق/الإدارة ويُنفَّذ بأداة التسكين.';

-- ─── تشخيص متوقَّع بعد التشغيل ───
-- select count(*) from information_schema.columns where table_name = 'programs' and column_name in ('lecture_minutes','lecture_break_min','first_lecture_at','levels_count');  -- 4
-- select count(*) from information_schema.columns where table_name = 'portal_program_units' and column_name in ('level_no','trainer_id','code');                                 -- 3
-- select count(*) from information_schema.columns where table_name = 'portal_unit_schedules';                                                                                      -- 18
-- select count(*) from pg_indexes where tablename = 'portal_unit_schedules';                                                                                                       -- 4  (pkey + room + unit + trainer)
-- select count(*) from pg_indexes where tablename = 'portal_learning_lines' and indexname = 'portal_learning_lines_one_idx';                                                       -- 1
-- select count(*) from information_schema.columns where table_name = 'portal_sessions' and column_name = 'unit_id';                                                               -- 1
-- select count(*) from information_schema.columns where table_name = 'portal_section_requests';                                                                                    -- 14
-- select count(*) from pg_policies where tablename in ('portal_unit_schedules','portal_section_requests','portal_schedule_periods');                                               -- 3
-- select count(*) from information_schema.columns where table_name = 'portal_schedule_periods';                                                                                   -- 11
