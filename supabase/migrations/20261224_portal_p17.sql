-- © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
-- أَثَر — P17 «محفظة القدرة السيادية»: الشهادات الرقمية القابلة للتحقق (Open Badges 3.0 / W3C VC 2.0 + Ed25519)
--  1) portal_signing_keys   — المفاتيح العامة المنشورة في did.json (الحالي والمتقاعد). المفتاح الخاص لا يُخزَّن هنا أبدًا (VC_SIGNING_KEY في Vercel).
--  2) portal_vc_issuances   — كل وثيقة موقَّعة: شهادة (مرتبطة بـ portal_credentials) أو «لقطة قدرة» يُصدرها المتعلم بنفسه. status_index = موضعها في قائمة الحالة.
--  3) portal_credentials.vc_kid / vc_signed_at — آخر توقيع للشهادة.
--  آمن لإعادة التشغيل (idempotent).

create table if not exists public.portal_signing_keys (
  kid                   text primary key,
  public_key_multibase  text not null,
  created_at            timestamptz not null default now(),
  retired_at            timestamptz,
  note                  text
);

create sequence if not exists public.portal_vc_status_index_seq start 1;
create table if not exists public.portal_vc_issuances (
  id             uuid primary key default gen_random_uuid(),
  code           text not null unique,
  kind           text not null check (kind in ('credential','snapshot')),
  credential_id  uuid unique references public.portal_credentials(id) on delete cascade,
  user_id        uuid,
  email          text,
  full_name      text,
  title_ar       text,
  kid            text not null,
  status_index   integer not null unique default nextval('public.portal_vc_status_index_seq'),
  vc             jsonb not null,
  digest         text not null,
  issued_at      timestamptz not null default now(),
  expires_at     timestamptz,
  revoked_at     timestamptz,
  revoke_reason  text,
  issued_by      uuid,
  created_at     timestamptz not null default now()
);
create index if not exists portal_vc_issuances_user_idx  on public.portal_vc_issuances (user_id, issued_at desc);
create index if not exists portal_vc_issuances_email_idx on public.portal_vc_issuances (lower(email), issued_at desc);
create index if not exists portal_vc_issuances_kind_idx  on public.portal_vc_issuances (kind, revoked_at);

alter table public.portal_credentials add column if not exists vc_kid       text;
alter table public.portal_credentials add column if not exists vc_signed_at timestamptz;

-- RLS: الطاقم يدير؛ الشخص يقرأ إصداراته؛ القراءة العامة بالرمز تمرّ عبر /api/vc (مفتاح الخدمة) فقط
alter table public.portal_signing_keys  enable row level security;
alter table public.portal_vc_issuances  enable row level security;

drop policy if exists "p17 keys read"  on public.portal_signing_keys;
create policy "p17 keys read"  on public.portal_signing_keys for select to authenticated, anon using (true);
drop policy if exists "p17 keys staff" on public.portal_signing_keys;
create policy "p17 keys staff" on public.portal_signing_keys for all to authenticated using (public.portal_is_staff()) with check (public.portal_is_staff());

drop policy if exists "p17 vc own"   on public.portal_vc_issuances;
create policy "p17 vc own"   on public.portal_vc_issuances for select to authenticated
  using (user_id = auth.uid() or lower(coalesce(email,'')) = lower(coalesce(auth.jwt()->>'email','')));
drop policy if exists "p17 vc staff" on public.portal_vc_issuances;
create policy "p17 vc staff" on public.portal_vc_issuances for all to authenticated using (public.portal_is_staff()) with check (public.portal_is_staff());

-- تشخيص: المتوقع بعد التشغيل الأول  keys | 0  ·  issuances | 0  ·  unsigned_credentials | <عدد الشهادات الحالية>
select 'keys' as item, count(*) from public.portal_signing_keys
union all select 'issuances', count(*) from public.portal_vc_issuances
union all select 'unsigned_credentials', count(*) from public.portal_credentials where vc_kid is null and revoked_at is null;
