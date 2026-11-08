// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * درع أَثَر — الطبقة الثانية (P65) ★3 «زرّ التجميد»: جهة واحدة في وضع القراءة فقط أثناء حادثة.
 *  علمٌ على portal_organizations (frozen_at/reason/by) + فحص في مسارات الكتابة للمتدرّبين (423 Locked) برسالة إنسانية.
 *  المسار السريع: إن لم تكن أيّ جهة مجمَّدة (الحالة الطبيعية) فاستعلام واحد خفيف ولا شيء بعده.
 *  العضوية تُحسب من portal_org_members (مؤكَّدة) أو portal_enrollments.organization_id. التجميد/الرفع حدثان أمنيان (حرج/معلومة).
 */
import { NextResponse } from 'next/server';
import { securityEvent } from './guard';

export const FROZEN_STATUS = 423;
export const FROZEN_AR = 'حسابات جهتك في وضع القراءة فقط مؤقتًا بقرار من فريق أمن أَثَر أثناء مراجعة حادثة. بياناتك محفوظة ولا يضيع منها شيء، وسنعيد الكتابة فور انتهاء المراجعة. إن احتجت شيئًا عاجلًا راسل الطاقم.';

export type FrozenOrg = { id: string; name_ar: string; frozen_at: string; frozen_reason: string | null };
export type FreezeState = { frozen: boolean; org?: FrozenOrg };

export async function frozenOrgs(db: any): Promise<FrozenOrg[]> {
  try { const { data, error } = await db.from('portal_organizations').select('id,name_ar,frozen_at,frozen_reason').not('frozen_at', 'is', null).limit(50); return error ? [] : ((data || []) as FrozenOrg[]); } catch { return []; }
}

/** هل هذا المستخدم منسوب إلى جهة مجمَّدة؟ */
export async function frozenFor(db: any, user: { id: string; email?: string | null }): Promise<FreezeState> {
  const fz = await frozenOrgs(db); if (!fz.length) return { frozen: false };
  const ids = fz.map(o => o.id);
  const hit = (orgId: string | null | undefined) => { const o = fz.find(x => x.id === orgId); return o ? { frozen: true, org: o } : null; };
  try {
    let q = db.from('portal_org_members').select('organization_id').in('organization_id', ids).eq('status', 'confirmed');
    q = user.email ? q.or(`user_id.eq.${user.id},email.ilike.${String(user.email).replace(/[,()]/g, '')}`) : q.eq('user_id', user.id);
    const { data } = await q.limit(5); const h = hit((data || [])[0]?.organization_id); if (h) return h;
  } catch { /* */ }
  try { const { data } = await db.from('portal_enrollments').select('organization_id').eq('user_id', user.id).in('organization_id', ids).limit(5); const h = hit((data || [])[0]?.organization_id); if (h) return h; } catch { /* */ }
  return { frozen: false };
}

/** استجابة موحَّدة لمسارات الكتابة */
export const frozenResponse = (st: FreezeState) => NextResponse.json({ success: false, frozen: true, error: FROZEN_AR, org: st.org?.name_ar || null }, { status: FROZEN_STATUS });

/** يُستدعى في مسارات الكتابة: null = امضِ · استجابة = أعدها فورًا */
export async function freezeGate(db: any, user: { id: string; email?: string | null }) { const st = await frozenFor(db, user); return st.frozen ? frozenResponse(st) : null; }

export async function setFreeze(db: any, a: { org_id: string; on: boolean; by: { id: string; email: string }; reason?: string; env?: Record<string, string | undefined> }) {
  const patch = a.on ? { frozen_at: new Date().toISOString(), frozen_reason: String(a.reason || '').slice(0, 300) || null, frozen_by: a.by.id } : { frozen_at: null, frozen_reason: null, frozen_by: null };
  const { data, error } = await db.from('portal_organizations').update(patch).eq('id', a.org_id).select('id,name_ar').maybeSingle();
  if (error) return { ok: false as const, error: error.message }; if (!data) return { ok: false as const, error: 'الجهة غير موجودة' };
  await securityEvent(db, { severity: a.on ? 'critical' : 'info', kind: a.on ? 'org_frozen' : 'org_unfrozen', actor: a.by.email, user_id: a.by.id, meta: { org_id: a.org_id, org_name: data.name_ar, reason: patch.frozen_reason || undefined } }, a.env);
  return { ok: true as const, org: data };
}

export type OrgRow = { id: string; name_ar: string; city?: string | null; frozen_at: string | null; frozen_reason: string | null; erase_at: string | null; erase_reason: string | null; members: number; policy?: Record<string, unknown>; slug?: string | null };
export async function listOrgs(db: any): Promise<OrgRow[]> {
  const { data } = await db.from('portal_organizations').select('id,name_ar,city,frozen_at,frozen_reason,erase_at,erase_reason,policy,slug').order('name_ar').limit(300);
  const rows = (data || []) as any[]; if (!rows.length) return [];
  const { data: mem } = await db.from('portal_org_members').select('organization_id').in('organization_id', rows.map(r => r.id)).eq('status', 'confirmed').limit(5000);
  const cnt = new Map<string, number>(); for (const m of (mem || []) as any[]) cnt.set(m.organization_id, (cnt.get(m.organization_id) || 0) + 1);
  return rows.map(r => ({ id: r.id, name_ar: r.name_ar, city: r.city, frozen_at: r.frozen_at || null, frozen_reason: r.frozen_reason || null, erase_at: r.erase_at || null, erase_reason: r.erase_reason || null, members: cnt.get(r.id) || 0, policy: r.policy || {}, slug: r.slug || null }));
}
