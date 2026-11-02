-- © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
-- مِعيار — من أَثَر · م3 «ميزان مِعيار»: إحصاءات البنود (مجمّعة، بلا أشخاص) · موثوقية الكتل والنماذج · المراسي والمعايرة على البنود
-- آمن لإعادة التشغيل (idempotent). لا يمسّ الجلسات ولا التقارير. القراءة والكتابة بصلاحية الخدمة فقط (RLS بلا سياسات عامة).

-- 1) إحصاءات كل بند (بالرمز — الجلسات تحفظ الرموز)
create table if not exists public.question_bank_item_stats (
  item_code text primary key,
  item_id uuid,
  level text, skill text,
  n int not null default 0,                       -- كم إجابة
  p numeric(5,3), rpb numeric(5,3),               -- الصعوبة · التمييز (r-pb مع باقي كتلة المستوى)
  distractors jsonb not null default '{}'::jsonb, -- حصة كل خيار
  median_ms int, exposure int not null default 0, -- زمن الإجابة الوسيط · كم مرة عُرض
  flags jsonb not null default '[]'::jsonb,       -- أعلام بلغة الإنسان (رموز)
  b numeric(6,3), se numeric(6,3), infit numeric(6,3), outfit numeric(6,3), calib_n int not null default 0, -- راش
  suggest_level text, dismissed_level text, dismissed_at timestamptz,                                      -- اقتراح النقل وقرار المعدّ
  computed_at timestamptz not null default now()
);
create index if not exists question_bank_item_stats_level_idx on public.question_bank_item_stats(level, n desc);
alter table public.question_bank_item_stats enable row level security;

-- 2) موثوقية كل نطاق: level:<L> · form:<code> · meta
create table if not exists public.miaar_reliability (
  scope text primary key,
  n int not null default 0, k int not null default 0,
  method text not null default 'kr21',
  rel numeric(5,3) not null default 0, mean numeric(7,3) not null default 0, sd numeric(7,3) not null default 0, sem numeric(7,3) not null default 0,
  cut numeric(7,3) not null default 0, pass_rate numeric(5,3) not null default 0, livingston numeric(5,3) not null default 0,
  light text not null default 'gray' check (light in ('green','yellow','red','gray')),
  advice text,
  computed_at timestamptz not null default now()
);
alter table public.miaar_reliability enable row level security;

-- 3) البند: مرساة؟ · الصعوبة المعايَرة الأخيرة (نسخة للقراءة السريعة في منشئ النماذج)
alter table public.question_bank_items
  add column if not exists is_anchor boolean not null default false,
  add column if not exists calibrated_b numeric(6,3),
  add column if not exists calibration_n int not null default 0;
create index if not exists question_bank_items_anchor_idx on public.question_bank_items(is_anchor) where is_anchor;

-- 4) حالة مراجعة جديدة في سجلّ الأحداث: level_moved (لا قيد سابق على القيم — للتوثيق فقط)

-- ─── تشخيص متوقَّع بعد التشغيل ───
-- select count(*) from information_schema.tables where table_schema='public' and table_name in ('question_bank_item_stats','miaar_reliability');   → 2
-- select count(*) from information_schema.columns where table_name='question_bank_items' and column_name in ('is_anchor','calibrated_b','calibration_n'); → 3
-- select relrowsecurity from pg_class where relname in ('question_bank_item_stats','miaar_reliability');                                             → true, true
-- select count(*) from public.question_bank_item_stats;                                                                                             → 0 (يمتلئ بأول «أعد الوزن»)
