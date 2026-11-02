-- © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
-- مِعيار — من أَثَر · م4-ب «غرفة الأداء»: أداءات الكتابة والتحدّث (نص · تسجيل في المخزن الخاص miaar-media) · حالة التصحيح · الإصدار على الرمز نفسه.
-- آمن لإعادة التشغيل (idempotent). لا يمسّ الجلسات ولا التقارير القائمة. القراءة والكتابة بصلاحية الخدمة فقط (RLS بلا سياسات عامة).

-- 0) حارس الترتيب (درس حادثة 2026-11-02: هجرة م2-ب كانت غائبة فتعطّل البدء بصمت) — يتوقّف برسالة واضحة إن لم تُطبَّق الهجرات السابقة
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'placement_secure_sessions' and column_name = 'plan') then
    raise exception 'مِعيار م4-ب: شغّل هجرة م2-ب أولًا (20261217_portal_miaar_m2b.sql) — عمود placement_secure_sessions.plan مفقود';
  end if;
  if not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'miaar_rubric_bands') then
    raise exception 'مِعيار م4-ب: شغّل هجرة م4-أ أولًا (20270108_portal_miaar_m4a.sql) — جدول miaar_rubric_bands مفقود';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'question_bank_items' and column_name = 'task') then
    raise exception 'مِعيار م4-ب: شغّل هجرة م4-أ أولًا — عمود question_bank_items.task مفقود';
  end if;
end $$;

-- 1) الجلسة تحفظ مهمّتي الغرفة لحظة دخولها (الرمزان + المستوى المستهدف + المسودّات)
alter table public.placement_secure_sessions add column if not exists productive jsonb;

-- 2) الأداءات
create table if not exists public.miaar_performances (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.placement_secure_sessions(id) on delete cascade,
  report_id uuid references public.placement_reports(id) on delete set null,
  item_id uuid references public.question_bank_items(id) on delete set null,
  item_code text not null,
  skill text not null check (skill in ('writing','speaking')),
  level_target text not null,
  candidate_email text, user_id uuid,
  text_answer text, transcript text,
  media_path text, media_mime text, duration_sec int, word_count int,
  ai_consent boolean not null default false,
  accommodation text,
  status text not null default 'submitted' check (status in ('submitted','ai_rated','rated','released','skipped')),
  ai_rating jsonb, human_rating jsonb, rater_id uuid, rater_note_ar text, rated_at timestamptz, released_at timestamptz,
  expires_at timestamptz not null default (now() + interval '180 days'),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (session_id, skill)
);
create index if not exists miaar_performances_status_idx on public.miaar_performances(status, created_at);
create index if not exists miaar_performances_report_idx on public.miaar_performances(report_id) where report_id is not null;
create index if not exists miaar_performances_email_idx on public.miaar_performances(candidate_email);
alter table public.miaar_performances enable row level security;
revoke all on public.miaar_performances from anon, authenticated;
grant all on public.miaar_performances to service_role;

-- 3) المخزن: مجلد miaar-media/performances/<session>/… يرث خصوصية الدلو (خاص؛ روابط موقَّعة 5 دقائق للمصحّح فقط)
insert into storage.buckets (id, name, public) values ('miaar-media', 'miaar-media', false) on conflict (id) do nothing;

-- 4) تشخيص (المتوقَّع): performances_table = 1 · productive_col = 1 · perf_cols ≥ 25 · bucket = 1
select (select count(*) from information_schema.tables  where table_schema = 'public' and table_name = 'miaar_performances')                        as performances_table,
       (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'placement_secure_sessions' and column_name = 'productive') as productive_col,
       (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'miaar_performances')                       as perf_cols,
       (select count(*) from storage.buckets where id = 'miaar-media')                                                                               as bucket;
