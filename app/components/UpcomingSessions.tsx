'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// الجلسات القادمة لبرنامج/شعبة — تُعرض في صفحة البرنامج العامة (الجلسات العامة) وفي بوابة المتدرب (/me — جلسات شعبته)
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase/client';
import { Icon } from '../../lib/ui/icons';
import type { Lang } from '../../lib/portal/content';
import { timeState, STATE_LABEL, canJoin, fmtWhen, fmtRange, sessionTitle, providerLabel, classroomLabel } from '../../lib/portal/live';
import type { LiveSession, Classroom } from '../../lib/portal/live';

export default function UpcomingSessions({ programId, lang = 'ar', compact = false, limit = 6 }: { programId: string; lang?: Lang; compact?: boolean; limit?: number }) {
  const db = useMemo(() => supabase(), []); const [rows, setRows] = useState<LiveSession[] | null>(null); const [room, setRoom] = useState<Classroom | null>(null); const [now, setNow] = useState<Date | null>(null);
  useEffect(() => { (async () => { try {
    const since = new Date(Date.now() - 3 * 3600000).toISOString();
    const { data } = await db.from('portal_sessions').select('*').eq('program_id', programId).neq('status', 'cancelled').gte('starts_at', since).order('starts_at').limit(limit); // RLS: العامة للجميع، وجلسات الشعبة لمتدربيها
    const list = (data || []) as LiveSession[]; setRows(list);
    const cid = list.find(x => x.classroom_id)?.classroom_id; if (cid) { const { data: c } = await db.from('classrooms').select('id,code,section_name,program_id').eq('id', cid).maybeSingle(); setRoom((c as Classroom) || null); }
  } catch { setRows([]); } setNow(new Date()); })(); }, [db, programId, limit]);
  if (!rows || rows.length === 0 || !now) return null;
  return (
    <div className={compact ? 'ups compact' : 'pt-box ups'}>
      <h3><Icon name="play" size={18} /> {lang === 'ar' ? 'الجلسات القادمة' : 'Upcoming sessions'}{room && <small> — {classroomLabel(room, lang)}</small>}</h3>
      <div className="ups-list">{rows.map(s => { const st = timeState(s, now); return <Link key={s.id} href={`/live/${s.id}`} className={`ups-item ${st}`}><span className="ups-when"><b>{fmtWhen(s.starts_at, lang, { weekday: true, date: true })}</b><small dir="ltr">{fmtRange(s, lang)}</small></span><span className="ups-t"><b>{sessionTitle(s, lang)}</b><small>{providerLabel(s.provider, lang)}</small></span><span className={`ups-st ${st}`}>{canJoin(st) ? (lang === 'ar' ? 'انضم الآن' : 'Join now') : STATE_LABEL[st][lang]}</span></Link>; })}</div>
      <Link href="/live" className="ups-all">{lang === 'ar' ? 'كل الجلسات' : 'All sessions'} <Icon name="arrow" size={13} /></Link>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
    </div>
  );
}
const CSS = `
.ups h3{display:flex;gap:8px;align-items:center;margin:0 0 10px;font-size:16px;color:#0f2a4e}.ups h3 small{color:#64748b;font-weight:600;font-size:12.5px}.ups.compact{margin-top:10px;padding-top:10px;border-top:1px dashed #e2e8f0}.ups.compact h3{font-size:14px}
.ups-list{display:grid;gap:6px}.ups-item{display:grid;grid-template-columns:170px 1fr auto;gap:10px;align-items:center;border:1px solid #e2e8f0;border-radius:12px;padding:8px 12px;text-decoration:none;color:#0f2a4e;background:#fff}.ups-item:hover{border-color:#0b8a83}.ups-item.live{border-color:#dc2626;background:#fff7f7}.ups-item.soon{border-color:#d97706}
.ups-when{display:grid}.ups-when b{font-size:12.5px;color:#0f172a}.ups-when small{color:#64748b;font-size:11.5px}.ups-t{display:grid;min-width:0}.ups-t b{font-size:13.5px;color:#0f172a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ups-t small{color:#64748b;font-size:11.5px}
.ups-st{font-size:11.5px;font-weight:900;border-radius:999px;padding:3px 10px;background:#f1f5f9;color:#475569}.ups-st.live,.ups-st.soon{background:#0b8a83;color:#fff}
.ups-all{display:inline-flex;gap:4px;align-items:center;margin-top:8px;font-size:12.5px;font-weight:800;color:#0b8a83;text-decoration:none}
@media(max-width:640px){.ups-item{grid-template-columns:1fr}}
`;
