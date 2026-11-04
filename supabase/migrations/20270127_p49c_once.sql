-- =====================================================================
-- P49-ج «مرّة واحدة» — طبقة قاعدة البيانات لمنع تكرار الاستبيان من المشارك نفسه
-- © 2026 د. أحمد محمد عبدالعزيز بدوي — جميع الحقوق محفوظة.
--
-- القاعدة: اليومي → مرّة واحدة لكل (بريد، برنامج، مجموعة، يوم)؛ الختامي/نهاية البرنامج → مرّة واحدة لكل (بريد، برنامج).
-- فهارس فريدة «جزئية» تُطبَّق على السجلّات من تاريخ التفعيل فصاعدًا كي لا تتعثّر على بيانات قديمة مكرّرة.
-- التطبيق يُترجم خطأ 23505 إلى رسالة ودّية: «سبق لك إجراء هذا الاستبيان — شكرًا لك».
-- آمن لإعادة التنفيذ.
-- =====================================================================
create unique index if not exists evaluations_once_daily_uidx
  on public.evaluations (lower(guest_email), program_id, classroom_id, evaluation_date)
  where guest_email is not null and upper(kind::text) = 'DAILY' and submitted_at >= timestamptz '2026-11-05 00:00:00+03';

create unique index if not exists evaluations_once_program_uidx
  on public.evaluations (lower(guest_email), program_id, upper(kind::text))
  where guest_email is not null and upper(kind::text) in ('FINAL', 'END') and submitted_at >= timestamptz '2026-11-05 00:00:00+03';

-- تشخيص — المتوقّع: once_daily_idx = 1 · once_program_idx = 1
select
  (select count(*) from pg_indexes where schemaname = 'public' and indexname = 'evaluations_once_daily_uidx') as once_daily_idx,
  (select count(*) from pg_indexes where schemaname = 'public' and indexname = 'evaluations_once_program_uidx') as once_program_idx;
