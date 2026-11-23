// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
import type { Metadata } from 'next';
import { PortalShell } from '../../components/PortalShell';
import { FacilitatorGuide, FACILITATOR_CSS } from '../../components/kids/FacilitatorGuide';

export const metadata: Metadata = { title: 'دليل الميسّر — بَيان', description: 'دليل اللقاء الأسبوعيّ لميسّري بَيان: الدور، الأمانة، عشرون دقيقة في أربع خطوات، ولغة الميسّر.', robots: { index: false } };

/** هـ-6-ي — افتتاحية (ج) للميسّرين + ورقة اللقاء */
export default function KidsFacilitatorPage() {
  return (
    <PortalShell>
      <style dangerouslySetInnerHTML={{ __html: FACILITATOR_CSS }} />
      <div dir="rtl" style={{ padding: '24px 16px' }}><FacilitatorGuide /></div>
    </PortalShell>
  );
}
