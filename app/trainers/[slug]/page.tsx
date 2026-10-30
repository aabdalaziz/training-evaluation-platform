'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** /trainers/[slug] — صفحة عضو هيئة أَثَر (مدرب) (P31): السيرة بكلماته · «ما شهده أَثَر» من السجلات · شهادة التوثيق · طلب عبر أَثَر */
import { PortalShell } from '../../components/PortalShell';
import { DirectoryProfile } from '../../components/Directory';

export default function Page({ params }: { params: { slug: string } }) { return <PortalShell><DirectoryProfile slug={params.slug} face="trainer" /></PortalShell>; }
