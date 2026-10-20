'use client';
/**
 * /admin/survey-settings
 * Kept only for backward-compatible links. All survey configuration (levels,
 * groups, trainers, schedules, survey links/QR) lives in the central admin
 * panel so data is entered in ONE place: /admin/management
 */
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SurveySettingsRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/admin/management?tab=rooms'); }, [router]);
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', fontFamily: 'Tajawal, Arial, sans-serif', color: '#14466B', fontWeight: 800 }}>
      جارٍ التحويل إلى لوحة الإدارة المركزية… / Redirecting to the central admin panel…
    </div>
  );
}
