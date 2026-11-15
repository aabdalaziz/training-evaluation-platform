-- © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
-- الفحص الأمني على النطاق الرسمي (2026-11-15) — تصليب قاعدة البيانات (آمن لإعادة التشغيل)
--  (1) portal_needs: كانت سياسة القراءة العامة تكشف email / user_id / adopter_email لأي حامل للمفتاح العام.
--      القراءة العامة تمرّ حصرًا عبر /api/needs (مفتاح الخدمة) الذي يحذف البيانات الشخصية. السياسة الجديدة: صاحب الاحتياج، متبنّيه، أو الطاقم.
--  (2) portal_oauth_gc(): كانت قابلة للاستدعاء من أي زائر (حذف أكواد OAuth المنتهية) — تُقصر على مفتاح الخدمة.
--  (3) portal_latest_level(email): كانت متاحة لأي مستخدم مسجَّل → استعلام مستوى أي بريد. تُقصر على مفتاح الخدمة والمحفّزات.
create temp table if not exists _sec_log (step text, detail text);

-- (1) portal_needs
drop policy if exists needs_public_read on public.portal_needs;
drop policy if exists needs_own_read on public.portal_needs;
create policy needs_own_read on public.portal_needs for select to authenticated
  using (user_id = auth.uid() or adopter_user_id = auth.uid() or public.portal_is_staff());
insert into _sec_log values ('1 portal_needs', 'needs_public_read dropped; needs_own_read created');

-- (2) portal_oauth_gc
do $$ begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'portal_oauth_gc') then
    revoke execute on function public.portal_oauth_gc() from public, anon, authenticated;
    grant execute on function public.portal_oauth_gc() to service_role;
    insert into _sec_log values ('2 portal_oauth_gc', 'execute revoked from public/anon/authenticated');
  else insert into _sec_log values ('2 portal_oauth_gc', 'function not found — skipped'); end if;
end $$;

-- (3) portal_latest_level
do $$ begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'portal_latest_level') then
    revoke execute on function public.portal_latest_level(text) from public, anon, authenticated;
    grant execute on function public.portal_latest_level(text) to service_role;
    insert into _sec_log values ('3 portal_latest_level', 'execute revoked from authenticated');
  else insert into _sec_log values ('3 portal_latest_level', 'function not found — skipped'); end if;
end $$;

-- التشخيص (صفوف نتيجة): المتوقَّع needs_public_read = 0 · needs_own_read = 1 · anon_can_gc = false · auth_can_level = false
select step, detail from _sec_log
union all select 'policy needs_public_read (expect 0)', count(*)::text from pg_policies where schemaname = 'public' and tablename = 'portal_needs' and policyname = 'needs_public_read'
union all select 'policy needs_own_read (expect 1)', count(*)::text from pg_policies where schemaname = 'public' and tablename = 'portal_needs' and policyname = 'needs_own_read'
union all select 'anon can exec portal_oauth_gc (expect false)', coalesce((select has_function_privilege('anon', 'public.portal_oauth_gc()', 'execute')::text), 'n/a')
union all select 'authenticated can exec portal_latest_level (expect false)', coalesce((select has_function_privilege('authenticated', 'public.portal_latest_level(text)', 'execute')::text), 'n/a')
union all select 'service_role can exec portal_latest_level (expect true)', coalesce((select has_function_privilege('service_role', 'public.portal_latest_level(text)', 'execute')::text), 'n/a');
