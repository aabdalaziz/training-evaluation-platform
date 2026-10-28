-- © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
-- أَثَر · P16 — الإبلاغ متعدد القنوات «نبض الوصول»
--  portal_contact_prefs : تفضيلات التواصل لكل شخص (هاتف E.164، موافقة واتساب الصريحة، القناة المفضّلة، ساعات الهدوء)
--  portal_message_log   : سجل تسليم صادق لكل رسالة (القناة التي نجحت، حالة المزوّد الفعلية، الخطأ الحقيقي، قائمة اليد)
--  آمن لإعادة التشغيل (idempotent). لا يمسّ أي جدول قائم.

create table if not exists public.portal_contact_prefs (
  email               text primary key,
  user_id             uuid,
  phone_e164          text,
  whatsapp_opt_in     boolean not null default false,
  whatsapp_opt_in_at  timestamptz,
  preferred_channel   text not null default 'email' check (preferred_channel in ('whatsapp','email','push')),
  quiet_from          text,                       -- 'HH:MM' بتوقيت الرياض (اختياري)
  quiet_to            text,
  push_ok             boolean not null default true,
  updated_at          timestamptz not null default now()
);

create table if not exists public.portal_message_log (
  id              bigserial primary key,
  kind            text not null,                  -- mission_assigned | mission_reminder | contract | certificate | … | notice
  ref_id          text,                           -- معرّف الكائن (مهمة/عقد/شهادة) إن وُجد
  to_email        text,
  to_phone        text,
  to_name         text,
  subject         text not null,
  channel         text not null default 'manual' check (channel in ('whatsapp','email','push','manual')),
  status          text not null default 'queued' check (status in ('queued','sent','delivered','read','failed','manual','done')),
  plan            text[] not null default '{}',   -- ترتيب القنوات الذي حُسم لهذا الشخص
  attempts        int  not null default 0,
  errors          jsonb not null default '[]'::jsonb,  -- [{channel, error, at}]
  provider_id     text,                           -- معرّف المزوّد (Resend id / wamid) لربط Webhook الحالات
  payload         jsonb not null default '{}'::jsonb,  -- {text, url, html, wa:{template, params}}
  next_at         timestamptz,                    -- موعد إعادة المحاولة (ساعات الهدوء)
  created_at      timestamptz not null default now(),
  sent_at         timestamptz,
  delivered_at    timestamptz,
  read_at         timestamptz,
  manual_done_at  timestamptz,
  manual_by       text
);
create index if not exists portal_message_log_status_idx   on public.portal_message_log (status, created_at desc);
create index if not exists portal_message_log_email_idx    on public.portal_message_log (to_email, created_at desc);
create index if not exists portal_message_log_provider_idx on public.portal_message_log (provider_id);
create index if not exists portal_message_log_kind_idx     on public.portal_message_log (kind, ref_id);

alter table public.portal_contact_prefs enable row level security;
alter table public.portal_message_log   enable row level security;

-- الطاقم: كل شيء
drop policy if exists portal_contact_prefs_staff on public.portal_contact_prefs;
create policy portal_contact_prefs_staff on public.portal_contact_prefs for all to authenticated
  using (public.portal_is_staff()) with check (public.portal_is_staff());
drop policy if exists portal_message_log_staff on public.portal_message_log;
create policy portal_message_log_staff on public.portal_message_log for all to authenticated
  using (public.portal_is_staff()) with check (public.portal_is_staff());
-- الشخص: يقرأ تفضيلاته ويعدّلها فقط (بريده = بريد الجلسة)
drop policy if exists portal_contact_prefs_self on public.portal_contact_prefs;
create policy portal_contact_prefs_self on public.portal_contact_prefs for all to authenticated
  using (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')))
  with check (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));
-- الشخص: يرى سجل رسائله فقط (قراءة)
drop policy if exists portal_message_log_self on public.portal_message_log;
create policy portal_message_log_self on public.portal_message_log for select to authenticated
  using (lower(to_email) = lower(coalesce(auth.jwt() ->> 'email', '')));

-- تشخيص متوقَّع: صفّان (prefs | 0 ، log | 0) عند أول تشغيل
select 'prefs' as t, count(*) from public.portal_contact_prefs
union all
select 'log', count(*) from public.portal_message_log;
