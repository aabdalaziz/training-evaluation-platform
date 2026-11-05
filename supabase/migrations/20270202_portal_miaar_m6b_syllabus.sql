-- =====================================================================
--  م6-ب «خريطة المنهج — وسم وحدات المستوى» — مِعيار — من أَثَر
--  يضيف:
--   1) جدول وحدات المستوى miaar_syllabus_units (38 وحدة بذرة من واصفات CEFR بحالة draft — يعتمدها إنسان من «خريطة المنهج»)
--   2) عمود الوسم question_bank_items.unit_codes text[] (البند قد يخدم وحدتين)
--   3) عمود النطاق placement_invites.unit_scope text[] («ما دُرّس فقط» — اختياري على دعوة الاختبار النهائي)
--  آمن لإعادة التشغيل (idempotent).
-- =====================================================================

-- 0) حارس الترتيب
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'placement_invites' and column_name = 'level_target') then
    raise exception 'مِعيار م6-ب: شغّل هجرة م6 أولًا (20270128_portal_miaar_m6_exit.sql) — عمود placement_invites.level_target مفقود';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'placement_secure_sessions' and column_name = 'instructions_ack') then
    raise exception 'مِعيار م6-ب: شغّل هجرة م8-ج أولًا (20270201_portal_miaar_m8c_rules.sql) — عمود placement_secure_sessions.instructions_ack مفقود';
  end if;
end $$;

-- 1) وحدات المستوى
create table if not exists public.miaar_syllabus_units (
  code text primary key,                       -- A1-U01 … C1-U06
  level text not null check (level in ('A1','A2','B1','B2','C1')),
  idx int not null check (idx between 1 and 40),
  title_ar text not null,
  title_en text not null default '',
  focus_ar text not null default '',
  domains text[] not null default '{}',        -- personal | public | professional | educational
  descriptor_codes text[] not null default '{}',
  status text not null default 'draft' check (status in ('draft','approved','retired')),
  updated_at timestamptz not null default now(),
  updated_by text null
);
alter table public.miaar_syllabus_units enable row level security;
revoke all on public.miaar_syllabus_units from anon, authenticated;
create index if not exists miaar_syllabus_units_level_idx on public.miaar_syllabus_units(level, idx);
comment on table public.miaar_syllabus_units is 'م6-ب: وحدات المستوى (خريطة المنهج) — تُوسم بها بنود البنك ويوازن بها مولّد اختبار العبور';

-- 2) وسم البنود
alter table public.question_bank_items add column if not exists unit_codes text[] null;
comment on column public.question_bank_items.unit_codes is 'م6-ب: رموز وحدات المستوى التي يخدمها البند (قد تتعدّد)';
create index if not exists question_bank_items_unit_codes_idx on public.question_bank_items using gin (unit_codes);

-- 3) نطاق الدعوة «ما دُرّس فقط»
alter table public.placement_invites add column if not exists unit_scope text[] null;
comment on column public.placement_invites.unit_scope is 'م6-ب: حصر بنود اختبار العبور في وحدات دُرّست فعلًا (فارغ = المستوى كاملًا)';

-- 4) البذرة: 38 وحدة (لا تُستبدل ما عُدّل يدويًا)
insert into public.miaar_syllabus_units (code, level, idx, title_ar, title_en, focus_ar, domains, descriptor_codes) values
  ('A1-U01', 'A1', 1, 'أنا وعائلتي', 'Me and my family', 'التعريف بالنفس والعائلة: مفردات أساسية، فهم جُمل قصيرة عن النفس مسموعة ومقروءة', array['personal']::text[], array['LU-A1-01', 'LI-A1-01', 'RD-A1-04']::text[]),
  ('A1-U02', 'A1', 2, 'الأسماء: المذكّر والمؤنّث والعدد', 'Nouns: gender and number', 'تمييز المذكّر والمؤنّث والمفرد والجمع في كلمات مألوفة', array['personal']::text[], array['LU-A1-03']::text[]),
  ('A1-U03', 'A1', 3, 'الجملة الاسمية والسؤال', 'Nominal sentence and questions', 'الجملة الاسمية البسيطة وأدوات الاستفهام الأساسية (من، ما، أين، كم)', array['personal', 'educational']::text[], array['LU-A1-04']::text[]),
  ('A1-U04', 'A1', 4, 'أين؟ الأماكن وحروف الجرّ', 'Where? Places and prepositions', 'حروف الجرّ المكانية (في، على، من، إلى) وفهم توجيهات بسيطة', array['public']::text[], array['LU-A1-02', 'LI-A1-03']::text[]),
  ('A1-U05', 'A1', 5, 'لافتات وإشارات', 'Signs and notices', 'فهم اللافتات والإشارات المألوفة في الشارع والمطار', array['public']::text[], array['RD-A1-01']::text[]),
  ('A1-U06', 'A1', 6, 'رسائل قصيرة ومواعيد', 'Short messages and appointments', 'فهم رسالة قصيرة وبسيطة (تحية، موعد)', array['personal']::text[], array['RD-A1-02']::text[]),
  ('A1-U07', 'A1', 7, 'في المطار والفندق', 'At the airport and hotel', 'فهم أسئلة بسيطة في مواقف الخدمة', array['public', 'professional']::text[], array['LI-A1-02']::text[]),
  ('A1-U08', 'A1', 8, 'الأرقام والأوقات والأسعار', 'Numbers, times and prices', 'التقاط الأرقام والأوقات مسموعة، وإيجاد معلومة محدّدة في نصّ قصير مع صور', array['public']::text[], array['LI-A1-04', 'RD-A1-03']::text[]),
  ('A2-U01', 'A2', 1, 'الفعل: مضارع وماضٍ', 'Verbs: present and past', 'تصريف المضارع والماضي مع الضمائر الشائعة', array['personal']::text[], array['LU-A2-01']::text[]),
  ('A2-U02', 'A2', 2, 'أريد أن… يجب أن… يمكن أن…', 'Want to… must… can…', 'الأفعال المساعدة مع المضارع', array['personal', 'public']::text[], array['LU-A2-02']::text[]),
  ('A2-U03', 'A2', 3, 'التسوّق والسفر والصحّة', 'Shopping, travel and health', 'المفردات اليومية ونصوص قصيرة عن مواضيع مألوفة', array['public', 'personal']::text[], array['LU-A2-03', 'RD-A2-01']::text[]),
  ('A2-U04', 'A2', 4, 'ربط الجمل', 'Linking sentences', 'الروابط البسيطة: و، ثم، لأن، لكن', array['personal', 'educational']::text[], array['LU-A2-04']::text[]),
  ('A2-U05', 'A2', 5, 'الحياة اليومية مسموعة', 'Everyday listening', 'عبارات شائعة وحوار بسيط عن مواعيد وأسعار وأماكن', array['public', 'personal']::text[], array['LI-A2-01', 'LI-A2-03']::text[]),
  ('A2-U06', 'A2', 6, 'إعلانات وقوائم وجداول', 'Adverts, menus and timetables', 'الفكرة الرئيسة من إعلان مسموع، ومعلومة محدّدة في إعلان أو قائمة أو جدول', array['public']::text[], array['LI-A2-02', 'RD-A2-02']::text[]),
  ('A2-U07', 'A2', 7, 'رسالة شخصية', 'A personal letter', 'فهم رسالة شخصية بسيطة عن أحداث يومية', array['personal']::text[], array['RD-A2-03']::text[]),
  ('A2-U08', 'A2', 8, 'تعليمات خطوة خطوة', 'Step-by-step instructions', 'متابعة تعليمات قصيرة مسموعة ومقروءة (استعمال جهاز، طريق)', array['public', 'professional']::text[], array['LI-A2-04', 'RD-A2-04']::text[]),
  ('B1-U01', 'B1', 1, 'الشرط والزمن', 'Condition and time clauses', 'روابط الشرط والزمن: إذا، عندما، بعد أن', array['personal', 'professional']::text[], array['LU-B1-01']::text[]),
  ('B1-U02', 'B1', 2, 'الإضافة والنعت والعدد', 'Idafa, adjectives and numbers', 'الإضافة والنعت والعدد بدقّة معقولة', array['educational']::text[], array['LU-B1-02']::text[]),
  ('B1-U03', 'B1', 3, 'مفردات العمل والدراسة والسفر', 'Work, study and travel vocabulary', 'مفردات كافية لمواضيع العمل والدراسة والسفر', array['professional', 'educational']::text[], array['LU-B1-03']::text[]),
  ('B1-U04', 'B1', 4, 'الأفعال المزيدة والمصادر', 'Derived verb forms and masdars', 'الأفعال المزيدة الشائعة والمصادر', array['educational']::text[], array['LU-B1-04']::text[]),
  ('B1-U05', 'B1', 5, 'الفكرة الرئيسة في نصّ وحديث', 'Main ideas in text and talk', 'الأفكار الرئيسة في نصّ واضح وحديث واضح عن موضوع مألوف', array['public', 'educational']::text[], array['RD-B1-01', 'LI-B1-01']::text[]),
  ('B1-U06', 'B1', 6, 'القصّة والتقرير', 'Narrative and report', 'تسلسل الأحداث في قصّة أو تقرير، والأفكار الرئيسة في برنامج إذاعي', array['public']::text[], array['RD-B1-02', 'LI-B1-02']::text[]),
  ('B1-U07', 'B1', 7, 'المشاعر والآراء', 'Feelings and opinions', 'وصف المشاعر في رسالة شخصية، واستخراج رأي واضح من مقال قصير', array['personal', 'public']::text[], array['RD-B1-03', 'RD-B1-04']::text[]),
  ('B1-U08', 'B1', 8, 'محاضرة قصيرة ومكالمة عملية', 'A short lecture and a practical call', 'متابعة محاضرة قصيرة واضحة البنية، وفهم مكالمة هاتفية عملية', array['educational', 'professional']::text[], array['LI-B1-03', 'LI-B1-04']::text[]),
  ('B2-U01', 'B2', 1, 'الاستدراك والتوكيد والتفصيل', 'Contrast, emphasis and elaboration', 'أدوات الاستدراك والتوكيد والتفصيل: بل، إنما، أمّا', array['educational', 'public']::text[], array['LU-B2-01']::text[]),
  ('B2-U02', 'B2', 2, 'الجملة المركّبة والحال والتمييز', 'Complex sentences, hal and tamyiz', 'الجمل المركّبة والحال والتمييز بثقة', array['educational']::text[], array['LU-B2-02']::text[]),
  ('B2-U03', 'B2', 3, 'المتلازمات والتعابير الاصطلاحية', 'Collocations and idioms', 'المتلازمات اللفظية والمعاني الاصطلاحية الشائعة', array['public', 'professional']::text[], array['LU-B2-03']::text[]),
  ('B2-U04', 'B2', 4, 'ضبط الإعراب', 'Case endings in context', 'ضبط الإعراب في البنى الشائعة عند الحاجة', array['educational']::text[], array['LU-B2-04']::text[]),
  ('B2-U05', 'B2', 5, 'قضايا معاصرة ووجهات نظر', 'Contemporary issues and viewpoints', 'مقالات وتقارير عن قضايا معاصرة، ونشرات الأخبار والبرامج الحوارية', array['public']::text[], array['RD-B2-01', 'LI-B2-02']::text[]),
  ('B2-U06', 'B2', 6, 'الفكرة الرئيسة والتفاصيل الداعمة', 'Main idea versus detail', 'تمييز الفكرة الرئيسة من التفاصيل الداعمة', array['educational', 'professional']::text[], array['RD-B2-02']::text[]),
  ('B2-U07', 'B2', 7, 'الموقف والنبرة', 'Stance and tone', 'موقف الكاتب ونبرته، والموقف والنبرة في نقاش بين متحدّثين', array['public', 'professional']::text[], array['RD-B2-03', 'LI-B2-03']::text[]),
  ('B2-U08', 'B2', 8, 'الحجّة الممتدّة والعرض', 'Extended argument and presentation', 'متابعة حجّة ممتدّة مكتوبة أو مسموعة، وفهم عرض أكاديمي أو مهني', array['educational', 'professional']::text[], array['RD-B2-04', 'LI-B2-01', 'LI-B2-04']::text[]),
  ('C1-U01', 'C1', 1, 'مرونة البنى ودقّتها', 'Range and accuracy of structures', 'مدى واسع من البنى بمرونة ودقّة', array['educational', 'professional']::text[], array['LU-C1-01']::text[]),
  ('C1-U02', 'C1', 2, 'الفروق الدلالية الدقيقة', 'Fine semantic distinctions', 'الفروق الدلالية بين المترادفات', array['educational']::text[], array['LU-C1-02']::text[]),
  ('C1-U03', 'C1', 3, 'الأساليب البلاغية', 'Rhetorical devices', 'الأساليب البلاغية الشائعة (القصر، التقديم)', array['educational', 'public']::text[], array['LU-C1-03']::text[]),
  ('C1-U04', 'C1', 4, 'المصطلح الأكاديمي والمهني', 'Academic and professional terminology', 'المصطلحات الأكاديمية والمهنية، والمقالات المتخصّصة، والنقاش المتخصّص', array['educational', 'professional']::text[], array['LU-C1-04', 'RD-C1-02', 'LI-C1-03']::text[]),
  ('C1-U05', 'C1', 5, 'المعاني الضمنية والتلميح', 'Implicit meaning and allusion', 'المعاني الضمنية، والسخرية والتلميح والتحفّظ، في المقروء والمسموع', array['public', 'professional']::text[], array['RD-C1-01', 'RD-C1-03', 'LI-C1-02', 'LI-C1-04']::text[]),
  ('C1-U06', 'C1', 6, 'بنية الحجّة والحديث الممتدّ', 'Argument structure and extended talk', 'تقييم بنية الحجّة وتماسكها، وفهم حديث ممتدّ غير واضح البنية', array['educational', 'public']::text[], array['RD-C1-04', 'LI-C1-01']::text[])
on conflict (code) do nothing;

-- PostgREST: أعِد تحميل مخطّط الجداول حتى يرى الجدول والأعمدة فورًا
notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------
--  تشخيص: المتوقَّع  units_table = 1 · item_col = 1 · invite_col = 1 · seeded = 38
-- ---------------------------------------------------------------------
select
  (select count(*) from information_schema.tables  where table_schema = 'public' and table_name = 'miaar_syllabus_units') as units_table,
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'question_bank_items' and column_name = 'unit_codes') as item_col,
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'placement_invites' and column_name = 'unit_scope') as invite_col,
  (select count(*) from public.miaar_syllabus_units) as seeded;
