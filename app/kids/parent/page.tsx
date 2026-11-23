// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
import type { Metadata } from 'next';
import { PortalShell } from '../../components/PortalShell';
import { ParentHome, PARENT_CSS } from '../../components/kids/ParentHome';

export const metadata: Metadata = { title: 'بَيْتُ بَيان — لوليّ الأمر', description: 'بذرة لكلّ طفل تكبر بجلساته، وأمانات لؤلؤ بيدك، ورسالتها كلّ أسبوع.' };

/** هـ-6-و «بَيْتُ بَيان» — البوّابة الأبوية */
export default function KidsParentPage() {
  return (
    <PortalShell>
      <style dangerouslySetInnerHTML={{ __html: PARENT_CSS }} />
      <div dir="rtl"><ParentHome /></div>
    </PortalShell>
  );
}
