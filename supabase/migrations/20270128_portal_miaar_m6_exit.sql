-- © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
-- مِعيار — م6 «عُبور»: اختبار نهاية المستوى المعياري (CEFR)
--  1) أعمدة الدعوة: ربط بالقاعة (classroom_id) · نافذة البدء (opens_at) · المستوى المستهدف (level_target) · مفتاح إعادة الاستخدام (reuse_key) · إعادة مهارة واحدة (retake_of)
--  2) أنواع موافقات الإعادة: + level_exit · skill_retake
--  3) خمسة مخطّطات نظام SYS-EXIT-A1…C1 (جدول المواصفات exit-2026.11)
--  آمن للتكرار. المتوقَّع في النهاية: exit_blueprints=5 · invite_cols=5 · retake_kinds_ok=1
begin;

-- 1) أعمدة الدعوة
alter table public.placement_invites add column if not exists classroom_id uuid null references public.classrooms(id) on delete set null;
alter table public.placement_invites add column if not exists opens_at timestamptz null;
alter table public.placement_invites add column if not exists level_target text null check (level_target is null or level_target in ('A1','A2','B1','B2','C1','C2'));
alter table public.placement_invites add column if not exists reuse_key text null;
alter table public.placement_invites add column if not exists retake_of uuid null references public.placement_reports(id) on delete set null;
create unique index if not exists placement_invites_reuse_key_uq on public.placement_invites (reuse_key) where reuse_key is not null and status = 'open';
create index if not exists placement_invites_classroom_idx on public.placement_invites (classroom_id) where classroom_id is not null;

-- 2) أنواع الموافقات
alter table public.test_retake_approvals drop constraint if exists test_retake_approvals_kind_chk;
alter table public.test_retake_approvals add constraint test_retake_approvals_kind_chk check (kind in ('staff','group','program_end','level_exit','skill_retake'));

-- 3) مخطّطات النظام (جدول المواصفات exit-2026.11)
insert into public.question_bank_blueprints (code, name_ar, name_en, description_ar, test_type, purpose, level, cut_percent, duration_minutes, is_system, status, is_public, sort_order, requirements)
select v.code, v.name_ar, v.name_en, v.description_ar, 'level', 'exit', v.level, 60, v.minutes, true, 'active', false, v.sort_order, v.req::jsonb
from (values
  ('SYS-EXIT-A1', 'اختبار نهاية المستوى — معياري (CEFR) — A1', 'Level Exit Examination (CEFR-aligned) — A1', 'جدول المواصفات exit-2026.11: استماع 10 · قراءة 10 · مفردات وتراكيب 15 · كتابة 1 · تحدّث 1 · 60 دقيقة · اجتياز 60% ولا مهارة دون 50%.', 'A1', 60, 90,
   '{"levels":["A1"],"counts":{"A1":{"listening":10,"reading":10,"grammar_vocab":15}},"productive":{"A1":{"writing":1,"speaking":1}},"productive_mode":"declared","draw":"random","shuffle_options":true,"spec_version":"exit-2026.11"}'),
  ('SYS-EXIT-A2', 'اختبار نهاية المستوى — معياري (CEFR) — A2', 'Level Exit Examination (CEFR-aligned) — A2', 'جدول المواصفات exit-2026.11: استماع 10 · قراءة 10 · مفردات وتراكيب 15 · كتابة 1 · تحدّث 1 · 65 دقيقة · اجتياز 60% ولا مهارة دون 50%.', 'A2', 65, 91,
   '{"levels":["A2"],"counts":{"A2":{"listening":10,"reading":10,"grammar_vocab":15}},"productive":{"A2":{"writing":1,"speaking":1}},"productive_mode":"declared","draw":"random","shuffle_options":true,"spec_version":"exit-2026.11"}'),
  ('SYS-EXIT-B1', 'اختبار نهاية المستوى — معياري (CEFR) — B1', 'Level Exit Examination (CEFR-aligned) — B1', 'جدول المواصفات exit-2026.11: استماع 12 · قراءة 12 · مفردات وتراكيب 16 · كتابة 2 · تحدّث 2 · 80 دقيقة · اجتياز 60% ولا مهارة دون 50%.', 'B1', 80, 92,
   '{"levels":["B1"],"counts":{"B1":{"listening":12,"reading":12,"grammar_vocab":16}},"productive":{"B1":{"writing":2,"speaking":2}},"productive_mode":"declared","draw":"random","shuffle_options":true,"spec_version":"exit-2026.11"}'),
  ('SYS-EXIT-B2', 'اختبار نهاية المستوى — معياري (CEFR) — B2', 'Level Exit Examination (CEFR-aligned) — B2', 'جدول المواصفات exit-2026.11: استماع 12 · قراءة 12 · مفردات وتراكيب 16 · كتابة 2 · تحدّث 2 · 90 دقيقة · اجتياز 60% ولا مهارة دون 50%.', 'B2', 90, 93,
   '{"levels":["B2"],"counts":{"B2":{"listening":12,"reading":12,"grammar_vocab":16}},"productive":{"B2":{"writing":2,"speaking":2}},"productive_mode":"declared","draw":"random","shuffle_options":true,"spec_version":"exit-2026.11"}'),
  ('SYS-EXIT-C1', 'اختبار نهاية المستوى — معياري (CEFR) — C1', 'Level Exit Examination (CEFR-aligned) — C1', 'جدول المواصفات exit-2026.11: استماع 14 · قراءة 14 · مفردات وتراكيب 12 · كتابة 2 · تحدّث 2 · 100 دقيقة · اجتياز 60% ولا مهارة دون 50%.', 'C1', 100, 94,
   '{"levels":["C1"],"counts":{"C1":{"listening":14,"reading":14,"grammar_vocab":12}},"productive":{"C1":{"writing":2,"speaking":2}},"productive_mode":"declared","draw":"random","shuffle_options":true,"spec_version":"exit-2026.11"}')
) as v(code, name_ar, name_en, description_ar, level, minutes, sort_order, req)
on conflict (code) do update set
  name_ar = excluded.name_ar, name_en = excluded.name_en, description_ar = excluded.description_ar, test_type = 'level', purpose = 'exit', level = excluded.level,
  cut_percent = 60, duration_minutes = excluded.duration_minutes, is_system = true, status = 'active', requirements = excluded.requirements, updated_at = now();

commit;

notify pgrst, 'reload schema';

-- تشخيص (المتوقَّع: exit_blueprints=5 · invite_cols=5 · retake_kinds_ok=1)
select
  (select count(*) from public.question_bank_blueprints where code like 'SYS-EXIT-%' and status = 'active') as exit_blueprints,
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'placement_invites' and column_name in ('classroom_id','opens_at','level_target','reuse_key','retake_of')) as invite_cols,
  (select count(*) from pg_constraint where conname = 'test_retake_approvals_kind_chk' and pg_get_constraintdef(oid) like '%skill_retake%') as retake_kinds_ok;
