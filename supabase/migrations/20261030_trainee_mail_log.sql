-- =====================================================================
-- المرحلة H2: سجل بريد المتدربين التلقائي (فتح التقييم النهائي · إصدار الشهادة)
-- آمن لإعادة التشغيل (idempotent)
-- =====================================================================
create table if not exists public.trainee_mail_log (
  id          bigserial primary key,
  kind        text not null,                 -- final_open | certificate_issued
  program_id  uuid,
  ref_id      uuid,                          -- certificate id (للشهادات)
  email       text not null,
  sent_at     timestamptz not null default now(),
  ok          boolean not null default true,
  error       text,
  unique (kind, email, program_id, ref_id)
);
create index if not exists trainee_mail_log_program_idx on public.trainee_mail_log (program_id, kind);

alter table public.trainee_mail_log enable row level security;

drop policy if exists trainee_mail_log_staff_read on public.trainee_mail_log;
create policy trainee_mail_log_staff_read on public.trainee_mail_log
  for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid()
                 and upper(p.role::text) in ('PLATFORM_ADMIN','SUPER_ADMIN','ADMIN','PROGRAM_MANAGER','QUALITY_ANALYST')));
-- الكتابة عبر مفتاح الخدمة فقط (Cron) — لا سياسة insert للمستخدمين
