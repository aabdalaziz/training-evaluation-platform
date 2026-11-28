-- هـ-6-ك (2026-11-28): «نَشيدُ الْجَلْسَة» — بيت الطفل يُحفَظ في ديوانه
-- يُنفَّذ في Supabase SQL Editor قبل نشر الحزمة (وإلّا تفشل كتابة التقدّم بسبب العمود الناقص)
alter table public.kids_progress add column if not exists verse text;
comment on column public.kids_progress.verse is 'بيت الطفل من نشيد الجلسة (نصّ الجلسة بكلمته المختارة؛ ليس كلامًا حرًّا) — ديوان الطفل';
