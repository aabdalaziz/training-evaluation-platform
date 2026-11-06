-- =====================================================================================
-- P52 «رسالة الشهر» (التقرير الشهري لأثر الجهة / Monthly Organization Impact Letter)
-- © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved.
-- آمن لإعادة التشغيل. يُنفَّذ قبل رفع ملفات الكود.
--   جدول واحد: portal_org_letters — رسالة واحدة لكل جهة لكل شهر:
--     draft  : تُنشأ تلقائيًّا (الكرون اليومي في اليوم الثالث من الشهر أو يدويًّا من الطاقم) بأرقام الشهر المنصرم.
--     signed : بعد أن يكتب إنسان «سطره» ويوقّع — تُجمَّد (body + line + promise + ask) ويُحسب رمز وبصمة sha256 ولا تُعدَّل.
--   لا أسماء منسوبين داخل body أبدًا (قاعدة k ≥ 5 في الكود). يصل إليها الطاقم ومديرو الجهة المؤكَّدون عبر الواجهة البرمجية بصلاحية الخدمة.
-- =====================================================================================

create table if not exists public.portal_org_letters (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  organization_id  uuid not null references public.portal_organizations(id) on delete cascade,
  month            text not null check (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),   -- الشهر المرويّ: 'YYYY-MM'
  status           text not null default 'draft' check (status in ('draft','signed')),
  body             jsonb not null default '{}'::jsonb,       -- الأرقام والفروق والخيوط كما جُمّدت وقت التوقيع
  line_ar          text,                                      -- «سطر الإنسان» (≤ 280 حرفًا)
  promise_ar       text,                                      -- «وعد الشهر القادم»
  ask_ar           text,                                      -- «ما نحتاجه منكم» (اختياري)
  signed_by        uuid,
  signed_email     text,
  signed_name      text,
  signed_title     text,
  signed_at        timestamptz,
  code             text unique,                               -- ATH-ML-XXXX-XXXX (بعد التوقيع فقط)
  digest           text,                                      -- sha256 للنصّ المجمَّد (JCS) — للتحقّق العام بلا محتوى
  reply_ar         text,                                      -- «ردّ الجهة» (سطر واحد من مدير الجهة)
  reply_by         text,
  reply_at         timestamptz,
  reply_seen_at    timestamptz,
  reminded_at      timestamptz,                               -- تذكير الموقِّع (مرّة)
  meta             jsonb not null default '{}'::jsonb,
  constraint portal_org_letters_org_month_uq unique (organization_id, month)
);
create index if not exists portal_org_letters_status_idx on public.portal_org_letters (status, month desc);
create index if not exists portal_org_letters_org_idx on public.portal_org_letters (organization_id, month desc);

alter table public.portal_org_letters enable row level security;
-- لا سياسات عامة: القراءة والكتابة عبر الواجهة البرمجية بصلاحية الخدمة فقط (الطاقم + مديرو الجهة المؤكَّدون).

notify pgrst, 'reload schema';

-- تشخيص (متوقَّع: letters = 0 عند أول تشغيل · rls = true · uq = 1)
select
  (select count(*) from public.portal_org_letters) as letters,
  (select relrowsecurity from pg_class where relname = 'portal_org_letters') as rls,
  (select count(*) from pg_constraint where conname = 'portal_org_letters_org_month_uq') as uq;
