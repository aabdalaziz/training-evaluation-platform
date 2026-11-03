-- © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
-- =====================================================================================
--  P46 «محور التقارير» — توثيق الجودة والأداء (ر1: تقرير التعلّم الأسبوعي)
--  التقرير لا يُكتب من فراغ: أرقامه (المسجَّلون · المنتظمون · الجلسات والساعات · الحضور لكل متدرّب) تُلتقط من قاعدة أَثَر
--  لحظة إنشائه (computed)، ويكتب الإنسان الحكم والتوصية (body · students). الاعتماد بيد مدير البرنامج/الطاقم، وله رمز تحقّق عام.
--  «سطر لك من تقرير الأسبوع»: جملة خاصة لكل متدرّب تُرسَل بعد الاعتماد بإذن المعلّم (lines).
--  آمن لإعادة التشغيل (idempotent).
-- =====================================================================================

-- 1) قالب التقرير لكل برنامج (المهارات والاستراتيجيات) — الافتراضي في الكود حسب نوع البرنامج (arabic: استماع · تحدّث · نطق · قراءة · كتابة)
create table if not exists public.portal_report_templates (
  program_id   uuid primary key references public.programs(id) on delete cascade,
  kind         text not null default 'weekly',
  skills       jsonb not null default '[]'::jsonb,        -- [{code, name_ar}]
  strategies   jsonb not null default '[]'::jsonb,        -- ["…"]
  updated_at   timestamptz not null default now(),
  updated_by   uuid null
);
alter table public.portal_report_templates enable row level security;
drop policy if exists report_templates_read on public.portal_report_templates;
create policy report_templates_read on public.portal_report_templates for select to authenticated using (true);
-- الكتابة عبر الخادم فقط (service role)

-- 2) التقارير
create table if not exists public.portal_reports (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  kind           text not null default 'weekly',                 -- weekly | final | mission | diploma_pulse | diploma_unit | diploma_profile (ر2–ر4 لاحقًا)
  program_id     uuid not null references public.programs(id) on delete cascade,
  classroom_id   uuid null,                                      -- الشعبة/القاعة (قد يكون التقرير على مستوى البرنامج)
  author_id      uuid null references auth.users(id) on delete set null,
  author_email   text not null,
  author_name    text not null default '',
  week_no        int  not null default 1,
  period_from    date not null,
  period_to      date not null,
  status         text not null default 'draft',                  -- draft | submitted | approved | returned
  computed       jsonb not null default '{}'::jsonb,             -- لقطة الأرقام من القاعدة (تُحدَّث بـ«حدّث الأرقام» حتى الإرسال)
  body           jsonb not null default '{}'::jsonb,             -- ما كتبه الإنسان (الأقسام الثمانية)
  students       jsonb not null default '[]'::jsonb,             -- كشف الطلاب: الحضور (محسوب) · الدرجات لكل مهارة · التقدير · ملاحظة
  lines          jsonb not null default '[]'::jsonb,             -- «سطر لك»: [{email, name, text}] — تُرسَل بعد الاعتماد إن أذن المعلّم
  lines_ok       boolean not null default false,
  submitted_at   timestamptz null,
  approved_by    uuid null,
  approved_name  text null,
  approved_at    timestamptz null,
  return_note    text null,
  verify_code    text null unique,
  lines_sent_at  timestamptz null,
  constraint portal_reports_kind_chk   check (kind in ('weekly','final','mission','diploma_pulse','diploma_unit','diploma_profile')),
  constraint portal_reports_status_chk check (status in ('draft','submitted','approved','returned')),
  constraint portal_reports_period_chk check (period_to >= period_from)
);
create index if not exists portal_reports_program_idx on public.portal_reports (program_id, classroom_id, period_from desc);
create index if not exists portal_reports_author_idx  on public.portal_reports (lower(author_email), created_at desc);
create index if not exists portal_reports_status_idx  on public.portal_reports (status, submitted_at desc);
create unique index if not exists portal_reports_period_uniq on public.portal_reports (kind, program_id, coalesce(classroom_id::text, ''), period_from);
alter table public.portal_reports enable row level security;
drop policy if exists reports_author_read on public.portal_reports;
create policy reports_author_read on public.portal_reports for select to authenticated
  using (author_id = auth.uid() or public.portal_is_staff());
-- الكتابة عبر الخادم فقط (service role)

-- 3) «سطر لك من تقرير الأسبوع» — ما وصل كل متدرّب (خاص به)
create table if not exists public.portal_report_lines (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  report_id   uuid not null references public.portal_reports(id) on delete cascade,
  program_id  uuid not null,
  user_id     uuid null,
  email       text not null,
  text_ar     text not null,
  week_no     int  not null default 1,
  period_to   date not null,
  constraint portal_report_lines_text_chk check (char_length(text_ar) between 3 and 300)
);
create unique index if not exists portal_report_lines_uniq on public.portal_report_lines (report_id, email);   -- البريد يُخزَّن صغيرًا من الخادم
create index if not exists portal_report_lines_email_idx on public.portal_report_lines (lower(email), created_at desc);
alter table public.portal_report_lines enable row level security;
drop policy if exists report_lines_self_read on public.portal_report_lines;
create policy report_lines_self_read on public.portal_report_lines for select to authenticated
  using (user_id = auth.uid() or lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')) or public.portal_is_staff());
-- الكتابة عبر الخادم فقط (service role)

-- =====================================================================================
--  تشخيص — المتوقَّع: tables_3 = 3 · policies_3 = 3 · period_uniq_1 = 1 · reports_0 = 0 · arabic_programs_now = عدد برامج العربية (للمعلومة)
-- =====================================================================================
select
  (select count(*) from information_schema.tables where table_schema = 'public' and table_name in ('portal_report_templates','portal_reports','portal_report_lines')) as tables_3,
  (select count(*) from pg_policies where schemaname = 'public' and policyname in ('report_templates_read','reports_author_read','report_lines_self_read')) as policies_3,
  (select count(*) from pg_indexes where schemaname = 'public' and indexname = 'portal_reports_period_uniq') as period_uniq_1,
  (select count(*) from public.portal_reports) as reports_0,
  (select count(*) from public.programs where program_type = 'arabic') as arabic_programs_now;
