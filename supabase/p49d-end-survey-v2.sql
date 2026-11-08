-- =====================================================================
-- P49-د — الاستبيان الختامي الشامل + إصلاح «قالب التقييم غير مرتبط بهذا البرنامج»
-- 2026-11-08 · آمن لإعادة التنفيذ (idempotent) · نفّذه كاملًا مرّة واحدة في Supabase → SQL Editor
--
--  (1) حارس النطاق validate_evaluation_scope: صار يقبل القالب الافتراضي العام (is_default)
--      لأيّ برنامج ليس له قالب خاص من النوع نفسه، ويربطه تلقائيًا في program_evaluation_templates
--      (سبب الخطأ: P49 يختار القالب الافتراضي من الواجهة، والحارس القديم يرفض أيّ قالب غير مربوط).
--  (2) ربط القالب الافتراضي END الآن بكل البرامج التي ليس لها قالب END نشط (دفعة واحدة).
--  (3) الاستبيان الختامي v2: 53 بندًا في 10 أقسام بترتيب رحلة المتدرّب — المفاتيح القديمة end_q01…q17 باقية
--      (الإجابات السابقة سليمة) مع تحديث نصوصها وأقسامها وترتيبها؛ البنود الجديدة تُضاف إن لم تكن موجودة.
--      النصّ محايد يصلح لأيّ جهة (لا «أكاديمية»، لا «دورة»).
-- =====================================================================

-- (1) حارس النطاق
create or replace function public.validate_evaluation_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  j          jsonb := to_jsonb(new);
  v_prog_org uuid;
  v_kind     text;
  v_tpl_kind text;
  v_linked   boolean;
  v_default  boolean := false;
  v_cls_prog uuid;
  v_has_org  boolean;
  v_link_org boolean;
begin
  if new.program_id is null then
    raise exception 'يجب تحديد البرنامج التدريبي';
  end if;

  select exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'programs' and column_name = 'organization_id')
    into v_has_org;
  if v_has_org then
    execute 'select organization_id from public.programs where id = $1' into v_prog_org using new.program_id;
  end if;
  if not exists (select 1 from public.programs where id = new.program_id) then
    raise exception 'البرنامج غير موجود';
  end if;

  v_kind := upper(coalesce(j->>'kind', ''));

  -- اختيار القالب تلقائيًا إن لم يُرسل: المربوط أولًا ثم الافتراضي العام
  if new.template_id is null then
    select t.id into new.template_id
    from public.program_evaluation_templates l
    join public.evaluation_templates t on t.id = l.template_id
    where l.program_id = new.program_id
      and coalesce(l.is_active, true)
      and (v_kind = '' or upper(t.kind::text) = v_kind)
    order by (select count(*) from public.questions q where q.template_id = t.id) desc, t.id
    limit 1;
  end if;
  if new.template_id is null and v_kind <> '' then
    select t.id into new.template_id from public.evaluation_templates t
    where coalesce(t.is_default, false) and upper(t.kind::text) = v_kind
    order by t.created_at nulls last limit 1;
  end if;
  if new.template_id is null then
    raise exception 'لا يوجد قالب تقييم مرتبط بهذا البرنامج';
  end if;

  select upper(t.kind::text), coalesce(t.is_default, false) into v_tpl_kind, v_default
  from public.evaluation_templates t where t.id = new.template_id;
  if not found then
    raise exception 'قالب التقييم غير موجود';
  end if;
  if v_kind <> '' and v_tpl_kind is not null and v_tpl_kind <> v_kind then
    raise exception 'نوع القالب (%) لا يطابق نوع التقييم (%)', v_tpl_kind, v_kind;
  end if;

  select exists (select 1 from public.program_evaluation_templates l
                 where l.program_id = new.program_id and l.template_id = new.template_id and coalesce(l.is_active, true))
    into v_linked;

  -- P49-د: القالب الافتراضي العام مقبول لأيّ برنامج ليس له قالب خاص نشط من النوع نفسه — ويُربط تلقائيًا
  if not v_linked and v_default then
    if not exists (select 1 from public.program_evaluation_templates l
                   join public.evaluation_templates t2 on t2.id = l.template_id
                   where l.program_id = new.program_id and coalesce(l.is_active, true)
                     and upper(t2.kind::text) = v_tpl_kind) then
      begin
        select exists (select 1 from information_schema.columns where table_schema = 'public'
                       and table_name = 'program_evaluation_templates' and column_name = 'organization_id') into v_link_org;
        if v_link_org and v_prog_org is not null then
          execute 'insert into public.program_evaluation_templates (program_id, template_id, is_active, organization_id) values ($1, $2, true, $3)'
            using new.program_id, new.template_id, v_prog_org;
        else
          execute 'insert into public.program_evaluation_templates (program_id, template_id, is_active) values ($1, $2, true)'
            using new.program_id, new.template_id;
        end if;
      exception when others then
        null; -- الربط التلقائي ليس شرطًا للقبول
      end;
      v_linked := true;
    end if;
  end if;
  if not v_linked then
    raise exception 'قالب التقييم غير مرتبط بهذا البرنامج';
  end if;

  if coalesce(j->>'classroom_id', '') <> '' then
    select c.program_id into v_cls_prog from public.classrooms c where c.id = (j->>'classroom_id')::uuid;
    if v_cls_prog is not null and v_cls_prog <> new.program_id then
      raise exception 'القاعة المختارة لا تتبع هذا البرنامج';
    end if;
  end if;

  if new.organization_id is null and v_prog_org is not null then
    new.organization_id := v_prog_org;
  end if;

  return new;
end;
$$;

revoke execute on function public.validate_evaluation_scope() from public, anon, authenticated;

drop trigger if exists evaluations_scope_guard on public.evaluations;
create trigger evaluations_scope_guard
before insert or update on public.evaluations
for each row execute function public.validate_evaluation_scope();

-- (2) ربط القالب الافتراضي END بكل البرامج التي لا تملك قالب END نشطًا
do $$
declare
  v_tpl uuid; v_has_org boolean; r record; n int := 0;
begin
  select id into v_tpl from public.evaluation_templates where upper(kind::text) = 'END' order by is_default desc, created_at nulls last limit 1;
  if v_tpl is null then raise notice 'لا يوجد قالب END — نفّذ 20270125b أولًا'; return; end if;
  update public.evaluation_templates set is_default = true where id = v_tpl and not is_default;
  select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'program_evaluation_templates' and column_name = 'organization_id') into v_has_org;
  for r in select p.id, p.organization_id from public.programs p
           where not exists (select 1 from public.program_evaluation_templates l join public.evaluation_templates t on t.id = l.template_id
                             where l.program_id = p.id and coalesce(l.is_active, true) and upper(t.kind::text) = 'END') loop
    begin
      if v_has_org then
        execute 'insert into public.program_evaluation_templates (program_id, template_id, is_active, organization_id) values ($1, $2, true, $3)' using r.id, v_tpl, r.organization_id;
      else
        execute 'insert into public.program_evaluation_templates (program_id, template_id, is_active) values ($1, $2, true)' using r.id, v_tpl;
      end if;
      n := n + 1;
    exception when others then
      raise notice 'تعذّر ربط البرنامج %: %', r.id, sqlerrm;
    end;
  end loop;
  raise notice 'قالب END الافتراضي % — برامج رُبطت الآن: %', v_tpl, n;
end $$;

-- (3) الاستبيان الختامي v2 — 53 بندًا (تحديث الموجود بالمفتاح + إضافة الجديد)
do $$
declare
  v_tpl uuid;
  v_rows jsonb := '[{"key":"end_r01_registration","kind":"LIKERT_5","ar":"خطوات التسجيل في البرنامج كانت واضحة وسهلة","en":"The registration steps were clear and easy","section_ar":"التسجيل والاستقبال","section_en":"Registration & reception","required":true,"options":[],"max":5,"order":1},{"key":"end_r02_enquiries","kind":"LIKERT_5","ar":"رُدّ على استفساراتي قبل البرنامج بسرعة ووضوح","en":"My enquiries before the programme were answered quickly and clearly","section_ar":"التسجيل والاستقبال","section_en":"Registration & reception","required":true,"options":[],"max":5,"order":2},{"key":"end_r03_prearrival","kind":"LIKERT_5","ar":"وصلتني معلومات كافية قبل البدء (المواعيد · المكان · المتطلبات)","en":"I received sufficient information before starting (dates, venue, requirements)","section_ar":"التسجيل والاستقبال","section_en":"Registration & reception","required":true,"options":[],"max":5,"order":3},{"key":"end_r04_reception","kind":"LIKERT_5","ar":"استقبلني فريق الاستقبال باحترام وساعدني في اليوم الأول","en":"The reception team welcomed me respectfully and helped me on the first day","section_ar":"التسجيل والاستقبال","section_en":"Registration & reception","required":true,"options":[],"max":5,"order":4},{"key":"end_f01_room","kind":"LIKERT_5","ar":"قاعة التدريب مناسبة من حيث المساحة والمقاعد وترتيب الجلوس","en":"The training room was suitable in size, seating and layout","section_ar":"قاعة التدريب والمرافق","section_en":"Training room & facilities","required":true,"options":[],"max":5,"order":5},{"key":"end_f02_climate","kind":"LIKERT_5","ar":"الإضاءة والتهوية ودرجة الحرارة في القاعة مريحة","en":"Lighting, ventilation and temperature in the room were comfortable","section_ar":"قاعة التدريب والمرافق","section_en":"Training room & facilities","required":true,"options":[],"max":5,"order":6},{"key":"end_f03_cleanliness","kind":"LIKERT_5","ar":"نظافة القاعة والمرافق (دورات المياه · الممرّات) جيدة","en":"The room and facilities (restrooms, corridors) were clean","section_ar":"قاعة التدريب والمرافق","section_en":"Training room & facilities","required":true,"options":[],"max":5,"order":7},{"key":"end_f04_access","kind":"LIKERT_5","ar":"الوصول إلى مقرّ التدريب سهل (الموقع · اللوحات الإرشادية · مواقف السيارات)","en":"Reaching the venue was easy (location, signage, parking)","section_ar":"قاعة التدريب والمرافق","section_en":"Training room & facilities","required":true,"options":[],"max":5,"order":8},{"key":"end_f05_accessibility","kind":"LIKERT_5","ar":"المقرّ مهيّأ لذوي الإعاقة واحتياجات الوصول (إن انطبق)","en":"The venue is accessible for people with disabilities (if applicable)","section_ar":"قاعة التدريب والمرافق","section_en":"Training room & facilities","required":false,"options":[],"max":5,"order":9},{"key":"end_t01_av","kind":"LIKERT_5","ar":"الشاشة أو جهاز العرض والصوت واضحان من كل مقاعد القاعة","en":"The screen/projector and sound were clear from every seat","section_ar":"التجهيزات والتقنية","section_en":"Equipment & technology","required":true,"options":[],"max":5,"order":10},{"key":"end_t02_internet","kind":"LIKERT_5","ar":"الإنترنت متاح ومستقر عند الحاجة إليه","en":"Internet was available and stable when needed","section_ar":"التجهيزات والتقنية","section_en":"Equipment & technology","required":true,"options":[],"max":5,"order":11},{"key":"end_t03_platform","kind":"LIKERT_5","ar":"المنصّة الرقمية أو الأدوات الإلكترونية المستخدمة سهلة ومفيدة (إن استُخدمت)","en":"The digital platform or e-tools used were easy and useful (if used)","section_ar":"التجهيزات والتقنية","section_en":"Equipment & technology","required":false,"options":[],"max":5,"order":12},{"key":"end_t04_supplies","kind":"LIKERT_5","ar":"الأدوات والمستلزمات التدريبية (سبورة · أقلام · أوراق · نسخ) متوفّرة","en":"Training supplies (board, markers, paper, copies) were available","section_ar":"التجهيزات والتقنية","section_en":"Equipment & technology","required":true,"options":[],"max":5,"order":13},{"key":"end_t05_support","kind":"LIKERT_5","ar":"الدعم التقني أو اللوجستي يصل بسرعة عند حدوث مشكلة","en":"Technical or logistical support arrived quickly when a problem occurred","section_ar":"التجهيزات والتقنية","section_en":"Equipment & technology","required":true,"options":[],"max":5,"order":14},{"key":"end_h01_catering","kind":"LIKERT_5","ar":"جودة الضيافة (المشروبات · الوجبات) مناسبة (إن قُدّمت)","en":"The quality of hospitality (drinks, meals) was appropriate (if provided)","section_ar":"الضيافة والخدمات","section_en":"Hospitality & services","required":false,"options":[],"max":5,"order":15},{"key":"end_h02_breaks","kind":"LIKERT_5","ar":"مواعيد الاستراحات ومدّتها مناسبة","en":"Break times and their length were appropriate","section_ar":"الضيافة والخدمات","section_en":"Hospitality & services","required":true,"options":[],"max":5,"order":16},{"key":"end_h03_rest","kind":"LIKERT_5","ar":"أماكن الاستراحة والصلاة متوفّرة ومريحة (إن انطبق)","en":"Rest and prayer areas were available and comfortable (if applicable)","section_ar":"الضيافة والخدمات","section_en":"Hospitality & services","required":false,"options":[],"max":5,"order":17},{"key":"end_q01_objectives","kind":"LIKERT_5","ar":"كانت أهداف البرنامج واضحة منذ البداية","en":"The programme objectives were clear from the start","section_ar":"المادة التدريبية وكتاب المستوى","section_en":"Training material & level book","required":true,"options":[],"max":5,"order":18},{"key":"end_q04_materials","kind":"LIKERT_5","ar":"كانت الحقيبة التدريبية ومصادر التعلّم مفيدة","en":"The training kit and learning resources were useful","section_ar":"المادة التدريبية وكتاب المستوى","section_en":"Training material & level book","required":true,"options":[],"max":5,"order":19},{"key":"end_q06_quality","kind":"LIKERT_5","ar":"مواد البرنامج (أو كتاب المستوى) عالية الجودة ومناسبة للتعلّم","en":"The programme materials (or level book) were high quality and suitable for learning","section_ar":"المادة التدريبية وكتاب المستوى","section_en":"Training material & level book","required":true,"options":[],"max":5,"order":20},{"key":"end_m01_level_fit","kind":"LIKERT_5","ar":"محتوى المادة أو كتاب المستوى مناسب لمستواي الحالي","en":"The material or level book matched my current level","section_ar":"المادة التدريبية وكتاب المستوى","section_en":"Training material & level book","required":true,"options":[],"max":5,"order":21},{"key":"end_m02_sequence","kind":"LIKERT_5","ar":"تسلسل الموضوعات منطقي ومتدرّج","en":"The topics were sequenced logically and progressively","section_ar":"المادة التدريبية وكتاب المستوى","section_en":"Training material & level book","required":true,"options":[],"max":5,"order":22},{"key":"end_m03_skills","kind":"LIKERT_5","ar":"المادة توازن بين المهارات (استماع · تحدّث · قراءة · كتابة) بما يناسب البرنامج (إن انطبق)","en":"The material balanced the skills (listening, speaking, reading, writing) as the programme requires (if applicable)","section_ar":"المادة التدريبية وكتاب المستوى","section_en":"Training material & level book","required":false,"options":[],"max":5,"order":23},{"key":"end_m04_examples","kind":"LIKERT_5","ar":"الأمثلة والتمارين واقعية وقريبة من احتياجي","en":"Examples and exercises were realistic and close to my needs","section_ar":"المادة التدريبية وكتاب المستوى","section_en":"Training material & level book","required":true,"options":[],"max":5,"order":24},{"key":"end_q07_motivation","kind":"LIKERT_5","ar":"زاد المدرّب من حافزي للتعلّم","en":"The trainer increased my motivation to learn","section_ar":"المدرّب","section_en":"The trainer","required":true,"options":[],"max":5,"order":25},{"key":"end_q08_depth","kind":"LIKERT_5","ar":"شرح المدرّب المعلومات بعمق وتفصيل مناسبين","en":"The trainer explained the information in appropriate depth and detail","section_ar":"المدرّب","section_en":"The trainer","required":true,"options":[],"max":5,"order":26},{"key":"end_q09_enthusiasm","kind":"LIKERT_5","ar":"كان المدرّب متحمّسًا ومهتمًّا بالتدريب","en":"The trainer was enthusiastic and engaged in the training","section_ar":"المدرّب","section_en":"The trainer","required":true,"options":[],"max":5,"order":27},{"key":"end_q10_answers","kind":"LIKERT_5","ar":"حصلت على إجابات واضحة لأسئلتي من المدرّب","en":"I got clear answers to my questions from the trainer","section_ar":"المدرّب","section_en":"The trainer","required":true,"options":[],"max":5,"order":28},{"key":"end_q11_readiness","kind":"LIKERT_5","ar":"كان المدرّب مستعدًّا للإجابة عن كل الاستفسارات المتعلّقة بالبرنامج","en":"The trainer was ready to answer all programme-related enquiries","section_ar":"المدرّب","section_en":"The trainer","required":true,"options":[],"max":5,"order":29},{"key":"end_q12_pace","kind":"LIKERT_5","ar":"كانت سرعة تقديم المادة مناسبة","en":"The pace of delivery was right","section_ar":"المدرّب","section_en":"The trainer","required":true,"options":[],"max":5,"order":30},{"key":"end_tr01_time","kind":"LIKERT_5","ar":"يلتزم المدرّب بالمواعيد ويدير وقت الجلسة جيدًا","en":"The trainer was punctual and managed session time well","section_ar":"المدرّب","section_en":"The trainer","required":true,"options":[],"max":5,"order":31},{"key":"end_tr02_respect","kind":"LIKERT_5","ar":"يعامل المدرّب الجميع باحترام وعدل ويشجّع المشاركة","en":"The trainer treated everyone with respect and fairness and encouraged participation","section_ar":"المدرّب","section_en":"The trainer","required":true,"options":[],"max":5,"order":32},{"key":"end_tr03_methods","kind":"LIKERT_5","ar":"ينوّع المدرّب طرائق التدريب (شرح · حوار · تطبيق · مجموعات)","en":"The trainer varied the methods (explanation, discussion, practice, group work)","section_ar":"المدرّب","section_en":"The trainer","required":true,"options":[],"max":5,"order":33},{"key":"end_tr04_feedback","kind":"LIKERT_5","ar":"يقدّم لي المدرّب تغذية راجعة واضحة على أدائي","en":"The trainer gave me clear feedback on my performance","section_ar":"المدرّب","section_en":"The trainer","required":true,"options":[],"max":5,"order":34},{"key":"end_q02_workload","kind":"LIKERT_5","ar":"كان مقدار الواجبات والأعمال الصفّية المطلوبة مناسبًا","en":"The amount of assignments and class work required was appropriate","section_ar":"الأنشطة التدريبية والتقييم","section_en":"Activities & assessment","required":true,"options":[],"max":5,"order":35},{"key":"end_q03_presentations","kind":"LIKERT_5","ar":"تشرح العروض والشروح التدريبية المفاهيم بفاعلية","en":"The presentations explained the concepts effectively","section_ar":"الأنشطة التدريبية والتقييم","section_en":"Activities & assessment","required":true,"options":[],"max":5,"order":36},{"key":"end_q05_technology","kind":"LIKERT_5","ar":"عزّز استخدام التقنية خلال البرنامج فهمي للموضوع","en":"The use of technology during the programme enhanced my understanding","section_ar":"الأنشطة التدريبية والتقييم","section_en":"Activities & assessment","required":true,"options":[],"max":5,"order":37},{"key":"end_a01_interactive","kind":"LIKERT_5","ar":"الأنشطة التفاعلية (مجموعات · أدوار · مشاريع) أفادتني في التعلّم","en":"Interactive activities (groups, role-play, projects) helped my learning","section_ar":"الأنشطة التدريبية والتقييم","section_en":"Activities & assessment","required":true,"options":[],"max":5,"order":38},{"key":"end_a02_assessment","kind":"LIKERT_5","ar":"الاختبارات والواجبات عكست ما تعلّمته فعلًا","en":"Tests and assignments reflected what I actually learned","section_ar":"الأنشطة التدريبية والتقييم","section_en":"Activities & assessment","required":true,"options":[],"max":5,"order":39},{"key":"end_a03_progress","kind":"LIKERT_5","ar":"عرفت نتائجي ومستوى تقدّمي أثناء البرنامج لا في نهايته فقط","en":"I knew my results and progress during the programme, not only at the end","section_ar":"الأنشطة التدريبية والتقييم","section_en":"Activities & assessment","required":true,"options":[],"max":5,"order":40},{"key":"end_a04_extra","kind":"LIKERT_5","ar":"الأنشطة المصاحبة (زيارات · فعاليات · أنشطة ثقافية) أضافت لي (إن وُجدت)","en":"Accompanying activities (visits, events, cultural activities) added value (if any)","section_ar":"الأنشطة التدريبية والتقييم","section_en":"Activities & assessment","required":false,"options":[],"max":5,"order":41},{"key":"end_p01_schedule","kind":"LIKERT_5","ar":"الجدول الزمني واضح والتزمت به إدارة البرنامج","en":"The schedule was clear and the programme office kept to it","section_ar":"إدارة البرنامج","section_en":"Programme management","required":true,"options":[],"max":5,"order":42},{"key":"end_p02_duration","kind":"LIKERT_5","ar":"مدّة البرنامج وعدد الساعات مناسبان للمحتوى","en":"The programme length and hours suited the content","section_ar":"إدارة البرنامج","section_en":"Programme management","required":true,"options":[],"max":5,"order":43},{"key":"end_p03_group","kind":"LIKERT_5","ar":"حجم المجموعة مناسب للتعلّم","en":"The group size was suitable for learning","section_ar":"إدارة البرنامج","section_en":"Programme management","required":true,"options":[],"max":5,"order":44},{"key":"end_p04_communication","kind":"LIKERT_5","ar":"التواصل مع إدارة البرنامج سهل والردّ سريع","en":"Communicating with the programme office was easy and responses were quick","section_ar":"إدارة البرنامج","section_en":"Programme management","required":true,"options":[],"max":5,"order":45},{"key":"end_p05_complaints","kind":"LIKERT_5","ar":"تُؤخذ الملاحظات والشكاوى بجدّية ويُتعامل معها","en":"Feedback and complaints were taken seriously and acted upon","section_ar":"إدارة البرنامج","section_en":"Programme management","required":true,"options":[],"max":5,"order":46},{"key":"end_p06_documents","kind":"LIKERT_5","ar":"الوثائق (الحضور · النتائج · الشهادات) تصدر بدقّة وفي وقتها (إن انطبق)","en":"Documents (attendance, results, certificates) were issued accurately and on time (if applicable)","section_ar":"إدارة البرنامج","section_en":"Programme management","required":false,"options":[],"max":5,"order":47},{"key":"end_q13_improve_trainer","kind":"LONG_TEXT","ar":"ما الذي تنصح به لتحسين أداء المدرّب؟","en":"What would you recommend to improve the trainer''s performance?","section_ar":"رأيك","section_en":"Your opinion","required":false,"options":[],"max":null,"order":48},{"key":"end_q14_strengths","kind":"LONG_TEXT","ar":"ما نقاط القوة الرئيسية في هذا البرنامج؟","en":"What are the main strengths of this programme?","section_ar":"رأيك","section_en":"Your opinion","required":false,"options":[],"max":null,"order":49},{"key":"end_q15_improvements","kind":"LONG_TEXT","ar":"ما النقاط التي تحتاج إلى تحسين في هذا البرنامج؟","en":"What needs improvement in this programme?","section_ar":"رأيك","section_en":"Your opinion","required":false,"options":[],"max":null,"order":50},{"key":"end_o01_environment","kind":"LONG_TEXT","ar":"ما الذي تقترحه لتحسين البيئة التدريبية (القاعة · التجهيزات · الخدمات · الإدارة)؟","en":"What would you suggest to improve the training environment (room, equipment, services, management)?","section_ar":"رأيك","section_en":"Your opinion","required":false,"options":[],"max":null,"order":51},{"key":"end_q16_overall","kind":"SINGLE_CHOICE","ar":"ما التقييم العام الذي تعطيه للبرنامج؟","en":"What overall rating would you give the programme?","section_ar":"التقييم العام","section_en":"Overall","required":true,"options":["ممتاز","جيد جدا","جيد","مقبول","ضعيف"],"max":null,"order":52},{"key":"end_q17_nps","kind":"NPS_10","ar":"ما مدى ترشيحك لزملائك وأصدقائك بالتدرّب معنا؟ (10 أعلى قيمة و0 أقل قيمة)","en":"How likely are you to recommend training with us to your colleagues and friends? (10 = highest, 0 = lowest)","section_ar":"الترشيح","section_en":"Recommendation","required":true,"options":[],"max":10,"order":53}]';
  q jsonb;
  v_opts_type text;
  v_opts text;
  n_ins int := 0; n_upd int := 0;
begin
  select id into v_tpl from public.evaluation_templates where upper(kind::text) = 'END' order by is_default desc, created_at nulls last limit 1;
  if v_tpl is null then raise exception 'لا يوجد قالب END — نفّذ 20270125b أولًا'; end if;
  update public.evaluation_templates set name_ar = 'استبيان نهاية البرنامج (شامل)', name_en = 'End-of-programme survey (comprehensive)' where id = v_tpl;
  select data_type into v_opts_type from information_schema.columns where table_schema = 'public' and table_name = 'questions' and column_name = 'options';
  -- أزح الترتيب القديم بعيدًا لتجنّب أيّ قيد تفرّد على order_index
  update public.questions set order_index = order_index + 1000 where template_id = v_tpl;
  for q in select * from jsonb_array_elements(v_rows) loop
    if v_opts_type = 'ARRAY' then v_opts := format('array(select jsonb_array_elements_text(%L::jsonb))::text[]', (q->'options')::text);
    elsif v_opts_type in ('jsonb', 'json') then v_opts := format('%L::jsonb', (q->'options')::text);
    else v_opts := format('%L', (q->'options')::text); end if;
    if exists (select 1 from public.questions where template_id = v_tpl and question_key = q->>'key') then
      execute format('update public.questions set kind = %L, text_ar = %L, text_en = %L, section_ar = %L, section_en = %L, is_required = %L, options = %s, max_value = %L, order_index = %L where template_id = %L and question_key = %L',
        q->>'kind', q->>'ar', q->>'en', q->>'section_ar', q->>'section_en', (q->>'required')::boolean, v_opts, coalesce(nullif(q->>'max', '')::int, 5), (q->>'order')::int, v_tpl, q->>'key');
      n_upd := n_upd + 1;
    else
      execute format('insert into public.questions (template_id, kind, text_ar, text_en, section_ar, section_en, is_required, options, max_value, order_index, question_key) values (%L, %L, %L, %L, %L, %L, %L, %s, %L, %L, %L)',
        v_tpl, q->>'kind', q->>'ar', q->>'en', q->>'section_ar', q->>'section_en', (q->>'required')::boolean, v_opts, coalesce(nullif(q->>'max', '')::int, 5), (q->>'order')::int, q->>'key');
      n_ins := n_ins + 1;
    end if;
  end loop;
  raise notice 'قالب END %: حُدِّث % · أُضيف %', v_tpl, n_upd, n_ins;
end $$;

-- تشخيص — المتوقَّع: end_default = 1 · end_questions = 53 · likert = 47 · optional_likert = 7 · texts = 4 · nps = 1 · unlinked_programs = 0 · academy_words = 0 · guard_default = 1
select
  (select count(*) from public.evaluation_templates where upper(kind::text) = 'END' and is_default) as end_default,
  (select count(*) from public.questions q join public.evaluation_templates t on t.id = q.template_id where upper(t.kind::text) = 'END' and t.is_default) as end_questions,
  (select count(*) from public.questions q join public.evaluation_templates t on t.id = q.template_id where upper(t.kind::text) = 'END' and t.is_default and upper(q.kind::text) = 'LIKERT_5') as likert,
  (select count(*) from public.questions q join public.evaluation_templates t on t.id = q.template_id where upper(t.kind::text) = 'END' and t.is_default and upper(q.kind::text) = 'LIKERT_5' and not q.is_required) as optional_likert,
  (select count(*) from public.questions q join public.evaluation_templates t on t.id = q.template_id where upper(t.kind::text) = 'END' and t.is_default and upper(q.kind::text) = 'LONG_TEXT') as texts,
  (select count(*) from public.questions q join public.evaluation_templates t on t.id = q.template_id where upper(t.kind::text) = 'END' and t.is_default and upper(q.kind::text) = 'NPS_10') as nps,
  (select count(*) from public.programs p where not exists (select 1 from public.program_evaluation_templates l join public.evaluation_templates t on t.id = l.template_id where l.program_id = p.id and coalesce(l.is_active, true) and upper(t.kind::text) = 'END')) as unlinked_programs,
  (select count(*) from public.questions q join public.evaluation_templates t on t.id = q.template_id where upper(t.kind::text) = 'END' and t.is_default and (q.text_ar like '%أكاديمية%' or lower(coalesce(q.text_en, '')) like '%academy%')) as academy_words,
  (select count(*) from pg_proc where proname = 'validate_evaluation_scope' and prosrc like '%P49-د%') as guard_default;
