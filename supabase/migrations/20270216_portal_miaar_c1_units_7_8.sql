-- © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved.
-- ---------------------------------------------------------------------
--  اقْرَأْ C1 ج٤ (متقدّم): المنزلتان السابعة والثامنة في خريطة المنهج — بذرة SQL مطابقة لبذرة الكود (lib/miaar/syllabus.ts)
--  تحملان واصفات الكتابة والتحدّث الستّة WR/SP-C1-01..03 التي لم تكن محمولة في أيّ منزلة.
--  تُنفَّذ مرّة واحدة في Supabase SQL Editor، أو بدلًا منها زرّ «بذرة المستوى» في /admin/miaar (تبويب متقدّم). آمنة للتكرار.
-- ---------------------------------------------------------------------
insert into public.miaar_syllabus_units (code, level, idx, title_ar, title_en, focus_ar, domains, descriptor_codes) values
  ('C1-U07', 'C1', 7, 'الكتابة الممتدّة: التقرير والمقال والمقترح', 'Extended writing: report, essay, proposal', 'بنية التقرير المهنيّ والمقال الحِجاجيّ والمقترح، وضبط الأسلوب بحسب القارئ، وإبراز النقاط الجوهريّة وإسنادها، وتحرير النفس بالمرور الثلاثة', '{educational,professional}', '{WR-C1-01,WR-C1-02,WR-C1-03,LU-C1-01,LU-C1-03,RD-C1-02}'),
  ('C1-U08', 'C1', 8, 'الإعلام والسجلّ المُذاع', 'Broadcast media and spoken register', 'النشرة والمقابلة والبودكاست، والفصحى المُذاعة بلمسة غير معياريّة تعرُّفًا لا إنتاجًا، والتنغيم والسخرية والتحفّظ في المسموع، والردّ الفصيح المرن والعرض الشفهيّ الممتدّ بخاتمة', '{public,professional}', '{LI-C1-01,LI-C1-02,LI-C1-04,SP-C1-01,SP-C1-02,SP-C1-03}')
on conflict (code) do update set
  level = excluded.level, idx = excluded.idx, title_ar = excluded.title_ar, title_en = excluded.title_en,
  focus_ar = excluded.focus_ar, domains = excluded.domains, descriptor_codes = excluded.descriptor_codes;

notify pgrst, 'reload schema';
