-- © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
-- P42-ب «الأبواب الحيّة»: دعوة جماعية بـQR + مصدر المنحة من هيئة أَثَر/الدعوة الجماعية
-- (المؤشرات تُقرأ من الجداول القائمة بصلاحية الخدمة — لا جداول جديدة)

-- 1) الدعوة الجماعية: نوع + مقاعد + عدّاد + اسم؛ البريد اختياري لها فقط
alter table public.portal_role_invites
  add column if not exists kind     text    not null default 'personal',
  add column if not exists max_uses integer not null default 1,
  add column if not exists uses     integer not null default 0,
  add column if not exists label    text;
alter table public.portal_role_invites alter column email drop not null;
alter table public.portal_role_invites drop constraint if exists pri_email_chk;
alter table public.portal_role_invites add constraint pri_email_chk
  check (kind = 'group' or (email is not null and position('@' in email) > 1));
alter table public.portal_role_invites drop constraint if exists pri_kind_chk;
alter table public.portal_role_invites add constraint pri_kind_chk
  check (kind in ('personal','group') and max_uses between 1 and 500 and uses between 0 and max_uses and (kind = 'personal' or (label is not null and max_uses >= 2)));

-- 2) مصدر المنحة: + directory (اعتماد هيئة أَثَر) + group (دعوة جماعية)
alter table public.portal_role_grants drop constraint if exists portal_role_grants_source_check;
alter table public.portal_role_grants add constraint portal_role_grants_source_check
  check (source in ('invite','manual','legacy','system','directory','group'));
create index if not exists portal_role_grants_invite_idx on public.portal_role_grants (invite_id) where invite_id is not null;

-- تشخيص: المتوقع p42b_cols = 4 · p42b_sources = 6
select
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'portal_role_invites' and column_name in ('kind','max_uses','uses','label')) as p42b_cols,
  (select count(*) from unnest(array['invite','manual','legacy','system','directory','group']) s
     where exists (select 1 from pg_constraint where conname = 'portal_role_grants_source_check' and pg_get_constraintdef(oid) like '%' || s || '%')) as p42b_sources;
