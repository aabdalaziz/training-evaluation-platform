'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** /admin/sign — P50 «توقيعي»: ما ينتظر توقيعي (الاسم الرسمي: سجلّ التوقيعات المعلّقة). الخادم يقرّر من يرى ماذا؛ الصفحة تعرض فقط. */
import dynamic from 'next/dynamic';

const SignBoard = dynamic(() => import('./SignBoard'), { ssr: false, loading: () => <p style={{ padding: '110px 18px', textAlign: 'center', color: '#64748b' }}>…</p> });
export default function Page() { return <SignBoard />; }
