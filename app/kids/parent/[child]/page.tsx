// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
import type { Metadata } from 'next';
import { PortalShell } from '../../../components/PortalShell';
import { ParentHome, PARENT_CSS } from '../../../components/kids/ParentHome';

export const metadata: Metadata = { title: 'بَذْرَةُ طفلي — بَيْتُ بَيان' };
export const dynamic = 'force-dynamic';

/** هـ-6-و — بذرة طفل واحد: الرحلة · قالَ لِلُؤلُؤ · مهمّة البيت · الأمانات · الحذف */
export default function KidsChildPage({ params }: { params: { child: string } }) {
  return (
    <PortalShell>
      <style dangerouslySetInnerHTML={{ __html: PARENT_CSS }} />
      <div dir="rtl"><ParentHome childId={params.child} /></div>
    </PortalShell>
  );
}
