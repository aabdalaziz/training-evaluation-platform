-- © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
-- =====================================================================================
--  P36 «أَثَر معك — ذاكرة الهواء» — ترحيل واحد
--  (1) سجلّ الموسم  (2) موسم بالإشارة  (3) أمانة متسلسلة → سؤال الأسبوع  (4) خريطة الزمن للجهة (بلا جداول — من سجلّ الحضور القائم)
--  آمن لإعادة التشغيل. بلا بيانات تجريبية. بلا كرون جديد. الكتابة كلها بمفتاح الخدمة عبر /api/onair و/api/admin/onair.
-- =====================================================================================

-- 1) سجلّ الموسم: لقطة مجمَّدة (مجهَّلة) تُكتب مرة بعد انتهاء الموسم — قبل أن يُحذف سجلّ الحضور بعد 90 يومًا
alter table public.portal_onair_seasons add column if not exists record_json  jsonb;
alter table public.portal_onair_seasons add column if not exists recorded_at  timestamptz;

-- 2) موسم بالإشارة: ساعة الجهة قد تكون «بالإشارة» مع مترجم معتمَد (لا تُحتسب في السجلّ إلا بحضوره الفعلي)
alter table public.portal_onair_season_slots add column if not exists sign_language        boolean not null default false;
alter table public.portal_onair_season_slots add column if not exists interpreter_user_id  uuid;

-- 3) أمانة متسلسلة → سؤال الأسبوع: أمانة انقضت (72 ساعة بلا مستلم) وأذن كاتبها (meta.may_publish) واعتمدها إنسان من الطاقم
create table if not exists public.portal_onair_week_questions (
  id                 bigserial primary key,
  source_request_id  bigint references public.portal_onair_requests(id) on delete set null,
  text_ar            text not null,
  domain             text,
  status             text not null default 'queued' check (status in ('queued','published','retired','rejected')),
  week_start         date,
  approved_by        uuid,
  approved_at        timestamptz,
  created_at         timestamptz not null default now()
);
alter table public.portal_onair_week_questions enable row level security;
drop policy if exists onair_week_questions_public on public.portal_onair_week_questions;
create policy onair_week_questions_public on public.portal_onair_week_questions for select using (status = 'published');

create table if not exists public.portal_onair_week_answers (
  id             bigserial primary key,
  question_id    bigint not null references public.portal_onair_week_questions(id) on delete cascade,
  user_id        uuid not null,
  role_label_ar  text not null,            -- «خبير استشاري» · «مدرب» · «مترجم لغة إشارة» · «طاقم أَثَر» — الدور لا الاسم
  text_ar        text not null,
  created_at     timestamptz not null default now(),
  constraint portal_onair_week_answers_uniq unique (question_id, user_id)
);
create index if not exists portal_onair_week_answers_q_idx on public.portal_onair_week_answers (question_id);
alter table public.portal_onair_week_answers enable row level security;
drop policy if exists onair_week_answers_public on public.portal_onair_week_answers;
create policy onair_week_answers_public on public.portal_onair_week_answers for select
  using (exists (select 1 from public.portal_onair_week_questions q where q.id = question_id and q.status = 'published'));

-- 4) خريطة الزمن للجهة: لا تغيير — تُحسب من portal_onair_presence_log (P35) لمنسوبي الجهة بالخدمة وحدها

-- =====================================================================================
--  تشخيص (المتوقَّع: cols_4 = 4 · tables_2 = 2 · policies_2 = 2)
-- =====================================================================================
select
  (select count(*) from information_schema.columns where table_schema = 'public' and ((table_name = 'portal_onair_seasons' and column_name in ('record_json','recorded_at')) or (table_name = 'portal_onair_season_slots' and column_name in ('sign_language','interpreter_user_id')))) as cols_4,
  (select count(*) from information_schema.tables where table_schema = 'public' and table_name in ('portal_onair_week_questions','portal_onair_week_answers')) as tables_2,
  (select count(*) from pg_policies where tablename in ('portal_onair_week_questions','portal_onair_week_answers')) as policies_2;
