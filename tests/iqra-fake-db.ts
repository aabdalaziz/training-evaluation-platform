// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** «اقْرَأْ» — قاعدة مصطنعة للاختبارات (ق1 + الخطوة 2) تحاكي ما يستعمله المخزن من واجهة Supabase. */
/* قاعدة مصطنعة تكفي استعلامات المخزن (select/eq/in/is/lte/neq/order/limit/single/count · insert/update/upsert(onConflict, ignoreDuplicates)/delete) */
export function fakeDb(seed: Record<string, any[]> = {}) {
  const T: Record<string, any[]> = { iqra_enrolments: [], iqra_lessons: [], iqra_cards: [], iqra_progress: [], iqra_reviews: [], question_bank_items: [], question_bank_answer_keys: [], placement_reports: [], placement_decisions: [], placement_invites: [], placement_invite_recipients: [], question_bank_blueprints: [], portal_learner_notices: [], iqra_threshold_requests: [], iqra_produce_reviews: [], iqra_time_log: [], iqra_library: [], miaar_syllabus_units: [], audit_logs: [], ...seed };
  let ids = 0; const nid = () => `00000000-0000-4000-8000-${String(++ids).padStart(12, '0')}`;
  const CONFLICT: Record<string, string[]> = { iqra_progress: ['learner_email', 'lesson_id'], iqra_reviews: ['learner_email', 'kind', 'ref_id'], question_bank_items: ['content_version', 'item_code'], question_bank_answer_keys: ['item_id'], portal_learner_notices: ['dedupe_key'] };
  const q = (table: string) => {
    const rows = T[table] || (T[table] = []); const f: Array<(r: any) => boolean> = []; let mode: 'select' | 'insert' | 'update' | 'upsert' | 'delete' = 'select'; let payload: any = null; let single = false; let lim = 0; let head = false; let orders: [string, boolean][] = []; let ignoreDup = false; let conflict: string[] | null = null;
    const b: any = {
      select(_c?: string, o?: any) { if (o?.head) head = true; return b; }, eq(k: string, v: any) { f.push((r) => r[k] === v); return b; }, ilike(k: string, v: any) { f.push((r) => String(r[k] || '').toLowerCase() === String(v).toLowerCase()); return b; }, gte(k: string, v: any) { f.push((r) => String(r[k]) >= String(v)); return b; }, neq(k: string, v: any) { f.push((r) => r[k] !== v); return b; }, in(k: string, v: any[]) { f.push((r) => v.includes(r[k])); return b; }, is(k: string, v: any) { f.push((r) => (r[k] ?? null) === v); return b; }, not(k: string, op: string, v: any) { f.push((r) => (op === 'is' ? (r[k] ?? null) !== v : r[k] !== v)); return b; }, lte(k: string, v: any) { f.push((r) => String(r[k]) <= String(v)); return b; }, gte(k: string, v: any) { f.push((r) => String(r[k]) >= String(v)); return b; },
      order(k: string, o?: any) { orders.push([k, o?.ascending === false]); return b; }, limit(n: number) { lim = n; return b; }, maybeSingle() { single = true; return b; }, single() { single = true; return b; },
      insert(p: any) { mode = 'insert'; payload = p; return b; }, update(p: any) { mode = 'update'; payload = p; return b; }, delete() { mode = 'delete'; return b; }, upsert(p: any, o?: any) { mode = 'upsert'; payload = p; ignoreDup = !!o?.ignoreDuplicates; conflict = o?.onConflict ? String(o.onConflict).split(',') : CONFLICT[table] || null; return b; },
      then(res: any) {
        const hit = () => { let h = rows.filter((r) => f.every((p) => p(r))); for (const [k, desc] of [...orders].reverse()) h = [...h].sort((a, c) => (String(a[k]) < String(c[k]) ? -1 : String(a[k]) > String(c[k]) ? 1 : 0) * (desc ? -1 : 1)); return h; };
        if (mode === 'insert' || mode === 'upsert') {
          const arr = (Array.isArray(payload) ? payload : [payload]).map((p: any) => ({ id: nid(), created_at: new Date().toISOString(), ...p })); const out: any[] = [];
          for (const r of arr) {
            if (table === 'iqra_lessons' && rows.some((x) => x.code === r.code)) return res({ data: null, error: { code: '23505', message: 'duplicate code' } });
            if (table === 'iqra_enrolments' && r.active && rows.some((x) => x.learner_email === r.learner_email && x.active)) return res({ data: null, error: { code: '23505', message: 'duplicate active enrolment' } });
            if (table === 'iqra_threshold_requests' && rows.some((x) => x.learner_email === r.learner_email && ['requested', 'deferred', 'invited', 'sat', 'passed'].includes(x.status))) return res({ data: null, error: { code: '23505', message: 'live request exists' } });
            if (table === 'placement_invites' && !r.status) r.status = 'open';
            const ex = mode === 'upsert' && conflict ? rows.find((x) => conflict!.every((k) => String(x[k]) === String(r[k]))) : null;
            if (ex) { if (!ignoreDup) { const { id: _i, created_at: _c, ...rest } = r; Object.assign(ex, rest); } out.push(ex); } else { rows.push(r); out.push(r); }
          }
          return res({ data: single ? out[0] : out, error: null });
        }
        if (mode === 'update') { const h = hit(); for (const r of h) Object.assign(r, payload); return res({ data: single ? h[0] || null : h, error: null }); }
        if (mode === 'delete') { const h = hit(); for (const r of h) rows.splice(rows.indexOf(r), 1); return res({ data: h, error: null }); }
        const h = hit(); if (head) return res({ data: null, count: h.length, error: null });
        return res({ data: single ? h[0] || null : (lim ? h.slice(0, lim) : h), count: h.length, error: null });
      },
    };
    return b;
  };
  return { T, from: q, rpc: async () => ({ data: null, error: null }) };
}
