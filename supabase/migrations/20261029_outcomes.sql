-- =====================================================================
-- المرحلة H1: مؤشرات النتائج المؤسسية (كيركباتريك — المستوى 4) + سلسلة الأثر 1→4
-- آمن لإعادة التشغيل (idempotent)
-- =====================================================================

do $$
begin
  if to_regclass('public.outcome_kpis') is not null
     and not exists (select 1 from information_schema.columns
                     where table_schema='public' and table_name='outcome_kpis' and column_name='direction') then
    execute 'alter table public.outcome_kpis rename to outcome_kpis_legacy_' || to_char(now(),'YYYYMMDD');
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1) مؤشرات النتائج لكل برنامج
-- ---------------------------------------------------------------------
create table if not exists public.outcome_kpis (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid,
  program_id       uuid not null references public.programs(id) on delete cascade,
  name_ar          text not null,
  name_en          text,
  unit             text not null default '%',                 -- % | عدد | درجة | دقيقة | ريال | ...
  direction        text not null default 'up' check (direction in ('up','down')),  -- up = الأعلى أفضل
  baseline         numeric,                                   -- القيمة قبل البرنامج
  baseline_date    date,
  target           numeric,                                   -- القيمة المستهدفة
  target_date      date,
  source           text,                                      -- مصدر البيانات (نظام، استبيان، تقرير إداري…)
  owner_name       text,                                      -- المسؤول عن المؤشر
  weight           int  not null default 1 check (weight between 1 and 5),
  notes            text,
  created_by       uuid,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists outcome_kpis_program_idx on public.outcome_kpis (program_id, created_at);

-- ---------------------------------------------------------------------
-- 2) القياسات الدورية للمؤشر (آخر قياس = القيمة الحالية)
-- ---------------------------------------------------------------------
create table if not exists public.outcome_measurements (
  id            uuid primary key default gen_random_uuid(),
  kpi_id        uuid not null references public.outcome_kpis(id) on delete cascade,
  value         numeric not null,
  measured_on   date not null default (now() at time zone 'Asia/Riyadh')::date,
  note          text,
  created_by    uuid,
  created_at    timestamptz not null default now()
);
create index if not exists outcome_measurements_kpi_idx on public.outcome_measurements (kpi_id, measured_on desc);

-- ---------------------------------------------------------------------
-- 3) المؤسسة تُورَّث من البرنامج + تحديث updated_at
-- ---------------------------------------------------------------------
create or replace function public.trg_outcome_kpi_defaults()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.organization_id is null then
    select organization_id into new.organization_id from public.programs where id = new.program_id;
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists outcome_kpi_defaults on public.outcome_kpis;
create trigger outcome_kpi_defaults before insert or update on public.outcome_kpis
  for each row execute function public.trg_outcome_kpi_defaults();

-- ---------------------------------------------------------------------
-- 4) الصلاحيات (RLS): قراءة لكل موظفي المنصة، كتابة للإدارة والجودة
-- ---------------------------------------------------------------------
alter table public.outcome_kpis         enable row level security;
alter table public.outcome_measurements enable row level security;

drop policy if exists outcome_kpis_rw on public.outcome_kpis;
create policy outcome_kpis_rw on public.outcome_kpis for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid()
          and upper(p.role::text) in ('PLATFORM_ADMIN','SUPER_ADMIN','ADMIN','PROGRAM_MANAGER','QUALITY_ANALYST','TRAINER')))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid()
          and upper(p.role::text) in ('PLATFORM_ADMIN','SUPER_ADMIN','ADMIN','PROGRAM_MANAGER','QUALITY_ANALYST')));

drop policy if exists outcome_measurements_rw on public.outcome_measurements;
create policy outcome_measurements_rw on public.outcome_measurements for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid()
          and upper(p.role::text) in ('PLATFORM_ADMIN','SUPER_ADMIN','ADMIN','PROGRAM_MANAGER','QUALITY_ANALYST','TRAINER')))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid()
          and upper(p.role::text) in ('PLATFORM_ADMIN','SUPER_ADMIN','ADMIN','PROGRAM_MANAGER','QUALITY_ANALYST')));
