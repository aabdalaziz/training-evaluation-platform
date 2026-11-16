-- © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
-- P73 «ساعة الأثر» (الرسمي: لقاء التأمل الأسبوعي للشعبة)
-- صفر جداول جديدة: الساعة = جلسة في portal_sessions (kind = athar_hour) تولَّد أسبوعيًّا بآلية P66-ب؛
-- وما يُكتب فيها = سطور في portal_learning_lines بأنواع جديدة:
--   hour_word  كلمة واحدة بعد دقيقة الصمت (≤ 24 حرفًا)      hour_line  سطر مقترَح لـ«سطر ساعتنا» (≤ 120)
--   hour_vote  صوت بلمسة لسطر غيري (meta.for = id السطر)     carry      «أحمله معي» — نسخة من سطر زميل (meta.from = id)
--   hour_seal  ختم الأستاذ: السطر الجماعي + الأعداد فقط (meta) — صفّ واحد للشعبة في اليوم
-- القيد الفريد القائم (user_id, classroom_id, kind, day) يضمن: كلمة واحدة · سطر واحد · صوت واحد · محمول واحد لكل متدرّب في الساعة.
-- آمن للتكرار. لا يمسّ أي صفّ قائم.

alter table public.portal_sessions drop constraint if exists psn_kind_chk;
alter table public.portal_sessions add constraint psn_kind_chk
  check (kind in ('class','webinar','workshop','office_hours','remedial','athar_hour'));

alter table public.portal_learning_lines drop constraint if exists portal_learning_lines_kind;
alter table public.portal_learning_lines add constraint portal_learning_lines_kind
  check (kind in ('learn','apply','commit','hour_word','hour_line','hour_vote','carry','hour_seal'));

create index if not exists portal_sessions_athar_hour_idx on public.portal_sessions (classroom_id, starts_at) where kind = 'athar_hour';

comment on constraint portal_learning_lines_kind on public.portal_learning_lines is
  'P66: learn/apply/commit · P73 ساعة الأثر: hour_word (كلمة) · hour_line (سطر مقترح) · hour_vote (صوت) · carry (أحمله معي) · hour_seal (ختم الأستاذ: السطر الجماعي والأعداد)';

-- التشخيص (المتوقَّع: صفّان — كل قيد ونصّه الجديد)
select conname as "القيد", pg_get_constraintdef(oid) as "النص"
from pg_constraint
where conname in ('psn_kind_chk', 'portal_learning_lines_kind')
order by conname;
