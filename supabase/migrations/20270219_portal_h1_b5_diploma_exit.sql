-- © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved.
-- هـ-1/5 (2026-11-23): توأمة البرامج والدبلومات + نظام الخروج EXIT — «لا انسحاب بلا شيء»
--  · portal_program_units.linked_program_id  مقرّر الدبلوم ⇄ برنامج في الكتالوج بمعرّف مشترك (إتمام البرنامج يُحتسب في كلّ دبلوم يحتويه)
--  · portal_unit_completions                 إتمام متدرّب لمقرّر (آلي من الحضور · اعتراف بشهادة برنامج مرتبط · أو يدوي من الطاقم) — مصدر الحقيقة الواحد
--  · portal_diploma_exits                    قيد الخروج والعودة: exited → returned · السبب · مهلة العودة ٢٤ شهرًا · الشهادات التي حملها
--  · portal_credentials.kind                 يُضاف 'achievement_record' (سجلّ إنجاز موقَّع) إلى الأنواع
--  آمنة للتكرار.

-- 1) المقرّر ⇄ البرنامج
alter table public.portal_program_units add column if not exists linked_program_id uuid references public.programs(id) on delete set null;
create index if not exists portal_program_units_linked_idx on public.portal_program_units (linked_program_id) where linked_program_id is not null;

-- 2) إتمام المقرّر لكلّ متدرّب
create table if not exists public.portal_unit_completions (
  id            uuid primary key default gen_random_uuid(),
  unit_id       uuid not null references public.portal_program_units(id) on delete cascade,
  program_id    uuid not null references public.programs(id) on delete cascade,
  enrollment_id uuid references public.portal_enrollments(id) on delete cascade,
  email         text not null,
  user_id       uuid references auth.users(id) on delete set null,
  status        text not null default 'done' check (status in ('done','not_done')),
  source        text not null default 'manual' check (source in ('attendance','credential','manual')),
  attendance_pct smallint,                                 -- نسبة الحضور المحسوبة وقت الاعتماد (إن كان المصدر الحضور)
  note          text,
  decided_by    uuid references auth.users(id) on delete set null,
  decided_at    timestamptz not null default now(),
  unique (unit_id, email)
);
create index if not exists portal_unit_completions_prog_idx on public.portal_unit_completions (program_id, lower(email));
alter table public.portal_unit_completions enable row level security;
drop policy if exists puc_own_read on public.portal_unit_completions;
create policy puc_own_read on public.portal_unit_completions for select to authenticated
  using (user_id = auth.uid() or lower(email) = lower(coalesce(auth.jwt()->>'email','')) or public.portal_is_staff());
grant select on public.portal_unit_completions to authenticated;

-- 3) قيد الخروج والعودة
create table if not exists public.portal_diploma_exits (
  id             uuid primary key default gen_random_uuid(),
  enrollment_id  uuid not null references public.portal_enrollments(id) on delete cascade,
  program_id     uuid not null references public.programs(id) on delete cascade,
  email          text not null,
  user_id        uuid references auth.users(id) on delete set null,
  state          text not null default 'exited' check (state in ('exited','returned')),
  exited_at      timestamptz not null default now(),
  reason         text,                                      -- سؤال واحد اختياري: «لماذا؟»
  reason_code    text check (reason_code in ('work','family','health','travel','finance','program','other') or reason_code is null),
  return_by      timestamptz not null,                      -- مهلة العودة (٢٤ شهرًا)
  returned_at    timestamptz,
  after_level    smallint,                                  -- خرج بعد المستوى N
  units_done     smallint not null default 0,
  levels_done    smallint not null default 0,
  credential_ids uuid[] not null default '{}',              -- شهادات البرامج التي أُصدرت عند الخروج
  record_code    text,                                      -- رمز سجلّ الإنجاز الموقَّع
  decided_by     uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create unique index if not exists portal_diploma_exits_open_idx on public.portal_diploma_exits (enrollment_id) where state = 'exited';
create index if not exists portal_diploma_exits_prog_idx on public.portal_diploma_exits (program_id, state, exited_at desc);
alter table public.portal_diploma_exits enable row level security;
drop policy if exists pde_own_read on public.portal_diploma_exits;
create policy pde_own_read on public.portal_diploma_exits for select to authenticated
  using (user_id = auth.uid() or lower(email) = lower(coalesce(auth.jwt()->>'email','')) or public.portal_is_staff());
grant select on public.portal_diploma_exits to authenticated;

-- 4) نوع شهادة جديد: سجلّ الإنجاز
alter table public.portal_credentials drop constraint if exists pcr_kind_chk;
alter table public.portal_credentials add constraint pcr_kind_chk check (kind in ('program_completion','skill','attendance','placement','achievement_record'));
