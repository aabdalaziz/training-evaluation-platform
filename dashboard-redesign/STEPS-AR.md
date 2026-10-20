# إصلاح خطأ البناء + تطبيق اللوحة الجديدة والشعارات

## سبب الخطأ
رُفع مجلد `dashboard-redesign/` كاملًا إلى جذر المستودع، فأصبح فيه نسخة ثانية من الملفات في مسار خاطئ
(`dashboard-redesign/app/components/GlobalNavigation.tsx`) لا تجد `lib/supabase/client`. أما الملفات الأصلية في `app/` فلم تُستبدل.

## الخطوة 1 — حذف المجلد الخاطئ من المستودع
1. افتح: <https://github.com/aabdalaziz/training-evaluation-platform/tree/main/dashboard-redesign>
2. اضغط زر **«⋯»** أعلى يمين قائمة الملفات ← **Delete directory**.
3. اضغط **Commit changes…** ← **Commit changes**.

## الخطوة 2 — رفع الملفات الصحيحة (6 ملفات)
1. افتح: <https://github.com/aabdalaziz/training-evaluation-platform/upload/main>
2. من هذه الحزمة افتح مجلد **`upload`** — ستجد بداخله مجلدين: `app` و `public`.
3. اسحب **المجلدين `app` و `public`** معًا (وليس مجلد `upload` نفسه، ولا مجلد `dashboard-redesign`) إلى صفحة GitHub.
4. تأكد أن القائمة تعرض هذه المسارات بالضبط:
   - `app/dashboard/page.tsx`
   - `app/components/GlobalNavigation.tsx`
   - `app/style.css`
   - `public/logos/upm.png`
   - `public/logos/center.png`
   - `public/logos/gate.png`
5. اضغط **Commit changes**.

## الخطوة 3 — التحقق
بعد نشر Vercel (1–2 دقيقة) افتح `/dashboard`: ستظهر اللوحة الجديدة وبأعلى القائمة الجانبية شعار الجامعة وشعار بوابة التميز،
وفي التقارير (`/reports`, `/reports/center`, `/reports/executive`) شعار الجامعة والمركز العالمي.

## أين يُستخدم كل شعار؟
| الملف | الشعار | الاستخدام |
|---|---|---|
| `public/logos/upm.png` | جامعة الأمير مقرن (MAU) | القائمة الجانبية + رؤوس التقارير + لوحة الإدارة |
| `public/logos/center.png` | المركز العالمي لتعليم اللغة العربية | رؤوس التقارير وملفات PDF |
| `public/logos/gate.png` | بوابة التميز للاستشارات والتدريب | القائمة الجانبية للوحة التحكم |
