-- =====================================================================
--  م11 «مِران البداية» — تدريب ما بعد التشخيص (Miaar Start — post-diagnostic practice)
--  مِعيار — من أَثَر · © 2026 د. أحمد محمد عبدالعزيز بدوي
--
--  عمود واحد على خطط مِران: kind = 'exit' (بعد حكم العبور · م10) | 'placement' (بعد التشخيص/التسكين · م11)
--  آمن لإعادة التشغيل.
-- =====================================================================
alter table public.miaar_practice_plans add column if not exists kind text not null default 'exit';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'mpp_kind_chk') then
    alter table public.miaar_practice_plans add constraint mpp_kind_chk check (kind in ('exit','placement'));
  end if;
end $$;
create index if not exists mpp_kind_idx on public.miaar_practice_plans (kind, status);
comment on column public.miaar_practice_plans.kind is 'exit = بعد حكم العبور (م10) · placement = بعد التشخيص والتسكين (م11)';
notify pgrst, 'reload schema';

-- تشخيص (المتوقّع: col=1 · chk=1 · idx=1)
select
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'miaar_practice_plans' and column_name = 'kind') as col,
  (select count(*) from pg_constraint where conname = 'mpp_kind_chk') as chk,
  (select count(*) from pg_indexes where schemaname = 'public' and indexname = 'mpp_kind_idx') as idx;
