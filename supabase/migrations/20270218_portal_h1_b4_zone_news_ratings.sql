-- © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved.
-- هـ-1/4 (2026-11-23): «شريط أخبار المنطقة» + «تقييم الخدمة»
--  · zone_news        أخبار يكتبها الطاقم لكلّ منطقة (miaar · iqra · programs · org · experts · staff · portal) — تُعرض في شريط المنطقة مع الأخبار الآلية
--  · service_ratings  تقييم المستفيد للخدمة (نجوم ١–٥ + وسوم + كلمة) — تقييم واحد لكلّ مستفيد لكلّ خدمة/مرجع يُحدَّث لا يُكرَّر
--  · service_rating_summary()  ملخّص عامّ (متوسّط وعدد) بلا أيّ بيانات شخصية
--  القراءة العامّة لأخبار المنطقة المنشورة؛ الكتابة بالدور عبر RPC/API.

create table if not exists public.zone_news (
  id          uuid primary key default gen_random_uuid(),
  zone        text not null check (zone in ('miaar','iqra','programs','org','experts','staff','portal')),
  title_ar    text not null,
  body_ar     text not null default '',
  href        text,                                   -- رابط داخلي اختياري
  tone        text not null default 'plum' check (tone in ('plum','coral','sand','sea')),
  pinned      boolean not null default false,
  starts_at   timestamptz not null default now(),
  ends_at     timestamptz,                            -- null = بلا نهاية
  published   boolean not null default true,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists zone_news_zone_idx on public.zone_news (zone, published, pinned desc, starts_at desc);
alter table public.zone_news enable row level security;
drop policy if exists zone_news_public_read on public.zone_news;
create policy zone_news_public_read on public.zone_news for select using (published and starts_at <= now() and (ends_at is null or ends_at > now()));

-- كتابة الأخبار: مدير النظام · مدير البرامج (security definer)
create or replace function public.portal_zone_news_upsert(p_id uuid, p_zone text, p_title text, p_body text, p_href text, p_tone text, p_pinned boolean, p_starts timestamptz, p_ends timestamptz, p_published boolean)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_role text; v_id uuid;
begin
  select upper(role) into v_role from public.profiles where id = auth.uid();
  if v_role not in ('PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER') then raise exception 'forbidden'; end if;
  if p_zone not in ('miaar', 'iqra', 'programs', 'org', 'experts', 'staff', 'portal') then raise exception 'bad_zone'; end if;
  if length(trim(p_title)) < 3 then raise exception 'title_required'; end if;
  if p_href is not null and p_href <> '' and p_href !~ '^/[^\s]*$' then raise exception 'href_must_be_internal'; end if;
  if p_id is null then
    insert into public.zone_news (zone, title_ar, body_ar, href, tone, pinned, starts_at, ends_at, published, created_by)
    values (p_zone, trim(p_title), coalesce(p_body, ''), nullif(p_href, ''), coalesce(nullif(p_tone, ''), 'plum'), coalesce(p_pinned, false), coalesce(p_starts, now()), p_ends, coalesce(p_published, true), auth.uid())
    returning id into v_id;
  else
    update public.zone_news set zone = p_zone, title_ar = trim(p_title), body_ar = coalesce(p_body, ''), href = nullif(p_href, ''), tone = coalesce(nullif(p_tone, ''), 'plum'), pinned = coalesce(p_pinned, false), starts_at = coalesce(p_starts, starts_at), ends_at = p_ends, published = coalesce(p_published, true), updated_at = now()
    where id = p_id returning id into v_id;
  end if;
  return v_id;
end $$;
revoke all on function public.portal_zone_news_upsert(uuid, text, text, text, text, text, boolean, timestamptz, timestamptz, boolean) from public, anon;
grant execute on function public.portal_zone_news_upsert(uuid, text, text, text, text, text, boolean, timestamptz, timestamptz, boolean) to authenticated;

create or replace function public.portal_zone_news_delete(p_id uuid) returns boolean language plpgsql security definer set search_path = public as $$
declare v_role text;
begin
  select upper(role) into v_role from public.profiles where id = auth.uid();
  if v_role not in ('PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER') then raise exception 'forbidden'; end if;
  delete from public.zone_news where id = p_id; return found;
end $$;
revoke all on function public.portal_zone_news_delete(uuid) from public, anon;
grant execute on function public.portal_zone_news_delete(uuid) to authenticated;

-- ---------- تقييم الخدمة ----------
create table if not exists public.service_ratings (
  id          uuid primary key default gen_random_uuid(),
  service     text not null check (service in ('miaar','iqra','program','diploma','payment','consulting','portal')),
  ref_id      text not null default '',               -- معرّف اختياري (برنامج/حلقة/فاتورة) — '' للخدمة عمومًا
  user_id     uuid references auth.users(id) on delete cascade,
  rater_email text not null,                          -- للمستفيد برمز نتيجة بلا حساب
  stars       smallint not null check (stars between 1 and 5),
  tags        text[] not null default '{}',           -- من قائمة ثابتة في الواجهة
  comment     text,                                   -- ≤ 300 حرفًا
  context     jsonb not null default '{}'::jsonb,     -- {level, plan, page}
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (service, ref_id, rater_email)
);
create index if not exists service_ratings_service_idx on public.service_ratings (service, created_at desc);
alter table public.service_ratings enable row level security;
drop policy if exists service_ratings_own on public.service_ratings;
create policy service_ratings_own on public.service_ratings for select using (user_id = auth.uid());

-- ملخّص عامّ: متوسّط وعدد لكلّ خدمة (آخر ٣٦٥ يومًا) — بلا بيانات شخصية
create or replace function public.service_rating_summary()
returns table (service text, ref_id text, avg_stars numeric, n bigint, n5 bigint, n4 bigint, n3 bigint, n2 bigint, n1 bigint)
language sql stable security definer set search_path = public as $$
  select r.service, r.ref_id, round(avg(r.stars)::numeric, 2), count(*),
         count(*) filter (where r.stars = 5), count(*) filter (where r.stars = 4), count(*) filter (where r.stars = 3), count(*) filter (where r.stars = 2), count(*) filter (where r.stars = 1)
  from public.service_ratings r where r.created_at > now() - interval '365 days'
  group by r.service, r.ref_id
$$;
grant execute on function public.service_rating_summary() to anon, authenticated;
