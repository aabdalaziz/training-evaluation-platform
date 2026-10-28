// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * أَثَر — الوكلاء المفوَّضون (Agent-Native Portal · P14-ب) — دوال نقية قابلة للاختبار
 *  الفكرة: وكيل الموارد البشرية في الجهة يكتشف البرامج، يسأل «أي برنامج أثبت رفع هذه المهارة؟» (من قاعدة الأدلة)، يطلب عرض سعر، يحجز مقاعد، يتحقق من شهادة، ويطلب تقرير أثر —
 *  وكل كتابة (عرض سعر/حجز/غرفة حوار) = «طلب ينتظر اعتماد إنسان». لا التزام مالي آلي أبدًا.
 *  المفتاح: atk_ + 32 حرفًا؛ لا يُخزَّن إلا تجزئته (SHA-256) وبادئته للعرض.
 */
import type { Graph } from './evidence';
import { edgesTo, nodeMap, evN, peopleN, learnerN } from './evidence';

export type Scope = 'discover' | 'fit' | 'verify' | 'report' | 'quote' | 'reserve' | 'dialogue';
export const ALL_SCOPES: Scope[] = ['discover', 'fit', 'verify', 'report', 'quote', 'reserve', 'dialogue'];
export const DEFAULT_SCOPES: Scope[] = ['discover', 'fit', 'verify', 'report'];
export const SCOPE_LABEL: Record<Scope, { ar: string; en: string }> = { discover: { ar: 'اكتشاف البرامج', en: 'Discover programs' }, fit: { ar: 'ملاءمة مهارة بدليل', en: 'Evidence-based skill fit' }, verify: { ar: 'التحقق من شهادة', en: 'Verify credential' }, report: { ar: 'تقرير أثر مجهّل', en: 'Anonymized impact report' }, quote: { ar: 'طلب عرض سعر', en: 'Request quote' }, reserve: { ar: 'حجز مقاعد (بانتظار اعتماد)', en: 'Reserve seats (pending approval)' }, dialogue: { ar: 'فتح غرفة حوار مع مستشار', en: 'Open a dialogue room' } };

export type ToolParam = { name: string; type: 'string' | 'integer' | 'array'; required?: boolean; desc_ar: string; desc_en: string };
export type AgentTool = { name: string; scope: Scope; writes: boolean; title_ar: string; title_en: string; desc_ar: string; desc_en: string; params: ToolParam[] };
export const AGENT_TOOLS: AgentTool[] = [
  { name: 'discover_programs', scope: 'discover', writes: false, title_ar: 'اكتشاف البرامج', title_en: 'Discover programs', desc_ar: 'البرامج العامة المفتوحة للتسجيل مع الرسوم والمقاعد والمواعيد. يقبل ترشيحًا بالقطاع أو كلمة.', desc_en: 'Public programs open for registration with fees, seats and dates. Filter by sector or keyword.', params: [{ name: 'q', type: 'string', desc_ar: 'كلمة بحث', desc_en: 'Keyword' }, { name: 'sector', type: 'string', desc_ar: 'رمز القطاع', desc_en: 'Sector code' }, { name: 'limit', type: 'integer', desc_ar: 'حتى 20', desc_en: 'Up to 20' }] },
  { name: 'skill_fit', scope: 'fit', writes: false, title_ar: 'ملاءمة مهارة بدليل', title_en: 'Evidence-based skill fit', desc_ar: 'أي برنامج أثبت رفع مهارة معينة؟ يُجاب من قاعدة الأدلة المؤسسية (عدد الأدلة والأشخاص ونسبة النقل إلى العمل) لا من الكتالوج.', desc_en: 'Which program has proven to raise a given skill? Answered from the institutional evidence base, not the catalog.', params: [{ name: 'skill', type: 'string', required: true, desc_ar: 'اسم المهارة أو رمزها (ATH-…)', desc_en: 'Skill name or code' }] },
  { name: 'request_quote', scope: 'quote', writes: true, title_ar: 'طلب عرض سعر', title_en: 'Request a quote', desc_ar: 'يُنشئ طلب عرض سعر لبرنامج وعدد مقاعد. الرد الآلي تقديري؛ العرض الملزم يصدره إنسان خلال يوم عمل.', desc_en: 'Creates a quote request for a program and seat count. The instant figure is indicative; a human issues the binding quote within one business day.', params: [{ name: 'program_id', type: 'string', required: true, desc_ar: 'معرّف البرنامج', desc_en: 'Program id' }, { name: 'seats', type: 'integer', required: true, desc_ar: '1–500', desc_en: '1–500' }, { name: 'contact_email', type: 'string', required: true, desc_ar: 'بريد ممثل الجهة', desc_en: 'Organization contact email' }, { name: 'notes', type: 'string', desc_ar: 'ملاحظات', desc_en: 'Notes' }] },
  { name: 'reserve_seats', scope: 'reserve', writes: true, title_ar: 'حجز مقاعد', title_en: 'Reserve seats', desc_ar: 'يحجز مقاعد مبدئيًا لمشاركين محددين؛ يصبح الحجز نافذًا بعد اعتماد إنسان، وتُنشأ طلبات التسجيل حينها.', desc_en: 'Provisionally reserves seats for named participants; becomes effective after human approval, when enrollment requests are created.', params: [{ name: 'program_id', type: 'string', required: true, desc_ar: 'معرّف البرنامج', desc_en: 'Program id' }, { name: 'participants', type: 'array', required: true, desc_ar: 'قائمة {full_name,email} حتى 60', desc_en: 'List of {full_name,email} up to 60' }, { name: 'contact_email', type: 'string', required: true, desc_ar: 'بريد ممثل الجهة', desc_en: 'Organization contact email' }] },
  { name: 'verify_credential', scope: 'verify', writes: false, title_ar: 'التحقق من شهادة', title_en: 'Verify a credential', desc_ar: 'يتحقق من رمز شهادة أَثَر (ATH-XXXX-XXXX) ويعيد حالتها وتاريخها ورابطها العام.', desc_en: 'Verifies an Athar credential code and returns status, dates and public URL.', params: [{ name: 'code', type: 'string', required: true, desc_ar: 'رمز التحقق', desc_en: 'Verify code' }] },
  { name: 'impact_report', scope: 'report', writes: false, title_ar: 'تقرير أثر مجهّل', title_en: 'Anonymized impact report', desc_ar: 'ملخص أثر الجهة صاحبة المفتاح (برامج، أشخاص، مهارات تحرّكت، نقل إلى العمل) بلا أسماء أفراد.', desc_en: 'Impact summary for the key’s organization (programs, people, skills moved, transfer to work) with no individual names.', params: [{ name: 'year', type: 'integer', desc_ar: 'السنة (اختياري)', desc_en: 'Year (optional)' }] },
  { name: 'open_dialogue_room', scope: 'dialogue', writes: true, title_ar: 'فتح غرفة حوار', title_en: 'Open a dialogue room', desc_ar: 'يفتح غرفة أَثَر صغيرة (فيديو داخل المنصة) ليلتقي ممثل الجهة بمستشار؛ يصل الرابط فورًا ويُبلَّغ المستشار.', desc_en: 'Opens a small Athar video room for the organization’s representative to meet an advisor; the link is returned instantly and an advisor is notified.', params: [{ name: 'topic', type: 'string', required: true, desc_ar: 'موضوع الحوار', desc_en: 'Topic' }, { name: 'contact_email', type: 'string', required: true, desc_ar: 'بريد ممثل الجهة', desc_en: 'Contact email' }] },
  { name: 'request_status', scope: 'discover', writes: false, title_ar: 'حالة طلب', title_en: 'Request status', desc_ar: 'حالة طلب سابق (عرض سعر/حجز/غرفة) بمعرّفه.', desc_en: 'Status of a previous request by id.', params: [{ name: 'request_id', type: 'string', required: true, desc_ar: 'معرّف الطلب', desc_en: 'Request id' }] },
];
export const TOOL_NAMES = AGENT_TOOLS.map(t => t.name);
export function toolByName(name: string): AgentTool | null { return AGENT_TOOLS.find(t => t.name === name) || null; }

// ---------------------------------------------------------------- المفاتيح
const ALPH = 'abcdefghijkmnpqrstuvwxyz23456789';
export function keyFromBytes(bytes: Uint8Array | number[]): string { let s = ''; for (let i = 0; i < 32; i++) s += ALPH[(bytes[i % bytes.length] ?? 0) % ALPH.length]; return `atk_${s}`; }
export function isAgentKey(s: unknown): boolean { return /^atk_[a-z2-9]{32}$/.test(String(s || '')); }
export function keyPrefix(key: string): string { return key.slice(0, 12); }
export type KeyRow = { id: string; organization_id?: string | null; name: string; scopes: string[]; daily_limit: number; expires_at?: string | null; revoked_at?: string | null; created_by?: string | null };
export function allowCall(key: KeyRow | null, scope: Scope, usesToday: number, nowIso: string): { ok: true } | { ok: false; error_ar: string; error_en: string; status: number } {
  if (!key) return { ok: false, error_ar: 'مفتاح غير معروف', error_en: 'Unknown key', status: 401 };
  if (key.revoked_at) return { ok: false, error_ar: 'المفتاح مُبطَل', error_en: 'Key revoked', status: 401 };
  if (key.expires_at && key.expires_at < nowIso) return { ok: false, error_ar: 'انتهت صلاحية المفتاح', error_en: 'Key expired', status: 401 };
  if (!(key.scopes || []).includes(scope)) return { ok: false, error_ar: `هذا المفتاح لا يملك صلاحية «${SCOPE_LABEL[scope].ar}»`, error_en: `Key lacks scope “${scope}”`, status: 403 };
  if (usesToday >= (key.daily_limit || 0)) return { ok: false, error_ar: 'تجاوزت حد الاستخدام اليومي', error_en: 'Daily limit reached', status: 429 };
  return { ok: true };
}

// ---------------------------------------------------------------- التحقق من المعاملات
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
export function validateArgs(tool: AgentTool, raw: any): { ok: true; args: Record<string, any> } | { ok: false; error_ar: string; error_en: string } {
  const a = raw && typeof raw === 'object' ? raw : {}; const out: Record<string, any> = {};
  for (const p of tool.params) {
    const v = a[p.name];
    if (v === undefined || v === null || v === '') { if (p.required) return { ok: false, error_ar: `المعامل «${p.name}» مطلوب`, error_en: `Parameter “${p.name}” is required` }; continue; }
    if (p.type === 'integer') { const n = Number(v); if (!Number.isInteger(n) || n < 0) return { ok: false, error_ar: `«${p.name}» يجب أن يكون عددًا صحيحًا`, error_en: `“${p.name}” must be an integer` }; out[p.name] = n; }
    else if (p.type === 'array') { if (!Array.isArray(v)) return { ok: false, error_ar: `«${p.name}» يجب أن يكون قائمة`, error_en: `“${p.name}” must be an array` }; out[p.name] = v.slice(0, 60); }
    else out[p.name] = String(v).replace(/\s+/g, ' ').trim().slice(0, 400);
  }
  if (out.seats !== undefined && (out.seats < 1 || out.seats > 500)) return { ok: false, error_ar: 'المقاعد بين 1 و500', error_en: 'Seats must be 1–500' };
  if (out.contact_email && !EMAIL.test(out.contact_email)) return { ok: false, error_ar: 'بريد ممثل الجهة غير صالح', error_en: 'Invalid contact email' };
  if (out.participants) { const ps = (out.participants as any[]).map(x => ({ full_name: String(x?.full_name || '').trim().slice(0, 120), email: String(x?.email || '').trim().toLowerCase().slice(0, 160) })).filter(x => x.full_name && EMAIL.test(x.email)); if (!ps.length) return { ok: false, error_ar: 'قائمة المشاركين تحتاج اسمًا وبريدًا صالحين لكل مشارك', error_en: 'Participants need a valid name and email each' }; out.participants = ps; }
  if (out.limit !== undefined) out.limit = Math.max(1, Math.min(20, out.limit));
  return { ok: true, args: out };
}

// ---------------------------------------------------------------- ملاءمة مهارة بدليل (من قاعدة الأدلة)
export type FitRow = { program_id: string; program: string; evidence: number; people: number; transfer: number; weight: number; proof_ar: string };
export function fitPrograms(g: Graph, skillNodeId: string): FitRow[] {
  const nm = nodeMap(g); const es = edgesTo(g, skillNodeId, 'raised').filter(e => e.src.startsWith('program:'));
  return es.map(e => { const n = nm.get(e.src); const tr = Number((e.meta as any)?.transfer || 0); return { program_id: n?.ref_id || e.src.slice(8), program: n?.label_ar || e.src, evidence: e.evidence, people: e.people, transfer: tr, weight: Math.round(e.weight * 10) / 10, proof_ar: `${evN(e.evidence)} من ${learnerN(e.people)}${tr ? `، ${tr} منها مؤكَّدة في العمل` : ''}${e.period_from ? ` (${e.period_from} → ${e.period_to})` : ''}` }; }).sort((a, b) => b.transfer - a.transfer || b.weight - a.weight).slice(0, 8);
}
export function findSkillNode(g: Graph, q: string): string | null {
  const lq = String(q || '').trim().toLowerCase(); if (!lq) return null; const skills = g.nodes.filter(n => n.kind === 'skill');
  const byCode = skills.find(n => String((n.meta as any)?.code || '').toLowerCase() === lq); if (byCode) return byCode.id;
  const exact = skills.find(n => n.label_ar.toLowerCase() === lq || (n.label_en || '').toLowerCase() === lq); if (exact) return exact.id;
  const part = skills.filter(n => n.label_ar.toLowerCase().includes(lq) || (n.label_en || '').toLowerCase().includes(lq) || lq.includes(n.label_ar.toLowerCase())).sort((a, b) => b.weight - a.weight); return part[0]?.id || null;
}

// ---------------------------------------------------------------- عرض سعر تقديري
export function indicativeQuote(p: { fee?: number | string | null; currency?: string | null; seats?: number | null }, seats: number): { per_seat: number | null; total: number | null; currency: string; seats: number; indicative: true; note_ar: string; note_en: string; capacity_warning: boolean } {
  const fee = p.fee === null || p.fee === undefined || p.fee === '' ? null : Number(p.fee); const cur = String(p.currency || 'SAR').toUpperCase(); const cap = Number(p.seats || 0);
  const total = fee !== null && Number.isFinite(fee) ? Math.round(fee * seats) : null; const groupNote = seats >= 20 ? ' المجموعات ≥ 20 مقعدًا تُدرس لها شروط خاصة.' : '';
  return { per_seat: fee, total, currency: cur, seats, indicative: true, capacity_warning: !!cap && seats > cap, note_ar: `رقم تقديري من الرسوم المعلنة؛ العرض الملزم يصدره إنسان خلال يوم عمل.${groupNote}`, note_en: `Indicative figure from the published fee; a binding quote is issued by a human within one business day.${seats >= 20 ? ' Groups of 20+ get custom terms.' : ''}` };
}

// ---------------------------------------------------------------- الاكتشاف الآلي
export function pluginManifest(site: string) {
  return {
    schema_version: 'v1', name_for_human: 'أَثَر — بوابة التعليم والتدريب والتطوير', name_for_model: 'athar_portal',
    description_for_human: 'اكتشف برامج أَثَر، اسأل أي برنامج أثبت رفع مهارة، اطلب عرض سعر، احجز مقاعد، وتحقق من الشهادات — وكل التزام يعتمده إنسان.',
    description_for_model: 'Athar (TRACE) is an Arabic learning & development portal. Tools: discover_programs, skill_fit (evidence-based: which program proved to raise a skill), request_quote, reserve_seats, verify_credential, impact_report, open_dialogue_room, request_status. All write actions create human-approved requests; never promise a binding price or seat. Auth: header X-Agent-Key (atk_…) issued to organizations by Athar staff; discovery and verify work without a key at reduced limits.',
    auth: { type: 'user_http', authorization_type: 'bearer', instructions: 'Send X-Agent-Key: atk_… (or Authorization: Bearer atk_…). Keys are issued per organization by Athar staff; request one at ' + site + '/agents' },
    api: { type: 'athar_tools', url: `${site}/api/agent`, method: 'POST', body: '{ "tool": "<name>", "args": { … } }', manifest: `${site}/api/agent` },
    logo_url: `${site}/icons/icon-192.png`, contact_email: 'info@athar-portal.sa', legal_info_url: `${site}/agents`,
    tools: AGENT_TOOLS.map(t => ({ name: t.name, scope: t.scope, writes: t.writes, description: t.desc_en, description_ar: t.desc_ar, parameters: { type: 'object', properties: Object.fromEntries(t.params.map(p => [p.name, { type: p.type, description: p.desc_en }])), required: t.params.filter(p => p.required).map(p => p.name) } })),
    governance: { human_in_the_loop: true, binding_commitments_by_agents: false, data_minimization: 'no individual names in reports', log_retention_days: 180 },
  };
}
export function agentsJsonLd(site: string) {
  return { '@context': 'https://schema.org', '@type': 'WebAPI', name: 'Athar Agent API', description: 'Agent-native access to Athar programs, evidence-based skill fit, quotes, reservations and credential verification — with human approval on every commitment.', url: `${site}/agents`, documentation: `${site}/api/agent`, provider: { '@type': 'Organization', name: 'أَثَر — بوابة التعليم والتدريب والتطوير', url: site }, termsOfService: `${site}/agents`, potentialAction: AGENT_TOOLS.map(t => ({ '@type': 'Action', name: t.name, description: t.desc_en })) };
}

// ---------------------------------------------------------------- المكتب الزجاجي: سطور عامة مجهّلة
export const AGENT_CAN_AR = ['اكتشاف البرامج العامة والرسوم والمواعيد', 'سؤال قاعدة الأدلة: أي برنامج أثبت رفع مهارة معينة', 'طلب عرض سعر تقديري (الملزم يصدره إنسان)', 'حجز مقاعد مبدئي لمشاركين محددين (ينفذ بعد اعتماد إنسان)', 'التحقق من شهادة برمزها العام', 'تقرير أثر مجهّل للجهة صاحبة المفتاح', 'فتح غرفة حوار فيديو مع مستشار'];
export const AGENT_CANNOT_AR = ['رؤية أسماء المتعلمين أو درجاتهم أو تسجيلاتهم', 'إلزام أَثَر بسعر أو مقعد دون توقيع إنسان', 'تعديل أو حذف أي سجل', 'الوصول إلى بيانات جهة أخرى', 'تجاوز حد الاستخدام اليومي للمفتاح'];
const AGO_AR = (ms: number) => { const m = Math.max(1, Math.round(ms / 60000)); if (m < 60) return `قبل ${m} دقيقة`; const h = Math.round(m / 60); if (h < 24) return `قبل ${h} ساعة`; return `قبل ${Math.round(h / 24)} يومًا`; };
const TOOL_VERB_AR: Record<string, string> = { discover_programs: 'استكشف البرامج', skill_fit: 'سأل عن برنامج أثبت رفع مهارة', request_quote: 'طلب عرض سعر (ينتظر إنسانًا)', reserve_seats: 'حجز مقاعد مبدئيًا (ينتظر إنسانًا)', verify_credential: 'تحقق من شهادة', impact_report: 'طلب تقرير أثر مجهّلًا', open_dialogue_room: 'فتح غرفة حوار مع مستشار', request_status: 'تابع حالة طلب' };
export function publicLogLine(row: { at: string; tool: string; ok: boolean; meta?: any }, nowMs: number): string {
  const who = row.meta?.sandbox ? 'وكيل تجريبي (طاقم أَثَر)' : row.meta?.org_sector ? `وكيل جهة في قطاع ${row.meta.org_sector}` : row.meta?.key ? 'وكيل جهة مفوَّض' : 'وكيل عام (بلا مفتاح)';
  return `${who} ${TOOL_VERB_AR[row.tool] || row.tool}${row.ok ? '' : ' — رُفض'} · ${AGO_AR(nowMs - new Date(row.at).getTime())}`;
}
/** الطلبات المسموح بها بلا مفتاح (اكتشاف وتحقق فقط · حد يومي أدنى) */
export const ANON_SCOPES: Scope[] = ['discover', 'verify'];
export const ANON_DAILY_LIMIT = 60;
