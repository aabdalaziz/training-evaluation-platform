-- © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
-- مِعيار — من أَثَر · م2-ب «منشئ النماذج»: المخطّطات بحالة ونشر عام، ربط الدعوات والجلسات بالمخطّط، وزرع المخطّطات النظامية
-- آمن لإعادة التشغيل (idempotent). لا يمسّ البنود ولا الجلسات القائمة.

-- 1) المخطّطات: حالة (مسودّة/نشط/مؤرشف) · باب عام · اسم إنجليزي · ترتيب الأبواب
alter table public.question_bank_blueprints
  add column if not exists status text not null default 'draft',
  add column if not exists is_public boolean not null default false,
  add column if not exists name_en text,
  add column if not exists sort_order int not null default 100;
alter table public.question_bank_blueprints drop constraint if exists question_bank_blueprints_status_check;
alter table public.question_bank_blueprints add constraint question_bank_blueprints_status_check check (status in ('draft','active','archived'));
create index if not exists question_bank_blueprints_public_idx on public.question_bank_blueprints(status, is_public, sort_order);

-- 2) الدعوة تختار مخطّطًا (اختياري؛ وإلا الافتراضي حسب exam_mode)
alter table public.placement_invites add column if not exists blueprint_id uuid references public.question_bank_blueprints(id) on delete set null;

-- 3) الجلسة تثبّت خطّتها لحظة البدء (لا يتغيّر سلوكها إن عُدّل المخطّط لاحقًا)
alter table public.placement_secure_sessions
  add column if not exists blueprint_id uuid,
  add column if not exists plan jsonb;
create index if not exists placement_secure_sessions_blueprint_idx on public.placement_secure_sessions(blueprint_id) where blueprint_id is not null;

-- 4) المخطّطات النظامية (تُزرع مرة؛ المسؤول يستطيع تعديل أعدادها لاحقًا من «منشئ النماذج»)
insert into public.question_bank_blueprints (code, name_ar, name_en, description_ar, test_type, requirements, duration_minutes, is_system, purpose, level, cut_percent, status, is_public, sort_order)
values
  ('SYS-PLACEMENT', 'تحديد المستوى (تكيفي)', 'Placement — adaptive',
   'مِسبار قصير يحدّد نقطة البداية، ثم صعود/نزول حتى يتّضح المستوى، مع أرضية ما قبل A1 لمن لم يجتز A1.',
   'placement', '{"levels":["A1","A2","B1","B2","C1","C2"],"counts":{"A1":{"grammar_vocab":4,"reading":2,"listening":2},"A2":{"grammar_vocab":4,"reading":2,"listening":2},"B1":{"grammar_vocab":4,"reading":3,"listening":2},"B2":{"grammar_vocab":4,"reading":3,"listening":2},"C1":{"grammar_vocab":2,"reading":3,"listening":3},"C2":{"grammar_vocab":2,"reading":2,"listening":4}},"draw":"random","floor":true,"probe":true,"shuffle_options":true}'::jsonb,
   50, true, 'placement', null, 60, 'active', true, 10),
  ('SYS-COMPREHENSIVE', 'الاختبار الشامل', 'Comprehensive',
   'كل المستويات من A1 حتى C2 بالتتابع دون توقّف — صورة كاملة للمهارات الثلاث.',
   'comprehensive', '{"levels":["A1","A2","B1","B2","C1","C2"],"counts":{"A1":{"grammar_vocab":4,"reading":2,"listening":2},"A2":{"grammar_vocab":4,"reading":2,"listening":2},"B1":{"grammar_vocab":4,"reading":3,"listening":2},"B2":{"grammar_vocab":4,"reading":3,"listening":2},"C1":{"grammar_vocab":2,"reading":3,"listening":3},"C2":{"grammar_vocab":2,"reading":2,"listening":4}},"draw":"random","floor":false,"probe":false,"shuffle_options":true}'::jsonb,
   50, true, 'placement', null, 60, 'active', true, 20),
  ('SYS-SHORT', 'التشخيصي القصير', 'Short diagnostic',
   'بند واحد لكل خلية (مستوى×مهارة) — 18 بندًا في نحو ربع ساعة لمؤشر سريع.',
   'short', '{"levels":["A1","A2","B1","B2","C1","C2"],"counts":{"A1":{"grammar_vocab":1,"reading":1,"listening":1},"A2":{"grammar_vocab":1,"reading":1,"listening":1},"B1":{"grammar_vocab":1,"reading":1,"listening":1},"B2":{"grammar_vocab":1,"reading":1,"listening":1},"C1":{"grammar_vocab":1,"reading":1,"listening":1},"C2":{"grammar_vocab":1,"reading":1,"listening":1}},"draw":"random","floor":false,"probe":false,"shuffle_options":true}'::jsonb,
   15, true, 'diagnostic', null, 60, 'active', true, 30),
  ('SYS-LEVEL-B1', 'اجتياز مستوى B1', 'Level B1 exam',
   'اختبار مستوى واحد بحدّ اجتياز 70% — لنهاية المستوى أو الترفيع. نموذج مرجعي؛ انسخه لبقية المستويات.',
   'level', '{"levels":["B1"],"counts":{"B1":{"grammar_vocab":8,"reading":6,"listening":6}},"draw":"random","floor":false,"probe":false,"shuffle_options":true}'::jsonb,
   30, true, 'level', 'B1', 70, 'active', false, 40)
on conflict (code) do nothing;

-- 5) المخطّطات القديمة المرحّلة من مِعيار (إن وُجدت) تبقى مسودّات غير معلنة — تُراجع من «منشئ النماذج»
update public.question_bank_blueprints set status = 'draft' where status is null;

-- ─── تشخيص متوقَّع بعد التشغيل ───
-- select code, test_type, status, is_public, duration_minutes, cut_percent from public.question_bank_blueprints order by sort_order;
--   → 4 صفوف SYS-* على الأقل (SYS-PLACEMENT · SYS-COMPREHENSIVE · SYS-SHORT نشطة معلنة، SYS-LEVEL-B1 نشطة غير معلنة)
-- select count(*) from information_schema.columns where table_name='placement_secure_sessions' and column_name in ('blueprint_id','plan');   → 2
-- select count(*) from information_schema.columns where table_name='placement_invites' and column_name='blueprint_id';                      → 1
