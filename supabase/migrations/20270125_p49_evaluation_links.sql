-- =====================================================================================
--  P49 «تقويم البرامج — الرابط الذي لا يُخطئ» — الجزء 1/2: البنية
--  © 2026 د. أحمد محمد عبدالعزيز بدوي — جميع الحقوق محفوظة
--  • جدول evaluation_links (روابط التقييم الذكية: رمز قصير · نطاق · نافذة زمنية · عدّاد)
--  • evaluations.link_id (أثر الرابط) · evaluation_templates.is_default (القالب العام)
--  • توسيع نوع القالب/الاستجابة بـ END، ونوع السؤال بـ NPS_10 — بشكل دفاعي (نصّ بقيد، أو نوع تعدادي)
--  آمن لإعادة التنفيذ. نفّذ هذا الملف أوّلًا ثم ملف البذر (الجزء 2/2) في تشغيل منفصل.
-- =====================================================================================

create table if not exists public.evaluation_links (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique,
  kind          text not null check (kind in ('DAILY', 'FINAL', 'END')),
  program_id    uuid not null references public.programs(id) on delete cascade,
  classroom_id  uuid references public.classrooms(id) on delete set null,
  level         text,
  label_ar      text,
  slot_ar       text,
  opens_at      timestamptz,
  closes_at     timestamptz,
  active        boolean not null default true,
  hits          integer not null default 0,
  last_hit_at   timestamptz,
  created_by    uuid,
  created_at    timestamptz not null default now()
);
create index if not exists evaluation_links_program_idx on public.evaluation_links (program_id, created_at desc);
alter table public.evaluation_links enable row level security;
-- لا سياسات عامة: القراءة بالرمز والإنشاء/الإيقاف/الحذف تمرّ عبر الخادم (مفتاح الخدمة + تحقّق الدور)
revoke all on public.evaluation_links from anon, authenticated;

alter table public.evaluations add column if not exists link_id uuid references public.evaluation_links(id) on delete set null;
create index if not exists evaluations_link_idx on public.evaluations (link_id);
alter table public.evaluation_templates add column if not exists is_default boolean not null default false;

-- توسيع الأنواع دفاعيًّا
do $$
declare
  r record; v_type text; v_udt text; c record;
  targets text[][] := array[ array['evaluation_templates', 'kind', 'END'], array['evaluations', 'kind', 'END'], array['questions', 'kind', 'NPS_10'] ];
  t text[]; v_allowed text;
begin
  foreach t slice 1 in array targets loop
    select data_type, udt_name into v_type, v_udt from information_schema.columns where table_schema = 'public' and table_name = t[1] and column_name = t[2];
    if v_type is null then raise notice 'العمود %.% غير موجود — تخطّي', t[1], t[2]; continue; end if;
    if v_type = 'USER-DEFINED' then
      execute format('alter type public.%I add value if not exists %L', v_udt, t[3]);
      raise notice 'النوع التعدادي % أُضيفت له القيمة %', v_udt, t[3];
    else
      -- أسقط أيّ قيد تحقّق على هذا العمود يذكر القيم القديمة، ثم أضف قيدًا موسَّعًا
      for c in select con.conname from pg_constraint con join pg_class rel on rel.oid = con.conrelid join pg_namespace ns on ns.oid = rel.relnamespace
               where ns.nspname = 'public' and rel.relname = t[1] and con.contype = 'c' and pg_get_constraintdef(con.oid) ilike '%' || t[2] || '%' loop
        execute format('alter table public.%I drop constraint %I', t[1], c.conname);
      end loop;
      if t[1] = 'questions' then v_allowed := '(''RATING_5'',''STARS'',''LIKERT_5'',''YES_NO'',''SINGLE_CHOICE'',''MULTI_CHOICE'',''SHORT_TEXT'',''LONG_TEXT'',''NPS_10'')';
      else v_allowed := '(''DAILY'',''FINAL'',''END'')'; end if;
      execute format('alter table public.%I add constraint %I check (upper(%I::text) in %s) not valid', t[1], t[1] || '_' || t[2] || '_p49_chk', t[2], v_allowed);
      raise notice 'قيد % أُنشئ على %.% (غير مُتحقَّق من القديم حتى لا يكسر بيانات سابقة)', t[1] || '_' || t[2] || '_p49_chk', t[1], t[2];
    end if;
  end loop;
end $$;

-- تشخيص — المتوقَّع: links_table = 1 · link_col = 1 · default_col = 1 · end_ok = 3 (ثلاثة أعمدة تقبل القيم الجديدة)
select
  (select count(*) from information_schema.tables  where table_schema = 'public' and table_name = 'evaluation_links') as links_table,
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'evaluations' and column_name = 'link_id') as link_col,
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'evaluation_templates' and column_name = 'is_default') as default_col,
  (select count(*) from information_schema.columns where table_schema = 'public' and ((table_name in ('evaluation_templates', 'evaluations') and column_name = 'kind') or (table_name = 'questions' and column_name = 'kind'))) as end_ok;
