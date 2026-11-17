-- «اقْرَأْ — من أَثَر» — ق٢: «العَتَبة» (اختبار نهاية المستوى المعياري عبر مِعيار «عُبور») · طابور «أُنتج» (تغذية راجعة بشرية) · «المنزلة في جيبي»
-- © 2026 د. أحمد محمد عبدالعزيز بدوي — جميع الحقوق محفوظة.
-- يُشغَّل مرّة واحدة في محرّر SQL (آمن للتكرار). يفترض وجود جداول ق1 والخطوة 2 (iqra-q1.sql · iqra-step2.sql).
-- لا يمسّ أيّ جدول من جداول مِعيار (placement_* · miaar_*): اقْرَأْ يفتح الباب إلى اختبار نهاية المستوى ويلتقط نتيجته فقط.
-- لا أسماء في أيّ رقم جماعي (k ≥ 5 يُطبَّق في الكود). كلّ ما يكتبه المتعلّم ملكه ويُحذف مع حذف تقدّمه.

-- 0) حارس: الخطوة 2 موجودة
do $$ begin
  if not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'iqra_time_log') then
    raise exception 'اقْرَأْ ق٢: شغّل iqra-q1.sql ثم iqra-step2.sql أولًا';
  end if;
end $$;

-- 1) طلبات «العَتَبة» — Level-exit request / gate record
--    gate: early (البوّابة اللّيّنة: ≥70% من الساعات مع إتقان ≥90%) · full (الأرضية كاملة مع إتقان ≥70%)
--    status: requested (طلب المتعلّم) → deferred (أجّله الطاقم بسبب يراه المتعلّم) → invited (أُنشئت دعوة «عُبور» شخصية)
--            → sat (أدّى الاختبار؛ النتيجة قيد التصحيح) → passed (اجتاز؛ بانتظار اعتماد الترقية — ما زال حيًّا) | failed → promoted (قرار ترقية معتمد التُقط وفُتح المستوى التالي)
--            · cancelled (سحبه المتعلّم أو أُغلق مع حذف تقدّمه)
--    produce_scores: آخر درجات «أُنتج» المراجَعة وقت الطلب (بيّنة إضافية للطاقم — لا شرط)
create table if not exists public.iqra_threshold_requests (
  id uuid primary key default gen_random_uuid(),
  learner_email text not null,                                    -- lower() دائمًا
  user_id uuid null,
  enrolment_id uuid not null references public.iqra_enrolments(id) on delete cascade,
  level text not null check (level in ('PRE_A1','A1','A2','B1','B2','C1','C2')),
  gate text not null check (gate in ('early','full')),
  hours_at numeric(6,1) not null default 0,
  mastery_at smallint not null default 0 check (mastery_at between 0 and 100),
  produce_scores smallint[] not null default '{}',
  status text not null default 'requested'
    check (status in ('requested','deferred','invited','sat','passed','failed','promoted','cancelled')),
  invite_id uuid null,                                            -- placement_invites.id (دعوة «عُبور» الشخصية) — بلا قيد مرجعي حتى لا نمسّ جداول مِعيار
  invite_url text null,                                           -- رابط المتعلّم الشخصي (/miaar/d/<code>?t=…) — يُحفظ هنا لأنّ رمز الدعوة لا يُخزَّن في مِعيار إلا مجزَّأً
  recipient_id uuid null,                                         -- placement_invite_recipients.id
  report_id uuid null,                                            -- placement_reports.id بعد أداء الاختبار
  exit_total smallint null check (exit_total is null or exit_total between 0 and 100),   -- الكلّي من الحكم المركّب (للعرض فقط؛ المصدر التقرير)
  defer_note text null check (defer_note is null or length(defer_note) <= 300),
  decided_by uuid null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
-- طلب حيّ واحد لكلّ متعلّم
create unique index if not exists iqra_threshold_live_uq on public.iqra_threshold_requests(learner_email)
  where status in ('requested','deferred','invited','sat','passed');
create index if not exists iqra_threshold_status_idx on public.iqra_threshold_requests(status, created_at);
create index if not exists iqra_threshold_report_idx on public.iqra_threshold_requests(report_id) where report_id is not null;
alter table public.iqra_threshold_requests enable row level security;
revoke all on public.iqra_threshold_requests from anon, authenticated;
comment on table public.iqra_threshold_requests is 'اقْرَأْ ق٢: طلب «العَتَبة» — فتح الباب إلى اختبار نهاية المستوى المعياري (مِعيار «عُبور») والتقاط نتيجته؛ لا حكم هنا';

-- 2) طابور «أُنتج» — مراجعة بشرية للإنتاج الكتابي بسلّم تقدير تحليلي (analytic rubric) رباعي الأبعاد
--    kind: write فقط في ق٢ (التحدّث لا يغادر الجهاز) · status: queued → reviewed · withdrawn (سحبه المتعلّم قبل المراجعة)
--    rubric: {content, organisation, vocabulary, accuracy} كلٌّ 1..4 · score: المتوسّط المقرَّب 1..4
--    rewritten: جملة واحدة أعيدت كتابتها (نموذج تصحيح واحد — يبقى الجهد للمتعلّم)
create table if not exists public.iqra_produce_reviews (
  id uuid primary key default gen_random_uuid(),
  learner_email text not null,
  user_id uuid null,
  lesson_id uuid not null references public.iqra_lessons(id) on delete cascade,
  level text not null check (level in ('PRE_A1','A1','A2','B1','B2','C1','C2')),
  kind text not null default 'write' check (kind in ('write')),
  text text not null check (length(text) between 20 and 2000),
  words smallint not null default 0,
  checked jsonb not null default '[]'::jsonb,                     -- قائمة التدقيق الذاتي التي علّمها المتعلّم
  status text not null default 'queued' check (status in ('queued','reviewed','withdrawn')),
  score smallint null check (score is null or score between 1 and 4),
  rubric jsonb null,
  comment text null check (comment is null or length(comment) <= 400),
  rewritten text null check (rewritten is null or length(rewritten) <= 300),
  reviewer_id uuid null,
  reviewed_at timestamptz null,
  created_at timestamptz not null default now()
);
create index if not exists iqra_produce_queue_idx on public.iqra_produce_reviews(status, created_at);
create index if not exists iqra_produce_learner_idx on public.iqra_produce_reviews(learner_email, created_at desc);
alter table public.iqra_produce_reviews enable row level security;
revoke all on public.iqra_produce_reviews from anon, authenticated;
comment on table public.iqra_produce_reviews is 'اقْرَأْ ق٢: طابور «أُنتج» — تغذية راجعة بشرية على الكتابة بسلّم تحليلي 1..4؛ ملك المتعلّم، يُحذف مع تقدّمه';

-- 3) سبب إغلاق التسكين (عند العبور يُغلق المستوى السابق ويبقى تقدّمه ودفتره)
alter table public.iqra_enrolments
  add column if not exists closed_reason text null check (closed_reason is null or closed_reason in ('threshold','manual','withdrawn')),
  add column if not exists closed_at timestamptz null;

-- 4) التحقّق (يجب أن يُعيد 6 صفوف: جدولان + 3 فهارس + عمود closed_reason)
select 'table' as check_name, t as name, 1 as n from unnest(array['iqra_threshold_requests','iqra_produce_reviews']) t
  where exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = t)
union all
select 'index', i, 1 from unnest(array['iqra_threshold_live_uq','iqra_threshold_status_idx','iqra_produce_queue_idx']) i
  where exists (select 1 from pg_indexes where schemaname = 'public' and indexname = i)
union all
select 'enrol_col', column_name, 1 from information_schema.columns
  where table_schema = 'public' and table_name = 'iqra_enrolments' and column_name = 'closed_reason';
