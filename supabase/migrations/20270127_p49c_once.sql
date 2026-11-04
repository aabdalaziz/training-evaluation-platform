-- =====================================================================
-- P49-ج «مرّة واحدة» — طبقة قاعدة البيانات لمنع تكرار الاستبيان من المشارك نفسه (إصدار 2)
-- © 2026 د. أحمد محمد عبدالعزيز بدوي — جميع الحقوق محفوظة.
--
-- القاعدة: اليومي → مرّة واحدة لكل (بريد، برنامج، مجموعة، يوم)؛ الختامي/نهاية البرنامج → مرّة واحدة لكل (بريد، برنامج).
-- فهارس فريدة «جزئية» تُطبَّق على السجلّات من تاريخ التفعيل فصاعدًا كي لا تتعثّر على بيانات قديمة مكرّرة.
-- إصدار 2: بلا upper(kind::text) — تحويل النوع المعدود إلى نصّ ليس IMMUTABLE فيرفضه Postgres في الفهارس (42P17)؛
--          العمود kind يُقارَن مباشرة (التطبيق يكتب DAILY/FINAL/END بالأحرف الكبيرة).
-- التطبيق يُترجم خطأ 23505 إلى رسالة ودّية: «سبق لك إجراء هذا الاستبيان — شكرًا لك».
-- آمن لإعادة التنفيذ.
-- =====================================================================
create unique index if not exists evaluations_once_daily_uidx
  on public.evaluations (lower(guest_email), program_id, classroom_id, evaluation_date)
  where guest_email is not null and kind = 'DAILY' and submitted_at >= timestamptz '2026-11-05 00:00:00+03';

create unique index if not exists evaluations_once_program_uidx
  on public.evaluations (lower(guest_email), program_id, kind)
  where guest_email is not null and kind in ('FINAL', 'END') and submitted_at >= timestamptz '2026-11-05 00:00:00+03';

-- تشخيص — المتوقّع: once_daily_idx = 1 · once_program_idx = 1
select
  (select count(*) from pg_indexes where schemaname = 'public' and indexname = 'evaluations_once_daily_uidx') as once_daily_idx,
  (select count(*) from pg_indexes where schemaname = 'public' and indexname = 'evaluations_once_program_uidx') as once_program_idx;
