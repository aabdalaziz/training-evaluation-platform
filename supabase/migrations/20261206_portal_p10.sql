-- © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
-- بوابة أَثَر — P10: «أثير» المدرب الرفيق + محاكيات الأداء + الصفحة الحية (كل يوم مهارة · مستشارك · جلسة حوار)
--   • portal_scenarios        سيناريوهات لعب الأدوار (شخصية + موقف + هدف + معيار تقييم) — 4 سيناريوهات مبدئية
--   • portal_sim_runs         تشغيلات المحاكاة (الأدوار، الدرجة، الاعتماد البشري)
--   • portal_companion_memory ذاكرة «أثير» الملخّصة لكل متعلم (لا نصوص خام)
--   • portal_daily_skill      درس «كل يوم مهارة» المخزّن لكل يوم + portal_daily_answers إجابات التحدي
--   • portal_advisor_questions أسئلة «مستشارك: اسأل وأنا أجيب» وإجاباتها (للتحسين والتحويل البشري)
--   الكتابة كلها بمفتاح الخدمة عبر المسارات؛ القراءة وفق RLS. آمن لإعادة التشغيل.

create extension if not exists pgcrypto with schema extensions;

-- 1) السيناريوهات
create table if not exists public.portal_scenarios (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  created_by uuid,
  slug text unique not null,
  title_ar text not null, title_en text,
  situation_ar text not null,                     -- الموقف كما يراه المتعلم
  goal_ar text not null,                          -- ما المطلوب تحقيقه
  persona jsonb not null,                         -- {name, role, traits[], opening_ar, voice: 'child'|'adult'}
  skills uuid[] not null default '{}',
  rubric jsonb not null default '[]'::jsonb,      -- [{key,title_ar,weight,desc_ar}] مجموع الأوزان 100
  max_turns integer not null default 6,
  minutes integer not null default 5,
  level text,                                     -- A1..C2 أو null
  audience text not null default 'teacher',       -- teacher | trainer | consultant | learner
  status text not null default 'published',       -- draft | published | archived
  demo boolean not null default false             -- متاح للزوار بلا تسجيل (بلا حفظ)
);
alter table public.portal_scenarios enable row level security;
drop policy if exists portal_scenarios_public_read on public.portal_scenarios;
create policy portal_scenarios_public_read on public.portal_scenarios for select to anon, authenticated using (status = 'published' or public.portal_is_staff());
drop policy if exists portal_scenarios_writer_all on public.portal_scenarios;
create policy portal_scenarios_writer_all on public.portal_scenarios for all to authenticated using (public.portal_is_writer()) with check (public.portal_is_writer());

-- 2) التشغيلات
create table if not exists public.portal_sim_runs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid, email text,
  scenario_id uuid references public.portal_scenarios(id) on delete cascade,
  turns jsonb not null default '[]'::jsonb,       -- [{role:'persona'|'learner', text, at}]
  score jsonb,                                    -- {total, criteria[{key,score,note}], strengths[], improve[], expert_path}
  status text not null default 'running',         -- running | scored | approved | rejected
  source text, model text,
  ended_at timestamptz,
  approved_by uuid, approved_at timestamptz, note text
);
create index if not exists portal_sim_runs_user_idx on public.portal_sim_runs (user_id, created_at desc);
create index if not exists portal_sim_runs_status_idx on public.portal_sim_runs (status, created_at desc);
alter table public.portal_sim_runs enable row level security;
drop policy if exists portal_sim_runs_own_read on public.portal_sim_runs;
create policy portal_sim_runs_own_read on public.portal_sim_runs for select to authenticated using (user_id = auth.uid() or public.portal_is_staff());
revoke insert, update, delete on public.portal_sim_runs from anon, authenticated;

-- 3) ذاكرة أثير
create table if not exists public.portal_companion_memory (
  user_id uuid primary key,
  summary text not null default '',
  goals jsonb not null default '[]'::jsonb,
  prefs jsonb not null default '{}'::jsonb,       -- {voice:boolean, name:string}
  visits integer not null default 0,
  last_seen_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.portal_companion_memory enable row level security;
drop policy if exists portal_companion_memory_own_read on public.portal_companion_memory;
create policy portal_companion_memory_own_read on public.portal_companion_memory for select to authenticated using (user_id = auth.uid());
revoke insert, update, delete on public.portal_companion_memory from anon, authenticated;

-- 4) كل يوم مهارة
create table if not exists public.portal_daily_skill (
  day date primary key,
  skill_id uuid,
  lesson jsonb not null,                          -- {title_ar, hook_ar, idea_ar, example_ar, challenge{question_ar, options[], correct, explain_ar}, apply_ar}
  source text, model text,
  created_at timestamptz not null default now()
);
alter table public.portal_daily_skill enable row level security;
drop policy if exists portal_daily_skill_public_read on public.portal_daily_skill;
create policy portal_daily_skill_public_read on public.portal_daily_skill for select to anon, authenticated using (true);
create table if not exists public.portal_daily_answers (
  id bigserial primary key,
  day date not null,
  user_id uuid, email text,
  choice integer not null, correct boolean not null,
  created_at timestamptz not null default now()
);
create unique index if not exists portal_daily_answers_user_day on public.portal_daily_answers (day, user_id) where user_id is not null;
alter table public.portal_daily_answers enable row level security;
drop policy if exists portal_daily_answers_own_read on public.portal_daily_answers;
create policy portal_daily_answers_own_read on public.portal_daily_answers for select to authenticated using (user_id = auth.uid() or public.portal_is_staff());
revoke insert, update, delete on public.portal_daily_answers from anon, authenticated;

-- 5) مستشارك
create table if not exists public.portal_advisor_questions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text, email text, question text not null, answer text, source text, model text,
  handoff boolean not null default false, lang text, page text, user_id uuid
);
alter table public.portal_advisor_questions enable row level security;
drop policy if exists portal_advisor_questions_staff_read on public.portal_advisor_questions;
create policy portal_advisor_questions_staff_read on public.portal_advisor_questions for select to authenticated using (public.portal_is_staff());
revoke insert, update, delete on public.portal_advisor_questions from anon, authenticated;

-- 6) بذور السيناريوهات (تُحدَّث إن وُجدت بنفس slug)
insert into public.portal_scenarios (slug, title_ar, title_en, situation_ar, goal_ar, persona, skills, rubric, max_turns, minutes, level, audience, demo) values
(
  'dad-dha',
  'طالب لا يميّز بين الضاد والظاء', 'A learner who confuses ḍād and ẓāʾ',
  'أنت معلّم/معلّمة عربية في صف للناطقين بغيرها. «رافي» (12 سنة، من الهند) متحمس لكنه يُحبط بسرعة، ويقرأ «ظهر» على أنها «ضهر» ويخلط بينهما في الكتابة. أمامك ثلاث دقائق في نهاية الحصة.',
  'صحّح الخلط بطريقة لا تُحبط رافي، واستخدم تقنية حسية أو مقارنة واضحة، وتأكد من فهمه قبل أن ينصرف.',
  '{"name":"رافي","role":"طالب في الصف السادس من الهند، مستوى A2","traits":["متحمس","يُحبط بسرعة إن شعر بالخطأ","يحب الأمثلة من كرة القدم","يسأل كثيرًا: لماذا؟"],"opening_ar":"أستاذ… أنا كتبت «ضهر» في الاختبار وقلت لي خطأ. بس أنا سمعتها كذا! ليش هي غلط؟","voice":"child"}',
  array(select id from public.portal_skills where code in ('ATH-AR-003','ATH-AR-006')),
  '[{"key":"empathy","title_ar":"التعامل مع الإحباط","weight":25,"desc_ar":"طمأنة الطالب وتحويل الخطأ إلى فرصة دون تقليل من شأنه"},{"key":"diagnosis","title_ar":"تشخيص السبب","weight":20,"desc_ar":"تحديد أن المشكلة سمعية/نطقية (مخرج الصوت) لا إملائية فقط"},{"key":"technique","title_ar":"تقنية التصحيح","weight":35,"desc_ar":"استخدام مقارنة مخرج الصوت أو إشارة حسية أو ثنائيات صغرى (ظل/ضل) مع نمذجة"},{"key":"check","title_ar":"التحقق من الفهم","weight":20,"desc_ar":"طلب إنتاج من الطالب (نطق/كتابة) قبل إنهاء الموقف"}]',
  6, 4, 'A2', 'teacher', true
),
(
  'silent-class',
  'صف صامت لا يشارك في المحادثة', 'A silent conversation class',
  'حصة محادثة لمستوى A2 عبر Teams. مرّت عشر دقائق ولم يتكلم أحد؛ الكاميرات مغلقة. «يوسف» يتحدث باسم المجموعة باقتضاب، ويبدو أن الطلاب خائفون من الخطأ أمام زملائهم.',
  'اكسر الصمت خلال خمس دقائق، وخفّض كلفة الخطأ، واجعل ثلاثة طلاب على الأقل يتكلمون بجمل كاملة.',
  '{"name":"يوسف","role":"طالب يتحدث باسم مجموعة من 8 طلاب، مستوى A2","traits":["مؤدّب ومقتضب","يخاف من الخطأ أمام الآخرين","يستجيب للمهام الصغيرة الواضحة","يتجاهل الأسئلة المفتوحة الكبيرة"],"opening_ar":"…نعم أستاذ. سمعنا. (صمت)","voice":"adult"}',
  array(select id from public.portal_skills where code in ('ATH-AR-003','ATH-AR-001','ATH-DG-001')),
  '[{"key":"safety","title_ar":"خفض كلفة الخطأ","weight":30,"desc_ar":"إجراءات تجعل الخطأ مقبولًا: إجابة في الدردشة أولًا، عمل ثنائي، نمذجة الخطأ من المعلم"},{"key":"task","title_ar":"تصميم مهمة صغيرة","weight":30,"desc_ar":"مهمة مغلقة قصيرة بسقالات (جملة ناقصة، اختيار، سؤال شخصي سهل) بدل سؤال مفتوح"},{"key":"turns","title_ar":"توزيع الأدوار","weight":20,"desc_ar":"مناداة محددة بلطف، ترتيب أدوار، استخدام أدوات المنصة (الغرف الفرعية/الرفع)"},{"key":"feedback","title_ar":"التغذية الراجعة","weight":20,"desc_ar":"تعزيز المحاولة لا الصحة فقط، وإعادة صياغة بدل تصحيح مباشر"}]',
  6, 5, 'A2', 'teacher', false
),
(
  'impact-skeptic',
  'مدير يشكّ في جدوى التدريب', 'A manager who doubts training ROI',
  'اجتماع مع «م. خالد» مدير الموارد البشرية في جهة حكومية. أنفقوا العام الماضي على برامج كثيرة «ولم يتغير شيء». لديه عشر دقائق، ويريد رقمًا لا وعودًا.',
  'أقنعه بنموذج قياس أثر واقعي (قبل/أثناء/بعد) يربط التدريب بسلوك العمل، واتفق معه على تجربة محدودة بمؤشر واحد واضح.',
  '{"name":"م. خالد","role":"مدير موارد بشرية، خلفية هندسية، مشغول","traits":["مباشر ومتشكك","يقاطع الكلام العام","يحترم الأرقام والتجارب الصغيرة","يرفض أي التزام مالي كبير قبل الدليل"],"opening_ar":"خلّينا صرحاء: دفعنا كثير على تدريب السنة الماضية وما شفنا نتيجة. وش الفرق عندكم؟ وبلا كلام تسويقي.","voice":"adult"}',
  array(select id from public.portal_skills where code in ('ATH-QA-001','ATH-PD-001')),
  '[{"key":"listen","title_ar":"الإصغاء وإعادة الصياغة","weight":20,"desc_ar":"تلخيص مشكلته بدقة قبل العرض"},{"key":"model","title_ar":"نموذج قياس واضح","weight":35,"desc_ar":"قبل/بعد + نقل أثر + مؤشر عمل واحد، مع ذكر ما لا يمكن قياسه بصدق"},{"key":"pilot","title_ar":"اقتراح تجربة محدودة","weight":25,"desc_ar":"نطاق صغير، مدة، مؤشر، وشرط نجاح متفق عليه"},{"key":"honesty","title_ar":"الصدق في الحدود","weight":20,"desc_ar":"عدم المبالغة في الوعود، والاعتراف بالعوامل خارج التدريب"}]',
  6, 6, null, 'consultant', false
),
(
  'design-in-two-days',
  'عميلة تريد برنامجًا كاملًا خلال يومين', 'A client wants a full program in two days',
  '«أ. نورة» مسؤولة التدريب في شركة تطلب برنامج «مهارات التواصل» لـ60 موظفًا يبدأ بعد يومين، بلا تحليل احتياج، وبميزانية محدودة.',
  'انتقل بها من «دورة جاهزة» إلى تصميم مبني على مخرجات ومهارات قابلة للقياس، دون أن تخسر الصفقة أو تَعِد بما لا يمكن تنفيذه.',
  '{"name":"أ. نورة","role":"مسؤولة تدريب في شركة متوسطة، تحت ضغط مديرها","traits":["ودودة لكنها مستعجلة","تريد حلًا اليوم","تتجاوب مع البدائل العملية","تخاف من الظهور بمظهر غير المنظمة أمام الإدارة"],"opening_ar":"أحتاج دورة تواصل لـ60 موظف تبدأ الخميس. عندكم شيء جاهز؟ المدير يبي يشوف شيء بسرعة.","voice":"adult"}',
  array(select id from public.portal_skills where code in ('ATH-PD-001')),
  '[{"key":"needs","title_ar":"تحليل احتياج سريع","weight":30,"desc_ar":"3 أسئلة تشخيصية تكشف المشكلة الحقيقية خلف الطلب"},{"key":"outcomes","title_ar":"مخرجات قابلة للقياس","weight":30,"desc_ar":"تحويل «مهارات تواصل» إلى 2–3 سلوكيات عمل محددة"},{"key":"options","title_ar":"بدائل واقعية","weight":25,"desc_ar":"خيار سريع مرحلي + خيار كامل لاحق، بجدول وميزانية"},{"key":"relationship","title_ar":"الحفاظ على العلاقة","weight":15,"desc_ar":"دعم موقفها أمام إدارتها وتقديم شيء ملموس اليوم"}]',
  6, 6, null, 'trainer', false
)
on conflict (slug) do update set title_ar = excluded.title_ar, title_en = excluded.title_en, situation_ar = excluded.situation_ar, goal_ar = excluded.goal_ar, persona = excluded.persona, skills = excluded.skills, rubric = excluded.rubric, max_turns = excluded.max_turns, minutes = excluded.minutes, level = excluded.level, audience = excluded.audience, demo = excluded.demo;

-- 7) تحقق
select 'tables' as t, count(*) as n from information_schema.tables where table_schema = 'public' and table_name in ('portal_scenarios','portal_sim_runs','portal_companion_memory','portal_daily_skill','portal_daily_answers','portal_advisor_questions')
union all select 'scenarios seeded', count(*) from public.portal_scenarios where slug in ('dad-dha','silent-class','impact-skeptic','design-in-two-days')
union all select 'scenarios with skills', count(*) from public.portal_scenarios where cardinality(skills) > 0
union all select 'policies', count(*) from pg_policies where schemaname = 'public' and tablename in ('portal_scenarios','portal_sim_runs','portal_companion_memory','portal_daily_skill','portal_daily_answers','portal_advisor_questions');
