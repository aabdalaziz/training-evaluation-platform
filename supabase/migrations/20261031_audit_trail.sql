-- =====================================================================
-- المرحلة J1: سجلّ التدقيق الشامل (Audit Trail)
-- يوسّع جدول audit_logs الحالي (إن وُجد) ويضيف تتبّعًا تلقائيًا (Triggers)
-- لكل إنشاء/تعديل/حذف في الجداول الرئيسية + سجلّ تطبيقي للعمليات الحساسة
-- آمن لإعادة التشغيل (idempotent)
-- =====================================================================

-- 1) الجدول الأساسي (ينشأ إن لم يكن موجودًا — نفس بنية المرحلة 1)
create table if not exists public.audit_logs (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  actor_id    uuid,
  action      text not null,
  entity_type text,
  entity_id   text,
  metadata    jsonb not null default '{}'::jsonb
);

-- 2) أعمدة جديدة
alter table public.audit_logs add column if not exists actor_email  text;
alter table public.audit_logs add column if not exists actor_role   text;
alter table public.audit_logs add column if not exists entity_label text;
alter table public.audit_logs add column if not exists before_data  jsonb;
alter table public.audit_logs add column if not exists after_data   jsonb;
alter table public.audit_logs add column if not exists changes      jsonb;   -- {field:{from,to}} للتعديلات
alter table public.audit_logs add column if not exists source       text not null default 'app';  -- app | db | cron

create index if not exists audit_logs_created_idx on public.audit_logs (created_at desc);
create index if not exists audit_logs_action_idx  on public.audit_logs (action);
create index if not exists audit_logs_entity_idx  on public.audit_logs (entity_type, entity_id);
create index if not exists audit_logs_actor_idx   on public.audit_logs (actor_id);

alter table public.audit_logs enable row level security;

-- القراءة: الإدارة + محلل الجودة. الكتابة: عبر Triggers (security definer) ومفتاح الخدمة فقط
drop policy if exists audit_logs_admin_read on public.audit_logs;
drop policy if exists audit_logs_staff_read on public.audit_logs;
create policy audit_logs_staff_read on public.audit_logs
  for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid()
                 and upper(p.role::text) in ('PLATFORM_ADMIN','SUPER_ADMIN','ADMIN','QUALITY_ANALYST')));

-- 3) دالة التتبّع التلقائي
create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old     jsonb;
  v_new     jsonb;
  v_changes jsonb;
  v_uid     uuid;
  v_email   text;
  v_role    text;
  v_label   text;
  v_id      text;
  v_src     text;
  v_skip    text[] := array['updated_at','created_at','last_sign_in_at'];
begin
  v_uid := auth.uid();
  begin
    v_email := nullif(auth.jwt() ->> 'email', '');
  exception when others then v_email := null; end;
  if v_uid is not null then
    begin
      select p.role::text, coalesce(v_email, p.email) into v_role, v_email from public.profiles p where p.id = v_uid;
    exception when others then
      begin select p.role::text into v_role from public.profiles p where p.id = v_uid; exception when others then v_role := null; end;
    end;
  end if;
  v_src := case when v_uid is null then 'cron' else 'db' end;

  if tg_op = 'DELETE' then v_old := to_jsonb(old); else v_new := to_jsonb(new); end if;
  if tg_op = 'UPDATE' then
    v_old := to_jsonb(old);
    select jsonb_object_agg(n.key, jsonb_build_object('from', v_old -> n.key, 'to', n.value))
      into v_changes
      from jsonb_each(v_new) n
     where not (n.key = any (v_skip)) and (v_old -> n.key) is distinct from n.value;
    if v_changes is null then return null; end if;   -- لا تغيير فعلي → لا نسجّل
  end if;

  -- إخفاء الحقول الحساسة إن وُجدت
  v_old := v_old - 'password' - 'password_hash' - 'token' - 'secret';
  v_new := v_new - 'password' - 'password_hash' - 'token' - 'secret';

  -- تسمية الكيان
  v_label := coalesce(
    coalesce(v_new, v_old) ->> 'name_ar', coalesce(v_new, v_old) ->> 'full_name', coalesce(v_new, v_old) ->> 'name',
    coalesce(v_new, v_old) ->> 'title_ar', coalesce(v_new, v_old) ->> 'title', coalesce(v_new, v_old) ->> 'code',
    coalesce(v_new, v_old) ->> 'text_ar', coalesce(v_new, v_old) ->> 'email', coalesce(v_new, v_old) ->> 'id');
  v_id := coalesce(v_new, v_old) ->> 'id';

  insert into public.audit_logs (actor_id, actor_email, actor_role, action, entity_type, entity_id, entity_label, before_data, after_data, changes, source, metadata)
  values (v_uid, v_email, v_role, tg_op, tg_table_name, v_id, left(v_label, 200),
          case when tg_op = 'INSERT' then null else v_old end,
          case when tg_op = 'DELETE' then null else v_new end,
          v_changes, v_src, jsonb_build_object('schema', tg_table_schema));
  return null;
exception when others then
  -- لا نكسر العملية الأصلية بسبب فشل التسجيل
  return null;
end;
$$;

revoke all on function public.audit_row_change() from public;

-- 4) تركيب التتبّع على الجداول الرئيسية الموجودة فعلًا
do $$
declare
  t text;
begin
  foreach t in array array[
    'programs','trainers','classrooms','questions','evaluation_templates','program_evaluation_templates',
    'profiles','certificate_settings','certificates','trainer_awards','report_subscriptions',
    'outcome_kpis','outcome_measurements','impact_assessments','impact_questions',
    'behavior_followups','behavior_questions','attendance_sessions','program_levels','class_schedules'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists trg_audit_%1$s on public.%1$I', t);
      execute format('create trigger trg_audit_%1$s after insert or update or delete on public.%1$I for each row execute function public.audit_row_change()', t);
    end if;
  end loop;
end $$;

-- 5) دالة تنظيف (الاحتفاظ الافتراضي 730 يومًا) — تُستدعى من الكرون الأسبوعي عبر مفتاح الخدمة
create or replace function public.audit_logs_cleanup(p_days int default 730)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare n int;
begin
  delete from public.audit_logs where created_at < now() - make_interval(days => greatest(p_days, 30));
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.audit_logs_cleanup(int) from public;

-- تحقق
select count(*) as audit_rows from public.audit_logs;
select tgname, tgrelid::regclass from pg_trigger where tgname like 'trg_audit_%' order by 2;
