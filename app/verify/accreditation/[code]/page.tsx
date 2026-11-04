'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** /verify/accreditation/[code] — التحقّق العام من نسخة مختومة لملف الدراسة الذاتية للاعتماد البرامجي (P48-ب): بلا دخول · بلا أسماء متدرّبين · بصمة SHA-256 تُعاد حسابها لحظيًّا */
import { PortalShell } from '../../../components/PortalShell';
import { AccredVerify } from '../../../components/Accreditation';

export default function VerifyAccreditationPage({ params }: { params: { code: string } }) { return <PortalShell><AccredVerify code={String(params.code || '').toUpperCase()} /></PortalShell>; }
