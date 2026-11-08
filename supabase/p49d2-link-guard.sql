-- =====================================================================
-- P49-د/2 — حارس جدول الربط program_evaluation_templates: القالب الافتراضي العام «محايد المؤسسة»
-- 2026-11-08 · آمن لإعادة التنفيذ · نُفِّذ في الإنتاج (النتيجة: linked_now = 1 · unlinked_programs = 0)
--  السبب: التريغر القديم program_templates_scope_guard (دالة validate_program_template_scope من المنصّة الأصلية)
--  يشترط أن يكون البرنامج والقالب من مؤسسة واحدة — صحيح للقوالب الخاصة، خطأ للقالب الافتراضي العام (is_default).
--  القرار: دالة v2 بالقاعدة نفسها + استثناء واحد موثَّق (is_default = عام)؛ الدالة القديمة تبقى بلا حذف، التريغر يُعاد توجيهه.
-- =====================================================================
create or replace function public.validate_program_template_scope_v2()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prog_org uuid; v_tpl_org uuid; v_default boolean := false; v_has_prog_org boolean; v_has_tpl_org boolean; v_has_link_org boolean;
begin
  if not exists (select 1 from public.programs where id = new.program_id) then
    raise exception 'البرنامج غير موجود';
  end if;
  select coalesce(is_default, false) into v_default from public.evaluation_templates where id = new.template_id;
  if not found then
    raise exception 'قالب التقييم غير موجود';
  end if;
  select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'programs' and column_name = 'organization_id') into v_has_prog_org;
  select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'evaluation_templates' and column_name = 'organization_id') into v_has_tpl_org;
  select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'program_evaluation_templates' and column_name = 'organization_id') into v_has_link_org;
  if v_has_prog_org then execute 'select organization_id from public.programs where id = $1' into v_prog_org using new.program_id; end if;
  if v_has_tpl_org  then execute 'select organization_id from public.evaluation_templates where id = $1' into v_tpl_org using new.template_id; end if;
  -- P49-د: القالب الافتراضي (is_default) عام لكل المؤسسات؛ غيره يجب أن يطابق مؤسسة البرنامج
  if not v_default and v_prog_org is not null and v_tpl_org is not null and v_prog_org <> v_tpl_org then
    raise exception 'Program and template must belong to the same organization';
  end if;
  if v_has_link_org and v_prog_org is not null then
    if (to_jsonb(new)->>'organization_id') is null then
      new := jsonb_populate_record(new, jsonb_build_object('organization_id', v_prog_org));
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function public.validate_program_template_scope_v2() from public, anon, authenticated;

drop trigger if exists program_templates_scope_guard on public.program_evaluation_templates;
create trigger program_templates_scope_guard
before insert or update on public.program_evaluation_templates
for each row execute function public.validate_program_template_scope_v2();

-- ربط كل برنامج بلا قالب END نشط بالقالب الافتراضي
do $$
declare v_tpl uuid; r record; n int := 0;
begin
  select id into v_tpl from public.evaluation_templates where upper(kind::text) = 'END' and is_default limit 1;
  if v_tpl is null then return; end if;
  for r in select p.id from public.programs p
           where not exists (select 1 from public.program_evaluation_templates l join public.evaluation_templates t on t.id = l.template_id
                             where l.program_id = p.id and coalesce(l.is_active, true) and upper(t.kind::text) = 'END') loop
    begin
      insert into public.program_evaluation_templates (program_id, template_id, is_active) values (r.id, v_tpl, true); n := n + 1;
    exception when others then raise notice 'link_error %: % — %', r.id, sqlstate, sqlerrm; end;
  end loop;
  raise notice 'linked_now %', n;
end $$;

-- تشخيص — المتوقَّع: unlinked_programs = 0 · guard_v2 = 1
select
  (select count(*) from public.programs p where not exists (select 1 from public.program_evaluation_templates l join public.evaluation_templates t on t.id = l.template_id where l.program_id = p.id and coalesce(l.is_active, true) and upper(t.kind::text) = 'END')) as unlinked_programs,
  (select count(*) from pg_trigger t join pg_proc p on p.oid = t.tgfoid where t.tgname = 'program_templates_scope_guard' and p.proname = 'validate_program_template_scope_v2') as guard_v2;
