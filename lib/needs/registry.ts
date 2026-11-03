// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P44 «البرنامج الذي لم يُكتب بعد» — الاحتياج التدريبي المعلَن (دوال صافية، بلا اعتماديات)
 *  الكتالوج يُكتب من الحاجة لا من المكتب: ممارس يكتب حاجته بجملة؛ حين يقول خمسة غيره «وأنا أيضًا» تظهر للعالم بلا أسماء؛
 *  عضو في هيئة أَثَر يتبنّاها ويصمّمها في هندسة البرامج؛ الطاقم يعتمد؛ ويولد البرنامج وعلى صفحته «وُلد من حاجة أعلنها N ممارسًا» — ولهم المقاعد الأولى.
 *  الذكاء الاصطناعي لا يكتب الحاجة ولا يتبنّاها ولا يعتمدها؛ يقترح في هندسة البرامج فقط (القائم).
 */
import { scrubPii, cleanText } from '../onair/registry';
import { bandAr } from '../after/registry';

export const P44_NAMES_AR = {
  phase: 'البرنامج الذي لم يُكتب بعد', official: 'الاحتياج التدريبي المعلَن', page: 'ما يحتاجه الممارسون', mine: 'حاجاتي',
  me_too: 'وأنا أيضًا', adopt: 'أتبنّى هذه الحاجة', org: 'جهة تحتاج', born: 'وُلد من حاجة', waiting: 'لم تجد كاتبها بعد', seed: 'تنتظر خمسة',
} as const;
export const NEED_MIN = 20; export const NEED_MAX = 200; export const PITCH_MAX = 600;
export const NEED_K = 5;                     // خمسة غير الكاتب → تُعلَن
export const FOLD_DAYS = 90;                 // بلا متبنٍّ 90 يومًا → تُطوى بهدوء (قابلة للإحياء)
export const PRIORITY_HOURS = 72;            // المقاعد الأولى لكاتب الحاجة ومؤيّديها
export const QUESTION_AR = 'ما الذي تحتاج أن تتدرّب عليه ولا تجده؟';
export const HINT_AR = 'جملة واحدة بلا أسماء — ستبقى بين المسجَّلين حتى يقول خمسة غيرك «وأنا أيضًا»، ثم تُعلَن للعالم بلا اسمك.';

export const SOURCES = ['practitioner', 'station', 'org', 'offer'] as const;
export type NeedSource = (typeof SOURCES)[number];
export const SOURCE_AR: Record<NeedSource, string> = { practitioner: 'ممارس', station: 'من محطة بعد البرنامج', org: 'جهة', offer: 'من ورشة تطبيق' };
export const STATUSES = ['seed', 'open', 'adopted', 'born', 'folded', 'withdrawn', 'merged'] as const;
export type NeedStatus = (typeof STATUSES)[number];
export const STATUS_AR: Record<NeedStatus, string> = { seed: 'تنتظر خمسة', open: 'تنتظر كاتبها', adopted: 'تبنّاها كاتب', born: 'وُلد منها برنامج', folded: 'لم تجد كاتبها بعد', withdrawn: 'سحبها صاحبها', merged: 'ضُمّت إلى حاجة أخرى' };
export const PUBLIC_STATUSES: NeedStatus[] = ['open', 'adopted', 'born'];

export type NeedRow = {
  id: string; created_at: string; user_id: string | null; email: string; sector: string; text_ar: string; source: NeedSource; source_ref: string | null;
  organization_id: string | null; org_named: boolean; status: NeedStatus; supports: number; opened_at: string | null;
  adopter_user_id: string | null; adopter_email: string | null; adopter_kind: 'faculty' | 'staff' | null; adopter_name_ar: string | null; pitch_ar: string | null; adopted_at: string | null;
  draft_id: string | null; program_id: string | null; born_at: string | null; priority_until: string | null; folded_at: string | null; revived_at: string | null; withdrawn_at: string | null; merged_into: string | null;
};
export const NEED_COLS = 'id,created_at,user_id,email,sector,text_ar,source,source_ref,organization_id,org_named,status,supports,opened_at,adopter_user_id,adopter_email,adopter_kind,adopter_name_ar,pitch_ar,adopted_at,draft_id,program_id,born_at,priority_until,folded_at,revived_at,withdrawn_at,merged_into';

/** تنظيف نصّ الحاجة: حدود الطول + حجب البريد/الهاتف */
export function cleanNeed(b: any, sectors: readonly string[]): { ok: true; n: { sector: string; text_ar: string } } | { ok: false; error: string } {
  const sector = String(b?.sector || '').trim(); if (!sectors.includes(sector)) return { ok: false, error: 'اختر القطاع' };
  const text = scrubPii(cleanText(b?.text_ar, NEED_MAX)); if (text.length < NEED_MIN) return { ok: false, error: `اكتب حاجتك في ${NEED_MIN} حرفًا على الأقل` };
  return { ok: true, n: { sector, text_ar: text } };
}
export function cleanPitch(s: unknown): string { return scrubPii(cleanText(s, PITCH_MAX)); }

/** شرائح الكلمات بدل العدّادات التنافسية */
export function supportsBandAr(n: number): string {
  if (n <= 0) return 'لم يؤيّدها أحد بعد'; if (n < NEED_K) return `أيّدها ${n === 1 ? 'واحد' : n === 2 ? 'اثنان' : n} — تنتظر خمسة`;
  if (n < 10) return 'أيّدها خمسة إلى تسعة'; if (n < 25) return 'أيّدها عشرة إلى أربعة وعشرين'; if (n < 50) return 'أيّدها خمسة وعشرون إلى خمسين'; return 'أيّدها أكثر من خمسين';
}
export function bornLineAr(supports: number, sectorAr: string | null): string {
  const n = supports + 1;   // الكاتب + المؤيّدون
  return `وُلد هذا البرنامج من حاجة أعلنها ${n === 1 ? 'ممارس واحد' : n === 2 ? 'ممارسان' : n <= 10 ? `${n} ممارسين` : `${n} ممارسًا`}${sectorAr ? ` في ${sectorAr}` : ''} — لا من مكتب.`;
}

/** هل تُرى الحاجة؟ العامة: المعلَنة؛ المسجَّل: + البذور؛ صاحبها/الطاقم: كل شيء */
export function visibleTo(n: Pick<NeedRow, 'status' | 'email' | 'user_id'>, me: { id?: string | null; email?: string; staff?: boolean } | null): boolean {
  if (PUBLIC_STATUSES.includes(n.status)) return true;
  if (!me) return false;
  if (me.staff) return true;
  const mine = (me.id && n.user_id === me.id) || (me.email && n.email.toLowerCase() === me.email.toLowerCase());
  if (mine) return true;
  return n.status === 'seed';
}
export function isMine(n: Pick<NeedRow, 'email' | 'user_id'>, me: { id?: string | null; email?: string }): boolean {
  return !!((me.id && n.user_id === me.id) || (me.email && n.email.toLowerCase() === me.email.toLowerCase()));
}
export function canSupport(n: Pick<NeedRow, 'status' | 'email' | 'user_id'>, me: { id?: string | null; email?: string }, already: boolean): { ok: true } | { ok: false; error: string } {
  if (isMine(n, me)) return { ok: false, error: 'هذه حاجتك — كاتبها محسوب معها' };
  if (!['seed', 'open', 'adopted'].includes(n.status)) return { ok: false, error: 'هذه الحاجة لم تعد مفتوحة للتأييد' };
  if (already) return { ok: false, error: 'أيّدتها من قبل' };
  return { ok: true };
}
export function canAdopt(n: Pick<NeedRow, 'status'>, me: { faculty: boolean; staff: boolean }): { ok: true } | { ok: false; error: string } {
  if (!me.faculty && !me.staff) return { ok: false, error: 'التبنّي لأعضاء هيئة أَثَر المعتمَدين وللطاقم' };
  if (n.status !== 'open' && n.status !== 'seed') return { ok: false, error: n.status === 'adopted' ? 'تبنّاها كاتب من قبل' : 'هذه الحاجة ليست مفتوحة للتبنّي' };
  return { ok: true };
}
export function canWithdraw(n: Pick<NeedRow, 'status' | 'email' | 'user_id'>, me: { id?: string | null; email?: string }): { ok: true } | { ok: false; error: string } {
  if (!isMine(n, me)) return { ok: false, error: 'ليست حاجتك' };
  if (!['seed', 'open', 'folded'].includes(n.status)) return { ok: false, error: 'لا تُسحب بعد التبنّي' };
  return { ok: true };
}
export function canRevive(n: Pick<NeedRow, 'status' | 'email' | 'user_id'>, me: { id?: string | null; email?: string; staff?: boolean }): { ok: true } | { ok: false; error: string } {
  if (n.status !== 'folded') return { ok: false, error: 'ليست مطويّة' };
  if (!me.staff && !isMine(n, me)) return { ok: false, error: 'ليست حاجتك' };
  return { ok: true };
}
/** الطيّ الهادئ: بذرة أو معلَنة بلا متبنٍّ منذ 90 يومًا (من الإنشاء أو آخر إحياء) */
export function shouldFold(n: Pick<NeedRow, 'status' | 'created_at' | 'revived_at'>, now = new Date(), days = FOLD_DAYS): boolean {
  if (n.status !== 'seed' && n.status !== 'open') return false;
  const since = new Date(n.revived_at || n.created_at).getTime(); return now.getTime() - since > days * 86400000;
}
export const addHours = (iso: string | Date, h: number) => new Date(new Date(iso).getTime() + h * 3600000).toISOString();
export function priorityState(n: Pick<NeedRow, 'priority_until'>, now = new Date()): { active: boolean; until: string | null } {
  if (!n.priority_until) return { active: false, until: null }; return { active: new Date(n.priority_until).getTime() > now.getTime(), until: n.priority_until };
}
/** الترتيب العام: الأحدث أولًا (لا «الأكثر تأييدًا» — لا سباق) */
export function sortNeeds<T extends Pick<NeedRow, 'created_at' | 'revived_at'>>(rows: T[]): T[] { return [...rows].sort((a, b) => String(b.revived_at || b.created_at).localeCompare(String(a.revived_at || a.created_at))); }

/** العرض العام — بلا بريد ولا اسم كاتب؛ الجهة باسمها إن أذنت وإلا «جهة في قطاع …» */
export type NeedView = {
  id: string; created_at: string; sector: string; sector_ar: string; text_ar: string; source: NeedSource; source_ar: string; status: NeedStatus; status_ar: string;
  supports: number; band_ar: string; org_ar: string | null; adopter_ar: string | null; adopter_kind: 'faculty' | 'staff' | null; pitch_ar: string | null; adopted_at: string | null;
  program_id: string | null; born_at: string | null; priority: { active: boolean; until: string | null }; mine: boolean; supported: boolean; can_support: boolean; can_adopt: boolean; can_withdraw: boolean; can_revive: boolean; draft_id: string | null;
};
export function needView(n: NeedRow, ctx: { me: { id?: string | null; email?: string; staff?: boolean; faculty?: boolean } | null; supported: boolean; sectorAr: (c: string) => string; orgName: string | null; now?: Date }): NeedView {
  const me = ctx.me; const mine = !!me && isMine(n, me); const orgAr = n.organization_id ? (n.org_named && ctx.orgName ? ctx.orgName : `جهة في ${ctx.sectorAr(n.sector)}`) : null;
  return {
    id: n.id, created_at: n.created_at, sector: n.sector, sector_ar: ctx.sectorAr(n.sector), text_ar: n.text_ar, source: n.source, source_ar: SOURCE_AR[n.source], status: n.status, status_ar: STATUS_AR[n.status],
    supports: n.supports, band_ar: supportsBandAr(n.supports), org_ar: orgAr, adopter_ar: n.adopter_name_ar || null, adopter_kind: n.adopter_kind, pitch_ar: n.pitch_ar, adopted_at: n.adopted_at,
    program_id: n.program_id, born_at: n.born_at, priority: priorityState(n, ctx.now), mine, supported: ctx.supported,
    can_support: !!me && canSupport(n, me, ctx.supported).ok, can_adopt: !!me && canAdopt(n, { faculty: !!me.faculty, staff: !!me.staff }).ok, can_withdraw: !!me && canWithdraw(n, me).ok, can_revive: !!me && canRevive(n, me).ok,
    draft_id: me?.staff ? n.draft_id : null,
  };
}
/** إحصاء بالكلمات لصفحة /needs (k≥5 للأرقام) */
export function boardSummaryAr(rows: Pick<NeedRow, 'status'>[]): string {
  const open = rows.filter(r => r.status === 'open').length; const adopted = rows.filter(r => r.status === 'adopted').length; const born = rows.filter(r => r.status === 'born').length;
  const parts: string[] = []; if (open >= NEED_K) parts.push(`${open} حاجة تنتظر كاتبها`); if (adopted) parts.push(`${adopted === 1 ? 'حاجة واحدة' : adopted === 2 ? 'حاجتان' : `${adopted} حاجات`} تبنّاها كاتب`); if (born) parts.push(`${born === 1 ? 'برنامج واحد وُلد' : born === 2 ? 'برنامجان وُلدا' : `${born} برامج وُلدت`} من حاجة`);
  return parts.length ? parts.join(' · ') : 'الصفحة تبدأ بحاجتك.';
}
/** حاجة من محطة P38: نصّ المحطة (طويل) → مقترح أول ≤ 200 حرفًا يعدّله صاحبه */
export function needFromStationText(stationText: string): string { const t = scrubPii(String(stationText || '').trim()).replace(/\s+/g, ' '); return t.length <= NEED_MAX ? t : `${t.slice(0, NEED_MAX - 1).replace(/\s+\S*$/, '')}…`; }
/** حاجة من ورشة تطبيق P39 حين يرغب فيها خمسة: نصّ يُكتب باسم البرنامج */
export function needFromOfferText(programAr: string, offerTitle: string): string { return needFromStationText(`ورشة تطبيق بعد برنامج «${programAr}»: ${offerTitle} — طلبها خمسة ممن لم تسنح لهم الفرصة.`); }
export { bandAr };
