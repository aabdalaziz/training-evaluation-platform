-- =====================================================================
--  م8-ج «تعليمات الاختبار وإقرار الممتحن» — مِعيار — من أَثَر
--  يضيف: عمود إقرار الممتحن على الجلسة الآمنة (الإصدار · اللغة · الوقت).
--  نصّ التعليمات نفسه يُحفظ في miaar_settings تحت المفتاح exam_instructions
--  (يُنشأ تلقائيًا من الكود عند أول حفظ؛ وقبل ذلك يُستخدم نصّ المصنع — الإصدار 1).
--  آمن لإعادة التشغيل (idempotent).
-- =====================================================================

alter table public.placement_secure_sessions
  add column if not exists instructions_ack jsonb null;

comment on column public.placement_secure_sessions.instructions_ack is
  'م8-ج: إقرار الممتحن بتعليمات الاختبار {version, lang, at} — لا تُفتح جلسة بدونه';

-- PostgREST: أعِد تحميل مخطّط الجداول حتى يرى العمود الجديد فورًا
notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------
--  تشخيص: المتوقَّع  ack_col = 1
-- ---------------------------------------------------------------------
select
  (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'placement_secure_sessions' and column_name = 'instructions_ack') as ack_col;
