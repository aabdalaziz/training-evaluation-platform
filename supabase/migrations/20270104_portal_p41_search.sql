-- © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
-- «دليل أَثَر» (P41) — البحث في كل صفحة: فهارس تشابه نصّي (pg_trgm) حتى يبقى ilike سريعًا مع نموّ الجداول.
-- لا جداول جديدة ولا تغيير في السياسات؛ كل المصادر تُقرأ من الخادم بصلاحية الخدمة وتُرشَّح بحسب دور الطالب في /api/search.
create extension if not exists pg_trgm;

create index if not exists programs_name_trgm_idx on public.programs using gin (name_ar gin_trgm_ops);
create index if not exists portal_resources_title_trgm_idx on public.portal_resources using gin (title_ar gin_trgm_ops);
create index if not exists portal_sessions_title_trgm_idx on public.portal_sessions using gin (title_ar gin_trgm_ops);
create index if not exists portal_scenarios_title_trgm_idx on public.portal_scenarios using gin (title_ar gin_trgm_ops);
create index if not exists portal_directory_profiles_search_trgm_idx on public.portal_directory_profiles using gin (search_plain gin_trgm_ops);
create index if not exists profiles_full_name_trgm_idx on public.profiles using gin (full_name gin_trgm_ops);
create index if not exists portal_organizations_name_trgm_idx on public.portal_organizations using gin (name_ar gin_trgm_ops);
create index if not exists question_bank_items_code_trgm_idx on public.question_bank_items using gin (item_code gin_trgm_ops);

-- تشخيص: المتوقع 8
select count(*) as p41_indexes from pg_indexes where schemaname = 'public' and indexname in (
  'programs_name_trgm_idx','portal_resources_title_trgm_idx','portal_sessions_title_trgm_idx','portal_scenarios_title_trgm_idx',
  'portal_directory_profiles_search_trgm_idx','profiles_full_name_trgm_idx','portal_organizations_name_trgm_idx','question_bank_items_code_trgm_idx');
