-- © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
-- هـ-2 (ج) — إصلاح: دلو athar-media الخاص كان مقصورًا على الفيديو/الصوت (P13-ج، 2026-12-18) فحجب صور الهيئة ووثائق الطاقم
-- (P31 سبقه بتاريخ 2026-12-08). نوسّع الأنواع المسموحة: صور الهيئة · ملفّات الوثائق (PDF) · الوسائط.
-- آمن للتكرار.
update storage.buckets
set allowed_mime_types = array[
      'image/jpeg','image/png','image/webp',
      'application/pdf',
      'video/webm','video/mp4','video/quicktime',
      'audio/webm','audio/ogg','audio/mp4','audio/mpeg','audio/wav'],
    file_size_limit = greatest(coalesce(file_size_limit, 0), 12582912),
    public = false
where id = 'athar-media';

-- فحص: المتوقع صفّ واحد وفيه image/jpeg
select id, public, file_size_limit, allowed_mime_types from storage.buckets where id = 'athar-media';
