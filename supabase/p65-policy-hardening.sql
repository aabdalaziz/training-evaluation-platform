-- © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
-- =====================================================================================================
--  P65-ب «درع أَثَر — تصلّب السياسات» (2026-11-08) — نتيجة أول تقرير سياسات حيّ على قاعدة الإنتاج
--  آمن للتكرار · لا يحذف بيانات · لا يغيّر أيّ صفحة تعمل اليوم (كل مسار عام مُراجَع: استمارات التقييم، استبيان التعلّم عن بُعد، «تواصل»)
--
--  ما وجده التقرير (CSV 2026-11-08):
--   • 23 جدولًا «كتابة مجهولة»: 19 منها علمٌ كاذب (سياسات بدور public لكن مشروطة بـ auth.uid()/can_administer_organization → الزائر لا يملك uid)،
--     و4 مقصودة بالتصميم (إدراج فقط): evaluations · evaluation_answers · remote_learning_survey_responses · portal_contact_messages.
--   • الزائر (anon) يحمل صلاحيات INSERT/UPDATE/DELETE/TRUNCATE على كل الجداول (افتراض Supabase) — كانت RLS وحدها الحاجز. هنا نسحبها: دفاع في العمق.
--   • كتالوجان مقروءان للزائر بكل أعمدتهما: trainers (phone/email) و classrooms (join_url/host_url = روابط دخول/استضافة القاعات) → قراءة على مستوى الأعمدة.
--   • أيّ مسجَّل (حتى المتدرّب) كان يستطيع الكتابة على classrooms وtrainers (auth_all_*) → قراءة للمسجَّلين، كتابة للطاقم فقط.
-- =====================================================================================================

-- 1) تقرير السياسات: الحقيقة = صلاحية الجدول × السياسة (لا السياسة وحدها)
drop function if exists public.shield_policy_report();
create function public.shield_policy_report()
returns table (table_name text, rls_enabled boolean, policy_count integer, anon_read boolean, anon_write boolean, open_read boolean)
language sql security definer set search_path = public as $$
  with pol as (select tablename, cmd, roles, qual, with_check, permissive from pg_policies where schemaname = 'public')
  select c.relname::text, c.relrowsecurity,
         (select count(*)::integer from pol p where p.tablename = c.relname),
         -- anon_read: الزائر يملك SELECT (على الجدول أو عمود منه) و(لا RLS أو سياسة قراءة متساهلة له)
         has_any_column_privilege('anon', c.oid, 'SELECT')
           and (not c.relrowsecurity or exists (select 1 from pol p where p.tablename = c.relname and p.permissive = 'PERMISSIVE'
                  and (p.roles @> '{anon}'::name[] or p.roles @> '{public}'::name[]) and p.cmd in ('SELECT', 'ALL'))),
         -- anon_write: الزائر يملك INSERT/UPDATE/DELETE و(لا RLS أو سياسة كتابة له صراحةً، أو بدور public بشرط «true» عارٍ)
         (has_table_privilege('anon', c.oid, 'INSERT') or has_table_privilege('anon', c.oid, 'UPDATE') or has_table_privilege('anon', c.oid, 'DELETE'))
           and (not c.relrowsecurity or exists (select 1 from pol p where p.tablename = c.relname and p.permissive = 'PERMISSIVE'
                  and p.cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
                  and (p.roles @> '{anon}'::name[] or (p.roles @> '{public}'::name[] and coalesce(p.with_check, p.qual, 'true') = 'true')))),
         -- open_read: الصفّ كاملًا مقروء للجميع بلا شرط (كتالوج عام)
         has_table_privilege('anon', c.oid, 'SELECT')
           and (not c.relrowsecurity or exists (select 1 from pol p where p.tablename = c.relname and p.permissive = 'PERMISSIVE'
                  and (p.roles @> '{anon}'::name[] or p.roles @> '{public}'::name[]) and p.cmd in ('SELECT', 'ALL') and p.qual = 'true'))
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p')
  order by c.relrowsecurity asc, c.relname;
$$;
revoke all on function public.shield_policy_report() from public, anon, authenticated;

-- 2) سحب صلاحيات الكتابة الافتراضية من الزائر على كل جداول public، ثم إعادة «إدراج فقط» للاستمارات العامة الأربع
-- (التشغيل الحيّ 2026-11-08: الجداول وحدها أبقت 24 صلاحية على 4 Views أُنشئت يدويًا → الحلقة تشمل الآن views/matviews/foreign)
do $$ declare r record; begin
  for r in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'f') loop
    begin
      execute format('revoke insert, update, delete, truncate, references, trigger on public.%I from anon', r.relname);
    exception when others then null;  -- بعض الأنواع لا تقبل كل الصلاحيات
    end;
  end loop;
end $$;
grant insert on public.evaluations, public.evaluation_answers, public.remote_learning_survey_responses, public.portal_contact_messages to anon;
-- الجداول القادمة لا تحصل على كتابة للزائر تلقائيًا (ما يُنشأ من محرّر SQL يملكه postgres)
alter default privileges for role postgres in schema public revoke insert, update, delete, truncate, references, trigger on tables from anon;

-- 3) أعمدة حسّاسة في كتالوجَين مقروءَين للزائر: قراءة على مستوى الأعمدة (الصفحات العامة تطلب أعمدة محدَّدة — مُراجَعة)
do $$ declare cols text; begin
  revoke select on public.trainers from anon;
  select string_agg(format('%I', column_name), ', ' order by ordinal_position) into cols
    from information_schema.columns where table_schema = 'public' and table_name = 'trainers' and column_name not in ('phone', 'email');
  execute format('grant select (%s) on public.trainers to anon', cols);
  revoke select on public.classrooms from anon;
  select string_agg(format('%I', column_name), ', ' order by ordinal_position) into cols
    from information_schema.columns where table_schema = 'public' and table_name = 'classrooms' and column_name not in ('join_url', 'host_url');
  execute format('grant select (%s) on public.classrooms to anon', cols);
end $$;

-- 4) القاعات والمدرّبون: قراءة لكل مسجَّل (كما كانت) · كتابة للطاقم والمدرّبين فقط (لا للمتدرّب)
create or replace function public.shield_legacy_staff() returns boolean language sql stable security definer set search_path = public as $$
  select public.portal_is_staff()
      or exists (select 1 from public.profiles p where p.id = auth.uid()
                  and upper(p.role::text) in ('PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'QUALITY_ANALYST', 'TRAINER'));
$$;
grant execute on function public.shield_legacy_staff() to authenticated;

drop policy if exists auth_all_classrooms   on public.classrooms;
drop policy if exists auth_read_classrooms  on public.classrooms;
drop policy if exists staff_write_classrooms on public.classrooms;
create policy auth_read_classrooms   on public.classrooms for select to authenticated using (true);
create policy staff_write_classrooms on public.classrooms for all    to authenticated using (public.shield_legacy_staff()) with check (public.shield_legacy_staff());

drop policy if exists auth_all_trainers    on public.trainers;
drop policy if exists auth_read_trainers   on public.trainers;
drop policy if exists staff_write_trainers on public.trainers;
create policy auth_read_trainers   on public.trainers for select to authenticated using (true);
create policy staff_write_trainers on public.trainers for all    to authenticated using (public.shield_legacy_staff()) with check (public.shield_legacy_staff());

-- =====================================================================================================
--  التشخيص (النتيجة المتوقَّعة بين قوسين)
-- =====================================================================================================
select 'anon_write_tables' as k, string_agg(table_name, ', ' order by table_name) as v from public.shield_policy_report() where anon_write     -- (الأربعة فقط: evaluation_answers, evaluations, portal_contact_messages, remote_learning_survey_responses)
union all select 'anon_write_count',  count(*)::text from public.shield_policy_report() where anon_write                                          -- (4)
union all select 'anon_grants_write', count(*)::text from information_schema.role_table_grants
  where grantee = 'anon' and table_schema = 'public' and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER')    -- (4)
union all select 'hidden_columns',    count(*)::text from information_schema.column_privileges
  where grantee = 'anon' and table_schema = 'public' and ((table_name = 'trainers' and column_name in ('phone', 'email')) or (table_name = 'classrooms' and column_name in ('join_url', 'host_url')))  -- (0)
union all select 'trainers_anon_cols', count(*)::text from information_schema.column_privileges where grantee = 'anon' and table_schema = 'public' and table_name = 'trainers' and privilege_type = 'SELECT'     -- (عدد أعمدة trainers − 2)
union all select 'classrooms_policies', count(*)::text from pg_policies where tablename = 'classrooms' and policyname in ('auth_read_classrooms', 'staff_write_classrooms')   -- (2)
union all select 'trainers_policies',   count(*)::text from pg_policies where tablename = 'trainers'   and policyname in ('auth_read_trainers', 'staff_write_trainers')       -- (2)
union all select 'tables_without_rls',  count(*)::text from public.shield_policy_report() where not rls_enabled                                   -- (0)
union all select 'tables_open_read',    count(*)::text from public.shield_policy_report() where open_read;                                        -- (≈19: كتالوجات عامة — trainers وclassrooms لم يعودا «كاملَي القراءة»)
