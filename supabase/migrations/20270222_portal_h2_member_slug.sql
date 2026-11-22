-- © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
-- هـ-2 (د) — «رابط باسمك»: عضو الهيئة يختار اسم رابط صفحته (/experts/<slug>) والروابط القديمة تبقى تعمل عبر slug_history.
-- آمن للتكرار.
alter table public.portal_directory_profiles add column if not exists slug_history text[] not null default '{}';
create index if not exists portal_directory_profiles_slug_history_idx on public.portal_directory_profiles using gin (slug_history);
