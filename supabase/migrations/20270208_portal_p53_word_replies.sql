-- =====================================================================================
-- P53 «ردّ على الكلمة» (ردود المتعلّمين على رسائل المدرّب / Learner replies to trainer notes)
-- © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved.
-- آمن لإعادة التشغيل. يُنفَّذ قبل رفع ملفات الكود.
--   جدول واحد: portal_word_replies — ردّ واحد لكل متعلّم على كل «كلمة» (إشعار trainer_word من P51):
--     chip : لمسة من ثلاث (got_it 🌱 · need_help ✋ · will_attend 🕐) — بلا كتابة
--     text : سطر اختياري (≤ 200 حرف)
--   يصل الردّ إلى المدرّب وحده (دفتر اليوم /me/day) ولا يُستعمل في أي تقييم. يُحذف بعد 180 يومًا (سياسة الخزنة).
-- =====================================================================================

create table if not exists public.portal_word_replies (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  notice_id      uuid not null references public.portal_learner_notices(id) on delete cascade,  -- «الكلمة» المردود عليها
  trainer_id     text not null,                               -- المدرّب صاحب الكلمة (trainers.id أو معرّف الحساب)
  classroom_id   text,                                        -- الشعبة (ref_id في الإشعار) إن وُجدت
  learner_email  text not null,
  learner_name   text,
  chip           text check (chip in ('got_it','need_help','will_attend')),
  text           text check (text is null or char_length(text) <= 200),
  seen_at        timestamptz,                                 -- حين يضغط المدرّب «قرأت»
  meta           jsonb not null default '{}'::jsonb,
  constraint portal_word_replies_one_per_word_uq unique (notice_id, learner_email),
  constraint portal_word_replies_has_content_ck check (chip is not null or (text is not null and char_length(text) > 0))
);
create index if not exists portal_word_replies_trainer_idx on public.portal_word_replies (trainer_id, created_at desc);
create index if not exists portal_word_replies_learner_idx on public.portal_word_replies (learner_email, created_at desc);

alter table public.portal_word_replies enable row level security;
-- لا سياسات عامة: القراءة والكتابة عبر الواجهة البرمجية بصلاحية الخدمة فقط (المتعلّم صاحب الإشعار · المدرّب صاحب الكلمة · الطاقم للقراءة).

notify pgrst, 'reload schema';

-- تشخيص (متوقَّع: replies = 0 عند أول تشغيل · rls = true · uq = 1)
select
  (select count(*) from public.portal_word_replies) as replies,
  (select relrowsecurity from pg_class where relname = 'portal_word_replies') as rls,
  (select count(*) from pg_constraint where conname = 'portal_word_replies_one_per_word_uq') as uq;
