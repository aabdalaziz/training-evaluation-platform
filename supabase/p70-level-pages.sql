-- © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
-- P70 «بكلماتي عبر المستوى» — الاسم الرسمي: صفحة المستوى — بكلمات المتدرّب (Level Page — In the Learner's Own Words)
-- جدول واحد جديد: portal_level_pages — صفّ واحد لكل (متدرّب، قيد تسجيل، مستوى).
--  • line_ar «سطر المستوى» ≤ 200 · line_voice (jsonb: path/sec/bytes/mime/at — الصوت يبقى مع صاحبه، لا يدخل الختم ولا الوجه العام)
--  • keep (jsonb: أي بطاقة أُبقيت/أُخفيت) · public_keys (jsonb: ما يظهر على الوجه العام؛ الافتراضي السطر والأعداد) · live_public (الوجه العام مفتوح؟)
--  • body (الجسم المختوم JCS) · code ATH-LV-XXXX-XXXX · digest SHA-256 · history (أختام سابقة أُبطلت بالاستبدال) · sealed_at · revoked_at
-- لا يمسّ أي جدول آخر: سطور P66 وتقويم الشعبة وجدول الشُّعب وتقارير مِعيار وأداءاته تُقرأ فقط.
-- التشغيل: Supabase → SQL Editor → New query → الصق → Run. آمن للتكرار (IF NOT EXISTS).

create table if not exists public.portal_level_pages (
  id            bigint generated always as identity primary key,
  user_id       uuid not null,
  email         text not null,
  program_id    text not null,
  enrollment_id text not null,
  classroom_id  text,
  level_no      int  not null check (level_no between 1 and 8),
  line_ar       text,
  line_voice    jsonb not null default '{}'::jsonb,
  keep          jsonb not null default '{}'::jsonb,
  public_keys   jsonb not null default '["line","counts"]'::jsonb,
  live_public   boolean not null default false,
  body          jsonb,
  code          text,
  digest        text,
  history       jsonb not null default '[]'::jsonb,
  sealed_at     timestamptz,
  revoked_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint portal_level_pages_line_len check (line_ar is null or char_length(line_ar) <= 200),
  constraint portal_level_pages_code_fmt check (code is null or code ~ '^ATH-LV-[A-Z2-9]{4}-[A-Z2-9]{4}$'),
  constraint portal_level_pages_one_per_level unique (user_id, enrollment_id, level_no)
);
create unique index if not exists portal_level_pages_code_idx on public.portal_level_pages (code) where code is not null;
create index if not exists portal_level_pages_section_idx on public.portal_level_pages (classroom_id, level_no) where sealed_at is not null;
create index if not exists portal_level_pages_program_idx on public.portal_level_pages (user_id, program_id) where sealed_at is not null;
create index if not exists portal_level_pages_email_idx on public.portal_level_pages (email);
create index if not exists portal_level_pages_history_idx on public.portal_level_pages using gin (history);

alter table public.portal_level_pages enable row level security;
-- صاحب الصفحة يقرأ صفّه (الكتابة كلّها عبر مفتاح الخدمة من /api/me/level)
drop policy if exists "level_pages_owner_read" on public.portal_level_pages;
create policy "level_pages_owner_read" on public.portal_level_pages for select to authenticated using (auth.uid() = user_id);

comment on table public.portal_level_pages is 'P70 صفحة المستوى — بكلمات المتدرّب: ما كتبه وقاله في المستوى (سطوره · التزاماته · نصّه وصوته في عُبور) + سطر المستوى + ختم ATH-LV (JCS/SHA-256). خاصّة افتراضيًا، الصوت لا يسافر، الحذف فوري.';

-- ─── تشخيص (المتوقَّع: rows = 0 · indexes = 7 · policies = 1 · columns = 20) ───
select 'rows' as k, count(*)::text as v from public.portal_level_pages
union all select 'indexes', count(*)::text from pg_indexes where schemaname = 'public' and tablename = 'portal_level_pages'
union all select 'policies', count(*)::text from pg_policies where schemaname = 'public' and tablename = 'portal_level_pages'
union all select 'columns', count(*)::text from information_schema.columns where table_schema = 'public' and table_name = 'portal_level_pages';
