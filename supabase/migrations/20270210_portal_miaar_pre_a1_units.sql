-- © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved.
-- ---------------------------------------------------------------------
--  اقْرَأْ ت١ (Pre-A1 · تمهيدي): أربع منازل في خريطة المنهج — بذرة SQL مطابقة لبذرة الكود (lib/miaar/syllabus.ts)
--  تُنفَّذ مرّة واحدة في Supabase SQL Editor، أو بدلًا منها زرّ «بذرة المستوى» في /admin/miaar (تبويب تمهيدي).
--  آمنة للتكرار: on conflict (code) do update (العناوين والواصفات من الخطّة المعتمدة تغلب أيّ مسودّة قديمة).
--  مهمّ: قيد المستوى في جدول الوحدات كان A1–C1 فقط (م6-ب)؛ يُوسَّع هنا إلى المستويات السبعة قبل الإدراج —
--  وبدونه يفشل استيراد حزم Pre-A1 في /admin/iqra (إنشاء الوحدة تلقائيًّا) وزرّ البذرة معًا.
-- ---------------------------------------------------------------------
alter table public.miaar_syllabus_units drop constraint if exists miaar_syllabus_units_level_check;
alter table public.miaar_syllabus_units add constraint miaar_syllabus_units_level_check check (level in ('PRE_A1','A1','A2','B1','B2','C1','C2'));

insert into public.miaar_syllabus_units (code, level, idx, title_ar, title_en, focus_ar, domains, descriptor_codes) values
  ('PRE_A1-U01', 'PRE_A1', 1, 'حروفي الأولى: من الألف إلى الكاف', 'My first letters: alif to kaf', 'الحروف ا ب ت ث ن ي ج ح خ د ذ ر ز م ل ك والتاء المربوطة، والحركات الثلاث والمدّ، وأوّل عشرين كلمة مع صورها', array['personal', 'educational']::text[], array['LI-PRE_A1-01', 'LI-PRE_A1-04', 'RD-PRE_A1-01', 'RD-PRE_A1-04', 'LU-PRE_A1-01', 'SP-PRE_A1-03', 'WR-PRE_A1-01']::text[]),
  ('PRE_A1-U02', 'PRE_A1', 2, 'حروفي الثانية: من السين إلى الهمزة', 'My second letters: sin to hamza', 'الحروف س ش ص ض ط ظ ع غ ف ق هـ و والهمزة، والسكون والشدّة والتنوين و«ال»، وقراءة ستّين كلمة مع صورها', array['personal', 'public']::text[], array['LI-PRE_A1-01', 'LI-PRE_A1-02', 'RD-PRE_A1-02', 'RD-PRE_A1-03', 'SP-PRE_A1-02', 'WR-PRE_A1-02']::text[]),
  ('PRE_A1-U03', 'PRE_A1', 3, 'أنا وأنتَ وهذا وهذه: التحيّة والتعارف', 'Me, you, this and that: greetings', 'الضمائر أنا/أنتَ/أنتِ/هو/هي مع صورة، هذا/هذه، التحيّة والوداع والشكر، وبطاقة الاسم والبلد', array['personal']::text[], array['LU-PRE_A1-02', 'LU-PRE_A1-04', 'LI-PRE_A1-02', 'SP-PRE_A1-01', 'WR-PRE_A1-03']::text[]),
  ('PRE_A1-U04', 'PRE_A1', 4, 'الأعداد والألوان والأسعار', 'Numbers, colours and prices', 'الأعداد من صفر إلى عشرة مسموعة ومقروءة، ثمانية ألوان، وأسعار وأوقات بسيطة على لافتة أو زرّ', array['public']::text[], array['LU-PRE_A1-03', 'LI-PRE_A1-03', 'RD-PRE_A1-02', 'RD-PRE_A1-03', 'SP-PRE_A1-02']::text[])
on conflict (code) do update set
  level = excluded.level, idx = excluded.idx, title_ar = excluded.title_ar, title_en = excluded.title_en,
  focus_ar = excluded.focus_ar, domains = excluded.domains, descriptor_codes = excluded.descriptor_codes;

-- مسودّات قديمة (PRE_A1-U05/U06 وما بعدها) من تجربة سابقة في الخريطة: تُحذَف فقط إن لم يربطها شيء.
delete from public.miaar_syllabus_units u
where u.level = 'PRE_A1' and u.code not in ('PRE_A1-U01','PRE_A1-U02','PRE_A1-U03','PRE_A1-U04')
  and not exists (select 1 from public.question_bank_items q where q.unit_codes @> array[u.code])
  and not exists (select 1 from public.portal_program_units p where p.miaar_unit_codes @> array[u.code])
  and not exists (select 1 from public.portal_sessions s where s.miaar_unit_codes @> array[u.code]);

notify pgrst, 'reload schema';

-- تشخيص: المتوقَّع pre_a1_units = 4
select (select count(*) from public.miaar_syllabus_units where level = 'PRE_A1') as pre_a1_units;
