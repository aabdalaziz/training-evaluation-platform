-- © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
-- هـ-2 (ب) — «مجالات الخبرة» تصبح جدولًا حيًّا بدل قيد ثابت: يستطيع الطاقم إضافة مجال جديد مستقبلًا
-- بلا نشر جديد؛ قائمة «مجال الخبرة» في هيئة أَثَر الاستشارية، ومهارات أَثَر، وسيرة العضو تقرأ منه.
-- آمن للتكرار. يعتمد على P4 (portal_is_writer) وP5 (portal_skills).

create table if not exists public.portal_skill_domains (
  code        text primary key,                 -- arabic | pedagogy | … | <مجال جديد>
  name_ar     text not null,
  name_en     text not null,
  prefix      text not null unique,             -- حرفان لرمز المهارة: ATH-<prefix>-001
  tone        text not null default 'navy',     -- teal | navy | gold | ok | violet | sky | warn | rose
  sort        int  not null default 100,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint psd_code_chk   check (code ~ '^[a-z][a-z0-9_]{1,30}$'),
  constraint psd_prefix_chk check (prefix ~ '^[A-Z]{2}$')
);

insert into public.portal_skill_domains (code, name_ar, name_en, prefix, tone, sort) values
  ('arabic',     'اللغة العربية',                'Arabic language',          'AR', 'teal',   10),
  ('pedagogy',   'التعليم والتدريب',             'Pedagogy & training',      'PD', 'navy',   20),
  ('leadership', 'القيادة والإدارة',             'Leadership & management',  'LD', 'gold',   30),
  ('quality',    'الجودة والتقييم',              'Quality & evaluation',     'QA', 'ok',     40),
  ('data_ai',    'البيانات والذكاء الاصطناعي',   'Data & AI',                'DA', 'violet', 50),
  ('digital',    'التعلّم الرقمي',               'Digital learning',         'DG', 'sky',    60),
  ('research',   'البحث والتطوير',               'Research & development',   'RS', 'warn',   70),
  ('wellbeing',  'الرفاه والمهارات الشخصية',     'Wellbeing & soft skills',  'WB', 'rose',   80)
on conflict (code) do nothing;

-- القيد الثابت القديم يُستبدل بمفتاح أجنبي إلى الجدول الحيّ
alter table public.portal_skills drop constraint if exists ps_domain_chk;
alter table public.portal_skills drop constraint if exists ps_domain_fk;
alter table public.portal_skills
  add constraint ps_domain_fk foreign key (domain) references public.portal_skill_domains(code) on update cascade;

alter table public.portal_skill_domains enable row level security;
drop policy if exists psd_read on public.portal_skill_domains;
create policy psd_read on public.portal_skill_domains for select to anon, authenticated using (true);
drop policy if exists psd_write on public.portal_skill_domains;
create policy psd_write on public.portal_skill_domains for all to authenticated using (public.portal_is_writer()) with check (public.portal_is_writer());
grant select on public.portal_skill_domains to anon, authenticated;
grant insert, update, delete on public.portal_skill_domains to authenticated;
