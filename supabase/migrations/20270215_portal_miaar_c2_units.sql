-- © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved.
-- ---------------------------------------------------------------------
--  اقْرَأْ C2 ج١ (متقن): ثماني منازل في خريطة المنهج — بذرة SQL مطابقة لبذرة الكود (lib/miaar/syllabus.ts)
--  تُنفَّذ مرّة واحدة في Supabase SQL Editor، أو بدلًا منها زرّ «بذرة المستوى» في /admin/miaar (تبويب متقن).
--  آمنة للتكرار: on conflict (code) do update. قيد المستوى وُسِّع إلى السبعة في هجرة Pre-A1 (20270210) — يُعاد هنا احتياطًا.
-- ---------------------------------------------------------------------
alter table public.miaar_syllabus_units drop constraint if exists miaar_syllabus_units_level_check;
alter table public.miaar_syllabus_units add constraint miaar_syllabus_units_level_check check (level in ('PRE_A1','A1','A2','B1','B2','C1','C2'));

insert into public.miaar_syllabus_units (code, level, idx, title_ar, title_en, focus_ar, domains, descriptor_codes) values
  ('C2-U01', 'C2', 1, 'قراءة التراث: من الجاحظ إلى ابن خلدون', 'Reading the classical heritage: al-Jahiz to Ibn Khaldun', 'النصّ التراثيّ النثريّ الطويل ومعجمه وبناؤه، والفرق الأسلوبيّ بين الفصحى التراثيّة والمعاصرة، وإعادة الصياغة المعاصرة بلا خيانة', '{educational,public}', '{RD-C2-03,RD-C2-01,LU-C2-02,LI-C2-02,WR-C2-01}'),
  ('C2-U02', 'C2', 2, 'طبقات المعنى: الشعر والنثر الفنّيّ', 'Layers of meaning: poetry and artistic prose', 'المعنى الحرفيّ والمجازيّ والمقصد، والأسلوب والصوت والإيقاع، والتورية والكناية والمفارقة: لماذا هذه الكلمة لا تلك', '{educational,public}', '{RD-C2-02,LU-C2-02,LU-C2-03,LI-C2-02,SP-C2-01,WR-C2-02}'),
  ('C2-U03', 'C2', 3, 'التحكّم التامّ: التراكيب المعقّدة والنادرة', 'Full control: complex and rare structures', 'الاشتغال والتنازع والحال المركّبة وإعمال المصدر و«ما» بأنواعها والقصر والاستثناء المفرّغ والتضمين والجملة المعترضة', '{educational,professional}', '{LU-C2-01,LU-C2-04,WR-C2-01,RD-C2-02,LI-C2-01}'),
  ('C2-U04', 'C2', 4, 'الأمثال والتعابير والمستويات اللغويّة', 'Idioms, proverbs and register', 'الأمثال والتعابير الاصطلاحيّة في موضعها، ومستويات الخطاب والانتقال بينها عمدًا، والسخرية والتحفّظ في الكلام السريع', '{public,personal}', '{LU-C2-03,LI-C2-02,LI-C2-01,SP-C2-02,SP-C2-01}'),
  ('C2-U05', 'C2', 5, 'الأكاديميا: المنهج والمسلّمات والنقد', 'Academia: method, assumptions and critique', 'الورقة البحثيّة ونقد منهجها ومسلّماتها، والمراجعة العلميّة، والملخّص من مصادر متعارضة، والاقتباس والإحالة', '{educational,professional}', '{RD-C2-04,RD-C2-01,LI-C2-04,WR-C2-02,WR-C2-03}'),
  ('C2-U06', 'C2', 6, 'المناظرة: مصداقيّة الحجّة والكلام السريع', 'Debate: credibility of argument and fast speech', 'تقييم جودة الحجّة ومصداقيّة مصدرها، والمغالطات الاثنتا عشرة، والاستماع لحديث سريع متداخل الأصوات، والردّ الفوريّ', '{public,educational}', '{LI-C2-03,LI-C2-01,SP-C2-02,SP-C2-03,RD-C2-04}'),
  ('C2-U07', 'C2', 7, 'خارج مجالي: النقاش المجرّد المعقّد', 'Outside my field: complex abstract discussion', 'فهم حوار مجرّد معقّد في خمسة علوم لا يعرفها المتعلّم وإعادة بنائه، والمصطلح المشتقّ من سياقه، والتعريف والتمييز والتفريع', '{educational,professional}', '{LI-C2-04,RD-C2-01,LU-C2-04,SP-C2-01,WR-C2-03}'),
  ('C2-U08', 'C2', 8, 'التحرير والإجازة', 'Editing and the ijaza', 'تصحيح الأخطاء الدقيقة في نصوص متقدّمة، والمراجعة اللغويّة الكاملة، والخطاب الختاميّ بمستوى مختار، ومشروع «كتاب المجلس»', '{educational,professional}', '{LU-C2-04,LU-C2-01,WR-C2-01,WR-C2-03,SP-C2-03,RD-C2-03,LI-C2-03}')
on conflict (code) do update set
  level = excluded.level, idx = excluded.idx, title_ar = excluded.title_ar, title_en = excluded.title_en,
  focus_ar = excluded.focus_ar, domains = excluded.domains, descriptor_codes = excluded.descriptor_codes;

-- مسودّات قديمة (C2-U09 وما بعدها) إن وُجدت من تجربة سابقة: تُحذَف فقط إن لم يربطها شيء.
delete from public.miaar_syllabus_units u
where u.level = 'C2' and u.code not in ('C2-U01','C2-U02','C2-U03','C2-U04','C2-U05','C2-U06','C2-U07','C2-U08')
  and not exists (select 1 from public.question_bank_items q where q.unit_codes @> array[u.code])
  and not exists (select 1 from public.portal_program_units p where p.miaar_unit_codes @> array[u.code])
  and not exists (select 1 from public.portal_sessions s where s.miaar_unit_codes @> array[u.code]);

notify pgrst, 'reload schema';

-- تشخيص: المتوقَّع c2_units = 8
select count(*) as c2_units from public.miaar_syllabus_units where level = 'C2';
