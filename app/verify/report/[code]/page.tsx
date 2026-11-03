'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** /verify/report/[code] — التحقّق العام من تقرير تعلّم معتمَد (P46): البرنامج والفترة والمعتمِد فقط — بلا أسماء طلاب ولا درجات */
import { PortalShell } from '../../../components/PortalShell';
import { ReportVerify } from '../../../components/Reports';

export default function VerifyReportPage({ params }: { params: { code: string } }) { return <PortalShell><ReportVerify code={String(params.code || '').toUpperCase()} /></PortalShell>; }
