# إصدار P67 — «سياسة الجهة — الاسم يدخل من الباب»

**المنصّة:** أَثَر — بوابة التعليم والتدريب والتطوير · **المسارات:** `/org?tab=policy` (تبويب «السياسة والهوية») · `/enter?o=<slug>` (باب الدخول بالرمز — ثنائي اللغة، جوّال/كشك) · `/verify/policy?code=ATH-OP-…` · `/api/org/policy` · `/api/enter` · `/api/me/policy`
**الاسم الرسمي (عقود/إدارة):** سياسة حوكمة هوية المنسوبين وحدود المعالجة على مستوى الجهة / Organization-level identity & processing policy
**المالك:** د. أحمد محمد عبدالعزيز بدوي © 2026 — تُسجَّل تجاريًّا عبر شركة بوابة التميز للاستشارات والتدريب.
**الحالة:** مبنيّ ومختبَر محليًّا (وحدات 1060/0 · E2E على المحاكي) · SQL `supabase/p67-org-policy.sql` يُنفَّذ أولًا.

---

## 1) الفكرة في سطر
الجهة الحكومية لا «تثق» بالمنصّة — **تقرّر** ما الذي يصل إليها. سبعة مفاتيح على صفّ الجهة نفسه (`portal_organizations.policy` jsonb) وكل مفتاح له **نقطة اختناق واحدة في الخادم**؛ الإغلاق يُختم بوثيقة موقَّعة (`ATH-OP`) تقرؤها الرقابة من رابط عام، والمنسوب يدخل **برقمه التدريبي ورقم سري** بلا بريد ولا اسم — فالاسم لا يعبر الباب أصلًا.

**جملة المنتج:** «ما تُغلقه الجهة لا يفتحه أحد من داخل أَثَر — والختم يثبت ذلك.»

## 2) المفاتيح السبعة ونقاط الاختناق
| المفتاح | ما يعنيه | أين يُنفَّذ (المكان الوحيد) |
|---|---|---|
| `pseudonymous` هوية مستعارة | المنسوب رقم تدريبي؛ جدول «الرقم ↔ الشخص» عند الجهة | إنشاء الحسابات من القائمة ببريد مصطنع `<رقم>@<slug>.id.athar-portal.sa` + شارة في `/admin/shield` (يستلزم `code_login`) |
| `code_login` الدخول بالرمز | `/enter`: رقم + 6 أرقام · قفل بعد 5 محاولات | `lib/org/roster.ts: enterWithCode` → `signInWithPassword` · القفل في `portal_org_codes` + حدث `org_code_locked` |
| `public_faces_off` لا وجوه عامة | لا ملف عام لمنسوب · لا عقدة للجهة في الرسم | `portal_public_profile` (SQL: `portal_user_org_flag`) · `loadSources` يُسقط عقدة الجهة |
| `home_threads_off` لا خيوط في الرئيسية | أحداث المنسوبين لا تدخل أي تجميع عام | `lib/portal/evidence-cron.ts: loadSources` (قبل `buildGraph`) |
| `voice_off` لا صوت | يختفي «نادِ» · الأمانة الصوتية · «بصوتي» · خيوط الخريطة الصوتية | `/api/me/voice-reply` · `/api/media (audio/*)` · `setLineVoice` · `setThreadVoice` · `Nadi.tsx` يخفي الزرّ |
| `media_off` لا وسائط | لا تسجيلات أداء | `/api/media POST` → 403 |
| `verify_minimal` تحقّق أدنى | صفحات التحقّق تُظهر صحّة الوثيقة فقط | `verifyGrad` · `verifyMap` (يحجبان face/body حتى لو `live_public`) |
+ `kiosk_minutes` (0/5/10/20/30): خروج تلقائي بعد خمول على أجهزة القاعات (`kioskWatch` في `Nadi.tsx` → `signOut` → `/enter?o=`).

الرسالة 403 إنسانية وبصيغة واحدة (`POLICY_BLOCK_AR`): «جهتك أغلقت الصوت — اكتب ما كنت ستقوله…» — القرار منسوب للجهة لا للمتعلّم، مثل 423 التجميد.

## 3) لمسات أَثَر
- ★1 **«كما يراني الزائر»** في التبويب: خمسة بنود بأعداد (ملفات عامة · وجوه التحقّق · عقدة الرسم · أحداث الخيوط · رسائل الشهر) مع المفتاح الذي يتحكّم بكلٍّ منها — الجهة ترى أثر قرارها قبل أن يراه غيرها.
- ★2 **ختم `ATH-OP`** لكل حفظ: `AtharOrgPolicySeal` موقَّع Ed25519 بمفتاح الموقع (`signReceipt`) + `changed[]` + بيان عربي؛ `/verify/policy` يُظهر «صدر بعده ختم أحدث» بصدق.
- ★3 **جدول الربط لا يُخزَّن**: الأرقام السرية تُعاد **مرّة واحدة** في استجابة `roster` (بطاقات A4 + CSV من المتصفح) — لا عمود `pin` في أي جدول؛ الحدث `org_codes` يسجّل الأعداد فقط.
- ★4 **«الرمز يتكلّم»**: عند أول دخول يختار المنسوب كُنية من **قائمة مغلقة** (12 كُنية — لا نصّ حرّ فلا يتسرّب اسم) تصبح اسم العرض؛ الرقم يبقى في `user_metadata.training_no`.
- ★5 **«ميثاق الرمز»**: أربعة أسطر في أول دخول — ما نعرفه وما لا نعرفه ومن يرى ماذا وأن لا شيء يدخل في تقييم.
- **وضع الكشك** للقاعات المشتركة · **تغيير الرقم السري** اختياري بعد أول دخول (`pin_changed` ظاهر لمدير الجهة) · **إيقاف/إعادة تشغيل** رمز = حظر الحساب في Auth.

## 4) القرارات والأسماء
- **«الاسم يدخل من الباب»**: الاسم لا يُحذف لاحقًا — لا يدخل أصلًا. لذلك الباب منفصل (`/enter`) ولا يمرّ بـ OTP البريد.
- **البريد المصطنع** `<رقم>@<slug>.id.athar-portal.sa` لأن Supabase Auth يحتاج بريدًا؛ النطاق `id.athar-portal.sa` محجوز بلا MX — لا رسالة تُرسل إليه أبدًا. الـ`slug` فريد (`porg_slug_uidx`) وبصيغة `^[a-z][a-z0-9-]{1,23}$`.
- **الرقم السري يعيش في Auth فقط** (مُشفَّر كأي كلمة مرور). إعادة التعيين من مدير الجهة تُنتج رقمًا جديدًا يظهر مرّة واحدة.
- **الدمج عبر الجهات**: عضو في جهتين → أي «إغلاق» يغلب، وأقصر كشك يغلب (`mergePolicies`).
- **لا صفحة إدارية جديدة**: الطاقم يفتح التبويب نفسه من `/admin/shield` → «السياسة» (رابط `/org?org=<id>&tab=policy`)؛ مدير الجهة يراه في بوابته.
- **صفر** حزم npm · متغيّرات بيئة · كرون جديد (الحدود في `portal_rate_buckets`).

## 5) الحزمة
- SQL: `supabase/p67-org-policy.sql` (تشخيص متوقَّع: `p67_columns 4` · `p67_tables 2` · `p67_functions 4` · `p67_policies 3` · `p67_rls_on 2` · `p67_anon_grants 0` · `orgs_with_policy 0` · `flag_fn_ok true`).
- Lib: `lib/org/{policy,roster,epithets,policy-client}.ts` (جديدة) · تعديلات: `lib/grad/store.ts` · `lib/map/store.ts` · `lib/portal/evidence-cron.ts` · `lib/shield/{guard,freeze}.ts` · `lib/vault/registry.ts` · `lib/portal/way.ts`.
- API: `app/api/org/policy/route.ts` · `app/api/enter/route.ts` · `app/api/me/policy/route.ts` (جديدة) · بوابات في `app/api/media/route.ts` · `app/api/me/voice-reply/route.ts`.
- UI: `app/enter/page.tsx` · `app/verify/policy/page.tsx` · `app/components/OrgPolicy.tsx` (جديدة) · `app/org/page.tsx` (تبويب) · `app/components/Nadi.tsx` · `app/components/login/LoginCard.tsx` · `app/components/GlobalNavigation.tsx` · `app/admin/shield/page.tsx` (شارة + رابط).
- اختبارات: `tests/p67-org-policy.test.ts` (15) · E2E `tools/shot-p67.py`.
- أحداث درع جديدة: `org_policy` (warn) · `org_codes` · `org_pin_reset` · `org_code_revoked` · `org_code_restored` · `org_code_locked` (warn).

## 6) ما بعدها
P68 «تقرير القيادة» (صفحة موقَّعة قابلة للطباعة بالأرقام التدريبية) → P69 جهة تجريبية «قيادة افتراضية — المنطقة س» → `.sa` + النشر داخل المملكة. مؤجَّل بقرار: `lang_lock` (قفل اللغة) — لم يُبنَ لأن الباب ثنائي اللغة أصلًا.
