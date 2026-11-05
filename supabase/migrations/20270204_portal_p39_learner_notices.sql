-- =====================================================================
--  P39 «إشعارات المتعلّم» — أَثَر / مِعيار
--  يضيف جدولًا واحدًا: portal_learner_notices
--    قناة «داخل أَثَر»: كل حدث يخصّ المتعلّم (صدور حكم العبور · فتح إعادة مهارة ·
--    جلسة تعويض · ترقية · تسكين · تذكيرات) يُحفظ هنا نصًّا عربيًا بلا درجات،
--    ويُرسَل أيضًا دفعةً (Web Push) إن كان للمتعلّم اشتراك فعّال.
--  مفتاح المتعلّم = البريد (لأن متقدّم مِعيار قد لا يملك حسابًا) + user_id إن وُجد.
--  dedupe_key فريد: الحدث الواحد لا يصل مرّتين مهما تكرّر التشغيل.
--  آمن لإعادة التشغيل (idempotent).
-- =====================================================================

create table if not exists public.portal_learner_notices (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  user_id     uuid null,
  report_id   uuid null,
  kind        text not null,
  title_ar    text not null,
  body_ar     text not null default '',
  url         text null,
  ref_id      text null,
  dedupe_key  text not null,
  pushed      boolean not null default false,
  read_at     timestamptz null,
  created_at  timestamptz not null default now()
);

create unique index if not exists pln_dedupe_uq on public.portal_learner_notices (dedupe_key);
create index if not exists pln_email_idx on public.portal_learner_notices (email, created_at desc);
create index if not exists pln_report_idx on public.portal_learner_notices (report_id) where report_id is not null;

comment on table public.portal_learner_notices is 'P39 — إشعارات المتعلّم داخل أَثَر (نصّ عربي بلا درجات؛ dedupe_key يمنع التكرار)';

alter table public.portal_learner_notices enable row level security;
-- لا سياسات للمجهول: الوصول كلّه عبر واجهات الخادم (service role) التي تتحقّق من البريد/الرمز.

notify pgrst, 'reload schema';

-- تشخيص (المتوقّع: tbl=1 · uq=1 · idx=3 · rows=0)
select
  (select count(*) from information_schema.tables where table_schema = 'public' and table_name = 'portal_learner_notices') as tbl,
  (select count(*) from pg_indexes where schemaname = 'public' and tablename = 'portal_learner_notices' and indexname = 'pln_dedupe_uq') as uq,
  (select count(*) from pg_indexes where schemaname = 'public' and tablename = 'portal_learner_notices' and indexname like 'pln_%') as idx,
  (select count(*) from public.portal_learner_notices) as rows;
