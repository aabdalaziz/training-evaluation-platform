-- © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
-- هـ-6-ز «افتتاحية بَيان»: مشاهدة «رسالة لؤلؤ» لكلّ طفل (مرّة واحدة؛ تُعاد من زرّ «قصّتنا») — آمن التكرار
alter table public.kids_children add column if not exists intro_seen_at timestamptz;

-- تشخيص (المتوقّع: intro_col=1)
select 'intro_col' as k, count(*)::int as v from information_schema.columns where table_schema='public' and table_name='kids_children' and column_name='intro_seen_at';
