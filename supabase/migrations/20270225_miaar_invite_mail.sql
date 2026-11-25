-- © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
-- P76 «رسول مِعيار»: إرسال روابط الدعوة بالبريد من المنصّة نفسها (دائرة عمل مكتملة: دعوة → بريد → فتح → بدء → تقرير)
-- آمن لإعادة التشغيل.

alter table public.placement_invite_recipients
  add column if not exists mailed_at    timestamptz,            -- آخر إرسال ناجح (أي قناة آلية)
  add column if not exists mail_count   integer not null default 0,
  add column if not exists mail_channel text,                   -- email | whatsapp | push | manual
  add column if not exists mail_error   text;                   -- آخر خطأ (إن وُجد)

alter table public.placement_invites
  add column if not exists mail_sent_at timestamptz,            -- آخر دفعة بريد (شخصية أو جماعية)
  add column if not exists mail_count   integer not null default 0;  -- مجموع الرسائل المرسلة عبر هذه الدعوة

comment on column public.placement_invite_recipients.mailed_at is 'P76: آخر إرسال ناجح لرابط المستلم (يُجدَّد الرمز عند كل إرسال؛ الرابط القديم يبطل)';
