'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** /admin/org/letters — P52 «رسالة الشهر»: مكتب توقيع الرسائل الشهرية للجهات (الاسم الرسمي: التقرير الشهري لأثر الجهة). الخادم يقرّر؛ الصفحة تعرض وتجمع السطر والتوقيع. */
import dynamic from 'next/dynamic';

const LettersDesk = dynamic(() => import('./LettersDesk'), { ssr: false, loading: () => <p style={{ padding: '110px 18px', textAlign: 'center', color: '#64748b' }}>…</p> });
export default function Page() { return <LettersDesk />; }
