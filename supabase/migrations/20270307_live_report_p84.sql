-- © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
-- P84 «التقرير الحيّ»: (1) وسم كلّ سؤال تقييم بمستوى كيركباتريك 1–4 مع وسم تلقائي أوّلي  (2) جدول «تنبيهات الأثر» = مهامّ تُولَّد من التقرير
--  وتُتابَع (مفتوح → قيد المعالجة → مُنجز) بلا تكرار (فريدة بالبرنامج+النوع+المرجع). آمن لإعادة التشغيل.

-- (1) مستوى كيركباتريك على أسئلة التقييم
alter table public.questions add column if not exists kp_level smallint not null default 1;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'questions_kp_level_chk') then
    alter table public.questions add constraint questions_kp_level_chk check (kp_level between 1 and 4);
  end if;
end $$;
comment on column public.questions.kp_level is 'P84: مستوى كيركباتريك 1 رضا · 2 تعلّم · 3 سلوك/تطبيق · 4 نتائج';

-- وسم تلقائي أوّلي (لا يمسّ ما وُسم يدويًّا بغير 1)
update public.questions set kp_level = 2 where kp_level = 1 and (
  coalesce(text_ar, '') ~ '(تعلّمت|تعلمت|اكتسبت|معرفتي|مهارتي|مهاراتي|فهمي|أتقنت|اتقنت|أصبحت قادرًا|اصبحت قادرا|استوعبت)' or
  lower(coalesce(text_en, '')) ~ '(learned|learnt|knowledge|skill|understand|acquired|able to)' or
  lower(coalesce(question_key, '')) ~ '(learn|knowledge|skill|gain)');
update public.questions set kp_level = 3 where kp_level = 1 and (
  coalesce(text_ar, '') ~ '(سأطبّق|سأطبق|أطبّق|اطبق|تطبيق|في عملي|في وظيفتي|سلوك|ممارس|أنوي|انوي|سأستخدم|ساستخدم)' or
  lower(coalesce(text_en, '')) ~ '(apply|applied|behavio|in my (job|work)|intend|practice|use .* at work)' or
  lower(coalesce(question_key, '')) ~ '(apply|behavio|transfer|intent)');
update public.questions set kp_level = 4 where kp_level = 1 and (
  coalesce(text_ar, '') ~ '(نتائج (الجهة|العمل|المنظمة|المؤسسة)|أداء الجهة|إنتاجية|انتاجية|مؤشرات الأداء|العائد|أثر .*(العمل|الجهة|المنظمة)|جودة العمل)' or
  lower(coalesce(text_en, '')) ~ '(organi[sz]ation(al)? (result|performance|outcome)|productivity|kpi|return on|business impact)' or
  lower(coalesce(question_key, '')) ~ '(result|outcome|kpi|roi)');

-- (2) تنبيهات الأثر (مهامّ التقرير الحيّ)
create table if not exists public.report_alerts (
  id            uuid primary key default gen_random_uuid(),
  program_id    uuid not null,
  classroom_id  uuid,
  kind          text not null check (kind in ('low_item','neg_comments','low_attendance','low_gain','low_transfer','low_outcome')),
  ref           text not null default '',
  severity      text not null default 'med' check (severity in ('high','med')),
  title_ar      text not null,
  detail        jsonb not null default '{}'::jsonb,
  status        text not null default 'open' check (status in ('open','ack','done','dismissed')),
  owner_ar      text,
  due_date      date,
  created_by    uuid,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  resolved_at   timestamptz,
  unique (program_id, kind, ref)
);
create index if not exists report_alerts_program_idx on public.report_alerts (program_id, status);
alter table public.report_alerts enable row level security;
drop policy if exists report_alerts_rw on public.report_alerts;
create policy report_alerts_rw on public.report_alerts for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid()
          and upper(p.role::text) in ('PLATFORM_ADMIN','SUPER_ADMIN','ADMIN','PROGRAM_MANAGER','QUALITY_ANALYST','TRAINER')))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid()
          and upper(p.role::text) in ('PLATFORM_ADMIN','SUPER_ADMIN','ADMIN','PROGRAM_MANAGER','QUALITY_ANALYST','TRAINER')));

create or replace function public.report_alerts_touch() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  if new.status in ('done','dismissed') and old.status not in ('done','dismissed') then new.resolved_at := now(); end if;
  if new.status in ('open','ack') then new.resolved_at := null; end if;
  return new;
end $$;
drop trigger if exists report_alerts_touch on public.report_alerts;
create trigger report_alerts_touch before update on public.report_alerts for each row execute function public.report_alerts_touch();
comment on table public.report_alerts is 'P84: تنبيهات/مهامّ تُولَّد تلقائيًّا من التقرير الحيّ (بند < 3.0 · تعليقات سلبية متكرّرة · حضور · كسب · نقل) وتُتابَع حتى الإنجاز.';
