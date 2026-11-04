-- =====================================================================================
--  P49-ب «بلغة المتدرّب» — الجزء 3/3: لغة الرابط
--  © 2026 د. أحمد محمد عبدالعزيز بدوي — جميع الحقوق محفوظة
--  evaluation_links.lang: 'auto' (لغة متصفّح المتدرّب — الافتراضي) · 'ar' · 'en'
--  غير الناطقين بالعربية يفتحون الاستبيان بالإنجليزية مباشرة من الرمز نفسه.
--  آمن لإعادة التنفيذ.
-- =====================================================================================
alter table public.evaluation_links add column if not exists lang text not null default 'auto';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'evaluation_links_lang_chk') then
    alter table public.evaluation_links add constraint evaluation_links_lang_chk check (lang in ('auto', 'ar', 'en'));
  end if;
end $$;

-- تشخيص — المتوقَّع: lang_col = 1 · lang_chk = 1
select
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'evaluation_links' and column_name = 'lang') as lang_col,
  (select count(*) from pg_constraint where conname = 'evaluation_links_lang_chk') as lang_chk;
