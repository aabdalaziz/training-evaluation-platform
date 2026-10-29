-- © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
-- أَثَر · P13-ب — الطيار المساعد الحي · «ماذا لو؟» · جسر المصنع ↔ عقود الأثر · PWA وإشعار «موقف اليوم»
-- آمن لإعادة التشغيل (idempotent).

-- =====================================================================================
-- 1) اشتراكات الإشعارات (Web Push) — تُكتب عبر الخادم فقط (service role)؛ المستخدم يرى اشتراكاته ويحذفها
-- =====================================================================================
create table if not exists public.portal_push_subscriptions (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  user_id       uuid null references auth.users(id) on delete cascade,
  email         text null,
  endpoint      text not null unique,
  p256dh        text not null,
  auth          text not null,
  topics        text[] not null default '{daily}',
  lang          text not null default 'ar',
  ua            text null,
  active        boolean not null default true,
  failures      int not null default 0,
  last_sent_at  timestamptz null,
  last_error    text null
);
create index if not exists portal_push_subscriptions_user_idx on public.portal_push_subscriptions(user_id);
create index if not exists portal_push_subscriptions_active_idx on public.portal_push_subscriptions(active) where active;
alter table public.portal_push_subscriptions enable row level security;
drop policy if exists "push_own_read" on public.portal_push_subscriptions;
create policy "push_own_read" on public.portal_push_subscriptions for select to authenticated using (user_id = auth.uid() or public.portal_is_staff());
drop policy if exists "push_own_delete" on public.portal_push_subscriptions;
create policy "push_own_delete" on public.portal_push_subscriptions for delete to authenticated using (user_id = auth.uid());

-- =====================================================================================
-- 2) سجل الطيار المساعد الحي — نبضات، مقترحات، قبول/تجاهل، ملاحظات المدرب أثناء الجلسة
-- =====================================================================================
create table if not exists public.portal_copilot_log (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  session_id  uuid not null references public.portal_sessions(id) on delete cascade,
  user_id     uuid null references auth.users(id) on delete set null,
  kind        text not null check (kind in ('pulse','suggested','accepted','dismissed','note','memo','approved')),
  code        text null,
  payload     jsonb not null default '{}'::jsonb
);
create index if not exists portal_copilot_log_session_idx on public.portal_copilot_log(session_id, created_at desc);
alter table public.portal_copilot_log enable row level security;
drop policy if exists "copilot_staff_all" on public.portal_copilot_log;
create policy "copilot_staff_all" on public.portal_copilot_log for all to authenticated using (public.portal_is_staff()) with check (public.portal_is_staff());

-- =====================================================================================
-- 3) محضر الأثر للجلسة — يولّده الطيار (محلي + ذكاء اصطناعي)، ويعتمده المدرب/الإدارة، ثم يراه المشاركون
-- =====================================================================================
create table if not exists public.portal_session_memos (
  session_id   uuid primary key references public.portal_sessions(id) on delete cascade,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  status       text not null default 'draft' check (status in ('draft','approved')),
  memo         jsonb not null default '{}'::jsonb,
  source       text not null default 'local' check (source in ('local','ai','human')),
  model        text null,
  generated_by uuid null references auth.users(id) on delete set null,
  approved_by  uuid null references auth.users(id) on delete set null,
  approved_at  timestamptz null
);
alter table public.portal_session_memos enable row level security;
drop policy if exists "memo_staff_all" on public.portal_session_memos;
create policy "memo_staff_all" on public.portal_session_memos for all to authenticated using (public.portal_is_staff()) with check (public.portal_is_staff());
drop policy if exists "memo_approved_read" on public.portal_session_memos;
create policy "memo_approved_read" on public.portal_session_memos for select to authenticated using (status = 'approved');

-- =====================================================================================
-- 4) «ماذا لو؟» — الجولة الثانية لموقف اليوم تُحفظ مع ردّ اليوم نفسه
-- =====================================================================================
alter table public.portal_daily_case_responses add column if not exists round2 jsonb null;

-- =====================================================================================
-- 5) جسر المصنع ↔ عقود الأثر — أثر المسودة في العقد (اختياري؛ للتتبع)
-- =====================================================================================
alter table public.portal_impact_contracts add column if not exists factory_draft_id uuid null references public.portal_program_drafts(id) on delete set null;

-- =====================================================================================
-- فحص تشخيصي — المتوقع: push_subscriptions=0 · copilot_log=0 · session_memos=0 · round2_col=1 · factory_col=1
-- =====================================================================================
select
  (select count(*) from public.portal_push_subscriptions) as push_subscriptions,
  (select count(*) from public.portal_copilot_log)        as copilot_log,
  (select count(*) from public.portal_session_memos)      as session_memos,
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'portal_daily_case_responses' and column_name = 'round2') as round2_col,
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'portal_impact_contracts' and column_name = 'factory_draft_id') as factory_col;
