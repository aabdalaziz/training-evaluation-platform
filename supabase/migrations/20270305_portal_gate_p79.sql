-- © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
-- P79 «تصاريح الدخول» — بوّابة مركزية تحمي منتجات أَثَر إلى حين إطلاق التسعير.
--  • portal_gate_products : حالة كلّ منتج (open مفتوح · permit بتصريح · closed مغلق) + مدّة التجربة + نصّ الرسالة. تُقرأ من الحافة (anon select).
--  • portal_gate_requests : طلبات الزوّار (اسم · بريد · جوّال · جهة · غرض) وقرار الطاقم.
--  • portal_gate_permits  : التصاريح الممنوحة (رمز قصير · بريد · منتج · انتهاء · إلغاء · استخدامات).
--  الذكاء الاصطناعي لا يقرّر هنا شيئًا — الموافقة بشرية دائمًا.

create table if not exists public.portal_gate_products (
  slug            text primary key,
  name_ar         text not null,
  name_en         text not null default '',
  mode            text not null default 'permit' check (mode in ('open','permit','closed')),
  trial_seconds   int  not null default 120 check (trial_seconds between 0 and 3600),
  entry_path      text not null,            -- أين يدخل صاحب التصريح
  trial_path      text,                     -- أين تبدأ التجربة (افتراضيًا entry_path)
  message_ar      text,                     -- رسالة البوّابة (اختياري؛ وإلا النصّ الافتراضي)
  sort            int  not null default 100,
  updated_at      timestamptz not null default now(),
  updated_by      text
);

insert into public.portal_gate_products (slug, name_ar, name_en, mode, trial_seconds, entry_path, trial_path, sort) values
  ('iqra',   'اقْرَأْ',            'Iqra',          'permit', 120, '/iqra',      '/iqra',      10),
  ('kids',   'بَيان — أَثَر للأطفال', 'Bayan Kids',  'permit', 120, '/kids',      '/kids/demo', 20),
  ('sim',    'المحاكيات',          'Simulators',    'open',   120, '/sim',       '/sim',       30),
  ('live',   'التعلّم المباشر',     'Live learning', 'open',   0,   '/live',      '/live',      40),
  ('on-air', 'على الهواء',          'On air',        'open',   0,   '/on-air',    '/on-air',    50)
on conflict (slug) do nothing;

create table if not exists public.portal_gate_requests (
  id          uuid primary key default gen_random_uuid(),
  product     text not null references public.portal_gate_products(slug) on delete cascade,
  name        text not null,
  email       text not null,
  phone       text,
  org         text,
  purpose     text,
  lang        text not null default 'ar',
  status      text not null default 'pending' check (status in ('pending','approved','rejected')),
  note        text,                          -- ملاحظة الطاقم (سبب الرفض / تعليق)
  permit_id   uuid,
  ip_hash     text,
  created_at  timestamptz not null default now(),
  decided_at  timestamptz,
  decided_by  text
);
create index if not exists portal_gate_requests_status_idx on public.portal_gate_requests (status, created_at desc);
create index if not exists portal_gate_requests_email_idx  on public.portal_gate_requests (lower(email), product);

create table if not exists public.portal_gate_permits (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,          -- 10 أحرف آمنة — يُستخدم في رابط البريد وفي خانة «لديّ رمز»
  product     text not null references public.portal_gate_products(slug) on delete cascade,
  email       text not null,
  name        text,
  request_id  uuid references public.portal_gate_requests(id) on delete set null,
  expires_at  timestamptz,                   -- null = حتى إشعار آخر
  revoked_at  timestamptz,
  uses        int  not null default 0,
  last_used_at timestamptz,
  created_by  text,
  created_at  timestamptz not null default now()
);
create index if not exists portal_gate_permits_email_idx on public.portal_gate_permits (lower(email), product);

alter table public.portal_gate_products enable row level security;
alter table public.portal_gate_requests enable row level security;
alter table public.portal_gate_permits  enable row level security;

-- الحافة (middleware) تقرأ حالات المنتجات بمفتاح anon فقط — لا شيء حسّاس فيها.
drop policy if exists gate_products_public_read on public.portal_gate_products;
create policy gate_products_public_read on public.portal_gate_products for select to anon, authenticated using (true);
-- الطلبات والتصاريح: بمفتاح الخدمة من واجهات /api فقط (لا سياسات للعامة).

comment on table public.portal_gate_products is 'P79: حالة أبواب المنتجات (open/permit/closed) ومدّة التجربة.';
comment on table public.portal_gate_requests is 'P79: طلبات تصريح الدخول من الزوّار وقرار الطاقم.';
comment on table public.portal_gate_permits  is 'P79: التصاريح الممنوحة (رمز + بريد + منتج + انتهاء).';
