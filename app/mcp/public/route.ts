// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /mcp/public — النسخة العامة من خادم MCP لأَثَر (P20): بلا هوية — اكتشاف البرامج · التحقق من شهادة · مؤشر الأداء (المرصد) · الموارد والمطالبات العامة
 *  بحد يومي حسب IP. مع مفتاح جهة أو تفويض شخصي تُفتح بقية الأدوات تلقائيًا (أو استخدم /mcp).
 */
import { handleMcp } from '../../../lib/portal/mcp-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function OPTIONS(req: Request) { return handleMcp(req, 'public'); }
export async function GET(req: Request) { return handleMcp(req, 'public'); }
export async function POST(req: Request) { return handleMcp(req, 'public'); }
export async function DELETE(req: Request) { return handleMcp(req, 'public'); }
