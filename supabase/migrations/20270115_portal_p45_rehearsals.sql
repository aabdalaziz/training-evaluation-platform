-- © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
-- =====================================================================================
--  P45 «بروفة» — التمرين التبادلي بين الممارسين
--  قبل أن يقع الموقف الصعب، يُجرَّب مع إنسان: ممارس يطلب بروفة لموقف (من حاجة P44، أو محطته P38، أو موقف «كل يوم مهارة»، أو يكتبه)،
--  زميل يقبل ويلعب الدور الآخر، 15 دقيقة في غرفة أَثَر (نوع غرفة جديد: rehearsal) بلا تسجيل وبلا ذكاء اصطناعي،
--  ثم جملة طيبة للآخر وجملة خاصة «ما سأفعله مختلفًا». العام: جمل «ما سأفعله مختلفًا» بإذن أصحابها حين تبلغ خمسًا في القطاع (k≥5).
--  آمن لإعادة التشغيل (idempotent).
-- =====================================================================================

-- 1) نوع غرفة جديد: rehearsal (غرفة بروفة — شخصان · 15 دقيقة)
alter table public.portal_rooms drop constraint if exists portal_rooms_kind_check;
alter table public.portal_rooms add constraint portal_rooms_kind_check check (kind in ('breakout','dialogue','consult','support','rehearsal'));

-- 2) البروفات
create table if not exists public.portal_rehearsals (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  user_id          uuid null references auth.users(id) on delete set null,     -- طالب البروفة
  email            text not null,
  name_ar          text not null default '',                                     -- يُكشف للطرف الآخر بعد القبول فقط
  sector           text not null,                                                -- من قاموس 2062 (education · health · …)
  situation_ar     text not null,                                                -- الموقف (20–300 حرفًا، بلا بريد/هاتف)
  my_role_ar       text not null default '',                                     -- دوري
  other_role_ar    text not null,                                                -- الدور الذي أحتاج من يلعبه
  source           text not null default 'free',                                 -- free | need | station | case | offer
  source_ref       text null,
  mode             text not null default 'now',                                  -- now (على الهواء · ساعتان) | scheduled (موعد خلال 7 أيام)
  scheduled_at     timestamptz null,
  real_at          timestamptz null,                                             -- تاريخ الموقف الحقيقي (اختياري) — لسؤال «كيف مرّ؟»
  circle           text not null default 'all',                                  -- all | program | need | faculty
  circle_ref       text null,                                                    -- معرّف البرنامج/الحاجة
  status           text not null default 'open',                                 -- open | accepted | done | expired | cancelled | reported
  expires_at       timestamptz not null,
  partner_user_id  uuid null references auth.users(id) on delete set null,
  partner_email    text null,
  partner_name_ar  text null,
  accepted_at      timestamptz null,
  room_code        text null,
  done_at          timestamptz null,
  how_went         text null,                                                    -- as_planned | stumbled | not_happened
  how_went_at      timestamptz null,
  reported_by      uuid null,
  reported_at      timestamptz null,
  constraint portal_rehearsals_situation_chk check (char_length(situation_ar) between 20 and 300),
  constraint portal_rehearsals_other_role_chk check (char_length(other_role_ar) between 2 and 80),
  constraint portal_rehearsals_source_chk check (source in ('free','need','station','case','offer')),
  constraint portal_rehearsals_mode_chk check (mode in ('now','scheduled')),
  constraint portal_rehearsals_circle_chk check (circle in ('all','program','need','faculty')),
  constraint portal_rehearsals_status_chk check (status in ('open','accepted','done','expired','cancelled','reported')),
  constraint portal_rehearsals_how_chk check (how_went is null or how_went in ('as_planned','stumbled','not_happened'))
);
create index if not exists portal_rehearsals_status_idx  on public.portal_rehearsals (status, expires_at);
create index if not exists portal_rehearsals_email_idx   on public.portal_rehearsals (lower(email), created_at desc);
create index if not exists portal_rehearsals_partner_idx on public.portal_rehearsals (lower(partner_email), created_at desc);
create index if not exists portal_rehearsals_circle_idx  on public.portal_rehearsals (circle, circle_ref) where status in ('open','accepted');
alter table public.portal_rehearsals enable row level security;
drop policy if exists rehearsals_own_read on public.portal_rehearsals;
create policy rehearsals_own_read on public.portal_rehearsals for select to authenticated
  using (user_id = auth.uid() or partner_user_id = auth.uid() or public.portal_is_staff());
-- الكتابة عبر الخادم فقط (service role)

-- 3) الجملتان بعد البروفة: «جملة طيبة» للطرف الآخر (≤200) · «ما سأفعله مختلفًا» لنفسي (≤300 · خاصة · تُنشر مجهّلة بإذن عند k≥5)
create table if not exists public.portal_rehearsal_notes (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  rehearsal_id   uuid not null references public.portal_rehearsals(id) on delete cascade,
  user_id        uuid null references auth.users(id) on delete set null,
  email          text not null,
  kind           text not null,                                                  -- kind_to_partner | to_self
  text_ar        text not null,
  public_ok      boolean not null default false,
  sector         text not null default '',                                       -- نسخة من البروفة لتجميع العام بلا ربط
  constraint portal_rehearsal_notes_kind_chk check (kind in ('kind_to_partner','to_self')),
  constraint portal_rehearsal_notes_text_chk check (char_length(text_ar) between 3 and 300)
);
create unique index if not exists portal_rehearsal_notes_uniq on public.portal_rehearsal_notes (rehearsal_id, lower(email), kind);
create index if not exists portal_rehearsal_notes_public_idx on public.portal_rehearsal_notes (sector, created_at desc) where kind = 'to_self' and public_ok;
alter table public.portal_rehearsal_notes enable row level security;
drop policy if exists rehearsal_notes_own_read on public.portal_rehearsal_notes;
create policy rehearsal_notes_own_read on public.portal_rehearsal_notes for select to authenticated
  using (user_id = auth.uid() or public.portal_is_staff());
-- الكتابة عبر الخادم فقط (service role)

-- =====================================================================================
--  تشخيص — المتوقَّع: tables_2 = 2 · room_kind_1 = 1 · policies_2 = 2 · notes_uniq_1 = 1 · rehearsals_0 = 0
-- =====================================================================================
select
  (select count(*) from information_schema.tables where table_schema = 'public' and table_name in ('portal_rehearsals','portal_rehearsal_notes')) as tables_2,
  (select count(*) from pg_constraint where conname = 'portal_rooms_kind_check' and pg_get_constraintdef(oid) like '%rehearsal%') as room_kind_1,
  (select count(*) from pg_policies where schemaname = 'public' and policyname in ('rehearsals_own_read','rehearsal_notes_own_read')) as policies_2,
  (select count(*) from pg_indexes where schemaname = 'public' and indexname = 'portal_rehearsal_notes_uniq') as notes_uniq_1,
  (select count(*) from public.portal_rehearsals) as rehearsals_0;
