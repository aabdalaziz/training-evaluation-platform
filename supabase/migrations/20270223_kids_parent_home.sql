-- © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
-- هـ-6-و «بَيْتُ بَيان» — البوّابة الأبوية لبرنامج بَيان (kids/curriculum/PARENT-GATE-PLAN.md)
-- 5 جداول · RLS على كلّها · القراءة لوليّ الأمر فقط (parent_id = auth.uid()) · الكتابة عبر /api/kids بمفتاح الخدمة فقط.
-- لا صوت ولا صورة تُخزَّن هنا أبدًا: نصّ (بإذن) وعدّادات ووجوه فقط. آمن للتكرار.

-- 1) الأطفال: كنية فقط · سنة ميلاد فقط · صورة رمزية (1..8) — لا اسم كامل ولا صورة شخصية
create table if not exists public.kids_children (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references auth.users(id) on delete cascade,
  nick text not null check (char_length(nick) between 1 and 20),
  gender text not null default 'm' check (gender in ('m','f')),
  birth_year int not null check (birth_year between 2010 and 2030),
  avatar int not null default 1 check (avatar between 1 and 8),
  created_at timestamptz not null default now(),
  archived_at timestamptz
);
create index if not exists kids_children_parent_idx on public.kids_children(parent_id) where archived_at is null;

-- 2) الأمانات (موافقات صريحة مؤرَّخة) — سجلّ إلحاقي: كلّ تبديل صفّ جديد، آخر صفّ هو الساري
create table if not exists public.kids_consents (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.kids_children(id) on delete cascade,
  kind text not null check (kind in ('speech_recog','save_text','camera','share_facilitator')),
  granted boolean not null,
  text_version int not null default 1,
  granted_by uuid not null references auth.users(id) on delete cascade,
  granted_at timestamptz not null default now(),
  expires_at timestamptz
);
create index if not exists kids_consents_child_idx on public.kids_consents(child_id, kind, granted_at desc);

-- 3) التقدّم: حدث واحد لكلّ جلسة (المحطّات · الشارة · الوجوه · مهمّة البيت)
create table if not exists public.kids_progress (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.kids_children(id) on delete cascade,
  session_slug text not null check (session_slug ~ '^[a-z0-9-]{2,24}$'),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  stations jsonb not null default '{}'::jsonb,
  badge text,
  self_check text check (self_check in ('easy','good','hard')),
  self_voice text check (self_voice in ('clear','near','again','skip')),
  home_task_done_at timestamptz,
  constraint kids_progress_unique unique (child_id, session_slug, started_at)
);
create index if not exists kids_progress_child_idx on public.kids_progress(child_id, started_at desc);

-- 4) «قالَ لِلُؤلُؤ»: نتائج الحوار (الدور/المطابقة/المحاولات، والنصّ فقط عند إذن save_text) — تُمحى بعد purge_after
create table if not exists public.kids_talks (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.kids_children(id) on delete cascade,
  session_slug text not null,
  at timestamptz not null default now(),
  results jsonb not null default '[]'::jsonb,
  self_voice text,
  purge_after timestamptz not null default (now() + interval '90 days')
);
create index if not exists kids_talks_child_idx on public.kids_talks(child_id, at desc);
create index if not exists kids_talks_purge_idx on public.kids_talks(purge_after);

-- 5) رسالة لؤلؤ الأسبوعية (نصّ قالبيّ من البيانات — لا نموذج لغوي) — تُبنى في السلسلة اليومية (runKids)
create table if not exists public.kids_letters (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.kids_children(id) on delete cascade,
  week_start date not null,
  body_ar text not null check (char_length(body_ar) <= 1200),
  sentence_ar text,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  constraint kids_letters_unique unique (child_id, week_start)
);

-- RLS: القراءة لوليّ الأمر فقط · لا كتابة من المتصفّح إطلاقًا
alter table public.kids_children enable row level security;
alter table public.kids_consents enable row level security;
alter table public.kids_progress enable row level security;
alter table public.kids_talks enable row level security;
alter table public.kids_letters enable row level security;

drop policy if exists kids_children_parent_read on public.kids_children;
create policy kids_children_parent_read on public.kids_children for select to authenticated using (parent_id = auth.uid());
drop policy if exists kids_consents_parent_read on public.kids_consents;
create policy kids_consents_parent_read on public.kids_consents for select to authenticated using (exists (select 1 from public.kids_children c where c.id = child_id and c.parent_id = auth.uid()));
drop policy if exists kids_progress_parent_read on public.kids_progress;
create policy kids_progress_parent_read on public.kids_progress for select to authenticated using (exists (select 1 from public.kids_children c where c.id = child_id and c.parent_id = auth.uid()));
drop policy if exists kids_talks_parent_read on public.kids_talks;
create policy kids_talks_parent_read on public.kids_talks for select to authenticated using (exists (select 1 from public.kids_children c where c.id = child_id and c.parent_id = auth.uid()));
drop policy if exists kids_letters_parent_read on public.kids_letters;
create policy kids_letters_parent_read on public.kids_letters for select to authenticated using (exists (select 1 from public.kids_children c where c.id = child_id and c.parent_id = auth.uid()));

revoke insert, update, delete on public.kids_children, public.kids_consents, public.kids_progress, public.kids_talks, public.kids_letters from anon, authenticated;
revoke select on public.kids_children, public.kids_consents, public.kids_progress, public.kids_talks, public.kids_letters from anon;

-- تشخيص (المتوقّع: tables=5 · policies=5 · indexes>=6 · anon_grants=0)
select 'tables' as k, count(*)::int as n from information_schema.tables where table_schema='public' and table_name in ('kids_children','kids_consents','kids_progress','kids_talks','kids_letters')
union all select 'policies', count(*)::int from pg_policies where schemaname='public' and tablename like 'kids\_%' and policyname like '%parent_read'
union all select 'indexes', count(*)::int from pg_indexes where schemaname='public' and tablename like 'kids\_%' and indexname like 'kids\_%\_idx'
union all select 'anon_grants', count(*)::int from information_schema.role_table_grants where grantee='anon' and table_schema='public' and table_name like 'kids\_%';
