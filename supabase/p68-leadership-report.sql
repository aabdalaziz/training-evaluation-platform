-- © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
-- =====================================================================================================
--  P68 «تقرير القيادة — صفحة واحدة تقرأها القيادة بالأرقام التدريبية لا بالأسماء»
--  (يُنفَّذ مرة واحدة في Supabase → SQL Editor؛ آمن للتكرار)
--  · portal_org_reports : تقرير قيادة لكل (جهة × فترة) — يُبنى من الأثر الحيّ ويُختم «ATH-LR» عند الإصدار، ثم يُختم القرار داخله
--                         (الوثيقة المختومة لا تحمل اسم شخص واحد: أرقام تدريبية/أعداد فقط · k≥5 · موقَّعة Ed25519)
--  · portal_organizations.logo : شعار الجهة (صورة صغيرة مضمَّنة data:image/… ≤ 96 KB) — يظهر على بطاقة الدعوة وتقرير القيادة
--  · لا مهام مجدولة جديدة · لا متغيّرات بيئة · لا حزم
-- =====================================================================================================

-- (1) شعار الجهة (مضمَّن — لا تخزين ملفات، لا روابط خارجية)
alter table public.portal_organizations add column if not exists logo text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'porg_logo_chk') then
    alter table public.portal_organizations add constraint porg_logo_chk check (logo is null or (logo like 'data:image/%' and length(logo) <= 131072));
  end if;
end $$;

-- (2) تقارير القيادة
create table if not exists public.portal_org_reports (
  id               bigserial primary key,
  organization_id  uuid        not null references public.portal_organizations(id) on delete cascade,
  code             text        not null unique,                         -- ATH-LR-XXXX-XXXX
  kind             text        not null default 'quarter' check (kind in ('quarter', 'month', 'custom', 'since_last')),
  period_from      date        not null,
  period_to        date        not null,
  status           text        not null default 'issued' check (status in ('issued', 'revoked')),
  issued_at        timestamptz not null default now(),
  issued_by        uuid        references auth.users(id) on delete set null,
  issued_name      text,                                                -- اسم المُصدِر ومنصبه كما كتبهما (هذا ما تريده القيادة على الورقة)
  issued_title     text,
  body             jsonb       not null default '{}'::jsonb,            -- الوثيقة الموقَّعة (المقاطع السبعة + القرار إن وُجد + proof)
  digest           text,                                                -- sha256 للوثيقة بلا proof — للتحقّق من السلامة
  decision         jsonb,                                               -- { key, text_ar, target, note_ar } — يُختم داخل الوثيقة
  decision_at      timestamptz,
  decision_by      uuid        references auth.users(id) on delete set null,
  reissued_from    bigint      references public.portal_org_reports(id) on delete set null,  -- إعادة إصدار (تُلغي السابق)
  revoked_at       timestamptz,
  created_at       timestamptz not null default now(),
  constraint por_period_chk check (period_to >= period_from),
  constraint por_code_chk   check (code ~ '^ATH-LR-[A-Z2-9]{4}-[A-Z2-9]{4}$')
);
create index if not exists por_org_idx  on public.portal_org_reports (organization_id, issued_at desc);
create unique index if not exists por_live_period_uidx on public.portal_org_reports (organization_id, period_from, period_to) where status = 'issued';  -- تقرير حيّ واحد لكل (جهة × فترة)

alter table public.portal_org_reports enable row level security;
drop policy if exists por_staff_read on public.portal_org_reports;
create policy por_staff_read on public.portal_org_reports for select to authenticated using (public.portal_is_staff());
drop policy if exists por_orgadmin_read on public.portal_org_reports;
create policy por_orgadmin_read on public.portal_org_reports for select to authenticated
  using (exists (select 1 from public.portal_org_members m where m.organization_id = portal_org_reports.organization_id and m.user_id = auth.uid() and m.role = 'org_admin' and m.status = 'confirmed'));
revoke all on public.portal_org_reports from anon;
revoke insert, update, delete on public.portal_org_reports from authenticated;
-- الكتابة عبر مفتاح الخدمة فقط (/api/org/report) · التحقّق العام عبر /api/org/report?verify= (يقرأ الوثيقة المختومة فقط — بلا أشخاص)

-- (3) تحقّق عام بالرمز — دالة آمنة تُعيد الوثيقة الموقَّعة (الملغاة تُعاد بحالتها حتى يقول /verify الصدق: «صدر بعده تقرير أحدث»)
create or replace function public.portal_org_report_by_code(p_code text) returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce((select jsonb_build_object('code', r.code, 'status', r.status, 'kind', r.kind, 'period_from', r.period_from, 'period_to', r.period_to, 'issued_at', r.issued_at,
                                             'digest', r.digest, 'body', r.body, 'organization', o.name_ar, 'logo', o.logo, 'policy', o.policy, 'revoked_at', r.revoked_at,
                                             'decision_at', r.decision_at,
                                             'superseded', exists (select 1 from public.portal_org_reports n where n.reissued_from = r.id and n.status = 'issued'))
                     from public.portal_org_reports r join public.portal_organizations o on o.id = r.organization_id
                    where r.code = upper(trim(p_code))), '{}'::jsonb);
$$;
grant execute on function public.portal_org_report_by_code(text) to anon, authenticated;

-- ===== تشخيص (الأرقام المتوقَّعة بين الأقواس) =====
select 'p68_columns' as k, count(*)::text as v from information_schema.columns
 where table_schema = 'public' and table_name = 'portal_organizations' and column_name = 'logo'                                                                 -- (1)
union all select 'p68_tables',      count(*)::text from pg_tables where schemaname = 'public' and tablename = 'portal_org_reports'                            -- (1)
union all select 'p68_functions',   count(*)::text from pg_proc where proname = 'portal_org_report_by_code'                                                     -- (1)
union all select 'p68_policies',    count(*)::text from pg_policies where schemaname = 'public' and tablename = 'portal_org_reports'                           -- (2)
union all select 'p68_rls_on',      count(*)::text from pg_tables where schemaname = 'public' and tablename = 'portal_org_reports' and rowsecurity             -- (1)
union all select 'p68_anon_grants', count(*)::text from information_schema.role_table_grants
 where table_schema = 'public' and table_name = 'portal_org_reports' and grantee = 'anon'                                                                      -- (0)
union all select 'p68_reports',     count(*)::text from public.portal_org_reports                                                                             -- (0 الآن — يرتفع مع أول تقرير)
union all select 'p68_fn_ok',       (public.portal_org_report_by_code('ATH-LR-AAAA-AAAA') = '{}'::jsonb)::text;                                               -- (true)
