// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /mcp — خادم MCP الرسمي لأَثَر «سفارة أَثَر» (P20) — Streamable HTTP · JSON-RPC 2.0 · بلا جلسات (2026-07-28) مع توافق خلفي (2025-03-26 … 2025-11-25)
 *  يتطلب هوية: Bearer athar_at (تفويض شخصي OAuth 2.1 — انظر /.well-known/oauth-protected-resource/mcp) أو مفتاح جهة atk_ أو رمز جلسة أَثَر.
 *  بلا هوية → 401 + WWW-Authenticate (ليبدأ العميل تدفق التفويض). النسخة العامة بلا هوية: /mcp/public
 */
import { handleMcp } from '../../lib/portal/mcp-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function OPTIONS(req: Request) { return handleMcp(req, 'auth'); }
export async function GET(req: Request) { return handleMcp(req, 'auth'); }
export async function POST(req: Request) { return handleMcp(req, 'auth'); }
export async function DELETE(req: Request) { return handleMcp(req, 'auth'); }
