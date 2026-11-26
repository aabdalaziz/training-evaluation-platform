-- © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
-- P80 «درع أَثَر — الحزمة الأمنية»
--  ج) حاوية النسخ الاحتياطي اليومي portal-backups (خاصّة؛ يكتبها مفتاح الخدمة فقط).
--  د) خصوصية الأطفال: kids_gc() — ملفّ طفل بلا أيّ نشاط 365 يومًا يُؤرشَف ويُجهَّل (الكنية → «طفل»، حذف الأحاديث والرسائل)،
--     وتُحذف أحاديث الأطفال (kids_talks) التي تجاوزت purge_after (90 يومًا) أو 180 يومًا مطلقًا. تُستدعى من المهمّة اليومية (runShield).
--  ب) التوثيق الثنائي: لا جداول — يُفعَّل من لوحة Supabase: Authentication ← Multi-Factor ← TOTP = Enabled.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('portal-backups', 'portal-backups', false, 209715200, array['application/json'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
-- لا سياسات قراءة/كتابة للعامة أو للمستخدمين: الوصول بمفتاح الخدمة من /api فقط.

create or replace function public.kids_gc(p_days int default 365, p_talk_days int default 180)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_children int := 0; v_talks int := 0; v_ids uuid[];
begin
  -- أطفال بلا تقدّم ولا حديث خلال p_days يومًا، وغير مؤرشَفين
  select coalesce(array_agg(c.id), '{}') into v_ids
  from public.kids_children c
  where c.archived_at is null
    and c.created_at < now() - make_interval(days => p_days)
    and not exists (select 1 from public.kids_progress p where p.child_id = c.id and p.started_at > now() - make_interval(days => p_days))
    and not exists (select 1 from public.kids_talks t where t.child_id = c.id and t.at > now() - make_interval(days => p_days));
  if coalesce(array_length(v_ids, 1), 0) > 0 then
    delete from public.kids_talks where child_id = any(v_ids);
    delete from public.kids_letters where child_id = any(v_ids);
    update public.kids_children set nick = 'طفل', avatar = 1, archived_at = now() where id = any(v_ids);
    v_children := array_length(v_ids, 1);
  end if;
  -- أحاديث قديمة مطلقًا: ما تجاوز purge_after (90 يومًا افتراضيًّا) أو p_talk_days
  delete from public.kids_talks where purge_after < now() or at < now() - make_interval(days => p_talk_days);
  get diagnostics v_talks = row_count;
  return jsonb_build_object('children_archived', v_children, 'talks_deleted', v_talks);
end $$;
revoke all on function public.kids_gc(int, int) from public, anon, authenticated;

comment on function public.kids_gc is 'P80-د: أرشفة وتجهيل ملفّات الأطفال الخاملة سنة، وحذف الأحاديث الأقدم من 180 يومًا.';
