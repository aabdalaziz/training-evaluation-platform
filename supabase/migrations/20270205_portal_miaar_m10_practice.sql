-- =====================================================================
--  م10 «مِران» — تدريب ما بين الحكم والإعادة (Miaar Practice — guided retake preparation)
--  مِعيار — من أَثَر · © 2026 د. أحمد محمد عبدالعزيز بدوي
--
--  جدولان:
--   1) miaar_practice_plans   — خطّة 14 يومًا لكل تقرير عبور (مشروط/لم يجتز): الوحدات الضعيفة مرتّبة،
--                               الأيام jsonb (الوحدة · النوع drill/mirror · ملاحظة المدرّب نصًّا/صوتًا · الإنجاز)،
--                               الحالة draft → approved (بتوقيع إنسان) → done | cancelled. فريدة على report_id.
--   2) miaar_practice_attempts — كل إجابة تمرين (البند · الخيار · صواب) أو نصّ إنتاجي (payload).
--                               الفهرس (email, item_code) = «البنود المكشوفة» التي يستثنيها سحب الإعادة الرسمية.
--  لا درجة رسمية هنا: مِران تدريب لا اختبار. آمن لإعادة التشغيل (idempotent).
-- =====================================================================

create table if not exists public.miaar_practice_plans (
  id               uuid primary key default gen_random_uuid(),
  report_id        uuid not null,
  invite_id        uuid null,
  email            text not null,
  user_id          uuid null,
  level            text not null,
  skill            text null,                 -- مهارة الإعادة (إن وُجدت) · null = حكم «لم يجتز»
  units            text[] not null default '{}',
  days             jsonb not null default '[]'::jsonb,
  status           text not null default 'draft',   -- draft | approved | done | cancelled
  created_by       uuid null,
  approved_by      uuid null,
  approved_at      timestamptz null,
  start_date       date null,                 -- اليوم 1 (بتوقيت الرياض) = يوم الاعتماد
  last_attempt_at  timestamptz null,
  done_at          timestamptz null,
  cancelled_at     timestamptz null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create unique index if not exists mpp_report_uq on public.miaar_practice_plans (report_id);
create index if not exists mpp_email_idx on public.miaar_practice_plans (email, status);

create table if not exists public.miaar_practice_attempts (
  id          uuid primary key default gen_random_uuid(),
  plan_id     uuid not null references public.miaar_practice_plans (id) on delete cascade,
  email       text not null,
  day         int  not null,
  kind        text not null default 'item',   -- item | text
  item_code   text null,
  option_id   text null,
  correct     boolean null,
  payload     jsonb null,
  at          timestamptz not null default now()
);
create index if not exists mpa_exposure_idx on public.miaar_practice_attempts (email, item_code);
create index if not exists mpa_plan_idx on public.miaar_practice_attempts (plan_id, day);

comment on table public.miaar_practice_plans is 'م10 مِران — خطّة تدريب 14 يومًا بين الحكم والإعادة (الذكاء يقترح، الإنسان يعتمد؛ لا درجة رسمية)';
comment on table public.miaar_practice_attempts is 'م10 مِران — إجابات التمرين؛ (email,item_code) = بنود مكشوفة يستثنيها سحب الإعادة';

alter table public.miaar_practice_plans enable row level security;
alter table public.miaar_practice_attempts enable row level security;
-- لا سياسات للمجهول: الوصول كلّه عبر واجهات الخادم (service role) التي تتحقّق من رمز النتيجة أو من صلاحية الطاقم.

notify pgrst, 'reload schema';

-- تشخيص (المتوقّع: tbl=2 · uq=1 · idx=3 · rows=0)
select
  (select count(*) from information_schema.tables where table_schema = 'public' and table_name in ('miaar_practice_plans', 'miaar_practice_attempts')) as tbl,
  (select count(*) from pg_indexes where schemaname = 'public' and indexname = 'mpp_report_uq') as uq,
  (select count(*) from pg_indexes where schemaname = 'public' and indexname in ('mpp_email_idx', 'mpa_exposure_idx', 'mpa_plan_idx')) as idx,
  (select (select count(*) from public.miaar_practice_plans) + (select count(*) from public.miaar_practice_attempts)) as rows;
