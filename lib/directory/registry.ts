// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * هيئة أَثَر (P31) — المحرّك النقيّ (بلا DB ولا env):
 *  «سيرتك توثّقها بنفسك، وشهادة توثيقها أَثَر» — سيرة واحدة بوجهين (خبير استشاري · مدرب)
 *  - الثوابت والأنواع · التحقق · شروط الإرسال للاعتماد (الصورة إلزامية) · العرض العام بندًا بندًا (لا بريد · لا هاتف · لا حقول الطاقم)
 *  - «ما شهده أَثَر»: أسطر مشتقة من أعداد الأحداث — لا تُحرَّر
 *  - البحث والترتيب (حداثة التحديث ثم أبجديًا — لا نجوم ولا ترتيب تفضيلي)
 *  - عقد التعاون على كل مهمة: آلة الحالات · التحقق · الأجر لا يخرج عن الطرفين
 */
import { randomCode } from '../portal/profile';

export const DIRECTORY_VERSION = 'p31.1';
export const SUMMARY_MIN = 80, SUMMARY_MAX = 1200, TITLE_MAX = 120, NAME_MAX = 120, CITY_MAX = 60;
export const ACHIEVEMENTS_MAX = 10, ACHIEVEMENT_LEN = 240, EDUCATION_MAX = 8, EXPERIENCE_MAX = 15, CERTS_MAX = 15, PUBS_MAX = 20;
export const SKILLS_MIN = 1, SKILLS_MAX = 8, SECTORS_MIN = 1, SECTORS_MAX = 5, SERVICES_MIN = 1, SERVICES_MAX = 6, LANGS_MAX = 5, COVERAGE_MAX = 12;
export const PHOTO_MAX_BYTES = 2 * 1024 * 1024; export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const DOCS_MAX = 5, DOC_MAX_BYTES = 5 * 1024 * 1024; export const DOC_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
export const SEARCH_PAGE = 60, SEARCH_Q_MAX = 80;
export const UPDATE_REMINDER_DAYS = 365;
export const ENGAGEMENT_TITLE_MAX = 160, ENGAGEMENT_SCOPE_MAX = 2000, ENGAGEMENT_TERMS_MAX = 3000, ENGAGEMENT_NOTE_MAX = 600, DELIVERABLES_MAX = 12;
export const CODE_PREFIX_MEMBER = 'ATH-HM', CODE_PREFIX_EXPERT = 'ATH-EX', CODE_PREFIX_TRAINER = 'ATH-TR', CODE_PREFIX_COLLAB = 'ATH-CO';
export const PUBLIC_BUCKET = 'athar-public', PRIVATE_BUCKET = 'athar-media';

export type Face = 'expert' | 'trainer';
export const FACES: Face[] = ['expert', 'trainer'];
export const FACE_AR: Record<Face, string> = { expert: 'خبير استشاري', trainer: 'مدرب' };
export const FACE_TITLE_AR: Record<Face, string> = { expert: 'هيئة أَثَر للخبراء', trainer: 'هيئة أَثَر للمدربين' };
export const TAGLINE_AR = 'سيرتك توثّقها بنفسك، وشهادة توثيقها أَثَر';
export type ProfileStatus = 'draft' | 'submitted' | 'approved' | 'changes_requested' | 'suspended';
export const STATUS_AR: Record<ProfileStatus, string> = { draft: 'مسودة', submitted: 'بانتظار الاعتماد', approved: 'معتمد — عضو هيئة أَثَر', changes_requested: 'طُلب تعديل', suspended: 'موقوف' };

export const SERVICES = ['consulting', 'training', 'assessment', 'program_design', 'judging', 'research_supervision', 'keynote', 'council_facilitation'] as const;
export type Service = typeof SERVICES[number];
export const SERVICE_AR: Record<Service, string> = { consulting: 'استشارة', training: 'تدريب', assessment: 'تقييم', program_design: 'تصميم برامج', judging: 'تحكيم', research_supervision: 'إشراف بحثي', keynote: 'حديث رئيسي', council_facilitation: 'تيسير مجالس' };
export const MODES = ['onsite', 'remote', 'hybrid'] as const; export type Mode = typeof MODES[number];
export const MODE_AR: Record<Mode, string> = { onsite: 'حضوري', remote: 'عن بُعد', hybrid: 'هجين' };
export const LANG_AR: Record<string, string> = { ar: 'العربية', en: 'الإنجليزية', fr: 'الفرنسية', ur: 'الأردية', tr: 'التركية', other: 'أخرى' };
export const SECTIONS = ['photo', 'summary', 'achievements', 'education', 'experience', 'certifications', 'publications', 'city', 'languages', 'coverage'] as const;
export type Section = typeof SECTIONS[number];
export const SECTION_AR: Record<Section, string> = { photo: 'الصورة', summary: 'ملخص السيرة', achievements: 'أبرز الإنجازات', education: 'التعليم', experience: 'الخبرات', certifications: 'الشهادات المهنية', publications: 'المنشورات', city: 'المدينة', languages: 'اللغات', coverage: 'نطاق التغطية' };
/** الافتراضي: كل شيء يظهر إلا ما أُطفئ — والصورة لا تظهر إلا بالموافقة الصريحة (تُفحص على حدة) */
export const DEFAULT_VISIBILITY: Record<Section, boolean> = { photo: true, summary: true, achievements: true, education: true, experience: true, certifications: true, publications: true, city: true, languages: true, coverage: true };

export type Education = { degree: string; field: string; institution: string; year: string };
export type Experience = { role: string; organization: string; from: string; to: string; line: string };
export type Certification = { name: string; issuer: string; year: string; number?: string };
export type Publication = { title: string; type: string; year: string; url?: string };
export type StaffOnly = { availability?: string; docs?: { name: string; path: string; mime: string; bytes: number; at: string }[]; notes?: string };
export type Card = { code: string; vc_issuance_id: string | null; issued_at: string } | null;
export type Profile = {
  id: string; created_at: string; updated_at: string; user_id: string | null; email: string; status: ProfileStatus; faces: Face[]; listed: boolean; slug: string | null; code: string | null;
  name_ar: string; name_en: string | null; title_ar: string; title_en: string | null; city: string | null; languages: string[];
  photo_path: string | null; photo_public_path: string | null; photo_consent_at: string | null;
  summary_ar: string; summary_en: string | null; achievements: string[]; education: Education[]; experience: Experience[]; certifications: Certification[]; publications: Publication[];
  skill_ids: string[]; skill_names: string[]; sectors: string[]; services: string[]; modes: string[]; coverage: string[];
  visibility: Partial<Record<Section, boolean>>; witness_hidden: boolean; staff_only: StaffOnly; staff_note_ar: string | null; search_plain: string;
  submitted_at: string | null; approved_at: string | null; approved_by: string | null; suspended_at: string | null; card_expert: Card; card_trainer: Card; legacy_trainer_id: string | null; meta: Record<string, any>;
};
export const PROFILE_COLS = 'id,created_at,updated_at,user_id,email,status,faces,listed,slug,code,name_ar,name_en,title_ar,title_en,city,languages,photo_path,photo_public_path,photo_consent_at,summary_ar,summary_en,achievements,education,experience,certifications,publications,skill_ids,skill_names,sectors,services,modes,coverage,visibility,witness_hidden,staff_only,staff_note_ar,search_plain,submitted_at,approved_at,approved_by,suspended_at,card_expert,card_trainer,legacy_trainer_id,meta';
/** الحقول التي يحرّرها صاحب السيرة (لا status ولا الحقول المشتقة ولا حقول الطاقم) */
export const EDITABLE_FIELDS = ['faces', 'name_ar', 'name_en', 'title_ar', 'title_en', 'city', 'languages', 'summary_ar', 'summary_en', 'achievements', 'education', 'experience', 'certifications', 'publications', 'skill_ids', 'sectors', 'services', 'modes', 'coverage', 'visibility', 'witness_hidden'] as const;

export type EngagementStatus = 'proposed' | 'changes_requested' | 'active' | 'completed' | 'settled' | 'declined' | 'cancelled';
export const ENGAGEMENT_STATUS_AR: Record<EngagementStatus, string> = { proposed: 'بانتظار توقيعك', changes_requested: 'طلبتَ تعديلًا', active: 'موقَّع — جارٍ', completed: 'أُنجزت', settled: 'سُوّيت', declined: 'اعتذرتَ', cancelled: 'أُلغيت' };
export type EngagementKind = 'consult' | 'train';
export const ENGAGEMENT_KIND_AR: Record<EngagementKind, string> = { consult: 'استشارة', train: 'تدريب' };
export type Engagement = {
  id: string; created_at: string; updated_at: string; profile_id: string; user_id: string | null; email: string; kind: EngagementKind; consulting_request_id: string | null;
  title_ar: string; scope_ar: string; deliverables: string[]; start_at: string | null; end_at: string | null; mode: string | null; fee_amount: number | null; currency: string; terms_ar: string | null;
  status: EngagementStatus; change_note_ar: string | null; token: string; member_signed_at: string | null; athar_signed_at: string | null; completed_at: string | null; settled_at: string | null; code: string | null; vc_issuance_id: string | null; created_by: string | null; meta: Record<string, any>;
};
export const ENGAGEMENT_COLS = 'id,created_at,updated_at,profile_id,user_id,email,kind,consulting_request_id,title_ar,scope_ar,deliverables,start_at,end_at,mode,fee_amount,currency,terms_ar,status,change_note_ar,token,member_signed_at,athar_signed_at,completed_at,settled_at,code,vc_issuance_id,created_by,meta';

export const lower = (s: string | null | undefined) => String(s || '').trim().toLowerCase();
const str = (v: unknown, max: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const strs = (v: unknown, max: number, len: number) => Array.from(new Set(arr(v).map(x => str(x, len)).filter(Boolean))).slice(0, max);
export const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 864e5).toISOString();

/** تنقية ما أرسله صاحب السيرة إلى حقول قابلة للحفظ — لا يمسّ الحالة ولا حقول الطاقم */
export function sanitizeProfileInput(body: any): Partial<Profile> {
  const b = body || {};
  const faces = strs(b.faces, 2, 10).filter((f): f is Face => (FACES as string[]).includes(f));
  const vis: Partial<Record<Section, boolean>> = {}; if (b.visibility && typeof b.visibility === 'object') for (const s of SECTIONS) if (typeof b.visibility[s] === 'boolean') vis[s] = b.visibility[s];
  return {
    faces, name_ar: str(b.name_ar, NAME_MAX), name_en: str(b.name_en, NAME_MAX) || null, title_ar: str(b.title_ar, TITLE_MAX), title_en: str(b.title_en, TITLE_MAX) || null, city: str(b.city, CITY_MAX) || null,
    languages: strs(b.languages, LANGS_MAX, 12), summary_ar: String(b.summary_ar ?? '').trim().slice(0, SUMMARY_MAX), summary_en: String(b.summary_en ?? '').trim().slice(0, SUMMARY_MAX) || null,
    achievements: strs(b.achievements, ACHIEVEMENTS_MAX, ACHIEVEMENT_LEN),
    education: arr(b.education).map((e: any) => ({ degree: str(e?.degree, 80), field: str(e?.field, 120), institution: str(e?.institution, 120), year: str(e?.year, 9) })).filter(e => e.degree || e.institution).slice(0, EDUCATION_MAX),
    experience: arr(b.experience).map((e: any) => ({ role: str(e?.role, 120), organization: str(e?.organization, 120), from: str(e?.from, 9), to: str(e?.to, 12), line: str(e?.line, 240) })).filter(e => e.role || e.organization).slice(0, EXPERIENCE_MAX),
    certifications: arr(b.certifications).map((e: any) => ({ name: str(e?.name, 120), issuer: str(e?.issuer, 120), year: str(e?.year, 9), number: str(e?.number, 60) || undefined })).filter(e => e.name).slice(0, CERTS_MAX),
    publications: arr(b.publications).map((e: any) => ({ title: str(e?.title, 200), type: str(e?.type, 40), year: str(e?.year, 9), url: /^https?:\/\//i.test(String(e?.url || '')) ? str(e?.url, 300) : undefined })).filter(e => e.title).slice(0, PUBS_MAX),
    skill_ids: strs(b.skill_ids, SKILLS_MAX, 60), sectors: strs(b.sectors, SECTORS_MAX, 40), services: strs(b.services, SERVICES_MAX, 40).filter(s => (SERVICES as readonly string[]).includes(s)), modes: strs(b.modes, 3, 10).filter(m => (MODES as readonly string[]).includes(m)), coverage: strs(b.coverage, COVERAGE_MAX, 40),
    visibility: vis, witness_hidden: b.witness_hidden === true,
  };
}

/** أخطاء السيرة قبل الإرسال للاعتماد (مصفوفة فارغة = جاهزة) — الصورة والموافقة إلزاميتان بقرار المالك */
export function profileIssues(p: Partial<Profile>): string[] {
  const out: string[] = [];
  if (!(p.faces || []).length) out.push('اختر وجهًا واحدًا على الأقل: خبير استشاري أو مدرب');
  if (!str(p.name_ar, NAME_MAX)) out.push('الاسم بالعربية مطلوب');
  if (!str(p.title_ar, TITLE_MAX)) out.push('اللقب المهني مطلوب');
  const sum = String(p.summary_ar || '').trim(); if (sum.length < SUMMARY_MIN) out.push(`ملخص السيرة ${SUMMARY_MIN} حرفًا على الأقل (الآن ${sum.length})`);
  if ((p.skill_ids || []).length < SKILLS_MIN) out.push('اختر مجال خبرة واحدًا على الأقل من مهارات أَثَر');
  if ((p.sectors || []).length < SECTORS_MIN) out.push('اختر قطاعًا واحدًا على الأقل');
  if ((p.services || []).length < SERVICES_MIN) out.push('اختر خدمة واحدة على الأقل');
  if (!(p.modes || []).length) out.push('حدّد نمط التقديم (حضوري · عن بُعد · هجين)');
  if (!p.photo_path) out.push('الصورة إلزامية للاعتماد — ارفع صورة واضحة');
  if (p.photo_path && !p.photo_consent_at) out.push('وافق على ظهور صورتك في الدليل (الموافقة إلزامية للاعتماد)');
  return out;
}
export const canSubmit = (p: Partial<Profile>) => profileIssues(p).length === 0;

/** هل السيرة تُعرض علنًا؟ معتمدة + مدرجة + صورة بموافقة قائمة */
export const isPublic = (p: Profile) => p.status === 'approved' && p.listed && !!p.photo_consent_at && !!p.photo_public_path;
export const hasFace = (p: Profile, face: Face) => (p.faces || []).includes(face);
const vis = (p: Profile, s: Section) => (p.visibility?.[s] ?? DEFAULT_VISIBILITY[s]) !== false;

/** العرض العام — لا بريد · لا هاتف · لا staff_only · لا search_plain · لا meta؛ كل قسم بمفتاحه */
export function publicView(p: Profile, publicUrl: (path: string) => string) {
  return {
    slug: p.slug, code: p.code, faces: p.faces, name_ar: p.name_ar, name_en: p.name_en, title_ar: p.title_ar, title_en: p.title_en,
    photo_url: vis(p, 'photo') && p.photo_consent_at && p.photo_public_path ? publicUrl(p.photo_public_path) : null,
    city: vis(p, 'city') ? p.city : null, languages: vis(p, 'languages') ? p.languages : [], coverage: vis(p, 'coverage') ? p.coverage : [],
    summary_ar: vis(p, 'summary') ? p.summary_ar : '', summary_en: vis(p, 'summary') ? p.summary_en : null,
    achievements: vis(p, 'achievements') ? p.achievements : [], education: vis(p, 'education') ? p.education : [], experience: vis(p, 'experience') ? p.experience : [],
    certifications: vis(p, 'certifications') ? p.certifications.map(c => ({ name: c.name, issuer: c.issuer, year: c.year })) : [], publications: vis(p, 'publications') ? p.publications : [],
    skill_ids: p.skill_ids, skill_names: p.skill_names, sectors: p.sectors, services: p.services, modes: p.modes,
    approved_at: p.approved_at, updated_at: p.updated_at, cards: { expert: p.card_expert ? { code: p.card_expert.code, issued_at: p.card_expert.issued_at } : null, trainer: p.card_trainer ? { code: p.card_trainer.code, issued_at: p.card_trainer.issued_at } : null },
  };
}
/** بطاقة نتيجة بحث — أقل من الصفحة الكاملة */
export function cardView(p: Profile, publicUrl: (path: string) => string) {
  const v = publicView(p, publicUrl);
  return { slug: v.slug, faces: v.faces, name_ar: v.name_ar, title_ar: v.title_ar, photo_url: v.photo_url, city: v.city, skill_names: v.skill_names.slice(0, 3), sectors: v.sectors.slice(0, 2), services: v.services, modes: v.modes, updated_at: v.updated_at, cards: v.cards };
}
/** ما يراه صاحب السيرة عن نفسه: كل شيء إلا staff_only (ملاحظات الطاقم ووثائقه الداخلية ليست له) */
export function ownerView(p: Profile) { const { staff_only: _s, search_plain: _q, ...rest } = p; return { ...rest, issues: profileIssues(p), can_submit: canSubmit(p), is_public: isPublic(p) }; }

/** نصّ البحث — يُحسب عند الحفظ ويُخزَّن */
export function searchPlain(p: Partial<Profile>, skillNames: string[], sectorNames: string[]): string {
  const parts = [p.name_ar, p.name_en, p.title_ar, p.title_en, p.city, p.summary_ar, ...(p.achievements || []), ...skillNames, ...sectorNames, ...(p.services || []).map(s => SERVICE_AR[s as Service] || s), ...(p.coverage || [])];
  return parts.filter(Boolean).join(' · ').toLowerCase().replace(/[\u064B-\u0652\u0640]/g, '').slice(0, 6000);
}
export type SearchFilters = { q?: string; face?: Face | null; skill?: string; sector?: string; service?: string; mode?: string; city?: string };
const norm = (s: string) => s.toLowerCase().replace(/[\u064B-\u0652\u0640]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').trim();
/** مطابقة سيرة لمرشّحات البحث — في الذاكرة (المعتمدون قلّة لسنوات) */
export function matches(p: Profile, f: SearchFilters): boolean {
  if (!isPublic(p)) return false;
  if (f.face && !hasFace(p, f.face)) return false;
  if (f.skill && !p.skill_ids.includes(f.skill)) return false;
  if (f.sector && !p.sectors.includes(f.sector)) return false;
  if (f.service && !p.services.includes(f.service)) return false;
  if (f.mode && !p.modes.includes(f.mode)) return false;
  if (f.city && !norm(String(p.city || '')).includes(norm(f.city)) && !p.coverage.some(c => norm(c).includes(norm(f.city!)))) return false;
  const q = norm(String(f.q || '').slice(0, SEARCH_Q_MAX)); if (!q) return true;
  const hay = norm(p.search_plain || ''); return q.split(/\s+/).filter(Boolean).every(w => hay.includes(w));
}
/** الترتيب: أحدث تحديث ثم أبجديًا — لا تفضيل */
export function sortProfiles(list: Profile[]): Profile[] { return [...list].sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || '') || (a.name_ar || '').localeCompare(b.name_ar || '', 'ar')); }
export function search(all: Profile[], f: SearchFilters, page = 1): { items: Profile[]; total: number; page: number; pages: number } {
  const hits = sortProfiles(all.filter(p => matches(p, f))); const pages = Math.max(1, Math.ceil(hits.length / SEARCH_PAGE)); const pg = Math.min(Math.max(1, page), pages);
  return { items: hits.slice((pg - 1) * SEARCH_PAGE, pg * SEARCH_PAGE), total: hits.length, page: pg, pages };
}

/** «ما شهده أَثَر» — من الأعداد إلى أسطر؛ لا تُحرَّر */
export type WitnessFacts = {
  programs: number; classrooms: number; program_years: [string, string] | null;
  councils_chaired: number; attestations_approved: number; levels_approved: number; missions_confirmed: number;
  engagements_consult: number; engagements_train: number; engagement_years: [string, string] | null; org_charter: string | null;
};
export const EMPTY_WITNESS: WitnessFacts = { programs: 0, classrooms: 0, program_years: null, councils_chaired: 0, attestations_approved: 0, levels_approved: 0, missions_confirmed: 0, engagements_consult: 0, engagements_train: 0, engagement_years: null, org_charter: null };
const n2 = (n: number, one: string, two: string, many: string, acc: string) => n === 1 ? one : n === 2 ? two : n >= 3 && n <= 10 ? `${n} ${many}` : `${n} ${acc}`;
const span = (y: [string, string] | null) => y ? (y[0] === y[1] ? `في ${y[0]}` : `بين ${y[0]} و${y[1]}`) : '';
export function witnessLines(f: WitnessFacts): { key: string; text: string }[] {
  const out: { key: string; text: string }[] = [];
  if (f.programs > 0) out.push({ key: 'programs', text: `قدّم ${n2(f.programs, 'برنامجًا تدريبيًّا واحدًا', 'برنامجين تدريبيَّين', 'برامج تدريبية', 'برنامجًا تدريبيًّا')}${f.classrooms > f.programs ? ` (${f.classrooms} شعبة)` : ''} ${span(f.program_years)}`.trim() });
  if (f.councils_chaired > 0) out.push({ key: 'councils', text: `يسّر ${n2(f.councils_chaired, 'مجلس أقران واحدًا', 'مجلسَي أقران', 'مجالس أقران', 'مجلس أقران')}` });
  if (f.attestations_approved > 0) out.push({ key: 'attestations', text: `اعتمد ${n2(f.attestations_approved, 'شهادة قرين واحدة', 'شهادتَي قرين', 'شهادات قرين', 'شهادة قرين')}` });
  if (f.levels_approved > 0) out.push({ key: 'levels', text: `اعتمد ${n2(f.levels_approved, 'مستوى مهارة واحدًا', 'مستويَي مهارة', 'مستويات مهارة', 'مستوى مهارة')} لممارسين` });
  if (f.missions_confirmed > 0) out.push({ key: 'missions', text: `أكّد بصفته مشرفًا ${n2(f.missions_confirmed, 'مهمة واحدة من قلب العمل', 'مهمتين من قلب العمل', 'مهام من قلب العمل', 'مهمة من قلب العمل')}` });
  const eng = f.engagements_consult + f.engagements_train;
  if (eng > 0) { const parts = [f.engagements_consult ? n2(f.engagements_consult, 'استشارة واحدة', 'استشارتان', 'استشارات', 'استشارة') : '', f.engagements_train ? n2(f.engagements_train, 'تدريب واحد', 'تدريبان', 'تدريبات', 'تدريبًا') : ''].filter(Boolean).join(' و'); out.push({ key: 'engagements', text: `نفّذ ${n2(eng, 'مهمة واحدة', 'مهمتين', 'مهام', 'مهمة')} بعقود تعاون مع أَثَر (${parts}) ${span(f.engagement_years)}`.trim() }); }
  if (f.org_charter) out.push({ key: 'charter', text: `جهته «${f.org_charter}» وقّعت ميثاق أَثَر` });
  return out;
}
export const WITNESS_EMPTY_AR = 'لم تشهد المنصة بعد عملًا له — سيرته هنا بكلماته.';
export const witnessCounts = (f: WitnessFacts) => ({ programs: f.programs, councils: f.councils_chaired, attestations: f.attestations_approved, levels: f.levels_approved, missions: f.missions_confirmed, engagements: f.engagements_consult + f.engagements_train });

/** الرموز */
export const memberCode = (rnd: () => string = () => randomCode(4)) => `${CODE_PREFIX_MEMBER}-${rnd()}-${rnd()}`;
export const cardCode = (face: Face, rnd: () => string = () => randomCode(4)) => `${face === 'expert' ? CODE_PREFIX_EXPERT : CODE_PREFIX_TRAINER}-${rnd()}-${rnd()}`;
export const collabCode = (rnd: () => string = () => randomCode(4)) => `${CODE_PREFIX_COLLAB}-${rnd()}-${rnd()}`;
/** معرّف الصفحة: من الاسم اللاتيني إن وُجد وإلا member + 4 أحرف من الرمز */
export function slugFor(p: Pick<Profile, 'name_en' | 'code'>, rnd: () => string = () => randomCode(4)): string {
  const base = String(p.name_en || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'member';
  const tail = (p.code ? p.code.split('-').pop() : rnd()) || rnd(); return `${base}-${tail.toLowerCase()}`;
}
export const photoExt = (mime: string) => mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
export const privatePhotoPath = (userId: string, mime: string) => `directory/${userId}/photo-${Date.now().toString(36)}.${photoExt(mime)}`;
export const publicPhotoPath = (slug: string, mime: string) => `directory/${slug}.${photoExt(mime)}`;
export const mimeOfPath = (path: string) => path.endsWith('.png') ? 'image/png' : path.endsWith('.webp') ? 'image/webp' : 'image/jpeg';

/** عقد التعاون — التحقق من نموذج الطاقم */
export function sanitizeEngagementInput(b: any) {
  return {
    kind: (b?.kind === 'train' ? 'train' : 'consult') as EngagementKind, title_ar: str(b?.title_ar, ENGAGEMENT_TITLE_MAX), scope_ar: String(b?.scope_ar ?? '').trim().slice(0, ENGAGEMENT_SCOPE_MAX),
    deliverables: strs(b?.deliverables, DELIVERABLES_MAX, 200), start_at: /^\d{4}-\d{2}-\d{2}$/.test(String(b?.start_at || '')) ? String(b.start_at) : null, end_at: /^\d{4}-\d{2}-\d{2}$/.test(String(b?.end_at || '')) ? String(b.end_at) : null,
    mode: (MODES as readonly string[]).includes(String(b?.mode || '')) ? String(b.mode) : null, fee_amount: Number.isFinite(Number(b?.fee_amount)) && Number(b.fee_amount) >= 0 ? Math.round(Number(b.fee_amount) * 100) / 100 : null,
    currency: /^[A-Z]{3}$/.test(String(b?.currency || '')) ? String(b.currency) : 'SAR', terms_ar: String(b?.terms_ar ?? '').trim().slice(0, ENGAGEMENT_TERMS_MAX) || null, consulting_request_id: typeof b?.consulting_request_id === 'string' && b.consulting_request_id ? b.consulting_request_id : null,
  };
}
export function engagementIssues(e: ReturnType<typeof sanitizeEngagementInput>): string | null {
  if (!e.title_ar) return 'عنوان المهمة مطلوب'; if (e.scope_ar.length < 20) return 'نطاق المهمة 20 حرفًا على الأقل';
  if (e.start_at && e.end_at && e.end_at < e.start_at) return 'تاريخ النهاية قبل البداية'; if (e.fee_amount === null) return 'حدّد أجر هذا المشروع (0 مقبول للتطوعي)';
  return null;
}
/** انتقالات عضو الهيئة */
export function memberTransition(e: Engagement, action: 'sign' | 'decline' | 'change'): string | null {
  if (e.status !== 'proposed') return 'العقد ليس بانتظار توقيعك';
  if (action === 'change' && Number(e.meta?.changes || 0) >= 1) return 'طُلب التعديل مرة واحدة من قبل — وقّع أو اعتذر';
  return null;
}
/** انتقالات الطاقم */
export function staffTransition(e: Engagement, action: 'update' | 'complete' | 'settle' | 'cancel'): string | null {
  switch (action) {
    case 'update': return e.status === 'proposed' || e.status === 'changes_requested' ? null : 'لا يُعدَّل عقد بعد توقيعه';
    case 'complete': return e.status === 'active' ? null : 'الإنجاز لعقد موقَّع جارٍ فقط';
    case 'settle': return e.status === 'completed' ? null : 'التسوية بعد الإنجاز فقط';
    case 'cancel': return ['proposed', 'changes_requested', 'active'].includes(e.status) ? null : 'لا يُلغى عقد منجَز أو مسوًّى';
  }
}
/** ما يراه العضو من عقده (الأجر له لأنه طرف) — لا created_by */
export function engagementMemberView(e: Engagement, site: string) { const { created_by: _c, meta: _m, token: _t, ...v } = e; return { ...v, status_ar: ENGAGEMENT_STATUS_AR[e.status], kind_ar: ENGAGEMENT_KIND_AR[e.kind], changes_left: Math.max(0, 1 - Number(e.meta?.changes || 0)), verify_url: e.code && e.vc_issuance_id ? `${site}/verify/vc?code=${encodeURIComponent(e.code)}` : null }; }
/** أعداد العقود المنجَزة بحسب النوع (لـ«ما شهده أَثَر») */
export function engagementFacts(rows: Pick<Engagement, 'kind' | 'status' | 'completed_at'>[]): Pick<WitnessFacts, 'engagements_consult' | 'engagements_train' | 'engagement_years'> {
  const done = rows.filter(r => (r.status === 'completed' || r.status === 'settled') && r.completed_at); const ys = done.map(r => String(r.completed_at).slice(0, 4)).sort();
  return { engagements_consult: done.filter(r => r.kind === 'consult').length, engagements_train: done.filter(r => r.kind === 'train').length, engagement_years: ys.length ? [ys[0], ys[ys.length - 1]] : null };
}
/** سيرة مسبقة التعبئة لمدرب منصة التقييم القائمة */
export function prefillFromLegacyTrainer(t: { id: string; name: string | null; email: string | null }, facts: WitnessFacts): Partial<Profile> {
  return { faces: ['trainer'], name_ar: String(t.name || '').trim().slice(0, NAME_MAX), title_ar: 'مدرب في أَثَر', legacy_trainer_id: t.id, summary_ar: facts.programs ? `مدرب في أَثَر: ${witnessLines({ ...EMPTY_WITNESS, programs: facts.programs, classrooms: facts.classrooms, program_years: facts.program_years })[0].text}.` : '' };
}
export const summaryOf = (p: Profile | null, legacy: boolean) => ({ version: DIRECTORY_VERSION, status: p?.status || null, faces: p?.faces || [], listed: !!p?.listed, legacy_trainer: legacy, slug: p && isPublic(p) ? p.slug : null });
