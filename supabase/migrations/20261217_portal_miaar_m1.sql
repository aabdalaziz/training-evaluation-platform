-- © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
-- بوابة أَثَر — «مِعيار — من أَثَر» م1 «مِعيار يدخل البيت» (2026-12-17)
-- ينقل اختبار تحديد المستوى «مِعيار» إلى Supabase أَثَر: الجداول الأصلية الـ14 بأسمائها (تتقبّل الاستيراد من المشروع القديم كما هو)
-- + بنية البنك v2 (أنواع البنود · الوسائط · واصفات CEFR · النطاقات الفرعية) + المقاطع في الجدول بدل الكود + «دعوات مِعيار» (جماعية/شخصية)
-- + «مِسبار» (نقطة البداية) و«ميزان الثقة» في الجلسة والتقرير.
-- كل الجداول للخدمة فقط (RLS مفعّلة بلا سياسات): الكتابة والقراءة عبر مسارات أَثَر بمفتاح الخدمة، وطاقم أَثَر يدخل بأدواره.
create extension if not exists pgcrypto;

-- 1) واصفات CEFR (المرجع المشترك للبنود والمخطّطات)
create table if not exists public.miaar_descriptors (
  code text primary key,
  level text not null check (level in ('PRE_A1','A1','A2','B1','B2','C1','C2')),
  mode text not null check (mode in ('reading','listening','language_use','writing','speaking')),
  text_ar text not null, text_en text not null,
  sort int not null default 0
);

-- 2) المقاطع (قراءة/استماع) — كانت ثابتة في الكود؛ الآن يديرها الطاقم
create table if not exists public.miaar_passages (
  id text primary key,
  level text not null, skill text not null check (skill in ('reading','listening')),
  title text not null, body text not null,
  audio_public_path text, audio_storage_path text, transcript text,
  status text not null default 'approved' check (status in ('draft','in_review','approved','archived')),
  source text not null default 'bundled', version text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

-- 3) بنك الأسئلة (الأسماء الأصلية + أعمدة v2 اختيارية حتى يُستورد القديم كما هو)
create table if not exists public.question_bank_items (
  id uuid primary key default gen_random_uuid(),
  item_code text not null, content_version text not null default 'athar-v2',
  level text not null, skill text not null,
  passage_id text, question_text text not null, options jsonb not null default '[]'::jsonb,
  cefr_descriptor text, domain text,
  status text not null default 'draft',
  source_kind text not null default 'manual',
  latest_review_note text, latest_review_references text,
  reviewed_by uuid, reviewed_at timestamptz, import_batch_id uuid, created_by uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  -- v2
  item_type text not null default 'mcq' check (item_type in ('mcq','picture_choice','picture_label','picture_sequence','true_false_notgiven','cloze_bank','matching','ordering','word_tap','short_dictation')),
  descriptor_code text references public.miaar_descriptors(code),
  sub_band text check (sub_band is null or sub_band in ('PRE_A1','A1','A2','A2+','B1','B1+','B2','B2+','C1','C2')),
  stimulus jsonb, media_path text, media_alt text,
  difficulty_est smallint check (difficulty_est is null or difficulty_est between 1 and 5),
  exposure_count int not null default 0,
  legacy_extra jsonb,
  unique (content_version, item_code)
);
create index if not exists question_bank_items_pool_idx on public.question_bank_items(status, level, skill);
create table if not exists public.question_bank_answer_keys (
  item_id uuid primary key references public.question_bank_items(id) on delete cascade,
  correct_option_id text not null, accepted jsonb, updated_at timestamptz not null default now()
);
create table if not exists public.question_bank_review_events (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.question_bank_items(id) on delete cascade,
  review_status text not null, academic_note text, academic_references text, reviewed_by uuid,
  created_at timestamptz not null default now()
);
create table if not exists public.question_bank_blueprints (
  id uuid primary key default gen_random_uuid(),
  code text not null unique, name_ar text not null, description_ar text,
  test_type text not null default 'comprehensive', requirements jsonb not null default '{}'::jsonb,
  duration_minutes int not null default 50, is_system boolean not null default false, created_by uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  purpose text not null default 'placement' check (purpose in ('placement','level','exit','diagnostic')),
  level text, cut_percent int not null default 60
);
create table if not exists public.question_bank_forms (
  id uuid primary key default gen_random_uuid(),
  title text not null, test_type text not null default 'comprehensive',
  blueprint_id uuid references public.question_bank_blueprints(id) on delete set null,
  selection_mode text not null default 'auto', status text not null default 'draft',
  requirements jsonb, generation_seed text, created_by uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  purpose text not null default 'placement', level text, duration_seconds int, published_at timestamptz,
  is_active boolean not null default false
);
create table if not exists public.question_bank_form_items (
  form_id uuid not null references public.question_bank_forms(id) on delete cascade,
  item_id uuid not null references public.question_bank_items(id) on delete cascade,
  position int not null default 0, is_anchor boolean not null default false, scored boolean not null default true,
  primary key (form_id, item_id)
);
create table if not exists public.question_bank_import_batches (
  id uuid primary key default gen_random_uuid(),
  source_format text, file_name text, content_version text, initial_status text, file_sha256 text, created_by uuid,
  status text not null default 'processing', total_rows int, valid_rows int, imported_rows int, rejected_rows int, validation_summary jsonb,
  created_at timestamptz not null default now(), completed_at timestamptz
);
create table if not exists public.question_bank_import_errors (
  id bigserial primary key,
  batch_id uuid references public.question_bank_import_batches(id) on delete cascade,
  source_row_number int, item_code text, field_name text, error_code text, error_message text,
  created_at timestamptz not null default now()
);

-- 4) الجلسات الآمنة والإجابات والتقارير والقرارات (كما في مِعيار + أعمدة م1)
create table if not exists public.placement_secure_sessions (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  candidate jsonb not null default '{}'::jsonb,
  candidate_email text generated always as (lower(candidate->>'email')) stored,
  content_version text, exam_mode text not null default 'adaptive',
  status text not null default 'active' check (status in ('active','completed','expired','abandoned')),
  current_level_index int not null default 0,
  started_at timestamptz not null default now(), expires_at timestamptz not null,
  finished_at timestamptz, finish_reason text, report jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  -- م1
  invite_id uuid, recipient_id uuid, user_id uuid,
  start_level_index int not null default 0, direction text not null default 'up' check (direction in ('up','down')),
  probe jsonb, access jsonb, legacy_extra jsonb
);
create index if not exists placement_secure_sessions_email_idx on public.placement_secure_sessions(candidate_email, status);
create table if not exists public.placement_secure_answers (
  session_id uuid not null references public.placement_secure_sessions(id) on delete cascade,
  question_id text not null, selected_option_id text not null,
  submitted_at timestamptz not null default now(),
  primary key (session_id, question_id)
);
create table if not exists public.placement_reports (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid, test_version text, candidate_email text, report jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  access_code text unique, invite_id uuid, user_id uuid, legacy_extra jsonb
);
create index if not exists placement_reports_email_idx on public.placement_reports(lower(candidate_email), created_at desc);
create table if not exists public.placement_decisions (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null unique references public.placement_reports(id) on delete cascade,
  recommended_level text, assigned_level text not null,
  decision_status text not null default 'review' check (decision_status in ('approved','review','retest','hold','pending')),
  program_track text, cohort_name text, academic_term text, academic_note text,
  decided_by uuid, decided_at timestamptz not null default now(),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.placement_decision_events (
  id bigserial primary key,
  decision_id uuid, report_id uuid, event_type text not null, payload jsonb, actor uuid,
  created_at timestamptz not null default now()
);
create table if not exists public.test_retake_approvals (
  id uuid primary key default gen_random_uuid(),
  email text not null, approved_by uuid, note text,
  created_at timestamptz not null default now(), used_at timestamptz
);
create index if not exists test_retake_approvals_email_idx on public.test_retake_approvals(lower(email), used_at);

-- 5) دعوات مِعيار: رابط/باركود جماعي أو شخصي
create table if not exists public.placement_invites (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  kind text not null default 'group' check (kind in ('group','personal')),
  label_ar text not null, org_id uuid, program_id uuid,
  lang text not null default 'en', exam_mode text not null default 'adaptive' check (exam_mode in ('adaptive','comprehensive')),
  purpose text, expires_at timestamptz, max_seats int,
  status text not null default 'open' check (status in ('open','closed')),
  note text, created_by uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.placement_invite_recipients (
  id uuid primary key default gen_random_uuid(),
  invite_id uuid not null references public.placement_invites(id) on delete cascade,
  email text not null, name text, token_hash text not null unique,
  opened_at timestamptz, started_at timestamptz, report_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists placement_invite_recipients_invite_idx on public.placement_invite_recipients(invite_id);

-- 6) قرار التسكين: التوصية من التقرير تلقائيًا + سجلّ أحداث
create or replace function public.miaar_decision_fill() returns trigger language plpgsql as $fn$
declare r jsonb;
begin
  if new.recommended_level is null then
    select report into r from public.placement_reports where id = new.report_id;
    new.recommended_level := coalesce(r->'ملخص_التسكين'->>'مستوى_الالتحاق_المقترح', r->>'المستوى_العام');
  end if;
  new.updated_at := now();
  if tg_op = 'UPDATE' then new.decided_at := now(); end if;
  return new;
end $fn$;
drop trigger if exists miaar_decision_fill_tg on public.placement_decisions;
create trigger miaar_decision_fill_tg before insert or update on public.placement_decisions for each row execute function public.miaar_decision_fill();
create or replace function public.miaar_decision_event() returns trigger language plpgsql as $fn$
begin
  insert into public.placement_decision_events(decision_id, report_id, event_type, payload, actor)
  values (new.id, new.report_id, case when tg_op = 'INSERT' then 'created' else 'updated' end,
          jsonb_build_object('assigned_level', new.assigned_level, 'decision_status', new.decision_status, 'program_track', new.program_track, 'cohort_name', new.cohort_name, 'academic_term', new.academic_term),
          new.decided_by);
  return new;
end $fn$;
drop trigger if exists miaar_decision_event_tg on public.placement_decisions;
create trigger miaar_decision_event_tg after insert or update on public.placement_decisions for each row execute function public.miaar_decision_event();

-- 7) RLS: للخدمة فقط
do $do$ declare t text; begin
  foreach t in array array['miaar_descriptors','miaar_passages','question_bank_items','question_bank_answer_keys','question_bank_review_events','question_bank_blueprints','question_bank_forms','question_bank_form_items','question_bank_import_batches','question_bank_import_errors','placement_secure_sessions','placement_secure_answers','placement_reports','placement_decisions','placement_decision_events','test_retake_approvals','placement_invites','placement_invite_recipients'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $do$;

-- 8) دلو الوسائط (صوت المقاطع · صور البنود) — خاص؛ الروابط موقَّعة من الخادم
insert into storage.buckets (id, name, public) values ('miaar-media', 'miaar-media', false) on conflict (id) do nothing;

-- 9) البذور
insert into public.miaar_descriptors(code, level, mode, text_ar, text_en, sort) values
('RD-PRE_A1-01', 'PRE_A1', 'reading', 'يتعرّف الحروف والكلمات المألوفة جدًا مع صورة', 'Can recognise very familiar words with a picture', 0),
('RD-PRE_A1-02', 'PRE_A1', 'reading', 'يفهم أرقامًا وأسعارًا وأوقاتًا بسيطة', 'Can understand simple numbers, prices and times', 1),
('RD-PRE_A1-03', 'PRE_A1', 'reading', 'يفهم كلمة على لافتة أو زرّ مألوف', 'Can understand a familiar word on a sign or button', 2),
('RD-PRE_A1-04', 'PRE_A1', 'reading', 'يطابق كلمة مكتوبة بصورتها', 'Can match a written word to its picture', 3),
('RD-A1-01', 'A1', 'reading', 'يفهم لافتات وإشارات مألوفة في الشارع والمطار', 'Can understand familiar signs and notices', 4),
('RD-A1-02', 'A1', 'reading', 'يفهم رسالة قصيرة وبسيطة (تحية، موعد)', 'Can understand a short simple message', 5),
('RD-A1-03', 'A1', 'reading', 'يجد معلومة محدّدة في نصّ قصير مع صور', 'Can find specific information in a short text with pictures', 6),
('RD-A1-04', 'A1', 'reading', 'يفهم جُملًا قصيرة عن نفسه وعائلته', 'Can understand short sentences about self and family', 7),
('RD-A2-01', 'A2', 'reading', 'يفهم نصوصًا قصيرة عن مواضيع مألوفة (عمل، تسوّق)', 'Can understand short texts on familiar topics', 8),
('RD-A2-02', 'A2', 'reading', 'يجد معلومة محدّدة في إعلان أو قائمة أو جدول', 'Can locate specific information in adverts, menus and timetables', 9),
('RD-A2-03', 'A2', 'reading', 'يفهم رسالة شخصية بسيطة عن أحداث يومية', 'Can understand a simple personal letter about everyday events', 10),
('RD-A2-04', 'A2', 'reading', 'يفهم تعليمات قصيرة وبسيطة (استعمال جهاز، طريق)', 'Can understand short simple instructions', 11),
('RD-B1-01', 'B1', 'reading', 'يفهم الأفكار الرئيسة في نصّ واضح عن موضوع مألوف', 'Can understand the main points of clear texts on familiar matters', 12),
('RD-B1-02', 'B1', 'reading', 'يتابع تسلسل أحداث في قصّة أو تقرير بسيط', 'Can follow the sequence of events in a narrative or report', 13),
('RD-B1-03', 'B1', 'reading', 'يفهم وصف مشاعر وأمنيات في رسالة شخصية', 'Can understand feelings and wishes in personal letters', 14),
('RD-B1-04', 'B1', 'reading', 'يستخرج رأيًا واضحًا من مقال قصير', 'Can identify a clearly stated opinion in a short article', 15),
('RD-B2-01', 'B2', 'reading', 'يفهم مقالات وتقارير عن قضايا معاصرة بوجهات نظر', 'Can understand articles and reports on contemporary issues with viewpoints', 16),
('RD-B2-02', 'B2', 'reading', 'يميّز الفكرة الرئيسة من التفاصيل الداعمة', 'Can distinguish main ideas from supporting detail', 17),
('RD-B2-03', 'B2', 'reading', 'يفهم موقف الكاتب ونبرته', 'Can understand the writer’s stance and tone', 18),
('RD-B2-04', 'B2', 'reading', 'يتابع حجّة ممتدّة ويعرف خطواتها', 'Can follow an extended argument and its steps', 19),
('RD-C1-01', 'C1', 'reading', 'يفهم نصوصًا طويلة ومعقّدة ويدرك المعاني الضمنية', 'Can understand long complex texts and implicit meaning', 20),
('RD-C1-02', 'C1', 'reading', 'يفهم مقالات متخصّصة خارج مجاله مع مرجع أحيانًا', 'Can understand specialised articles outside own field', 21),
('RD-C1-03', 'C1', 'reading', 'يدرك الفروق الدقيقة في الموقف والسخرية والتلميح', 'Can recognise nuance, irony and allusion', 22),
('RD-C1-04', 'C1', 'reading', 'يقيّم بنية الحجّة وتماسكها', 'Can evaluate the structure and coherence of an argument', 23),
('RD-C2-01', 'C2', 'reading', 'يفهم بسهولة كل أشكال اللغة المكتوبة بما فيها المجرّد والأدبي', 'Can understand virtually all forms of written language including abstract and literary', 24),
('RD-C2-02', 'C2', 'reading', 'يدرك طبقات المعنى والأسلوب والمقصد', 'Can appreciate layers of meaning, style and intent', 25),
('RD-C2-03', 'C2', 'reading', 'يفهم نصوصًا تراثية أو شديدة التخصّص', 'Can understand classical or highly specialised texts', 26),
('RD-C2-04', 'C2', 'reading', 'ينقد منهج النصّ ومسلّماته', 'Can critique a text’s method and assumptions', 27),
('LI-PRE_A1-01', 'PRE_A1', 'listening', 'يتعرّف كلمات مألوفة جدًا مسموعة مع صورة', 'Can recognise very familiar spoken words with a picture', 28),
('LI-PRE_A1-02', 'PRE_A1', 'listening', 'يفهم تحية وأمرًا بسيطًا من كلمة', 'Can understand a greeting and a one-word instruction', 29),
('LI-PRE_A1-03', 'PRE_A1', 'listening', 'يفهم أرقامًا مسموعة ببطء', 'Can understand numbers spoken slowly', 30),
('LI-PRE_A1-04', 'PRE_A1', 'listening', 'يطابق كلمة مسموعة بصورتها', 'Can match a spoken word to its picture', 31),
('LI-A1-01', 'A1', 'listening', 'يفهم كلمات وعبارات مألوفة عن نفسه وعائلته ببطء ووضوح', 'Can understand familiar words and phrases about self and family when spoken slowly', 32),
('LI-A1-02', 'A1', 'listening', 'يفهم أسئلة بسيطة في مواقف الخدمة (المطار، الفندق)', 'Can understand simple questions in service situations', 33),
('LI-A1-03', 'A1', 'listening', 'يفهم توجيهات بسيطة (يمين، يسار، الباب)', 'Can understand simple directions', 34),
('LI-A1-04', 'A1', 'listening', 'يلتقط الأرقام والأوقات في إعلان مسموع قصير', 'Can catch numbers and times in a short announcement', 35),
('LI-A2-01', 'A2', 'listening', 'يفهم عبارات ومفردات شائعة في مواضيع يومية', 'Can understand common phrases on everyday topics', 36),
('LI-A2-02', 'A2', 'listening', 'يلتقط الفكرة الرئيسة من رسالة أو إعلان قصير واضح', 'Can catch the main point of short clear messages and announcements', 37),
('LI-A2-03', 'A2', 'listening', 'يفهم حوارًا بسيطًا عن مواعيد وأسعار وأماكن', 'Can understand a simple dialogue about appointments, prices and places', 38),
('LI-A2-04', 'A2', 'listening', 'يتابع تعليمات قصيرة خطوة خطوة', 'Can follow short step-by-step instructions', 39),
('LI-B1-01', 'B1', 'listening', 'يفهم الخطوط العامة لحديث واضح عن موضوع مألوف', 'Can understand the main points of clear speech on familiar matters', 40),
('LI-B1-02', 'B1', 'listening', 'يفهم الأفكار الرئيسة في برنامج إذاعي بوتيرة معتدلة', 'Can understand the main points of radio programmes at moderate pace', 41),
('LI-B1-03', 'B1', 'listening', 'يتابع محاضرة قصيرة واضحة البنية في مجاله', 'Can follow a short clearly structured talk in own field', 42),
('LI-B1-04', 'B1', 'listening', 'يفهم مكالمة هاتفية عملية (تغيير موعد، طلب)', 'Can understand a practical phone call', 43),
('LI-B2-01', 'B2', 'listening', 'يفهم حديثًا ممتدًّا وحجّة معقّدة في موضوع مألوف', 'Can understand extended speech and complex argument on familiar topics', 44),
('LI-B2-02', 'B2', 'listening', 'يفهم معظم نشرات الأخبار والبرامج الحوارية', 'Can understand most news and current-affairs programmes', 45),
('LI-B2-03', 'B2', 'listening', 'يميّز الموقف والنبرة في نقاش بين متحدّثين', 'Can identify stance and tone in a discussion between speakers', 46),
('LI-B2-04', 'B2', 'listening', 'يفهم عرضًا أكاديميًا أو مهنيًا بوتيرة طبيعية', 'Can understand an academic or professional presentation at natural pace', 47),
('LI-C1-01', 'C1', 'listening', 'يفهم حديثًا ممتدًّا حتى إن لم يكن واضح البنية', 'Can understand extended speech even when not clearly structured', 48),
('LI-C1-02', 'C1', 'listening', 'يدرك المعاني الضمنية والعلاقات غير المصرَّح بها', 'Can understand implicit meaning and unstated relationships', 49),
('LI-C1-03', 'C1', 'listening', 'يتابع نقاشًا متخصّصًا بين عدّة متحدّثين', 'Can follow a specialised discussion among several speakers', 50),
('LI-C1-04', 'C1', 'listening', 'يفهم السخرية والتلميح والتحفّظ في الكلام', 'Can understand irony, allusion and hedging in speech', 51),
('LI-C2-01', 'C2', 'listening', 'يفهم أيّ نوع من الكلام المسموع بوتيرة سريعة بعد تعوّد قصير', 'Can understand any kind of spoken language at fast native speed', 52),
('LI-C2-02', 'C2', 'listening', 'يدرك الفروق الأسلوبية والمستويات اللغوية', 'Can recognise stylistic and register differences', 53),
('LI-C2-03', 'C2', 'listening', 'يقيّم جودة حجّة مسموعة ومصداقيتها', 'Can evaluate the quality and credibility of a spoken argument', 54),
('LI-C2-04', 'C2', 'listening', 'يفهم نقاشًا مجرّدًا معقّدًا خارج مجاله', 'Can understand complex abstract discussion outside own field', 55),
('LU-PRE_A1-01', 'PRE_A1', 'language_use', 'يتعرّف أسماء الأشياء اليومية مع صورة', 'Can recognise names of everyday objects with pictures', 56),
('LU-PRE_A1-02', 'PRE_A1', 'language_use', 'يستعمل الضمائر «أنا/أنتَ/هو» مع صورة', 'Can use basic pronouns with picture support', 57),
('LU-PRE_A1-03', 'PRE_A1', 'language_use', 'يعرف الأعداد من 1 إلى 10 والألوان', 'Knows numbers 1–10 and colours', 58),
('LU-PRE_A1-04', 'PRE_A1', 'language_use', 'يميّز التحية والوداع والشكر', 'Can distinguish greetings, farewells and thanks', 59),
('LU-A1-01', 'A1', 'language_use', 'يستعمل المفردات الأساسية للتعريف بالنفس والعائلة', 'Can use basic vocabulary for self and family', 60),
('LU-A1-02', 'A1', 'language_use', 'يستعمل حروف الجرّ المكانية الأساسية (في، على، من، إلى)', 'Can use basic prepositions of place', 61),
('LU-A1-03', 'A1', 'language_use', 'يميّز المذكّر والمؤنّث والمفرد والجمع في كلمات مألوفة', 'Can distinguish gender and number in familiar words', 62),
('LU-A1-04', 'A1', 'language_use', 'يستعمل الجملة الاسمية البسيطة وأدوات الاستفهام الأساسية', 'Can use simple nominal sentences and basic question words', 63),
('LU-A2-01', 'A2', 'language_use', 'يصرّف الفعل المضارع والماضي مع الضمائر الشائعة', 'Can use present and past tense with common pronouns', 64),
('LU-A2-02', 'A2', 'language_use', 'يستعمل «أريد أن / يجب أن / يمكن أن» مع المضارع', 'Can use common modal structures with the present', 65),
('LU-A2-03', 'A2', 'language_use', 'يستعمل المفردات اليومية (تسوّق، سفر، صحّة) بدقّة معقولة', 'Can use everyday vocabulary with reasonable accuracy', 66),
('LU-A2-04', 'A2', 'language_use', 'يربط الجمل بـ «و، ثم، لأن، لكن»', 'Can link sentences with basic connectors', 67),
('LU-B1-01', 'B1', 'language_use', 'يستعمل روابط الشرط والزمن (إذا، عندما، بعد أن)', 'Can use conditional and temporal connectors', 68),
('LU-B1-02', 'B1', 'language_use', 'يستعمل الإضافة والنعت والعدد بدقّة معقولة', 'Can use idafa, adjective agreement and numbers with reasonable accuracy', 69),
('LU-B1-03', 'B1', 'language_use', 'يملك مفردات كافية لمواضيع العمل والدراسة والسفر', 'Has sufficient vocabulary for work, study and travel', 70),
('LU-B1-04', 'B1', 'language_use', 'يستعمل الأفعال المزيدة الشائعة والمصادر', 'Can use common derived verb forms and verbal nouns', 71),
('LU-B2-01', 'B2', 'language_use', 'يستعمل أدوات الاستدراك والتوكيد والتفصيل (بل، إنما، أمّا)', 'Can use connectors of contrast, emphasis and elaboration', 72),
('LU-B2-02', 'B2', 'language_use', 'يستعمل الجمل المركّبة والحال والتمييز بثقة', 'Can use complex sentences, circumstantial and specification structures', 73),
('LU-B2-03', 'B2', 'language_use', 'يميّز المتلازمات اللفظية والمعاني الاصطلاحية الشائعة', 'Can recognise common collocations and idiomatic meanings', 74),
('LU-B2-04', 'B2', 'language_use', 'يضبط الإعراب في البنى الشائعة عند الحاجة', 'Can control case endings in common structures when needed', 75),
('LU-C1-01', 'C1', 'language_use', 'يستعمل مدى واسعًا من البنى بمرونة ودقّة', 'Can use a broad range of structures flexibly and accurately', 76),
('LU-C1-02', 'C1', 'language_use', 'يميّز الفروق الدلالية الدقيقة بين المترادفات', 'Can distinguish fine shades of meaning between near-synonyms', 77),
('LU-C1-03', 'C1', 'language_use', 'يستعمل الأساليب البلاغية الشائعة (القصر، التقديم)', 'Can use common rhetorical devices', 78),
('LU-C1-04', 'C1', 'language_use', 'يفهم ويستعمل المصطلحات الأكاديمية والمهنية', 'Can understand and use academic and professional terminology', 79),
('LU-C2-01', 'C2', 'language_use', 'يتحكّم تحكّمًا تامًّا في التراكيب المعقّدة والنادرة', 'Has full control of complex and rare structures', 80),
('LU-C2-02', 'C2', 'language_use', 'يدرك الفروق الأسلوبية بين الفصحى التراثية والمعاصرة', 'Can recognise stylistic differences between classical and modern standard Arabic', 81),
('LU-C2-03', 'C2', 'language_use', 'يستعمل التعابير الاصطلاحية والأمثال في موضعها', 'Can use idioms and proverbs appropriately', 82),
('LU-C2-04', 'C2', 'language_use', 'يصحّح أخطاء دقيقة في نصوص متقدّمة', 'Can correct subtle errors in advanced texts', 83)
on conflict (code) do nothing;
insert into public.miaar_passages(id, level, skill, title, body, audio_public_path, audio_storage_path, source, version) values
('P_R_A1', 'A1', 'reading', 'تعريف بنفسي', 'مَرْحَبًا! اسْمِي سارَةُ، أَنا مِنْ مِصْرَ، وَأَعِيشُ في القاهِرَةِ مَعَ عائِلَتي. أَدْرُسُ اللُّغَةَ العَرَبِيَّةَ في الجامِعَةِ، وَأُحِبُّ القِراءَةَ وَالسِّباحَةَ. وَفي وَقْتِ الفَراغِ أَلْعَبُ مَعَ أَخِي الصَّغِيرِ في الحَدِيقَةِ القَرِيبَةِ مِنْ بَيْتِنا.', null, null, 'bundled', '1.4.0-advanced-c1c2'),
('P_R_A2', 'A2', 'reading', 'لقاء نادي العربية', 'يلتقي أعضاء نادي العربية كل يوم اثنين بعد الدرس، من الساعة الرابعة إلى الخامسة مساءً، في قاعة الأنشطة. في اللقاء القادم، يقرأ الطلاب حوارًا قصيرًا عن التسوق، ثم يتدربون على طلب الأشياء في المتجر. المشاركة مجانية. اكتب اسمك عند مكتب الاستقبال قبل يوم الأحد إذا أردت المشاركة.', null, null, 'bundled', '1.4.0-advanced-c1c2'),
('P_R_B1', 'B1', 'reading', 'العمل التطوعي', 'يُعَدُّ العَمَلُ التَّطَوُّعِيُّ مِنْ أَهَمِّ النَّشاطاتِ الَّتي تُسْهِمُ في بِناءِ المُجْتَمَعِ؛ فَهُوَ يُنَمِّي رُوحَ التَّعاوُنِ بَيْنَ أَفْرادِهِ، وَيَمْنَحُ المُتَطَوِّعَ خِبَراتٍ جَدِيدَةً تُساعِدُهُ في حَياتِهِ العَمَلِيَّةِ. وَقَدْ أَظْهَرَتْ دِراساتٌ حَدِيثَةٌ أَنَّ الأَشْخاصَ الَّذِينَ يُشارِكُونَ في الأَعْمالِ التَّطَوُّعِيَّةِ يَشْعُرُونَ بِسَعادَةٍ أَكْبَرَ مُقارَنَةً بِغَيْرِهِمْ.', null, null, 'bundled', '1.4.0-advanced-c1c2'),
('P_R_B2', 'B2', 'reading', 'العربية في العصر الرقمي', 'تواجه اللغة العربية في العصر الرقمي تحديات كبيرة؛ إذ يميل كثير من الشباب إلى استخدام الإنجليزية أو الكتابة بالحروف اللاتينية في تواصلهم اليومي على وسائل التواصل الاجتماعي. ويرى لغويون أن هذه الظاهرة قد تضعف المهارات اللغوية لدى الأجيال القادمة ما لم تُبذل جهود جادة لإثراء المحتوى العربي على شبكة الإنترنت.', null, null, 'bundled', '1.4.0-advanced-c1c2'),
('P_R_C1', 'C1', 'reading', 'ذاكرة المدن', 'لِلْمُدُنِ ذاكِرَةٌ كَذاكِرَةِ البَشَرِ، تُخْتَزَنُ في أَزِقَّتِها حِكايَاتُ العابِرِينَ، وَفي جُدْرانِها هَمْسَاتُ مَنْ رَحَلُوا. وَحِينَ تَمْشِي في مَدِينَةٍ عَتِيقَةٍ، لا تُبْصِرُ حَجارَتَها فَحَسْبَ، بَلْ تُصْغِي إِلى أَنْفاسِ قُرونٍ مَضَتْ، تَنْبِضُ بَيْنَ أَهْدابِ النَّوافِذِ العَتِيقَةِ. لِذلِكَ فَإِنَّ هَدْمَ حَيٍّ قَدِيمٍ لا يَعْنِي إِزالَةَ مَبانِيَ مُتَهالِكَةٍ، بَلْ مَحْوُ صَفَحاتٍ مِنْ كِتابِ الذاكِرَةِ الجَمْعِيَّةِ الَّتي لا تُسْتَعاضُ.', null, null, 'bundled', '1.4.0-advanced-c1c2'),
('P_R_C2', 'C2', 'reading', 'صِحَّةُ المَعْلُومَةِ وَسَلامَةُ الحُكْمِ', 'لا تَنْشَأُ هَشاشَةُ الحُكْمِ في البِيئَةِ الرَّقْمِيَّةِ مِنْ إِمْكانِ الكَذِبِ وَحْدَهُ؛ فَالمَعْلُومَةُ الصَّحيحَةُ قَدْ تُسْتَخْدَمُ اسْتِخْدامًا مُضَلِّلًا إِذا انْتُزِعَتْ مِنْ سِياقِها أَوْ عُومِلَتْ بِوَصْفِها مُمَثِّلَةً لِلكُلِّ. وَلَيْسَ التَّحَقُّقُ مُجَرَّدَ سُؤالٍ عَنْ مَصْدَرِ الخَبَرِ، بَلْ فَحْصٌ لِطَريقَةِ عَرْضِهِ، وَما أُغْفِلَ مِنْهُ، وَالافْتِراضاتِ الَّتي يُبْنى عَلَيْها الاِنْتِقالُ مِنَ الجُزْئِيِّ إِلى العامِّ. لِذلِكَ قَدْ يَكونُ الخِلافُ في تَقْييمِ مَعْلُومَةٍ واحِدَةٍ خِلافًا في شُروطِ الاِسْتِدْلالِ بِها، لا في صِحَّةِ أَلْفاظِها وَحْدَها.', null, null, 'bundled', '1.4.0-advanced-c1c2'),
('P_L_A1', 'A1', 'listening', 'في مراقبة الجوازات', 'جَوازَ سَفَرِكَ مِنْ فَضْلِكَ. تَفَضَّلْ. ما سَبَبُ زِيارَتِكَ؟ لِلسِّياحَةِ.', '/miaar/audio/L1.mp3', null, 'bundled', '1.4.0-advanced-c1c2'),
('P_L_A2', 'A2', 'listening', 'في المقهى', 'أَهْلًا وَسَهْلًا، ماذا تَطْلُبُ؟ أُريدُ شايًا بِدُونِ سُكَّرٍ وَسَلَطَةً. هَلْ تُريدُ شَيْئًا آخَرَ؟ لا شُكْرًا، الحِسابُ لاحِقًا.', '/miaar/audio/L2.mp3', null, 'bundled', '1.4.0-advanced-c1c2'),
('P_L_B1', 'B1', 'listening', 'مكالمة من شركة النور', 'مَرْحَبًا أَحْمَدُ، مَعَكَ شَرِكَةُ النُّورِ. نُريدُ تَأْكِيدَ مَوْعِدِ المُقابَلَةِ غَدًا السّاعَةَ العاشِرَةَ صَباحًا. يُرْجى إِحْضارُ سِيرَتِكَ الذّاتِيَّةِ وَجَوازِ سَفَرِكَ. هَلْ يُناسِبُكَ المَوْعِدُ؟', '/miaar/audio/L3.mp3', null, 'bundled', '1.4.0-advanced-c1c2'),
('P_L_B2', 'B2', 'listening', 'خبر عن منصة تعليمية', 'أَعْلَنَتْ وِزارَةُ التَّعْلِيمِ عَنْ إِطْلاقِ مِنَصَّةٍ جَدِيدَةٍ لِتَعْلِيمِ اللُّغَةِ العَرَبِيَّةِ لِلنّاطِقِينَ بِغَيْرِها مَجّانًا. وَتَهْدَفُ المِنَصَّةُ إِلى الوُصُولِ إِلى مِلْيُونِ مُتَعَلِّمٍ خِلالَ عامَيْنِ، وَتَحْتَوِي عَلى دُرُوسٍ تَفاعُلِيَّةٍ وَاخْتِباراتِ تَحْدِيدِ مُسْتَوًى.', '/miaar/audio/L4.mp3', null, 'bundled', '1.4.0-advanced-c1c2'),
('P_L_C1', 'C1', 'listening', 'رأي: مرونة الفصحى', 'كَثِيرُونَ يَظُنُّونَ أَنَّ الفُصْحى لُغَةٌ جامِدَةٌ، لَكِنَّها في الواقِعِ كانَتْ دائِمًا لُغَةً مَرِنَةً، اسْتَوْعَبَتْ مُصْطَلَحاتِ الطِّبِّ وَالفَلْسَفَةِ قَدِيمًا، وَتَسْتَوْعِبُ اليَوْمَ مُصْطَلَحاتِ التِّقْنِيَةِ. المُشْكِلَةُ لَيْسَتْ في اللُّغَةِ نَفْسِها، بَلْ في عُزُوفِ أَهْلِها عَنِ اسْتِخْدامِها في حَياتِهِمُ اليَوْمِيَّةِ.', '/miaar/audio/L5.mp3', null, 'bundled', '1.4.0-advanced-c1c2'),
('P_L_C2', 'C2', 'listening', 'نقاش: الترجمة والذكاء الاصطناعي', 'سالم: أَرَى أَنَّ تَرْجَمَةَ الذَّكاءِ الاصْطِناعِيِّ سَتَحُلُّ مَحَلَّ المُتَرْجِمِ البَشَرِيِّ تَمامًا خِلالَ عَقْدٍ. ليلى: أَخْتَلِفُ مَعَكَ؛ فَالآلَةُ تُجِيدُ نَقْلَ الأَلْفاظِ، لَكِنَّها تَعْجِزُ عَنِ الإِحاطَةِ بِثَقافَةِ النَّصِّ وَرُوحِهِ وَمَقاصِدِهِ البَلاغِيَّةِ. سالم: لَعَلَّكِ مُحِقَّةٌ في النُّصُوصِ الأَدَبِيَّةِ، لَكِنْ في النُّصُوصِ التِّقْنِيَّةِ وَالتِّجارِيَّةِ فَالآلَةُ أَسْرَعُ وَأَدَقُّ. ليلى: هُنا نَتْفَقُ؛ وَالحَلُّ في نَظَرِي تَكامُلٌ لا إِحْلالُ.', '/miaar/audio/L6.mp3', null, 'bundled', '1.4.0-advanced-c1c2'),
('P_L_A1_CEFR_02', 'A1', 'listening', 'خريطة المدينة', 'المرأة: مرحبًا. أرى أنك تحمل خريطة. هل تبحث عن مكان؟ الرجل: نعم، أبحث عن متحف صغير قرب البحر. المرأة: اذهب إلى الشارع الأول، ثم انعطف يمينًا. المتحف هناك. الرجل: شكرًا لك. سأذهب الآن.', null, 'in-review/P_L_A1_CEFR_02.mp3', 'bundled', '1.4.0-advanced-c1c2'),
('P_L_A1_CEFR_03', 'A1', 'listening', 'تذكرة إلى جدة', 'موظفة المحطة: مساء الخير. إلى أين تريد أن تسافر؟ الرجل: أريد تذكرة إلى جدة غدًا صباحًا. موظفة المحطة: القطار يغادر في الساعة الثامنة. هل تريد مقعدًا قرب النافذة؟ الرجل: نعم، من فضلك. أحب أن أرى البحر.', null, 'in-review/P_L_A1_CEFR_03.mp3', 'bundled', '1.4.0-advanced-c1c2'),
('P_L_A2_CEFR_01', 'A2', 'listening', 'في مكتب البريد', 'موظفة البريد: صباح الخير. كيف يمكنني مساعدتك؟ الرجل: أريد إرسال هذه الحقيبة الصغيرة إلى أخي في الرياض. هل تصل قبل يوم الجمعة؟ موظفة البريد: نعم، إذا أرسلتها اليوم بالبريد السريع. ستصل خلال يومين، لكن اكتب العنوان ورقم الهاتف في هذا النموذج. الرجل: ممتاز، سأملأ النموذج الآن وأدفع بالبطاقة.', null, 'in-review/P_L_A2_CEFR_01.mp3', 'bundled', '1.4.0-advanced-c1c2'),
('P_L_A2_CEFR_02', 'A2', 'listening', 'حملة الكتب', 'المرأة: مساء الخير يا نادر. هل انتهيت من تجهيز الكتب للحملة؟ الرجل: نعم، جمعت عشرين كتابًا من زملائي. سأضعها في الصندوق عند مدخل المكتبة. المرأة: رائع. السيارة ستصل بعد الساعة السادسة لنقل الصناديق إلى المدرسة. الرجل: إذن سأعود قبل السادسة لأساعد في تحميلها.', null, 'in-review/P_L_A2_CEFR_02.mp3', 'bundled', '1.4.0-advanced-c1c2'),
('P_R_A2_CEFR_01', 'A2', 'reading', 'رسالة عن رحلة نهاية الأسبوع', 'مرحبًا يا مريم، ذهبتُ يوم الجمعة مع زميلتي ليلى إلى الطائف. غادرنا جدة بالحافلة في السابعة صباحًا، ووصلنا قبل العاشرة. كان الجو هناك أبرد من جدة، لذلك أخذنا معنا سترات خفيفة. زرنا سوقًا قديمًا واشترينا هدايا صغيرة لأسرنا، ثم جلسنا في مقهى قرب الحديقة لتناول الغداء. في المساء عدنا بالحافلة نفسها. أعجبتني الرحلة لأن المدينة هادئة والهواء لطيف. في المرة القادمة أريد أن أبقى يومين لأزور المتحف أيضًا. صديقتك، نور.', null, null, 'bundled', '1.4.0-advanced-c1c2'),
('P_R_A2_CEFR_02', 'A2', 'reading', 'ورشة إصلاح الدراجات', 'ينظم مركز الحي ورشة مجانية لإصلاح الدراجات يوم السبت القادم من الساعة الرابعة إلى السادسة مساءً. الورشة مناسبة للطلاب والبالغين الذين يستخدمون الدراجة للذهاب إلى المدرسة أو العمل. سيتعلم المشاركون كيف يفحصون الإطارات، ويضبطون الفرامل، ويصلحون السلسلة البسيطة. لا يحتاج المشارك إلى إحضار أدوات؛ فالمركز يوفر الأدوات والدراجات للتدريب. عدد الأماكن محدود، لذلك يجب التسجيل عبر الهاتف قبل يوم الخميس. بعد انتهاء الورشة، يحصل كل مشارك على ورقة فيها نصائح للحفاظ على الدراجة.', null, null, 'bundled', '1.4.0-advanced-c1c2'),
('P_L_B1_CEFR_01', 'B1', 'listening', 'تغيير موعد جلسة المؤتمر', 'المنسقة: صباح الخير يا ياسر. أتصل بك بشأن مؤتمر التعليم يوم الخميس. تغير وقت جلستك من العاشرة إلى الحادية عشرة لأن المتحدث الأول تأخر سفره. ياسر: شكرًا لإخباري. هل ما زال علي أن أرسل العرض قبل يوم الثلاثاء؟ المنسقة: نعم، أرسله بصيغة PDF، ولا تنس أن تحضر قبل الموعد بنصف ساعة لتجربة الأجهزة. ياسر: مناسب. سأصل في العاشرة والنصف، وسأرسل العرض هذا المساء.', null, 'in-review/P_L_B1_CEFR_01.mp3', 'bundled', '1.4.0-advanced-c1c2'),
('P_L_B1_CEFR_02', 'B1', 'listening', 'خطة الحديقة الجديدة', 'المرأة: مرحبًا يا خالد. هل اطلعت على خطة الحديقة الجديدة؟ خالد: نعم، أعجبني أنهم سيزرعون أشجارًا محلية ويضيفون مقاعد قرب منطقة اللعب. المرأة: صحيح، لكن البلدية تحتاج إلى آراء السكان قبل نهاية الأسبوع. يمكننا تعبئة الاستبيان على الموقع أو في مركز الحي. خالد: سأملؤه على الموقع الليلة، وسأقترح إضافة ممر للدراجات.', null, 'in-review/P_L_B1_CEFR_02.mp3', 'bundled', '1.4.0-advanced-c1c2'),
('P_R_B1_CEFR_01', 'B1', 'reading', 'تجربة العمل عن بُعد', 'بعد أن لاحظت الإدارة أن كثيرًا من الموظفين يقضون وقتًا طويلًا في الطريق صباحًا، بدأت الشركة تجربة العمل عن بُعد يوم الأربعاء لمدة شهر. لا تعني التجربة أن الموظفين سيعملون في أوقات مختلفة؛ فالجميع يبدأون في التاسعة، ويجتمعون عبر الإنترنت لمدة نصف ساعة في بداية اليوم لتحديد المهام. يختار كل موظف مكانًا هادئًا للعمل، ويرسل في نهاية اليوم ملخصًا قصيرًا عما أنجزه. بعد نهاية الشهر، ستجمع الإدارة آراء الموظفين قبل أن تقرر استمرار التجربة أو تعديلها.', null, null, 'bundled', '1.4.0-advanced-c1c2'),
('P_R_B1_CEFR_02', 'B1', 'reading', 'يوم بلا هاتف في المحمية', 'نظّم نادي البيئة في الجامعة رحلة قصيرة إلى محمية طبيعية قرب المدينة. طلب المنظمون من المشاركين أن يتركوا هواتفهم داخل الحافلة طوال جولة المشي، بينما حمل المرشد هاتفًا واحدًا للحالات الطارئة. في البداية شعر بعض الطلاب بالقلق لأنهم لن يستطيعوا التقاط الصور أو الاتصال بأسرهم، لكنهم بعد ساعة بدأوا يلاحظون أصوات الطيور وتفاصيل النباتات أكثر من قبل. وفي نهاية اليوم جمع الفريق بعض النفايات من الطريق، ثم كتب كل مشارك ملاحظة قصيرة عن أكثر شيء لفت انتباهه. اقترح عدد من الطلاب تكرار الرحلة مرة كل شهر.', null, null, 'bundled', '1.4.0-advanced-c1c2'),
('P_R_B1_CEFR_03', 'B1', 'reading', 'مراجعة كتاب عن القهوة', 'قرأت خلال الأسبوع الماضي كتابًا صغيرًا عن تاريخ القهوة في الجزيرة العربية. توقعت في البداية أن أجد وصفات كثيرة، لكن الكاتب ركز على رحلة القهوة من المزارع إلى الأسواق، وعلى دور المقاهي في لقاء الناس وتبادل الأخبار. أعجبني أن اللغة كانت واضحة وأن كل فصل بدأ بقصة قصيرة من حياة شخص يعمل في هذا المجال. مع ذلك، تمنيت لو احتوى الكتاب على خرائط أكثر؛ لأن بعض الأماكن التي ذكرها الكاتب لم تكن مألوفة لي. أوصي بالكتاب لمن يهتم بتاريخ الحياة اليومية، لا لمن يبحث عن دليل سريع لتحضير القهوة في المنزل.', null, null, 'bundled', '1.4.0-advanced-c1c2'),
('P_L_B2_CEFR_01', 'B2', 'listening', 'تحسين خدمة الحافلات', 'المسؤولة: أهلًا دكتور فهد. اطلعتُ على تقريرك عن استخدام الحافلات في الأحياء الجديدة. ما التغيير الأهم الذي تقترحه؟ الباحث: أقترح زيادة الرحلات في ساعات الذروة، بدل إضافة خطوط جديدة لا يستخدمها الناس بانتظام. تظهر البيانات أن الانتظار الطويل هو السبب الرئيس لانخفاض رضا الركاب. المسؤولة: لكن زيادة الرحلات ستحتاج إلى سائقين إضافيين. هل يمكن تنفيذها ضمن الميزانية الحالية؟ الباحث: نعم، إذا أعدنا توزيع بعض الحافلات في الفترة المسائية. وسنراجع النتائج بعد ثلاثة أشهر قبل اتخاذ قرار دائم.', null, 'in-review/P_L_B2_CEFR_01.mp3', 'bundled', '1.4.0-advanced-c1c2'),
('P_L_B2_CEFR_02', 'B2', 'listening', 'مراجعة مقال بحثي', 'المحررة: قرأت المسودة الأخيرة للمقال. الحجة واضحة، لكن قسم المنهجية يحتاج إلى شرح أدق لكيفية اختيار العينة. الباحث: أتفق معك. سأضيف جدولًا يبين عدد المشاركين ومعايير الاختيار، وسأفصل بين النتائج والتفسير. المحررة: جيد. من الأفضل أيضًا أن تشير إلى حدود الدراسة، حتى لا يظن القارئ أن النتائج تنطبق على جميع المدن. الباحث: سأعدل ذلك اليوم وأرسل النسخة الجديدة قبل نهاية الدوام.', null, 'in-review/P_L_B2_CEFR_02.mp3', 'bundled', '1.4.0-advanced-c1c2'),
('P_R_B2_CEFR_01', 'B2', 'reading', 'المكتبات العامة بعد الغروب', 'بدأت بعض المدن تمديد ساعات عمل المكتبات العامة في المساء لتكون متاحة للطلاب والموظفين الذين لا يستطيعون زيارتها نهارًا. ولم يقتصر التغيير على إبقاء الأبواب مفتوحة؛ إذ خصصت المكتبات جلسات هادئة للدراسة وورشًا قصيرة للبحث الرقمي. تشير إدارة إحدى المكتبات إلى أن عدد الزوار بعد السابعة ازداد، لكن النجاح لم يكن متساويًا في كل الفروع. فالمكتبات الواقعة قرب وسائل النقل استفادت أكثر من غيرها، بينما احتاجت الفروع البعيدة إلى حملات تعريفية. ويرى بعض النقاد أن تمديد الساعات قد يرفع التكلفة، إلا أن المديرة تؤكد أن الشراكة مع الجامعات المحلية خففت العبء المالي.', null, null, 'bundled', '1.4.0-advanced-c1c2'),
('P_R_B2_CEFR_02', 'B2', 'reading', 'هل تكفي الحاويات الذكية؟', 'أطلقت البلدية مشروعًا تجريبيًا للحاويات الذكية في عدد من الأحياء. تحتوي الحاويات على حساسات ترسل إشارة عندما تقترب من الامتلاء، والهدف من ذلك أن تسير سيارات الجمع عند الحاجة بدل الالتزام بمسار ثابت كل يوم. في الشهر الأول ظهرت مشكلة غير متوقعة: فقد وضع بعض السكان أنواعًا مختلفة من النفايات في الحاوية نفسها، مما صعّب عملية الفرز. لذلك أضافت البلدية لوحات إرشادية ومقاطع فيديو قصيرة تشرح طريقة الاستخدام. وبعد ثلاثة أشهر انخفض عدد الرحلات غير الضرورية، غير أن الفائدة لم تكن متساوية في جميع الأحياء؛ لأن بعض المناطق تعاني اتصالًا غير مستقر بالشبكة التي تعتمد عليها الحساسات.', null, null, 'bundled', '1.4.0-advanced-c1c2'),
('P_R_B2_CEFR_03', 'B2', 'reading', 'التدريب الهجين ليس تسجيلات فقط', 'عندما بدأت الشركة برنامج تدريب هجينًا، ظن بعض المديرين أن تسجيل المحاضرات سيكون كافيًا للوصول إلى جميع الموظفين. لكن التقييم الأول أظهر أن المشاهدة وحدها لا تعني التعلم؛ فقد اشتكى المشاركون من قلة التفاعل وصعوبة طرح الأسئلة في الوقت المناسب. بعد ذلك أعيد تصميم البرنامج ليشمل لقاءات قصيرة مباشرة، ومهامًا تطبيقية، وتعليقات فردية من المدربين. كما وفرت الشركة الملفات القابلة للتحميل قبل كل لقاء لمن يعانون اتصالًا ضعيفًا بالإنترنت، ومددت مواعيد تسليم بعض المهام. تحسن رضا المشاركين بعد هذه التعديلات، إلا أن الدرس الأهم كان أن التقنية وسيلة لتنظيم التعلم، لا بديلًا عن التصميم الجيد والتواصل المستمر.', null, null, 'bundled', '1.4.0-advanced-c1c2'),
('P_L_C1_CEFR_01', 'C1', 'listening', 'سياسة نشر البيانات', 'رئيسة اللجنة: قبل أن نعتمد سياسة نشر البيانات، أريد التأكد من أنها لا تكتفي بحذف الأسماء. كيف سنمنع التعرف إلى الأفراد من خلال الجمع بين متغيرات أخرى؟ المحلل: سنراجع كل مجموعة بيانات على حدة، ونقيّم خطر إعادة التعرف قبل النشر. وإذا كان الخطر مرتفعًا، سننشر نتائج مجمعة بدل الملفات التفصيلية. رئيسة اللجنة: وماذا عن الباحثين الذين يحتاجون البيانات الأصلية للتحقق من النتائج؟ المحلل: سيحصلون عليها عبر بيئة وصول آمنة، بعد توقيع اتفاق استخدام يحدد الغرض ومدة الاحتفاظ بالبيانات.', null, 'in-review/P_L_C1_CEFR_01.mp3', 'bundled', '1.4.0-advanced-c1c2'),
('P_L_C1_CEFR_02', 'C1', 'listening', 'توسعة متحف تاريخي', 'مسؤولة المتحف: أتفق مع هدف توسيع المتحف، لكن التصميم يقترح إزالة المبنى القديم بالكامل. المخطط: الفريق المعماري يقول إن الترميم أغلى، لكن التقرير لا يحسب القيمة الرمزية للمبنى ولا أثره في ذاكرة الحي. مسؤولة المتحف: إذن نحتاج إلى مقارنة تشمل التكلفة على المدى الطويل، لا تكلفة الإنشاء فقط. المخطط: سأطلب من الفريق تقديم بديل يحافظ على الواجهة التاريخية ويضيف المساحات الجديدة في الخلف.', null, 'in-review/P_L_C1_CEFR_02.mp3', 'bundled', '1.4.0-advanced-c1c2'),
('P_L_C1_CEFR_03', 'C1', 'listening', 'التواصل أثناء العطل التقني', 'مديرة التواصل: الرسالة الأولى التي نشرناها عن العطل كانت دقيقة، لكنها لم تجب عن السؤال الذي يهم المستخدمين: متى سيعود النظام؟ المحرر: لأن فريق التقنية لا يريد إعطاء موعد قد يثبت خطؤه. أقترح أن نوضح ما نعرفه وما لا نعرفه، وأن نحدد موعد التحديث التالي بدل وعد بالحل. مديرة التواصل: جيد، لكن يجب أن نذكر أيضًا البدائل المؤقتة للخدمة، وإلا سيفهم الناس الصمت على أنه غياب للخطة. المحرر: سأعيد صياغة الرسالة وأطلب من فريق الدعم جمع الأسئلة المتكررة قبل النشر.', null, 'in-review/P_L_C1_CEFR_03.mp3', 'bundled', '1.4.0-advanced-c1c2'),
('P_R_C1_CEFR_01', 'C1', 'reading', 'المدينة التي تسمع نفسها', 'حين أعلنت البلدية عن مشروع لتقليل الضوضاء في وسط المدينة، افترض كثيرون أن الحل سيقتصر على منع المركبات أو فرض غرامات على المتاجر. لكن فريق المشروع بدأ بسؤال مختلف: أي الأصوات يريد الناس الحفاظ عليها؟ فصوت الباعة في السوق القديم، مثلًا، جزء من هوية المكان، بينما يمثل هدير المحركات المستمر عبئًا لا يضيف قيمة اجتماعية. لذلك اقترح الفريق توزيع أوقات التوصيل، وتحسين عزل بعض المباني، وإنشاء مساحات للمشاة، بدل معالجة المدينة بوصفها منطقة صامتة. وقد انتقد بعض التجار الخطة خشية أن تقلل حركة الزبائن، إلا أن التجربة الأولية أظهرت أن بقاء الناس وقتًا أطول في الشوارع الهادئة نسبيًا عوّض جزءًا من هذا القلق. الدرس لا يتعلق بخفض مستوى الصوت فحسب، بل بالتفاوض بين وظائف المدينة وذاكرتها اليومية.', null, null, 'bundled', '1.4.0-advanced-c1c2'),
('P_R_C1_CEFR_02', 'C1', 'reading', 'البيانات المفتوحة بين الشفافية والسياق', 'تتزايد الدعوات إلى نشر البيانات التي تعتمد عليها المؤسسات العامة، ويُقدَّم هذا النشر غالبًا بوصفه دليلًا كافيًا على الشفافية. غير أن البيانات الخام لا تضمن الفهم من تلقاء نفسها. فقد نشرت إحدى الجامعات نتائج دراسة واسعة، ثم اكتشفت أن بعض القراء عمموا النتائج على مناطق لم تشملها العينة أصلًا. لذلك أضاف الفريق لاحقًا ملاحظات تشرح طريقة جمع البيانات وحدودها، إلى جانب رسوم توضيحية تساعد غير المختصين على قراءتها. ويرى بعض الباحثين أن إعداد هذا الشرح قد يؤخر نشر النتائج، لكن الفريق يرد بأن السرعة لا تكون فضيلة إذا أنتجت استخدامًا مضللًا للمعلومات. فالشفافية، في نظرهم، لا تعني إتاحة الأرقام وحدها، بل إتاحة السياق الذي يجعل إعادة استخدامها مسؤولة.', null, null, 'bundled', '1.4.0-advanced-c1c2'),
('P_R_C1_CEFR_03', 'C1', 'reading', 'ما الذي تقيسه المؤشرات؟', 'تحب المؤسسات المؤشرات لأنها تحول النشاط المعقد إلى أرقام يمكن مقارنتها. غير أن المشكلة تبدأ حين يصبح المؤشر هدفًا في ذاته بدل أن يكون أداة لفهم الأداء. فقد تسعى مستشفى إلى خفض مدة الانتظار، ثم تدفع الموظفين، من غير قصد، إلى اختصار التقييم الأولي للحالات. وقد تحتفي جامعة بارتفاع نسبة التخرج من دون أن تسأل إن كان الخريجون قادرين على الانتقال إلى سوق العمل بثقة. لا يعني ذلك أن الأرقام عديمة القيمة، بل إن قيمتها تتوقف على وضعها إلى جانب أدلة نوعية، مثل ملاحظات المستفيدين ومراجعة الخبراء. كما ينبغي مراجعة المؤشرات دوريًا؛ لأن الناس يتعلمون سريعًا كيف يغيرون سلوكهم استجابة لما يُقاس، لا لما يراد تحقيقه أصلًا.', null, null, 'bundled', '1.4.0-advanced-c1c2'),
('P_L_C2_CEFR_01', 'C2', 'listening', 'مراجعة ادعاء سببي', 'مراجعة: قبل أن نرفع التقرير إلى اللجنة، أريد مراجعة جملة واحدة في الخلاصة. استعملت عبارة أدى البرنامج إلى تحسن النتائج، مع أن تصميم الدراسة لا يتيح هذا الجزم. باحث: قسنا درجات القراءة قبل البرنامج وبعده، وكانت الفروق دالة إحصائيًا. أليس هذا أساسًا كافيًا للقول إن البرنامج أحدث الفرق؟ مراجعة: الدلالة الإحصائية ترجّح أن الفرق ليس مصادفة، لكنها لا تعزل أثر البرنامج عن العوامل الأخرى المصاحبة، ولا تعوض غياب مجموعة مقارنة مستقلة. باحث: فهمت موضع التحفظ. سأعدل الخلاصة، فأُبقي على أن البرنامج ارتبط بتحسن ملحوظ، وأوضح أن عزو هذا التحسن إليه وحده ما زال استدلالًا غير مكتمل.', null, 'in-review/P_L_C2_CEFR_01.mp3', 'bundled', '1.4.0-advanced-c1c2'),
('P_L_C2_CEFR_02', 'C2', 'listening', 'الاستخدام الثانوي للمقابلات', 'رئيسة اللجنة: وصلني طلبك لإعادة تحليل مقابلات توثيق الحي، وتوقفت عند نطاق الموافقة. المشاركون وافقوا على استخدامها في مشروع التوثيق، لا في دراسة جديدة تسأل عن ثقتهم بالمؤسسات. باحث: أخفيت الأسماء والتفاصيل التي قد تكشف الهوية، وظننت أن ذلك يكفي لإعادة التحليل. رئيسة اللجنة: إخفاء الهوية يخفض خطر التعرف، لكنه لا ينشئ موافقة لم تُمنح. قد يرفض المشارك الإطار التفسيري الجديد حتى لو بقي اسمه مجهولًا. باحث: إذن سأوقف هذا التحليل الثانوي. لن أواصله إلا بعد إذن مستقل، أو سأقتصر على المقابلات التي أستطيع التواصل مجددًا مع أصحابها.', null, 'in-review/P_L_C2_CEFR_02.mp3', 'bundled', '1.4.0-advanced-c1c2'),
('P_L_C2_CEFR_03', 'C2', 'listening', 'الحذر والتوصية', 'محررة: أمامنا يوم واحد قبل إرسال الموجز إلى الإدارة، والخاتمة ما زالت تقلقني. الحذر فيها بلغ حدًا يمحو التوصية، وقد يخرج القارئ من النص من دون أن يعرف ما الذي تقترحه المؤسسة. محلل: الحذر مقصود. الأدلة لا تسمح بالجزم، ولا أريد أن تُقرأ التوصية كأنها نتيجة محسومة. محررة: نستطيع أن نفصل بين صيغة الموقف ودرجة اليقين. قل إننا نوصي بتجريب الدوام المرن على نطاق محدود، مع الإقرار بأن أثره بعيد المدى غير محسوم. محلل: هذا أدق. يبقى التحفظ قائمًا، ولا يتحول التقرير إلى وصف بلا موقف. سأعيد كتابة الخاتمة على هذا الأساس.', null, 'in-review/P_L_C2_CEFR_03.mp3', 'bundled', '1.4.0-advanced-c1c2'),
('P_L_C2_CEFR_04', 'C2', 'listening', 'الحضور وعمق المشاركة', 'مديرة البرنامج: قرأت مسودة التقييم قبل اجتماع الداعمين، وعند الرقم الأول توقفت. في برنامج حكاية الحي ارتفع الحضور بنسبة ثلاثين في المئة، فكيف تخلص إلى أن أثر البرنامج لم يتحسن بالضرورة؟ مقيّم: لأن مؤشر الحضور يقيس الوصول لا عمق المشاركة. نصوص التأمل في هذه الدورة أقصر وأقل تحديدًا مما كانت عليه في الدورة السابقة. مديرة البرنامج: ربما كان الجمهور الإضافي جديدًا على هذا النوع من الأنشطة، ولم يألف كتابة التأمل. مقيّم: هذا تفسير ممكن، ولهذا لن أعزو التغير إلى تصميم البرنامج. ما أستطيع إثباته الآن هو أن الاكتفاء بعدد الحضور يخفي هذا التباين.', null, 'in-review/P_L_C2_CEFR_04.mp3', 'bundled', '1.4.0-advanced-c1c2'),
('P_L_C2_CEFR_05', 'C2', 'listening', 'دقة المقابل الترجمي', 'محررة: راجعت مسرد الفصل الثالث، وتوقفت عند مقابل قد يغيّر قراءة الحجة كلها. اخترت الوكالة، لكن القارئ قد يفهم منها نيابة قانونية عن الغير، بينما النص يتحدث عن قدرة الشخص على الفعل واتخاذ الموقف. مترجم: اخترتها لأنها شائعة في بعض الترجمات، وخشيت أن يجعل المقابل الأطول المتن ثقيلًا. محررة: الشيوع لا يصحح الالتباس. إذا بقي اللفظ وحده، انتقل إلى القارئ معنى لم يقصده المؤلف، وربما بُني عليه استدلال خاطئ في بقية الفصل. مترجم: سأضع في المتن القدرة على الفعل، وأذكر الوكالة في الحاشية بوصفها مقابلًا شائعًا غير دقيق في هذا السياق، مع سبب استبعاده.', null, 'in-review/P_L_C2_CEFR_05.mp3', 'bundled', '1.4.0-advanced-c1c2'),
('P_R_C2_CEFR_01', 'C2', 'reading', 'وهم حياد الخوارزمية', 'حين يُقال إن الخوارزمية محايدة لأنها تطبق القواعد نفسها على الجميع، يغفل هذا القول أن القواعد لا تظهر من فراغ. فهي تُبنى على بيانات جُمعت في سياقات اجتماعية سابقة، وقد تحمل تلك البيانات آثار قرارات غير عادلة اتخذها البشر من قبل. لا يعني ذلك أن النماذج الحسابية عديمة الفائدة أو أن الحل هو إلغاؤها، بل يعني أن الاتساق في تطبيق قاعدة ما ليس مرادفًا للإنصاف في نتائجها. فالنظام قد يعامل الحالات المتشابهة بالطريقة نفسها، ثم يظل يضر مجموعة بعينها لأن تعريفه للتشابه ضيق أو لأن ما يقيسه لا يمثل الواقع كله. لذلك لا تكفي مراجعة الشفرة البرمجية وحدها؛ إذ ينبغي فحص الافتراضات، ومصادر البيانات، والنتائج الفعلية التي تترتب على استخدامها. إن نقل القرار إلى آلة لا ينقل معها المسؤولية عن آثاره.', null, null, 'bundled', '1.4.0-advanced-c1c2'),
('P_R_C2_CEFR_02', 'C2', 'reading', 'حين تصبح السرعة معيارًا للمعرفة', 'تغري البيئة الرقمية المؤسسات بأن تجعل سرعة الاستجابة دليلًا على الكفاءة، غير أن السرعة قد تتحول إلى معيار مضلل حين تُعامل الإجابة السريعة بوصفها أفضل من الإجابة الموثوقة. وليس المقصود الدفاع عن التأخير لذاته؛ فالصمت الطويل قد يترك فراغًا تملؤه الشائعات. لكن الفرق كبير بين تأجيل ضروري للتحقق، وتأجيل يخفي غياب الاستعداد أو المسؤولية. المؤسسة التي تتعامل بجدية مع عدم اليقين لا تعد الجمهور بما لا تعرفه، ولا تكتفي في الوقت نفسه بعبارة مبهمة مثل: «نعمل على الأمر». إنها توضح ما ثبت، وما يزال قيد الفحص، ومتى سيصدر التحديث التالي. بهذا المعنى، لا تُقاس قيمة الإجابة بسرعة صدورها وحدها، بل بقدرتها على أن تجعل حدود المعرفة واضحة من دون أن تترك الناس بلا اتجاه.', null, null, 'bundled', '1.4.0-advanced-c1c2')
on conflict (id) do nothing;
insert into public.question_bank_items(item_code, content_version, level, skill, passage_id, question_text, options, status, source_kind, item_type) values
('GV01', '1.4.0-advanced-c1c2', 'A1', 'grammar_vocab', null, 'أنا طالِبَةٌ ___ جامِعَةِ دِمَشْقَ.', '[{"id":"a","text":"عَلى"},{"id":"b","text":"في"},{"id":"c","text":"مِنْ"},{"id":"d","text":"إِلى"}]'::jsonb, 'approved', 'bundled', 'mcq'),
('GV02', '1.4.0-advanced-c1c2', 'A1', 'grammar_vocab', null, 'ذَهَبَ عُمَرُ ___ المَدْرَسَةِ صَباحًا.', '[{"id":"a","text":"إِلى"},{"id":"b","text":"مَعَ"},{"id":"c","text":"عَلى"},{"id":"d","text":"مِنْ"}]'::jsonb, 'approved', 'bundled', 'mcq'),
('GV03', '1.4.0-advanced-c1c2', 'A1', 'grammar_vocab', null, '___ هذا؟ — هذا كِتابي.', '[{"id":"a","text":"مَنْ"},{"id":"b","text":"أَيْنَ"},{"id":"c","text":"ما"},{"id":"d","text":"مَتى"}]'::jsonb, 'approved', 'bundled', 'mcq'),
('GV04', '1.4.0-advanced-c1c2', 'A1', 'grammar_vocab', null, 'الشَّمْسُ ___ اليَوْمَ.', '[{"id":"a","text":"ساطِعٌ"},{"id":"b","text":"ساطِعَةٌ"},{"id":"c","text":"يُشْرِقُ"},{"id":"d","text":"ساطِعاتٌ"}]'::jsonb, 'approved', 'bundled', 'mcq'),
('R01', '1.4.0-advanced-c1c2', 'A1', 'reading', 'P_R_A1', 'مِنْ أَيِّ بَلَدٍ سارَةُ؟', '[{"id":"a","text":"المَغْرِبُ"},{"id":"b","text":"سورِيَةُ"},{"id":"c","text":"مِصْرُ"},{"id":"d","text":"لُبْنانُ"}]'::jsonb, 'approved', 'bundled', 'mcq'),
('R02', '1.4.0-advanced-c1c2', 'A1', 'reading', 'P_R_A1', 'ماذا تُحِبُّ سارَةُ؟', '[{"id":"a","text":"كُرَةَ القَدَمِ"},{"id":"b","text":"القِراءَةَ وَالسِّباحَةَ"},{"id":"c","text":"الطَّبْخَ وَالسَّفَرَ"},{"id":"d","text":"مُشاهَدَةَ التِّلْفازِ"}]'::jsonb, 'approved', 'bundled', 'mcq'),
('L01', '1.4.0-advanced-c1c2', 'A1', 'listening', 'P_L_A1', 'أَيْنَ يَجْري هٰذا الحِوارُ؟', '[{"id":"a","text":"في مَطْعَمٍ"},{"id":"b","text":"عِنْدَ مُراقَبَةِ الجَوازاتِ"},{"id":"c","text":"في مُسْتَشْفًى"},{"id":"d","text":"في مَدْرَسَةٍ"}]'::jsonb, 'approved', 'bundled', 'mcq'),
('L02', '1.4.0-advanced-c1c2', 'A1', 'listening', 'P_L_A1', 'ما سَبَبُ زِيارَةِ المُسافِرِ؟', '[{"id":"a","text":"العَمَلُ"},{"id":"b","text":"الدِّراسَةُ"},{"id":"c","text":"السِّياحَةُ"},{"id":"d","text":"زِيارَةُ الأَقارِبِ"}]'::jsonb, 'approved', 'bundled', 'mcq'),
('GV05', '1.4.0-advanced-c1c2', 'A2', 'grammar_vocab', null, 'أمسِ ___ سارةُ إلى المكتبة بعد الدرس.', '[{"id":"a","text":"ذَهَبَتْ"},{"id":"b","text":"ذَهَبَ"},{"id":"c","text":"يَذْهَبُ"},{"id":"d","text":"سَتَذْهَبُ"}]'::jsonb, 'approved', 'bundled', 'mcq'),
('GV06', '1.4.0-advanced-c1c2', 'A2', 'grammar_vocab', null, 'ذَهَبْنا إِلى السّوقِ ___ الفَواكِهَ.', '[{"id":"a","text":"لِنَشْتَرِيَ"},{"id":"b","text":"اشْتَرَيْنا"},{"id":"c","text":"اشْتَرِ"},{"id":"d","text":"سَنَشْتَري"}]'::jsonb, 'approved', 'bundled', 'mcq'),
('GV07', '1.4.0-advanced-c1c2', 'A2', 'grammar_vocab', null, 'أسكن في سكن الطلاب ___ الجامعة.', '[{"id":"a","text":"قُرْبَ"},{"id":"b","text":"إلى"},{"id":"c","text":"على"},{"id":"d","text":"عن"}]'::jsonb, 'approved', 'bundled', 'mcq'),
('GV08', '1.4.0-advanced-c1c2', 'A2', 'grammar_vocab', null, 'لَمْ تَفْهَمْ سُؤالًا في الصَّفِّ. ما العِبارَةُ الأَنْسَبُ لِطَلَبِ إِعادَتِهِ؟', '[{"id":"a","text":"مِنْ فَضْلِكَ، هَلْ تُعيدُ السُّؤالَ بِبُطْءٍ؟"},{"id":"b","text":"مِنْ فَضْلِكَ، هَلْ أَسْتَطيعُ الخُروجَ مِنَ الصَّفِّ الآنَ؟"},{"id":"c","text":"مِنْ فَضْلِكَ، أَيْنَ أَضَعُ حَقيبَتي؟"},{"id":"d","text":"مِنْ فَضْلِكَ، مَتى تَبْدَأُ الحِصَّةُ التّالِيَةُ؟"}]'::jsonb, 'approved', 'bundled', 'mcq'),
('R03', '1.4.0-advanced-c1c2', 'A2', 'reading', 'P_R_A2', 'متى يجتمع أعضاء نادي العربية؟', '[{"id":"a","text":"يوم الاثنين بعد الدرس"},{"id":"b","text":"كل صباح قبل الدرس"},{"id":"c","text":"يوم الجمعة في المساء"},{"id":"d","text":"في نهاية الأسبوع فقط"}]'::jsonb, 'approved', 'bundled', 'mcq'),
('R04', '1.4.0-advanced-c1c2', 'A2', 'reading', 'P_R_A2', 'ماذا يفعل الطلاب بعد قراءة الحوار؟', '[{"id":"a","text":"يتدربون على طلب الأشياء في المتجر"},{"id":"b","text":"يدفعون رسوم الاشتراك"},{"id":"c","text":"يرتبون كتب المكتبة"},{"id":"d","text":"يكتبون رسالة إلى أسرهم"}]'::jsonb, 'approved', 'bundled', 'mcq'),
('L03', '1.4.0-advanced-c1c2', 'A2', 'listening', 'P_L_A2', 'ماذا طَلَبَ الزَّبُونُ؟', '[{"id":"a","text":"قَهْوَةً بِالحَلِيبِ وَكَعْكًا"},{"id":"b","text":"عَصِيرَ بُرْتُقالٍ وَساندْوِتْشًا"},{"id":"c","text":"شايًا بِدُونِ سُكَّرٍ وَسَلَطَةً"},{"id":"d","text":"ماءً فَقَطْ"}]'::jsonb, 'approved', 'bundled', 'mcq'),
('L04', '1.4.0-advanced-c1c2', 'A2', 'listening', 'P_L_A2', 'مَتى سَيَدْفَعُ الزَّبُونُ الحِسابَ؟', '[{"id":"a","text":"قَبْلَ الطَّلَبِ مُباشَرَةً"},{"id":"b","text":"لاحِقًا"},{"id":"c","text":"في اليَوْمِ التّالِي"},{"id":"d","text":"لَنْ يَدْفَعَ"}]'::jsonb, 'approved', 'bundled', 'mcq'),
('GV09', '1.4.0-advanced-c1c2', 'B1', 'grammar_vocab', null, 'لَوْ دَرَسْتَ جَيِّدًا ___ في الامْتِحانِ.', '[{"id":"a","text":"لَنَجَحْتَ"},{"id":"b","text":"لَنْ تَنْجَحَ"},{"id":"c","text":"نَجَحْتَ"},{"id":"d","text":"تَنْجَحُ"}]'::jsonb, 'archived', 'bundled', 'mcq'),
('GV10', '1.4.0-advanced-c1c2', 'B1', 'grammar_vocab', null, 'أَكْمِلْ بِما يُناسِبُ: إِنَّ الأُسْتاذَ ___ .', '[{"id":"a","text":"مُخْلِصًا"},{"id":"b","text":"مُخْلِصٌ"},{"id":"c","text":"مُخْلِصونَ"},{"id":"d","text":"مُخْلِصاتٍ"}]'::jsonb, 'archived', 'bundled', 'mcq'),
('GV11', '1.4.0-advanced-c1c2', 'B1', 'grammar_vocab', null, 'الطُّلّابُ لَمْ ___ إِلى المَتْحَفِ أَمْسِ.', '[{"id":"a","text":"ذَهَبوا"},{"id":"b","text":"يَذْهَبُونَ"},{"id":"c","text":"يَذْهَبوا"},{"id":"d","text":"ذاهِبُونَ"}]'::jsonb, 'approved', 'bundled', 'mcq'),
('GV12', '1.4.0-advanced-c1c2', 'B1', 'grammar_vocab', null, 'في العِبارَةِ: «يَحْتاجُ تَعَلُّمُ اللُّغَةِ إِلى اجْتِهادٍ وَمُتابَعَةٍ»، أَقْرَبُ مَعْنًى لِكَلِمَةِ «اجْتِهاد» هو:', '[{"id":"a","text":"الكَسَلُ"},{"id":"b","text":"الحَظُّ"},{"id":"c","text":"السُّرْعَةُ"},{"id":"d","text":"بَذْلُ الجُهْدِ"}]'::jsonb, 'approved', 'bundled', 'mcq'),
('R05', '1.4.0-advanced-c1c2', 'B1', 'reading', 'P_R_B1', 'ما المَوْضُوعُ الرَّئِيسُ لِلنَّصِّ؟', '[{"id":"a","text":"مَخاطِرِ البَطالَةِ"},{"id":"b","text":"أَهَمِّيَةِ العَمَلِ التَّطَوُّعِيِّ"},{"id":"c","text":"تاريخِ الجَمْعِيّاتِ"},{"id":"d","text":"فَوائِدِ الرِّياضَةِ"}]'::jsonb, 'approved', 'bundled', 'mcq'),
('R06', '1.4.0-advanced-c1c2', 'B1', 'reading', 'P_R_B1', 'ماذا يَمْنَحُ التَّطَوُّعُ المُتَطَوِّعَ بِحَسَبِ النَّصِّ؟', '[{"id":"a","text":"راتِبًا شَهْرِيًّا"},{"id":"b","text":"شَهادَةً جامِعِيَّةً"},{"id":"c","text":"خِبَراتٍ جَدِيدَةً"},{"id":"d","text":"إِجازَةً سَنَوِيَّةً"}]'::jsonb, 'approved', 'bundled', 'mcq'),
('R07', '1.4.0-advanced-c1c2', 'B1', 'reading', 'P_R_B1', 'ماذا أَظْهَرَتِ الدِّراساتُ الحَدِيثَةُ؟', '[{"id":"a","text":"المُتَطَوِّعُونَ يَشْعُرُونَ بِسَعادَةٍ أَكْبَرَ"},{"id":"b","text":"التَّطَوُّعُ مُضِيعَةٌ لِلوَّقْتِ"},{"id":"c","text":"لا فائِدَةَ مِنَ التَّطَوُّعِ"},{"id":"d","text":"المُتَطَوِّعُونَ أَقَلُّ دَخْلًا"}]'::jsonb, 'approved', 'bundled', 'mcq'),
('L05', '1.4.0-advanced-c1c2', 'B1', 'listening', 'P_L_B1', 'ما الغَرَضُ الرَّئيسُ مِنَ المُكالَمَةِ؟', '[{"id":"a","text":"تَأْكِيدِ مَوْعِدِ مُقابَلَةِ عَمَلٍ"},{"id":"b","text":"الاِعْتِذارِ عَنْ مَوْعِدٍ سابِقٍ"},{"id":"c","text":"دَعْوَةٍ إِلى حَفْلِ تَكْرِيمٍ"},{"id":"d","text":"الاِسْتِفْسارِ عَنْ راتِبٍ"}]'::jsonb, 'approved', 'bundled', 'mcq'),
('L06', '1.4.0-advanced-c1c2', 'B1', 'listening', 'P_L_B1', 'ما الَّذي طُلِبَ مِنْ أَحْمَدَ إِحْضارُهُ إِلى المُقابَلَةِ؟', '[{"id":"a","text":"صُوَرًا شَخْصِيَّةً فَقَطْ"},{"id":"b","text":"شَهادَةَ الخِبْرَةِ"},{"id":"c","text":"مَبْلَغًا مِنَ المالِ"},{"id":"d","text":"سِيرَتَهُ الذّاتِيَّةَ وَجَوازَ سَفَرِهِ"}]'::jsonb, 'approved', 'bundled', 'mcq'),
('GV13', '1.4.0-advanced-c1c2', 'B2', 'grammar_vocab', null, 'وَصَلَ إِلى المَدِينَةِ ___ رَجُلًا.', '[{"id":"a","text":"خَمْسَ عَشْرَةَ"},{"id":"b","text":"خَمْسَةَ عَشَرَ"},{"id":"c","text":"خَمْسَةَ عَشْرَةَ"},{"id":"d","text":"خَمْسَ عَشَرَ"}]'::jsonb, 'approved', 'bundled', 'mcq'),
('GV14', '1.4.0-advanced-c1c2', 'B2', 'grammar_vocab', null, 'لَيْسَ الأَمْرُ مُسْتَحيلًا، ___ يَحتاجُ إِلى بَعْضِ الصَّبْرِ.', '[{"id":"a","text":"لَكِنَّ"},{"id":"b","text":"حَتّى"},{"id":"c","text":"بَلْ"},{"id":"d","text":"إِذْ"}]'::jsonb, 'approved', 'bundled', 'mcq'),
('GV15', '1.4.0-advanced-c1c2', 'B2', 'grammar_vocab', null, 'اخْتَرِ الجُمْلَةَ الصَّحِيحَةَ نَحْوِيًّا:', '[{"id":"a","text":"الطُّلّابِ مُجْتَهِدُونَ"},{"id":"b","text":"الطّالِبُ مُغْرَمٌ بِالقِراءَةِ"},{"id":"c","text":"المُعَلِّمُونَ حاضِرٌ"},{"id":"d","text":"المَدارسِ نَظِيفَةٌ"}]'::jsonb, 'approved', 'bundled', 'mcq'),
('GV16', '1.4.0-advanced-c1c2', 'B2', 'grammar_vocab', null, 'صِيغَةُ المَصْدَرِ الصَّحِيحَةُ لِلْفِعْلِ (فازَ / يَفُوزُ) هي:', '[{"id":"a","text":"فائِز"},{"id":"b","text":"مِفاز"},{"id":"c","text":"فَوْز"},{"id":"d","text":"أَفُوزُ"}]'::jsonb, 'approved', 'bundled', 'mcq'),
('R08', '1.4.0-advanced-c1c2', 'B2', 'reading', 'P_R_B2', 'ما التَّحَدِّي الَّذي تُواجهُهُ العَرَبِيَّةُ وَفْقَ النَّصِّ؟', '[{"id":"a","text":"قِلَّةُ عَدَدِ المُتَحَدِّثِينَ بِها"},{"id":"b","text":"مَيْلُ الشَّبابِ إِلى اسْتِخْدامِ الإِنْجِلِيزِيَّةِ وَالكِتابَةِ بِالحُرُوفِ اللاتِينِيَّةِ"},{"id":"c","text":"صُعُوبَةُ قَواعِدِها لِغَيْرِ النّاطِقِينَ بِها"},{"id":"d","text":"غِيابُ المَدارسِ العَرَبِيَّةِ"}]'::jsonb, 'approved', 'bundled', 'mcq'),
('R09', '1.4.0-advanced-c1c2', 'B2', 'reading', 'P_R_B2', 'ما الَّذي قَدْ يَحْدُثُ لِلأَجْيالِ القادِمَةِ بِحَسَبِ اللُّغَوِيِّينَ؟', '[{"id":"a","text":"تَفَوُّقُهُمْ في الإِنْجِلِيزِيَّةِ"},{"id":"b","text":"هَجْرُهُمْ وَسائِلَ التَّواصُلِ"},{"id":"c","text":"زِيادَةُ إِنْتاجِ المُحْتَوَى"},{"id":"d","text":"ضَعْفُ مَهاراتِهِمُ اللُّغَوِيَّةِ"}]'::jsonb, 'approved', 'bundled', 'mcq'),
('R10', '1.4.0-advanced-c1c2', 'B2', 'reading', 'P_R_B2', 'ما الحَلُّ المُقْتَرَحُ في خِتامِ النَّصِّ؟', '[{"id":"a","text":"مَنْعُ اسْتِخْدامِ الإِنْجِلِيزِيَّةِ"},{"id":"b","text":"إِغْلاقُ مَواقِعِ التَّواصُلِ"},{"id":"c","text":"إِثْراءُ المُحْتَوَى العَرَبِيِّ عَلى الإنْتَرْنِتِ"},{"id":"d","text":"تَدْرِيسُ اللُّغَةِ اللاتِينِيَّةِ"}]'::jsonb, 'approved', 'bundled', 'mcq'),
('L07', '1.4.0-advanced-c1c2', 'B2', 'listening', 'P_L_B2', 'ماذا أَعْلَنَتْ وِزارَةُ التَّعْلِيمِ؟', '[{"id":"a","text":"إِغْلاقَ المَعاهِدِ الأَهْلِيَّةِ"},{"id":"b","text":"إِطْلاقَ مِنَصَّةٍ مَجّانِيَّةٍ لِتَعْلِيمِ العَرَبِيَّةِ لِلنّاطِقِينَ بِغَيْرِها"},{"id":"c","text":"رَفْعَ رُسُومِ الدِّراسَةِ الجامِعِيَّةِ"},{"id":"d","text":"إِلْغاءَ اخْتِباراتِ تَحْدِيدِ المُسْتَوَى"}]'::jsonb, 'approved', 'bundled', 'mcq'),
('L08', '1.4.0-advanced-c1c2', 'B2', 'listening', 'P_L_B2', 'ما الهَدَفُ الَّذي تَسْعى إِلَيْهِ المِنَصَّةُ؟', '[{"id":"a","text":"الوُصُولَ إِلى مِلْيُونِ مُتَعَلِّمٍ خِلالَ عامَيْنِ"},{"id":"b","text":"تَدْرِيبَ أَلْفِ مُعَلِّمٍ جَدِيدٍ"},{"id":"c","text":"طِباعَةَ مِلْيُونِ كِتابٍ"},{"id":"d","text":"افْتِتاحَ عَشْرِ مَدارسَ"}]'::jsonb, 'approved', 'bundled', 'mcq'),
('GV17', '1.4.0-advanced-c1c2', 'C1', 'grammar_vocab', null, 'اخْتَرِ العِبارَةَ الَّتي تَجْمَعُ بَيْنَ الإِقْرارِ بِوَجاهَةِ الدَّليلِ وَالطَّعْنِ في كِفايَتِهِ لِلتَّعْميمِ:', '[{"id":"a","text":"ما دامَ الدَّليلُ وَجيهًا فالنَّتيجَةُ مَحْسومَةٌ في جَميعِ الحالاتِ."},{"id":"b","text":"لا أُنْكِرُ وَجاهَةَ هٰذا الدَّليلِ، غَيْرَ أَنَّهُ لا يَكْفي وَحْدَهُ لِتَعْميمِ الحُكْمِ."},{"id":"c","text":"الدَّليلُ باطِلٌ وَلا يَسْتَحِقُّ أَنْ يُناقَشَ."},{"id":"d","text":"تَتَساوى جَميعُ الأَدِلَّةِ مَهْما اخْتَلَفَتْ قُوَّتُها."}]'::jsonb, 'approved', 'bundled', 'mcq'),
('GV18', '1.4.0-advanced-c1c2', 'C1', 'grammar_vocab', null, 'في قَوْلِ الكاتِبِ: «قَدْ تَتَّسِعُ المَعْرِفَةُ بِالمَصادِرِ، عَلى أَنَّ الاِتِّساعَ لا يَضْمَنُ سَلامَةَ الحُكْمِ»، ما وَظيفَةُ «عَلى أَنَّ»؟', '[{"id":"a","text":"إِضافَةُ نَتيجَةٍ مُؤَكَّدَةٍ لِما قَبْلَها."},{"id":"b","text":"اسْتِدْراكٌ يُقَيِّدُ الحُكْمَ الَّذي قَبْلَهُ."},{"id":"c","text":"تَعْليلُ السَّبَبِ المُباشِرِ لِلاتِّساعِ."},{"id":"d","text":"تَرْتيبُ أَحْداثٍ وَقَعَتْ زَمَنِيًّا."}]'::jsonb, 'approved', 'bundled', 'mcq'),
('R11', '1.4.0-advanced-c1c2', 'C1', 'reading', 'P_R_C1', 'ما الوَظيفَةُ الحُجَاجِيَّةُ لِتَشْبيهِ المُدُنِ بِالبَشَرِ في افْتِتاحِ النَّصِّ؟', '[{"id":"a","text":"تَزْيينُ النَّصِّ بِصُورَةٍ أَدَبِيَّةٍ لا تَتَّصِلُ بِحُجَّتِهِ."},{"id":"b","text":"تَأْسيسُ فِكْرَةِ أَنَّ لِلمَكانِ هُوِيَّةً مُتَراكِمَةً لا تُخْتَزَلُ في مادَّتِهِ."},{"id":"c","text":"إِثْباتُ أَنَّ سُكّانَ المُدُنِ أَكْثَرُ ذاكِرَةً مِنْ سُكّانِ القُرى."},{"id":"d","text":"نَفْيُ قُدْرَةِ البَشَرِ عَلى حِفْظِ التّاريخِ."}]'::jsonb, 'approved', 'bundled', 'mcq'),
('R12', '1.4.0-advanced-c1c2', 'C1', 'reading', 'P_R_C1', 'أَيُّ افْتِراضٍ ضِمْنِيٍّ يَقُومُ عَلَيْهِ اعْتِراضُ الكاتِبِ عَلى هَدْمِ الأَحْياءِ القَديمَةِ؟', '[{"id":"a","text":"جَميعُ المَباني القَديمَةِ صالِحَةٌ لِلسَّكَنِ."},{"id":"b","text":"القيمَةُ التّاريخِيَّةُ لِلمَكانِ لا تُخْتَزَلُ في مَتانَةِ مَبانيهِ أَوْ نَفْعِها الآنيِّ."},{"id":"c","text":"الأَرْشيفُ الرَّسْمِيُّ أَقْدَرُ مِنَ الذِّكْرَياتِ عَلى حِفْظِ التّاريخِ."},{"id":"d","text":"التَّطْويرُ العُمْرانيُّ يَسْتَلْزِمُ هَدْمَ كُلِّ ما هُوَ قَديمٌ."}]'::jsonb, 'approved', 'bundled', 'mcq'),
('R13', '1.4.0-advanced-c1c2', 'C1', 'reading', 'P_R_C1', 'كَيْفَ يَنْتَقِلُ النَّصُّ مِنَ الوَصْفِ إِلى الحُجَّةِ؟', '[{"id":"a","text":"يَجْعَلُ الصُّوَرَ الفَنِّيَّةَ بَديلًا مِنَ الرَّأْيِ وَالاِسْتِدْلالِ."},{"id":"b","text":"يَسوقُ إِحْصاءاتٍ لِتَحْديدِ كُلْفَةِ الهَدْمِ."},{"id":"c","text":"يُوَظِّفُ الصُّوَرَ الحِسِّيَّةَ لِيُحَوِّلَ الهَدْمَ مِنْ إِزالَةٍ مادِّيَّةٍ إِلى مَحْوٍ لِلذّاكِرَةِ الجَمْعِيَّةِ."},{"id":"d","text":"يُقارِنُ بَيْنَ خُطَطِ تَرْميمٍ مُخْتَلِفَةٍ."}]'::jsonb, 'approved', 'bundled', 'mcq'),
('L09', '1.4.0-advanced-c1c2', 'C1', 'listening', 'P_L_C1', 'ما الفِكْرَةَ المَرْكَزِيَّةَ الَّتي يُدافِعُ عَنْها المُتَحَدِّثُ؟', '[{"id":"a","text":"الفُصْحى لُغَةٌ جامِدَةٌ فِعْلًا"},{"id":"b","text":"العامِّيَّةُ أَفْضَلُ مِنَ الفُصْحى"},{"id":"c","text":"الفُصْحى كانَتْ وَما زالَتْ لُغَةً مَرِنَةً"},{"id":"d","text":"التِّقْنِيَةُ عَدُوُّ اللُّغَةِ"}]'::jsonb, 'approved', 'bundled', 'mcq'),
('L10', '1.4.0-advanced-c1c2', 'C1', 'listening', 'P_L_C1', 'بِحَسَبِ المُتَحَدِّثِ، أَيْنَ تَكْمُنُ المُشْكِلَةُ الحَقِيقِيَّةُ؟', '[{"id":"a","text":"في بِنْيَةِ اللُّغَةِ نَفْسِها"},{"id":"b","text":"في كَثْرَةِ المُصْطَلَحاتِ الأَجْنَبِيَّةِ"},{"id":"c","text":"في ضَعْفِ المَناهِجِ الدِّراسِيَّةِ"},{"id":"d","text":"في عُزُوفِ أَهْلِها عَنِ اسْتِخْدامِها في حَياتِهِمُ اليَوْمِيَّةِ"}]'::jsonb, 'approved', 'bundled', 'mcq'),
('L11', '1.4.0-advanced-c1c2', 'C1', 'listening', 'P_L_C1', 'ما الدَّلِيلَ الَّذي ساقَهُ المُتَحَدِّثُ عَلى مُرُونَةِ الفُصْحى؟', '[{"id":"a","text":"اسْتِيعابَها مُصْطَلَحاتِ الطِّبِّ وَالفَلْسَفَةِ قَدِيمًا وَالتِّقْنِيَةِ اليَوْمَ"},{"id":"b","text":"كَثْرَةَ مُتَكَلِّمِيها حَوْلَ العالَمِ"},{"id":"c","text":"سُهُولَةَ قَواعِدِها"},{"id":"d","text":"تَشابُهَها مَعَ اللُّغَةِ اللاتِينِيَّةِ"}]'::jsonb, 'approved', 'bundled', 'mcq'),
('GV19', '1.4.0-advanced-c1c2', 'C2', 'grammar_vocab', null, 'في العِبارَةِ: «لَئِنْ بَدا القَرارُ مُتَأَخِّرًا، فَلَعَلَّ تَدارُكَ آثارِهِ ما زالَ مُمْكِنًا»، ما العَلاقَةُ الَّتي تُفيدُها «لَئِنْ»؟', '[{"id":"a","text":"تَوْكيدٌ مُجَرَّدٌ لا يَتَّصِلُ بِشَرْطٍ."},{"id":"b","text":"شَرْطٌ مُقْتَرِنٌ بِالتَّسْليمِ أَوِ الافْتِراضِ."},{"id":"c","text":"تَعْليلٌ مُباشِرٌ لِما بَعْدَهُ."},{"id":"d","text":"اسْتِدْراكٌ مُجَرَّدٌ مِنْ مَعْنى الشَّرْطِ."}]'::jsonb, 'approved', 'bundled', 'mcq'),
('GV20', '1.4.0-advanced-c1c2', 'C2', 'grammar_vocab', null, 'في العِبارَةِ: «لَيْسَ التَّرَدُّدُ في مُراجَعَةِ المُسَلَّماتِ ضَعْفًا في الرَّأْيِ، بَلْ صِيانَةٌ لَهُ مِنَ الجَزْمِ المُتَعَجِّلِ»، ما الأَثَرُ الحُجَاجِيُّ لِـ«بَلْ»؟', '[{"id":"a","text":"تُساوي بَيْنَ التَّرَدُّدِ وَالجَزْمِ المُتَعَجِّلِ."},{"id":"b","text":"تَنْقُلُ الحُكْمَ مِنْ نَفْيِ وَصْفٍ سَلْبِيٍّ إِلى إِثْباتِ قِيمَةٍ إِيجابِيَّةٍ."},{"id":"c","text":"تُعَلِّلُ سَبَبَ ظُهورِ الرَّأْيِ مِنْ غَيْرِ تَصْحيحٍ لَهُ."},{"id":"d","text":"تَدُلُّ عَلى تَرْتيبِ الأَحْداثِ في الزَّمَنِ."}]'::jsonb, 'approved', 'bundled', 'mcq'),
('R14', '1.4.0-advanced-c1c2', 'C2', 'reading', 'P_R_C2', 'ما الفِكْرَةُ الَّتي يُدافِعُ عَنْها النَّصُّ؟', '[{"id":"a","text":"صِحَّةُ المَعْلُومَةِ تَكْفي لِضَمانِ سَلامَةِ كُلِّ حُكْمٍ يُبْنى عَلَيْها."},{"id":"b","text":"صِحَّةُ المَعْلُومَةِ وَحْدَها لا تَكْفُلُ سَلامَةَ الحُكْمِ المُسْتَنِدِ إِلَيْها."},{"id":"c","text":"كُلُّ خِلافٍ حَوْلَ المَعْلُوماتِ يَعْني أَنَّها كاذِبَةٌ."},{"id":"d","text":"التَّحَقُّقُ يَقْتَصِرُ عَلى مَعْرِفَةِ اسْمِ مَصْدَرِ الخَبَرِ."}]'::jsonb, 'approved', 'bundled', 'mcq'),
('R15', '1.4.0-advanced-c1c2', 'C2', 'reading', 'P_R_C2', 'أَيُّ إِجْراءٍ يَنْسَجِمُ مَعَ مَنْهَجِ النَّصِّ عِنْدَ تَقْييمِ مَعْلُومَةٍ؟', '[{"id":"a","text":"قَبولُها مَتى صَدَرَتْ عَنْ مَصْدَرٍ مَعْرُوفٍ، مِنْ غَيْرِ نَظَرٍ في سِياقِها."},{"id":"b","text":"رَفْضُها إِذا اخْتَلَفَ النّاسُ في تَفْسيرِها."},{"id":"c","text":"فَحْصُ سِياقِها، وَما أُغْفِلَ مِنْها، وَحُدودِ تَعْميمِها."},{"id":"d","text":"مُقارَنَةُ صِياغَتِها بِما يُوافِقُ الرَّأْيَ المُسْبَقَ."}]'::jsonb, 'approved', 'bundled', 'mcq'),
('L12', '1.4.0-advanced-c1c2', 'C2', 'listening', 'P_L_C2', 'ما الرَّأْيُ الَّذي طَرَحَهُ سالِمٌ في بِدايَةِ النِّقاشِ؟', '[{"id":"a","text":"يَرَى أَنَّ اسْتِخْدامَ الآلَةِ يَجِبُ أَنْ يُرْفَضَ تَمامًا."},{"id":"b","text":"يَرَى أَنَّ الآلَةَ سَتَحُلُّ مَحَلَّ المُتَرْجِمِ البَشَرِيِّ تَمامًا."},{"id":"c","text":"يَرَى أَنَّ التَّرْجَمَةَ البَشَرِيَّةَ وَحْدَها كافِيَةٌ في جَميعِ النُّصُوصِ."},{"id":"d","text":"لا يُبْدي رَأْيًا واضِحًا في المَسْأَلَةِ."}]'::jsonb, 'approved', 'bundled', 'mcq'),
('L13', '1.4.0-advanced-c1c2', 'C2', 'listening', 'P_L_C2', 'ما حُجَّةَ الدُّكْتُورَةِ لَيْلى ضِدَّ رَأْيِ سالِمٍ؟', '[{"id":"a","text":"تَرى أَنَّ الآلَةَ بَطِيئَةٌ جِدًّا."},{"id":"b","text":"تَرى أَنَّ التَّرْجَمَةَ الآلِيَّةَ مُكَلِّفَةٌ مالِيًّا."},{"id":"c","text":"تَرى أَنَّ الآلَةَ تَعْجِزُ عَنْ إِدْراكِ ثَقافَةِ النَّصِّ وَمَقاصِدِهِ."},{"id":"d","text":"تَرى أَنَّهُ لا حاجَةَ إِلى التَّرْجَمَةِ أَصْلًا."}]'::jsonb, 'approved', 'bundled', 'mcq'),
('L14', '1.4.0-advanced-c1c2', 'C2', 'listening', 'P_L_C2', 'في أَيِّ نَوْعٍ مِنَ النُّصُوصِ وافَقَ سالِمٌ لَيْلى جُزْئِيًّا؟', '[{"id":"a","text":"التِّجارِيَّةِ"},{"id":"b","text":"التِّقْنِيَّةِ"},{"id":"c","text":"القانُونِيَّةِ"},{"id":"d","text":"الأَدَبِيَّةِ"}]'::jsonb, 'approved', 'bundled', 'mcq'),
('L15', '1.4.0-advanced-c1c2', 'C2', 'listening', 'P_L_C2', 'ما الصِّيغَةُ الَّتي اتَّفَقَ عَلَيْها سالِمٌ وَلَيْلى في نِهايَةِ النِّقاشِ؟', '[{"id":"a","text":"التَّكامُلُ بَيْنَ الآلَةِ وَالإِنْسانِ لا الإِحْلالُ"},{"id":"b","text":"الاِسْتِغْناءُ التّامُّ عَنِ المُتَرْجِمِينَ"},{"id":"c","text":"مَنْعُ بَرامِجِ التَّرْجَمَةِ الآلِيَّةِ"},{"id":"d","text":"الاِكْتِفاءُ بِتَعْريبِ المُصْطَلَحاتِ"}]'::jsonb, 'approved', 'bundled', 'mcq')
on conflict (content_version, item_code) do nothing;
insert into public.question_bank_answer_keys(item_id, correct_option_id)
select i.id, k.correct from public.question_bank_items i join (values
('GV01', 'b'),
('GV02', 'a'),
('GV03', 'c'),
('GV04', 'b'),
('R01', 'c'),
('R02', 'b'),
('L01', 'b'),
('L02', 'c'),
('GV05', 'a'),
('GV06', 'a'),
('GV07', 'a'),
('GV08', 'a'),
('R03', 'a'),
('R04', 'a'),
('L03', 'c'),
('L04', 'b'),
('GV09', 'a'),
('GV10', 'a'),
('GV11', 'c'),
('GV12', 'd'),
('R05', 'b'),
('R06', 'c'),
('R07', 'a'),
('L05', 'a'),
('L06', 'd'),
('GV13', 'b'),
('GV14', 'c'),
('GV15', 'b'),
('GV16', 'c'),
('R08', 'b'),
('R09', 'd'),
('R10', 'c'),
('L07', 'b'),
('L08', 'a'),
('GV17', 'b'),
('GV18', 'b'),
('R11', 'b'),
('R12', 'b'),
('R13', 'c'),
('L09', 'c'),
('L10', 'd'),
('L11', 'a'),
('GV19', 'b'),
('GV20', 'b'),
('R14', 'b'),
('R15', 'c'),
('L12', 'b'),
('L13', 'c'),
('L14', 'd'),
('L15', 'a')
) as k(code, correct) on k.code = i.item_code and i.content_version = '1.4.0-advanced-c1c2'
on conflict (item_id) do nothing;
insert into public.question_bank_blueprints(code, name_ar, description_ar, test_type, requirements, duration_minutes, is_system, purpose, level) values
('cefr-comprehensive-v1', 'اختبار تحديد المستوى الشامل — CEFR', '50 بندًا موزعة وفق التوازن بين المستويات والمهارات.', 'comprehensive', '{"A1":{"grammar_vocab":4,"reading":2,"listening":2},"A2":{"grammar_vocab":4,"reading":2,"listening":2},"B1":{"grammar_vocab":4,"reading":3,"listening":2},"B2":{"grammar_vocab":4,"reading":3,"listening":2},"C1":{"grammar_vocab":2,"reading":3,"listening":3},"C2":{"grammar_vocab":2,"reading":2,"listening":4}}'::jsonb, 50, true, 'placement', null),
('cefr-adaptive-v1', 'اختبار تحديد المستوى التكيفي — CEFR', 'مِسبار ثم وحدات مستويات؛ صعود ونزول بقرار الخادم.', 'adaptive', '{"A1":{"grammar_vocab":4,"reading":2,"listening":2},"A2":{"grammar_vocab":4,"reading":2,"listening":2},"B1":{"grammar_vocab":4,"reading":3,"listening":2},"B2":{"grammar_vocab":4,"reading":3,"listening":2},"C1":{"grammar_vocab":2,"reading":3,"listening":3},"C2":{"grammar_vocab":2,"reading":2,"listening":4}}'::jsonb, 50, true, 'placement', null),
('cefr-diagnostic-short-v1', 'اختبار تشخيصي قصير — CEFR', '18 بندًا: بند واحد من كل تقاطع مستوى ومهارة.', 'diagnostic', '{"A1":{"grammar_vocab":1,"reading":1,"listening":1},"A2":{"grammar_vocab":1,"reading":1,"listening":1},"B1":{"grammar_vocab":1,"reading":1,"listening":1},"B2":{"grammar_vocab":1,"reading":1,"listening":1},"C1":{"grammar_vocab":1,"reading":1,"listening":1},"C2":{"grammar_vocab":1,"reading":1,"listening":1}}'::jsonb, 20, true, 'diagnostic', null),
('level-a1-v1', 'اختبار مستوى A1 — CEFR', 'نموذج ثابت لمستوى A1: 40 بندًا (قراءة 14 · استماع 12 · كفاية لغوية 14) في 45 دقيقة؛ حدّ القطع الافتراضي 60% حتى جلسة تحديد المعيار.', 'level', '{"A1":{"grammar_vocab":14,"reading":14,"listening":12}}'::jsonb, 45, true, 'level', 'A1'),
('level-a2-v1', 'اختبار مستوى A2 — CEFR', 'نموذج ثابت لمستوى A2: 40 بندًا (قراءة 14 · استماع 12 · كفاية لغوية 14) في 45 دقيقة؛ حدّ القطع الافتراضي 60% حتى جلسة تحديد المعيار.', 'level', '{"A2":{"grammar_vocab":14,"reading":14,"listening":12}}'::jsonb, 45, true, 'level', 'A2'),
('level-b1-v1', 'اختبار مستوى B1 — CEFR', 'نموذج ثابت لمستوى B1: 40 بندًا (قراءة 14 · استماع 12 · كفاية لغوية 14) في 45 دقيقة؛ حدّ القطع الافتراضي 60% حتى جلسة تحديد المعيار.', 'level', '{"B1":{"grammar_vocab":14,"reading":14,"listening":12}}'::jsonb, 45, true, 'level', 'B1'),
('level-b2-v1', 'اختبار مستوى B2 — CEFR', 'نموذج ثابت لمستوى B2: 40 بندًا (قراءة 14 · استماع 12 · كفاية لغوية 14) في 45 دقيقة؛ حدّ القطع الافتراضي 60% حتى جلسة تحديد المعيار.', 'level', '{"B2":{"grammar_vocab":14,"reading":14,"listening":12}}'::jsonb, 45, true, 'level', 'B2'),
('level-c1-v1', 'اختبار مستوى C1 — CEFR', 'نموذج ثابت لمستوى C1: 40 بندًا (قراءة 14 · استماع 12 · كفاية لغوية 14) في 45 دقيقة؛ حدّ القطع الافتراضي 60% حتى جلسة تحديد المعيار.', 'level', '{"C1":{"grammar_vocab":14,"reading":14,"listening":12}}'::jsonb, 45, true, 'level', 'C1'),
('level-c2-v1', 'اختبار مستوى C2 — CEFR', 'نموذج ثابت لمستوى C2: 40 بندًا (قراءة 14 · استماع 12 · كفاية لغوية 14) في 45 دقيقة؛ حدّ القطع الافتراضي 60% حتى جلسة تحديد المعيار.', 'level', '{"C2":{"grammar_vocab":14,"reading":14,"listening":12}}'::jsonb, 45, true, 'level', 'C2')
on conflict (code) do nothing;

-- 10) التحقق (المتوقّع: tables_18 = 18 · descriptors = 84 · passages = 41 · items_bundled = 50 · keys = 50 · approved_pool = 48 · blueprints = 9 · bucket = 1)
select
  (select count(*) from information_schema.tables where table_schema = 'public' and table_name in ('miaar_descriptors','miaar_passages','question_bank_items','question_bank_answer_keys','question_bank_review_events','question_bank_blueprints','question_bank_forms','question_bank_form_items','question_bank_import_batches','question_bank_import_errors','placement_secure_sessions','placement_secure_answers','placement_reports','placement_decisions','placement_decision_events','test_retake_approvals','placement_invites','placement_invite_recipients')) as tables_18,
  (select count(*) from public.miaar_descriptors) as descriptors,
  (select count(*) from public.miaar_passages) as passages,
  (select count(*) from public.question_bank_items where source_kind = 'bundled') as items_bundled,
  (select count(*) from public.question_bank_answer_keys k join public.question_bank_items i on i.id = k.item_id where i.source_kind = 'bundled') as keys,
  (select count(*) from public.question_bank_items where source_kind = 'bundled' and status = 'approved') as approved_pool,
  (select count(*) from public.question_bank_blueprints) as blueprints,
  (select count(*) from storage.buckets where id = 'miaar-media') as bucket;
