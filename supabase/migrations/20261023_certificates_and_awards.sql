-- =====================================================================
-- المرحلة الثالثة (D+E): الشهادات الإلكترونية + تكريم المدربين (لوحة الشرف)
-- آمن لإعادة التشغيل (idempotent)
-- =====================================================================

-- ---------------------------------------------------------------------
-- (pgcrypto لتوليد رموز التحقق)
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 0) جداول قديمة بنفس الاسم لكن ببنية مختلفة؟ نعيد تسميتها (بدون حذف بيانات)
--    ثم تُنشأ الجداول الجديدة بالبنية المطلوبة.
-- ---------------------------------------------------------------------
do $$
begin
  if to_regclass('public.trainer_awards') is not null
     and not exists (select 1 from information_schema.columns
                     where table_schema='public' and table_name='trainer_awards' and column_name='period_key') then
    execute 'alter table public.trainer_awards rename to trainer_awards_legacy_' || to_char(now(),'YYYYMMDD');
  end if;
  if to_regclass('public.certificates') is not null
     and not exists (select 1 from information_schema.columns
                     where table_schema='public' and table_name='certificates' and column_name='verify_code') then
    execute 'alter table public.certificates rename to certificates_legacy_' || to_char(now(),'YYYYMMDD');
  end if;
  if to_regclass('public.certificate_settings') is not null
     and not exists (select 1 from information_schema.columns
                     where table_schema='public' and table_name='certificate_settings' and column_name='sign1_name') then
    execute 'alter table public.certificate_settings rename to certificate_settings_legacy_' || to_char(now(),'YYYYMMDD');
  end if;
end $$;

-- D1) إعدادات الشهادة (صف واحد لكل منظمة)
-- ---------------------------------------------------------------------
create table if not exists public.certificate_settings (
  organization_id uuid primary key,
  issuer_ar     text not null default 'جامعة الأمير مقرن بن عبدالعزيز',
  issuer_en     text not null default 'Prince Mugrin University',
  unit_ar       text not null default 'بوابة التميز للاستشارات والتدريب',
  unit_en       text not null default 'CenterGate for Excellence — Consulting & Training',
  sign1_name    text not null default '',
  sign1_title   text not null default 'مدير البرامج التدريبية',
  sign2_name    text not null default '',
  sign2_title   text not null default 'المشرف العام',
  serial_prefix text not null default 'UPM',
  default_hours int  not null default 20,
  city_ar       text not null default 'المدينة المنورة',
  show_en       boolean not null default true,
  footer_ar     text not null default 'هذه الشهادة صادرة إلكترونيًا ويمكن التحقق من صحتها عبر رمز الاستجابة السريعة أو الرقم التسلسلي.',
  updated_by    uuid,
  updated_at    timestamptz not null default now()
);
alter table public.certificate_settings enable row level security;
drop policy if exists certificate_settings_rw on public.certificate_settings;
create policy certificate_settings_rw on public.certificate_settings for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and (p.organization_id = certificate_settings.organization_id or p.organization_id is null)
          and upper(p.role::text) in ('PLATFORM_ADMIN','SUPER_ADMIN','ADMIN','PROGRAM_MANAGER','QUALITY_ANALYST')))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid()
          and upper(p.role::text) in ('PLATFORM_ADMIN','SUPER_ADMIN','ADMIN','PROGRAM_MANAGER','QUALITY_ANALYST')));

-- ---------------------------------------------------------------------
-- D2) سجل الشهادات
-- ---------------------------------------------------------------------
create sequence if not exists public.certificate_serial_seq;
create table if not exists public.certificates (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid,
  serial           text unique,
  verify_code      text unique,
  kind             text not null default 'completion' check (kind in ('completion','attendance','appreciation')),
  recipient_name   text not null,
  recipient_name_en text,
  recipient_email  text,
  recipient_phone  text,
  program_id       uuid references public.programs(id) on delete set null,
  program_name     text,
  classroom_id     uuid references public.classrooms(id) on delete set null,
  classroom_code   text,
  trainer_id       uuid references public.trainers(id) on delete set null,
  trainer_name     text,
  start_date       date,
  end_date         date,
  hours            int,
  award_title      text,
  issued_at        date not null default (now() at time zone 'Asia/Riyadh')::date,
  issued_by        uuid,
  issued_by_name   text,
  sent_at          timestamptz,
  sent_to          text,
  revoked_at       timestamptz,
  revoke_reason    text,
  meta             jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now()
);
create index if not exists certificates_program_idx on public.certificates (program_id, issued_at desc);
create index if not exists certificates_org_idx on public.certificates (organization_id, created_at desc);
alter table public.certificates enable row level security;
drop policy if exists certificates_rw on public.certificates;
create policy certificates_rw on public.certificates for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and (p.organization_id = certificates.organization_id or p.organization_id is null or certificates.organization_id is null)
          and upper(p.role::text) in ('PLATFORM_ADMIN','SUPER_ADMIN','ADMIN','PROGRAM_MANAGER','QUALITY_ANALYST')))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid()
          and upper(p.role::text) in ('PLATFORM_ADMIN','SUPER_ADMIN','ADMIN','PROGRAM_MANAGER','QUALITY_ANALYST')));

-- رقم تسلسلي + رمز تحقق تلقائيان
create or replace function public.trg_certificate_defaults()
returns trigger language plpgsql security definer set search_path = public as $$
declare pfx text; nm text;
begin
  if new.serial is null then
    select coalesce(serial_prefix,'UPM') into pfx from public.certificate_settings where organization_id = new.organization_id;
    new.serial := coalesce(pfx,'UPM') || '-' || to_char(now() at time zone 'Asia/Riyadh','YYYY') || '-' || lpad(nextval('public.certificate_serial_seq')::text, 6, '0');
  end if;
  if new.verify_code is null then
    new.verify_code := upper(translate(substr(encode(gen_random_bytes(8),'base64'),1,10),'+/=0OIl','ABCDEFGH'));
  end if;
  if new.issued_by is null then new.issued_by := auth.uid(); end if;
  if new.issued_by_name is null and new.issued_by is not null then
    select full_name into nm from public.profiles where id = new.issued_by; new.issued_by_name := nm;
  end if;
  return new;
end $$;
drop trigger if exists certificate_defaults on public.certificates;
create trigger certificate_defaults before insert on public.certificates
  for each row execute function public.trg_certificate_defaults();

-- التحقق العام (بدون تسجيل دخول) — يعيد الحد الأدنى من البيانات
create or replace function public.verify_certificate(p_code text)
returns table (serial text, kind text, recipient_name text, program_name text, start_date date, end_date date, hours int, award_title text, issued_at date, issuer text, unit text, valid boolean, revoked_at timestamptz)
language sql security definer stable set search_path = public as $$
  select c.serial, c.kind, c.recipient_name, c.program_name, c.start_date, c.end_date, c.hours, c.award_title, c.issued_at,
         coalesce(s.issuer_ar, 'جامعة الأمير مقرن بن عبدالعزيز'), coalesce(s.unit_ar, 'بوابة التميز للاستشارات والتدريب'),
         (c.revoked_at is null) as valid, c.revoked_at
    from public.certificates c
    left join public.certificate_settings s on s.organization_id = c.organization_id
   where upper(c.verify_code) = upper(trim(p_code)) or upper(c.serial) = upper(trim(p_code))
   limit 1;
$$;
grant execute on function public.verify_certificate(text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- E) تكريم المدربين (الجوائز الدورية)
-- ---------------------------------------------------------------------
create table if not exists public.trainer_awards (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid,
  period_key      text not null,            -- مثل 2026-10 أو 2026-Q4 أو 2026-09-01_2026-10-31
  period_label    text not null,
  category        text not null,            -- top_mean | most_improved | most_engaged | most_consistent
  category_label  text not null,
  rank            int  not null default 1,
  trainer_id      uuid references public.trainers(id) on delete set null,
  trainer_name    text not null,
  metric_value    numeric,
  metric_label    text,
  responses       int,
  mean            numeric,
  certificate_id  uuid references public.certificates(id) on delete set null,
  note            text,
  created_by      uuid,
  created_by_name text,
  created_at      timestamptz not null default now(),
  unique (period_key, category, rank, organization_id)
);
create index if not exists trainer_awards_period_idx on public.trainer_awards (period_key, created_at desc);
alter table public.trainer_awards enable row level security;
drop policy if exists trainer_awards_rw on public.trainer_awards;
create policy trainer_awards_rw on public.trainer_awards for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and (p.organization_id = trainer_awards.organization_id or p.organization_id is null or trainer_awards.organization_id is null)))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid()
          and upper(p.role::text) in ('PLATFORM_ADMIN','SUPER_ADMIN','ADMIN','PROGRAM_MANAGER','QUALITY_ANALYST')));

-- تحقق
select 'certificates' as t, count(*) from public.certificates
union all select 'trainer_awards', count(*) from public.trainer_awards
union all select 'certificate_settings', count(*) from public.certificate_settings;
