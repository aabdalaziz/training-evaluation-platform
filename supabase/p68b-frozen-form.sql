-- © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
-- =====================================================================================================
--  P68-ب «النموذج المثبَّت» في مِعيار — الورقة نفسها لكل المتقدّمين على الدعوة، يراها المشرف قبلهم
--  (يُنفَّذ مرة واحدة في Supabase → SQL Editor؛ آمن للتكرار)
--  · لا جدول جديد: نُحيي question_bank_forms / question_bank_form_items (موجودان منذ M1 ولم يُستعملا)
--  · question_bank_forms  : + code ATH-FM · version · invite_id · digest/proof (توقيع Ed25519) · status frozen|superseded|withdrawn
--                           · changes (سجلّ التبديلات) · seed · draw_meta · withdrawn_* · frozen_by/at · superseded_by
--  · question_bank_form_items : + item_code · level · skill (قراءة النموذج بلا join ثقيل)
--  · placement_invites    : + form_id (النموذج الحيّ للدعوة)
--  · «القفل عند أول جلسة» يُنفَّذ في الخادم (lib/miaar/forms.ts) — القاعدة: ما إن تبدأ جلسة واحدة لا تعديل ولا استبدال؛ السحب فقط بسبب
--  · لا مهام مجدولة · لا متغيّرات بيئة · لا حزم
-- =====================================================================================================

-- (1) النموذج: وثيقة موقَّعة بإصدارات
alter table public.question_bank_forms
  add column if not exists code text,
  add column if not exists version int not null default 1,
  add column if not exists invite_id uuid references public.placement_invites(id) on delete set null,
  add column if not exists digest text,
  add column if not exists proof jsonb,
  add column if not exists body jsonb,
  add column if not exists seed text,
  add column if not exists draw_meta jsonb,
  add column if not exists changes jsonb not null default '[]'::jsonb,
  add column if not exists frozen_by uuid,
  add column if not exists frozen_at timestamptz,
  add column if not exists superseded_by uuid references public.question_bank_forms(id) on delete set null,
  add column if not exists withdrawn_at timestamptz,
  add column if not exists withdrawn_by uuid,
  add column if not exists withdraw_reason text;
create unique index if not exists qbf_code_uidx on public.question_bank_forms (code, version) where code is not null;  -- الإصدارات تتشارك الرمز
create index if not exists qbf_invite_idx on public.question_bank_forms (invite_id, created_at desc);
-- نموذج حيّ واحد لكل دعوة
create unique index if not exists qbf_live_invite_uidx on public.question_bank_forms (invite_id) where status = 'frozen' and invite_id is not null;

-- (2) بنود النموذج: الرمز والمستوى والمهارة منسوخة لسرعة القراءة والمعاينة
alter table public.question_bank_form_items
  add column if not exists item_code text,
  add column if not exists level text,
  add column if not exists skill text;
create index if not exists qbfi_form_pos_idx on public.question_bank_form_items (form_id, position);

-- (3) الدعوة تشير إلى نموذجها الحيّ (null = سحب عشوائي كما كان)
alter table public.placement_invites add column if not exists form_id uuid references public.question_bank_forms(id) on delete set null;

-- (4) RLS كما بقية جداول مِعيار: الكتابة والقراءة عبر مفتاح الخدمة فقط (التحقّق العام يمرّ عبر /api/miaar?form= الذي لا يعيد نصوصًا)
alter table public.question_bank_forms enable row level security;
alter table public.question_bank_form_items enable row level security;
revoke all on public.question_bank_forms from anon, authenticated;
revoke all on public.question_bank_form_items from anon, authenticated;

-- ===== تشخيص (الأرقام المتوقَّعة بين الأقواس) =====
select 'p68b_form_cols' as k, count(*)::text as v from information_schema.columns
 where table_schema = 'public' and table_name = 'question_bank_forms'
   and column_name in ('code','version','invite_id','digest','proof','body','seed','draw_meta','changes','frozen_by','frozen_at','superseded_by','withdrawn_at','withdrawn_by','withdraw_reason')   -- (15)
union all select 'p68b_item_cols',  count(*)::text from information_schema.columns
 where table_schema = 'public' and table_name = 'question_bank_form_items' and column_name in ('item_code','level','skill')                                                                        -- (3)
union all select 'p68b_invite_col', count(*)::text from information_schema.columns
 where table_schema = 'public' and table_name = 'placement_invites' and column_name = 'form_id'                                                                                                     -- (1)
union all select 'p68b_indexes',    count(*)::text from pg_indexes
 where schemaname = 'public' and indexname in ('qbf_code_uidx','qbf_invite_idx','qbf_live_invite_uidx','qbfi_form_pos_idx')                                                                        -- (4)
union all select 'p68b_rls_on',     count(*)::text from pg_tables
 where schemaname = 'public' and tablename in ('question_bank_forms','question_bank_form_items') and rowsecurity                                                                                     -- (2)
union all select 'p68b_anon_grants', count(*)::text from information_schema.role_table_grants
 where table_schema = 'public' and table_name in ('question_bank_forms','question_bank_form_items') and grantee in ('anon','authenticated')                                                          -- (0)
union all select 'p68b_frozen',     count(*)::text from public.question_bank_forms where status = 'frozen';                                                                                         -- (0 الآن — يرتفع مع أول تثبيت)
