-- © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
-- P63 «يوم تخرّجي — بكلماتي» — الاسم الرسمي: صفحة التخرّج الذاتية للمتدرّب (Learner-authored graduation page)
-- جدول واحد جديد: portal_grad_pages — صفّ واحد لكل (متدرّب، برنامج).
--  • line_ar «سطر التخرّج» ≤ 160 · line_voice (jsonb: path/sec/bytes/mime/at — الصوت يبقى مع صاحبه، لا يدخل الختم ولا الوجه العام)
--  • keep (jsonb: أي بطاقة أُبقيت/أُخفيت) · public_keys (jsonb: ما يظهر على الوجه العام؛ الافتراضي السطر والأعداد) · live_public (الوجه العام مفتوح؟ الافتراضي لا)
--  • body (الجسم المختوم JCS) · code ATH-GD-XXXX-XXXX · digest SHA-256 · history (أختام سابقة أُبطلت بالاستبدال) · sealed_at · revoked_at
-- لا يمسّ أي جدول آخر. لا حذف ولا ترحيل لجدول P39 portal_after_letters (يُقرأ فقط).
-- التشغيل: Supabase → SQL Editor → New query → الصق → Run. آمن للتكرار (IF NOT EXISTS).

create table if not exists public.portal_grad_pages (
  id            bigint generated always as identity primary key,
  user_id       uuid not null,
  email         text not null,
  program_id    text not null,
  enrollment_id text,
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
  constraint portal_grad_pages_line_len check (line_ar is null or char_length(line_ar) <= 160),
  constraint portal_grad_pages_code_fmt check (code is null or code ~ '^ATH-GD-[A-Z2-9]{4}-[A-Z2-9]{4}$'),
  constraint portal_grad_pages_one_per_program unique (user_id, program_id)
);
create unique index if not exists portal_grad_pages_code_idx on public.portal_grad_pages (code) where code is not null;
create index if not exists portal_grad_pages_program_idx on public.portal_grad_pages (program_id) where sealed_at is not null;
create index if not exists portal_grad_pages_email_idx on public.portal_grad_pages (email);
create index if not exists portal_grad_pages_history_idx on public.portal_grad_pages using gin (history);

alter table public.portal_grad_pages enable row level security;
-- صاحب الصفحة يقرأ صفّه (الكتابة كلّها عبر مفتاح الخدمة من /api/me/grad)
drop policy if exists "grad_pages_owner_read" on public.portal_grad_pages;
create policy "grad_pages_owner_read" on public.portal_grad_pages for select to authenticated using (auth.uid() = user_id);

comment on table public.portal_grad_pages is 'P63 صفحة التخرّج الذاتية للمتدرّب — ما كتبه بيده في البرنامج + سطر التخرّج + ختم ATH-GD (JCS/SHA-256). خاصّة افتراضيًا. لا أثر على أي تقييم.';

-- ─── تشخيص متوقَّع بعد التشغيل ───
-- select count(*) from public.portal_grad_pages;                                   -- 0
-- select count(*) from pg_indexes where tablename = 'portal_grad_pages';           -- 5  (pkey + code + program + email + history)
-- select count(*) from pg_policies where tablename = 'portal_grad_pages';          -- 1
-- select column_name from information_schema.columns where table_name = 'portal_grad_pages' order by ordinal_position; -- 18 عمودًا
