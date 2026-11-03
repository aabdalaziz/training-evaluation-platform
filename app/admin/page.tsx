// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** /admin نفسه ليس غرفة بل «مدخل»: فتات «الطريق» وروابط «الإدارة» تصل إليه، فيُحوَّل إلى الردهة (كل أبواب الموظف) — كان يعطي 404 */
import { redirect } from 'next/navigation';
export const dynamic = 'force-dynamic';
export default function AdminIndex() { redirect('/hub?stay=1'); }
