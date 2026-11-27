import type { Metadata } from 'next';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** P88-ب: بيانات صفحة /france للمشاركة (واتساب/الرسائل) — عنوان ووصف بالفرنسيّة والإنجليزيّة بدل عنوان البوّابة العربيّ */
export const metadata: Metadata = {
  title: 'Programme d’immersion en arabe — Cohorte France · Arabic Immersion Program',
  description: 'Votre espace : niveau Miaar, émargement, questionnaire du jour, certificat. Médine, 6 → 26 décembre 2026, avec Dr Alaa. / Your space: level, attendance, daily survey, certificate.',
  openGraph: { title: 'Programme d’immersion en arabe — Cohorte France', description: 'Médine · 6 → 26 décembre 2026 · 60 heures · Dr Alaa — athar-portal.com/france', locale: 'fr_FR', alternateLocale: ['en_US', 'ar_SA'], type: 'website' },
  alternates: { canonical: '/france' },
};
export default function FranceLayout({ children }: { children: React.ReactNode }) { return children; }
