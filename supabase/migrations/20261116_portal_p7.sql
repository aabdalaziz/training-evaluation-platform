-- © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
-- بوابة أَثَر — المرحلة P7: تكامل مِعيار (اختبار تحديد المستوى) — النتيجة كدليل مهارة، الإسكان حسب المستوى، التوصية بالبرامج
-- آمن للتكرار. يعتمد على P5 (المهارات/الأحداث) وP6 (الشعب/الإسكان).

-- 1) نتائج مِعيار المستوردة (المصدر: placement_reports في مشروع مِعيار)
create table if not exists public.portal_placements (
  id                 uuid primary key default gen_random_uuid(),
  source             text not null default 'miaar',
  external_id        text not null unique,                  -- placement_reports.id
  submission_id      text,
  test_version       text,
  email              text not null,
  full_name          text,
  phone              text,
  native_language    text,
  purpose            text,
  demonstrated_level text,                                  -- المستوى_المثبت
  entry_level        text,                                  -- مستوى_الالتحاق_المقترح
  overall_percent    int,
  score_text         text,                                  -- "41/60"
  skills             jsonb not null default '{}'::jsonb,    -- {grammar_vocab:{percent,level,correct,answered,total}, reading:…, listening:…}
  levels             jsonb not null default '[]'::jsonb,    -- مستويات_تفصيلية
  finish_reason      text,
  duration_text      text,
  recommendation     text,
  taken_at           timestamptz not null default now(),
  report             jsonb not null default '{}'::jsonb,    -- التقرير الأصلي كاملًا
  user_id            uuid references auth.users(id) on delete set null,
  imported_at        timestamptz not null default now(),
  created_at         timestamptz not null default now(),
  constraint pp_level_chk check (demonstrated_level is null or demonstrated_level in ('A1','A2','B1','B2','C1','C2')),
  constraint pp_entry_chk check (entry_level is null or entry_level in ('A1','A2','B1','B2','C1','C2'))
);
create index if not exists pp_email_idx on public.portal_placements (lower(email), taken_at desc);
create index if not exists pp_user_idx  on public.portal_placements (user_id, taken_at desc);
alter table public.portal_placements enable row level security;
drop policy if exists pp_own_read on public.portal_placements;
create policy pp_own_read on public.portal_placements for select to authenticated
  using (user_id = auth.uid() or lower(email) = lower(coalesce(auth.jwt()->>'email','')) or public.portal_is_staff());
grant select on public.portal_placements to authenticated;          -- الكتابة من الخادم فقط (مفتاح الخدمة)

-- ربط المستخدم تلقائيًا عند الاستيراد + تحديث مستوى التسجيلات
create or replace function public.trg_portal_placement_link() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.user_id is null then select id into new.user_id from auth.users where lower(email) = lower(new.email) limit 1; end if;
  return new;
end $$;
drop trigger if exists portal_placement_link on public.portal_placements;
create trigger portal_placement_link before insert or update on public.portal_placements for each row execute function public.trg_portal_placement_link();

-- 2) المستوى على البرامج والشعب والتسجيلات
alter table public.programs          add column if not exists cefr_level text;        -- المستوى المستهدف للبرنامج (اختياري)
alter table public.classrooms        add column if not exists cefr_level text;        -- مستوى الشعبة (اختياري) — يوجّه الإسكان
alter table public.portal_enrollments add column if not exists placement_level text;  -- لقطة مستوى الالتحاق وقت التسجيل/الإسكان
alter table public.portal_enrollments add column if not exists placement_id uuid references public.portal_placements(id) on delete set null;

-- 3) أحدث مستوى التحاق لبريد معيّن
create or replace function public.portal_latest_level(p_email text) returns text language sql stable security definer set search_path = public as $$
  select coalesce(p.entry_level, p.demonstrated_level) from public.portal_placements p where lower(p.email) = lower(p_email) order by p.taken_at desc limit 1;
$$;
revoke all on function public.portal_latest_level(text) from public, anon;
grant execute on function public.portal_latest_level(text) to authenticated, service_role;

-- 4) الإسكان حسب المستوى: شعبة بمستوى المتدرب أولًا، ثم شعبة بلا مستوى، وإلا تُنشأ شعبة بمستواه
create or replace function public.portal_place_enrollment(p_enrollment uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare e record; c record; v_count int; v_code text; v_room uuid; v_level text; v_pid uuid;
begin
  select * into e from public.portal_enrollments where id = p_enrollment;
  if not found or e.status <> 'approved' then return null; end if;
  if e.classroom_id is not null then return e.classroom_id; end if;
  v_level := coalesce(e.placement_level, public.portal_latest_level(e.email));
  if v_level is not null and e.placement_level is null then
    select id into v_pid from public.portal_placements where lower(email) = lower(e.email) order by taken_at desc limit 1;
    update public.portal_enrollments set placement_level = v_level, placement_id = v_pid where id = e.id;
  end if;
  -- (أ) شعبة بنفس المستوى
  if v_level is not null then
    for c in select cl.* from public.classrooms cl where cl.program_id = e.program_id and coalesce(cl.placement_open, true) and cl.cefr_level = v_level order by cl.code, cl.id loop
      select count(*) into v_count from public.portal_enrollments x where x.classroom_id = c.id and x.status = 'approved';
      if v_count < coalesce(c.capacity, 30) then v_room := c.id; exit; end if;
    end loop;
  end if;
  -- (ب) شعبة عامة بلا مستوى
  if v_room is null then
    for c in select cl.* from public.classrooms cl where cl.program_id = e.program_id and coalesce(cl.placement_open, true) and cl.cefr_level is null order by cl.code, cl.id loop
      select count(*) into v_count from public.portal_enrollments x where x.classroom_id = c.id and x.status = 'approved';
      if v_count < coalesce(c.capacity, 30) then v_room := c.id; exit; end if;
    end loop;
  end if;
  -- (ج) إنشاء شعبة جديدة (بمستوى المتدرب إن وُجد)
  if v_room is null then
    select count(*) + 1 into v_count from public.classrooms where program_id = e.program_id;
    v_code := 'SEC-' || lpad(v_count::text, 2, '0') || coalesce('-' || v_level, '');
    insert into public.classrooms (program_id, code, section_name, delivery_mode, organization_id, capacity, portal_created, cefr_level)
      select p.id, v_code, 'شعبة ' || v_count || coalesce(' (' || v_level || ')', ''), coalesce(p.delivery_mode, 'remote'), p.organization_id, 30, true, v_level from public.programs p where p.id = e.program_id
      returning id into v_room;
  end if;
  update public.portal_enrollments set classroom_id = v_room, placed_at = now(), updated_at = now() where id = e.id;
  insert into public.portal_learning_events (user_id, email, verb, object_type, object_id, context)
    values (e.user_id, e.email, 'placed', 'classroom', v_room::text, jsonb_build_object('program_id', e.program_id, 'enrollment_id', e.id, 'level', v_level));
  return v_room;
end $$;

-- 5) مهارات مِعيار الثلاث في تصنيف أَثَر (تُوسم بها أحداث assessed)
insert into public.portal_skills (code, name_ar, name_en, domain, level, saqf_level, cefr_level, description_ar, description_en) values
  ('ATH-AR-004', 'الاستماع والفهم بالعربية', 'Arabic listening comprehension', 'arabic', 2, 4, null, 'فهم المسموع في مواقف يومية وأكاديمية (يُقاس بمِعيار).', 'Understand spoken Arabic in daily and academic contexts (measured by Mi‘yar).'),
  ('ATH-AR-005', 'القراءة والفهم بالعربية', 'Arabic reading comprehension', 'arabic', 2, 4, null, 'فهم النصوص المقروءة بمستوياتها (يُقاس بمِعيار).', 'Understand written Arabic texts across levels (measured by Mi‘yar).'),
  ('ATH-AR-006', 'القواعد والمفردات العربية', 'Arabic grammar & vocabulary', 'arabic', 2, 4, null, 'التحكم في البنى النحوية والمفردات (يُقاس بمِعيار).', 'Control of grammatical structures and vocabulary (measured by Mi‘yar).')
on conflict (code) do nothing;

-- 6) تحقق
select 'placements table' as t, count(*) as n from information_schema.tables where table_name = 'portal_placements'
union all select 'placements policies', count(*) from pg_policies where tablename = 'portal_placements'
union all select 'cefr columns', count(*) from information_schema.columns where (table_name, column_name) in (('programs','cefr_level'),('classrooms','cefr_level'),('portal_enrollments','placement_level'),('portal_enrollments','placement_id'))
union all select 'latest_level()+place()', count(*) from pg_proc where proname in ('portal_latest_level','portal_place_enrollment')
union all select 'miaar skills', count(*) from public.portal_skills where code in ('ATH-AR-004','ATH-AR-005','ATH-AR-006');
