-- © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
-- أَثَر — P12-أ: مهمات في قلب العمل (Workflow Missions)
--  قوالب مهمات لكل برنامج/مهارة، مهمات مُسندة برابط موقّع بلا تسجيل دخول، أدلة حقيقية (صورة/صوت/نص/رابط) في Storage خاص،
--  فحص أولي + تأكيد مشرف بضغطة، والدليل المؤكَّد يدخل portal_learning_events (verb assessed · object mission) ثم الملف المهاري/التوأم/الشهادة الحية.
--  يُنفَّذ في SQL Editor للمشروع nybinzuqwhcctgwcimru. آمن لإعادة التنفيذ.

-- 1) قوالب المهمات
create table if not exists public.portal_mission_templates (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  created_by uuid null,
  program_id text null,
  skills uuid[] not null default '{}',
  title_ar text not null,
  title_en text null,
  brief_ar text not null,
  brief_en text null,
  evidence_mode text not null default 'text' check (evidence_mode in ('photo','audio','text','link')),
  rubric jsonb not null default '[]'::jsonb,
  days_after int not null default 7 check (days_after between 1 and 60),
  due_days int not null default 7 check (due_days between 3 and 21),
  active boolean not null default true
);
create index if not exists portal_mission_templates_program_idx on public.portal_mission_templates (program_id) where active;

-- 2) المهمات المُسندة
create table if not exists public.portal_missions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  template_id uuid null references public.portal_mission_templates(id) on delete set null,
  user_id uuid null,
  email text not null,
  full_name text null,
  program_id text null,
  skills uuid[] not null default '{}',
  title_ar text not null,
  brief_ar text not null,
  evidence_mode text not null default 'text',
  rubric jsonb not null default '[]'::jsonb,
  token text not null unique,
  confirm_token text not null unique,
  status text not null default 'assigned' check (status in ('assigned','submitted','confirmed','returned','expired')),
  due_at timestamptz not null,
  sent_at timestamptz null,
  submitted_at timestamptz null,
  evidence jsonb null,
  ai jsonb null,
  supervisor_email text null,
  supervisor_name text null,
  confirmed_at timestamptz null,
  confirmed_by text null,
  confirm_note text null,
  reminders int not null default 0
);
create index if not exists portal_missions_email_idx on public.portal_missions (lower(email));
create index if not exists portal_missions_user_idx on public.portal_missions (user_id);
create index if not exists portal_missions_status_idx on public.portal_missions (status, due_at);
create unique index if not exists portal_missions_tpl_email_uq on public.portal_missions (template_id, lower(email)) where template_id is not null;

-- 3) RLS: المتدرب يرى مهماته فقط؛ الطاقم يرى الكل؛ الكتابة والقراءة العامة بالرمز عبر مفتاح الخدمة من الـAPI فقط
alter table public.portal_mission_templates enable row level security;
alter table public.portal_missions enable row level security;
drop policy if exists mission_templates_staff_read on public.portal_mission_templates;
create policy mission_templates_staff_read on public.portal_mission_templates for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and upper(p.role::text) in ('PLATFORM_ADMIN','SUPER_ADMIN','ADMIN','PROGRAM_MANAGER','QUALITY_ANALYST')));
drop policy if exists missions_owner_read on public.portal_missions;
create policy missions_owner_read on public.portal_missions for select to authenticated
  using (user_id = auth.uid() or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
         or exists (select 1 from public.profiles p where p.id = auth.uid() and upper(p.role::text) in ('PLATFORM_ADMIN','SUPER_ADMIN','ADMIN','PROGRAM_MANAGER','QUALITY_ANALYST')));

-- 4) مخزن الأدلة (خاص؛ الوصول بروابط موقّعة قصيرة العمر من الـAPI فقط)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('portal-missions', 'portal-missions', false, 4194304, array['image/jpeg','image/png','image/webp','audio/webm','audio/ogg','audio/mp4','audio/mpeg','audio/wav'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- 5) تحقق — المتوقع: templates table 1 · missions table 1 · missions bucket 1 · policies 2
select 'templates table' as t, count(*) as n from information_schema.tables where table_schema = 'public' and table_name = 'portal_mission_templates'
union all select 'missions table', count(*) from information_schema.tables where table_schema = 'public' and table_name = 'portal_missions'
union all select 'missions bucket', count(*) from storage.buckets where id = 'portal-missions'
union all select 'policies', count(*) from pg_policies where tablename in ('portal_mission_templates', 'portal_missions');
