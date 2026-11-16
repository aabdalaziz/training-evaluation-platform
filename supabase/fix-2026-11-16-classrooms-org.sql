-- © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
-- إصلاح 2026-11-16: جدول classrooms (الشُّعب) بلا عمود organization_id
-- الأثر: نموذج «شعبة جديدة» في /admin/live يفشل بـ "Could not find the 'organization_id' column of 'classrooms'"،
-- ودالّة P6 التي تُنشئ شعبة تلقائيًّا للمسجَّل المدفوع تُدرج العمود نفسه.
-- الحل: إضافة العمود بنوع عمود programs.organization_id نفسه (uuid أو text) — بلا قيد مرجعي حتى لا يكسر صفوفًا قديمة،
-- ثم إعادة تحميل مخطّط PostgREST. آمن للتكرار. لا يمسّ أي صفّ قائم.

do $$
declare v_type text;
begin
  select data_type into v_type from information_schema.columns
   where table_schema = 'public' and table_name = 'programs' and column_name = 'organization_id';
  if v_type is null then v_type := 'uuid'; end if;
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'classrooms' and column_name = 'organization_id') then
    execute format('alter table public.classrooms add column organization_id %s', v_type);
  end if;
end $$;

-- تعبئة الشُّعب القائمة من برامجها (حيث العمود فارغ)
update public.classrooms c
   set organization_id = p.organization_id
  from public.programs p
 where p.id = c.program_id and c.organization_id is null and p.organization_id is not null;

create index if not exists classrooms_org_idx on public.classrooms (organization_id);

notify pgrst, 'reload schema';

-- التشخيص (المتوقَّع: صفّ واحد — العمود موجود ونوعه كنوع programs.organization_id، وعدد الشُّعب المعبَّأة)
select
  (select data_type from information_schema.columns where table_schema = 'public' and table_name = 'classrooms' and column_name = 'organization_id') as "نوع العمود",
  (select count(*) from public.classrooms) as "الشُّعب",
  (select count(*) from public.classrooms where organization_id is not null) as "منها بجهة";
