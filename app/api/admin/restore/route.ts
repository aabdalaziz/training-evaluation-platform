/**
 * /api/admin/restore — استعادة من نسخة احتياطية JSON (دفعة واحدة لكل طلب)
 *  POST { table, rows[], mode: 'dry' | 'add' | 'replace' }  → { success, existing, inserted, updated, skipped }
 *  POST { log: { ...summary } }                              → تسجيل العملية في audit_logs
 * يتطلب مدير منصة + SUPABASE_SERVICE_ROLE_KEY (يتجاوز RLS، والمحفّزات تسجّل كل تغيير في التدقيق)
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { CATALOG } from '../../../../lib/backup/model';
import { conflictKey, rowKey, BATCH } from '../../../../lib/backup/restore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const ALLOWED = ['PLATFORM_ADMIN', 'SUPER_ADMIN'];
const bad = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status });

async function authorize(req: Request) {
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL; const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!SUPABASE_URL || !ANON) return { error: bad('إعدادات الخادم غير مكتملة', 500) };
  const auth = req.headers.get('authorization') || ''; const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return { error: bad('يرجى تسجيل الدخول أولاً', 401) };
  const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: u, error: uErr } = await userClient.auth.getUser(token);
  if (uErr || !u?.user) return { error: bad('جلسة المستخدم غير صالحة', 401) };
  const { data: profile } = await userClient.from('profiles').select('role,full_name').eq('id', u.user.id).single();
  const role = String((profile as any)?.role || '').toUpperCase();
  if (!ALLOWED.includes(role)) return { error: bad('غير مصرح — الاستعادة لمدير المنصة فقط', 403) };
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!service) return { error: bad('SUPABASE_SERVICE_ROLE_KEY غير مضبوط في Vercel — الاستعادة تحتاجه', 500) };
  return { user: u.user, role, name: String((profile as any)?.full_name || u.user.email || ''), db: createClient(SUPABASE_URL, service) };
}

export async function POST(req: Request) {
  const a = await authorize(req); if ('error' in a) return a.error;
  let body: any; try { body = await req.json(); } catch { return bad('جسم الطلب غير صالح'); }

  // تسجيل ملخّص العملية
  if (body?.log) {
    try { await a.db.from('audit_logs').insert({ actor_id: a.user.id, actor_email: a.user.email || null, actor_role: a.role, action: 'restore_backup', entity_type: 'backup', entity_label: String(body.log.file || 'JSON'), source: 'app', metadata: body.log }); } catch { /* اختياري */ }
    return NextResponse.json({ success: true });
  }

  const table = String(body?.table || ''); const mode = String(body?.mode || 'dry'); const rows: any[] = Array.isArray(body?.rows) ? body.rows : [];
  if (!CATALOG.some(t => t.table === table)) return bad('جدول غير مسموح: ' + table);
  if (!['dry', 'add', 'replace'].includes(mode)) return bad('وضع غير معروف');
  if (!rows.length) return NextResponse.json({ success: true, existing: 0, inserted: 0, updated: 0, skipped: 0 });
  if (rows.length > BATCH) return bad(`الدفعة أكبر من الحد (${BATCH})`);

  const conflict = conflictKey(table); const keys = conflict.split(',');
  // الصفوف الموجودة حاليًا (بالمفتاح)
  let existing = new Set<string>();
  try {
    let q: any = a.db.from(table).select(conflict);
    if (keys.length === 1) q = q.in(keys[0], rows.map(r => r[keys[0]]));
    else q = q.in(keys[0], Array.from(new Set(rows.map(r => r[keys[0]]))));
    const { data, error } = await q.limit(5000);
    if (error) return bad(`تعذّر فحص «${table}»: ${error.message}`);
    existing = new Set(((data as any[]) || []).map(r => rowKey(r, conflict)));
  } catch (e: any) { return bad(`تعذّر فحص «${table}»: ${e?.message || e}`); }
  const present = rows.filter(r => existing.has(rowKey(r, conflict))).length; const fresh = rows.length - present;

  if (mode === 'dry') return NextResponse.json({ success: true, existing: present, inserted: 0, updated: 0, skipped: 0, fresh });

  const payload = mode === 'add' ? rows.filter(r => !existing.has(rowKey(r, conflict))) : rows;
  if (!payload.length) return NextResponse.json({ success: true, existing: present, inserted: 0, updated: 0, skipped: present });
  const { error } = await a.db.from(table).upsert(payload, { onConflict: conflict, ignoreDuplicates: mode === 'add' });
  if (error) return bad(`فشل «${table}»: ${error.message}`);
  return NextResponse.json({ success: true, existing: present, inserted: fresh, updated: mode === 'replace' ? present : 0, skipped: mode === 'add' ? present : 0 });
}
