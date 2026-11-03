'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /needs — «ما يحتاجه الممارسون» (P44 «البرنامج الذي لم يُكتب بعد» · الاسم الرسمي: الاحتياج التدريبي المعلَن)
 *  عام: الحاجات المعلَنة (قال لها خمسة «وأنا أيضًا») بلا أسماء · المسجَّل: يكتب حاجته بجملة، يرى البذور، يقول «وأنا أيضًا»، يتابع «حاجاتي»
 *  عضو هيئة أَثَر المعتمَد/الطاقم: «أتبنّى هذه الحاجة» → مسودّة في هندسة البرامج التدريبية → اعتماد بشري → برنامج «وُلد من حاجة»
 *  ?n=<id> يُبرز حاجة (رابط المشاركة) · ?station=<id>&text=… نموذج معبّأ من محطة «لم تسنح الفرصة» في /me/after
 */
import { useEffect, useMemo, useState } from 'react';
import { PortalShell } from '../components/PortalShell';
import { fastToken } from '../components/Pocket';
import { supabase } from '../../lib/supabase/client';
import { NeedsBoard } from '../components/Needs';

export default function NeedsPage() { return <PortalShell><Inner /></PortalShell>; }
function Inner() {
  const db = useMemo(() => supabase(), []); const [tok, setTok] = useState<string | null>(null);
  useEffect(() => { fastToken(db).then(t => setTok(t || '')); }, [db]);
  if (tok === null) return <main className="pt-main"><section className="pt-box"><p className="pt-muted">…</p></section></main>;
  const token = tok ? async () => { const { data } = await db.auth.getSession(); return data.session?.access_token || tok; } : null;
  return <NeedsBoard token={token} signedIn={!!tok} />;
}
