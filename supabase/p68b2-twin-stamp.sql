-- © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
-- P68-ب-2 «توأم النموذج» و«ختم المراقب» — يبني على P68-ب (supabase/p68b-frozen-form.sql) بلا جدول جديد
--  (1) question_bank_form_items.variant: 'a' (الورقة أ · الافتراضي لكل ما سبق) أو 'b' (التوأم) — الرمز والإصدار واحد، البنود مختلفة والخلايا نفسها
--  (2) placement_invites.proctor_stamps: قائمة أختام المراقب [{at, kind: open|close, hall, count, sessions, diff, form_code, version}] — لا أسماء
--  آمن للتكرار. شغّله كاملًا في SQL Editor ثم قارن التشخيص في الأسفل.

alter table public.question_bank_form_items add column if not exists variant text not null default 'a';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'qbfi_variant_chk') then
    alter table public.question_bank_form_items add constraint qbfi_variant_chk check (variant in ('a','b'));
  end if;
end $$;

alter table public.placement_invites add column if not exists proctor_stamps jsonb not null default '[]'::jsonb;

-- ───────── التشخيص (المتوقَّع: 1 · 1 · 1 · 0 · 0) ─────────
select 'p68b2_variant_col' as k, count(*)::text as v from information_schema.columns
 where table_schema = 'public' and table_name = 'question_bank_form_items' and column_name = 'variant'                                   -- (1)
union all select 'p68b2_stamps_col', count(*)::text from information_schema.columns
 where table_schema = 'public' and table_name = 'placement_invites' and column_name = 'proctor_stamps'                                   -- (1)
union all select 'p68b2_variant_check', count(*)::text from pg_constraint where conname = 'qbfi_variant_chk'                              -- (1)
union all select 'p68b2_items_nonA', count(*)::text from public.question_bank_form_items where variant <> 'a'                             -- (0)
union all select 'p68b2_invites_with_stamps', count(*)::text from public.placement_invites where jsonb_array_length(proctor_stamps) > 0;  -- (0)
