-- «اقْرَأْ — من أَثَر» — الخطوة 2: قالب المَنزِلة المهاري · الحلقة بخمس محطّات · «ساعاتي» · مكتبة الرِّواق
-- © 2026 د. أحمد محمد عبدالعزيز بدوي — جميع الحقوق محفوظة.
-- يُشغَّل مرّة واحدة في محرّر SQL (آمن للتكرار). يفترض وجود جداول ق1 (iqra-q1.sql).
-- لا يمسّ أيّ جدول تقييم أو شهادة. لا أسماء في أيّ رقم جماعي (k ≥ 5 يُطبَّق في الكود).

-- 0) حارس: ق1 موجودة
do $$ begin
  if not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'iqra_lessons') then
    raise exception 'اقْرَأْ الخطوة 2: شغّل iqra-q1.sql أولًا';
  end if;
end $$;

-- 1) الحلقة تحمل مهارتها وعقدها مع الإطار الأوروبي
--    skill: listen (أسمع وأفهم) · read (أقرأ وأفهم) · grammar (أبني الجملة) · speak (أتحدّث) · write (أكتب وأُتقن)
--    can_do_ar/en: جملة «أستطيع أن…» بالعربية والإنجليزية · descriptor_codes: أكواد الواصفات (مثل A1-LU-03) · domain: شخصي|عام|تعليمي|مهني
--    minutes_total: زمن الحلقة الكامل على كلّ محطّاتها (≈ 120 د) — يبقى minutes (ق1) لزمن الزيارة الواحدة
alter table public.iqra_lessons
  add column if not exists skill text null check (skill is null or skill in ('listen','read','grammar','speak','write')),
  add column if not exists can_do_ar text not null default '',
  add column if not exists can_do_en text not null default '',
  add column if not exists descriptor_codes text[] not null default '{}',
  add column if not exists domain text not null default 'شخصي',
  add column if not exists minutes_total smallint not null default 120;
create index if not exists iqra_lessons_skill_idx on public.iqra_lessons(unit_code, skill);

-- 2) «ساعاتي»: سجلّ الزمن النشط — صفّ واحد لكلّ (متعلّم · يوم · نشاط)، يُجمَّع بالثواني
--    activity: lesson (محطّات الحلقة) · review (أراجع) · daily (سؤال اليوم) · library (مكتبة الرِّواق) · free (مِران حرّ)
--              · produce (أُنتج) · external (خارج أَثَر — يسجّله المتعلّم بنفسه؛ يُعرض منفصلًا ولا يُحتسب في العَتَبة)
create table if not exists public.iqra_time_log (
  id uuid primary key default gen_random_uuid(),
  learner_email text not null,
  user_id uuid null,
  level text not null check (level in ('PRE_A1','A1','A2','B1','B2','C1','C2')),
  day date not null,
  activity text not null check (activity in ('lesson','review','daily','library','free','produce','external')),
  seconds int not null default 0 check (seconds between 0 and 86400),
  note text null,                                                 -- لـ external فقط (كتاب · درس خصوصي)
  updated_at timestamptz not null default now(),
  unique (learner_email, level, day, activity)
);
create index if not exists iqra_time_log_learner_idx on public.iqra_time_log(learner_email, level, day desc);
alter table public.iqra_time_log enable row level security;
revoke all on public.iqra_time_log from anon, authenticated;

-- 3) مكتبة الرِّواق: نصوص قراءة/استماع موسَّعة متدرّجة لكلّ منزلة (25–30 د بأسئلة) — مسوَّدة → معتمدة كالحلقات
create table if not exists public.iqra_library (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,                                      -- A1-U01-R01 (قراءة) · A1-U01-A01 (استماع)
  unit_code text not null references public.miaar_syllabus_units(code),
  level text not null check (level in ('PRE_A1','A1','A2','B1','B2','C1','C2')),
  kind text not null check (kind in ('read','listen')),
  title_ar text not null,
  body_ar text not null,                                          -- مشكول كاملًا في A1–A2
  minutes smallint not null default 25,
  questions jsonb not null default '[]'::jsonb,                   -- [{q, options[4], correct, explanation_ar}]
  descriptor_codes text[] not null default '{}',
  status text not null default 'draft' check (status in ('draft','in_review','approved','archived')),
  version text not null default 'iqra-s2',
  reviewed_by text null, reviewed_at timestamptz null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists iqra_library_unit_idx on public.iqra_library(unit_code, status);
alter table public.iqra_library enable row level security;
revoke all on public.iqra_library from anon, authenticated;

-- 4) تقدّم المكتبة والمِران الحرّ: يُسجَّل في iqra_progress بمرجع نصّي بدل lesson_id — نضيف عمودًا اختياريًّا بدل جدول جديد
alter table public.iqra_progress
  add column if not exists library_id uuid null references public.iqra_library(id) on delete cascade,
  add column if not exists station text null;                     -- آخر محطّة وصل إليها: listen_read|words|grammar|drill|produce
alter table public.iqra_progress alter column lesson_id drop not null;
create unique index if not exists iqra_progress_library_uq on public.iqra_progress(learner_email, library_id) where library_id is not null;

-- 5) التحقّق (يجب أن يُعيد 9 صفوف: 6 أعمدة للحلقات + جدولان + عمود المكتبة في التقدّم)
select 'lesson_col' as check_name, column_name as name, 1 as n
  from information_schema.columns where table_schema = 'public' and table_name = 'iqra_lessons'
   and column_name in ('skill','can_do_ar','can_do_en','descriptor_codes','domain','minutes_total')
union all
select 'table', t, 1 from unnest(array['iqra_time_log','iqra_library']) t
  where exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = t)
union all
select 'progress_col', column_name, 1 from information_schema.columns
  where table_schema = 'public' and table_name = 'iqra_progress' and column_name = 'library_id'
order by 1, 2;
