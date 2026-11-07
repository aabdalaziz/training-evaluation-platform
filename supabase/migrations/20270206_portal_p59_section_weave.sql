-- © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
-- P59 «نسيج الشعبة — ما نسجه متعلّموك معًا» (خريطة الأثر المجمَّعة للشعبة)
-- لا جداول جديدة. عمودان على جدول الخيوط (P58) لإذن المتعلّم الصريح بمشاركة «لأن…» مع مدرّبه بلا اسم:
--   share_trainer  — الإذن (مغلق افتراضيًا، يُلغى فورًا من بطاقة الخيط)
--   shared_at      — لحظة منح الإذن (أثر موافقة لأغراض نظام حماية البيانات الشخصية؛ تُمسح عند الإلغاء)
-- التجميع نفسه (المحطات المشتركة بين ≥ 5 متعلّمين، سماكة الخيوط، المرآة) يُحسَب كل مرة ولا يُخزَّن.
-- لا يدخل شيء من هنا في أي تقييم ولا في الملف المهاري المحسوب.

alter table public.portal_map_threads
  add column if not exists share_trainer boolean not null default false,
  add column if not exists shared_at     timestamptz;

-- فهرس جزئي صغير: قراءة المدرّب تمرّ على المأذون فقط
create index if not exists portal_map_threads_shared_idx
  on public.portal_map_threads (email) where share_trainer;

-- الإذن له معنى فقط على خيط مُبقى؛ الخيط المستبعَد لا يُشارَك أبدًا
alter table public.portal_map_threads drop constraint if exists portal_map_threads_share_kept_ck;
alter table public.portal_map_threads
  add constraint portal_map_threads_share_kept_ck check (share_trainer = false or status = 'kept');

comment on column public.portal_map_threads.share_trainer is 'P59 — إذن المتعلّم بعرض «لأن…» لمدرّب شعبته بلا اسم (مغلق افتراضيًا، يُلغى فورًا)';
comment on column public.portal_map_threads.shared_at     is 'P59 — لحظة منح الإذن (تُمسح عند الإلغاء)';

-- تشخيص ----------------------------------------------------------------
select count(*) as threads_columns from information_schema.columns
 where table_schema = 'public' and table_name = 'portal_map_threads';
-- المتوقَّع: 15  (13 من P58 + 2)

select count(*) as shared_index from pg_indexes
 where schemaname = 'public' and indexname = 'portal_map_threads_shared_idx';
-- المتوقَّع: 1

select count(*) as share_kept_check from information_schema.table_constraints
 where table_schema = 'public' and table_name = 'portal_map_threads' and constraint_name = 'portal_map_threads_share_kept_ck';
-- المتوقَّع: 1
