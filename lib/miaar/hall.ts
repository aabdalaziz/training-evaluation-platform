// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * «قاعة الشاهد» — مركز المراقبة الإلكترونية للاختبارات · Examination Proctoring Center — م8-ب
 *  كل من يختبر الآن (في كل الدعوات والاختبار الفردي) على شاشة واحدة، مجمَّعين: فردي · حسب القاعات · حسب الأماكن.
 *  المصدر: الجلسات النشطة + آخر لقطة ومؤشّرات الشاهد (استعلام مجمَّع) + الجلسات المنتهية خلال 10 دقائق بلا حكم (كي لا يُنسى حكم).
 *  «تولّي القاعة»: كل مراقب يختار ما يراقبه فتُعلَّم المجموعة باسمه (في miaar_settings · تنتهي بعد ساعتين).
 */
import { liveFor, resolveMode, defaultWitnessMode, WITNESS_MODE_AR, type WitnessMode } from './witness';

type Db = any;
const nowIso = () => new Date().toISOString();
export const HALL_RECENT_MIN = 10;           /* المنتهون خلال 10 دقائق يبقون في القاعة بزرّ «حكم الشاهد» */
export const HALL_CLAIM_HOURS = 2;
export const HALL_TITLE = { ar: 'مركز المراقبة الإلكترونية للاختبارات', en: 'Examination Proctoring Center' } as const;
export const CLAIMS_KEY = 'hall_claims';

export type HallRow = {
  session_id: string; name: string; email: string; status: 'active' | 'finished'; started_at: string; expires_at: string; finished_at: string | null;
  remaining_s: number; elapsed_s: number; mode: WitnessMode; mode_ar: string; exam: string; level: string | null; section: string | null;
  invite_id: string | null; invite_label: string | null; purpose: string | null; classroom_id: string | null; classroom_label: string | null; client_name: string | null; location: string | null; city: string | null;
  report_id: string | null; access_code: string | null; integrity: string | null;
  witness: { level: string; level_ar: string; signals: number; frames: number; last_frame_at: string | null; last_frame_url: string | null; camera: 'on' | 'off' | 'none'; counters: Record<string, number>; pulse: Array<{ k: string; at: string }> } | null;
  room_key: string; room_label: string; place_key: string; place_label: string;
};

const LEVEL_RANK: Record<string, number> = { review: 0, watch: 1, calm: 2 };
/** الأسوأ أولًا: يستحق المراجعة ← إشارات ← هادئ؛ ثم الكاميرا المنقطعة؛ ثم الأحدث بدءًا */
export function sortHall(rows: HallRow[]): HallRow[] {
  return [...rows].sort((a, b) => {
    const ra = a.status === 'active' ? 0 : 1; const rb = b.status === 'active' ? 0 : 1; if (ra !== rb) return ra - rb;
    const la = LEVEL_RANK[a.witness?.level || 'calm'] ?? 2; const lb = LEVEL_RANK[b.witness?.level || 'calm'] ?? 2; if (la !== lb) return la - lb;
    const ca = a.witness?.camera === 'off' ? 0 : 1; const cb = b.witness?.camera === 'off' ? 0 : 1; if (ca !== cb) return ca - cb;
    return b.started_at.localeCompare(a.started_at);
  });
}
export type GroupBy = 'single' | 'room' | 'place';
export const GROUP_AR: Record<GroupBy, string> = { single: 'فردي', room: 'حسب القاعات', place: 'حسب الأماكن' };
/** التجميع: فردي (مجموعة واحدة) · حسب القاعات (الدعوة/القاعة الدراسية/الجهة) · حسب الأماكن (حقل المكان ← القاعة ← عن بُعد — المدينة) */
export function groupHall(rows: HallRow[], by: GroupBy): Array<{ key: string; label: string; rows: HallRow[]; review: number; active: number }> {
  const m = new Map<string, { key: string; label: string; rows: HallRow[] }>();
  for (const r of rows) {
    const key = by === 'single' ? 'all' : by === 'room' ? r.room_key : r.place_key; const label = by === 'single' ? 'كل الممتحنين' : by === 'room' ? r.room_label : r.place_label;
    const g = m.get(key) || { key, label, rows: [] }; g.rows.push(r); m.set(key, g);
  }
  return [...m.values()].map((g) => ({ ...g, rows: sortHall(g.rows), review: g.rows.filter((r) => r.witness?.level === 'review').length, active: g.rows.filter((r) => r.status === 'active').length }))
    .sort((a, b) => b.review - a.review || b.active - a.active || a.label.localeCompare(b.label, 'ar'));
}
/** مفاتيح التجميع لصفّ واحد (تُختبر وحدها) */
export function keysFor(r: { invite_id: string | null; invite_label: string | null; classroom_id: string | null; classroom_label: string | null; client_name: string | null; location: string | null; city: string | null; mode: WitnessMode }) {
  const room_key = r.classroom_id ? `c:${r.classroom_id}` : r.invite_id ? `i:${r.invite_id}` : 'solo';
  const room_label = r.classroom_label || (r.client_name ? `الجهة: ${r.client_name}` : null) || r.invite_label || 'اختبار فردي (بلا دعوة)';
  const place_label = r.location || (r.mode === 'remote' ? `عن بُعد${r.city ? ` — ${r.city}` : ''}` : null) || r.classroom_label || (r.client_name ? `مقرّ الجهة: ${r.client_name}` : null) || (r.invite_id ? 'مكان غير محدَّد' : 'فردي — مكان غير محدَّد');
  return { room_key, room_label, place_key: `p:${place_label}`, place_label };
}

/** القاعة الآن */
export async function hallFor(db: Db): Promise<{ rows: HallRow[]; default_mode: WitnessMode; default_mode_ar: string; claims: Record<string, { by: string; at: string }>; at: string }> {
  const now = Date.now(); const since = new Date(now - HALL_RECENT_MIN * 60000).toISOString();
  const [{ data: act }, { data: fin }, def, claims] = await Promise.all([
    db.from('placement_secure_sessions').select('id, candidate, status, started_at, created_at, expires_at, finished_at, invite_id, proctor_mode, exam_mode, plan, blueprint_id, current_level_index').eq('status', 'active').gt('expires_at', nowIso()).order('started_at', { ascending: false }).limit(300),
    db.from('placement_secure_sessions').select('id, candidate, status, started_at, created_at, expires_at, finished_at, invite_id, proctor_mode, exam_mode, plan, blueprint_id, current_level_index').neq('status', 'active').gte('finished_at', since).order('finished_at', { ascending: false }).limit(100),
    defaultWitnessMode(db), hallClaims(db),
  ]);
  const sessions = [...((act || []) as any[]), ...((fin || []) as any[])];
  if (!sessions.length) return { rows: [], default_mode: def, default_mode_ar: WITNESS_MODE_AR[def], claims, at: nowIso() };
  const inviteIds = [...new Set(sessions.map((s) => s.invite_id).filter(Boolean))] as string[]; const sids = sessions.map((s) => s.id);
  const [{ data: invs }, { data: reps }, live] = await Promise.all([
    inviteIds.length ? db.from('placement_invites').select('id, label_ar, purpose, classroom_id, client_name, service_mode, proctor_mode, location, level_target').in('id', inviteIds) : Promise.resolve({ data: [] }),
    db.from('placement_reports').select('id, submission_id, access_code, integrity_status').in('submission_id', sids),
    liveFor(db, sids),
  ]);
  const invBy = new Map<string, any>(((invs || []) as any[]).map((i) => [i.id, i])); const repBy = new Map<string, any>(((reps || []) as any[]).map((r) => [r.submission_id, r]));
  const classIds = [...new Set(((invs || []) as any[]).map((i) => i.classroom_id).filter(Boolean))] as string[]; const classBy = new Map<string, any>();
  if (classIds.length) { const { data: cls } = await db.from('classrooms').select('id, code, name, section_name, level, program_id').in('id', classIds); for (const c of (cls || []) as any[]) classBy.set(c.id, c); }
  const rows: HallRow[] = sessions.map((s): HallRow => {
    const inv = s.invite_id ? invBy.get(s.invite_id) || null : null; const cls = inv?.classroom_id ? classBy.get(inv.classroom_id) || null : null; const rep = repBy.get(s.id) || null;
    const mode = resolveMode(s, inv, def); const cand = (s.candidate || {}) as Record<string, any>;
    const exam = String(s.plan?.name_ar || cand.publishedFormTitle || (s.exam_mode === 'comprehensive' ? 'شامل' : 'تكيّفي'));
    const level = inv?.level_target || s.plan?.level || null;
    const classroom_label = cls ? `${cls.code || ''}${cls.section_name ? ` · ${cls.section_name}` : cls.name ? ` · ${cls.name}` : ''}`.trim() || cls.id : null;
    const base = { invite_id: s.invite_id || null, invite_label: inv?.label_ar || null, classroom_id: inv?.classroom_id || null, classroom_label, client_name: inv?.service_mode === 'external' ? inv.client_name || null : null, location: inv?.location || null, city: cand.city ? String(cand.city) : null, mode };
    const started = s.started_at || s.created_at; const exp = Date.parse(s.expires_at || '') || now;
    return {
      session_id: s.id, name: String(cand.name || ''), email: String(cand.email || ''), status: (s.status === 'active' ? 'active' : 'finished') as 'active' | 'finished', started_at: started, expires_at: s.expires_at, finished_at: s.finished_at || null,
      remaining_s: s.status === 'active' ? Math.max(0, Math.round((exp - now) / 1000)) : 0, elapsed_s: Math.max(0, Math.round(((s.status === 'active' ? now : Date.parse(s.finished_at || '') || now) - (Date.parse(started) || now)) / 1000)),
      mode_ar: WITNESS_MODE_AR[mode], exam, level, section: live[s.id]?.section || null, purpose: inv?.purpose || null,
      ...base, report_id: rep?.id || null, access_code: rep?.access_code || null, integrity: rep?.integrity_status || null,
      witness: live[s.id] ? { level: live[s.id].level, level_ar: live[s.id].level_ar, signals: live[s.id].signals, frames: live[s.id].frames, last_frame_at: live[s.id].last_frame_at, last_frame_url: live[s.id].last_frame_url, camera: live[s.id].camera, counters: live[s.id].counters, pulse: live[s.id].pulse || [] } : null,
      ...keysFor(base),
    };
  }).filter((r) => r.status === 'active' || r.integrity === 'pending');   /* المنتهون يبقون فقط إن كان حكمهم معلَّقًا */
  return { rows: sortHall(rows), default_mode: def, default_mode_ar: WITNESS_MODE_AR[def], claims, at: nowIso() };
}
/** عدّاد خفيف لمؤشّر «يختبر الآن» (استعلام واحد) */
export async function liveCount(db: Db): Promise<{ active: number; review: number; at: string }> {
  const { data } = await db.from('placement_secure_sessions').select('id').eq('status', 'active').gt('expires_at', nowIso()).limit(300); const ids = ((data || []) as any[]).map((r) => r.id);
  if (!ids.length) return { active: 0, review: 0, at: nowIso() };
  const live = await liveFor(db, ids).catch(() => ({} as Record<string, any>)); return { active: ids.length, review: Object.values(live).filter((v: any) => v.level === 'review').length, at: nowIso() };
}
/* ---------- تولّي القاعة ---------- */
export async function hallClaims(db: Db): Promise<Record<string, { by: string; at: string }>> {
  try { const { data } = await db.from('miaar_settings').select('value').eq('key', CLAIMS_KEY).maybeSingle(); const v = (data?.value || {}) as Record<string, { by: string; at: string }>; const cut = Date.now() - HALL_CLAIM_HOURS * 3600000; return Object.fromEntries(Object.entries(v).filter(([, c]) => Date.parse(c?.at || '') > cut)); } catch { return {}; }
}
export async function claimGroup(db: Db, key: unknown, by: string, release = false): Promise<{ ok: true; claims: Record<string, { by: string; at: string }> } | { ok: false; error: string }> {
  const k = typeof key === 'string' ? key.trim() : ''; if (!k || k.length > 160 || !/^(all|solo|[cip]:.+)$/.test(k)) return { ok: false, error: 'مجموعة غير صالحة' };
  const claims = await hallClaims(db); if (release) delete claims[k]; else claims[k] = { by, at: nowIso() };
  const r = await db.from('miaar_settings').upsert({ key: CLAIMS_KEY, value: claims, updated_at: nowIso(), updated_by: by }, { onConflict: 'key' }); if (r.error) return { ok: false, error: 'تعذّر الحفظ' };
  return { ok: true, claims };
}
