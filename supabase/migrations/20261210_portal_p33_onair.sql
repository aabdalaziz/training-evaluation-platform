-- © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
-- P33 «أَثَر معك — على الهواء» (Athar on Air): إنسان حاضر الآن.
--  1) portal_onair_presence   صف واحد لكل مُستقبِل: على الهواء حتى متى · ما يستقبله · مجالاته · رابطه البديل (لا يُعرض للعامة)
--  2) portal_onair_windows    نوافذ معلَنة («أكون على الهواء الثلاثاء 8–9») ≤ 5 لكل عضو
--  3) portal_onair_requests   الطلب: عونٌ سريع | جلسة دعم | استشارة — open → taken → done | escalated | expired
--  4) portal_onair_messages   خيط «عونٌ سريع» (نص فقط؛ الصوت يمرّ عبر وسائط P13-ج بلا حفظ هنا)
--  5) portal_rooms.kind += 'support' · portal_vc_issuances.kind += 'on_air' (شهادة حضور على الهواء ATH-OA)
--  آمن لإعادة التشغيل.

-- 1) الحضور
create table if not exists public.portal_onair_presence (
  user_id        uuid primary key,
  email          text not null,
  face           text not null default 'expert',            -- expert | trainer | interpreter | staff
  receives       text[] not null default '{quick,session}', -- quick | session | consult
  domains        text[] not null default '{}',              -- مهارات أَثَر (أكواد) + قطاعات
  alt_link       text,                                      -- Teams/Zoom/Meet — يظهر للطالب بعد «أستقبل» فقط
  on_air_until   timestamptz,                               -- null = ليس على الهواء
  grounded_at    timestamptz,                               -- «أُنزل من الهواء» بقرار الطاقم
  grounded_note  text,
  meta           jsonb not null default '{}'::jsonb,        -- interpreter_ok · blocked (user_ids) · last_on_at
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint portal_onair_presence_face_chk check (face in ('expert','trainer','interpreter','staff')),
  constraint portal_onair_presence_link_chk check (alt_link is null or alt_link ~* '^https://')
);
alter table public.portal_onair_presence enable row level security;
drop policy if exists onair_presence_self on public.portal_onair_presence;
create policy onair_presence_self on public.portal_onair_presence for select using (auth.uid() = user_id);
create index if not exists portal_onair_presence_until_idx on public.portal_onair_presence (on_air_until desc);

-- 2) النوافذ المعلَنة
create table if not exists public.portal_onair_windows (
  id          bigserial primary key,
  user_id     uuid not null,
  weekday     smallint not null,     -- 0 الأحد … 6 السبت
  from_min    smallint not null,     -- دقائق من منتصف الليل (توقيت الرياض)
  to_min      smallint not null,
  note_ar     text,
  created_at  timestamptz not null default now(),
  constraint portal_onair_windows_day_chk check (weekday between 0 and 6),
  constraint portal_onair_windows_span_chk check (from_min >= 0 and to_min <= 1440 and to_min - from_min between 30 and 240)
);
alter table public.portal_onair_windows enable row level security;
drop policy if exists onair_windows_public on public.portal_onair_windows;
create policy onair_windows_public on public.portal_onair_windows for select using (true);
create index if not exists portal_onair_windows_user_idx on public.portal_onair_windows (user_id);

-- 3) الطلبات
create table if not exists public.portal_onair_requests (
  id                bigserial primary key,
  kind              text not null,                     -- quick | session | consult
  status            text not null default 'open',      -- open | taken | done | escalated | expired | cancelled
  asker_user_id     uuid,
  asker_email       text,
  asker_alias       text not null,                     -- اسم مستعار يُولَّد («سائل 4821»)
  domain            text,
  text_ar           text not null,
  receiver_user_id  uuid,
  room_code         text,
  taken_at          timestamptz,
  done_at           timestamptz,
  outcome           text,                              -- solved | needs_session | needs_staff
  what_changed_ar   text,                              -- كلمات الطالب — يراها المُستقبِل وحده
  duration_min      integer,
  ip_hash           text,
  meta              jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  constraint portal_onair_requests_kind_chk check (kind in ('quick','session','consult')),
  constraint portal_onair_requests_status_chk check (status in ('open','taken','done','escalated','expired','cancelled')),
  constraint portal_onair_requests_text_chk check (char_length(text_ar) between 5 and 500)
);
alter table public.portal_onair_requests enable row level security;   -- بالخدمة فقط عبر /api/onair
create index if not exists portal_onair_requests_status_idx on public.portal_onair_requests (status, created_at desc);
create index if not exists portal_onair_requests_receiver_idx on public.portal_onair_requests (receiver_user_id, done_at desc);

-- 4) الرسائل
create table if not exists public.portal_onair_messages (
  id          bigserial primary key,
  request_id  bigint not null references public.portal_onair_requests(id) on delete cascade,
  from_role   text not null,                            -- asker | receiver | system
  text_ar     text not null,
  asker_user_id uuid null,                              -- نسخة من الطلب لتعمل «خزنة أَثَر» (النسيان) على الخيط مباشرة
  asker_email   text null,
  created_at  timestamptz not null default now(),
  constraint portal_onair_messages_role_chk check (from_role in ('asker','receiver','system')),
  constraint portal_onair_messages_text_chk check (char_length(text_ar) between 1 and 1000)
);
alter table public.portal_onair_messages enable row level security;
create index if not exists portal_onair_messages_req_idx on public.portal_onair_messages (request_id, id);

-- 5) غرفة الدعم ووثيقة الحضور
alter table public.portal_rooms drop constraint if exists portal_rooms_kind_check;
alter table public.portal_rooms add constraint portal_rooms_kind_check check (kind in ('breakout','dialogue','consult','support'));
alter table public.portal_vc_issuances drop constraint if exists portal_vc_issuances_kind_check;
alter table public.portal_vc_issuances add constraint portal_vc_issuances_kind_check
  check (kind in ('credential','snapshot','dataset','council_badge','org_charter','journey','org_journey','horizon','org_horizon','pair_pledge','org_pair_pledge','directory_card','collaboration','on_air'));

-- 6) تحديث updated_at
create or replace function public.portal_touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists portal_onair_presence_touch on public.portal_onair_presence;
create trigger portal_onair_presence_touch before update on public.portal_onair_presence for each row execute function public.portal_touch_updated_at();

-- =====================================================================================
--  تشخيص (المتوقَّع: tables_4 = 4 · room_kind_1 = 1 · vc_kind_1 = 1 · policies_2 = 2)
-- =====================================================================================
select
  (select count(*) from information_schema.tables where table_schema = 'public' and table_name in ('portal_onair_presence','portal_onair_windows','portal_onair_requests','portal_onair_messages')) as tables_4,
  (select count(*) from pg_constraint where conname = 'portal_rooms_kind_check' and pg_get_constraintdef(oid) like '%support%') as room_kind_1,
  (select count(*) from pg_constraint where conname = 'portal_vc_issuances_kind_check' and pg_get_constraintdef(oid) like '%on_air%') as vc_kind_1,
  (select count(*) from pg_policies where tablename in ('portal_onair_presence','portal_onair_windows')) as policies_2;
