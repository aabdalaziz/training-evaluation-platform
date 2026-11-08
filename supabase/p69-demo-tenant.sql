-- © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
-- =====================================================================================================
--  P69 «غرفة العرض» — المستأجر التجريبي «قيادة افتراضية — المنطقة س»
--  (يُنفَّذ مرة واحدة في Supabase → SQL Editor؛ آمن للتكرار)
--  · portal_organizations.demo : وسم الجهة الافتراضية (شريط «عرض — بيانات افتراضية» · لا تُحسب في أي تجميع عام)
--  · portal_demo_runs          : سجلّ البناء/المحو — الحالة · الخطوات · «البيان» (manifest) = كل المعرّفات التي أنشأها البناء
--                                المحو لا يلمس صفًّا ليس في البيان (الحذف بترتيب التبعيات في lib/demo/build.ts)
--  · لا مهام مجدولة · لا متغيّرات بيئة · لا حزم
-- =====================================================================================================

alter table public.portal_organizations add column if not exists demo boolean not null default false;
create index if not exists porg_demo_idx on public.portal_organizations (demo) where demo;

create table if not exists public.portal_demo_runs (
  id            bigserial primary key,
  slug          text        not null,                       -- region-x
  status        text        not null default 'building',    -- building | ready | destroying | destroyed | failed
  step_ar       text,                                       -- الخطوة الجارية (للشريط)
  log           jsonb       not null default '[]'::jsonb,   -- [{at, step, ok, n?, note_ar?}]
  manifest      jsonb       not null default '{}'::jsonb,   -- {org_id, user_ids[], program_ids[], classroom_ids[], invite_ids[], form_ids[], assessment_ids[], followup_ids[], evaluation_ids[], session_ids[], report_codes[], ...}
  presenters    jsonb       not null default '[]'::jsonb,   -- [{training_no, pin, role}] — حسابات افتراضية فقط (تُمحى مع المحو)
  anchor        date        not null default (now() at time zone 'Asia/Riyadh')::date,  -- «ساعة الصفر»: كل التواريخ نسبية لهذا اليوم
  built_by      uuid,
  built_at      timestamptz,
  destroyed_at  timestamptz,
  error_ar      text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists pdr_slug_idx on public.portal_demo_runs (slug, created_at desc);
-- بناء حيّ واحد لكل مُعرِّف
create unique index if not exists pdr_live_uidx on public.portal_demo_runs (slug) where status in ('building', 'ready', 'destroying');

alter table public.portal_demo_runs enable row level security;
revoke all on public.portal_demo_runs from anon, authenticated;
revoke all on sequence public.portal_demo_runs_id_seq from anon, authenticated;

-- ===== تشخيص (الأرقام المتوقَّعة بين الأقواس) =====
select 'p69_org_demo_col' as k, count(*)::text as v from information_schema.columns
 where table_schema = 'public' and table_name = 'portal_organizations' and column_name = 'demo'                                                   -- (1)
union all select 'p69_runs_table',  count(*)::text from information_schema.tables
 where table_schema = 'public' and table_name = 'portal_demo_runs'                                                                                -- (1)
union all select 'p69_runs_cols',   count(*)::text from information_schema.columns
 where table_schema = 'public' and table_name = 'portal_demo_runs'
   and column_name in ('slug','status','step_ar','log','manifest','presenters','anchor','built_by','built_at','destroyed_at','error_ar')         -- (11)
union all select 'p69_indexes',     count(*)::text from pg_indexes
 where schemaname = 'public' and indexname in ('porg_demo_idx','pdr_slug_idx','pdr_live_uidx')                                                    -- (3)
union all select 'p69_rls_on',      count(*)::text from pg_tables
 where schemaname = 'public' and tablename = 'portal_demo_runs' and rowsecurity                                                                    -- (1)
union all select 'p69_anon_grants', count(*)::text from information_schema.role_table_grants
 where table_schema = 'public' and table_name = 'portal_demo_runs' and grantee in ('anon','authenticated')                                        -- (0)
union all select 'p69_demo_orgs',   count(*)::text from public.portal_organizations where demo;                                                   -- (0 الآن — 1 بعد أول بناء)
