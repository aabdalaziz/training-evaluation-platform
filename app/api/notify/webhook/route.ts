// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /api/notify/webhook — حالات التسليم من المزوّدين (أَثَر · P16)
 *  GET  ?provider=whatsapp&hub.mode=subscribe&hub.verify_token=…&hub.challenge=…  → تحقق Meta عند ربط الـWebhook (يُعيد challenge نصًا)
 *  POST ?provider=whatsapp  (توقيع X-Hub-Signature-256 بـ WHATSAPP_APP_SECRET)    → sent/delivered/read/failed
 *  POST ?provider=resend    (توقيع Svix بـ RESEND_WEBHOOK_SECRET)                  → delivered/bounced/complained
 *  بلا توقيع صحيح → 401. لا يُرجع تفاصيل داخلية. يُحدّث portal_message_log عبر provider_id فقط.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { waConfig, verifyMetaSignature, verifyResendSignature, parseWhatsAppStatuses, parseResendEvent, applyStatuses } from '../../../../lib/portal/whatsapp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const u = new URL(req.url); const cfg = waConfig();
  if (u.searchParams.get('hub.mode') === 'subscribe' && cfg?.verifyToken && u.searchParams.get('hub.verify_token') === cfg.verifyToken) return new Response(u.searchParams.get('hub.challenge') || '', { status: 200, headers: { 'Content-Type': 'text/plain' } });
  return NextResponse.json({ success: false, error: 'forbidden' }, { status: 403 });
}

export async function POST(req: Request) {
  const u = new URL(req.url); const provider = u.searchParams.get('provider') || ''; const raw = await req.text();
  const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL; const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL_ || !SERVICE) return NextResponse.json({ success: false }, { status: 500 });
  let list: ReturnType<typeof parseWhatsAppStatuses> = [];
  if (provider === 'whatsapp') {
    const cfg = waConfig(); if (!cfg || !verifyMetaSignature(raw, req.headers.get('x-hub-signature-256'), cfg.appSecret)) return NextResponse.json({ success: false }, { status: 401 });
    try { list = parseWhatsAppStatuses(JSON.parse(raw)); } catch { list = []; }
  } else if (provider === 'resend') {
    const secret = String(process.env.RESEND_WEBHOOK_SECRET || '');
    if (!verifyResendSignature(raw, { id: req.headers.get('svix-id'), timestamp: req.headers.get('svix-timestamp'), signature: req.headers.get('svix-signature') }, secret)) return NextResponse.json({ success: false }, { status: 401 });
    try { const ev = parseResendEvent(JSON.parse(raw)); if (ev) list = [ev]; } catch { list = []; }
  } else return NextResponse.json({ success: false }, { status: 404 });
  const db = createClient(URL_, SERVICE, { auth: { persistSession: false } });
  const updated = list.length ? await applyStatuses(db, list) : 0;
  return NextResponse.json({ success: true, received: list.length, updated });
}
