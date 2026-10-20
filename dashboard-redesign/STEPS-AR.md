# إعادة تصميم لوحة التحكم (مركز القيادة التنفيذي) — خطوات التطبيق

**الملفات المعدَّلة (3 ملفات فقط — استبدال كامل، بدون SQL، بدون حزم جديدة):**

| # | الملف | ماذا تغيّر |
|---|-------|------------|
| 1 | `app/dashboard/page.tsx` | إعادة كتابة كاملة: لوحة تنفيذية ببيانات حقيقية من Supabase بدل الأرقام الوهمية |
| 2 | `app/components/GlobalNavigation.tsx` | أيقونات SVG واضحة بدل الرموز التعبيرية، ويختفي الشريط العلوي داخل `/dashboard` (لأن اللوحة لها قائمتها الجانبية) |
| 3 | `app/style.css` | تنسيق بسيط لأزرار الشريط العلوي مع الأيقونات |

---

## الخطوة 1 — استبدال `app/dashboard/page.tsx`

1. افتح: <https://github.com/aabdalaziz/training-evaluation-platform/edit/main/app/dashboard/page.tsx>
2. اضغط داخل المحرر ثم **Ctrl+A** ثم **Delete** لحذف كل المحتوى.
3. افتح ملف `app/dashboard/page.tsx` من هذه الحزمة، انسخ كل محتواه، والصقه في محرر GitHub.
4. اضغط **Commit changes…** ← اكتب الرسالة: `Redesign executive dashboard with real data` ← **Commit changes**.

## الخطوة 2 — استبدال `app/components/GlobalNavigation.tsx`

1. افتح: <https://github.com/aabdalaziz/training-evaluation-platform/edit/main/app/components/GlobalNavigation.tsx>
2. **Ctrl+A** ← **Delete** ← الصق محتوى `app/components/GlobalNavigation.tsx` من الحزمة.
3. **Commit changes…** ← `Global nav: SVG icons` ← **Commit changes**.

## الخطوة 3 — استبدال `app/style.css`

1. افتح: <https://github.com/aabdalaziz/training-evaluation-platform/edit/main/app/style.css>
2. **Ctrl+A** ← **Delete** ← الصق محتوى `app/style.css` من الحزمة.
3. **Commit changes…** ← `Global nav styles` ← **Commit changes**.

> **بديل أسرع:** افتح <https://github.com/aabdalaziz/training-evaluation-platform/upload/main> واسحب مجلد `app` من هذه الحزمة كاملًا (سيستبدل الملفات الثلاثة بنفس المسارات) ثم **Commit changes**.

## الخطوة 4 — التحقق بعد نشر Vercel (دقيقة إلى دقيقتين)

1. افتح `/dashboard` وسجّل الدخول.
2. يجب أن ترى: المتوسط العام الحقيقي /5، الهدف 4.2، الفجوة، عدد الاستجابات، «قرار اليوم»، «مركز التنبيهات»، اتجاه 14 يومًا، لوحتي المدربين والقاعات، والوصول السريع للتقارير الـ12.
3. جرّب أزرار الفترة: **7 أيام / 14 يومًا / 30 يومًا / الكل** — تتغير كل المؤشرات والدلتا (▲▼ مقارنة بالفترة السابقة).
4. جرّب التبويبات الجانبية: البرامج التدريبية / التقييمات والروابط / التقارير / الإعدادات.

## ملاحظات مهمة

- **الشعار:** الملف `public/logos/upm.png` في المستودع حجمه 1 بايت (فارغ)، لذلك يظهر الشعار مكسورًا في الموقع. اللوحة الجديدة تعرض أيقونة بديلة تلقائيًا إذا كان الشعار مفقودًا. لرفع الشعار الحقيقي: افتح <https://github.com/aabdalaziz/training-evaluation-platform/upload/main/public/logos> وارفع ملفًا باسم `upm.png` بالضبط.
- **الملفات القديمة** في `app/dashboard/components/` (CommandCenter وما بداخله من أرقام وهمية) لم تعد مستخدمة ولا تؤثر على البناء. يمكن حذفها لاحقًا متى شئت — ليست خطوة مطلوبة الآن.
- لا توجد تغييرات على قاعدة البيانات أو RLS. اللوحة تقرأ من: `profiles, programs, evaluations, evaluation_answers, questions, classrooms, trainers, class_schedules, remote_learning_survey_responses` (كلها موجودة لديك).
