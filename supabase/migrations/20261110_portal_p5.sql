-- © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
-- بوابة أَثَر — المرحلة P5: مستودع الحقائب + نواة اقتصاد المهارات (المهارات، القطاعات، الجهات، سجل أحداث التعلّم)
-- آمن للتكرار. يعتمد على P4 (portal_is_staff / portal_is_writer).

-- 1) القطاعات الموحّدة (تُستخدم في البرامج والحقائب والاستشارات والتقارير)
create table if not exists public.portal_sectors (
  code        text primary key,
  name_ar     text not null,
  name_en     text not null,
  sort        int  not null default 100,
  active      boolean not null default true
);
insert into public.portal_sectors (code, name_ar, name_en, sort) values
  ('edu_k12',     'التعليم العام',            'K-12 education',            10),
  ('edu_higher',  'التعليم الجامعي',          'Higher education',          20),
  ('training',    'التدريب والتطوير',         'Training & development',    30),
  ('gov',         'القطاع الحكومي',           'Government',                40),
  ('health',      'القطاع الصحي',             'Healthcare',                50),
  ('tourism',     'السياحة والضيافة',         'Tourism & hospitality',     60),
  ('energy',      'الطاقة والصناعة',          'Energy & industry',         70),
  ('finance',     'المالية والأعمال',         'Finance & business',        80),
  ('tech',        'التقنية والاتصالات',       'Technology & telecom',      90),
  ('culture',     'الثقافة والإعلام',         'Culture & media',          100),
  ('nonprofit',   'القطاع غير الربحي',        'Non-profit',               110),
  ('private',     'القطاع الخاص (عام)',       'Private sector (general)', 120)
on conflict (code) do nothing;
alter table public.portal_sectors enable row level security;
drop policy if exists psec_read on public.portal_sectors;
create policy psec_read on public.portal_sectors for select to anon, authenticated using (true);
drop policy if exists psec_write on public.portal_sectors;
create policy psec_write on public.portal_sectors for all to authenticated using (public.portal_is_writer()) with check (public.portal_is_writer());
grant select on public.portal_sectors to anon, authenticated;
grant insert, update, delete on public.portal_sectors to authenticated;

-- 2) تصنيف المهارات الداخلي لأَثَر (مربوط بالأطر: SAQF / SDAIA / CEFR)
create table if not exists public.portal_skills (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  code         text not null unique,                 -- ATH-AR-001
  name_ar      text not null,
  name_en      text not null,
  domain       text not null,                        -- arabic | pedagogy | leadership | quality | data_ai | digital | research | wellbeing
  level        int  not null default 1,              -- 1..5 (أساسي → خبير)
  description_ar text,
  description_en text,
  saqf_level   int,                                  -- الإطار السعودي للمؤهلات 1..8
  sdaia_code   text,                                 -- رمز إطار مهارات البيانات/الذكاء الاصطناعي
  cefr_level   text,                                 -- A1..C2 (للغة)
  sector       text references public.portal_sectors(code) on delete set null,
  active       boolean not null default true,
  constraint ps_domain_chk check (domain in ('arabic','pedagogy','leadership','quality','data_ai','digital','research','wellbeing')),
  constraint ps_level_chk  check (level between 1 and 5),
  constraint ps_cefr_chk   check (cefr_level is null or cefr_level in ('A1','A2','B1','B2','C1','C2'))
);
create index if not exists ps_domain_idx on public.portal_skills (domain, level);
alter table public.portal_skills enable row level security;
drop policy if exists ps_read on public.portal_skills;
create policy ps_read on public.portal_skills for select to anon, authenticated using (active or public.portal_is_staff());
drop policy if exists ps_write on public.portal_skills;
create policy ps_write on public.portal_skills for all to authenticated using (public.portal_is_writer()) with check (public.portal_is_writer());
grant select on public.portal_skills to anon, authenticated;
grant insert, update, delete on public.portal_skills to authenticated;

insert into public.portal_skills (code, name_ar, name_en, domain, level, saqf_level, sdaia_code, cefr_level, description_ar, description_en) values
  ('ATH-AR-001', 'التواصل الشفهي بالعربية (أساسي)',     'Spoken Arabic communication (basic)',          'arabic',     1, 3, null, 'A2', 'فهم وإنتاج حوارات يومية قصيرة.', 'Understand and produce short everyday exchanges.'),
  ('ATH-AR-002', 'القراءة والكتابة الأكاديمية بالعربية', 'Academic Arabic reading & writing',           'arabic',     3, 5, null, 'B2', 'قراءة نصوص أكاديمية وكتابة تقارير قصيرة.', 'Read academic texts and write short reports.'),
  ('ATH-AR-003', 'تدريس العربية للناطقين بغيرها',        'Teaching Arabic to speakers of other languages','pedagogy',   4, 6, null, 'C1', 'تخطيط الدروس وفق CEFR وتقويم المهارات اللغوية.', 'Plan CEFR-aligned lessons and assess language skills.'),
  ('ATH-PD-001', 'تصميم البرامج التدريبية',              'Training program design',                      'pedagogy',   3, 5, null, null, 'تحليل الاحتياج، صياغة الأهداف، بناء الحقيبة.', 'Needs analysis, objectives, kit development.'),
  ('ATH-PD-002', 'التيسير والتدريب التفاعلي',            'Facilitation & interactive training',          'pedagogy',   3, 5, null, null, 'إدارة الجلسة والأنشطة والتغذية الراجعة.', 'Run sessions, activities and feedback loops.'),
  ('ATH-QA-001', 'قياس أثر التدريب',                     'Training impact measurement',                  'quality',    4, 6, null, null, 'نموذج قبلي/بعدي ونقل الأثر 60–90 يومًا.', 'Pre/post model and 60–90-day transfer follow-up.'),
  ('ATH-QA-002', 'أنظمة الجودة والاعتماد التعليمي',      'Quality systems & educational accreditation',  'quality',    4, 7, null, null, 'بناء ملفات الاعتماد ومؤشرات الأداء.', 'Build accreditation files and KPIs.'),
  ('ATH-LD-001', 'القيادة التعليمية',                    'Educational leadership',                       'leadership', 4, 7, null, null, 'قيادة الفرق والتغيير في المؤسسات التعليمية.', 'Lead teams and change in educational institutions.'),
  ('ATH-DA-001', 'محو الأمية بالبيانات',                 'Data literacy',                                'data_ai',    2, 4, 'SDAIA-DL-1', null, 'قراءة اللوحات والمؤشرات واتخاذ قرارات مبنية عليها.', 'Read dashboards and KPIs; decide with data.'),
  ('ATH-DA-002', 'الذكاء الاصطناعي في التعليم والتدريب', 'AI in education & training',                   'data_ai',    3, 5, 'SDAIA-AI-2', null, 'توظيف أدوات الذكاء الاصطناعي في التصميم والتقويم.', 'Apply AI tools in design and assessment.'),
  ('ATH-DG-001', 'التعلّم الرقمي والهجين',               'Digital & hybrid learning',                    'digital',    3, 5, null, null, 'تصميم وتشغيل تجارب تعلّم متزامنة وغير متزامنة.', 'Design and run synchronous/asynchronous learning.'),
  ('ATH-RS-001', 'البحث الإجرائي في الصف',               'Classroom action research',                    'research',   3, 6, null, null, 'تصميم دورة بحث إجرائي وقياس نتائجها.', 'Design an action-research cycle and measure results.')
on conflict (code) do nothing;

-- 3) ربط البرامج بالمهارات
create table if not exists public.portal_program_skills (
  program_id uuid not null references public.programs(id) on delete cascade,
  skill_id   uuid not null references public.portal_skills(id) on delete cascade,
  weight     int  not null default 1,
  primary key (program_id, skill_id)
);
alter table public.portal_program_skills enable row level security;
drop policy if exists pps_read on public.portal_program_skills;
create policy pps_read on public.portal_program_skills for select to anon, authenticated using (true);
drop policy if exists pps_write on public.portal_program_skills;
create policy pps_write on public.portal_program_skills for all to authenticated using (public.portal_is_writer()) with check (public.portal_is_writer());
grant select on public.portal_program_skills to anon, authenticated;
grant insert, update, delete on public.portal_program_skills to authenticated;

-- 4) الجهات العميلة (B2B)
create table if not exists public.portal_organizations (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  name_ar       text not null,
  name_en       text,
  sector        text references public.portal_sectors(code) on delete set null,
  city          text,
  contact_name  text,
  contact_email text,
  contact_phone text,
  email_domain  text,                                -- للربط التلقائي للمتعلمين (مثال: moe.gov.sa)
  notes         text,
  active        boolean not null default true
);
create index if not exists porg_domain_idx on public.portal_organizations (lower(email_domain));
alter table public.portal_organizations enable row level security;
drop policy if exists porg_staff_read on public.portal_organizations;
create policy porg_staff_read on public.portal_organizations for select to authenticated using (public.portal_is_staff());
drop policy if exists porg_write on public.portal_organizations;
create policy porg_write on public.portal_organizations for all to authenticated using (public.portal_is_writer()) with check (public.portal_is_writer());
grant select, insert, update, delete on public.portal_organizations to authenticated;

-- ربط اختياري للجهات بالتسجيلات والاستشارات (إضافة أعمدة فقط)
alter table if exists public.portal_enrollments          add column if not exists organization_id uuid references public.portal_organizations(id) on delete set null;
alter table if exists public.portal_consulting_requests  add column if not exists organization_id uuid references public.portal_organizations(id) on delete set null;
alter table if exists public.portal_invoices             add column if not exists organization_id uuid references public.portal_organizations(id) on delete set null;

-- 5) الحقائب (البيانات الوصفية — عامة للقراءة عند النشر)
create table if not exists public.portal_resources (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id) on delete set null,
  slug            text unique,
  title_ar        text not null,
  title_en        text,
  summary_ar      text,
  summary_en      text,
  body_ar         text,
  body_en         text,
  type            text not null default 'package',   -- package | guide | slides | template | video | assessment | tool | research
  sector          text references public.portal_sectors(code) on delete set null,
  skills          uuid[] not null default '{}',
  level           text not null default 'foundation', -- foundation | intermediate | advanced
  delivery        text not null default 'self',       -- self | live | hybrid
  ai_ready        boolean not null default false,     -- محتوى مهيأ للمدرّب الرقمي (مفهرس/مقسّم)
  lang            text not null default 'ar',         -- ar | en | both
  access          text not null default 'public',     -- public | registered | program | org | staff
  program_id      uuid references public.programs(id) on delete set null,
  organization_id uuid references public.portal_organizations(id) on delete set null,
  cover_url       text,
  version         text not null default '1.0',
  tags            text[] not null default '{}',
  status          text not null default 'draft',      -- draft | published | archived
  published_at    timestamptz,
  downloads       int not null default 0,
  views           int not null default 0,
  constraint pr_type_chk     check (type in ('package','guide','slides','template','video','assessment','tool','research')),
  constraint pr_level_chk    check (level in ('foundation','intermediate','advanced')),
  constraint pr_delivery_chk check (delivery in ('self','live','hybrid')),
  constraint pr_lang_chk     check (lang in ('ar','en','both')),
  constraint pr_access_chk   check (access in ('public','registered','program','org','staff')),
  constraint pr_status_chk   check (status in ('draft','published','archived'))
);
create index if not exists pr_status_idx  on public.portal_resources (status, published_at desc);
create index if not exists pr_program_idx on public.portal_resources (program_id);
create index if not exists pr_sector_idx  on public.portal_resources (sector, type);
alter table public.portal_resources enable row level security;
drop policy if exists pr_public_read on public.portal_resources;
create policy pr_public_read on public.portal_resources for select to anon, authenticated using (status = 'published' or public.portal_is_staff());
drop policy if exists pr_write on public.portal_resources;
create policy pr_write on public.portal_resources for all to authenticated using (public.portal_is_writer()) with check (public.portal_is_writer());
grant select on public.portal_resources to anon, authenticated;
grant insert, update, delete on public.portal_resources to authenticated;

-- 6) ملفات الحقيبة (مسارات التخزين — تُقرأ من الخادم فقط عبر /api/resources)
create table if not exists public.portal_resource_files (
  id           uuid primary key default gen_random_uuid(),
  resource_id  uuid not null references public.portal_resources(id) on delete cascade,
  created_at   timestamptz not null default now(),
  name         text not null,
  path         text not null,                        -- داخل bucket portal-resources: <resource_id>/<uuid>-<name>
  size         bigint not null default 0,
  mime         text,
  version      text not null default '1.0',
  sort         int  not null default 0,
  downloads    int  not null default 0
);
create index if not exists prf_res_idx on public.portal_resource_files (resource_id, sort);
alter table public.portal_resource_files enable row level security;
drop policy if exists prf_meta_read on public.portal_resource_files;
create policy prf_meta_read on public.portal_resource_files for select to anon, authenticated
  using (exists (select 1 from public.portal_resources r where r.id = resource_id and (r.status = 'published' or public.portal_is_staff())));
drop policy if exists prf_write on public.portal_resource_files;
create policy prf_write on public.portal_resource_files for all to authenticated using (public.portal_is_writer()) with check (public.portal_is_writer());
grant select on public.portal_resource_files to anon, authenticated;
grant insert, update, delete on public.portal_resource_files to authenticated;

-- 7) سجل أحداث التعلّم (xAPI مبسّط) — أساس الملف المهاري وتقارير الأثر
create table if not exists public.portal_learning_events (
  id          bigserial primary key,
  at          timestamptz not null default now(),
  user_id     uuid references auth.users(id) on delete set null,
  email       text,
  verb        text not null,                         -- viewed | downloaded | enrolled | attended | completed | assessed | paid
  object_type text not null,                         -- resource | resource_file | program | session | assessment | invoice
  object_id   text not null,
  skills      uuid[] not null default '{}',
  context     jsonb not null default '{}'::jsonb
);
create index if not exists ple_user_idx   on public.portal_learning_events (user_id, at desc);
create index if not exists ple_object_idx on public.portal_learning_events (object_type, object_id, at desc);
alter table public.portal_learning_events enable row level security;
drop policy if exists ple_own_read on public.portal_learning_events;
create policy ple_own_read on public.portal_learning_events for select to authenticated using (user_id = auth.uid() or public.portal_is_staff());
drop policy if exists ple_own_insert on public.portal_learning_events;
create policy ple_own_insert on public.portal_learning_events for insert to authenticated with check (user_id = auth.uid());
grant select, insert on public.portal_learning_events to authenticated;
grant usage, select on sequence public.portal_learning_events_id_seq to authenticated;

-- 8) حاوية التخزين الخاصة (التحميل عبر روابط موقّعة من الخادم فقط)
insert into storage.buckets (id, name, public, file_size_limit)
values ('portal-resources', 'portal-resources', false, 104857600)
on conflict (id) do update set public = false, file_size_limit = 104857600;
drop policy if exists resources_writer_upload on storage.objects;
create policy resources_writer_upload on storage.objects for insert to authenticated with check (bucket_id = 'portal-resources' and public.portal_is_writer());
drop policy if exists resources_writer_update on storage.objects;
create policy resources_writer_update on storage.objects for update to authenticated using (bucket_id = 'portal-resources' and public.portal_is_writer());
drop policy if exists resources_writer_delete on storage.objects;
create policy resources_writer_delete on storage.objects for delete to authenticated using (bucket_id = 'portal-resources' and public.portal_is_writer());
drop policy if exists resources_staff_read on storage.objects;
create policy resources_staff_read on storage.objects for select to authenticated using (bucket_id = 'portal-resources' and public.portal_is_staff());

-- 9) دالة قرار الوصول (تُستدعى من الخادم بصلاحية الخدمة، أو من العميل لمعرفة الحالة)
--    تُرجع: ok | login | program | org | staff | not_found
create or replace function public.portal_resource_access(p_resource uuid, p_user uuid default auth.uid())
returns text language plpgsql stable security definer set search_path = public as $$
declare r record; v_email text; v_domain text;
begin
  select * into r from public.portal_resources where id = p_resource and status = 'published';
  if not found then return 'not_found'; end if;
  if r.access = 'public' then return 'ok'; end if;
  if p_user is null then return 'login'; end if;
  if exists (select 1 from public.profiles p where p.id = p_user and upper(p.role::text) in ('PLATFORM_ADMIN','SUPER_ADMIN','ADMIN','PROGRAM_MANAGER','QUALITY_ANALYST','TRAINER')) then return 'ok'; end if;
  if r.access = 'registered' then return 'ok'; end if;
  if r.access = 'staff' then return 'staff'; end if;
  if r.access = 'program' then
    if r.program_id is null then return 'ok'; end if;
    if exists (select 1 from public.portal_enrollments e where e.program_id = r.program_id and e.user_id = p_user and e.status in ('approved','completed')) then return 'ok'; end if;
    return 'program';
  end if;
  if r.access = 'org' then
    if r.organization_id is null then return 'ok'; end if;
    select lower(u.email) into v_email from auth.users u where u.id = p_user;
    v_domain := split_part(coalesce(v_email, ''), '@', 2);
    if exists (select 1 from public.portal_organizations o where o.id = r.organization_id and o.email_domain is not null and lower(o.email_domain) = v_domain) then return 'ok'; end if;
    if exists (select 1 from public.portal_enrollments e where e.user_id = p_user and e.organization_id = r.organization_id) then return 'ok'; end if;
    return 'org';
  end if;
  return 'staff';
end $$;
revoke all on function public.portal_resource_access(uuid, uuid) from public;
grant execute on function public.portal_resource_access(uuid, uuid) to anon, authenticated, service_role;

-- 10) عدّادات (تُستدعى من الخادم)
create or replace function public.portal_resource_bump(p_resource uuid, p_file uuid, p_kind text)
returns void language sql security definer set search_path = public as $$
  update public.portal_resources set downloads = downloads + (case when p_kind = 'download' then 1 else 0 end), views = views + (case when p_kind = 'view' then 1 else 0 end) where id = p_resource;
  update public.portal_resource_files set downloads = downloads + 1 where p_kind = 'download' and id = p_file;
$$;
revoke all on function public.portal_resource_bump(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.portal_resource_bump(uuid, uuid, text) to service_role;

-- 11) تحقق
select 'sectors' as t, count(*) as n from public.portal_sectors
union all select 'skills seeded', count(*) from public.portal_skills
union all select 'resources policies', count(*) from pg_policies where tablename = 'portal_resources'
union all select 'files policies', count(*) from pg_policies where tablename = 'portal_resource_files'
union all select 'events policies', count(*) from pg_policies where tablename = 'portal_learning_events'
union all select 'organizations policies', count(*) from pg_policies where tablename = 'portal_organizations'
union all select 'resources bucket', count(*) from storage.buckets where id = 'portal-resources'
union all select 'storage policies', count(*) from pg_policies where tablename = 'objects' and policyname like 'resources_%'
union all select 'access()+bump()', count(*) from pg_proc where proname in ('portal_resource_access','portal_resource_bump');
