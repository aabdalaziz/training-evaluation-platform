// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// بوابة أَثَر — الملف المهاري: احتساب مستويات المهارات من الأدلة، الشهادات الرقمية (Open Badges 3.0)، المشاركة، Excel
import type { Lang, T } from './content';
import { t } from './content';
import type { Skill } from './skills';
import { levelRank } from './placement';

// ---------- الأدلة والأوزان (القرار 1: مؤشر محسوب + اعتماد يدوي) ----------
export type EvidenceKind = 'placement' | 'program_completed' | 'activity' | 'attended' | 'credential' | 'viewed' | 'simulation' | 'daily';
export const EVIDENCE_WEIGHT: Record<EvidenceKind, number> = { placement: 1.0, credential: 0.9, program_completed: 0.8, simulation: 0.45, activity: 0.4, attended: 0.3, daily: 0.15, viewed: 0.1 };
/** وزن المحاكاة بعد اعتماد مدرب بشري (P10) */
export const SIMULATION_APPROVED_WEIGHT = 0.7;
export const EVIDENCE_LABEL: Record<EvidenceKind, T> = {
  placement: { ar: 'اختبار مِعيار', en: 'Mi‘yar placement test' }, credential: { ar: 'شهادة رقمية', en: 'Digital credential' }, program_completed: { ar: 'إتمام برنامج', en: 'Program completion' },
  activity: { ar: 'نشاط تقويمي', en: 'Assessment activity' }, attended: { ar: 'حضور جلسة', en: 'Session attendance' }, viewed: { ar: 'اطلاع على مادة', en: 'Resource engagement' },
  simulation: { ar: 'محاكاة أداء', en: 'Performance simulation' }, daily: { ar: 'تحدّي «كل يوم مهارة»', en: 'Daily skill challenge' },
};
export type LearningEventRow = { id?: number | string; at: string; user_id?: string | null; email?: string | null; verb: string; object_type: string; object_id: string; skills: string[]; context?: Record<string, any> | null };
export type Evidence = { kind: EvidenceKind; verb: string; object_type: string; object_id: string; level: number; weight: number; at: string; label?: string };
export type SkillLevelRow = { user_id: string; skill_id: string; computed_level: number; confidence: number; evidence: Evidence[]; approved_level?: number | null; approved_by?: string | null; approved_at?: string | null; approved_note?: string | null; updated_at?: string };

/** CEFR → مستوى أَثَر 1–5 (A1=1, A2=2, B1=3, B2=4, C1/C2=5) */
export function cefrToLevel(cefr: string | null | undefined): number | null { const r = levelRank(cefr); return r < 0 ? null : Math.min(5, r + 1); }
export function percentToLevel(pct: number, base: number): number { const b = Math.max(1, Math.min(5, base || 3)); if (pct >= 85) return Math.min(5, b + 1); if (pct >= 60) return b; if (pct >= 40) return Math.max(1, b - 1); return Math.max(1, b - 2); }

/** يحوّل حدث تعلّم إلى دليل لكل مهارة فيه */
export function evidenceFromEvent(ev: LearningEventRow, skillMeta: Map<string, Pick<Skill, 'level' | 'code'>>): { skill_id: string; e: Evidence }[] {
  const out: { skill_id: string; e: Evidence }[] = []; const ctx = ev.context || {};
  for (const sid of ev.skills || []) {
    const meta = skillMeta.get(sid); const base = meta?.level || 3; let kind: EvidenceKind | null = null; let level: number | null = null; let label = '';
    if (ev.verb === 'assessed' && ev.object_type === 'placement') {
      kind = 'placement';
      const code = meta?.code || ''; const sk = ctx.skills || {}; const per = code === 'ATH-AR-004' ? sk.listening : code === 'ATH-AR-005' ? sk.reading : code === 'ATH-AR-006' ? sk.grammar_vocab : null;
      level = cefrToLevel(per?.level) ?? cefrToLevel(ctx.level); label = per ? `${per.level} · ${per.percent}%` : String(ctx.level || '');
    } else if (ev.verb === 'assessed' && ev.object_type === 'activity') { kind = 'activity'; const sc = Number(ctx.score); if (Number.isFinite(sc)) { level = ctx.kind === 'self_rating' ? Math.max(1, Math.round(sc / 20)) : percentToLevel(sc, base); label = `${Math.round(sc)}%`; } }
    else if (ev.verb === 'assessed' && ev.object_type === 'simulation') { if (ctx.rejected) continue; kind = 'simulation'; const sc = Number(ctx.score); if (Number.isFinite(sc)) { level = percentToLevel(sc, base); label = `${Math.round(sc)}% · ${String(ctx.title || ctx.scenario || '')}${ctx.approved ? ' ✓' : ''}`; } }
    else if (ev.verb === 'assessed' && ev.object_type === 'daily') { kind = 'daily'; const sc = Number(ctx.score); level = Number.isFinite(sc) && sc >= 60 ? base : Math.max(1, base - 1); label = String(ctx.day || ''); }
    else if (ev.verb === 'completed' && ev.object_type === 'program') { kind = 'program_completed'; level = base; label = String(ctx.program_name || ''); }
    else if (ev.verb === 'issued' && ev.object_type === 'credential') { kind = 'credential'; level = cefrToLevel(ctx.level) ?? base; label = String(ctx.title || ''); }
    else if (ev.verb === 'attended' || (ev.verb === 'joined' && ev.object_type === 'session')) { kind = 'attended'; level = base; }
    else if (['viewed', 'downloaded', 'registered'].includes(ev.verb)) { kind = 'viewed'; level = Math.max(1, base - 1); }
    if (kind && level !== null) out.push({ skill_id: sid, e: { kind, verb: ev.verb, object_type: ev.object_type, object_id: ev.object_id, level: Math.max(1, Math.min(5, level)), weight: kind === 'simulation' && ctx.approved ? SIMULATION_APPROVED_WEIGHT : EVIDENCE_WEIGHT[kind], at: ev.at, label } });
  }
  return out;
}

/** يحسب مستوى كل مهارة: متوسط مرجّح للأدلة (الأحدث أثقل قليلًا) + ثقة = مجموع الأوزان × 25 (سقف 100) */
export function computeSkillLevels(userId: string, events: LearningEventRow[], skillMeta: Map<string, Pick<Skill, 'level' | 'code'>>, now = new Date()): Omit<SkillLevelRow, 'approved_level' | 'approved_by' | 'approved_at' | 'approved_note'>[] {
  const bySkill = new Map<string, Evidence[]>();
  for (const ev of events) for (const { skill_id, e } of evidenceFromEvent(ev, skillMeta)) { if (!bySkill.has(skill_id)) bySkill.set(skill_id, []); bySkill.get(skill_id)!.push(e); }
  const out: Omit<SkillLevelRow, 'approved_level' | 'approved_by' | 'approved_at' | 'approved_note'>[] = [];
  for (const [skill_id, list] of bySkill) {
    // دليل واحد لكل (نوع، كائن) — الأحدث
    const uniq = new Map<string, Evidence>(); for (const e of [...list].sort((a, b) => a.at.localeCompare(b.at))) uniq.set(`${e.kind}:${e.object_id}`, e);
    const evs = Array.from(uniq.values()).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 30);
    let wsum = 0, lsum = 0;
    for (const e of evs) { const ageDays = Math.max(0, (now.getTime() - new Date(e.at).getTime()) / 86400000); const recency = ageDays > 365 ? 0.6 : ageDays > 180 ? 0.8 : 1; const w = e.weight * recency; wsum += w; lsum += e.level * w; }
    const computed = wsum ? Math.round((lsum / wsum) * 100) / 100 : 0; const confidence = Math.min(100, Math.round(wsum * 25));
    out.push({ user_id: userId, skill_id, computed_level: computed, confidence, evidence: evs, updated_at: now.toISOString() });
  }
  return out.sort((a, b) => b.computed_level - a.computed_level);
}
export function displayLevel(r: Pick<SkillLevelRow, 'computed_level' | 'approved_level'>): number { return r.approved_level ?? Math.round(r.computed_level); }
export const LEVEL_NAME: Record<number, T> = { 1: { ar: 'أساسي', en: 'Foundation' }, 2: { ar: 'مبتدئ متقدم', en: 'Developing' }, 3: { ar: 'متوسط', en: 'Intermediate' }, 4: { ar: 'متقدم', en: 'Advanced' }, 5: { ar: 'خبير', en: 'Expert' } };
export function levelName(n: number, lang: Lang): string { return t(LEVEL_NAME[Math.max(1, Math.min(5, Math.round(n)))] || LEVEL_NAME[1], lang); }
export function confidenceLabel(c: number, lang: Lang): string { return c >= 70 ? (lang === 'ar' ? 'أدلة قوية' : 'Strong evidence') : c >= 35 ? (lang === 'ar' ? 'أدلة متوسطة' : 'Moderate evidence') : (lang === 'ar' ? 'أدلة أولية' : 'Early evidence'); }

// ---------- المعرّفات والرموز ----------
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function randomCode(len: number, rnd: () => number = Math.random): string { let s = ''; for (let i = 0; i < len; i++) s += ALPHA[Math.floor(rnd() * ALPHA.length)]; return s; }
export const verifyCode = (rnd?: () => number) => `ATH-${randomCode(4, rnd)}-${randomCode(4, rnd)}`;
export const publicId = (rnd?: () => number) => randomCode(8, rnd).toLowerCase();

// ---------- الشهادات الرقمية ----------
export type CredentialKind = 'program_completion' | 'skill' | 'attendance' | 'placement';
export type Credential = { id: string; created_at?: string; user_id?: string | null; email: string; full_name?: string | null; kind: CredentialKind; title_ar: string; title_en?: string | null; description_ar?: string | null; program_id?: string | null; session_id?: string | null; skills: string[]; level?: string | null; hours?: number | null; verify_code: string; issued_at: string; valid_until?: string | null; revoked_at?: string | null; revoke_reason?: string | null; badge?: Record<string, unknown> };
export const CREDENTIAL_KINDS: { value: CredentialKind; label: T }[] = [
  { value: 'program_completion', label: { ar: 'إتمام برنامج', en: 'Program completion' } }, { value: 'skill', label: { ar: 'إثبات مهارة', en: 'Skill credential' } },
  { value: 'attendance', label: { ar: 'حضور جلسة/ندوة', en: 'Attendance' } }, { value: 'placement', label: { ar: 'مستوى لغوي (مِعيار)', en: 'Language level (Mi‘yar)' } },
];
export const credentialKindLabel = (v: string, lang: Lang) => { const x = CREDENTIAL_KINDS.find(k => k.value === v); return x ? t(x.label, lang) : v; };
export function credentialTitle(c: Pick<Credential, 'title_ar' | 'title_en'>, lang: Lang): string { return (lang === 'en' && c.title_en) ? c.title_en : c.title_ar; }
export function credentialStatus(c: Pick<Credential, 'revoked_at' | 'valid_until'>, now = new Date()): 'valid' | 'revoked' | 'expired' { if (c.revoked_at) return 'revoked'; if (c.valid_until && new Date(c.valid_until) < now) return 'expired'; return 'valid'; }

/** Open Badges 3.0 — VerifiableCredential (حد أدنى متوافق) */
export function buildBadge(c: Omit<Credential, 'badge'>, skills: Pick<Skill, 'id' | 'code' | 'name_ar' | 'name_en' | 'saqf_level' | 'cefr_level' | 'sdaia_code'>[], site: string) {
  const url = `${site}/credential/${c.verify_code}`;
  return {
    '@context': ['https://www.w3.org/ns/credentials/v2', 'https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json'],
    id: url, type: ['VerifiableCredential', 'OpenBadgeCredential'], name: c.title_en || c.title_ar,
    issuer: { id: `${site}/.well-known/athar.json`, type: ['Profile'], name: 'Athar · TRACE — Education, Training & Development Portal', url: site },
    validFrom: c.issued_at, ...(c.valid_until ? { validUntil: c.valid_until } : {}),
    credentialSubject: { type: ['AchievementSubject'], identifier: [{ type: 'IdentityObject', identityType: 'emailAddress', hashed: false, identityHash: c.email }],
      achievement: { id: `${site}/credential/${c.verify_code}#achievement`, type: ['Achievement'], name: c.title_en || c.title_ar, description: c.description_ar || c.title_ar, achievementType: c.kind === 'program_completion' ? 'Certificate' : c.kind === 'skill' ? 'Competency' : c.kind === 'placement' ? 'Assessment' : 'Badge',
        criteria: { narrative: c.kind === 'program_completion' ? 'Completed the program with ≥80% attendance and the final evaluation.' : c.kind === 'placement' ? 'Achieved the stated CEFR level in the Mi‘yar adaptive placement test.' : 'Evidence recorded in the Athar learning record.' },
        ...(c.level ? { fieldOfStudy: c.level } : {}),
        alignment: skills.map(s => ({ type: ['Alignment'], targetName: s.name_en, targetCode: s.code, targetDescription: s.name_ar, targetFramework: s.saqf_level ? `SAQF level ${s.saqf_level}` : s.cefr_level ? `CEFR ${s.cefr_level}` : s.sdaia_code ? `SDAIA ${s.sdaia_code}` : 'Athar skills taxonomy', targetUrl: `${site}/resources?skill=${s.id}` })) },
      ...(c.hours ? { activityEndDate: c.issued_at, creditsEarned: c.hours } : {}) },
    evidence: [{ type: ['Evidence'], id: url, name: 'Verification page', narrative: 'Verify this credential on the Athar portal.' }],
  };
}
export type IssueForm = { kind: CredentialKind; title_ar: string; title_en: string; description_ar: string; program_id: string; skills: string[]; level: string; hours: string; valid_years: string };
export const EMPTY_ISSUE: IssueForm = { kind: 'program_completion', title_ar: '', title_en: '', description_ar: '', program_id: '', skills: [], level: '', hours: '', valid_years: '' };
export function validateIssue(f: IssueForm, recipients: number): string | null {
  if (f.title_ar.trim().length < 4) return 'عنوان الشهادة مطلوب';
  if (f.kind === 'program_completion' && !f.program_id) return 'اختر البرنامج';
  if (f.kind === 'skill' && !f.skills.length) return 'اختر مهارة واحدة على الأقل';
  if (f.hours && !(Number(f.hours) > 0)) return 'الساعات رقم موجب';
  if (f.valid_years && !(Number(f.valid_years) > 0 && Number(f.valid_years) <= 10)) return 'الصلاحية بين 1 و10 سنوات';
  if (recipients < 1) return 'لا مستلمين';
  return null;
}
/** أهلية إتمام البرنامج: حضور ≥ 80% (إن وُجدت جلسات) */
export function completionEligible(att: { sessions: number; present: number }): boolean { return att.sessions === 0 ? true : att.present / att.sessions >= 0.8; }

// ---------- المشاركة ----------
export type ShareMode = 'private' | 'link' | 'public';
export const SHARE_MODES: { value: ShareMode; label: T; hint: T }[] = [
  { value: 'private', label: { ar: 'خاص', en: 'Private' }, hint: { ar: 'لا أحد يرى ملفك غيرك', en: 'Only you can see your profile' } },
  { value: 'link', label: { ar: 'برابط خاص', en: 'Link only' }, hint: { ar: 'يراه من يملك الرابط فقط (غير مفهرس)', en: 'Visible to anyone with the link (not indexed)' } },
  { value: 'public', label: { ar: 'عام', en: 'Public' }, hint: { ar: 'قابل للاكتشاف والفهرسة', en: 'Discoverable and indexable' } },
];

// ---------- Excel ----------
export function credentialsSheet(rows: Credential[], programs: Map<string, string>) {
  const header = ['تاريخ الإصدار', 'الاسم', 'البريد', 'النوع', 'العنوان', 'البرنامج', 'المستوى', 'الساعات', 'رمز التحقق', 'الحالة', 'صالحة حتى'];
  return { name: 'الشهادات الرقمية', rtl: true, widths: [12, 24, 30, 16, 40, 30, 10, 8, 16, 10, 12], rows: [header, ...rows.map(c => [c.issued_at.slice(0, 10), c.full_name || '', c.email, credentialKindLabel(c.kind, 'ar'), c.title_ar, programs.get(c.program_id || '') || '', c.level || '', c.hours ?? '', c.verify_code, credentialStatus(c) === 'valid' ? 'سارية' : credentialStatus(c) === 'revoked' ? 'ملغاة' : 'منتهية', (c.valid_until || '').slice(0, 10)])] };
}
export function skillLevelsSheet(rows: (SkillLevelRow & { skill?: Pick<Skill, 'code' | 'name_ar' | 'domain'> | null; email?: string })[]) {
  const header = ['البريد', 'الرمز', 'المهارة', 'المجال', 'المستوى المحسوب', 'الثقة', 'المستوى المعتمد', 'عدد الأدلة', 'آخر تحديث'];
  return { name: 'مستويات المهارات', rtl: true, widths: [30, 14, 34, 18, 12, 8, 12, 10, 12], rows: [header, ...rows.map(r => [r.email || '', r.skill?.code || '', r.skill?.name_ar || '', r.skill?.domain || '', r.computed_level, r.confidence, r.approved_level ?? '', r.evidence.length, (r.updated_at || '').slice(0, 10)])] };
}
