-- أَثَر — المرحلة P1: صندوق رسائل التواصل العام
-- آمن لإعادة التشغيل (idempotent)

create table if not exists public.portal_contact_messages (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  name          text not null,
  email         text not null,
  phone         text,
  organization  text,
  subject       text not null default 'other',
  message       text not null,
  lang          text not null default 'ar',
  page          text,
  status        text not null default 'new',      -- new | handled | spam
  handled_by    uuid references auth.users(id) on delete set null,
  handled_at    timestamptz,
  notes         text,
  constraint portal_contact_messages_status_chk check (status in ('new','handled','spam')),
  constraint portal_contact_messages_len_chk check (char_length(message) between 10 and 4000 and char_length(name) between 2 and 120)
);

create index if not exists portal_contact_messages_status_idx on public.portal_contact_messages (status, created_at desc);

alter table public.portal_contact_messages enable row level security;

-- الزائر: إدراج فقط (بدون قراءة)
drop policy if exists portal_contact_insert_anyone on public.portal_contact_messages;
create policy portal_contact_insert_anyone on public.portal_contact_messages
  for insert to anon, authenticated
  with check (status = 'new' and handled_by is null and handled_at is null);

-- الموظفون: قراءة وتحديث
drop policy if exists portal_contact_staff_read on public.portal_contact_messages;
create policy portal_contact_staff_read on public.portal_contact_messages
  for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid()
                 and upper(p.role::text) in ('PLATFORM_ADMIN','SUPER_ADMIN','ADMIN','PROGRAM_MANAGER','QUALITY_ANALYST')));

drop policy if exists portal_contact_staff_update on public.portal_contact_messages;
create policy portal_contact_staff_update on public.portal_contact_messages
  for update to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid()
                 and upper(p.role::text) in ('PLATFORM_ADMIN','SUPER_ADMIN','ADMIN','PROGRAM_MANAGER','QUALITY_ANALYST')))
  with check (true);

grant insert on public.portal_contact_messages to anon, authenticated;
grant select, update on public.portal_contact_messages to authenticated;

-- القراءة العامة لبطاقات البرامج في الصفحة الرئيسية (إن لم تكن موجودة)
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'programs' and policyname = 'programs_public_cards') then
    create policy programs_public_cards on public.programs for select to anon using (archived_at is null);
  end if;
exception when others then
  raise notice 'programs_public_cards: %', sqlerrm;
end $$;
grant select on public.programs to anon;

-- تحقق
select 'portal_contact_messages' as t, count(*) as policies from pg_policies where tablename = 'portal_contact_messages'
union all
select 'programs_public_cards', count(*) from pg_policies where tablename = 'programs' and policyname = 'programs_public_cards';
