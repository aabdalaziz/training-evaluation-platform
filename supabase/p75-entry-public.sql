-- P75 «لماذا جاؤوا» — إذن صاحب سطر الدخول (P71) بظهوره على الصفحة الرئيسة
-- نُفِّذ في الإنتاج 2026-11-16 (التشخيص: entry_lines=0 · public_ok_lines=0 · column_exists=1)
-- القاعدة: الافتراضي false لكل سطر قديم — لا يظهر سطر إلا بإذن صريح من صاحبه (الخانة في شاشة «يوم دخلتُ»، أو من «أول يوم»/صفحة المستوى)
alter table public.portal_entry_lines add column if not exists public_ok boolean not null default false;
create index if not exists portal_entry_lines_public_idx on public.portal_entry_lines (created_at desc) where public_ok and body_text is not null;
comment on column public.portal_entry_lines.public_ok is 'P75: إذن صاحب السطر بظهور نصّه (لا صوته) على الرئيسة في «لماذا جاؤوا» — بلا اسم ولا برنامج؛ الأستاذ يستطيع إرجاعه إلى false';
-- تشخيص
select (select count(*) from public.portal_entry_lines) as entry_lines,
       (select count(*) from public.portal_entry_lines where public_ok) as public_ok_lines,
       (select count(*) from information_schema.columns where table_schema='public' and table_name='portal_entry_lines' and column_name='public_ok') as column_exists;
