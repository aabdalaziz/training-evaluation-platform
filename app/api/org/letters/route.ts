// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /api/org/letters — P52 «رسالة الشهر» (جانب الجهة · مدير الجهة المؤكَّد أو الطاقم)
 *  GET  ?org=<uuid>                       → الرسائل الموقَّعة لهذه الجهة (الأحدث أولًا) — لا مسوَّدات
 *  POST {action:'reply', org, id, text}   → «ردّ الجهة» (سطر واحد ≤ 280) يصل إلى الموقِّع
 */
import { NextResponse } from 'next/server';
import { readJson } from '../../../../lib/shield/body';
import { rateLimit, tooMany } from '../../../../lib/shield/ratelimit';
import { orgCtx } from '../../../../lib/org-impact/auth';
import { replyLetter, LETTER_TITLE, LETTER_OFFICIAL, REPLY_MAX } from '../../../../lib/org-impact/letter';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const bad = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status });

export async function GET(req: Request) {
  const u = new URL(req.url); const c = await orgCtx(req, String(u.searchParams.get('org') || '')); if ('error' in c) return c.error; const { db, me, org, site } = c;
  const rl = await rateLimit(db, `orgletters:r:${me.id}`, 120, 60); if (!rl.allowed) return tooMany(rl);
  const { data } = await db.from('portal_org_letters').select('id, month, status, body, line_ar, promise_ar, ask_ar, signed_name, signed_title, signed_at, code, digest, reply_ar, reply_by, reply_at').eq('organization_id', org.id).eq('status', 'signed').order('month', { ascending: false }).limit(36);
  const letters = ((data || []) as any[]).map((l) => ({ ...l, verify_url: l.code ? `${site}/verify/letter?code=${encodeURIComponent(l.code)}` : null }));
  return NextResponse.json({ success: true, title: LETTER_TITLE, official: LETTER_OFFICIAL, org: { id: org.id, name_ar: org.name_ar }, letters, reply_max: REPLY_MAX, can_reply: true });
}

export async function POST(req: Request) {
  const j = await readJson(req, { maxBytes: 8 * 1024 }); if (!j.ok) return bad(j.error, j.status); const b = j.body as Record<string, unknown>;
  const c = await orgCtx(req, String(b.org || '')); if ('error' in c) return c.error; const { db, me, org } = c;
  const rl = await rateLimit(db, `orgletters:reply:${me.id}`, 3600, 20); if (!rl.allowed) return tooMany(rl);
  if (String(b.action || '') !== 'reply') return bad('إجراء غير معروف');
  const id = String(b.id || ''); const { data: l } = await db.from('portal_org_letters').select('id, organization_id').eq('id', id).maybeSingle(); if (!l || String(l.organization_id) !== org.id) return bad('الرسالة ليست لهذه الجهة', 404);
  const r = await replyLetter(db, id, { email: me.email, name: me.name }, b.text); if ('error' in r) return bad(r.error, r.status);
  try { await db.from('audit_logs').insert({ actor_id: me.id, actor_email: me.email, actor_role: me.staff ? 'STAFF' : 'ORG_ADMIN', action: 'org_letter_reply', entity_type: 'portal_org_letters', entity_id: id, entity_label: `${org.name_ar} · ${r.row.month}`, source: 'portal', metadata: { len: (r.row.reply_ar || '').length } }); } catch { /* تجاهل */ }
  return NextResponse.json({ success: true, letter: { id: r.row.id, reply_ar: r.row.reply_ar, reply_at: r.row.reply_at, reply_by: r.row.reply_by }, message: 'وصل ردّكم إلى موقِّع الرسالة' });
}
