-- © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
-- P71 «يوم دخلتُ» — الاسم الرسمي: سطر الدخول — بكلمات المتعلّم يوم التسكين (Entry Line — In the Learner's Own Words on Placement Day)
-- جدول واحد صغير: portal_entry_lines — صفّ واحد لكل جلسة تسكين كتب صاحبها سطره (أو قاله بصوته) بعد إرسال الاختبار وقبل النتيجة.
--  • لماذا جدول؟ المتقدّم لحظة التسكين لا حساب له بعد (بريد فقط)، وجدول الحلقة portal_time_capsules يشترط user_id — فيُربط السطر بالبريد
--    ثم يراه صاحبه حين يُنشأ حسابه بالبريد نفسه (كما تُربط قيود التسجيل).
--  • لا يدخل placement_reports.report ولا أي قرار تسكين · لا يراه المصحّح · الصوت (jsonb path/sec/bytes/mime) يبقى مع صاحبه في athar-media/entry-voice.
--  • body_text بأي لغة ≤ 200 حرف · lang تلميح لغة الواجهة فقط · الحذف بطلب صاحبه فوري: الصفّ يُمحى فعلًا (لا عمود deleted_at).
-- التشغيل: Supabase → SQL Editor → New query → الصق → Run. آمن للتكرار (IF NOT EXISTS).

create table if not exists public.portal_entry_lines (
  id           bigint generated always as identity primary key,
  email        text not null,
  session_id   text not null,
  report_id    text,
  user_id      uuid,
  invite_id    text,
  lang         text not null default 'ar',
  body_text    text,
  voice        jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint portal_entry_lines_len check (body_text is null or char_length(body_text) <= 200),
  constraint portal_entry_lines_one_per_session unique (session_id)
);
create index if not exists portal_entry_lines_email_idx on public.portal_entry_lines (email);
create index if not exists portal_entry_lines_invite_idx on public.portal_entry_lines (invite_id) where invite_id is not null;

alter table public.portal_entry_lines enable row level security;
-- صاحب السطر يقرأ صفّه بحسابه (الكتابة كلّها عبر مفتاح الخدمة من /api/miaar و/api/me/first)
drop policy if exists "entry_lines_owner_read" on public.portal_entry_lines;
create policy "entry_lines_owner_read" on public.portal_entry_lines for select to authenticated using (auth.uid() = user_id);

comment on table public.portal_entry_lines is 'P71 سطر الدخول — بكلمات المتعلّم يوم التسكين: سطر واحد (أو صوت ≤ 20 ث) بعد إرسال اختبار التسكين وقبل النتيجة؛ لا يراه المصحّح ولا يدخل التسكين؛ يعود إلى صاحبه أول يوم وعبر المستوى ويوم تخرّجه.';

-- ─── تشخيص (المتوقَّع: rows = 0 · indexes = 4 · policies = 1 · columns = 11) ───
select 'rows' as k, count(*)::text as v from public.portal_entry_lines
union all select 'indexes', count(*)::text from pg_indexes where schemaname = 'public' and tablename = 'portal_entry_lines'
union all select 'policies', count(*)::text from pg_policies where schemaname = 'public' and tablename = 'portal_entry_lines'
union all select 'columns', count(*)::text from information_schema.columns where table_schema = 'public' and table_name = 'portal_entry_lines';
